from app.database.db import get_db
from app.services.excel_service import export_all_tables_to_excel
from collections import defaultdict

def get_all_contractors():
    db = get_db()
    contractors = db.execute("SELECT * FROM Contractors ORDER BY Name").fetchall()
    return [dict(row) for row in contractors]

def add_contractor(name, contact_info):
    db = get_db()
    cursor = db.execute("INSERT INTO Contractors (Name, ContactInfo) VALUES (?, ?)", (name, contact_info))
    db.commit()
    export_all_tables_to_excel()
    return cursor.lastrowid

def get_contractor_details(contractor_id):
    """
    Gets all financial and transaction details for a single contractor.
    MODIFIED to calculate financial summary based on CARPET quality, not stock quality.
    """
    db = get_db()
    
    contractor = db.execute("SELECT * FROM Contractors WHERE ContractorID = ?", (contractor_id,)).fetchone()
    if not contractor:
        return None

    orders_raw = db.execute("""
        SELECT o.OrderID, o.DesignNumber, o.ShadeCard, o.Size, o.Quality, o.DateIssued, o.Status, o.Wage
        FROM Orders o WHERE o.ContractorID = ? ORDER BY o.DateIssued DESC
    """, (contractor_id,)).fetchall()
    
    order_ids = [o['OrderID'] for o in orders_raw]

    # Create a mapping from OrderID to Order Quality for easy lookup
    order_id_to_quality_map = {o['OrderID']: o['Quality'] for o in orders_raw}

    # Fetch all relevant financial data at once
    transactions_raw = db.execute(f"""
        SELECT st.*, si.Type, si.Quality as StockQuality, o.Quality as OrderQuality
        FROM StockTransactions st
        JOIN StockItems si ON st.StockID = si.StockID
        JOIN Orders o ON st.OrderID = o.OrderID
        WHERE o.ContractorID = ?
    """, (contractor_id,)).fetchall()

    payments_raw = db.execute("SELECT * FROM Payments WHERE ContractorID = ?", (contractor_id,)).fetchall()
    
    deductions_raw = db.execute(f"""
        SELECT d.*, o.Quality as OrderQuality FROM Deductions d 
        JOIN Orders o ON d.OrderID = o.OrderID WHERE o.ContractorID = ?
    """, (contractor_id,)).fetchall()

    # --- NEW LOGIC: Process financial data based on CARPET (Order) Quality ---
    summary_by_carpet_quality = defaultdict(lambda: {
        'total_wages': 0,
        'issued_value': 0,
        'returned_value': 0,
        'deductions': 0,
        'payments': 0,
    })

    # 1. Sum wages by carpet quality
    for order in orders_raw:
        quality = order['Quality']
        summary_by_carpet_quality[quality]['total_wages'] += order['Wage'] or 0

    # 2. Sum transaction values by carpet quality
    for trans in transactions_raw:
        quality = trans['OrderQuality']
        value = trans['WeightKg'] * trans['PricePerKgAtTimeOfTransaction']
        if trans['TransactionType'] == 'Issued':
            summary_by_carpet_quality[quality]['issued_value'] += value
        else: # Returned
            summary_by_carpet_quality[quality]['returned_value'] += value

    # 3. Sum deductions by carpet quality
    for ded in deductions_raw:
        quality = ded['OrderQuality']
        summary_by_carpet_quality[quality]['deductions'] += ded['Amount']

    # 4. Sum order-specific payments by carpet quality
    general_payments = 0
    for pay in payments_raw:
        if pay['OrderID'] and pay['OrderID'] in order_id_to_quality_map:
            quality = order_id_to_quality_map[pay['OrderID']]
            summary_by_carpet_quality[quality]['payments'] += pay['Amount']
        else:
            general_payments += pay['Amount']

    # 5. Calculate net values and final balances for each quality
    processed_summary_list = []
    for quality, data in summary_by_carpet_quality.items():
        net_stock_value = data['issued_value'] - data['returned_value']
        balance = (data['total_wages'] - net_stock_value - data['deductions']) - data['payments']
        processed_summary_list.append({
            'quality': quality,
            'total_wages': round(data['total_wages'], 2),
            'net_stock_value': round(net_stock_value, 2),
            'deductions': round(data['deductions'], 2),
            'payments': round(data['payments'], 2),
            'balance_owed': round(balance, 2)
        })

    # 6. Calculate the true overall summary
    total_wages_all = sum(s['total_wages'] for s in processed_summary_list)
    total_net_stock_all = sum(s['net_stock_value'] for s in processed_summary_list)
    total_deductions_all = sum(s['deductions'] for s in processed_summary_list)
    total_order_payments_all = sum(s['payments'] for s in processed_summary_list)
    total_paid_all = total_order_payments_all + general_payments

    final_balance_owed = (total_wages_all - total_net_stock_all - total_deductions_all) - total_paid_all

    overall_summary = {
        "total_order_wages": round(total_wages_all, 2),
        "net_stock_value": round(total_net_stock_all, 2),
        "total_deductions": round(total_deductions_all, 2),
        "total_paid": round(total_paid_all, 2),
        "final_balance_owed": round(final_balance_owed, 2)
    }

    # ... (currently_held_stock query is unchanged)
    currently_held_stock = db.execute("""
        SELECT 
            si.Type, si.Quality, si.ColorShadeNumber,
            SUM(CASE WHEN st.TransactionType = 'Issued' THEN st.WeightKg ELSE -st.WeightKg END) as NetWeightKg
        FROM StockTransactions st
        JOIN Orders o ON st.OrderID = o.OrderID
        JOIN StockItems si ON st.StockID = si.StockID
        WHERE o.ContractorID = ? AND o.Status = 'Open'
        GROUP BY st.StockID
        HAVING NetWeightKg > 0.001
    """, (contractor_id,)).fetchall()

    return {
        "contractor": dict(contractor),
        "orders": [dict(o) for o in orders_raw],
        "transactions": [dict(t) for t in transactions_raw],
        "payments": [dict(p) for p in payments_raw],
        "currently_held_stock": [dict(row) for row in currently_held_stock],
        "summary_by_carpet_quality": processed_summary_list, # NEW STRUCTURE
        "overall_summary": overall_summary # NEW CALCULATION
    }
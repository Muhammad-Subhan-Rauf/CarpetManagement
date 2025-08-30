# Original relative path: app/services/contractor_service.py

# /app/services/contractor_service.py

from app.database.db import get_db
from app.services.excel_service import export_all_tables_to_excel

def get_all_contractors():
    # ... (this function is unchanged)
    db = get_db()
    contractors = db.execute("SELECT * FROM Contractors ORDER BY Name").fetchall()
    return [dict(row) for row in contractors]

def add_contractor(name, contact_info):
    # ... (this function is unchanged)
    db = get_db()
    cursor = db.execute("INSERT INTO Contractors (Name, ContactInfo) VALUES (?, ?)", (name, contact_info))
    db.commit()
    export_all_tables_to_excel()
    return cursor.lastrowid

def get_contractor_details(contractor_id):
    """
    Gets all financial and transaction details for a single contractor.
    --- MODIFIED TO WORK WITH THE NEW UNIFIED 'ORDERS' SYSTEM ---
    """
    db = get_db()
    
    contractor = db.execute("SELECT * FROM Contractors WHERE ContractorID = ?", (contractor_id,)).fetchone()
    if not contractor:
        return None

    # Query all orders for the contractor and calculate their financial state
    orders_query = """
        SELECT
            o.OrderID,
            o.DesignNumber,
            o.DateIssued,
            o.Status,
            o.Notes,
            
            (SELECT IFNULL(SUM(st.WeightKg * st.PricePerKgAtTimeOfTransaction), 0)
             FROM StockTransactions st
             WHERE st.OrderID = o.OrderID AND st.TransactionType = 'Issued') as IssuedValue,
            
            (SELECT IFNULL(SUM(st.WeightKg * st.PricePerKgAtTimeOfTransaction), 0)
             FROM StockTransactions st
             WHERE st.OrderID = o.OrderID AND st.TransactionType = 'Returned') as ReturnedValue,

            (SELECT IFNULL(SUM(p.Amount), 0)
             FROM Payments p
             WHERE p.OrderID = o.OrderID) as AmountPaid
             
        FROM Orders o
        WHERE o.ContractorID = ?
        ORDER BY o.DateIssued DESC
    """
    orders_raw = db.execute(orders_query, (contractor_id,)).fetchall()
    
    processed_orders = []
    for record in orders_raw:
        r_dict = dict(record)
        net_value = r_dict['IssuedValue'] - r_dict['ReturnedValue']
        amount_owed = net_value - r_dict['AmountPaid']
        r_dict['AmountOwed'] = round(amount_owed, 2)
        processed_orders.append(r_dict)
    
    # Get all transactions for this contractor across all their orders
    transactions = db.execute("""
        SELECT st.*, si.Type, si.Quality, si.ColorShadeNumber FROM StockTransactions st
        JOIN Orders o ON st.OrderID = o.OrderID
        JOIN StockItems si ON st.StockID = si.StockID
        WHERE o.ContractorID = ? ORDER BY st.TransactionID DESC
    """, (contractor_id,)).fetchall()

    # Get all payments for this contractor (both general and order-specific)
    payments = db.execute(
        "SELECT * FROM Payments WHERE ContractorID = ? ORDER BY PaymentDate DESC",
        (contractor_id,)
    ).fetchall()
    
    # Ledger for stock currently held by contractor (from 'Open' orders)
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

    # Calculate the overall financial summary
    total_issued_value = sum(r['IssuedValue'] for r in processed_orders)
    total_returned_value = sum(r['ReturnedValue'] for r in processed_orders)
    total_paid = sum(p['Amount'] for p in payments) # Sums ALL payments
    net_work_value = total_issued_value - total_returned_value
    final_balance_owed = net_work_value - total_paid

    return {
        "contractor": dict(contractor),
        "orders": processed_orders, # Renamed from lent_records
        "transactions": [dict(t) for t in transactions],
        "payments": [dict(p) for p in payments],
        "currently_held_stock": [dict(row) for row in currently_held_stock],
        "financial_summary": {
            "total_value_issued": round(total_issued_value, 2),
            "total_value_returned": round(total_returned_value, 2),
            "net_work_value": round(net_work_value, 2),
            "total_paid": round(total_paid, 2),
            "final_balance_owed": round(final_balance_owed, 2)
        }
    }
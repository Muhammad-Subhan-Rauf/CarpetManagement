# Original relative path: app/services/contractor_service.py

# /app/services/contractor_service.py

from app.database.db import get_db
from app.services.excel_service import export_all_tables_to_excel

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
    MODIFIED to include more order details and factor in deductions.
    """
    db = get_db()
    
    contractor = db.execute("SELECT * FROM Contractors WHERE ContractorID = ?", (contractor_id,)).fetchone()
    if not contractor:
        return None

    orders_query = """
        SELECT
            o.OrderID,
            o.DesignNumber,
            o.ShadeCard,
            o.Size,
            o.Quality,
            o.DateIssued,
            o.Status,
            
            (SELECT IFNULL(SUM(st.WeightKg * st.PricePerKgAtTimeOfTransaction), 0)
             FROM StockTransactions st
             WHERE st.OrderID = o.OrderID AND st.TransactionType = 'Issued') as IssuedValue,
            
            (SELECT IFNULL(SUM(st.WeightKg * st.PricePerKgAtTimeOfTransaction), 0)
             FROM StockTransactions st
             WHERE st.OrderID = o.OrderID AND st.TransactionType = 'Returned') as ReturnedValue,

            (SELECT IFNULL(SUM(p.Amount), 0)
             FROM Payments p
             WHERE p.OrderID = o.OrderID),
            
            (SELECT IFNULL(SUM(d.Amount), 0)
             FROM Deductions d
             WHERE d.OrderID = o.OrderID) as TotalDeductions
             
        FROM Orders o
        WHERE o.ContractorID = ?
        ORDER BY o.DateIssued DESC
    """
    orders_raw = db.execute(orders_query, (contractor_id,)).fetchall()
    processed_orders = [dict(row) for row in orders_raw]
    
    transactions = db.execute("""
        SELECT st.*, si.Type, si.Quality, si.ColorShadeNumber FROM StockTransactions st
        JOIN Orders o ON st.OrderID = o.OrderID
        JOIN StockItems si ON st.StockID = si.StockID
        WHERE o.ContractorID = ? ORDER BY st.TransactionID DESC
    """, (contractor_id,)).fetchall()

    payments = db.execute(
        "SELECT * FROM Payments WHERE ContractorID = ? ORDER BY PaymentDate DESC",
        (contractor_id,)
    ).fetchall()
    
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
    total_deductions = sum(r['TotalDeductions'] for r in processed_orders)
    total_paid = sum(p['Amount'] for p in payments)
    
    net_work_value = total_issued_value - total_returned_value - total_deductions
    final_balance_owed = net_work_value - total_paid

    return {
        "contractor": dict(contractor),
        "orders": processed_orders,
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
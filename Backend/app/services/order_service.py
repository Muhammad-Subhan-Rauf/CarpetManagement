# Original relative path: app/services/order_service.py

# /app/services/order_service.py
from app.database.db import get_db
from app.services.excel_service import export_all_tables_to_excel
import datetime

def get_all_orders(status=None):
    db = get_db()
    base_query = """
        SELECT o.*, c.Name as ContractorName
        FROM Orders o
        JOIN Contractors c ON o.ContractorID = c.ContractorID
    """
    params = []
    if status:
        base_query += " WHERE o.Status = ?"
        params.append(status.capitalize())
        
    base_query += " ORDER BY o.DateIssued DESC"
    
    orders = db.execute(base_query, params).fetchall()
    return [dict(row) for row in orders]

def get_order_by_id(order_id):
    db = get_db()
    order = db.execute("""
        SELECT o.*, c.Name as ContractorName 
        FROM Orders o JOIN Contractors c ON o.ContractorID = c.ContractorID
        WHERE o.OrderID = ?
    """, (order_id,)).fetchone()
    return dict(order) if order else None

def create_order(data):
    db = get_db()
    try:
        db.execute("BEGIN")
        cursor = db.execute(
            """INSERT INTO Orders (ContractorID, DesignNumber, ShadeCard, Quality, Size, DateIssued, DateDue, PenaltyPerDay, Notes)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (data['ContractorID'], data['DesignNumber'], data.get('ShadeCard'), data.get('Quality'),
             data.get('Size'), data['DateIssued'], data.get('DateDue'), data.get('PenaltyPerDay', 0), data.get('Notes'))
        )
        order_id = cursor.lastrowid

        for trans in data.get('transactions', []):
            stock_id = trans['StockID']
            weight_kg = float(trans['WeightKg'])
            
            stock_item = db.execute("SELECT * FROM StockItems WHERE StockID = ?", (stock_id,)).fetchone()
            if not stock_item: raise ValueError(f"Stock item ID {stock_id} not found")

            new_quantity = stock_item['QuantityInStockKg'] - weight_kg
            if new_quantity < 0: raise ValueError(f"Not enough stock for item ID {stock_id}")
            
            db.execute("UPDATE StockItems SET QuantityInStockKg = ? WHERE StockID = ?", (new_quantity, stock_id))
            db.execute(
                "INSERT INTO StockTransactions (OrderID, StockID, TransactionType, WeightKg, PricePerKgAtTimeOfTransaction) VALUES (?, ?, ?, ?, ?)",
                (order_id, stock_id, 'Issued', weight_kg, stock_item['CurrentPricePerKg'])
            )
        
        db.commit()
        export_all_tables_to_excel()
        return {"success": True, "OrderID": order_id}
    except (ValueError, db.Error) as e:
        db.rollback()
        return {"success": False, "error": str(e)}

def complete_order(order_id, data):
    db = get_db()
    try:
        db.execute("BEGIN")
        
        date_completed = data['dateCompleted']
        db.execute(
            "UPDATE Orders SET DateCompleted = ?, Status = 'Closed' WHERE OrderID = ?",
            (date_completed, order_id)
        )

        # Handle stock reconciliation (returned vs kept)
        for item in data.get('reconciliation', []):
            stock_id = item['StockID']
            weight_returned = float(item.get('weight_returned', 0.0))
            weight_kept = float(item.get('weight_kept', 0.0))
            
            issued_trans = db.execute(
                "SELECT PricePerKgAtTimeOfTransaction FROM StockTransactions WHERE OrderID = ? AND StockID = ? AND TransactionType = 'Issued' LIMIT 1",
                (order_id, stock_id)
            ).fetchone()
            price_at_transaction = issued_trans['PricePerKgAtTimeOfTransaction'] if issued_trans else 0

            if weight_returned > 0:
                db.execute("UPDATE StockItems SET QuantityInStockKg = QuantityInStockKg + ? WHERE StockID = ?", (weight_returned, stock_id))
                db.execute(
                    "INSERT INTO StockTransactions (OrderID, StockID, TransactionType, WeightKg, PricePerKgAtTimeOfTransaction, Notes) VALUES (?, ?, ?, ?, ?, ?)",
                    (order_id, stock_id, 'Returned', weight_returned, price_at_transaction, "Returned to inventory")
                )
            
            if weight_kept > 0:
                db.execute(
                    "INSERT INTO StockTransactions (OrderID, StockID, TransactionType, WeightKg, PricePerKgAtTimeOfTransaction, Notes) VALUES (?, ?, ?, ?, ?, ?)",
                    (order_id, stock_id, 'Returned', weight_kept, price_at_transaction, "Kept by contractor")
                )

        # Add a final payment if provided
        final_payment = float(data.get('final_payment', 0.0))
        if final_payment > 0:
            contractor_id = db.execute("SELECT ContractorID FROM Orders WHERE OrderID = ?", (order_id,)).fetchone()['ContractorID']
            add_payment_to_order(order_id, contractor_id, final_payment, "Final payment on order completion")

        db.commit()
        export_all_tables_to_excel()
        return {"success": True}
    except (ValueError, db.Error) as e:
        db.rollback()
        return {"success": False, "error": str(e)}

def add_payment_to_order(order_id, contractor_id, amount, notes):
    db = get_db()
    payment_date = datetime.date.today().isoformat()
    db.execute(
        "INSERT INTO Payments (OrderID, ContractorID, PaymentDate, Amount, Notes) VALUES (?, ?, ?, ?, ?)",
        (order_id, contractor_id, payment_date, amount, notes)
    )
    db.commit()
    export_all_tables_to_excel()
    return {"success": True}

def get_order_financials(order_id):
    db = get_db()
    order = db.execute("SELECT * FROM Orders WHERE OrderID = ?", (order_id,)).fetchone()
    if not order: return None
    
    query = """
    SELECT
        (SELECT IFNULL(SUM(Amount), 0) FROM Payments WHERE OrderID = o.OrderID) AS AmountPaid,
        (SELECT IFNULL(SUM(WeightKg * PricePerKgAtTimeOfTransaction), 0) FROM StockTransactions WHERE OrderID = o.OrderID AND TransactionType = 'Issued') AS IssuedValue,
        (SELECT IFNULL(SUM(WeightKg * PricePerKgAtTimeOfTransaction), 0) FROM StockTransactions WHERE OrderID = o.OrderID AND TransactionType = 'Returned') AS ReturnedValue
    FROM Orders o WHERE o.OrderID = ?;
    """
    result = db.execute(query, (order_id,)).fetchone()
    
    financials = dict(result)
    
    total_fine = 0
    # Use DateCompleted if available, otherwise check against today for open orders
    end_date = order['DateCompleted'] if order['DateCompleted'] else str(datetime.date.today())
    if order['DateDue'] and order['PenaltyPerDay'] > 0:
        if end_date > order['DateDue']:
            days_diff = (datetime.datetime.strptime(end_date, '%Y-%m-%d').date() - datetime.datetime.strptime(order['DateDue'], '%Y-%m-%d').date()).days
            total_fine = max(0, days_diff) * order['PenaltyPerDay']

    financials['TotalFine'] = round(total_fine, 2)
    net_value = financials['IssuedValue'] - financials['ReturnedValue']
    pending_amount = net_value - financials['AmountPaid'] + financials['TotalFine']
    
    financials['NetValue'] = round(net_value, 2)
    financials['AmountPending'] = round(pending_amount, 2)
    return financials

def get_transactions_by_order_id(order_id):
    db = get_db()
    transactions = db.execute("""
        SELECT st.*, si.Type, si.Quality, si.ColorShadeNumber
        FROM StockTransactions st JOIN StockItems si ON st.StockID = si.StockID
        WHERE st.OrderID = ? ORDER BY st.TransactionID
    """, (order_id,)).fetchall()
    return [dict(row) for row in transactions]

def get_payments_by_order_id(order_id):
    db = get_db()
    payments = db.execute("SELECT * FROM Payments WHERE OrderID = ? ORDER BY PaymentDate DESC", (order_id,)).fetchall()
    return [dict(row) for row in payments]
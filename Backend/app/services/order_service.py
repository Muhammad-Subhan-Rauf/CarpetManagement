# /app/services/order_service.py
from app.database.db import get_db
from app.services.excel_service import export_all_tables_to_excel
import datetime

def get_all_orders():
    db = get_db()
    orders = db.execute("""
        SELECT o.*, c.Name as ContractorName 
        FROM Orders o JOIN Contractors c ON o.ContractorID = c.ContractorID
        ORDER BY o.DateIssued DESC
    """).fetchall()
    return [dict(row) for row in orders]

def get_order_by_id(order_id):
    db = get_db()
    order = db.execute("""
        SELECT o.*, c.Name as ContractorName 
        FROM Orders o JOIN Contractors c ON o.ContractorID = c.ContractorID
        WHERE o.OrderID = ?
    """, (order_id,)).fetchone()
    return dict(order) if order else None

def get_transactions_by_order_id(order_id):
    db = get_db()
    transactions = db.execute("""
        SELECT ost.*, si.Type, si.Quality, si.ColorShadeNumber, si.IdentifyingNumber
        FROM OrderStockTransactions ost JOIN StockItems si ON ost.StockID = si.StockID
        WHERE ost.OrderID = ?
        ORDER BY ost.TransactionID
    """, (order_id,)).fetchall()
    return [dict(row) for row in transactions]

def get_payments_by_order_id(order_id):
    db = get_db()
    payments = db.execute("SELECT * FROM Payments WHERE OrderID = ? ORDER BY PaymentDate DESC", (order_id,)).fetchall()
    return [dict(row) for row in payments]


def create_order(data):
    db = get_db()
    try:
        db.execute("BEGIN")

        cursor = db.execute("""
            INSERT INTO Orders (ContractorID, Quality, Size, DesignNumber, ShadeCard, DateIssued, DateDue, PenaltyPerDay)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            data['ContractorID'], data.get('Quality'), data.get('Size'), data['DesignNumber'], 
            data.get('ShadeCard'), data['DateIssued'], data.get('DateDue'), 
            data.get('PenaltyPerDay', 0.00)
        ))
        order_id = cursor.lastrowid

        transactions = data.get('transactions', [])
        for trans in transactions:
            stock_id = trans['StockID']
            weight_kg = float(trans['WeightKg'])
            
            stock_item = db.execute("SELECT * FROM StockItems WHERE StockID = ?", (stock_id,)).fetchone()
            if not stock_item: raise ValueError(f"Stock item ID {stock_id} not found")

            new_quantity = stock_item['QuantityInStockKg'] - weight_kg
            if new_quantity < 0: raise ValueError(f"Not enough stock for item ID {stock_id}")
            
            db.execute("UPDATE StockItems SET QuantityInStockKg = ? WHERE StockID = ?", (new_quantity, stock_id))
            db.execute(
                "INSERT INTO OrderStockTransactions (OrderID, StockID, TransactionType, WeightKg, PricePerKgAtTimeOfTransaction) VALUES (?, ?, ?, ?, ?)",
                (order_id, stock_id, 'Issued', weight_kg, stock_item['CurrentPricePerKg'])
            )
        
        db.commit()
        export_all_tables_to_excel()
        return {"success": True, "OrderID": order_id}
    except (ValueError, db.Error) as e:
        db.rollback()
        return {"success": False, "error": str(e)}


def add_payment_to_order(order_id, amount, notes):
    db = get_db()
    if not isinstance(amount, (int, float)) or amount <= 0:
        return {"success": False, "error": "Invalid payment amount."}
    
    payment_date = datetime.date.today().isoformat()
    cursor = db.execute(
        "INSERT INTO Payments (OrderID, PaymentDate, Amount, Notes) VALUES (?, ?, ?, ?)",
        (order_id, payment_date, amount, notes)
    )
    if cursor.rowcount == 0:
        db.rollback()
        return {"success": False, "error": "Failed to record payment."}
    
    db.commit()
    export_all_tables_to_excel()
    return {"success": True}


def complete_order(order_id, data):
    db = get_db()
    try:
        db.execute("BEGIN")
        
        date_completed = data['dateCompleted']
        new_payment = float(data.get('newPaymentAmount', 0.0))
        
        db.execute(
            "UPDATE Orders SET DateCompleted = ? WHERE OrderID = ?",
            (date_completed, order_id)
        )

        # If a final payment was made, add it to the Payments table
        if new_payment > 0:
            add_payment_to_order(order_id, new_payment, "Final payment on completion")

        for trans in data.get('returnedStock', []):
            stock_id = trans['StockID']
            weight_kg = float(trans['WeightKg'])

            db.execute(
                "UPDATE StockItems SET QuantityInStockKg = QuantityInStockKg + ? WHERE StockID = ?",
                (weight_kg, stock_id)
            )

            issued_trans = db.execute(
                "SELECT PricePerKgAtTimeOfTransaction FROM OrderStockTransactions WHERE OrderID = ? AND StockID = ? AND TransactionType = 'Issued' LIMIT 1",
                (order_id, stock_id)
            ).fetchone()
            price_at_transaction = issued_trans['PricePerKgAtTimeOfTransaction'] if issued_trans else 0

            db.execute(
                "INSERT INTO OrderStockTransactions (OrderID, StockID, TransactionType, WeightKg, PricePerKgAtTimeOfTransaction) VALUES (?, ?, ?, ?, ?)",
                (order_id, stock_id, 'Returned', weight_kg, price_at_transaction)
            )

        db.commit()
        export_all_tables_to_excel()
        return {"success": True}
    except (ValueError, db.Error) as e:
        db.rollback()
        return {"success": False, "error": str(e)}


def get_order_financials(order_id):
    db = get_db()
    query = """
    SELECT o.OrderID, c.Name AS ContractorName, o.DateIssued, o.DateDue, o.DateCompleted, o.PenaltyPerDay,
        (SELECT IFNULL(SUM(Amount), 0) FROM Payments WHERE OrderID = o.OrderID) AS AmountPaid,
        (SELECT IFNULL(SUM(WeightKg * PricePerKgAtTimeOfTransaction), 0) FROM OrderStockTransactions WHERE OrderID = o.OrderID AND TransactionType = 'Issued') AS InitialWageBase,
        (SELECT IFNULL(SUM(WeightKg * PricePerKgAtTimeOfTransaction), 0) FROM OrderStockTransactions WHERE OrderID = o.OrderID AND TransactionType = 'Returned') AS ReturnedStockValue
    FROM Orders o JOIN Contractors c ON o.ContractorID = c.ContractorID WHERE o.OrderID = ?;
    """
    result = db.execute(query, (order_id,)).fetchone()
    if not result: return None
        
    financials = dict(result)
    
    total_fine = 0
    if financials['DateCompleted'] and financials['DateDue']:
        if financials['DateCompleted'] > financials['DateDue']:
            days_diff = db.execute("SELECT julianday(?) - julianday(?)", (financials['DateCompleted'], financials['DateDue'])).fetchone()[0]
            total_fine = days_diff * financials['PenaltyPerDay']

    wage_base = financials['InitialWageBase']
    returned_value = financials['ReturnedStockValue']
    amount_paid = financials['AmountPaid']
    
    final_wage_payable = wage_base - returned_value - total_fine
    amount_pending = final_wage_payable - amount_paid
    
    financials['TotalFine'] = round(total_fine, 2)
    financials['FinalWagePayable'] = round(final_wage_payable, 2)
    financials['AmountPending'] = round(amount_pending, 2)
    
    return financials
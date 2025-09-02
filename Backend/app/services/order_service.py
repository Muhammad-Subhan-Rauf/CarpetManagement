# Original relative path: app/services/order_service.py

# /app/services/order_service.py
from app.database.db import get_db
from app.services.excel_service import export_all_tables_to_excel
import datetime

def get_all_orders(status=None, design_number=None, shade_card=None, quality=None):
    """
    Fetches all orders, with optional filtering by status, design number, shade card, and quality.
    """
    db = get_db()
    
    base_query = """
        SELECT o.*, c.Name as ContractorName
        FROM Orders o
        JOIN Contractors c ON o.ContractorID = c.ContractorID
    """
    
    conditions = []
    params = []

    if status:
        conditions.append("o.Status = ?")
        params.append(status.capitalize())
    
    if design_number:
        conditions.append("o.DesignNumber LIKE ?")
        params.append(f"%{design_number}%")
        
    if shade_card:
        conditions.append("o.ShadeCard LIKE ?")
        params.append(f"%{shade_card}%")

    if quality:
        conditions.append("o.Quality LIKE ?")
        params.append(f"%{quality}%")

    if conditions:
        base_query += " WHERE " + " AND ".join(conditions)
        
    base_query += " ORDER BY o.DateIssued DESC"
    
    orders = db.execute(base_query, tuple(params)).fetchall()
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

        # Handle returned stock
        for item in data.get('returnedStock', []):
            stock_id = item['StockID']
            weight_returned = float(item.get('WeightKg', 0.0))
            
            if weight_returned > 0:
                issued_trans = db.execute(
                    "SELECT PricePerKgAtTimeOfTransaction FROM StockTransactions WHERE OrderID = ? AND StockID = ? AND TransactionType = 'Issued' LIMIT 1",
                    (order_id, stock_id)
                ).fetchone()
                price_at_transaction = issued_trans['PricePerKgAtTimeOfTransaction'] if issued_trans else 0

                db.execute("UPDATE StockItems SET QuantityInStockKg = QuantityInStockKg + ? WHERE StockID = ?", (weight_returned, stock_id))
                db.execute(
                    "INSERT INTO StockTransactions (OrderID, StockID, TransactionType, WeightKg, PricePerKgAtTimeOfTransaction, Notes) VALUES (?, ?, ?, ?, ?, ?)",
                    (order_id, stock_id, 'Returned', weight_returned, price_at_transaction, "Returned on completion")
                )

        # Handle deductions
        for deduction in data.get('deductions', []):
            amount = float(deduction.get('amount', 0.0))
            reason = deduction.get('reason', 'No reason provided')
            if amount > 0:
                db.execute(
                    "INSERT INTO Deductions (OrderID, Amount, Reason) VALUES (?, ?, ?)",
                    (order_id, amount, reason)
                )

        # Add a new payment if provided
        new_payment = float(data.get('newPaymentAmount', 0.0))
        if new_payment > 0:
            contractor_id = db.execute("SELECT ContractorID FROM Orders WHERE OrderID = ?", (order_id,)).fetchone()['ContractorID']
            from .payment_service import add_payment
            add_payment({'order_id': order_id, 'contractor_id': contractor_id, 'amount': new_payment, 'notes': 'Payment on order completion'})

        db.commit()
        export_all_tables_to_excel()
        return {"success": True}
    except (ValueError, db.Error) as e:
        db.rollback()
        return {"success": False, "error": str(e)}

def return_stock_for_order(order_id, stock_id, weight_returned):
    """Handles stock returns after an order is closed, creating a refund payment."""
    db = get_db()
    try:
        db.execute("BEGIN")
        
        weight_returned = float(weight_returned)
        if weight_returned <= 0:
            raise ValueError("Return weight must be positive.")

        # Find original transaction to get the price
        orig_trans = db.execute("""
            SELECT PricePerKgAtTimeOfTransaction FROM StockTransactions 
            WHERE OrderID = ? AND StockID = ? AND TransactionType = 'Issued' 
            LIMIT 1
        """, (order_id, stock_id)).fetchone()

        if not orig_trans:
            raise ValueError("This stock was not originally issued for this order.")
        
        price_at_transaction = orig_trans['PricePerKgAtTimeOfTransaction']
        refund_amount = weight_returned * price_at_transaction
        
        # 1. Add stock back to inventory
        db.execute("UPDATE StockItems SET QuantityInStockKg = QuantityInStockKg + ? WHERE StockID = ?", (weight_returned, stock_id))

        # 2. Log the return transaction
        db.execute(
            """INSERT INTO StockTransactions (OrderID, StockID, TransactionType, WeightKg, PricePerKgAtTimeOfTransaction, Notes) 
               VALUES (?, ?, 'Returned', ?, ?, ?)""",
            (order_id, stock_id, weight_returned, price_at_transaction, 'Post-closure return')
        )
        
        # 3. Create a "negative payment" (refund) to balance the books
        contractor_id = db.execute("SELECT ContractorID FROM Orders WHERE OrderID = ?", (order_id,)).fetchone()['ContractorID']
        from .payment_service import add_payment
        add_payment({
            'order_id': order_id,
            'contractor_id': contractor_id,
            'amount': -refund_amount,
            'notes': f'Refund for post-closure return of {weight_returned}kg stock'
        })
        
        db.commit()
        export_all_tables_to_excel()
        return {"success": True}
    except (ValueError, db.Error) as e:
        db.rollback()
        return {"success": False, "error": str(e)}

def get_order_financials(order_id):
    db = get_db()
    order = db.execute("SELECT * FROM Orders WHERE OrderID = ?", (order_id,)).fetchone()
    if not order: return None
    
    query = """
    SELECT
        (SELECT IFNULL(SUM(Amount), 0) FROM Payments WHERE OrderID = o.OrderID) AS AmountPaid,
        (SELECT IFNULL(SUM(WeightKg * PricePerKgAtTimeOfTransaction), 0) FROM StockTransactions WHERE OrderID = o.OrderID AND TransactionType = 'Issued') AS IssuedValue,
        (SELECT IFNULL(SUM(WeightKg * PricePerKgAtTimeOfTransaction), 0) FROM StockTransactions WHERE OrderID = o.OrderID AND TransactionType = 'Returned') AS ReturnedValue,
        (SELECT IFNULL(SUM(Amount), 0) FROM Deductions WHERE OrderID = o.OrderID) AS TotalDeductions
    FROM Orders o WHERE o.OrderID = ?;
    """
    result = db.execute(query, (order_id,)).fetchone()
    
    financials = dict(result)
    
    total_fine = 0
    end_date = order['DateCompleted'] if order['DateCompleted'] else str(datetime.date.today())
    if order['DateDue'] and order['PenaltyPerDay'] > 0:
        if end_date > order['DateDue']:
            days_diff = (datetime.datetime.strptime(end_date, '%Y-%m-%d').date() - datetime.datetime.strptime(order['DateDue'], '%Y-%m-%d').date()).days
            total_fine = max(0, days_diff) * order['PenaltyPerDay']

    financials['TotalFine'] = round(total_fine, 2)
    initial_wage_base = financials['IssuedValue']
    net_value = financials['IssuedValue'] - financials['ReturnedValue'] - financials['TotalDeductions']
    pending_amount = net_value - financials['AmountPaid'] + financials['TotalFine']
    
    financials['InitialWageBase'] = round(initial_wage_base, 2)
    financials['NetValue'] = round(net_value, 2)
    financials['AmountPending'] = round(pending_amount, 2)
    return financials

def get_transactions_by_order_id(order_id):
    db = get_db()
    transactions = db.execute("""
        SELECT st.*, si.Type, si.Quality, si.ColorShadeNumber, si.StockID
        FROM StockTransactions st JOIN StockItems si ON st.StockID = si.StockID
        WHERE st.OrderID = ? ORDER BY st.TransactionID
    """, (order_id,)).fetchall()
    return [dict(row) for row in transactions]

def get_payments_by_order_id(order_id):
    db = get_db()
    payments = db.execute("SELECT * FROM Payments WHERE OrderID = ? ORDER BY PaymentDate DESC", (order_id,)).fetchall()
    return [dict(row) for row in payments]
# /app/services/order_service.py
from app.database.db import get_db
from app.services.excel_service import export_all_tables_to_excel
import datetime

def _parse_dimension(dim_val):
    """MODIFIED: Converts a value like 7.05 (7ft 5in) or 7.5 (also 7ft 5in) to decimal feet."""
    if not dim_val:
        return 0.0
    try:
        dim_str = str(dim_val)
        if '.' in dim_str:
            parts = dim_str.split('.')
            feet = int(parts[0]) if parts[0] else 0
            inches = int(parts[1]) if parts[1] else 0
        else:
            feet = int(dim_str)
            inches = 0
        return feet + (inches / 12.0)
    except (ValueError, TypeError):
        return 0.0

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
        # Calculate wage if dimensions are provided
        wage = 0
        length_input = data.get('Length', 0)
        width_input = data.get('Width', 0)
        
        length = _parse_dimension(length_input)
        width = _parse_dimension(width_input)

        price_per_sq_ft = float(data.get('PricePerSqFt', 0))
        if length > 0 and width > 0 and price_per_sq_ft > 0:
            wage = length * width * price_per_sq_ft

        db.execute("BEGIN")
        cursor = db.execute(
            """INSERT INTO Orders (ContractorID, DesignNumber, ShadeCard, Quality, Size, DateIssued, DateDue, PenaltyPerDay, Notes, Length, Width, PricePerSqFt, Wage)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (data['ContractorID'], data['DesignNumber'], data.get('ShadeCard'), data.get('Quality'),
             data.get('Size'), data['DateIssued'], data.get('DateDue'), data.get('PenaltyPerDay', 0), data.get('Notes'),
             length, width, price_per_sq_ft, wage)
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
        
        # Prepare for dynamic update
        update_fields = ["DateCompleted = ?", "Status = 'Closed'", "Wage = ?"]
        params = [data['dateCompleted'], float(data.get('finalWage', 0.0))]

        # Check for final dimensions and add them to the query
        final_length_input = data.get('finalLength')
        final_width_input = data.get('finalWidth')

        if final_length_input and final_width_input:
            final_length = _parse_dimension(final_length_input)
            final_width = _parse_dimension(final_width_input)
            update_fields.extend(["Length = ?", "Width = ?"])
            params.extend([final_length, final_width])

        # NEW: Check for an updated price per sq ft
        if 'pricePerSqFt' in data and data['pricePerSqFt'] is not None:
            update_fields.append("PricePerSqFt = ?")
            params.append(float(data['pricePerSqFt']))

        params.append(order_id)
        
        # Execute the dynamic update query
        db.execute(
            f"UPDATE Orders SET {', '.join(update_fields)} WHERE OrderID = ?",
            tuple(params)
        )

        # Handle reconciled stock (returned vs kept)
        for item in data.get('reconciliation', []):
            stock_id = item['StockID']
            weight_returned = float(item.get('weight_returned', 0.0))
            weight_kept = float(item.get('weight_kept', 0.0))
            
            issued_trans = db.execute(
                "SELECT PricePerKgAtTimeOfTransaction FROM StockTransactions WHERE OrderID = ? AND StockID = ? AND TransactionType = 'Issued' LIMIT 1",
                (order_id, stock_id)
            ).fetchone()
            price_at_transaction = issued_trans['PricePerKgAtTimeOfTransaction'] if issued_trans else 0

            # Stock physically returned to inventory
            if weight_returned > 0:
                db.execute("UPDATE StockItems SET QuantityInStockKg = QuantityInStockKg + ? WHERE StockID = ?", (weight_returned, stock_id))
                db.execute(
                    "INSERT INTO StockTransactions (OrderID, StockID, TransactionType, WeightKg, PricePerKgAtTimeOfTransaction, Notes) VALUES (?, ?, ?, ?, ?, ?)",
                    (order_id, stock_id, 'Returned', weight_returned, price_at_transaction, "Returned to inventory")
                )

            # Stock kept by contractor (financial transaction, no inventory change)
            if weight_kept > 0:
                db.execute(
                    "INSERT INTO StockTransactions (OrderID, StockID, TransactionType, WeightKg, PricePerKgAtTimeOfTransaction, Notes) VALUES (?, ?, ?, ?, ?, ?)",
                    (order_id, stock_id, 'Returned', weight_kept, price_at_transaction, "Kept by contractor")
                )

        # Handle deductions
        for deduction in data.get('deductions', []):
            amount = float(deduction.get('amount', 0.0))
            if amount > 0:
                db.execute(
                    "INSERT INTO Deductions (OrderID, Amount, Reason) VALUES (?, ?, ?)",
                    (order_id, amount, deduction.get('reason', ''))
                )
        
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

        orig_trans = db.execute("""
            SELECT PricePerKgAtTimeOfTransaction FROM StockTransactions 
            WHERE OrderID = ? AND StockID = ? AND TransactionType = 'Issued' 
            ORDER BY TransactionID DESC LIMIT 1
        """, (order_id, stock_id)).fetchone()

        if not orig_trans: raise ValueError("This stock was not originally issued for this order.")
        
        price_at_transaction = orig_trans['PricePerKgAtTimeOfTransaction']
        refund_amount = weight_returned * price_at_transaction
        
        db.execute("UPDATE StockItems SET QuantityInStockKg = QuantityInStockKg + ? WHERE StockID = ?", (weight_returned, stock_id))
        db.execute(
            """INSERT INTO StockTransactions (OrderID, StockID, TransactionType, WeightKg, PricePerKgAtTimeOfTransaction, Notes) 
               VALUES (?, ?, 'Returned', ?, ?, ?)""",
            (order_id, stock_id, weight_returned, price_at_transaction, 'Post-closure return')
        )
        
        contractor_id = db.execute("SELECT ContractorID FROM Orders WHERE OrderID = ?", (order_id,)).fetchone()['ContractorID']
        from .payment_service import add_payment
        add_payment({
            'order_id': order_id, 'contractor_id': contractor_id, 'amount': -refund_amount,
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
    order_wage = order['Wage'] or 0.0
    
    total_fine = 0
    if order['Status'] == 'Open' and order['DateDue'] and order['PenaltyPerDay'] > 0:
        date_due = datetime.datetime.strptime(order['DateDue'], '%Y-%m-%d').date()
        if datetime.date.today() > date_due:
            days_diff = (datetime.date.today() - date_due).days
            total_fine = days_diff * order['PenaltyPerDay']

    net_stock_value = financials['IssuedValue'] - financials['ReturnedValue']
    
    # New Logic: Pending = Wage - NetStockValue - Deductions - Paid + Fine
    pending_amount = (order_wage - net_stock_value - financials['TotalDeductions'] - financials['AmountPaid']) + total_fine
    
    financials['OrderWage'] = round(order_wage, 2)
    financials['NetStockValue'] = round(net_stock_value, 2)
    financials['TotalFine'] = round(total_fine, 2)
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

def reassign_order(order_id, new_contractor_id, reason):
    """Reassigns an open order to a new contractor and transfers outstanding stock."""
    db = get_db()
    try:
        db.execute("BEGIN")
        order = db.execute("SELECT * FROM Orders WHERE OrderID = ?", (order_id,)).fetchone()
        if not order: raise ValueError("Order not found.")
        if order['Status'] != 'Open': raise ValueError("Only open orders can be reassigned.")

        old_contractor_id = order['ContractorID']
        if int(old_contractor_id) == int(new_contractor_id):
            raise ValueError("New contractor cannot be the same as the old contractor.")

        # Log the reassignment
        db.execute(
            "INSERT INTO OrderReassignmentLog (OrderID, OldContractorID, NewContractorID, Reason) VALUES (?, ?, ?, ?)",
            (order_id, old_contractor_id, new_contractor_id, reason)
        )
        
        # Update the order itself
        db.execute("UPDATE Orders SET ContractorID = ? WHERE OrderID = ?", (new_contractor_id, order_id))
        
        # Find net outstanding stock for this order
        outstanding_stock_query = """
            SELECT StockID, SUM(CASE WHEN TransactionType = 'Issued' THEN WeightKg ELSE -WeightKg END) as NetWeight
            FROM StockTransactions WHERE OrderID = ? GROUP BY StockID HAVING NetWeight > 0.001
        """
        outstanding_stock = db.execute(outstanding_stock_query, (order_id,)).fetchall()
        
        # Transfer stock
        for stock in outstanding_stock:
            stock_id = stock['StockID']
            weight = stock['NetWeight']
            
            price_query = "SELECT PricePerKgAtTimeOfTransaction FROM StockTransactions WHERE OrderID = ? AND StockID = ? AND TransactionType = 'Issued' ORDER BY TransactionID DESC LIMIT 1"
            price_res = db.execute(price_query, (order_id, stock_id)).fetchone()
            price = price_res['PricePerKgAtTimeOfTransaction'] if price_res else 0

            # Log a return for the old contractor
            db.execute(
                "INSERT INTO StockTransactions (OrderID, StockID, TransactionType, WeightKg, PricePerKgAtTimeOfTransaction, Notes) VALUES (?, ?, ?, ?, ?, ?)",
                (order_id, stock_id, 'Returned', weight, price, f"Reassigned to contractor {new_contractor_id}")
            )
            # Log an issue for the new contractor
            db.execute(
                "INSERT INTO StockTransactions (OrderID, StockID, TransactionType, WeightKg, PricePerKgAtTimeOfTransaction, Notes) VALUES (?, ?, ?, ?, ?, ?)",
                (order_id, stock_id, 'Issued', weight, price, f"Reassigned from contractor {old_contractor_id}")
            )
        
        db.commit()
        return {"success": True}
    except (ValueError, db.Error) as e:
        db.rollback()
        return {"success": False, "error": str(e)}

def issue_stock_to_order(order_id, stock_id, weight_kg):
    """
    Adds a new 'Issued' transaction to an existing, open order.
    """
    db = get_db()
    try:
        db.execute("BEGIN")
        weight_kg = float(weight_kg)
        if weight_kg <= 0:
            raise ValueError("Weight must be a positive number.")

        # 1. Verify the order is open
        order = db.execute("SELECT Status FROM Orders WHERE OrderID = ?", (order_id,)).fetchone()
        if not order or order['Status'] != 'Open':
            raise ValueError("Stock can only be issued to an open order.")

        # 2. Check stock availability
        stock_item = db.execute("SELECT * FROM StockItems WHERE StockID = ?", (stock_id,)).fetchone()
        if not stock_item:
            raise ValueError(f"Stock item ID {stock_id} not found.")
        if stock_item['QuantityInStockKg'] < weight_kg:
            raise ValueError(f"Not enough stock for {stock_item['Type']} ({stock_item['Quality']}). Available: {stock_item['QuantityInStockKg']}kg")

        # 3. Update inventory
        db.execute("UPDATE StockItems SET QuantityInStockKg = QuantityInStockKg - ? WHERE StockID = ?", (weight_kg, stock_id))

        # 4. Create the new transaction
        db.execute(
            "INSERT INTO StockTransactions (OrderID, StockID, TransactionType, WeightKg, PricePerKgAtTimeOfTransaction, Notes) VALUES (?, ?, 'Issued', ?, ?, ?)",
            (order_id, stock_id, weight_kg, stock_item['CurrentPricePerKg'], 'Additional stock issued')
        )
        db.commit()
        return {"success": True}
    except (ValueError, db.Error) as e:
        db.rollback()
        return {"success": False, "error": str(e)}
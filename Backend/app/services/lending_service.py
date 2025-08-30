# Original relative path: app/services/lending_service.py

# /app/services/lending_service.py
from app.database.db import get_db
from app.services.excel_service import export_all_tables_to_excel
import datetime

# ... (other functions are unchanged) ...

def get_all_lent_records():
    db = get_db()
    records = db.execute("""
        SELECT lr.*, c.Name as ContractorName 
        FROM LentRecords lr JOIN Contractors c ON lr.ContractorID = c.ContractorID
        ORDER BY lr.DateIssued DESC
    """).fetchall()
    return [dict(row) for row in records]

def get_lent_record_by_id(record_id):
    db = get_db()
    record = db.execute("""
        SELECT lr.*, c.Name as ContractorName 
        FROM LentRecords lr JOIN Contractors c ON lr.ContractorID = c.ContractorID
        WHERE lr.LentRecordID = ?
    """, (record_id,)).fetchone()
    return dict(record) if record else None

def get_transactions_by_record_id(record_id):
    db = get_db()
    transactions = db.execute("""
        SELECT st.*, si.Type, si.Quality, si.ColorShadeNumber
        FROM StockTransactions st JOIN StockItems si ON st.StockID = si.StockID
        WHERE st.LentRecordID = ?
        ORDER BY st.TransactionID
    """, (record_id,)).fetchall()
    return [dict(row) for row in transactions]

def get_payments_by_record_id(record_id):
    db = get_db()
    payments = db.execute("SELECT * FROM Payments WHERE LentRecordID = ? ORDER BY PaymentDate DESC", (record_id,)).fetchall()
    return [dict(row) for row in payments]

def create_lending_record(data):
    db = get_db()
    try:
        db.execute("BEGIN")
        cursor = db.execute(
            "INSERT INTO LentRecords (ContractorID, DateIssued, Notes, DateDue, PenaltyPerDay) VALUES (?, ?, ?, ?, ?)",
            (data['ContractorID'], data['DateIssued'], data.get('Notes'), data.get('DateDue'), data.get('PenaltyPerDay', 0))
        )
        record_id = cursor.lastrowid

        for trans in data.get('transactions', []):
            stock_id = trans['StockID']
            weight_kg = float(trans['WeightKg'])
            
            stock_item = db.execute("SELECT * FROM StockItems WHERE StockID = ?", (stock_id,)).fetchone()
            if not stock_item: raise ValueError(f"Stock item ID {stock_id} not found")

            new_quantity = stock_item['QuantityInStockKg'] - weight_kg
            if new_quantity < 0: raise ValueError(f"Not enough stock for item ID {stock_id}")
            
            db.execute("UPDATE StockItems SET QuantityInStockKg = ? WHERE StockID = ?", (new_quantity, stock_id))
            db.execute(
                "INSERT INTO StockTransactions (LentRecordID, StockID, TransactionType, WeightKg, PricePerKgAtTimeOfTransaction) VALUES (?, ?, ?, ?, ?)",
                (record_id, stock_id, 'Issued', weight_kg, stock_item['CurrentPricePerKg'])
            )
        
        db.commit()
        export_all_tables_to_excel()
        return {"success": True, "LentRecordID": record_id}
    except (ValueError, db.Error) as e:
        db.rollback()
        return {"success": False, "error": str(e)}

def add_payment(contractor_id, amount, notes, record_id=None):
    db = get_db()
    if not isinstance(amount, (int, float)) or amount <= 0:
        return {"success": False, "error": "Invalid payment amount."}
    
    payment_date = datetime.date.today().isoformat()
    db.execute(
        "INSERT INTO Payments (ContractorID, LentRecordID, PaymentDate, Amount, Notes) VALUES (?, ?, ?, ?, ?)",
        (contractor_id, record_id, payment_date, amount, notes)
    )
    db.commit()
    export_all_tables_to_excel()
    return {"success": True}

def return_stock_for_record(record_id, returned_stock):
    db = get_db()
    try:
        db.execute("BEGIN")
        for trans in returned_stock:
            stock_id = trans['StockID']
            weight_kg = float(trans['WeightKg'])

            db.execute("UPDATE StockItems SET QuantityInStockKg = QuantityInStockKg + ? WHERE StockID = ?", (weight_kg, stock_id))
            
            issued_trans = db.execute(
                "SELECT PricePerKgAtTimeOfTransaction FROM StockTransactions WHERE LentRecordID = ? AND StockID = ? AND TransactionType = 'Issued' LIMIT 1",
                (record_id, stock_id)
            ).fetchone()
            price_at_transaction = issued_trans['PricePerKgAtTimeOfTransaction'] if issued_trans else 0

            db.execute(
                "INSERT INTO StockTransactions (LentRecordID, StockID, TransactionType, WeightKg, PricePerKgAtTimeOfTransaction, Notes) VALUES (?, ?, ?, ?, ?, ?)",
                (record_id, stock_id, 'Returned', weight_kg, price_at_transaction, "Standard Return")
            )
        
        db.commit()
        export_all_tables_to_excel()
        return {"success": True}
    except (ValueError, db.Error) as e:
        db.rollback()
        return {"success": False, "error": str(e)}

def close_lending_record(record_id, data):
    db = get_db()
    try:
        db.execute("BEGIN")

        # 1. Update the record status to 'Closed'
        db.execute("UPDATE LentRecords SET Status = 'Closed' WHERE LentRecordID = ?", (record_id,))

        # 2. Process stock reconciliation
        for item in data.get('reconciliation', []):
            stock_id = item['StockID']
            weight_returned = float(item.get('weight_returned', 0.0))
            weight_kept = float(item.get('weight_kept', 0.0))
            
            # Get original transaction price
            issued_trans = db.execute(
                "SELECT PricePerKgAtTimeOfTransaction FROM StockTransactions WHERE LentRecordID = ? AND StockID = ? AND TransactionType = 'Issued' LIMIT 1",
                (record_id, stock_id)
            ).fetchone()
            price_at_transaction = issued_trans['PricePerKgAtTimeOfTransaction'] if issued_trans else 0

            # Process physical returns
            if weight_returned > 0:
                db.execute("UPDATE StockItems SET QuantityInStockKg = QuantityInStockKg + ? WHERE StockID = ?", (weight_returned, stock_id))
                db.execute(
                    "INSERT INTO StockTransactions (LentRecordID, StockID, TransactionType, WeightKg, PricePerKgAtTimeOfTransaction, Notes) VALUES (?, ?, ?, ?, ?, ?)",
                    (record_id, stock_id, 'Returned', weight_returned, price_at_transaction, "Returned to inventory")
                )
            
            # Process stock kept by contractor (financial credit, no inventory change)
            if weight_kept > 0:
                db.execute(
                    "INSERT INTO StockTransactions (LentRecordID, StockID, TransactionType, WeightKg, PricePerKgAtTimeOfTransaction, Notes) VALUES (?, ?, ?, ?, ?, ?)",
                    (record_id, stock_id, 'Returned', weight_kept, price_at_transaction, "Kept by contractor")
                )
        
        # 3. Add a final payment if provided
        final_payment = float(data.get('final_payment', 0.0))
        if final_payment > 0:
            contractor_id = db.execute("SELECT ContractorID FROM LentRecords WHERE LentRecordID = ?", (record_id,)).fetchone()['ContractorID']
            add_payment(contractor_id, final_payment, "Final payment on record closure", record_id)

        db.commit()
        export_all_tables_to_excel()
        return {"success": True}
    except (ValueError, db.Error) as e:
        db.rollback()
        return {"success": False, "error": str(e)}


def get_record_financials(record_id):
    db = get_db()
    record = db.execute("SELECT * FROM LentRecords WHERE LentRecordID = ?", (record_id,)).fetchone()
    if not record: return None
    
    query = """
    SELECT
        (SELECT IFNULL(SUM(Amount), 0) FROM Payments WHERE LentRecordID = lr.LentRecordID) AS AmountPaid,
        (SELECT IFNULL(SUM(WeightKg * PricePerKgAtTimeOfTransaction), 0) FROM StockTransactions WHERE LentRecordID = lr.LentRecordID AND TransactionType = 'Issued') AS IssuedValue,
        (SELECT IFNULL(SUM(WeightKg * PricePerKgAtTimeOfTransaction), 0) FROM StockTransactions WHERE LentRecordID = lr.LentRecordID AND TransactionType = 'Returned') AS ReturnedValue
    FROM LentRecords lr WHERE lr.LentRecordID = ?;
    """
    result = db.execute(query, (record_id,)).fetchone()
    
    financials = dict(result)
    
    # Calculate overdue fine - only if record is still open
    total_fine = 0
    if record['Status'] == 'Open' and record['DateDue'] and record['PenaltyPerDay'] > 0:
        date_due = datetime.datetime.strptime(record['DateDue'], '%Y-%m-%d').date()
        today = datetime.date.today()
        if today > date_due:
            days_overdue = (today - date_due).days
            total_fine = days_overdue * record['PenaltyPerDay']

    financials['TotalFine'] = round(total_fine, 2)
    net_value = financials['IssuedValue'] - financials['ReturnedValue']
    # --- CORRECTED LOGIC --- Fine is added to what is owed
    pending_amount = net_value - financials['AmountPaid'] + financials['TotalFine']
    
    financials['NetValue'] = round(net_value, 2)
    financials['AmountPending'] = round(pending_amount, 2)
    return financials

def update_lent_record(record_id, data):
    db = get_db()
    fields = []
    params = []

    # Only allow specific fields to be updated
    if 'DateDue' in data:
        fields.append("DateDue = ?")
        params.append(data['DateDue'])
    
    if 'Notes' in data:
        fields.append("Notes = ?")
        params.append(data['Notes'])

    if not fields:
        return {"success": False, "error": "No valid fields to update provided."}
    
    params.append(record_id)
    query = f"UPDATE LentRecords SET {', '.join(fields)} WHERE LentRecordID = ?"
    
    try:
        cursor = db.execute(query, tuple(params))
        if cursor.rowcount == 0:
            return {"success": False, "error": "Record not found."}
        db.commit()
        export_all_tables_to_excel()
        return {"success": True}
    except db.Error as e:
        db.rollback()
        return {"success": False, "error": str(e)}
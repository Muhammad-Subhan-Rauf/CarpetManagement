# Original relative path: app/services/payment_service.py

# /app/services/payment_service.py

from app.database.db import get_db
from app.services.excel_service import export_all_tables_to_excel
from datetime import datetime, timezone

def add_payment(data):
    """
    Adds a payment record. Can be a general payment (OrderID is None)
    or a payment for a specific order (OrderID is provided).
    Amount can be negative for refunds.
    """
    db = get_db()
    
    contractor_id = data['contractor_id']
    amount = float(data['amount'])
    notes = data.get('notes', '')
    order_id = data.get('order_id') # This will be None for general payments

    if not isinstance(amount, (int, float)):
        return {"success": False, "error": "Invalid payment amount."}
    
    
    payment_date = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
    
    try:
        db.execute(
            "INSERT INTO Payments (ContractorID, OrderID, PaymentDate, Amount, Notes) VALUES (?, ?, ?, ?, ?)",
            (contractor_id, order_id, payment_date, amount, notes)
        )
        db.commit()
        export_all_tables_to_excel()
        return {"success": True}
    except db.Error as e:
        db.rollback()
        return {"success": False, "error": str(e)}

# ADDED: Function to update an existing payment
def update_payment(payment_id, data):
    """Updates an existing payment record's amount, date, and notes."""
    db = get_db()
    
    amount = float(data['amount'])
    payment_date = data['payment_date'] # Expecting 'YYYY-MM-DD' or 'YYYY-MM-DD HH:MM:SS'
    notes = data.get('notes', '')

    if not isinstance(amount, (int, float)):
        return {"success": False, "error": "Invalid payment amount."}

    try:
        cursor = db.execute(
            "UPDATE Payments SET Amount = ?, PaymentDate = ?, Notes = ? WHERE PaymentID = ?",
            (amount, payment_date, notes, payment_id)
        )
        if cursor.rowcount == 0:
            return {"success": False, "error": "Payment not found."}
        db.commit()
        export_all_tables_to_excel()
        return {"success": True}
    except db.Error as e:
        db.rollback()
        return {"success": False, "error": str(e)}

# ADDED: Function to delete a payment
def delete_payment(payment_id):
    """Deletes a payment record from the database."""
    db = get_db()
    try:
        cursor = db.execute("DELETE FROM Payments WHERE PaymentID = ?", (payment_id,))
        if cursor.rowcount == 0:
            return {"success": False, "error": "Payment not found."}
        db.commit()
        export_all_tables_to_excel()
        return {"success": True}
    except db.Error as e:
        db.rollback()
        return {"success": False, "error": str(e)}
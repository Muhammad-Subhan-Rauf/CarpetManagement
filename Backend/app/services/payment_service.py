# Original relative path: app/services/payment_service.py

# /app/services/payment_service.py

from app.database.db import get_db
from app.services.excel_service import export_all_tables_to_excel
import datetime

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
    
    payment_date = datetime.date.today().isoformat()
    
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
# Original relative path: app/api/payments.py

from flask import Blueprint, jsonify, request
from app.services.payment_service import add_payment

payments_bp = Blueprint('payments_api', __name__)

@payments_bp.route('/payments', methods=['POST'])
def handle_add_payment():
    data = request.get_json()
    # A general payment only requires the contractor_id and amount.
    if 'amount' not in data or 'contractor_id' not in data:
        return jsonify({"error": "Missing 'amount' or 'contractor_id' field"}), 400
    
    result = add_payment(data)

    if result.get('success'):
        return jsonify({"message": "Payment added successfully"}), 200
    else:
        return jsonify({"error": result.get('error', 'Unknown error')}), 400
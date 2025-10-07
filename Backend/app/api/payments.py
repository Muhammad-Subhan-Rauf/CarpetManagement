# Original relative path: app/api/payments.py

# /app/api/payments.py

from flask import Blueprint, jsonify, request
# MODIFIED: Import more services
from app.services.payment_service import add_payment, update_payment, delete_payment

payments_bp = Blueprint('payments_api', __name__)

@payments_bp.route('/payments', methods=['POST'])
def handle_add_payment():
    data = request.get_json()
    # A general payment requires contractor_id and amount.
    # A specific payment will also include an order_id.
    if 'amount' not in data or 'contractor_id' not in data:
        return jsonify({"error": "Missing 'amount' or 'contractor_id' field"}), 400
    
    result = add_payment(data)

    if result.get('success'):
        return jsonify({"message": "Payment added successfully"}), 200
    else:
        return jsonify({"error": result.get('error', 'Unknown error')}), 400

# ADDED: New route to handle editing and deleting a specific payment
@payments_bp.route('/payments/<int:payment_id>', methods=['PUT', 'DELETE'])
def handle_payment_by_id(payment_id):
    if request.method == 'PUT':
        data = request.get_json()
        if not all(k in data for k in ['amount', 'payment_date']):
             return jsonify({"error": "Missing 'amount' or 'payment_date' field"}), 400
        
        result = update_payment(payment_id, data)
        if result.get('success'):
            return jsonify({"message": "Payment updated successfully"}), 200
        else:
            return jsonify({"error": result.get('error', 'Unknown error')}), 400

    if request.method == 'DELETE':
        result = delete_payment(payment_id)
        if result.get('success'):
            return jsonify({"message": "Payment deleted successfully"}), 204
        else:
            return jsonify({"error": result.get('error', 'Unknown error')}), 400
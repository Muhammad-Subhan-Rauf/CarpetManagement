# Original relative path: app/api/orders.py

# /app/api/orders.py
from flask import Blueprint, jsonify, request
from app.services import order_service

orders_bp = Blueprint('orders_api', __name__)

@orders_bp.route('/orders', methods=['GET', 'POST'])
def handle_orders():
    if request.method == 'POST':
        data = request.get_json()
        required = ['ContractorID', 'DateIssued', 'DesignNumber']
        if not all(field in data for field in required):
            return jsonify({"error": "Missing required fields"}), 400
        
        result = order_service.create_order(data)
        if result.get('success'):
            return jsonify({"message": "Order created", "OrderID": result['OrderID']}), 201
        else:
            return jsonify({"error": result.get('error', 'Unknown error')}), 400
    
    status = request.args.get('status') # e.g., 'Open' or 'Closed'
    orders = order_service.get_all_orders(status=status)
    return jsonify(orders)

@orders_bp.route('/orders/<int:order_id>', methods=['GET'])
def handle_get_order(order_id):
    order = order_service.get_order_by_id(order_id)
    if not order:
        return jsonify({"error": "Order not found"}), 404
    return jsonify(order)

@orders_bp.route('/orders/<int:order_id>/transactions', methods=['GET'])
def handle_order_transactions(order_id):
    transactions = order_service.get_transactions_by_order_id(order_id)
    return jsonify(transactions)

@orders_bp.route('/orders/<int:order_id>/payments', methods=['GET'])
def handle_order_payments(order_id):
    payments = order_service.get_payments_by_order_id(order_id)
    return jsonify(payments)

@orders_bp.route('/orders/<int:order_id>/financials', methods=['GET'])
def handle_get_financials(order_id):
    financials = order_service.get_order_financials(order_id)
    if not financials:
        return jsonify({"error": "Order not found"}), 404
    return jsonify(financials)

@orders_bp.route('/orders/<int:order_id>/payment', methods=['POST'])
def handle_add_payment(order_id):
    data = request.get_json()
    if 'amount' not in data or 'contractor_id' not in data:
        return jsonify({"error": "Missing 'amount' or 'contractor_id' field"}), 400
    
    amount = float(data['amount'])
    notes = data.get('notes', '')
    contractor_id = data['contractor_id']
    
    result = order_service.add_payment_to_order(order_id, contractor_id, amount, notes)

    if result.get('success'):
        return jsonify({"message": "Payment added successfully"}), 200
    else:
        return jsonify({"error": result.get('error', 'Unknown error')}), 400

@orders_bp.route('/orders/<int:order_id>/complete', methods=['POST'])
def handle_complete_order(order_id):
    data = request.get_json()
    if 'dateCompleted' not in data:
        return jsonify({"error": "Missing 'dateCompleted' field"}), 400
    
    result = order_service.complete_order(order_id, data)
    if result.get('success'):
        return jsonify({"message": "Order completed successfully"}), 200
    else:
        return jsonify({"error": result.get('error', 'Unknown error')}), 400
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
    
    # MODIFIED: Get search and filter parameters from query string
    status = request.args.get('status')
    design_number = request.args.get('design_number')
    shade_card = request.args.get('shade_card')
    quality = request.args.get('quality')
    
    orders = order_service.get_all_orders(
        status=status,
        design_number=design_number,
        shade_card=shade_card,
        quality=quality
    )
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

# This endpoint is now handled by the dedicated payments blueprint
# @orders_bp.route('/orders/<int:order_id>/payment', ...)

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

# NEW: Endpoint to handle returning stock after an order is closed
@orders_bp.route('/orders/<int:order_id>/return-stock', methods=['POST'])
def handle_return_stock_after_closure(order_id):
    data = request.get_json()
    if not all(k in data for k in ['stock_id', 'weight']):
        return jsonify({"error": "Missing 'stock_id' or 'weight' in request"}), 400
    
    result = order_service.return_stock_for_order(order_id, data['stock_id'], data['weight'])
    if result.get('success'):
        return jsonify({"message": "Stock returned and payment adjusted successfully"}), 200
    else:
        return jsonify({"error": result.get('error', 'Unknown error')}), 400

# NEW: Endpoint to reassign a contractor mid-order
@orders_bp.route('/orders/<int:order_id>/reassign', methods=['POST'])
def handle_reassign_order(order_id):
    data = request.get_json()
    if not all(k in data for k in ['new_contractor_id', 'reason']):
        return jsonify({"error": "Missing 'new_contractor_id' or 'reason'"}), 400
    
    result = order_service.reassign_order(
        order_id,
        data['new_contractor_id'],
        data['reason']
    )
    
    if result.get('success'):
        return jsonify({"message": "Order reassigned successfully"}), 200
    else:
        return jsonify({"error": result.get('error', 'Unknown error')}), 400
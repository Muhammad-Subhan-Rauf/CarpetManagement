# /app/api/stock_transactions.py
from flask import Blueprint, jsonify, request
from app.services import order_service

stock_transactions_bp = Blueprint('stock_transactions_api', __name__)

@stock_transactions_bp.route('/stock-transactions/<int:transaction_id>', methods=['PUT'])
def handle_update_transaction(transaction_id):
    """Updates a stock transaction's weight and date."""
    data = request.get_json()
    if not all(k in data for k in ['weight', 'date']):
        return jsonify({"error": "Missing 'weight' or 'date'"}), 400
    
    result = order_service.update_stock_transaction(transaction_id, data)
    
    if result.get('success'):
        return jsonify({"message": "Transaction updated successfully"}), 200
    else:
        return jsonify({"error": result.get('error', 'Unknown error')}), 400

@stock_transactions_bp.route('/stock-transactions/<int:transaction_id>', methods=['DELETE'])
def handle_delete_transaction(transaction_id):
    """Deletes a stock transaction and adjusts inventory."""
    result = order_service.delete_stock_transaction(transaction_id)
    
    if result.get('success'):
        return jsonify({"message": "Transaction deleted successfully"}), 204 # 204 No Content
    else:
        return jsonify({"error": result.get('error', 'Unknown error')}), 400
# /app/api/stock.py

from flask import Blueprint, jsonify, request
from app.services import stock_service

stock_bp = Blueprint('stock_api', __name__)

@stock_bp.route('/stock_items', methods=['GET', 'POST'])
def handle_stock_items():
    if request.method == 'POST':
        data = request.get_json()
        required = ['Type', 'Quality', 'CurrentPricePerKg', 'QuantityInStockKg']
        if not all(field in data for field in required):
            return jsonify({"error": "Missing required fields"}), 400
        
        result = stock_service.add_stock_item(data)
        if "error" in result:
            return jsonify(result), 409 # 409 Conflict
        return jsonify({"message": "Stock item added", "id": result['id']}), 201
    
    # MODIFIED: Accept a 'quality' filter
    quality_filter = request.args.get('quality')
    items = stock_service.get_all_stock_items(quality=quality_filter)
    return jsonify(items)

@stock_bp.route('/stock_items/<int:stock_id>', methods=['PUT'])
def update_stock_item(stock_id):
    data = request.get_json()
    result = stock_service.update_stock_item(stock_id, data)
    if "error" in result:
        if "No valid fields" in result['error']:
            return jsonify(result), 400
        if "not found" in result['error']:
            return jsonify(result), 404
        return jsonify(result), 500
    
    return jsonify({"message": f"Stock item {stock_id} updated successfully."}), 200
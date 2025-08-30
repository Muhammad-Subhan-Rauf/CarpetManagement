# Original relative path: app/api/lendings.py

# /app/api/lendings.py
from flask import Blueprint, jsonify, request
from app.services import lending_service

lendings_bp = Blueprint('lendings_api', __name__)

# ... (handle_lent_records, handle_record GET/PUT are unchanged)
@lendings_bp.route('/lent-records', methods=['GET', 'POST'])
def handle_lent_records():
    if request.method == 'POST':
        data = request.get_json()
        if not all(field in data for field in ['ContractorID', 'DateIssued']):
            return jsonify({"error": "Missing required fields"}), 400
        
        result = lending_service.create_lending_record(data)
        if result['success']:
            return jsonify({"message": "Lending record created", "LentRecordID": result['LentRecordID']}), 201
        else:
            return jsonify({"error": result['error']}), 400
    
    records = lending_service.get_all_lent_records()
    return jsonify(records)

@lendings_bp.route('/lent-records/<int:record_id>', methods=['GET', 'PUT'])
def handle_record(record_id):
    if request.method == 'PUT':
        data = request.get_json()
        result = lending_service.update_lent_record(record_id, data)
        if result['success']:
            return jsonify({"message": "Record updated successfully"}), 200
        else:
            return jsonify({"error": result['error']}), 400

    record = lending_service.get_lent_record_by_id(record_id)
    if not record:
        return jsonify({"error": "Record not found"}), 404
    return jsonify(record)
# ... (handle_record_transactions, handle_record_payments, etc. are unchanged)
@lendings_bp.route('/lent-records/<int:record_id>/transactions', methods=['GET'])
def handle_record_transactions(record_id):
    transactions = lending_service.get_transactions_by_record_id(record_id)
    return jsonify(transactions)

@lendings_bp.route('/lent-records/<int:record_id>/payments', methods=['GET'])
def handle_record_payments(record_id):
    payments = lending_service.get_payments_by_record_id(record_id)
    return jsonify(payments)

@lendings_bp.route('/lent-records/<int:record_id>/financials', methods=['GET'])
def handle_get_financials(record_id):
    financials = lending_service.get_record_financials(record_id)
    if not financials:
        return jsonify({"error": "Record not found"}), 404
    return jsonify(financials)

@lendings_bp.route('/payments', methods=['POST'])
def handle_add_payment():
    data = request.get_json()
    if 'amount' not in data or 'contractor_id' not in data:
        return jsonify({"error": "Missing 'amount' or 'contractor_id' field"}), 400
    
    amount = float(data['amount'])
    notes = data.get('notes', '')
    record_id = data.get('record_id') # Can be specific to a record or general
    contractor_id = data['contractor_id']

    result = lending_service.add_payment(contractor_id, amount, notes, record_id)

    if result['success']:
        return jsonify({"message": "Payment added successfully"}), 200
    else:
        return jsonify({"error": result['error']}), 400
        
@lendings_bp.route('/lent-records/<int:record_id>/return-stock', methods=['POST'])
def handle_return_stock(record_id):
    data = request.get_json()
    if 'returned_stock' not in data:
        return jsonify({"error": "Missing 'returned_stock' list"}), 400
    
    result = lending_service.return_stock_for_record(record_id, data['returned_stock'])
    if result['success']:
        return jsonify({"message": "Stock return recorded successfully"}), 200
    else:
        return jsonify({"error": result['error']}), 400

# NEW: Endpoint to close/complete a record
@lendings_bp.route('/lent-records/<int:record_id>/close', methods=['POST'])
def handle_close_record(record_id):
    data = request.get_json()
    result = lending_service.close_lending_record(record_id, data)
    if result['success']:
        return jsonify({"message": "Record closed successfully"}), 200
    else:
        return jsonify({"error": result['error']}), 400
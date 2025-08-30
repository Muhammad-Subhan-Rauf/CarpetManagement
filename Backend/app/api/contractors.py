# /app/api/contractors.py

from flask import Blueprint, jsonify, request
from app.services import contractor_service

contractors_bp = Blueprint('contractors_api', __name__)

@contractors_bp.route('/contractors', methods=['GET', 'POST'])
def handle_contractors():
    if request.method == 'POST':
        data = request.get_json()
        if not data or 'Name' not in data:
            return jsonify({"error": "Name is required"}), 400
        
        new_id = contractor_service.add_contractor(data['Name'], data.get('ContactInfo'))
        return jsonify({"message": "Contractor added", "id": new_id}), 201

    contractors = contractor_service.get_all_contractors()
    return jsonify(contractors)

@contractors_bp.route('/contractors/<int:contractor_id>', methods=['GET'])
def get_contractor_details(contractor_id):
    """Endpoint for the individual contractor book."""
    details = contractor_service.get_contractor_details(contractor_id)
    if not details:
        return jsonify({"error": "Contractor not found"}), 404
    return jsonify(details)# Original relative path: app/api/contractors.py

# /app/api/contractors.py

from flask import Blueprint, jsonify, request
from app.services import contractor_service

contractors_bp = Blueprint('contractors_api', __name__)

@contractors_bp.route('/contractors', methods=['GET', 'POST'])
def handle_contractors():
    if request.method == 'POST':
        data = request.get_json()
        if not data or 'Name' not in data:
            return jsonify({"error": "Name is required"}), 400
        
        new_id = contractor_service.add_contractor(data['Name'], data.get('ContactInfo'))
        return jsonify({"message": "Contractor added", "id": new_id}), 21
    contractors = contractor_service.get_all_contractors()
    return jsonify(contractors)

@contractors_bp.route('/contractors/<int:contractor_id>', methods=['GET'])
def get_contractor_details(contractor_id):
    """Endpoint for the individual contractor book."""
    details = contractor_service.get_contractor_details(contractor_id)
    if not details:
        return jsonify({"error": "Contractor not found"}), 404
    return jsonify(details)

@contractors_bp.route('/payments', methods=['POST'])
def handle_add_payment():
    data = request.get_json()
    if 'amount' not in data or 'contractor_id' not in data:
        return jsonify({"error": "Missing 'amount' or 'contractor_id' field"}), 400
    
    result = contractor_service.add_general_payment(
        contractor_id=data['contractor_id'],
        amount=float(data['amount']),
        notes=data.get('notes', '')
    )

    if result.get('success'):
        return jsonify({"message": "Payment added successfully"}), 200
    else:
        return jsonify({"error": result.get('error', 'Unknown error')}), 400
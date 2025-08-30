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
    return jsonify(details)
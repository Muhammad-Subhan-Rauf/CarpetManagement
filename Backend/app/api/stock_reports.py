# Original relative path: app/api/stock_reports.py

# /app/api/stock_reports.py
from flask import Blueprint, jsonify
from app.services import stock_report_service

stock_reports_bp = Blueprint('stock_reports_api', __name__)

@stock_reports_bp.route('/stock-reports/currently-held', methods=['GET'])
def get_currently_held_report():
    """Endpoint to get a report of stock currently held by all contractors."""
    report_data = stock_report_service.get_all_currently_held_stock()
    return jsonify(report_data)

@stock_reports_bp.route('/stock-reports/issue-history', methods=['GET'])
def get_issue_history_report():
    """Endpoint to get a report of all stock ever issued to all contractors."""
    report_data = stock_report_service.get_total_issue_history()
    return jsonify(report_data)
# /app/services/excel_service.py

import pandas as pd
from flask import current_app
from app.database.db import get_db

def export_all_tables_to_excel():
    """Exports all database tables to a single Excel file with multiple sheets."""
    conn = get_db()
    excel_path = current_app.config['EXCEL_PATH']
    try:
        with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
            tables = ['Contractors', 'StockItems', 'LentRecords', 'StockTransactions', 'Payments']
            for table_name in tables:
                df = pd.read_sql_query(f"SELECT * FROM {table_name}", conn)
                df.to_excel(writer, sheet_name=table_name, index=False)
        print(f"Data successfully exported to {excel_path}")
    except Exception as e:
        print(f"Error exporting to Excel: {e}")
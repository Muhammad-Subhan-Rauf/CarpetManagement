# /app/services/stock_service.py

import sqlite3
from app.database.db import get_db
from app.services.excel_service import export_all_tables_to_excel

def get_all_stock_items():
    db = get_db()
    items = db.execute("SELECT * FROM StockItems ORDER BY Type, Quality").fetchall()
    return [dict(row) for row in items]

def add_stock_item(data):
    db = get_db()
    try:
        cursor = db.execute(
            "INSERT INTO StockItems (Type, Quality, ColorShadeNumber, CurrentPricePerKg, QuantityInStockKg) VALUES (?, ?, ?, ?, ?)",
            (data['Type'], data['Quality'], data.get('ColorShadeNumber'), data['CurrentPricePerKg'], data['QuantityInStockKg'])
        )
        db.commit()
        export_all_tables_to_excel()
        return {"id": cursor.lastrowid}
    except sqlite3.IntegrityError:
        return {"error": "A stock item with this Type, Quality, and Color/Shade already exists."}

def update_stock_item(stock_id, data):
    db = get_db()
    fields = []
    params = []

    if 'add_quantity' in data:
        fields.append("QuantityInStockKg = QuantityInStockKg + ?")
        params.append(float(data['add_quantity']))
    
    if 'CurrentPricePerKg' in data:
        fields.append("CurrentPricePerKg = ?")
        params.append(float(data['CurrentPricePerKg']))

    if not fields:
        return {"error": "No valid fields to update."}
    
    params.append(stock_id)
    query = f"UPDATE StockItems SET {', '.join(fields)} WHERE StockID = ?"
    
    try:
        cursor = db.execute(query, tuple(params))
        if cursor.rowcount == 0:
            return {"error": "Stock item not found."}
        db.commit()
        export_all_tables_to_excel()
        return {"success": True, "rows_affected": cursor.rowcount}
    except db.Error as e:
        db.rollback()
        return {"error": str(e)}
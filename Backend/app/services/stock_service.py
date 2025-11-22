import sqlite3
from app.database.db import get_db
from app.services.excel_service import export_all_tables_to_excel

def get_all_stock_items(search_type=None, search_quality=None, search_color=None):
    """
    Fetches stock items with flexible search filters.
    """
    db = get_db()
    query = "SELECT * FROM StockItems"
    params = []
    conditions = []
    
    # --- FIX: Generic Search Logic using LIKE ---
    if search_type:
        conditions.append("Type LIKE ?")
        params.append(f"%{search_type}%")

    if search_quality:
        conditions.append("Quality LIKE ?")
        params.append(f"%{search_quality}%")

    if search_color:
        conditions.append("IFNULL(ColorShadeNumber, '') LIKE ?")
        params.append(f"%{search_color}%")

    if conditions:
        query += " WHERE " + " AND ".join(conditions)
        
    query += " ORDER BY Type, Quality"
    
    items = db.execute(query, tuple(params)).fetchall()
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
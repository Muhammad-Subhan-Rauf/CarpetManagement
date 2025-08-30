# Original relative path: app/services/stock_report_service.py

# /app/services/stock_report_service.py
from app.database.db import get_db
from collections import defaultdict

def get_all_currently_held_stock():
    """
    Generates a report of all stock currently held by contractors from 'Open' records.
    The data is structured as a list of contractors, each with a list of stock they hold.
    """
    db = get_db()
    query = """
        SELECT 
            c.ContractorID,
            c.Name AS ContractorName,
            si.Type, 
            si.Quality, 
            si.ColorShadeNumber,
            SUM(CASE WHEN st.TransactionType = 'Issued' THEN st.WeightKg ELSE -st.WeightKg END) as NetWeightKg
        FROM StockTransactions st
        JOIN LentRecords lr ON st.LentRecordID = lr.LentRecordID
        JOIN StockItems si ON st.StockID = si.StockID
        JOIN Contractors c ON lr.ContractorID = c.ContractorID
        WHERE lr.Status = 'Open'
        GROUP BY c.ContractorID, st.StockID
        HAVING NetWeightKg > 0.001
        ORDER BY c.Name, si.Type, si.Quality
    """
    rows = db.execute(query).fetchall()
    
    # Group stock items by contractor
    contractor_stock = defaultdict(lambda: {'ContractorID': 0, 'ContractorName': '', 'HeldStock': []})
    for row in rows:
        cid = row['ContractorID']
        if not contractor_stock[cid]['ContractorID']:
            contractor_stock[cid]['ContractorID'] = cid
            contractor_stock[cid]['ContractorName'] = row['ContractorName']
        
        contractor_stock[cid]['HeldStock'].append({
            'Type': row['Type'],
            'Quality': row['Quality'],
            'ColorShadeNumber': row['ColorShadeNumber'],
            'NetWeightKg': row['NetWeightKg']
        })
        
    return list(contractor_stock.values())

def get_total_issue_history():
    """
    Generates a report of all stock ever issued to contractors.
    The data is structured as a list of contractors, each with a list of stock totals.
    """
    db = get_db()
    query = """
        SELECT 
            c.ContractorID,
            c.Name as ContractorName,
            si.Type, 
            si.Quality, 
            si.ColorShadeNumber,
            SUM(st.WeightKg) as TotalIssuedKg
        FROM StockTransactions st
        JOIN LentRecords lr ON st.LentRecordID = lr.LentRecordID
        JOIN StockItems si ON st.StockID = si.StockID
        JOIN Contractors c ON lr.ContractorID = c.ContractorID
        WHERE st.TransactionType = 'Issued'
        GROUP BY c.ContractorID, st.StockID
        ORDER BY c.Name, si.Type, si.Quality
    """
    rows = db.execute(query).fetchall()

    # Group stock items by contractor
    contractor_history = defaultdict(lambda: {'ContractorID': 0, 'ContractorName': '', 'IssuedHistory': []})
    for row in rows:
        cid = row['ContractorID']
        if not contractor_history[cid]['ContractorID']:
            contractor_history[cid]['ContractorID'] = cid
            contractor_history[cid]['ContractorName'] = row['ContractorName']
            
        contractor_history[cid]['IssuedHistory'].append({
            'Type': row['Type'],
            'Quality': row['Quality'],
            'ColorShadeNumber': row['ColorShadeNumber'],
            'TotalIssuedKg': row['TotalIssuedKg']
        })
        
    return list(contractor_history.values())
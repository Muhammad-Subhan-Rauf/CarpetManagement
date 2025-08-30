# Original relative path: app/services/contractor_service.py

# /app/services/contractor_service.py

from app.database.db import get_db
from app.services.excel_service import export_all_tables_to_excel

def get_all_contractors():
    # ... (this function is unchanged)
    db = get_db()
    contractors = db.execute("SELECT * FROM Contractors ORDER BY Name").fetchall()
    return [dict(row) for row in contractors]

def add_contractor(name, contact_info):
    # ... (this function is unchanged)
    db = get_db()
    cursor = db.execute("INSERT INTO Contractors (Name, ContactInfo) VALUES (?, ?)", (name, contact_info))
    db.commit()
    export_all_tables_to_excel()
    return cursor.lastrowid

def get_contractor_details(contractor_id):
    """
    Gets all financial and transaction details for a single contractor.
    --- MODIFIED TO ADD NEW LEDGER SUMMARIES ---
    """
    db = get_db()
    
    contractor = db.execute("SELECT * FROM Contractors WHERE ContractorID = ?", (contractor_id,)).fetchone()
    if not contractor:
        return None

    # ... (lent_records_query and processing remains the same)
    lent_records_query = """
        SELECT
            lr.LentRecordID,
            lr.DateIssued,
            lr.Status,
            lr.Notes,
            (SELECT GROUP_CONCAT(DISTINCT si.Quality) 
             FROM StockTransactions st JOIN StockItems si ON st.StockID = si.StockID 
             WHERE st.LentRecordID = lr.LentRecordID AND st.TransactionType = 'Issued') as Qualities,
            
            (SELECT IFNULL(SUM(st.WeightKg * st.PricePerKgAtTimeOfTransaction), 0)
             FROM StockTransactions st
             WHERE st.LentRecordID = lr.LentRecordID AND st.TransactionType = 'Issued') as IssuedValue,
            
            (SELECT IFNULL(SUM(st.WeightKg * st.PricePerKgAtTimeOfTransaction), 0)
             FROM StockTransactions st
             WHERE st.LentRecordID = lr.LentRecordID AND st.TransactionType = 'Returned') as ReturnedValue,

            (SELECT IFNULL(SUM(p.Amount), 0)
             FROM Payments p
             WHERE p.LentRecordID = lr.LentRecordID) as AmountPaid
             
        FROM LentRecords lr
        WHERE lr.ContractorID = ?
    """
    lent_records_raw = db.execute(lent_records_query, (contractor_id,)).fetchall()
    
    processed_records = []
    for record in lent_records_raw:
        r_dict = dict(record)
        net_value = r_dict['IssuedValue'] - r_dict['ReturnedValue']
        amount_owed = net_value - r_dict['AmountPaid']
        r_dict['AmountOwed'] = round(amount_owed, 2)
        if r_dict['Qualities'] is None:
            r_dict['Qualities'] = 'N/A'
        processed_records.append(r_dict)
    
    processed_records.sort(key=lambda r: (r['Qualities'] == 'N/A', r['Qualities']))

    # ... (transactions and payments queries remain the same)
    transactions = db.execute("""
        SELECT st.*, si.Type, si.Quality, si.ColorShadeNumber FROM StockTransactions st
        JOIN LentRecords lr ON st.LentRecordID = lr.LentRecordID
        JOIN StockItems si ON st.StockID = si.StockID
        WHERE lr.ContractorID = ? ORDER BY st.TransactionID
    """, (contractor_id,)).fetchall()

    payments = db.execute(
        "SELECT * FROM Payments WHERE ContractorID = ? ORDER BY PaymentDate DESC",
        (contractor_id,)
    ).fetchall()
    
    # --- NEW: Ledger for stock currently held by contractor (from 'Open' records) ---
    currently_held_stock = db.execute("""
        SELECT 
            si.Type, 
            si.Quality, 
            si.ColorShadeNumber,
            SUM(CASE WHEN st.TransactionType = 'Issued' THEN st.WeightKg ELSE -st.WeightKg END) as NetWeightKg
        FROM StockTransactions st
        JOIN LentRecords lr ON st.LentRecordID = lr.LentRecordID
        JOIN StockItems si ON st.StockID = si.StockID
        WHERE lr.ContractorID = ? AND lr.Status = 'Open'
        GROUP BY st.StockID
        HAVING NetWeightKg > 0.001
    """, (contractor_id,)).fetchall()

    # --- NEW: Ledger for total stock ever issued to contractor ---
    total_issued_history = db.execute("""
        SELECT 
            si.Type, 
            si.Quality, 
            si.ColorShadeNumber,
            SUM(st.WeightKg) as TotalIssuedKg
        FROM StockTransactions st
        JOIN LentRecords lr ON st.LentRecordID = lr.LentRecordID
        JOIN StockItems si ON st.StockID = si.StockID
        WHERE lr.ContractorID = ? AND st.TransactionType = 'Issued'
        GROUP BY st.StockID
    """, (contractor_id,)).fetchall()

    # ... (financial_summary calculation remains the same)
    issued_value = sum(r['IssuedValue'] for r in processed_records)
    returned_value = sum(r['ReturnedValue'] for r in processed_records)
    total_paid = sum(p['Amount'] for p in payments)
    amount_owed_to_contractor = issued_value - returned_value - total_paid

    return {
        "contractor": dict(contractor),
        "lent_records": processed_records,
        "transactions": [dict(t) for t in transactions],
        "payments": [dict(p) for p in payments],
        "currently_held_stock": [dict(row) for row in currently_held_stock], # NEW
        "total_issued_history": [dict(row) for row in total_issued_history], # NEW
        "financial_summary": {
            "total_value_issued": round(issued_value, 2),
            "total_value_returned": round(returned_value, 2),
            "net_work_value": round(issued_value - returned_value, 2),
            "total_paid": round(total_paid, 2),
            "final_balance_owed": round(amount_owed_to_contractor, 2)
        }
    }
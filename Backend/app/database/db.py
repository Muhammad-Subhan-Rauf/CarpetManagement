# Original relative path: app/database/db.py

# /app/database/db.py

import sqlite3
import click
from flask import current_app, g
from flask.cli import with_appcontext

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(
            current_app.config['DB_PATH'],
            detect_types=sqlite3.PARSE_DECLTYPES
        )
        g.db.row_factory = sqlite3.Row
    return g.db

def close_db(e=None):
    db = g.pop('db', None)
    if db is not None:
        db.close()

def init_db():
    db = get_db()
    
    db.executescript('''
        -- Contractors table remains the same
        CREATE TABLE IF NOT EXISTS Contractors (
            ContractorID INTEGER PRIMARY KEY AUTOINCREMENT, 
            Name TEXT NOT NULL, 
            ContactInfo TEXT
        );

        -- StockItems table simplified (IdentifyingNumber removed)
        CREATE TABLE IF NOT EXISTS StockItems (
            StockID INTEGER PRIMARY KEY AUTOINCREMENT, 
            Type TEXT NOT NULL, 
            Quality TEXT NOT NULL,
            ColorShadeNumber TEXT,
            CurrentPricePerKg REAL NOT NULL, 
            QuantityInStockKg REAL NOT NULL,
            CONSTRAINT uq_stock_item UNIQUE (Type, Quality, ColorShadeNumber)
        );

        -- Orders table is now LentRecords, with new penalty fields
        CREATE TABLE IF NOT EXISTS LentRecords (
            LentRecordID INTEGER PRIMARY KEY AUTOINCREMENT, 
            ContractorID INTEGER NOT NULL, 
            DateIssued TEXT NOT NULL,
            DateDue TEXT, 
            PenaltyPerDay REAL NOT NULL DEFAULT 0,
            Notes TEXT,
            Status TEXT NOT NULL DEFAULT 'Open', -- 'Open' or 'Closed'
            FOREIGN KEY (ContractorID) REFERENCES Contractors(ContractorID)
        );

        -- OrderStockTransactions is now StockTransactions, links to LentRecords
        CREATE TABLE IF NOT EXISTS StockTransactions (
            TransactionID INTEGER PRIMARY KEY AUTOINCREMENT, 
            LentRecordID INTEGER NOT NULL, 
            StockID INTEGER NOT NULL,
            TransactionType TEXT NOT NULL CHECK(TransactionType IN ('Issued', 'Returned')),
            WeightKg REAL NOT NULL, 
            PricePerKgAtTimeOfTransaction REAL NOT NULL,
            Notes TEXT, -- NEW: To mark 'Kept by contractor' etc.
            FOREIGN KEY (LentRecordID) REFERENCES LentRecords(LentRecordID),
            FOREIGN KEY (StockID) REFERENCES StockItems(StockID)
        );

        -- Payments table now links to LentRecords
        CREATE TABLE IF NOT EXISTS Payments (
            PaymentID INTEGER PRIMARY KEY AUTOINCREMENT,
            LentRecordID INTEGER, -- Can be null for general payments to contractor
            ContractorID INTEGER NOT NULL,
            PaymentDate TEXT NOT NULL,
            Amount REAL NOT NULL,
            Notes TEXT,
            FOREIGN KEY (LentRecordID) REFERENCES LentRecords(LentRecordID),
            FOREIGN KEY (ContractorID) REFERENCES Contractors(ContractorID)
        );
    ''')
    print("Database schema initialized with new structure.")

@click.command('init-db')
@with_appcontext
def init_db_command():
    init_db()
    click.echo('Initialized the database.')

def init_app(app):
    app.teardown_appcontext(close_db)
    app.cli.add_command(init_db_command)
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
        -- Contractors table
        CREATE TABLE IF NOT EXISTS Contractors (
            ContractorID INTEGER PRIMARY KEY AUTOINCREMENT, 
            Name TEXT NOT NULL, 
            ContactInfo TEXT
        );

        -- StockItems table
        CREATE TABLE IF NOT EXISTS StockItems (
            StockID INTEGER PRIMARY KEY AUTOINCREMENT, 
            Type TEXT NOT NULL, 
            Quality TEXT NOT NULL,
            ColorShadeNumber TEXT,
            CurrentPricePerKg REAL NOT NULL, 
            QuantityInStockKg REAL NOT NULL,
            CONSTRAINT uq_stock_item UNIQUE (Type, Quality, ColorShadeNumber)
        );

        -- Orders table is the central table for all work
        CREATE TABLE IF NOT EXISTS Orders (
            OrderID INTEGER PRIMARY KEY AUTOINCREMENT,
            ContractorID INTEGER NOT NULL,
            DesignNumber TEXT NOT NULL,
            ShadeCard TEXT,
            Quality TEXT, -- Carpet Quality e.g., "60x60"
            Size TEXT, -- Carpet Size e.g., "8x10 ft"
            DateIssued TEXT NOT NULL,
            DateDue TEXT,
            DateCompleted TEXT,
            PenaltyPerDay REAL NOT NULL DEFAULT 0,
            Notes TEXT,
            Status TEXT NOT NULL DEFAULT 'Open', -- 'Open' or 'Closed'
            
            -- NEW: Fields for area-based wage calculation
            Length REAL,
            Width REAL,
            PricePerSqFt REAL,
            Wage REAL, -- This will store the final, possibly overridden, wage.

            FOREIGN KEY (ContractorID) REFERENCES Contractors(ContractorID)
        );

        -- StockTransactions links directly to Orders
        CREATE TABLE IF NOT EXISTS StockTransactions (
            TransactionID INTEGER PRIMARY KEY AUTOINCREMENT, 
            OrderID INTEGER NOT NULL, 
            StockID INTEGER NOT NULL,
            TransactionType TEXT NOT NULL CHECK(TransactionType IN ('Issued', 'Returned')),
            WeightKg REAL NOT NULL, 
            PricePerKgAtTimeOfTransaction REAL NOT NULL,
            TransactionDate TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            Notes TEXT,
            FOREIGN KEY (OrderID) REFERENCES Orders(OrderID),
            FOREIGN KEY (StockID) REFERENCES StockItems(StockID)
        );

        -- Payments links to Orders or can be general
        CREATE TABLE IF NOT EXISTS Payments (
            PaymentID INTEGER PRIMARY KEY AUTOINCREMENT,
            OrderID INTEGER, -- Can be null for general payments
            ContractorID INTEGER NOT NULL,
            PaymentDate TEXT NOT NULL,
            Amount REAL NOT NULL,
            Notes TEXT,
            FOREIGN KEY (OrderID) REFERENCES Orders(OrderID),
            FOREIGN KEY (ContractorID) REFERENCES Contractors(ContractorID)
        );
        
        -- Deductions table to track financial cuts during order completion
        CREATE TABLE IF NOT EXISTS Deductions (
            DeductionID INTEGER PRIMARY KEY AUTOINCREMENT,
            OrderID INTEGER NOT NULL,
            Amount REAL NOT NULL,
            Reason TEXT NOT NULL,
            FOREIGN KEY (OrderID) REFERENCES Orders(OrderID)
        );

        -- NEW: Table to log contractor reassignments
        CREATE TABLE IF NOT EXISTS OrderReassignmentLog (
            LogID INTEGER PRIMARY KEY AUTOINCREMENT,
            OrderID INTEGER NOT NULL,
            OldContractorID INTEGER NOT NULL,
            NewContractorID INTEGER NOT NULL,
            ReassignmentDate TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            Reason TEXT,
            FOREIGN KEY (OrderID) REFERENCES Orders(OrderID),
            FOREIGN KEY (OldContractorID) REFERENCES Contractors(ContractorID),
            FOREIGN KEY (NewContractorID) REFERENCES Contractors(ContractorID)
        );
    ''')
    print("Database schema initialized.")

@click.command('init-db')
@with_appcontext
def init_db_command():
    init_db()
    click.echo('Initialized the database.')

def init_app(app):
    app.teardown_appcontext(close_db)
    app.cli.add_command(init_db_command)
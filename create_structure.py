import os

# --- 1. Define the Project Structure ---
# A dictionary where keys are directory names and values are either:
#  - A list of filenames.
#  - Another dictionary representing subdirectories.
project_structure = {
    "flask-inventory-app": {
        "files": [
            "run.py",
            "requirements.txt",
            "config.py"
        ],
        "app": {
            "files": ["__init__.py"],
            "api": {
                "files": ["__init__.py", "contractors.py", "stock.py", "orders.py"]
            },
            "services": {
                "files": ["__init__.py", "contractor_service.py", "stock_service.py", "order_service.py", "excel_service.py"]
            },
            "database": {
                "files": ["__init__.py", "db.py"]
            }
        }
    }
}

# --- 2. Define Boilerplate Content for Files ---
# Using relative paths from the root directory as keys.
file_content = {
    "flask-inventory-app/run.py": """
# The main entry point to start the server.
from app import create_app

app = create_app()

if __name__ == '__main__':
    app.run(debug=True)
""",
    "flask-inventory-app/requirements.txt": """
# Python dependencies
Flask==2.2.3
Flask-SQLAlchemy==3.0.3
pandas==1.5.3
openpyxl==3.1.2
python-dotenv==1.0.0
""",
    "flask-inventory-app/config.py": """
# Configuration settings (DB path, secret key, etc.).
import os

basedir = os.path.abspath(os.path.dirname(__file__))

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'a-hard-to-guess-string'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \\
        'sqlite:///' + os.path.join(basedir, 'inventory.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
""",
    "flask-inventory-app/app/__init__.py": """
# Contains the application factory (create_app).
from flask import Flask
from config import Config
from .database.db import db
from .api.contractors import contractors_bp
from .api.stock import stock_bp
from .api.orders import orders_bp

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Initialize extensions
    db.init_app(app)

    # Register blueprints
    app.register_blueprint(contractors_bp, url_prefix='/api')
    app.register_blueprint(stock_bp, url_prefix='/api')
    app.register_blueprint(orders_bp, url_prefix='/api')

    with app.app_context():
        # Create database tables if they don't exist
        db.create_all()

    return app
""",
    "flask-inventory-app/app/api/__init__.py": "# Blueprints for our API routes.",
    "flask-inventory-app/app/api/contractors.py": """
# Routes for /api/contractors.
from flask import Blueprint, jsonify

contractors_bp = Blueprint('contractors', __name__)

@contractors_bp.route('/contractors', methods=['GET'])
def get_contractors():
    # Placeholder: Logic to get all contractors
    return jsonify([{'id': 1, 'name': 'Contractor A'}])
""",
    "flask-inventory-app/app/api/stock.py": """
# Routes for /api/stock_items.
from flask import Blueprint, jsonify

stock_bp = Blueprint('stock', __name__)

@stock_bp.route('/stock_items', methods=['GET'])
def get_stock_items():
    # Placeholder: Logic to get all stock items
    return jsonify([{'id': 1, 'name': 'Hammer', 'quantity': 50}])
""",
    "flask-inventory-app/app/api/orders.py": """
# Routes for orders, transactions, and financials.
from flask import Blueprint, jsonify

orders_bp = Blueprint('orders', __name__)

@orders_bp.route('/orders', methods=['GET'])
def get_orders():
    # Placeholder: Logic to get all orders
    return jsonify([{'id': 1, 'item_id': 1, 'quantity': 5, 'type': 'out'}])
""",
    "flask-inventory-app/app/services/__init__.py": "# Business logic layer.",
    "flask-inventory-app/app/services/contractor_service.py": "# Business logic for contractors.",
    "flask-inventory-app/app/services/stock_service.py": "# Business logic for stock items.",
    "flask-inventory-app/app/services/order_service.py": "# Business logic for orders and transactions.",
    "flask-inventory-app/app/services/excel_service.py": "# Logic for exporting data to Excel.",
    "flask-inventory-app/app/database/__init__.py": "# Database handling.",
    "flask-inventory-app/app/database/db.py": """
# Database connection and initialization logic.
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()
"""
}

# --- 3. The Script to Build the Structure ---
def create_project_structure(base_path, structure):
    """
    Recursively creates directories and files based on a dictionary structure.
    """
    for name, content in structure.items():
        current_path = os.path.join(base_path, name)
        
        # If it's a directory
        if isinstance(content, dict):
            # Create directory
            os.makedirs(current_path, exist_ok=True)
            print(f"Created directory: {current_path}")
            
            # Recurse for subdirectories and files
            create_project_structure(current_path, content)
            
        # If it's a list of files
        elif name == "files" and isinstance(content, list):
            for filename in content:
                file_path = os.path.join(base_path, filename)
                
                # Check if there's predefined content for this file
                # The key for file_content is relative to the project root
                content_key = os.path.relpath(file_path).replace(os.sep, '/')
                file_data = file_content.get(content_key, "")
                
                # Create file and write content
                with open(file_path, 'w') as f:
                    # Strip leading whitespace for cleaner files
                    f.write(file_data.strip())
                print(f"  - Created file: {file_path}")

# --- Main Execution ---
if __name__ == "__main__":
    # The starting point for creation (current directory)
    root_path = os.getcwd()
    
    print("Starting project creation...")
    create_project_structure(root_path, project_structure)
    print("\nProject structure for 'flask-inventory-app' created successfully!")
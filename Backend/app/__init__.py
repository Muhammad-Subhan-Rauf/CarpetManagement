# Original relative path: app/__init__.py

# /app/__init__.py (Corrected)

from flask import Flask
from flask_cors import CORS
from .database import db
from .api.contractors import contractors_bp
from .api.stock import stock_bp
from .api.lendings import lendings_bp
from .api.stock_reports import stock_reports_bp # NEW

def create_app(test_config=None):
    app = Flask(__name__, instance_relative_config=True)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # --- THIS IS THE FIX ---
    # Load configuration from the 'config' module (config.py)
    # This is more reliable than using from_pyfile with your structure.
    app.config.from_object('config')

    # Initialize extensions
    db.init_app(app)

    # Register blueprints
    app.register_blueprint(contractors_bp, url_prefix='/api')
    app.register_blueprint(stock_bp, url_prefix='/api')
    app.register_blueprint(lendings_bp, url_prefix='/api')
    app.register_blueprint(stock_reports_bp, url_prefix='/api') # NEW

    return app
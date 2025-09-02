# Original relative path: app/__init__.py

# /app/__init__.py

from flask import Flask
from flask_cors import CORS
from .database.db import init_app as init_db_app
from .api.contractors import contractors_bp
from .api.stock import stock_bp
from .api.orders import orders_bp
from .api.payments import payments_bp
from config import Config

def create_app(test_config=None):
    app = Flask(__name__, instance_relative_config=True)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # app.config.from_object('config')
    app.config.from_object(Config)
    # Initialize extensions
    init_db_app(app)

    # Register blueprints
    app.register_blueprint(contractors_bp, url_prefix='/api')
    app.register_blueprint(stock_bp, url_prefix='/api')
    app.register_blueprint(orders_bp, url_prefix='/api')
    app.register_blueprint(payments_bp, url_prefix='/api')

    return app
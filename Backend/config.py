# /config.py

import os

# Get the absolute path of the directory where this file is located
basedir = os.path.abspath(os.path.dirname(__file__))

# These are now top-level variables, which from_pyfile() can read.
SECRET_KEY = os.environ.get('SECRET_KEY', 'a_very_secret_key')
DB_PATH = os.path.join(basedir, 'inventory.db')
EXCEL_PATH = os.path.join(basedir, 'inventory_data.xlsx')
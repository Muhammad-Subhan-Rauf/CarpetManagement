import os, sys

def resource_path(relative_path):
    """Get absolute path to resource, works for dev and frozen exe"""
    if getattr(sys, 'frozen', False):  
        # Running from exe → look next to the .exe
        base_path = os.path.dirname(sys.executable)
    else:
        # Running from source → look next to this file
        base_path = os.path.abspath(os.path.dirname(__file__))
    return os.path.join(base_path, relative_path)


class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'a_very_secret_key')
    DB_PATH = resource_path("inventory.db")
    EXCEL_PATH = resource_path("inventory_data.xlsx")

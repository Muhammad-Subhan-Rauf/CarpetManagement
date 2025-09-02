# /run.py

from app import create_app
import sys, os
from config import Config


def resource_path(relative_path):
    """ Get absolute path to resource, works for dev and for PyInstaller exe """
    try:
        base_path = sys._MEIPASS  # PyInstaller temp folder
    except Exception:
        base_path = os.path.abspath(".")

    return os.path.join(base_path, relative_path)


app = create_app()

if __name__ == '__main__':
    app.run(debug=True, port=5001)
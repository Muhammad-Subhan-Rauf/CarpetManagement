# /run.py

from app import create_app
import sys, os, socket
from flask import Flask


def resource_path(relative_path):
    """ Get absolute path to resource, works for dev and for PyInstaller exe """
    try:
        base_path = sys._MEIPASS  # PyInstaller temp folder
    except Exception:
        base_path = os.path.abspath(".")

    return os.path.join(base_path, relative_path)


app = create_app()


def find_free_port(preferred_port=55000):
    """Try preferred port, otherwise pick a free one"""
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.bind(("", preferred_port))
        port = preferred_port
    except OSError:
        # If preferred port is busy, pick any free port
        s.bind(("", 0))
        port = s.getsockname()[1]
    s.close()
    return port


if __name__ == "__main__":
    port = find_free_port()
    print(f"Running on http://127.0.0.1:{port}")
    app.run(host="0.0.0.0", port=port)

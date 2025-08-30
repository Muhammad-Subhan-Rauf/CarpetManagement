import os
from pathlib import Path

# Define the project structure in a dictionary.
# Keys are directories, and values are lists of files or sub-directories.
structure = {
    "src": [
        "App.jsx",
        "index.css",
        "main.jsx",
        {
            "components": [
                "Card.jsx",
                "Header.jsx",
                "Layout.jsx",
            ]
        },
        {
            "pages": [
                "Dashboard.jsx",
                "Inventory.jsx",
                "OrderDetails.jsx",
            ]
        },
        {
            "data": [
                "mockData.js"
            ]
        }
    ]
}

def create_project_structure(base_path, project_structure):
    """
    Recursively creates directories and files based on a nested dictionary.
    """
    for name, content in project_structure.items():
        current_path = Path(base_path) / name
        # Create the directory
        current_path.mkdir(parents=True, exist_ok=True)
        print(f"Created directory: {current_path}/")

        if isinstance(content, list):
            for item in content:
                if isinstance(item, str):
                    # It's a file
                    file_path = current_path / item
                    file_path.touch()
                    print(f"  └── Created file:    {file_path}")
                elif isinstance(item, dict):
                    # It's a sub-directory, recurse
                    create_project_structure(current_path, item)

if __name__ == "__main__":
    # The root directory for the project structure.
    # We will create the 'src' directory in the current working directory.
    project_root = Path('.') 

    # We need a dummy root key for the initial call
    initial_structure = {
        key: value for d in structure['src'] if isinstance(d, dict) for key, value in d.items()
    }
    top_level_files = [f for f in structure['src'] if isinstance(f, str)]

    # Create top-level 'src' directory first
    src_path = project_root / 'src'
    src_path.mkdir(exist_ok=True)
    print(f"Created directory: {src_path}/")

    # Create top-level files inside 'src'
    for f in top_level_files:
        file_path = src_path / f
        file_path.touch()
        print(f"  ├── Created file:    {file_path}")
    
    # Create sub-directories and their files inside 'src'
    create_project_structure(src_path, initial_structure)
    
    print("\n✅ Project structure created successfully!")
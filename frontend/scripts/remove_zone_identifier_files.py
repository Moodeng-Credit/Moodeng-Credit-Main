import os


def remove_zone_identifier_files(root_dir):
    for dirpath, dirnames, filenames in os.walk(root_dir):
        for filename in filenames:
            if filename.endswith("Zone.Identifier"):
                file_path = os.path.join(dirpath, filename)
                try:
                    os.remove(file_path)
                    print(f"Removed: {file_path}")
                except Exception as e:
                    print(f"Error removing {file_path}: {e}")


# Use the current directory as the root
root_directory = "."

remove_zone_identifier_files(root_directory)
print("Finished removing Zone.Identifier files..")

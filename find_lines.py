import os

search_term = "generateRegistrationId"
extensions = (".js", ".jsx", ".ts", ".tsx")
exclude_dirs = {"node_modules", ".git", ".expo"}

for root, dirs, files in os.walk("."):
    # Modify dirs in-place to skip excluded directories
    dirs[:] = [d for d in dirs if d not in exclude_dirs]
    for file in files:
        if file.endswith(extensions):
            file_path = os.path.join(root, file)
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    for idx, line in enumerate(f, 1):
                        if search_term in line:
                            print(f"{file_path}:{idx} -> {line.strip()}")
            except Exception as e:
                pass


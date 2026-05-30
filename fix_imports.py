import os
import re

files = [
    'js/ui/formatters.js',
    'js/ui/modals.js',
    'js/ui/components.js',
    'js/ui/renderers.js',
    'js/ui/core.js'
]

# Get all exports from ui_new.js
exports = []
with open('js/ui.js', 'r', encoding='utf-8') as f:
    for line in f:
        match = re.match(r'^export (?:const|function) ([a-zA-Z0-9_]+)', line)
        if match:
            exports.append(match.group(1))

exports_str = ", ".join(exports)

for filepath in files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Prepend the import
    import_stmt = f"import {{ {exports_str} }} from '../ui.js';\n\n"
    
    # We also need to fix missing variables if they reference things in ui.js
    # But wait, if formatters.js exports `getLevelInfo`, and also imports `getLevelInfo` from `../ui.js`,
    # JS will throw a SyntaxError: Identifier 'getLevelInfo' has already been declared.
    
    # So we must import only what is NOT exported in this file!
    file_exports = []
    for line in content.split('\n'):
        match = re.match(r'^export (?:const|function) ([a-zA-Z0-9_]+)', line)
        if match:
            file_exports.append(match.group(1))
            
    needed_imports = [e for e in exports if e not in file_exports]
    needed_imports_str = ", ".join(needed_imports)
    
    import_stmt = f"import {{ {needed_imports_str} }} from '../ui.js';\n\n"
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(import_stmt + content)

print("Imports added.")

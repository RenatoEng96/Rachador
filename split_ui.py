import os

def read_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        return f.readlines()

def write_file(filepath, lines):
    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(lines)

lines = read_file('js/ui.js')

# Basic imports needed in most files
base_imports = [
    "import { state } from '../state.js';\n",
    "import { calculateEloMatch } from '../services/rankingService.js';\n",
    "import { settingsRef, updateDoc } from '../firebase.js';\n",
    "import { domToBlob } from 'https://unpkg.com/modern-screenshot?module';\n\n"
]

# We will split into:
# formatters.js: 43-144
# modals.js: 145-383
# renderers.js: 1312-1932
# components.js: 485-1194
# navigation.js: 384-484 + 1933-2153 + 2154-EOF

# Wait, let's just make it simpler.
# We will create ui/utils.js, ui/modals.js, ui/renderers.js, ui/components.js, ui/core.js
# But since they cross-reference each other, JS modules might have circular dependencies.
# The user wants to organize ui.js to keep it perfectly functional.
# Circular dependencies in JS ES6 modules work fine if you use them correctly (not during module initialization).

# Let's extract exactly by line numbers.
blocks = {
    'js/ui/formatters.js': base_imports + lines[42:144],
    'js/ui/modals.js': base_imports + lines[144:383],
    'js/ui/components.js': base_imports + lines[484:1194],
    'js/ui/renderers.js': base_imports + lines[1311:1932],
    'js/ui/core.js': base_imports + lines[0:42] + lines[383:484] + lines[1194:1311] + lines[1932:]
}

for filepath, content in blocks.items():
    write_file(filepath, content)

# Now, we need to create the new ui.js which re-exports everything from these submodules.
# We need to extract all "export const X =" or "export function X" names to re-export.
exports = []
import re
for line in lines:
    match = re.match(r'^export (?:const|function) ([a-zA-Z0-9_]+)', line)
    if match:
        exports.append(match.group(1))

new_ui_js = [
    "// ============================================================================\n",
    "// HUB UI.JS - Arquivo Centralizador de Exportações\n",
    "// ============================================================================\n\n",
    "export * from './ui/formatters.js';\n",
    "export * from './ui/modals.js';\n",
    "export * from './ui/components.js';\n",
    "export * from './ui/renderers.js';\n",
    "export * from './ui/core.js';\n"
]

write_file('js/ui_new.js', new_ui_js)
print("ui.js split completed.")

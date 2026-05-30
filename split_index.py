import re

def extract_section(content, section_start_pattern, section_end_pattern):
    match = re.search(f'({section_start_pattern}.*?{section_end_pattern})', content, re.DOTALL)
    if match:
        section_content = match.group(1)
        new_content = content.replace(section_content, f'<!-- INJECT: {section_start_pattern} -->')
        return section_content, new_content
    return None, content

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Definições das seções para extrair (Start e End markers baseados nas tags)
sections = [
    ('nav.html', r'<nav class="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">', r'</nav>'),
    ('public.html', r'<section id="view-public".*?>', r'</section>\s*<!-- NOVA ABA: SORTEIO -->'), # using the next comment as a safe boundary
    ('sorteio.html', r'<section id="view-sorteio".*?>', r'</section>\s*<!-- ABA PLACAR -->'),
    ('placar.html', r'<section id="view-placar".*?>', r'</section>\s*<!-- ABA LANDING PAGE -->'),
    ('landing.html', r'<section id="view-landing".*?>', r'</section>\s*<!-- ABA ADMIN \(PAINEL\) -->'),
    ('admin.html', r'<section id="view-admin".*?>', r'</section>\s*<!-- ABA PAGAMENTOS -->'),
    ('pagamentos.html', r'<section id="view-pagamentos".*?>', r'</section>\s*<!-- Modais \(Victory, Confirm, Move, Config Placar\) -->'),
    # Modais are wrapped in multiple divs at the end of body. We can just extract them based on their ids.
]

# Note: The above regexes might be tricky. A better approach is to use an HTML parser like BeautifulSoup if available,
# but since I want it to be bulletproof without pip install, I will write a simple stack-based tag extractor.

def extract_by_tag_and_id(html, tag, attr, attr_val):
    pattern = f'<{tag}[^>]*?{attr}="{attr_val}"[^>]*>'
    match = re.search(pattern, html)
    if not match:
        return None, html
    
    start_idx = match.start()
    
    # Simple stack to find the closing tag
    stack = []
    i = start_idx
    tag_start = f'<{tag}'
    tag_end = f'</{tag}>'
    
    while i < len(html):
        if html.startswith(tag_start, i):
            # To avoid matching <nav-item> as <nav>, check next char
            char_after = html[i + len(tag_start)]
            if char_after in [' ', '>', '\n', '\t']:
                stack.append(tag_start)
        elif html.startswith(tag_end, i):
            stack.pop()
            if len(stack) == 0:
                end_idx = i + len(tag_end)
                section = html[start_idx:end_idx]
                new_html = html[:start_idx] + f'<!-- INJECT: {attr_val} -->' + html[end_idx:]
                return section, new_html
        i += 1
    return None, html

# For nav (no id, just the tag)
def extract_first_tag(html, tag):
    pattern = f'<{tag}[^>]*>'
    match = re.search(pattern, html)
    if not match:
        return None, html
    start_idx = match.start()
    stack = []
    i = start_idx
    tag_start = f'<{tag}'
    tag_end = f'</{tag}>'
    
    while i < len(html):
        if html.startswith(tag_start, i):
            char_after = html[i + len(tag_start)]
            if char_after in [' ', '>', '\n', '\t']:
                stack.append(tag_start)
        elif html.startswith(tag_end, i):
            stack.pop()
            if len(stack) == 0:
                end_idx = i + len(tag_end)
                section = html[start_idx:end_idx]
                new_html = html[:start_idx] + f'<!-- INJECT: {tag} -->' + html[end_idx:]
                return section, new_html
        i += 1
    return None, html

views = {
    'public.html': ('section', 'id', 'view-public'),
    'sorteio.html': ('section', 'id', 'view-sorteio'),
    'placar.html': ('section', 'id', 'view-placar'),
    'landing.html': ('section', 'id', 'view-landing'),
    'admin.html': ('section', 'id', 'view-admin'),
    'pagamentos.html': ('section', 'id', 'view-pagamentos'),
    'groups.html': ('section', 'id', 'view-groups'),
    'auth.html': ('section', 'id', 'view-auth'),
}

modals = [
    'victoryModal', 'confirmModal', 'movePlayerModal', 'playerHistoryModal',
    'createGroupModal', 'placarConfigModal', 'termsModal', 'privacyModal', 'supportModal'
]

modals_content = ""

# 1. Extract Nav
nav_content, html = extract_first_tag(html, 'nav')
if nav_content:
    with open('views/nav.html', 'w', encoding='utf-8') as f:
        f.write(nav_content)

# 2. Extract Views
for file_name, (tag, attr, attr_val) in views.items():
    content, html = extract_by_tag_and_id(html, tag, attr, attr_val)
    if content:
        with open(f'views/{file_name}', 'w', encoding='utf-8') as f:
            f.write(content)

# 3. Extract Modals
for modal_id in modals:
    content, html = extract_by_tag_and_id(html, 'div', 'id', modal_id)
    if content:
        modals_content += content + "\n\n"

if modals_content:
    with open('views/modals.html', 'w', encoding='utf-8') as f:
        f.write(modals_content)

# Save the updated index.html
with open('index_new.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("Split completed.")

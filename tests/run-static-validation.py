#!/usr/bin/env python3
from pathlib import Path
from bs4 import BeautifulSoup
from urllib.parse import urlparse
import re
import base64, hashlib, json, sys

root = Path(__file__).resolve().parents[1]
issues = []
references = 0
schema_blocks = 0
htmls = sorted(root.glob('ar/**/index.html')) + sorted(root.glob('en/**/index.html')) + [root / 'index.html']

for path in htmls:
    text = path.read_text(encoding='utf-8')
    rel = str(path.relative_to(root))
    soup = BeautifulSoup(text, 'html.parser')
    if path != root / 'index.html':
        for token in ('data-ar=', 'data-en=', 'data-val-ar=', 'data-val-en=', 'data:image/', 'data:font/', '<style', 'style=', 'href="#"', 'cf-turnstile-site-key', 'TODO: wire submission endpoint', '%3e%3c'):
            if token in text:
                issues.append(f'{rel}: residual {token}')
        inline_exec = [s for s in soup.find_all('script') if s.get('type') != 'application/ld+json' and not s.get('src')]
        if inline_exec:
            issues.append(f'{rel}: inline executable script')
        if len(soup.find_all('h1')) != 1:
            issues.append(f'{rel}: H1 count is {len(soup.find_all("h1"))}')
        if not soup.find('main', id='main-content'):
            issues.append(f'{rel}: missing main#main-content')
        if not soup.find('link', rel='canonical'):
            issues.append(f'{rel}: missing canonical')
        if not soup.find('meta', attrs={'name': 'description'}):
            issues.append(f'{rel}: missing meta description')
        hreflangs = {x.get('hreflang') for x in soup.find_all('link', rel='alternate')}
        if not {'ar', 'en', 'x-default'}.issubset(hreflangs):
            issues.append(f'{rel}: incomplete hreflang set')
        if not soup.find('link', href='/assets/css/site.css'):
            issues.append(f'{rel}: missing shared CSS')
        if not soup.find('script', src='/assets/js/site.js'):
            issues.append(f'{rel}: missing shared JavaScript')
        if soup.find(style=True):
            issues.append(f'{rel}: inline style attribute remains')
        if soup.find('a', href='#'):
            issues.append(f'{rel}: dead social link remains')
        for select in soup.find_all('select'):
            allowed_select_attrs = {'id', 'class', 'name', 'required', 'aria-label', 'aria-describedby'}
            unknown_attrs = set(select.attrs) - allowed_select_attrs
            if unknown_attrs:
                issues.append(f'{rel}: malformed select attributes {sorted(unknown_attrs)}')
            if 'select-input' not in (select.get('class') or []):
                issues.append(f'{rel}: select missing external select-input class')
        if soup.select('section.page'):
            issues.append(f'{rel}: residual SPA page section')
        if soup.find(id=lambda x: x and x.startswith('page-')):
            issues.append(f'{rel}: residual SPA page id')
        for key in ('og:type', 'og:title', 'og:description', 'og:url', 'og:image'):
            if not soup.find('meta', attrs={'property': key}):
                issues.append(f'{rel}: missing {key}')
        for key in ('twitter:card', 'twitter:title', 'twitter:description', 'twitter:image'):
            if not soup.find('meta', attrs={'name': key}):
                issues.append(f'{rel}: missing {key}')

    for schema in soup.find_all('script', {'type': 'application/ld+json'}):
        try:
            json.loads(schema.get_text())
            schema_blocks += 1
        except Exception as error:
            issues.append(f'{rel}: invalid JSON-LD: {error}')

    for tag, attr in (('a', 'href'), ('link', 'href'), ('script', 'src'), ('img', 'src')):
        for element in soup.find_all(tag):
            value = element.get(attr)
            if not value or value.startswith(('#', 'mailto:', 'tel:', 'javascript:', 'http://', 'https://', 'data:')):
                continue
            references += 1
            parsed = urlparse(value).path
            if parsed.startswith('/'):
                target = root / parsed.lstrip('/')
                if parsed.endswith('/'):
                    target = target / 'index.html'
                if not target.exists():
                    issues.append(f'{rel}: missing local target {value}')



headers_text = (root / '_headers').read_text(encoding='utf-8')
if "'unsafe-inline'" in headers_text:
    issues.append('_headers: unsafe-inline remains')
if "style-src-attr 'none'" not in headers_text or "script-src-attr 'none'" not in headers_text:
    issues.append('_headers: strict attribute directives missing')
for path in htmls:
    if path == root / 'index.html':
        continue
    soup = BeautifulSoup(path.read_text(encoding='utf-8'), 'html.parser')
    for script in soup.find_all('script', {'type': 'application/ld+json'}):
        content = script.string if script.string is not None else script.get_text()
        digest = base64.b64encode(hashlib.sha256(content.encode('utf-8')).digest()).decode('ascii')
        if f"'sha256-{digest}'" not in headers_text:
            issues.append(f'{path.relative_to(root)}: JSON-LD CSP hash missing')

site_js_text = (root / 'assets/js/site.js').read_text(encoding='utf-8')
if '.style.' in site_js_text or '.style =' in site_js_text:
    issues.append('assets/js/site.js: runtime inline styles remain')
if not (root / 'functions/api/public-config.js').exists():
    issues.append('functions/api/public-config.js: missing')
lead_text = (root / 'functions/api/lead.js').read_text(encoding='utf-8')
if "DELETE FROM lead_rate_limits WHERE updated_at < datetime('now', '-48 hours')" not in lead_text:
    issues.append('functions/api/lead.js: stale rate-limit cleanup missing')

result = {
    'html_files_checked': len(htmls),
    'local_references_checked': references,
    'jsonld_blocks_parsed': schema_blocks,
    'inline_style_attributes': sum(len(BeautifulSoup(p.read_text(encoding='utf-8'), 'html.parser').find_all(style=True)) for p in htmls),
    'dead_hash_links': sum(len(BeautifulSoup(p.read_text(encoding='utf-8'), 'html.parser').find_all('a', href='#')) for p in htmls),
    'jsonld_csp_hashes': len(set(re.findall(r"sha256-[A-Za-z0-9+/=]+", headers_text))),
    'issues': issues,
}
print(json.dumps(result, ensure_ascii=False, indent=2))
sys.exit(1 if issues else 0)

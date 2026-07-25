#!/usr/bin/env python3
from pathlib import Path
from bs4 import BeautifulSoup

root = Path(__file__).resolve().parents[1]
checks = {
    'customers': ['form-customer', 'customer-email', 'customer-consent'],
    'merchants': ['form-merchant', 'merchant-brand', 'merchant-contact', 'merchant-email', 'merchant-mobile', 'merchant-consent'],
    'clinics-doctors': ['form-clinic', 'clinic-name', 'clinic-contact', 'clinic-email', 'clinic-mobile', 'clinic-consent'],
    'beauty-experts': ['form-expert', 'expert-name', 'expert-email', 'expert-mobile', 'expert-locations', 'expert-consent'],
}
issues = []
for lang in ('ar', 'en'):
    for slug, ids in checks.items():
        soup = BeautifulSoup((root / lang / slug / 'index.html').read_text(encoding='utf-8'), 'html.parser')
        for id_ in ids:
            if not soup.find(id=id_):
                issues.append(f'{lang}/{slug}: missing #{id_}')
        form = soup.find('form')
        if not form or not form.find(class_='form-status') or not form.find(class_='turnstile-slot'):
            issues.append(f'{lang}/{slug}: form status/Turnstile slot missing')

for lang in ('ar', 'en'):
    home = BeautifulSoup((root / lang / 'index.html').read_text(encoding='utf-8'), 'html.parser')
    if len(home.select('.faq-q')) < 1:
        issues.append(f'{lang}/: FAQ controls missing')
    toggle = home.find(id='lang-toggle')
    expected = '/en/' if lang == 'ar' else '/ar/'
    if not toggle or toggle.get('href') != expected:
        issues.append(f'{lang}/: language toggle target incorrect')
    if not home.find(id='burger-btn') or not home.find(id='mobile-menu'):
        issues.append(f'{lang}/: mobile navigation structure missing')

if issues:
    raise SystemExit('\n'.join(issues))
print('{"frontend_structure_checks":"passed","routes_checked":10}')

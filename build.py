"""Ventsistema: galutinės versijos surinkimas galutiniam domenui.

    python build.py --final [--out KATALOGAS] [--domain https://ventsistema.lt]

Šaltinis (šis katalogas) lieka peržiūros versija GitHub Pages adrese: noindex, robots Disallow.
Komanda nukopijuoja svetainę į atskirą katalogą (pagal nutylėjimą ../ventsistema-site-final) ir ten:
  * peržiūros adresą https://vasilyanaptyp-oss.github.io/ventsistema-site/ pakeičia galutiniu domenu
    (canonical, og:url, og:image, JSON-LD);
  * kelius /ventsistema-site/... pakeičia į /... (svetainė domeno šaknyje);
  * pašalina <meta name="robots" content="noindex,nofollow">;
  * robots.txt leidžia indeksuoti ir nurodo sitemap.xml.
Šaltinio failai nekeičiami.
"""
import argparse
import os
import re
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PREVIEW = 'https://vasilyanaptyp-oss.github.io/ventsistema-site/'
BASE = '/ventsistema-site/'
SKIP = {'.git', 'build.py', '__pycache__'}
TEXT = ('.html', '.css', '.js', '.json', '.xml', '.txt', '.svg', '.webmanifest')


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
    ap = argparse.ArgumentParser()
    ap.add_argument('--final', action='store_true', help='surinkti galutinę (indeksuojamą) versiją')
    ap.add_argument('--out', default=os.path.join(os.path.dirname(HERE), 'ventsistema-site-final'))
    ap.add_argument('--domain', default='https://ventsistema.lt')
    a = ap.parse_args()
    if not a.final:
        ap.print_help()
        return 1
    domain = a.domain.rstrip('/') + '/'
    out = os.path.abspath(a.out)
    if out == HERE or out.startswith(HERE + os.sep):
        print('Išvesties katalogas negali būti šaltinio viduje.')
        return 2
    if os.path.exists(out) and os.listdir(out):
        print('Išvesties katalogas jau yra ir nėra tuščias:', out)
        return 2
    n = 0
    for root, dirs, files in os.walk(HERE):
        dirs[:] = [d for d in dirs if d not in SKIP]
        for f in files:
            if f in SKIP:
                continue
            src = os.path.join(root, f)
            dst = os.path.join(out, os.path.relpath(src, HERE))
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            if f.endswith(TEXT):
                with open(src, encoding='utf-8', newline='') as fh:
                    t = fh.read()
                t = t.replace(PREVIEW, domain).replace(BASE, '/')
                t = re.sub(r'<meta name="robots" content="noindex,nofollow">\r?\n?', '', t)
                if f == 'robots.txt' and root == HERE:
                    t = 'User-agent: *\nAllow: /\n\nSitemap: ' + domain + 'sitemap.xml\n'
                with open(dst, 'w', encoding='utf-8', newline='') as fh:
                    fh.write(t)
            else:
                shutil.copy2(src, dst)
            n += 1
    left = []
    for root, dirs, files in os.walk(out):
        for f in files:
            if f.endswith(TEXT):
                t = open(os.path.join(root, f), encoding='utf-8').read()
                if 'noindex' in t or 'vasilyanaptyp-oss' in t or BASE in t:
                    left.append(os.path.relpath(os.path.join(root, f), out))
    print(f'Paruošta {n} failų: {out}')
    if left:
        print('DĖMESIO, liko peržiūros žymių:', ', '.join(left))
        return 3
    return 0


if __name__ == '__main__':
    sys.exit(main())

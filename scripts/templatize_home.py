# -*- coding: utf-8 -*-
# Convert cz/index.html (homepage) to templates/index.html with {{VAR}} placeholders
# This handles BOTH static HTML text AND JS data blobs

with open('templates/index.html', 'r', encoding='utf-8') as f:
    c = f.read()

# ═══════════════════════════════════════════
# HTML STATIC TEXT
# ═══════════════════════════════════════════

pairs = [
    # HTML lang
    ('lang="cs"', 'lang="{{LANG}}"'),

    # Title / meta
    ('Legal Atlas · Česko — Najděte přesný § za 30 sekund', '{{PAGE_TITLE}}'),
    ('97 zákonů, 19 772 paragrafů, 1 465 rozhodnutí. Žádné halucinace. Citace u každé odpovědi. Vyzkoušejte zdarma.', '{{PAGE_META}}'),

    # Nav links — replace /cz/ paths with {{HOME}}
    ('href="/cz/', 'href="{{HOME}}'),

    # Nav labels
    ('>Knihovna<', '>{{NAV_BIBLIOTECA}}<'),
    ('>Judikatura<', '>{{NAV_JUDIKATURA}}<'),
    ('>Účet<', '>{{NAV_CUENTA}}<'),

    # EN link
    ("onclick=\"localStorage.setItem('la-locale','en')\"", "onclick=\"localStorage.setItem('la-locale','en')\""),

    # Hero eyebrow
    ('Mozek právní praxe', '{{HERO_EYEBROW}}'),

    # Hero tagline
    ('Najděte přesný § <em>za pár minut</em>', '{{HERO_TAGLINE}}'),

    # Hero sub
    ('<span>97 zákonů</span> · Kompletní a aktuální sbírka českých zákonů · <span>Nulové halucinace AI</span> · Citace konkrétního paragrafu u každé odpovědi',
     '{{HERO_SUB}}'),

    # Demo top label
    ('Legal Atlas · Analýza', 'Legal Atlas · {{DEMO_LABEL}}'),
    ('🇨🇿 Česko</span>', '{{DEMO_COUNTRY_PILL}}</span>'),

    # Strip items — replace the entire strip inner content
    # This is complex, handled below as a block

    # Checklist
    ('Co Legal Atlas umí', '{{CHECKLIST_EYEBROW}}'),
    ('Vše, co potřebujete pro <em>právní výzkum.</em>', '{{CHECKLIST_TITLE}}'),

    # Proof
    ('Magnus v akci', '{{PROOF_EYEBROW}}'),
    ('Skutečný případ.<br><em>45 sekund.</em>', '{{PROOF_TITLE}}'),

    # Magnus feature
    ('Popište případ.<br>Magnus najde <em>právo.</em>', '{{MAGNUS_FEAT_TITLE}}'),
    ('Otevřít Magnus →', '{{MAGNUS_CTA}}'),

    # Judikatura feature
    ('29 491 rozhodnutí.<br><em>Najděte to své.</em>', '{{JURIS_FEAT_TITLE}}'),
    ('Prohledat judikaturu →', '{{JURIS_CTA}}'),

    # Knihovna feature
    ('Celý zákon.<br><em>Článek po článku.</em>', '{{KNIHOVNA_FEAT_TITLE}}'),
    ('Otevřít Knihovnu →', '{{KNIHOVNA_CTA}}'),

    # Atlas feature
    ('Teze vs. <em>antiteze.</em><br>Vizuálně.', '{{ATLAS_FEAT_TITLE}}'),
    ('Prozkoumat Atlas →', '{{ATLAS_CTA}}'),
    ('Teze — pro vás', '{{ATLAS_TEZE_LABEL}}'),
    ('Antiteze — proti vám', '{{ATLAS_ANTI_LABEL}}'),

    # CTA final
    ('Žádný jiný AI systém to nedělá.', '{{CTA_FINAL_TITLE}}'),
    ('97 zákonů · 19 772 § · Plný text · Citace · Nulové halucinace · Zdarma', '{{CTA_FINAL_SUB}}'),
    ('Vyzkoušet zdarma →', '{{CTA_BTN}}'),

    # Footer
    ('Právní motor pro profesionály. Postaveno s\xa0respektem k\xa0právu.', '{{FOOTER_TAGLINE}}'),
    ('>Nástroje<', '>{{FOOTER_COL1_TITLE}}<'),
    ('>Jurisdikce<', '>{{FOOTER_COL2_TITLE}}<'),
    ('>Databáze<', '>{{FOOTER_COL3_TITLE}}<'),
    ('>Společnost<', '>{{FOOTER_COL4_TITLE}}<'),
    ('>97 zákonů<', '>{{FOOTER_STAT1}}<'),
    ('>19 772 paragrafů<', '>{{FOOTER_STAT2}}<'),
    ('>29 491 rozhodnutí<', '>{{FOOTER_STAT3}}<'),
    ('>7 jurisdikcí<', '>{{FOOTER_STAT4}}<'),
    ('>Ceník<', '>{{FOOTER_PRICING}}<'),
    ('Kniha (EN)', '{{FOOTER_BOOK_EN}}'),
    ('Kniha (ES)', '{{FOOTER_BOOK_ES}}'),
    ('Praha, Česko', '{{FOOTER_CITY}}'),
    ('>Podmínky<', '>{{FOOTER_TERMS}}<'),
    ('>Ochrana údajů<', '>{{FOOTER_PRIVACY}}<'),
    ('>Pravidla užívání<', '>{{FOOTER_ACCEPTABLE}}<'),
    ('>Kontakt<', '>{{FOOTER_CONTACT}}<'),
    ('Legal Atlas je nástroj pro právní výzkum určený právním profesionálům. Generuje obsah s pomocí AI s ověřenými normativními odkazy. Nepředstavuje právní poradenství ani náhradu za nezávislý odborný úsudek.',
     '{{FOOTER_DISCLAIMER}}'),
]

for old, new in pairs:
    c = c.replace(old, new)

# ═══════════════════════════════════════════
# JS DATA BLOBS — replace with template variables
# ═══════════════════════════════════════════

# Hero demos array
import re

# Replace the demos array
demos_pattern = r"(const demos = \[)(.*?)(\n  \])"
c = re.sub(demos_pattern, r"\1{{HERO_DEMOS}}\3", c, flags=re.DOTALL)

# Magnus query
c = re.sub(
    r"const query = '.*?'(\n.*?const)",
    r"const query = '{{MAGNUS_DEMO_QUERY}}'\1",
    c, count=1, flags=re.DOTALL
)

# Law scroll list
c = re.sub(
    r"(const laws = \[)(.*?)(\n  \]\n  const TARGET)",
    r"\1{{LAW_LIST}}\3",
    c, flags=re.DOTALL
)
c = c.replace("const TARGET = 'Občanský zákoník'", "const TARGET = '{{LAW_TARGET}}'")

# Knihovna articles
c = re.sub(
    r"(const articles = \[)(.*?)(\n  \])",
    r"\1{{KNIHOVNA_ARTICLES}}\3",
    c, count=1, flags=re.DOTALL
)

# Knihovna chat
c = c.replace(
    "const userQ = 'Je kupní smlouva na nemovitost platná bez notářského ověření podpisů?'",
    "const userQ = '{{KNIHOVNA_QUERY}}'"
)
c = re.sub(
    r"const aiResp = '.*?'",
    "const aiResp = '{{KNIHOVNA_AI_RESPONSE}}'",
    c, count=1, flags=re.DOTALL
)

# Judikatura demo query
c = c.replace(
    "const query = 'Zaměstnavatel propustil zaměstnance bez udání důvodu, nárok na odškodnění'",
    "const query = '{{JURIS_DEMO_QUERY}}'"
)

# Atlas teze/antiteze arrays
c = re.sub(
    r"(const teze = \[)(.*?)(\n  \]\n  const anti)",
    r"\1{{ATLAS_TEZE}}\3",
    c, flags=re.DOTALL
)
c = re.sub(
    r"(const anti = \[)(.*?)(\n  \])",
    r"\1{{ATLAS_ANTI}}\3",
    c, count=1, flags=re.DOTALL
)

# Country pill default
c = c.replace("fPais.value='CZ'", "fPais.value='{{CODE}}'")

# Demo country label
c = c.replace("pais: 'CZ'", "pais: '{{CODE}}'")

# Knihovna phase headers
c = c.replace('>Knihovna</span>', '>{{NAV_BIBLIOTECA}}</span>')
c = c.replace('>97 zákonů</span>', '>{{HOME_STAT_LAWS}}</span>')
c = c.replace('>3 079 §</span>', '>{{KNIHOVNA_ART_COUNT}}</span>')
c = c.replace('>Chat · § 2128</span>', '>{{KNIHOVNA_CHAT_HEADER}}</span>')
c = c.replace('Analyzuji zákon', '{{KNIHOVNA_LOADING}}')
c = c.replace('>Knihovna · Chat</span>', '>{{NAV_BIBLIOTECA}} · Chat</span>')

with open('templates/index.html', 'w', encoding='utf-8') as f:
    f.write(c)

# Count remaining {{
import re as re2
vars_count = len(re2.findall(r'\{\{', c))
print(f'templates/index.html templatized with {vars_count} variable slots')

# -*- coding: utf-8 -*-
# Second pass: templatize ALL remaining hardcoded texts in templates/index.html

with open('templates/index.html', 'r', encoding='utf-8') as f:
    c = f.read()

pairs = [
    # ═══ CHECKLIST (10 items) ═══
    ('Prohledá 97 zákonů v reálném čase — za sekundy, ne hodiny', '{{CHECK_1}}'),
    ('Cituje přesný § s plným zněním u každé odpovědi', '{{CHECK_2}}'),
    ('Porovná až 3 právní řády současně v jednom dotazu', '{{CHECK_3}}'),
    ('Najde nejrelevantnější soudní rozhodnutí k vašemu případu', '{{CHECK_4}}'),
    ('Zeptejte se na svůj případ — AI konzultuje celou legislativu', '{{CHECK_5}}'),
    ('Ptejte se v češtině, odpovědi i z německého či španělského práva', '{{CHECK_6}}'),
    ('Přístup k 1 465 rozhodnutím Ústavního a Nejvyššího soudu', '{{CHECK_7}}'),
    ('Nulové halucinace — každá odpověď je ověřitelná u zdroje', '{{CHECK_8}}'),
    ('Procházejte zákon hierarchicky — část, hlava, díl, paragraf', '{{CHECK_9}}'),
    ('Generování procesních diagramů z právní struktury', '{{CHECK_10}}'),

    # ═══ PROOF ═══
    ('Případ vyžadující české pracovní právo, španělské pracovní právo, mezinárodní právo soukromé EU — a precedenty Ústavního soudu. Magnus zvládá vše najednou.', '{{PROOF_SUB}}'),
    ('„Španělský architekt, 5 let v Praze, propuštěn bez výpovědi českým zaměstnavatelem. Tři týdny nevyplacené mzdy. Plánuje se vrátit do Španělska — chce žalovat před odjezdem."', '{{PROOF_CASE}}'),
    ('Česká republika · Španělsko', '{{PROOF_COUNTRIES}}'),
    ('KRITICKÉ ZJIŠTĚNÍ: Český § 72 stanoví 2měsíční lhůtu pro napadení platnosti výpovědi. Španělské právo umožňuje 1 rok. Záměna lhůty = prohra. Magnus to zjistil za 45 sekund.', '{{PROOF_VERDICT}}'),
    ('Co Magnus nalezl · 24 článků · 2 jurisdikce', '{{PROOF_RESULTS_LABEL}}'),
    # Proof findings
    ('§ 72 · Zákoník práce', '{{PROOF_ART1}}'),
    ('2měsíční lhůta pro napadení platnosti výpovědi. Již běží.', '{{PROOF_TXT1}}'),
    ('§ 141 · Zákoník práce', '{{PROOF_ART2}}'),
    ('Mzda splatná bez ohledu na způsob ukončení pracovního poměru.', '{{PROOF_TXT2}}'),
    ('čl. 56 · Estatuto de los Trabajadores', '{{PROOF_ART3}}'),
    ('Neoprávněné propuštění: 33 dnů za každý rok trvání poměru.', '{{PROOF_TXT3}}'),
    ('Řím I čl. 8 · Brusel I bis čl. 21', '{{PROOF_ART4}}'),
    ('Rozhodné právo: české. Příslušný soud: český. Vykonatelné ve Španělsku.', '{{PROOF_TXT4}}'),
    # Proof flags
    ('>🇨🇿</div>\n          <div class="find-body">\n            <div class="find-art">{{PROOF_ART1}}', '>{{PROOF_FLAG1}}</div>\n          <div class="find-body">\n            <div class="find-art">{{PROOF_ART1}}'),
    ('>🇨🇿</div>\n          <div class="find-body">\n            <div class="find-art">{{PROOF_ART2}}', '>{{PROOF_FLAG2}}</div>\n          <div class="find-body">\n            <div class="find-art">{{PROOF_ART2}}'),
    ('>🇪🇸</div>\n          <div class="find-body">\n            <div class="find-art">{{PROOF_ART3}}', '>{{PROOF_FLAG3}}</div>\n          <div class="find-body">\n            <div class="find-art">{{PROOF_ART3}}'),
    ('>🇪🇺</div>\n          <div class="find-body">\n            <div class="find-art">{{PROOF_ART4}}', '>{{PROOF_FLAG4}}</div>\n          <div class="find-body">\n            <div class="find-art">{{PROOF_ART4}}'),

    # ═══ FEATURE DESCRIPTIONS ═══
    # Magnus
    ('Jediný AI systém, který prohledá <strong>více právních systémů současně</strong>. Popište případ v libovolném jazyce, vyberte až 3 jurisdikce — Magnus dohledá ověřené články a sestaví srovnávací analýzu. Včetně kolize právních řádů.', '{{MAGNUS_FEAT_DESC}}'),
    # Magnus mock pills
    ('mm-cz">🇨🇿 Česko', 'mm-cz">{{MAGNUS_PILL1}}'),
    ('mm-es">🇪🇸 España', 'mm-es">{{MAGNUS_PILL2}}'),
    # Magnus mock results (4 items) — keep as they use vars from the demo data

    # Judikatura
    ('Popište svůj případ. AI najde nejrelevantnější nálezy Ústavního soudu a rozhodnutí Nejvyššího soudu — podle obsahu, ne klíčových slov.', '{{JURIS_FEAT_DESC}}'),

    # Knihovna
    ('97 zákonů v plném znění. Procházejte hierarchicky — část, hlava, díl, paragraf. Na každém článku <strong>chat s AI</strong>, který rozumí kontextu celého zákona. Generování procesních diagramů jedním kliknutím.', '{{KNIHOVNA_FEAT_DESC}}'),

    # Atlas
    ('Každý § který váš případ podporuje — a každý, který mu odporuje. Atlas sestaví <strong>dialektickou mapu</strong> celého případu a vizualizuje ji jako 3D sluneční soustavu právní gravitace. Vidíte slabiny dříve než oponent.', '{{ATLAS_FEAT_DESC}}'),

    # ═══ JUDIKATURA DEMO RESULTS ═══
    ('21 Cdo 2152/2004', '{{JURIS_R1_CASO}}'),
    ('Nejvyšší soud</div>\n          <div class="jd-ratio">Posudek o pracovní činnosti může obsahovat kromě hodnocení práce zaměstnance rovněž jakékoliv další skutečnosti, jestliže mají vztah k výkonu práce.', '{{JURIS_R1_TRIBUNAL}}</div>\n          <div class="jd-ratio">{{JURIS_R1_RATIO}}'),
    ('31 Cdo 2955/2023', '{{JURIS_R2_CASO}}'),
    ('Nejvyšší soud</div>\n          <div class="jd-ratio">Zaměstnavatel může odstoupit od konkurenční doložky po dobu trvání pracovního poměru zaměstnance i na základě smluvního ujednání.', '{{JURIS_R2_TRIBUNAL}}</div>\n          <div class="jd-ratio">{{JURIS_R2_RATIO}}'),
    ('III.ÚS 84/25', '{{JURIS_R3_CASO}}'),
    ('Ústavní soud · Sala IV</div>\n          <div class="jd-ratio">Nerespektování závěrů kasačního nálezu Ústavního soudu ve věci exekuce na majetek zaměstnance.', '{{JURIS_R3_TRIBUNAL}}</div>\n          <div class="jd-ratio">{{JURIS_R3_RATIO}}'),

    # ═══ MAGNUS DEMO RESULTS ═══
    ('§ 708 · Občanský zákoník', '{{MM_R1_ART}}'),
    ('To, co manželům náleží, má majetkovou hodnotu a není vyloučeno z právních poměrů, je součástí společného jmění manželů.', '{{MM_R1_TXT}}'),
    ('§ 49 · Zákon o mezinárodním právu soukromém', '{{MM_R2_ART}}'),
    ('Osobní poměry manželů se řídí právním řádem státu, jehož jsou oba občany. Jsou-li občany různých států, řídí se právním řádem státu, v němž mají oba obvyklý pobyt.', '{{MM_R2_TXT}}'),
    # MM results 3 and 4 are already from ES data, keep as vars
    ('Art. 9 · Código Civil', '{{MM_R3_ART}}'),
    ('La ley personal correspondiente a las personas físicas es la determinada por su nacionalidad. Dicha ley regirá la capacidad, el estado civil y los derechos y deberes de familia.', '{{MM_R3_TXT}}'),
    ('Art. 1316 · Código Civil', '{{MM_R4_ART}}'),
    ('A falta de capitulaciones o cuando éstas sean ineficaces, el régimen será el de la sociedad de gananciales.', '{{MM_R4_TXT}}'),

    # ═══ HERO CHIPS ═══
    ("fillChip('Propuštění ze zaměstnání')\">Pracovní právo", "fillChip('{{CHIP1_QUERY}}')\">" + "{{CHIP1_LABEL}}"),
    ("fillChip('Náhrada škody, odpovědnost')\">Občanské právo", "fillChip('{{CHIP2_QUERY}}')\">" + "{{CHIP2_LABEL}}"),
    ("fillChip('Trestní oznámení, obhajoba')\">Trestní právo", "fillChip('{{CHIP3_QUERY}}')\">" + "{{CHIP3_LABEL}}"),
    ("fillChip('Smlouva, obchodní spor')\">Obchodní právo", "fillChip('{{CHIP4_QUERY}}')\">" + "{{CHIP4_LABEL}}"),
    ("fillChip('Insolvence, oddlužení')\">Insolvence", "fillChip('{{CHIP5_QUERY}}')\">" + "{{CHIP5_LABEL}}"),

    # ═══ STRIP ═══ (remaining hardcoded ones)
    ('Občanský zákoník</span> · 3 079 §', '{{STRIP1}}'),
    ('Zákoník práce</span> · 396 §', '{{STRIP2}}'),
    ('Zákon o obchodních korporacích</span> · 786 §', '{{STRIP3}}'),
    ('Trestní zákoník</span> · 421 §', '{{STRIP4}}'),
    ('Insolvenční zákon</span> · 434 §', '{{STRIP5}}'),
    ('<span>1 465</span> rozhodnutí soudů ČR', '{{STRIP6}}'),
    ('<span>97</span> zákonů · 19 772 paragrafů', '{{STRIP7}}'),
    ('<span>0</span> halucinací · skutečný text vždy citován', '{{STRIP8}}'),
]

count = 0
for old, new in pairs:
    if old in c:
        c = c.replace(old, new)
        count += 1

with open('templates/index.html', 'w', encoding='utf-8') as f:
    f.write(c)

import re
total_vars = len(re.findall(r'\{\{', c))
print(f'{count} replacements made. Total vars: {total_vars}')

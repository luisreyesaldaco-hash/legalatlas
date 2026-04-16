# -*- coding: utf-8 -*-
# Second pass — catch remaining Czech text in mx/index.html

with open('mx/index.html', 'r', encoding='utf-8') as f:
    c = f.read()

pairs = [
    # CTA button
    ('Vyzkoušet →', 'Empezar →'),
    ('Registrovat se přes Google →', 'Registrarse con Google →'),

    # Chat box labels
    ('Ověřená odpověď · Přesný § · Žádné vymýšlení', 'Respuesta verificada · Art. exacto · Sin invención'),
    ('Položte svůj právní dotaz…', 'Describe tu caso jurídico…'),
    ('Zahájit analýzu', 'Iniciar análisis'),

    # Remaining chips (second set that had different text)
    ("fillChip('Propuštění ze zaměstnání')\">Pracovní právo", "fillChip('Contrato de trabajo, despido')\">Derecho laboral"),
    ("fillChip('Náhrada škody, odpovědnost')\">Občanské právo", "fillChip('Arrendamiento, contratos, herencia')\">Derecho civil"),
    ("fillChip('Smlouva, obchodní spor')\">Obchodní právo", "fillChip('Constitución de sociedad, contratos')\">Derecho mercantil"),

    # Strip
    ('<span>0</span> halucinací · skutečný text vždy citován', '<span>0</span> alucinaciones · texto real siempre citado'),

    # How it works — first card had a different longer Czech text
    ('Popište svou právní situaci vlastními slovy, bez právní terminologie. Naše AI analyzuje význam vašeho dotazu, ne jen klíčová slova.',
     'Describe tu situación jurídica en tus propias palabras, sin terminología legal. Nuestra AI analiza el significado de tu consulta, no solo palabras clave.'),

    # Manifesto
    ('Proč na tom záleží', 'Por qué importa'),
    ('V právu rozhoduje detail. Jeden přehlédnutý paragraf dělí úspěch od <em>prohry.</em>',
     'En el derecho el detalle decide. Un artículo pasado por alto separa el éxito de la <em>derrota.</em>'),
    ('Zatímco ChatGPT jen generuje text, náš AI model <strong>analyzuje právní realitu</strong> — napříč jurisdikcemi současně.',
     'Mientras ChatGPT solo genera texto, nuestra AI <strong>analiza la realidad jurídica</strong> — a través de jurisdicciones simultáneamente.'),
    ('<strong>Náš AI je jedinečný systém, který dokáže simultánně analyzovat více právních systémů v reálném čase.</strong>',
     '<strong>Nuestra AI es un sistema único capaz de analizar simultáneamente múltiples sistemas jurídicos en tiempo real.</strong>'),

    # Corpus cards
    ('Ústavní právo', 'Derecho constitucional'),
    ('Ústava ČR · Listina základních práv a svobod · 588+ nálezů ÚS',
     'Constitución Política · Ley de Amparo · Ley Federal del Trabajo'),

    # Tool card PRO badge
    ('<span class="badge-pro">PRO</span>', '<span class="badge-pro">PRO</span>'),

    # Footer / misc
    ('Veřejná beta', 'Beta pública'),
    ('Spustit analýzu →', 'Iniciar análisis →'),
    ('Začněte analyzovat →', 'Empieza a analizar →'),
    ('Registrovat se →', 'Registrarse →'),
    ('Přihlásit se →', 'Iniciar sesión →'),

    # Generic remaining patterns
    ('českých zákonů', 'leyes mexicanas'),
    ('český zákoník práce', 'Ley Federal del Trabajo'),
    ('českého práva', 'derecho mexicano'),
    ('české právo', 'derecho mexicano'),
    ('České republiky', 'México'),
    ('České republika', 'México'),
    ('česká', 'mexicana'),
    ('český', 'mexicano'),
    ('Česko', 'México'),
]

for old, new in pairs:
    count = c.count(old)
    if count > 0:
        c = c.replace(old, new)
        import sys; sys.stdout.buffer.write(f'  {count}x replaced\n'.encode('utf-8'))

with open('mx/index.html', 'w', encoding='utf-8') as f:
    f.write(c)

print('\nmx/index.html second pass done!')

# -*- coding: utf-8 -*-
# Third pass — remaining Czech text in mx/index.html
import sys

with open('mx/index.html', 'r', encoding='utf-8') as f:
    c = f.read()

pairs = [
    # Tools section — Magnus
    ('Vlajková loď', 'Producto estrella'),
    ('Jediný AI systém na světě, který provádí paralelní RAG přes více právních systémů současně. Popište případ v libovolném jazyce. Vyberte až tři jurisdikce. Magnus dohledá ověřené právo a sestaví mezijurisdiční analýzu — včetně precedentů Ústavního soudu.',
     'El único sistema de AI en el mundo que realiza RAG paralelo a través de múltiples sistemas jurídicos simultáneamente. Describe tu caso en cualquier idioma. Selecciona hasta tres jurisdicciones. Magnus busca el derecho verificado y construye un análisis multijurisdiccional.'),
    ('Až 3 jurisdikce v jednom dotazu', 'Hasta 3 jurisdicciones en una consulta'),
    ('Analýza kolize právních řádů — Řím I, Brusel I bis', 'Análisis de conflicto de leyes — derecho internacional privado'),
    ('Odpovídá v jazyce vašeho dotazu', 'Responde en el idioma de tu consulta'),
    ('Otevřít Magnus →', 'Abrir Magnus →'),

    # Tools — Ciudadano
    ('Právní', 'Asistente'),  # Právní in tool-name
    ('Pro občany a neprávníky. Vstup v přirozeném jazyce. Přesný citovaný článek. Bez právního vzdělání.',
     'Para ciudadanos y no abogados. Entrada en lenguaje natural. Artículo citado con precisión. Sin formación legal necesaria.'),
    ('Přirozený jazyk', 'Lenguaje natural'),
    ('Ověřená citace', 'Cita verificada'),
    ('Vyzkoušet zdarma →', 'Probar gratis →'),

    # Tools — Biblioteca
    ('Chat na úrovni článku', 'Chat a nivel de artículo'),
    ('Analýza procesu', 'Análisis de proceso'),
    ('Otevřít →', 'Abrir →'),

    # Atlas
    ('Připravujeme · Beta', 'En preparación · Beta'),

    # Proof section
    ('Skutečný případ.<br><em>45 sekund.</em>', 'Caso real.<br><em>45 segundos.</em>'),
    ('Případ vyžadující české pracovní právo, španělské pracovní právo, mezinárodní právo soukromé EU — a precedenty Ústavního soudu. Magnus zvládá vše najednou.',
     'Un caso que requiere derecho laboral mexicano, código civil estatal y la Constitución — simultáneamente. Magnus lo resuelve todo de una vez.'),
    ('Případ', 'Caso'),
    ('„Španělský architekt, 5 let v Praze, propuštěn bez výpovědi mexicanom zaměstnavatelem. Tři týdny nevyplacené mzdy. Plánuje se vrátit do Španělska — chce žalovat před odjezdem."',
     '"Ingeniero extranjero, 3 años en CDMX, despedido sin aviso por su empleador. Tres semanas de salario sin pagar. Quiere demandar antes de regresar a su país."'),
    ('Česká republika · Španělsko', 'México · Ley Federal del Trabajo'),
    ('KRITICKÉ ZJIŠTĚNÍ: Český § 72 stanoví 2měsíční lhůtu pro napadení platnosti výpovědi. Španělské právo umožňuje 1 rok. Záměna lhůty = prohra. Magnus to zjistil za 45 sekund.',
     'HALLAZGO CRÍTICO: El Art. 518 de la LFT establece un plazo de 2 meses para impugnar el despido. Dejar pasar el plazo = derrota. Magnus lo encontró en 45 segundos.'),
    ('Co Magnus nalezl · 24 článků · 2 jurisdikce', 'Lo que Magnus encontró · artículos relevantes'),

    # Proof cards
    ('§ 72 · Zákoník práce', 'Art. 47 · Ley Federal del Trabajo'),
    ('2měsíční lhůta pro napadení platnosti výpovědi. Již běží.',
     'Causales de rescisión sin responsabilidad para el patrón. Plazo en curso.'),
    ('§ 141 · Zákoník práce', 'Art. 48 · Ley Federal del Trabajo'),
    ('Mzda splatná bez ohledu na způsob ukončení pracovního poměru.',
     'Reinstalación o indemnización a elección del trabajador.'),
    ('čl. 56 · Estatuto de los Trabajadores', 'Art. 518 · Ley Federal del Trabajo'),
    ('Neoprávněné propuštění: 33 dnů za každý rok trvání poměru.',
     'Prescripción: 2 meses para acciones por despido injustificado.'),
    ('Řím I čl. 8 · Brusel I bis čl. 21', 'Art. 123 · Constitución Política'),
    ('Derecho aplicable: mexicano. Tribunal competente: Junta de Conciliación y Arbitraje.',
     'Derecho aplicable: mexicano. Tribunal competente: Junta de Conciliación y Arbitraje.'),
    ('sel-label', 'sel-label'),

    # Footer
    ('Ceník', 'Precios'),
    ('Legal Atlas je nástroj pro právní výzkum určený právním profesionálům. Generuje obsah s pomocí AI s ověřenými normativními odkazy. Nepředstavuje právní poradenství ani náhradu za nezávislý odborný úsudek.',
     'Legal Atlas es una herramienta de investigación jurídica para profesionales del derecho. Genera contenido con ayuda de AI con referencias normativas verificadas. No constituye asesoría legal ni sustituye el juicio profesional independiente.'),

    # Vyberte svůj nástroj
    ('Vyberte svůj <em>nástroj.</em>', 'Elige tu <em>herramienta.</em>'),

    # Country selector in JS
    ("{value:'CZ',label:'Česká republika'}", "{value:'MX',label:'México'}"),
    ("{value:'ES',label:'Španělsko'}", "{value:'ES',label:'España'}"),
    ("{value:'DE',label:'Německo'}", "{value:'DE',label:'Alemania'}"),
    ("{value:'CH',label:'Švýcarsko'}", "{value:'CH',label:'Suiza'}"),
]

count = 0
for old, new in pairs:
    if old in c and old != new:
        c = c.replace(old, new)
        count += 1

sys.stdout.buffer.write(f'{count} replacements done\n'.encode('utf-8'))

with open('mx/index.html', 'w', encoding='utf-8') as f:
    f.write(c)

sys.stdout.buffer.write(b'mx/index.html third pass done!\n')

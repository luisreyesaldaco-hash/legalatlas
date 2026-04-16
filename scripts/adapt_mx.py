# -*- coding: utf-8 -*-
import re, sys

with open('mx/index.html', 'r', encoding='utf-8') as f:
    c = f.read()

# === HTML lang ===
c = c.replace('lang="cs"', 'lang="es"', 1)

# === Title / meta ===
c = c.replace(
    'Legal Atlas · Česká republika — Navigujte zákon s přehledem',
    'Legal Atlas · México — Navega la ley con precisión'
)
c = c.replace(
    'Legal Atlas je první engine, který čte zákon napříč jurisdikcemi současně. Ne z paměti. Z ověřeného textu.',
    'Legal Atlas es el primer motor que lee la ley de texto verificado. Sin alucinaciones. Con cita exacta.'
)

# === Launch banner ===
c = c.replace(
    'Zkušební období · Bezplatný přístup do 7. května',
    'Periodo de lanzamiento · Acceso gratuito hasta el 7 de mayo'
)

# === Hero ===
c = c.replace('Mozek právní praxe', 'Motor jurídico')
c = c.replace('Najdete v zákoně to, co ostatní přehlédnou', 'Encuentra en la ley lo que otros pasan por alto')

# Hero sub
c = c.replace('<span>97 zákonů</span>', '<span>7 leyes · 32 estados</span>')
c = c.replace('Kompletní a aktuální sbírka českých zákonů', 'Constitución, Código Civil de 32 estados, leyes federales')
c = c.replace('<span>Nulové halucinace AI</span>', '<span>Cero alucinaciones AI</span>')
c = c.replace('Citace konkrétního paragrafu u každé odpovědi', 'Cita del artículo exacto en cada respuesta')

# Chat placeholder
c = c.replace('Popište svůj případ…', 'Describe tu caso…')
c = c.replace('ČESKÁ REPUBLIKA', 'MÉXICO')

# Country code in chat submit
c = c.replace("pais: 'CZ'", "pais: 'MX'")

# Chips
c = c.replace("""fillChip('Pracovní smlouva, výpověď')">Pracovní právo""",
              """fillChip('Contrato de trabajo, despido')">Derecho laboral""")
c = c.replace("""fillChip('Nájem, smlouvy, dědic')">Občanské právo""",
              """fillChip('Arrendamiento, contratos, herencia')">Derecho civil""")
c = c.replace("""fillChip('Trestní oznámení, obhajoba')">Trestní právo""",
              """fillChip('Denuncia penal, defensa')">Derecho penal""")
c = c.replace("""fillChip('Založení s.r.o., smlouvy')">Obchodní právo""",
              """fillChip('Constitución de sociedad, contratos')">Derecho mercantil""")
c = c.replace("""fillChip('Insolvence, oddlužení')">Insolvence""",
              """fillChip('Juicio de amparo, garantías')">Amparo""")

print('phase 1 ok')

# === Strip / ribbon (appears twice each) ===
c = c.replace('Občanský zákoník</span> · 3 079 §', 'Código Civil</span> · 32 estados')
c = c.replace('Zákoník práce</span> · 396 §', 'Ley Federal del Trabajo</span> · 1 150 arts')
c = c.replace('Zákon o obchodních korporacích</span> · 786 §', 'Código de Comercio</span> · 1 530 arts')
c = c.replace('Trestní zákoník</span> · 421 §', 'Código Penal Federal</span> · 480 arts')
c = c.replace('Insolvenční zákon</span> · 434 §', 'Ley de Amparo</span> · 271 arts')
c = c.replace('<span>1 465</span> rozhodnutí soudů ČR', '<span>94 937</span> artículos totales')
c = c.replace('<span>97</span> zákonů · 19 772 paragrafů', '<span>7</span> leyes · 32 estados')

print('phase 2 ok')

# === How it works ===
c = c.replace('Jak to funguje', 'Cómo funciona')
c = c.replace('Zadání právního dotazu', 'Plantea tu consulta')
c = c.replace(
    'Jednoduše popište svou situaci v běžném jazyce. Nemusíte znát právnickou terminologii — systém ji pochopí za vás.',
    'Describe tu situación en lenguaje común. No necesitas terminología jurídica — el sistema la entiende por ti.')
c = c.replace('Analýza sbírky zákonů', 'Análisis del corpus legal')
c = c.replace(
    'Naše AI prohledá 97 českých zákonů v reálném čase. Výsledkem je čistá právní realita bez šumu.',
    'Nuestra AI analiza 7 leyes mexicanas y 32 códigos civiles estatales en tiempo real. Resultado: realidad jurídica sin ruido.')
c = c.replace('Ověřený výstup', 'Resultado verificado')
c = c.replace(
    'Dostanete konkrétní paragraf, název zákona a plné znění článku. Každé tvrzení si tak můžete okamžitě ověřit u zdroje.',
    'Recibes el artículo exacto, el nombre de la ley y el texto completo. Cada afirmación es verificable en la fuente.')

print('phase 3 ok')

# === Manifesto ===
c = c.replace(
    'V právu rozhoduje detail. Naše AI čte zákon — ne wiki, ne shrnutí, ne odpovědi z paměti.',
    'En el derecho el detalle decide. Nuestra AI lee la ley — no wikis, no resúmenes, no respuestas de memoria.')
c = c.replace(
    'Žádný jiný AI systém to nedělá. Žádný.',
    'Ningún otro sistema de AI lo hace. Ninguno.')
c = c.replace(
    'Naše AI je jedinečný systém, který funguje jako víceúrovňový právní motor: na jedné straně stálá databáze plných textů zákonů — na druhé jazykový model, který tento text analyzuje v reálném čase. Bez halucinací. S citací u každé odpovědi.',
    'Nuestra AI es un sistema único que funciona como motor jurídico multinivel: por un lado, una base de datos permanente de textos legales completos — por otro, un modelo de lenguaje que analiza ese texto en tiempo real. Sin alucinaciones. Con cita en cada respuesta.')
c = c.replace(
    'Výpověď španělského architekta pracujícího v Česku. Naše AI v řádu vteřin propojí český zákoník práce, španělské předpisy i evropská nařízení Řím I a Brusel I bis. Současně a bezchybně.',
    'Despido de un ingeniero extranjero en México. Nuestra AI conecta en segundos la Ley Federal del Trabajo, el Código Civil local y la Constitución. Simultáneo e impecable.')

print('phase 4 ok')

# === Corpus ===
c = c.replace(
    '97 českých zákonů.<br><em>19 772 §. Ověřeno.</em>',
    '7 leyes mexicanas.<br><em>94 937 artículos. Verificado.</em>')
c = c.replace(
    'Žádné shrnutí. Žádné výtahy. Celý legislativní text — § po §, zákon po zákoně — strukturovaný pro vyhledávání v reálném čase. Každá odpověď je sledovatelná k přesnému ustanovení platného práva.',
    'Sin resúmenes. Sin extractos. El texto legislativo completo — artículo por artículo, ley por ley — estructurado para búsqueda en tiempo real. Cada respuesta es rastreable al artículo exacto de la ley vigente.')

# Corpus category cards
c = c.replace('Soukromé právo', 'Derecho privado')
c = c.replace('Občanský zákoník · Zákoník práce · Zákon o obchodních korporacích',
              'Código Civil (32 estados) · Código de Comercio · Ley Gral. de Títulos')
c = c.replace('Procesní právo', 'Derecho procesal')
c = c.replace('Občanský soudní řád · Trestní řád · Správní řád · Exekuční řád',
              'Ley de Amparo · Código de Comercio (procedimientos)')
c = c.replace('Trestní právo', 'Derecho penal')
c = c.replace('Trestní zákoník · Trestní řád · Zákon o přestupcích',
              'Código Penal Federal · Ley Federal del Trabajo · Constitución')

print('phase 5 ok')

# === Tools section ===
c = c.replace('Nástroje', 'Herramientas')
c = c.replace('Knihovna', 'Biblioteca')
c = c.replace(
    'Prohlížeč zákonů s kontextovým AI chatem. Tři režimy: článek, zákon, proces.',
    'Visor de leyes con chat AI contextual. Tres modos: artículo, ley, proceso.')
c = c.replace('Plný text zákona', 'Texto completo de la ley')
c = c.replace('Kontext celého zákona', 'Contexto de toda la ley')
c = c.replace('Generování diagramu', 'Generación de diagramas')
c = c.replace('588+ rozhodnutí Ústavního soudu ČR', '94 937 artículos en base de datos')
c = c.replace('Teze vs. antiteze', 'Tesis vs. antítesis')
c = c.replace(
    'Každý zákon, který váš případ podporuje — a každý, který mu odporuje. Vizualizováno jako 3D sluneční soustava právní gravitace.',
    'Cada ley que apoya tu caso — y cada una que lo contradice. Visualizado como sistema solar 3D de gravedad legal.')
c = c.replace('Dialektický právní vesmír', 'Universo legal dialéctico')

print('phase 6 ok')

# === Demo find cards ===
c = c.replace('Jak vás najdou klienti', 'Cómo te encuentran los clientes')
c = c.replace(
    'Španělský architekt pracující v Praze potřebuje pomoc s pracovní smlouvou.',
    'Un ingeniero extranjero trabajando en México necesita ayuda con su contrato laboral.')
c = c.replace('§ 72 · Zákoník práce', 'Art. 20 · Ley Federal del Trabajo')
c = c.replace('§ 141 · Zákoník práce', 'Art. 47 · Ley Federal del Trabajo')
c = c.replace(
    'Právní základ: český zákoník práce. Řízení: případ spadne pod…',
    'Base legal: Ley Federal del Trabajo. Procedimiento: el caso cae bajo…')
c = c.replace(
    'Rozhodné právo: české. Příslušný soud: český. Vykonatelné ve Španělsku.',
    'Derecho aplicable: mexicano. Tribunal competente: Junta de Conciliación y Arbitraje.')
c = c.replace('Pracovní smlouvy', 'Contratos laborales')
c = c.replace('Mezinárodní smlouvy', 'Contratos internacionales')

print('phase 7 ok')

# === Footer ===
c = c.replace('Praha, Česká republika', 'Ciudad de México, México')
c = c.replace('97 zákonů · 1 465 rozhodnutí', '7 leyes · 94 937 artículos')
c = c.replace('Postaveno s\u00a0respektem k\u00a0právu.', 'Construido con respeto por el derecho.')

# Nav links: change ?lang=cs to ?lang=es
c = c.replace('?lang=cs', '?lang=es')

# === Judikatura → Jurisprudencia ===
c = c.replace('Judikatura', 'Jurisprudencia')
# Account
c = c.replace('Účet', 'Cuenta')

print('phase 8 ok')

with open('mx/index.html', 'w', encoding='utf-8') as f:
    f.write(c)

print('\nmx/index.html done!')

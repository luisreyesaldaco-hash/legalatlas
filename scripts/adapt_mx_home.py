# -*- coding: utf-8 -*-
# Adapt CZ homepage to MX homepage
import sys

with open('mx/index.html', 'r', encoding='utf-8') as f:
    c = f.read()

# ═══ HTML lang ═══
c = c.replace('lang="cs"', 'lang="es"', 1)

# ═══ Title / meta ═══
c = c.replace('Legal Atlas · Česko — Najděte přesný § za 30 sekund',
              'Legal Atlas · México — Encuentra el artículo exacto en segundos')
c = c.replace('97 zákonů, 19 772 paragrafů, 1 465 rozhodnutí',
              '7 leyes, 94 937 artículos, 32 estados')

# ═══ Nav links ═══
c = c.replace('/cz/abogado.html', '/mx/abogado.html')
c = c.replace('/cz/jurisprudencia.html', '/mx/jurisprudencia.html')
c = c.replace('/cz/magnus.html', '/mx/magnus.html')
c = c.replace('/cz/atlas.html', '/mx/atlas.html')
c = c.replace('/cz/cuenta.html', '/mx/cuenta.html')
c = c.replace('/cz/selector.html', '/mx/selector.html')
c = c.replace('href="/cz/"', 'href="/mx/"')
c = c.replace("localStorage.setItem('la-locale','en')", "localStorage.setItem('la-locale','en')")

# Nav labels
c = c.replace('>Knihovna<', '>Biblioteca<')
c = c.replace('>Judikatura<', '>Jurisprudencia<')
c = c.replace('>Účet<', '>Cuenta<')

# ═══ Hero ═══
c = c.replace('Mozek právní praxe', 'Motor jurídico')
c = c.replace('Najděte přesný § <em>za pár minut</em>', 'Encuentra el artículo exacto <em>en minutos</em>')
c = c.replace('<span>97 zákonů</span>', '<span>7 leyes · 32 estados</span>')
c = c.replace('Kompletní a aktuální sbírka českých zákonů', 'Constitución, Código Civil de 32 estados, leyes federales')
c = c.replace('<span>Nulové halucinace AI</span>', '<span>Cero alucinaciones AI</span>')
c = c.replace('Citace konkrétního paragrafu u každé odpovědi', 'Cita del artículo exacto en cada respuesta')

# ═══ Hero demo — 3 queries ═══
# Query 1
c = c.replace("'Soused prodal nemovitost, ale já mám předkupní právo. Jaká jsou moje práva?'",
              "'Mi patrón me despidió sin justificación después de 5 años. ¿Cuáles son mis derechos?'")
# Results 1
c = c.replace("tag:'Listina', cls:'tag-ustava', art:'Čl. 11 · Listina základních práv a svobod'",
              "tag:'Constitución', cls:'tag-ustava', art:'Art. 123 · Constitución Política'")
c = c.replace("text:'Každý má právo vlastnit majetek. Vlastnické právo všech vlastníků má stejný zákonný obsah a ochranu. Dědění se zaručuje.'",
              "text:'Toda persona tiene derecho al trabajo digno y socialmente útil; se promoverán la creación de empleos y la organización social de trabajo.'")
c = c.replace("tag:'Občanský zákoník', cls:'tag-civil', art:'§ 2140 · Občanský zákoník'",
              "tag:'Ley Federal del Trabajo', cls:'tag-civil', art:'Art. 48 · Ley Federal del Trabajo'")
c = c.replace("text:'Ujedná-li si předkupník k věci předkupní právo, vzniká dlužníku povinnost nabídnout věc předkupníkovi ke koupi, pokud by ji chtěl prodat třetí osobě (koupěchtivému).'",
              "text:'El trabajador podrá solicitar ante la Autoridad Conciliadora que se le reinstale en el trabajo o que se le indemnice con el importe de tres meses de salario.'")
c = c.replace("tag:'Občanský zákoník', cls:'tag-civil', art:'§ 2144 · Občanský zákoník'",
              "tag:'Ley Federal del Trabajo', cls:'tag-civil', art:'Art. 518 · Ley Federal del Trabajo'")
c = c.replace("text:'Je-li předkupní právo zřízeno jako právo věcné, opravňuje předkupníka domáhat se vůči nástupci druhé strany, jenž věc nabyl koupí, aby mu věc za příslušnou úplatu převedl.'",
              "text:'Prescriben en dos meses las acciones de los trabajadores que sean separados del trabajo.'")

# Query 2
c = c.replace("'Zaměstnavatel mi nevyplatil mzdu za poslední 2 měsíce. Co můžu dělat?'",
              "'El arrendador quiere aumentar la renta un 40%. ¿Es legal en CDMX?'")
c = c.replace("tag:'Zákoník práce', cls:'tag-civil', art:'§ 141 · Zákoník práce', text:'Mzda nebo plat jsou splatné po vykonání práce, a to nejpozději v kalendářním měsíci následujícím po měsíci, ve kterém vzniklo zaměstnanci právo na mzdu nebo plat.'",
              "tag:'Código Civil CDMX', cls:'tag-civil', art:'Art. 2448-D · Código Civil CDMX', text:'La renta debe ser fijada en cantidad líquida. Su incremento anual no podrá exceder del porcentaje de inflación reportado por el Banco de México.'")
c = c.replace("tag:'Zákoník práce', cls:'tag-civil', art:'§ 56 · Zákoník práce', text:'Zaměstnanec může pracovní poměr okamžitě zrušit jen, jestliže mu zaměstnavatel nevyplatil mzdu nebo plat nebo náhradu mzdy nebo platu anebo jakoukoli jejich část do 15 dnů po uplynutí období splatnosti.'",
              "tag:'Código Civil CDMX', cls:'tag-civil', art:'Art. 2448-C · Código Civil CDMX', text:'La duración mínima de todo contrato de arrendamiento de fincas urbanas destinadas a la habitación será de un año.'")
c = c.replace("tag:'Zákoník práce', cls:'tag-civil', art:'§ 142 · Zákoník práce', text:'Mzdu nebo plat je zaměstnavatel povinen zaměstnanci vyplácet v zákonných penězích. Mzda nebo plat se zaokrouhlují na celé koruny směrem nahoru.'",
              "tag:'Constitución', cls:'tag-ustava', art:'Art. 4 · Constitución Política', text:'Toda familia tiene derecho a disfrutar de vivienda digna y decorosa. La Ley establecerá los instrumentos y apoyos necesarios.'")

# Query 3
c = c.replace("'Pronajímatel mi chce zvýšit nájem o 40 %. Je to legální?'",
              "'Me vendieron un carro con vicios ocultos. ¿Puedo anular la compraventa?'")
c = c.replace("tag:'Občanský zákoník', cls:'tag-civil', art:'§ 2249 · Občanský zákoník', text:'Pronajímatel může navrhnout nájemci zvýšení nájemného až do výše srovnatelného nájemného obvyklého v daném místě, pokud navržené zvýšení spolu s tím, k němuž již došlo v posledních třech letech, nepřesáhne dvacet procent.'",
              "tag:'Código de Comercio', cls:'tag-civil', art:'Art. 383 · Código de Comercio', text:'Las ventas mercantiles no se rescindirán por causa de lesión; pero al perjudicado se le concederá acción para reclamar daños y perjuicios.'")
c = c.replace("tag:'Občanský zákoník', cls:'tag-civil', art:'§ 2250 · Občanský zákoník', text:'Provede-li pronajímatel stavební úpravy, které trvale zlepšují užitnou hodnotu pronajatého bytu, může se s nájemci dohodnout o zvýšení nájemného, nejvýše však o deset procent z účelně vynaložených nákladů.'",
              "tag:'Código Civil CDMX', cls:'tag-civil', art:'Art. 2142 · Código Civil CDMX', text:'La acción redhibitoria tiene lugar cuando la cosa vendida tiene vicios o defectos graves que la hagan impropia para los usos a que se la destina.'")
c = c.replace("tag:'Občanský zákoník', cls:'tag-civil', art:'§ 2248 · Občanský zákoník', text:'Strany si mohou ujednat každoroční zvyšování nájemného.'",
              "tag:'Ley de Amparo', cls:'tag-juris', art:'Art. 1 · Ley de Amparo', text:'El juicio de amparo tiene por objeto resolver toda controversia que se suscite por normas generales, actos u omisiones de autoridad que violen derechos humanos.'")

# ═══ Strip ═══
c = c.replace('Občanský zákoník</span> · 3 079 §', 'Constitución</span> · 333 arts')
c = c.replace('Zákoník práce</span> · 396 §', 'Ley Federal del Trabajo</span> · 1 150 arts')
c = c.replace('Zákon o obchodních korporacích</span> · 786 §', 'Código de Comercio</span> · 1 530 arts')
c = c.replace('Trestní zákoník</span> · 421 §', 'Código Penal Federal</span> · 480 arts')
c = c.replace('Insolvenční zákon</span> · 434 §', 'Ley de Amparo</span> · 271 arts')
c = c.replace('<span>1 465</span> rozhodnutí soudů ČR', '<span>94 937</span> artículos totales')
c = c.replace('<span>97</span> zákonů · 19 772 paragrafů', '<span>7</span> leyes · 32 estados')
c = c.replace('<span>0</span> halucinací · skutečný text vždy citován', '<span>0</span> alucinaciones · texto real siempre citado')

# ═══ Checklist ═══
c = c.replace('Co Legal Atlas umí', 'Qué puede hacer Legal Atlas')
c = c.replace('Vše, co potřebujete pro <em>právní výzkum.</em>', 'Todo lo que necesitas para <em>investigación jurídica.</em>')
c = c.replace('Prohledá 97 zákonů v reálném čase — za sekundy, ne hodiny', 'Busca en 7 leyes y 32 códigos civiles en tiempo real — en segundos')
c = c.replace('Cituje přesný § s plným zněním u každé odpovědi', 'Cita el artículo exacto con texto completo en cada respuesta')
c = c.replace('Porovná až 3 právní řády současně v jednom dotazu', 'Compara hasta 3 sistemas jurídicos simultáneamente en una consulta')
c = c.replace('Najde nejrelevantnější soudní rozhodnutí k vašemu případu', 'Encuentra las resoluciones judiciales más relevantes para tu caso')
c = c.replace('Zeptejte se na svůj případ — AI konzultuje celou legislativu', 'Pregunta sobre tu caso — la AI consulta toda la legislación aplicable')
c = c.replace('Ptejte se v češtině, odpovědi i z německého či španělského práva', 'Pregunta en español, respuestas también del derecho checo, alemán o francés')
c = c.replace('Přístup k 1 465 rozhodnutím Ústavního a Nejvyššího soudu', 'Acceso a 94 937 artículos verificados en la base de datos')
c = c.replace('Nulové halucinace — každá odpověď je ověřitelná u zdroje', 'Cero alucinaciones — cada respuesta es verificable en la fuente')
c = c.replace('Procházejte zákon hierarchicky — část, hlava, díl, paragraf', 'Navega la ley jerárquicamente — libro, título, capítulo, artículo')
c = c.replace('Generování procesních diagramů z právní struktury', 'Generación de diagramas de proceso desde la estructura legal')

# ═══ Proof section ═══
c = c.replace('Magnus v akci', 'Magnus en acción')
c = c.replace('Skutečný případ.<br><em>45 sekund.</em>', 'Caso real.<br><em>45 segundos.</em>')
c = c.replace('Případ vyžadující české pracovní právo, španělské pracovní právo, mezinárodní právo soukromé EU — a precedenty Ústavního soudu. Magnus zvládá vše najednou.',
              'Un caso que requiere derecho laboral mexicano, código civil estatal y la Constitución — simultáneamente. Magnus lo resuelve todo de una vez.')
c = c.replace('Případ', 'Caso')
c = c.replace('„Španělský architekt, 5 let v Praze, propuštěn bez výpovědi českým zaměstnavatelem. Tři týdny nevyplacené mzdy. Plánuje se vrátit do Španělska — chce žalovat před odjezdem."',
              '"Ingeniero extranjero, 3 años en CDMX, despedido sin aviso. Tres semanas de salario sin pagar. Quiere demandar antes de regresar a su país."')
c = c.replace('Česká republika · Španělsko', 'México · Ley Federal del Trabajo')
c = c.replace('KRITICKÉ ZJIŠTĚNÍ: Český § 72 stanoví 2měsíční lhůtu pro napadení platnosti výpovědi. Španělské právo umožňuje 1 rok. Záměna lhůty = prohra. Magnus to zjistil za 45 sekund.',
              'HALLAZGO CRÍTICO: El Art. 518 de la LFT establece un plazo de 2 meses para impugnar el despido. Dejar pasar el plazo = derrota. Magnus lo encontró en 45 segundos.')
c = c.replace('Co Magnus nalezl · 24 článků · 2 jurisdikce', 'Lo que Magnus encontró · artículos relevantes')
c = c.replace('§ 72 · Zákoník práce', 'Art. 47 · Ley Federal del Trabajo')
c = c.replace('2měsíční lhůta pro napadení platnosti výpovědi. Již běží.', 'Causales de rescisión sin responsabilidad para el patrón.')
c = c.replace('§ 141 · Zákoník práce', 'Art. 48 · Ley Federal del Trabajo')
c = c.replace('Mzda splatná bez ohledu na způsob ukončení pracovního poměru.', 'Reinstalación o indemnización a elección del trabajador.')
c = c.replace('čl. 56 · Estatuto de los Trabajadores', 'Art. 518 · Ley Federal del Trabajo')
c = c.replace('Neoprávněné propuštění: 33 dnů za každý rok trvání poměru.', 'Prescripción: 2 meses para acciones por despido.')
c = c.replace('Řím I čl. 8 · Brusel I bis čl. 21', 'Art. 123 · Constitución Política')
c = c.replace('Rozhodné právo: české. Příslušný soud: český. Vykonatelné ve Španělsku.', 'Derecho al trabajo digno. Tribunal competente: Junta de Conciliación y Arbitraje.')

# ═══ Feature rows ═══
# Magnus
c = c.replace('Popište případ.<br>Magnus najde <em>právo.</em>', 'Describe tu caso.<br>Magnus encuentra <em>el derecho.</em>')
c = c.replace('Jediný AI systém, který prohledá <strong>více právních systémů současně</strong>. Popište případ v libovolném jazyce, vyberte až 3 jurisdikce — Magnus dohledá ověřené články a sestaví srovnávací analýzu. Včetně kolize právních řádů.',
              'El único sistema de AI que busca en <strong>múltiples sistemas jurídicos simultáneamente</strong>. Describe tu caso en cualquier idioma, selecciona hasta 3 jurisdicciones — Magnus encuentra los artículos verificados y construye un análisis comparativo.')
c = c.replace('Otevřít Magnus →', 'Abrir Magnus →')
c = c.replace('Porovnat →', 'Comparar →')

# Knihovna
c = c.replace('Celý zákon.<br><em>Článek po článku.</em>', 'La ley completa.<br><em>Artículo por artículo.</em>')
c = c.replace('97 zákonů v plném znění. Procházejte hierarchicky — část, hlava, díl, paragraf. Na každém článku <strong>chat s AI</strong>, který rozumí kontextu celého zákona. Generování procesních diagramů jedním kliknutím.',
              '7 leyes en texto completo. Navega jerárquicamente — libro, título, capítulo, artículo. En cada artículo <strong>chat con AI</strong> que entiende el contexto de toda la ley. Generación de diagramas de proceso con un clic.')
c = c.replace('Otevřít Knihovnu →', 'Abrir Biblioteca →')

# Atlas
c = c.replace('Teze vs. <em>antiteze.</em><br>Vizuálně.', 'Tesis vs. <em>antítesis.</em><br>Visual.')
c = c.replace('Každý § který váš případ podporuje — a každý, který mu odporuje. Atlas sestaví <strong>dialektickou mapu</strong> celého případu a vizualizuje ji jako 3D sluneční soustavu právní gravitace. Vidíte slabiny dříve než oponent.',
              'Cada artículo que apoya tu caso — y cada uno que lo contradice. Atlas construye un <strong>mapa dialéctico</strong> del caso completo y lo visualiza como sistema solar 3D de gravedad legal. Ves las debilidades antes que tu oponente.')
c = c.replace('Prozkoumat Atlas →', 'Explorar Atlas →')
c = c.replace('Teze — pro vás', 'Tesis — a tu favor')
c = c.replace('Antiteze — proti vám', 'Antítesis — en tu contra')

# Judikatura
c = c.replace('29 491 rozhodnutí.<br><em>Najděte to své.</em>', '94 937 artículos.<br><em>Encuentra el tuyo.</em>')
c = c.replace('Popište svůj případ. AI najde nejrelevantnější nálezy Ústavního soudu a rozhodnutí Nejvyššího soudu — podle obsahu, ne klíčových slov.',
              'Describe tu caso. La AI encuentra los artículos más relevantes de la Constitución, códigos civiles y leyes federales — por contenido, no palabras clave.')
c = c.replace('Prohledat judikaturu →', 'Buscar artículos →')

# ═══ CTA final ═══
c = c.replace('Žádný jiný AI systém to nedělá.', 'Ningún otro sistema de AI lo hace.')
c = c.replace('97 zákonů · 19 772 § · Plný text · Citace · Nulové halucinace · Zdarma',
              '7 leyes · 94 937 artículos · Texto completo · Citación · Cero alucinaciones · Gratis')
c = c.replace('Vyzkoušet zdarma →', 'Probar gratis →')

# ═══ Footer ═══
c = c.replace('Právní motor pro profesionály. Postaveno s\xa0respektem k\xa0právu.', 'Motor jurídico para profesionales. Construido con respeto por el derecho.')
c = c.replace('contact@legalatlas.io →', 'contact@legalatlas.io →')
c = c.replace('Nástroje', 'Herramientas')
c = c.replace('Jurisdikce', 'Jurisdicciones')
c = c.replace('Databáze', 'Base de datos')
c = c.replace('Společnost', 'Empresa')
c = c.replace('97 zákonů', '7 leyes')
c = c.replace('19 772 paragrafů', '94 937 artículos')
c = c.replace('29 491 rozhodnutí', '32 estados')
c = c.replace('7 jurisdikcí', '7 jurisdicciones')
c = c.replace('English version', 'English version')
c = c.replace('Ceník', 'Precios')
c = c.replace('Kniha (EN)', 'Libro (EN)')
c = c.replace('Kniha (ES)', 'Libro (ES)')
c = c.replace('Praha, Česko', 'Ciudad de México, México')
c = c.replace('Podmínky', 'Términos')
c = c.replace('Ochrana údajů', 'Privacidad')
c = c.replace('Pravidla užívání', 'Uso aceptable')
c = c.replace('Legal Atlas je nástroj pro právní výzkum určený právním profesionálům. Generuje obsah s pomocí AI s ověřenými normativními odkazy. Nepředstavuje právní poradenství ani náhradu za nezávislý odborný úsudek.',
              'Legal Atlas es una herramienta de investigación jurídica para profesionales del derecho. Genera contenido con ayuda de AI con referencias normativas verificadas. No constituye asesoría legal ni sustituye el juicio profesional independiente.')

# ═══ Chat country default ═══
c = c.replace("fPais.value = 'CZ'", "fPais.value = 'MX'")
c = c.replace("pais: 'CZ'", "pais: 'MX'")
c = c.replace("🇨🇿 Česko", "🇲🇽 México")

# ═══ Kontakt ═══
c = c.replace('>Kontakt<', '>Contacto<')

with open('mx/index.html', 'w', encoding='utf-8') as f:
    f.write(c)

print('mx/index.html adapted!')

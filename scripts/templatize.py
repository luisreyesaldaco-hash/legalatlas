# -*- coding: utf-8 -*-
# Converts the copied HTML files in templates/ to use {{VAR}} placeholders.
# Run once to set up the templates.
import sys

def templatize(fname, replacements):
    path = f'templates/{fname}'
    with open(path, 'r', encoding='utf-8') as f:
        c = f.read()
    for old, new in replacements:
        count = c.count(old)
        if count > 0:
            c = c.replace(old, new)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(c)
    sys.stdout.buffer.write(f'{fname}: done\n'.encode('utf-8'))

# ── Common nav replacements (all pages have topbar + sidebar) ──
nav_replacements = [
    # Topbar logo → country home
    ('href="index.html" class="topbar-logo"', 'href="{{HOME}}" class="topbar-logo"'),
    ('href="index.html" class="topbar-logo" id="logo-link"', 'href="{{HOME}}" class="topbar-logo"'),
    # Sidebar logo
    ('href="index.html" class="sidebar-logo"', 'href="{{HOME}}" class="sidebar-logo"'),
    ('href="index.html" class="sidebar-logo" id="sidebar-logo-link"', 'href="{{HOME}}" class="sidebar-logo"'),
    # Nav links with data-i18n (replace text AND remove data-i18n since we hardcode now)
    (' data-i18n="nav.abogado">Biblioteca</a>', '>{{NAV_BIBLIOTECA}}</a>'),
    ('>Biblioteca</a>', '>{{NAV_BIBLIOTECA}}</a>'),
    (' data-i18n="nav.juris">Judikatura</a>', '>{{NAV_JUDIKATURA}}</a>'),
    ('>Judikatura</a>', '>{{NAV_JUDIKATURA}}</a>'),
    (' data-i18n="nav.marco">Magnus</a>', '>{{NAV_MAGNUS}}</a>'),
    ('>Magnus</a>', '>{{NAV_MAGNUS}}</a>'),
    (' data-i18n="nav.atlas">Atlas</a>', '>{{NAV_ATLAS}}</a>'),
    ('>Atlas</a>', '>{{NAV_ATLAS}}</a>'),
    (' data-i18n="nav.cuenta">Mi Cuenta</a>', '>{{NAV_CUENTA}}</a>'),
    ('>Mi Cuenta</a>', '>{{NAV_CUENTA}}</a>'),
    # Page links: add lang param
    ('href="abogado.html"', 'href="{{HOME}}abogado.html"'),
    ('href="jurisprudencia.html"', 'href="{{HOME}}jurisprudencia.html"'),
    ('href="magnus.html"', 'href="{{HOME}}magnus.html"'),
    ('href="atlas.html"', 'href="{{HOME}}atlas.html"'),
    ('href="cuenta.html"', 'href="{{HOME}}cuenta.html"'),
    # i18n script: no longer needed for country pages since text is hardcoded
    # But keep it for JS dynamic content that still needs translations
]

# ── abogado.html ──
abogado_extra = [
    # Banner
    ('data-i18n="abogado.banner">Período de lanzamiento · Acceso gratuito hasta el 7 de mayo</span>',
     '>{{BANNER_TEXT}}</span>'),
    ('data-i18n="abogado.acceso.cta">Solicitar acceso →</a>',
     '>{{BANNER_CTA}}</a>'),
    # Left panel labels
    ('data-i18n="abogado.pais">País</div>', '>{{LABEL_PAIS}}</div>'),
    ('data-i18n="abogado.ley">Ley</div>', '>{{LABEL_LEY}}</div>'),
    ('data-i18n="abogado.estado">Estado</div>', '>{{LABEL_ESTADO}}</div>'),
    ('data-i18n="abogado.buscar">Buscar artículo</div>', '>{{LABEL_BUSCAR}}</div>'),
    ('data-i18n="abogado.cargando">Cargando…</option>', '>{{CARGANDO}}</option>'),
    ('data-i18n="abogado.sel.pais">Selecciona un país</option>', '>{{SELECT_PAIS}}</option>'),
    ('data-i18n="abogado.sel.estados">Todos los estados…</option>', '>{{SELECT_ESTADOS}}</option>'),
    ('data-i18n-placeholder="abogado.buscar.placeholder"', 'placeholder="{{BUSCAR_PLACEHOLDER}}"'),
    ('data-i18n-title="abogado.bookmark.title"', 'title="{{BOOKMARK_TITLE}}"'),
    ('data-i18n="abogado.mis_leyes">☆ Mis Leyes</div>', '>{{MIS_LEYES}}</div>'),
    # Center
    ('data-i18n-html="abogado.nav.empty">Selecciona un país<br>y una ley</div>', '>{{NAV_EMPTY}}</div>'),
    ('data-i18n="abogado.centro.vacio">Selecciona un artículo del navegador</div>', '>{{CENTRO_VACIO}}</div>'),
    # Buttons
    ('data-i18n="abogado.explicar">✦ Explícame este capítulo</button>', '>{{EXPLICAR_CAPITULO}}</button>'),
    ('data-i18n="abogado.redactar">✍ Redactar con este artículo</a>', '>{{REDACTAR_CON}}</a>'),
    ('data-i18n="abogado.wb.back">← Volver al artículo</button>', '>{{WB_BACK}}</button>'),
    ('data-i18n="abogado.wb.generando">Generando diagrama…</span>', '>{{WB_GENERANDO}}</span>'),
    ('data-i18n="abogado.wb.caption">Generando…</div>', '>{{WB_GENERANDO}}</div>'),
    # Chat
    ('data-i18n="abogado.chat.vacio">Sin artículo activo</div>', '>{{CHAT_VACIO}}</div>'),
    ('data-i18n-placeholder="abogado.chat.placeholder"', 'placeholder="{{CHAT_PLACEHOLDER}}"'),
    ('data-i18n="abogado.ctx.articulo">Este artículo</button>', '>{{CTX_ARTICULO}}</button>'),
    ('data-i18n="abogado.ctx.ley">Esta ley</button>', '>{{CTX_LEY}}</button>'),
    ('data-i18n="abogado.ctx.comparar">Comparar estados</button>', '>{{CTX_COMPARAR}}</button>'),
    ('data-i18n="abogado.ctx.proceso">⟳ Proceso</button>', '>{{CTX_PROCESO}}</button>'),
    # Href to ciudadano (keep as root path, not country-specific for now)
    ('href="ciudadano.html"', 'href="/ciudadano.html"'),
]

templatize('abogado.html', nav_replacements + abogado_extra)

# ── magnus.html ──
magnus_extra = [
    ('data-i18n="magnus.placeholder"', 'placeholder="{{MAGNUS_PLACEHOLDER}}"'),
]
templatize('magnus.html', nav_replacements + magnus_extra)

# ── atlas.html ──
atlas_extra = []
templatize('atlas.html', nav_replacements + atlas_extra)

# ── jurisprudencia.html ──
juris_extra = []
templatize('jurisprudencia.html', nav_replacements + juris_extra)

# ── cuenta.html ──
cuenta_extra = []
templatize('cuenta.html', nav_replacements + cuenta_extra)

print('\nAll templates ready.')

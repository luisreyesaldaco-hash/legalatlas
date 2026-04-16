/**
 * Legal Atlas — i18n loader
 * Detecta idioma del navegador → carga JSON → aplica data-i18n attrs
 * Expone: window.t(key, vars?, fallback?) y window.setLang(lang)
 */
(function () {
  const SUPPORTED = ['es', 'cs', 'fr', 'en'];
  const DEFAULT   = 'es';
  let   _t        = {};

  // ── Detección ──────────────────────────────────────────────────
  function detectLang() {
    // 1. URL param takes priority — e.g. ?lang=cs from /cz/ landing page
    const urlLang = new URLSearchParams(window.location.search).get('lang');
    if (urlLang && SUPPORTED.includes(urlLang)) {
      localStorage.setItem('atlas_lang', urlLang);
      return urlLang;
    }
    // 2. Saved preference
    const saved = localStorage.getItem('atlas_lang');
    if (saved && SUPPORTED.includes(saved)) return saved;
    // 3. Browser language
    const nav = (navigator.language || 'es').slice(0, 2).toLowerCase();
    return SUPPORTED.includes(nav) ? nav : DEFAULT;
  }

  // ── Carga JSON ─────────────────────────────────────────────────
  async function loadJSON(lang) {
    try {
      const res = await fetch('/locales/' + lang + '.json');
      if (!res.ok) throw new Error('404');
      return await res.json();
    } catch {
      return lang === DEFAULT ? {} : loadJSON(DEFAULT);
    }
  }

  // ── Aplicar al DOM ─────────────────────────────────────────────
  function apply(t) {
    // Texto plano
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const v = t[el.dataset.i18n];
      if (v !== undefined) el.textContent = v;
    });
    // HTML interno (para elementos con <br>, <strong>, <span>)
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
      const v = t[el.dataset.i18nHtml];
      if (v !== undefined) el.innerHTML = v;
    });
    // Placeholders de inputs / textareas
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const v = t[el.dataset.i18nPlaceholder];
      if (v !== undefined) el.placeholder = v;
    });
    // Atributos title
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const v = t[el.dataset.i18nTitle];
      if (v !== undefined) el.title = v;
    });
    // Reveal page if it was hidden to prevent lang flash
    if (document.documentElement.style.opacity === '0') {
      document.documentElement.style.opacity = '1';
    }
    // Signal that translations are ready
    window._i18nLoaded = true;
    document.dispatchEvent(new Event('i18n:ready'));
    // Marcar botón activo y actualizar indicador en el globo
    const current = localStorage.getItem('atlas_lang') || detectLang();
    document.querySelectorAll('[data-lang-btn]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.langBtn === current);
    });
    const langEl = document.getElementById('lang-current');
    if (langEl) langEl.textContent = current.toUpperCase();
  }

  // ── API pública ────────────────────────────────────────────────

  /**
   * t('key') → string traducida
   * t('key', { pais: 'México' }) → con interpolación de {variables}
   * t('key', null, 'fallback') → fallback si no existe la key
   */
  window.t = function (key, vars, fallback) {
    let str = _t[key] !== undefined ? _t[key] : (fallback !== undefined ? fallback : key);
    if (vars && str) {
      Object.entries(vars).forEach(([k, v]) => {
        str = str.replace(new RegExp('\\{' + k + '\\}', 'g'), v || '');
      });
    }
    return str;
  };

  /** Cambia idioma manualmente y lo guarda en localStorage */
  window.setLang = async function (lang) {
    if (!SUPPORTED.includes(lang)) return;
    localStorage.setItem('atlas_lang', lang);
    _t = await loadJSON(lang);
    apply(_t);
  };

  // ── Init ───────────────────────────────────────────────────────
  (async function init() {
    const lang = detectLang();
    _t = await loadJSON(lang);
    apply(_t);

    // ── CZ home navigation ────────────────────────────────────────
    // Si el usuario tiene locale CZ o ?lang=cs, los links "home" apuntan a /cz/
    const locale  = localStorage.getItem('la-locale');
    const urlLang = new URLSearchParams(window.location.search).get('lang');
    if (locale === 'CZ' || urlLang === 'cs') {
      const homePatterns = ['/', '/index.html', 'index.html'];
      document.querySelectorAll('a').forEach(a => {
        if (homePatterns.includes(a.getAttribute('href'))) {
          a.setAttribute('href', '/cz/');
        }
      });
    }
  })();

  // ── CSS del switcher (inyectado una sola vez) ──────────────────
  const style = document.createElement('style');
  style.textContent = [
    '.lang-switcher{position:relative;display:inline-flex;align-items:center}',
    '.lang-globe-btn{background:none;border:1px solid transparent;border-radius:8px;cursor:pointer;',
    'padding:5px 7px;color:var(--text-muted,#7A6E60);transition:all .2s;display:flex;align-items:center;line-height:1}',
    '.lang-globe-btn:hover{border-color:rgba(196,154,60,.35);color:var(--gold,#c49a3c)}',
    '.lang-dropdown{display:none;position:absolute;top:calc(100% + 8px);right:0;',
    'background:var(--bg-card,#FDFAF5);border:1px solid var(--border,#DDD0B4);',
    'border-radius:10px;box-shadow:0 8px 24px rgba(26,20,16,0.12);overflow:hidden;z-index:300;min-width:148px}',
    '.lang-dropdown.open{display:block}',
    '.lang-option{display:flex;align-items:center;gap:9px;width:100%;background:none;border:none;',
    'padding:10px 14px;font-family:"Cinzel",serif;font-size:10px;letter-spacing:.12em;',
    'color:var(--text-secondary,#3D342A);cursor:pointer;text-align:left;transition:background .15s;white-space:nowrap}',
    '.lang-option:hover{background:var(--bg-elevated,#EBE0C8)}',
    '.lang-option.active{color:var(--gold,#c49a3c);font-weight:600}',
    '.lang-current{font-family:"Cinzel",serif;font-size:8px;letter-spacing:.1em;margin-left:3px;line-height:1}'
  ].join('');
  document.head.appendChild(style);

  // ── Dropdown UI helpers ────────────────────────────────────────────────────
  window.toggleLangDropdown = function() {
    var d = document.getElementById('lang-dropdown');
    if (d) d.classList.toggle('open');
  };
  window.closeLangDropdown = function() {
    var d = document.getElementById('lang-dropdown');
    if (d) d.classList.remove('open');
  };
  document.addEventListener('click', function(e) {
    if (!e.target.closest || !e.target.closest('#lang-switcher')) {
      window.closeLangDropdown();
    }
  });
})();

/**
 * Legal Atlas — i18n loader
 * Detecta idioma del navegador → carga JSON → aplica data-i18n attrs
 * Expone: window.t(key, vars?, fallback?) y window.setLang(lang)
 */
(function () {
  const SUPPORTED = ['es', 'cs', 'fr'];
  const DEFAULT   = 'es';
  let   _t        = {};

  // ── Detección ──────────────────────────────────────────────────
  function detectLang() {
    const saved = localStorage.getItem('atlas_lang');
    if (saved && SUPPORTED.includes(saved)) return saved;
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
    // Marcar botón activo
    const current = localStorage.getItem('atlas_lang') || detectLang();
    document.querySelectorAll('[data-lang-btn]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.langBtn === current);
    });
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
  })();

  // ── CSS del switcher (inyectado una sola vez) ──────────────────
  const style = document.createElement('style');
  style.textContent = [
    '.lang-switcher{display:flex;gap:4px;align-items:center}',
    '.lang-btn{font-family:"Cinzel",serif;font-size:9px;letter-spacing:.15em;',
    'color:rgba(245,237,216,.35);background:none;border:1px solid transparent;',
    'border-radius:6px;padding:4px 8px;cursor:pointer;transition:all .2s ease}',
    '.lang-btn:hover,.lang-btn.active{color:#c49a3c;border-color:rgba(196,154,60,.35)}'
  ].join('');
  document.head.appendChild(style);
})();

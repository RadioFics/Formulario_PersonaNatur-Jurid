/**
 * utils.js — Utilidades compartidas entre todas las secciones del formulario
 *
 * Contiene:
 *  · cargarCatalogo()   — puebla un <select> desde un endpoint REST
 *  · cargarDatalist()   — puebla un <datalist> (búsqueda CIIU)
 *  · toggleAccordion()  — colapsa / expande un acordeón por ID
 *  · limpiarError()     — quita el marcado de error de un campo
 *  · mostrarError()     — aplica el marcado de error a un campo
 *  · esEmailValido()    — valida formato de email
 *  · mostrarToast()     — notificación flotante (éxito / error)
 *  · showLoading()      — muestra / oculta el spinner global
 *
 * Depende de: state.js (catalogCache)
 */
'use strict';

/* ── Catálogos ──────────────────────────────────────────────────────────────── */

/**
 * Carga un catálogo desde la API y puebla un <select>.
 * Reutilizable para cualquier acordeón presente o futuro.
 *
 * @param {string} endpoint    Ruta relativa, p.ej. '/api/catalogo/paises'
 * @param {string} selectId    ID del <select> destino
 * @param {string} valField    Nombre del campo de valor en el JSON
 * @param {string} txtField    Nombre del campo de texto visible
 * @param {string} [placeholder='— Seleccione —']
 * @param {Object} [params={}] Query-string adicionales { key: value }
 * @returns {Promise<Array>}   Registros recibidos (vacío si hubo error)
 */
async function cargarCatalogo(
  endpoint, selectId, valField, txtField,
  placeholder = '— Seleccione —', params = {}, formatText = null
) {
  const sel = document.getElementById(selectId);
  if (!sel) return [];

  const url = new URL(endpoint, window.location.origin);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const cacheKey = url.toString();

  let datos = catalogCache[cacheKey];
  if (!datos) {
    sel.innerHTML = '<option value="">Cargando…</option>';
    try {
      const resp = await fetch(cacheKey);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      datos = await resp.json();
      catalogCache[cacheKey] = datos;
    } catch (err) {
      console.error(`cargarCatalogo [${endpoint}]:`, err);
      sel.innerHTML = '<option value="">⚠ Error de carga</option>';
      return [];
    }
  }

  sel.innerHTML = `<option value="">${placeholder}</option>`;
  datos.forEach(row => {
    const opt = document.createElement('option');
    opt.value       = row[valField];
    opt.textContent = formatText ? formatText(row) : row[txtField];
    sel.appendChild(opt);
  });

  return datos;
}

/**
 * Carga un catálogo en un <datalist> (para inputs con búsqueda).
 * Almacena el código original en `dataset.cod` de cada option.
 *
 * @param {string} endpoint
 * @param {string} datalistId  ID del <datalist> destino
 * @param {string} valField
 * @param {string} txtField
 * @param {Object} [params={}]
 * @returns {Promise<Array>}
 */
async function cargarDatalist(endpoint, datalistId, valField, txtField, params = {}) {
  const dl = document.getElementById(datalistId);
  if (!dl) return [];

  const url = new URL(endpoint, window.location.origin);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const cacheKey = url.toString();

  let datos = catalogCache[cacheKey];
  if (!datos) {
    try {
      const resp = await fetch(cacheKey);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      datos = await resp.json();
      catalogCache[cacheKey] = datos;
    } catch (err) {
      console.error(`cargarDatalist [${endpoint}]:`, err);
      return [];
    }
  }

  dl.innerHTML = '';
  datos.forEach(row => {
    const opt       = document.createElement('option');
    opt.value       = `${row[valField]} — ${row[txtField]}`;
    opt.dataset.cod = row[valField];
    dl.appendChild(opt);
  });

  return datos;
}

/**
 * Construye el HTML de las opciones para un <select> a partir del cache.
 * Útil al generar grupos dinámicos sin repetir peticiones a la API.
 *
 * @param {string} endpoint    Ruta relativa (igual que en cargarCatalogo)
 * @param {string} valField    Campo de valor
 * @param {string} txtField    Campo de texto
 * @param {string} placeholder Texto del option vacío
 * @param {Object} [params={}] Query-string adicionales
 * @returns {string}  HTML de los <option> listo para insertar
 */
function getOpcionesHTML(endpoint, valField, txtField, placeholder, params = {}) {
  const url = new URL(endpoint, window.location.origin);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const datos = catalogCache[url.toString()] || [];
  let html = `<option value="">${placeholder}</option>`;
  datos.forEach(d => { html += `<option value="${d[valField]}">${d[txtField]}</option>`; });
  return html;
}

/**
 * Pre-carga un catálogo en cache sin necesitar un elemento DOM destino.
 * Útil para catálogos usados por grupos dinámicos que no tienen un <select> estático.
 *
 * @param {string} endpoint    Ruta relativa, p.ej. '/api/catalogo/bancos'
 * @param {Object} [params={}] Query-string adicionales
 * @returns {Promise<Array>}
 */
async function preCargarCatalogo(endpoint, params = {}) {
  const url = new URL(endpoint, window.location.origin);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const cacheKey = url.toString();
  if (catalogCache[cacheKey]) return catalogCache[cacheKey];
  try {
    const resp = await fetch(cacheKey);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const datos = await resp.json();
    catalogCache[cacheKey] = datos;
    return datos;
  } catch (err) {
    console.error(`preCargarCatalogo [${endpoint}]:`, err);
    return [];
  }
}

/* ── Selects con buscador ───────────────────────────────────────────────────── */

/**
 * Convierte un <select> nativo en un campo con buscador de texto.
 * Se puede llamar varias veces sobre el mismo ID (idempotente).
 * Usa MutationObserver para detectar cuando cargarCatalogo recarga las opciones.
 *
 * @param {string} selectId
 */
function convertirABuscable(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel || sel.dataset.buscable) return;
  sel.dataset.buscable = '1';
  sel.style.display = 'none';

  // Envolver en .sb-wrap
  const wrap = document.createElement('div');
  wrap.className = 'sb-wrap';
  sel.parentNode.insertBefore(wrap, sel);
  wrap.appendChild(sel);

  // Input visible — readonly por defecto; sólo editable al buscar con el dropdown abierto
  const inp = document.createElement('input');
  inp.type         = 'text';
  inp.className    = 'sb-input';
  inp.autocomplete = 'off';
  inp.readOnly     = true;          // evita escritura cuando el dropdown está cerrado
  inp.style.cursor = 'pointer';     // indica que es un selector, no un input libre
  wrap.appendChild(inp);

  // Lista desplegable
  const drop = document.createElement('div');
  drop.className = 'sb-dropdown';
  wrap.appendChild(drop);

  let _abierto = false;

  function _renderDrop(q) {
    drop.innerHTML = '';
    const ll = q ? q.toLowerCase() : '';
    const opts = Array.from(sel.options).filter(o =>
      o.value !== '' && (!ll || o.textContent.toLowerCase().includes(ll))
    );
    if (!opts.length) {
      const em = document.createElement('div');
      em.className   = 'sb-item sb-empty';
      em.textContent = q ? 'Sin resultados' : '— Sin opciones —';
      drop.appendChild(em);
    } else {
      opts.slice(0, 100).forEach(o => {
        const it = document.createElement('div');
        it.className   = 'sb-item' + (o.value === sel.value ? ' sb-selected' : '');
        it.textContent = o.textContent;
        it.addEventListener('mousedown', e => {
          e.preventDefault();
          sel.value = o.value;
          inp.value  = o.textContent;
          drop.style.display = 'none';
          _abierto   = false;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        });
        drop.appendChild(it);
      });
    }
  }

  function _abrir() {
    if (sel.disabled) return;
    // Habilitar escritura para buscar y limpiar el texto actual
    inp.readOnly     = false;
    inp.style.cursor = 'text';
    inp.value        = '';
    _renderDrop('');
    drop.style.display = 'block';
    _abierto = true;
  }

  function _cerrar() {
    drop.style.display = 'none';
    _abierto = false;
    // Bloquear escritura de nuevo
    inp.readOnly     = true;
    inp.style.cursor = 'pointer';
    const cur = sel.options[sel.selectedIndex];
    inp.value = (cur && cur.value) ? cur.textContent : '';
  }

  function _syncDisabled() {
    inp.disabled = sel.disabled;
    inp.readOnly = !sel.disabled; // si está disabled, también readonly
    if (sel.disabled) {
      inp.style.cursor = 'not-allowed';
      inp.placeholder  = (sel.options[0] && sel.options[0].textContent) || '—';
    } else {
      inp.style.cursor = 'pointer';
      inp.placeholder  = '— Seleccione —';
    }
  }

  inp.addEventListener('focus', _abrir);
  inp.addEventListener('input', () => {
    if (!inp.readOnly) {
      drop.style.display = 'block';
      _renderDrop(inp.value);
    }
  });
  inp.addEventListener('blur', () => { setTimeout(_cerrar, 180); });

  // Sync cuando código externo cambia sel.value y dispara 'change'
  // (ej. _setSelect() en dev-fill, hidratarFormularioVisual, etc.)
  // Sin este listener el inp muestra texto obsoleto aunque el estado sea correcto.
  sel.addEventListener('change', () => {
    if (!_abierto) {
      const cur = sel.options[sel.selectedIndex];
      inp.value = (cur && cur.value) ? cur.textContent : '';
    }
  });

  // Detectar cuando cargarCatalogo cambia las opciones o el disabled
  const obs = new MutationObserver(() => {
    _syncDisabled();
    if (!_abierto) _cerrar();
  });
  obs.observe(sel, { childList: true, attributes: true, attributeFilter: ['disabled'] });

  _syncDisabled();
  _cerrar(); // muestra texto del valor actual (si ya hay uno)
}

/* ── Tooltips de íconos de información (position:fixed, sin recorte) ─────────── */

/**
 * Inicializa el sistema de tooltips para todos los .ic-info[data-tip].
 * Crea un único div#_ic_tooltip_global con position:fixed que se posiciona
 * mediante getBoundingClientRect() y no puede ser recortado por el overflow
 * de ningún contenedor padre.
 *
 * Llamar UNA VEZ desde DOMContentLoaded (en app.js).
 */
function inicializarTooltips() {
  // Crear o reutilizar el div global
  let tip = document.getElementById('_ic_tooltip_global');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = '_ic_tooltip_global';
    document.body.appendChild(tip);
  }

  function _mostrar(el) {
    tip.textContent = el.dataset.tip || '';
    tip.style.display = 'block';
    tip.style.opacity  = '1';

    const rect = el.getBoundingClientRect();
    const tw   = tip.offsetWidth;
    const th   = tip.offsetHeight;

    // Intentar posicionar ENCIMA del ícono; si no cabe, posicionar DEBAJO
    let top  = rect.top - th - 7;
    let left = rect.left + rect.width / 2 - tw / 2;

    if (top < 6) top = rect.bottom + 7;

    // Clampear horizontalmente al viewport con margen de 8px
    left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));

    tip.style.top  = top  + 'px';
    tip.style.left = left + 'px';
  }

  function _ocultar() {
    tip.style.display = 'none';
  }

  // Delegar eventos en document para capturar íconos añadidos dinámicamente
  document.addEventListener('mouseover', e => {
    const el = e.target.closest('.ic-info[data-tip]');
    if (el) _mostrar(el);
  });
  document.addEventListener('mouseout', e => {
    if (e.target.closest('.ic-info[data-tip]')) _ocultar();
  });
  // Ocultar al hacer scroll (evita que el tooltip quede flotando)
  window.addEventListener('scroll', _ocultar, { passive: true });
}

/* ── Campo condicional "Otros" ──────────────────────────────────────────────── */

/**
 * Configura el comportamiento "Otros" en un <select> de catálogo.
 * Cuando la opción seleccionada comienza con "otro" (sin importar mayúsculas),
 * muestra wrapEl con animación; de lo contrario lo oculta y llama onHide().
 *
 * @param {HTMLSelectElement|string} selectElOrId  Elemento <select> o su ID
 * @param {HTMLElement|string}       wrapElOrId    Div contenedor del campo libre
 * @param {Function}                 [onHide]      Callback al ocultar (p.ej. limpiar estado)
 */
function configurarOtros(selectElOrId, wrapElOrId, onHide) {
  const sel  = typeof selectElOrId === 'string' ? document.getElementById(selectElOrId) : selectElOrId;
  const wrap = typeof wrapElOrId   === 'string' ? document.getElementById(wrapElOrId)   : wrapElOrId;
  if (!sel || !wrap) return;

  function _evaluar() {
    const txt    = (sel.options[sel.selectedIndex]?.textContent || '').trim();
    const esOtro = /^otro/i.test(txt);
    if (esOtro) {
      wrap.style.display = 'block';
      requestAnimationFrame(() => requestAnimationFrame(() => {
        wrap.style.opacity = '1'; wrap.style.maxHeight = '200px';
      }));
    } else {
      wrap.style.opacity   = '0';
      wrap.style.maxHeight = '0';
      setTimeout(() => { wrap.style.display = 'none'; }, 210);
      onHide && onHide();
    }
  }

  sel.addEventListener('change', _evaluar);
  // Evaluar estado inicial (útil al hidratar borradores)
  _evaluar();
}

/* ── Acordeón ───────────────────────────────────────────────────────────────── */

/**
 * Alterna el estado colapsado / expandido de un acordeón.
 * @param {string} id  ID del elemento <section class="accordion">
 */
function toggleAccordion(id) {
  document.getElementById(id).classList.toggle('collapsed');
}

/* ── Validación visual ──────────────────────────────────────────────────────── */

/** Elimina el marcado de error de un campo wrapper (.field). */
function limpiarError(fieldId) {
  const f = document.getElementById(fieldId);
  if (f) f.classList.remove('error');
}

/** Aplica el marcado de error a un campo wrapper (.field). */
function mostrarError(fieldId) {
  const f = document.getElementById(fieldId);
  if (f) f.classList.add('error');
}

/**
 * Valida formato de email con regex básica.
 * @param {string} v
 * @returns {boolean}
 */
function esEmailValido(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

/* ── Notificaciones ─────────────────────────────────────────────────────────── */

let _toastTimer;

/**
 * Muestra una notificación flotante en la esquina inferior derecha.
 * @param {string} msg
 * @param {'success'|'error'} [tipo='success']
 */
function mostrarToast(msg, tipo = 'success') {
  const t = document.getElementById('toast');
  clearTimeout(_toastTimer);
  t.textContent = msg;
  t.className   = `toast ${tipo} show`;
  _toastTimer   = setTimeout(() => t.classList.remove('show'), 4000);
}

/* ── Spinner de carga ───────────────────────────────────────────────────────── */

/**
 * Muestra u oculta el overlay de carga global.
 * @param {boolean} visible
 */
function showLoading(visible) {
  document.getElementById('loadingOverlay').style.display = visible ? 'flex' : 'none';
}

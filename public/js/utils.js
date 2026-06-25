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
  placeholder = 'select_placeholder', params = {}, formatText = null
) {
  const sel = document.getElementById(selectId);
  if (!sel) return [];

  const url = new URL(endpoint, window.location.origin);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const cacheKey = url.toString();

  // Helpers i18n: usa t() si está disponible, si no, usa el string tal cual
  const _t = key => (typeof t === 'function' ? t(key) || key : key);

  let datos = catalogCache[cacheKey];
  if (!datos) {
    sel.innerHTML = `<option value="">${_t('select_loading')}</option>`;
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

  sel.innerHTML = `<option value="">${_t(placeholder)}</option>`;
  datos.forEach(row => {
    const opt = document.createElement('option');
    opt.value = row[valField];
    if (formatText) {
      opt.textContent = formatText(row);
    } else if (window._currentLang === 'en' && row.NOM_EN) {
      opt.textContent = row.NOM_EN;
    } else {
      opt.textContent = row[txtField];
    }
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
  const _t = key => (typeof t === 'function' ? t(key) || key : key);
  const datos = catalogCache[url.toString()] || [];
  let html = `<option value="">${_t(placeholder)}</option>`;
  datos.forEach(d => {
    const txt = (window._currentLang === 'en' && d.NOM_EN) ? d.NOM_EN : d[txtField];
    html += `<option value="${d[valField]}">${txt}</option>`;
  });
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
      em.textContent = q
        ? (typeof t === 'function' ? t('sin_resultados') : 'Sin resultados')
        : (typeof t === 'function' ? t('sin_opciones')   : '— Sin opciones —');
      drop.appendChild(em);
    } else {
      opts.slice(0, 100).forEach(o => {
        const it = document.createElement('div');
        it.className   = 'sb-item' + (o.value === sel.value ? ' sb-selected' : '');
        it.textContent = o.textContent;
        it.title       = o.textContent;
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
    inp.readOnly     = false;
    inp.style.cursor = 'text';
    inp.value        = '';
    _renderDrop('');

    // Posicionamiento inteligente: abre hacia donde haya más espacio
    drop.style.display = 'block';
    const rect       = wrap.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const dropH      = Math.min(drop.scrollHeight, 240);
    if (spaceBelow < dropH && spaceAbove > spaceBelow) {
      drop.style.top    = 'auto';
      drop.style.bottom = '100%';
    } else {
      drop.style.top    = '100%';
      drop.style.bottom = 'auto';
    }

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
      inp.placeholder  = (typeof t === 'function' ? t('select_placeholder') : null) || '— Seleccione —';
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

  // Detectar cuando cargarCatalogo cambia las opciones o el disabled.
  // Si el dropdown está abierto y llegaron nuevas opciones, re-renderizar
  // la lista visible para que el usuario vea los nuevos items inmediatamente.
  const obs = new MutationObserver((mutations) => {
    _syncDisabled();
    const hadChildListChange = mutations.some(m => m.type === 'childList');
    if (_abierto && hadChildListChange) {
      _renderDrop(inp.readOnly ? '' : inp.value);
    } else if (!_abierto) {
      _cerrar();
    }
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
    const esOtro = /^otro|^sin\s/i.test(txt);
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

/**
 * Versión simplificada (sin animación) para el patrón de sibling horizontal.
 * Muestra/oculta un campo hermano con display:none/'' según si la opción
 * seleccionada comienza con "Otro" o "Sin asignar".
 *
 * @param {string}   selectId   ID del <select>
 * @param {string}   siblingId  ID del campo sibling a mostrar/ocultar
 * @param {Function} [onHide]   Callback al ocultar (limpiar estado)
 */
function _activarSiblingOtro(selectId, siblingId, onHide) {
  const sel = document.getElementById(selectId);
  const fld = document.getElementById(siblingId);
  if (!sel || !fld) return;

  function _evaluar() {
    const txt = (sel.options[sel.selectedIndex]?.textContent || '').trim();
    // Strip leading "CODE - " prefix added for CIIU display, then test description
    const desc = txt.replace(/^\d[\w.]* - /, '');
    const OTRO_RE = /^otro|^other|^sin\s|^unassigned/i;
    if (OTRO_RE.test(txt) || OTRO_RE.test(desc)) {
      fld.style.display = '';
    } else {
      fld.style.display = 'none';
      if (typeof onHide === 'function') onHide();
    }
  }

  sel.addEventListener('change', _evaluar);
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

/* ── Campo "Otro país" para selectores de país ──────────────────────────────── */

/**
 * Añade la opción "Otro país (no listado)" al final de un select de países
 * si aún no está presente.
 * @param {HTMLSelectElement|string} selOrId
 */
function agregarOpcionOtroAlSelect(selOrId) {
  const sel = typeof selOrId === 'string' ? document.getElementById(selOrId) : selOrId;
  if (!sel) return;
  // Eliminar entradas de catálogo que empiecen con "Otro/Otros" o "Sin asignar"
  // para evitar duplicados y registros placeholder en el selector de país.
  Array.from(sel.options).forEach(opt => {
    if (/^otro|^other|^sin\s|^unassigned/i.test(opt.textContent.trim())) sel.removeChild(opt);
  });
  if (!sel.querySelector('option[value="OTRO"]')) {
    const opt = document.createElement('option');
    opt.value       = 'OTRO';
    opt.textContent = typeof t === 'function' ? t('otro_pais_opt') : 'Otro pa\xEDs (no listado)';
    sel.appendChild(opt);
  }
}

/**
 * Añade la opción "Sin asignar / Otro tipo" al final de un select de tipo de documento.
 * @param {HTMLSelectElement|string} selOrId
 */
function agregarOpcionOtroAlTipdoc(selOrId) {
  const sel = typeof selOrId === 'string' ? document.getElementById(selOrId) : selOrId;
  if (!sel || sel.querySelector('option[value="OTR_TPDOC"]')) return;
  const opt = document.createElement('option');
  opt.value       = 'OTR_TPDOC';
  opt.textContent = typeof t === 'function' ? t('otro_tipdoc_opt') : 'Sin asignar / Otro tipo';
  sel.appendChild(opt);
}

/**
 * Detecta si un select de ciudad quedó vacío tras cargarCatalogo (país sin
 * municipios en la BD) y, de ser así, lo establece en "No aplica" (valor 'NA').
 * Retorna true si no había ciudades reales, false si hay al menos una.
 *
 * @param {HTMLSelectElement} selMpio
 * @returns {boolean}
 */
function _autoNoAplicaCiudad(selMpio) {
  const realCities = Array.from(selMpio.options).filter(o => o.value !== '' && o.value !== 'NA');
  if (realCities.length === 0) {
    selMpio.innerHTML = '<option value="NA">' + (typeof t === 'function' ? t('no_aplica') : 'No aplica') + '</option>';
    selMpio.disabled = true;
    return true;
  }
  return false;
}

/**
 * Configura el comportamiento "Otro país" para un select de países.
 * Cuando se selecciona "OTRO", muestra el campo de texto libre.
 * Cuando se selecciona un país normal, oculta ese campo.
 *
 * @param {string} paisSelId   ID del <select> de países
 * @param {string} otroWrapId  ID del contenedor del campo de texto libre
 * @param {Function} [onOtro]  Callback al activar "Otro"
 * @param {Function} [onNormal] Callback al desactivar "Otro"
 */
function configurarPaisOtroTexto(paisSelId, otroWrapId, onOtro, onNormal) {
  const sel  = document.getElementById(paisSelId);
  const wrap = document.getElementById(otroWrapId);
  if (!sel || !wrap) return;

  function _evaluar() {
    if (sel.value === 'OTRO') {
      wrap.style.display = 'block';
      requestAnimationFrame(() => requestAnimationFrame(() => {
        wrap.style.opacity = '1'; wrap.style.maxHeight = '100px';
      }));
      onOtro && onOtro();
    } else {
      wrap.style.opacity   = '0';
      wrap.style.maxHeight = '0';
      setTimeout(() => { wrap.style.display = 'none'; }, 210);
      onNormal && onNormal();
    }
  }

  sel.addEventListener('change', _evaluar);
  _evaluar();
}

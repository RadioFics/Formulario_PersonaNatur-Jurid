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
  placeholder = '— Seleccione —', params = {}
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
    opt.textContent = row[txtField];
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

/**
 * seccion-docs.js — Sección 13: "Documentos Requeridos y Firma"
 *
 * Sub-secciones:
 *  · 13A — Firma del Representante Legal (GN_JURID_FIRMA)
 *           Campos de texto: NOM_FIRM, APE_FIRM, TIP_DOCU, NUM_DOCU, FEC_FIRMA
 *           Archivo:         ARCH_FIRMA  (se sube por multipart después de guardar)
 *  · 13B — Documentos requeridos (GN_TERCE_DOC)
 *           7 campos de archivo adjunto (RUT, CERT_BANC, CERT_EXIS, DOC_ID_RL,
 *           EST_FIN, CERT_ACCI, CART_ACEP)
 *
 * Los objetos File NO se almacenan en formData (no serializables a localStorage).
 * Se guardan en _archivos (Map local) y se envían vía FormData a
 * POST /api/documentos/:numIden después de que guardar-completo confirme el NUM_IDEN.
 *
 * State: formData.firma      — campos de texto de GN_JURID_FIRMA
 *        formData.documentos — nombre de cada archivo seleccionado (string | null)
 *
 * Depende de: state.js, utils.js
 */
'use strict';

/** Mapa local: clave de campo → File seleccionado */
const _archivos = new Map();

/* ── Inicialización ─────────────────────────────────────────────────────────── */

/**
 * Carga el catálogo de tipos de documento para el select de Firma
 * y rehidrata los campos de texto si hay un borrador.
 * Se llama desde app.js dentro del bloque DOMContentLoaded.
 */
async function initSeccionDocs() {
  await cargarCatalogo(
    '/api/catalogo/tipos-documento?todos=1', 'firma_tipdoc',
    'COD_TPDOC', 'NOM_TPDOC', '— Seleccione —'
  );

  // Hidratar campos de texto desde el estado (borrador)
  const f = formData.firma;
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el && val) el.value = val;
  };
  set('firma_nom',    f.NOM_FIRM);
  set('firma_ape',    f.APE_FIRM);
  set('firma_tipdoc', f.TIP_DOCU);
  set('firma_numdoc', f.NUM_DOCU);
  set('firma_fec',    f.FEC_FIRMA);

  // Hidratar indicadores de archivos desde borrador (solo nombre, no el File)
  const docs = formData.documentos || {};
  Object.entries(docs).forEach(([clave, nombre]) => {
    if (nombre) _actualizarIndicadorArchivo(clave, nombre);
  });
}

/* ── Firma: campos de texto ─────────────────────────────────────────────────── */

/**
 * Escribe el valor en formData.firma[campo].
 * @param {string} campo
 * @param {string} valor
 */
function actualizarFirma(campo, valor) {
  formData.firma[campo] = valor === '' ? null : valor;
  guardarBorradorDebounced();
}

/* ── Gestión de archivos ────────────────────────────────────────────────────── */

/**
 * Llamado por onchange de cada <input type="file">.
 * Almacena el File en _archivos y actualiza el indicador visual.
 *
 * @param {string}      clave  Nombre del campo BD (p.ej. 'RUT', 'CERT_BANC', 'ARCH_FIRMA')
 * @param {HTMLElement} input  Elemento <input type="file">
 */
function onArchivoSeleccionado(clave, input) {
  const file = input.files[0] || null;
  if (file) {
    _archivos.set(clave, file);
    formData.documentos[clave] = file.name;
    _actualizarIndicadorArchivo(clave, file.name);
    limpiarError(`field-doc_${clave.toLowerCase()}`);
  } else {
    _archivos.delete(clave);
    formData.documentos[clave] = null;
    _actualizarIndicadorArchivo(clave, null);
  }
}

function _actualizarIndicadorArchivo(clave, nombre) {
  const ind = document.getElementById(`doc_ind_${clave.toLowerCase()}`);
  if (!ind) return;
  if (nombre) {
    ind.textContent = `✓ ${nombre}`;
    ind.className   = 'doc-archivo-nombre doc-ok';
  } else {
    ind.textContent = 'Ningún archivo seleccionado';
    ind.className   = 'doc-archivo-nombre';
  }
}

/**
 * Construye un FormData con todos los archivos seleccionados.
 * Lo usa guardar.js para el upload multipart después de guardar-completo.
 *
 * @param {string} numIden  NUM_IDEN confirmado por el backend
 * @returns {FormData}
 */
function construirFormDataArchivos(numIden) {
  const fd = new FormData();
  fd.append('NUM_IDEN', numIden);
  for (const [clave, file] of _archivos.entries()) {
    fd.append(clave, file, file.name);
  }
  return fd;
}

/** @returns {boolean} true si hay al menos un archivo seleccionado. */
function hayArchivosSeleccionados() {
  return _archivos.size > 0;
}

/* ── Validación ─────────────────────────────────────────────────────────────── */

/**
 * Valida los campos obligatorios de la sección 13.
 * Solo los datos de texto de GN_JURID_FIRMA son requeridos para enviar;
 * los archivos son complementarios pero no bloquean el envío del formulario.
 *
 * @returns {boolean}
 */
function validarSeccionDocs() {
  let ok = true;
  const f = formData.firma;

  if (!f.NOM_FIRM)  { mostrarError('field-firma_nom');    ok = false; }
  if (!f.APE_FIRM)  { mostrarError('field-firma_ape');    ok = false; }
  if (!f.TIP_DOCU)  { mostrarError('field-firma_tipdoc'); ok = false; }
  if (!f.NUM_DOCU)  { mostrarError('field-firma_numdoc'); ok = false; }
  if (!f.FEC_FIRMA) { mostrarError('field-firma_fec');    ok = false; }

  return ok;
}

/* ── Acciones de botones ────────────────────────────────────────────────────── */

function validarYContinuarDocs() {
  if (!validarSeccionDocs()) {
    document.getElementById('accordion-docs').classList.remove('collapsed');
    mostrarToast('Corrija los campos marcados en rojo.', 'error');
    const primerError = document.querySelector('#accordion-docs .field.error');
    if (primerError) primerError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  mostrarToast('Sección 13 completa. Ya puede enviar el formulario.', 'success');
  document.getElementById('accordion-docs').classList.add('collapsed');
  const btnSubmit = document.getElementById('btn-submit');
  if (btnSubmit) btnSubmit.scrollIntoView({ behavior: 'smooth', block: 'center' });
  console.log('✅ formData.firma:', JSON.stringify(formData.firma, null, 2));
}

/** Resetea todos los campos de la sección al estado inicial. */
function limpiarSeccionDocs() {
  // Texto de firma
  formData.firma = { NOM_FIRM: null, APE_FIRM: null, TIP_DOCU: null, NUM_DOCU: null, FEC_FIRMA: null };
  const setEmpty = id => { const el = document.getElementById(id); if (el) el.value = ''; };
  setEmpty('firma_nom'); setEmpty('firma_ape'); setEmpty('firma_tipdoc');
  setEmpty('firma_numdoc'); setEmpty('firma_fec');

  // Archivos
  _archivos.clear();
  formData.documentos = {
    RUT: null, CERT_BANC: null, CERT_EXIS: null, DOC_ID_RL: null,
    EST_FIN: null, CERT_ACCI: null, CART_ACEP: null, ARCH_FIRMA: null,
  };
  document.querySelectorAll('#accordion-docs input[type="file"]')
    .forEach(inp => { inp.value = ''; });
  document.querySelectorAll('#accordion-docs .doc-archivo-nombre')
    .forEach(ind => { ind.textContent = 'Ningún archivo seleccionado'; ind.className = 'doc-archivo-nombre'; });

  // Errores
  document.querySelector('#accordion-docs .accordion-body')
    .querySelectorAll('.field.error').forEach(f => f.classList.remove('error'));

  mostrarToast('Sección limpiada.', 'success');
}

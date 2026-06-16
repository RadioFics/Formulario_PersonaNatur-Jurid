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

// Avisa al usuario si intenta salir con archivos seleccionados sin haber enviado
window.addEventListener('beforeunload', (e) => {
  if (_archivos.size > 0) {
    e.preventDefault();
    e.returnValue = '';
  }
});

/* ── Inicialización ─────────────────────────────────────────────────────────── */

/**
 * Carga el catálogo de tipos de documento para el select de Firma
 * y rehidrata los campos de texto si hay un borrador.
 * Se llama desde app.js dentro del bloque DOMContentLoaded.
 */
async function initSeccionDocs() {
  await cargarCatalogo(
    '/api/catalogo/tipos-documento?todos=1', 'firma_tipdoc',
    'COD_TPDOC', 'NOM_TPDOC', 'select_placeholder'
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

  // Renderizar campos de RL dinámicos y luego hidratar indicadores de archivos
  renderDocRLFields();
  const docs = formData.documentos || {};
  Object.entries(docs).forEach(([clave, nombre]) => {
    if (nombre) _actualizarIndicadorArchivo(clave, nombre);
  });
}

/**
 * Genera un campo de carga por cada RL registrado en formData.representantes.
 * Clave usada: DOC_ID_RL_0, DOC_ID_RL_1, …
 * Debe llamarse también cuando se agrega/elimina un RL en sección 2.
 */
function renderDocRLFields() {
  const container = document.getElementById('doc-rl-container');
  if (!container) return;

  const rls = Array.isArray(formData.representantes) ? formData.representantes : [];
  container.innerHTML = '';

  rls.forEach((rl, idx) => {
    const clave     = `DOC_ID_RL_${idx}`;
    const nombreRL  = [rl.NOM_REPR, rl.APE_REPR].filter(Boolean).join(' ');
    const tituloRL  = nombreRL ||
                      (idx === 0 ? (typeof t==='function'?t('sec14_rl_principal'):'Representante Legal Principal') : `${typeof t==='function'?t('sec14_rl_suplente'):'Representante Legal Suplente'} ${idx}`);
    const labelBase = idx === 0
      ? (typeof t==='function'?t('sec14_rl_label'):'Copia del documento de identidad del Representante Legal')
      : `${typeof t==='function'?t('sec14_rl_label'):'Copia del documento de identidad del Representante Legal'} ${idx + 1}`;

    const item = document.createElement('div');
    item.className = 'doc-item';
    item.innerHTML = `
      <div class="doc-label">
        ${labelBase}
        <small>${tituloRL}</small>
        <span class="ic-info" data-i18n-tip="sec14_rl_id_tip" data-tip="${typeof t==='function'?t('sec14_rl_id_tip'):'Copia legible de la cédula de ciudadanía o documento de identidad vigente del Representante Legal. Incluya ambas caras si la información relevante está distribuida en ellas.'}">i</span>
      </div>
      <div class="doc-upload-wrap">
        <label class="btn-upload" tabindex="0">
          ${typeof t==='function'?t('sec14_select_file'):'Seleccionar archivo'}
          <input type="file" accept=".pdf" style="display:none"
                 onchange="onArchivoSeleccionado('${clave}',this)" />
        </label>
        <span class="doc-archivo-nombre" id="doc_ind_${clave.toLowerCase()}">${typeof t==='function'?t('sec14_no_file'):'Ningún archivo seleccionado'}</span>
      </div>`;
    container.appendChild(item);

    const nombre = (formData.documentos || {})[clave];
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
    const esPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!esPDF) {
      mostrarToast(typeof t==='function'?t('toast_pdf_only'):'Solo se aceptan archivos PDF. Seleccione un archivo .pdf.', 'error');
      input.value = '';
      return;
    }
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
    // Si estaba marcado como faltante, quitarlo al seleccionar archivo
    ind.classList.remove('doc-faltante');
  } else {
    ind.textContent = typeof t==='function'?t('sec14_no_file'):'Ningún archivo seleccionado';
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
 * Valida que todos los documentos requeridos (sección 13) estén adjuntos.
 * La firma del representante legal fue eliminada del formulario.
 *
 * @returns {boolean}
 */
function validarSeccionDocs() {
  const esNatural = window.modoPersona === 'N';

  const requeridosComun = [
    { clave: 'RUT',       indId: 'doc_ind_rut',       label: 'RUT' },
    { clave: 'CERT_BANC', indId: 'doc_ind_cert_banc', label: 'Certificación bancaria' },
    { clave: 'CART_ACEP', indId: 'doc_ind_cart_acep', label: esNatural ? 'Carta declaración de fondos' : 'Carta de aceptación' },
  ];

  if (esNatural) {
    requeridosComun.push(
      { clave: 'DOC_ID_RL', indId: 'doc_ind_doc_id_rl', label: 'Documento de identidad' },
      { clave: 'EST_FIN',   indId: 'doc_ind_est_fin',   label: 'Declaración de renta' }
    );
  } else {
    // Un campo por cada RL registrado en sección 2
    const rls = Array.isArray(formData.representantes) ? formData.representantes : [];
    rls.forEach((rl, idx) => {
      const clave = `DOC_ID_RL_${idx}`;
      const nom   = [rl.NOM_REPR, rl.APE_REPR].filter(Boolean).join(' ') ||
                    (idx === 0 ? 'RL Principal' : `RL Suplente ${idx}`);
      requeridosComun.push({ clave, indId: `doc_ind_${clave.toLowerCase()}`, label: `Doc. identidad ${nom}` });
    });
    requeridosComun.push(
      { clave: 'EST_FIN_1', indId: 'doc_ind_est_fin_1', label: 'Estados financieros Año 1' },
      { clave: 'EST_FIN_2', indId: 'doc_ind_est_fin_2', label: 'Estados financieros Año 2' }
    );
  }

  const requeridosJuridica = [
    { clave: 'CERT_EXIS', indId: 'doc_ind_cert_exis', label: 'Certificado de existencia' },
    { clave: 'CERT_ACCI', indId: 'doc_ind_cert_acci', label: 'Certificado accionario' },
  ];

  const requeridos = esNatural
    ? requeridosComun
    : [...requeridosComun, ...requeridosJuridica];

  let ok = true;
  const faltantes = [];

  requeridos.forEach(({ clave, indId, label }) => {
    const tieneArchivo = _archivos.has(clave);
    const ind = document.getElementById(indId);
    if (!tieneArchivo) {
      faltantes.push(label);
      if (ind) ind.classList.add('doc-faltante');
      ok = false;
    } else {
      if (ind) ind.classList.remove('doc-faltante');
    }
  });

  if (!ok) {
    mostrarToast(
      `Faltan ${faltantes.length} documento(s) obligatorio(s): ${faltantes.join(', ')}.`,
      'error'
    );
  }

  return ok;
}

/* ── Acciones de botones ────────────────────────────────────────────────────── */

function validarYContinuarDocs() {
  if (!validarSeccionDocs()) {
    document.getElementById('accordion-docs').classList.remove('collapsed');
    mostrarToast(typeof t==='function'?t('toast_check_fields'):'Corrija los campos marcados en rojo.', 'error');
    const primerError = document.querySelector('#accordion-docs .field.error');
    if (primerError) primerError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  mostrarToast(typeof t==='function'?t('toast_sec_ok'):'Sección 14 completa.', 'success');
  document.getElementById('accordion-docs').classList.add('collapsed');
  const btnSubmit = document.getElementById('btn-submit');
  if (btnSubmit) btnSubmit.scrollIntoView({ behavior: 'smooth', block: 'center' });
  console.log('✅ formData.firma:', JSON.stringify(formData.firma, null, 2));
}

/** Resetea todos los campos de la sección al estado inicial. */
function limpiarSeccionDocs() {
  // Archivos
  _archivos.clear();
  formData.documentos = {
    RUT: null, CERT_BANC: null, CERT_EXIS: null,
    DOC_ID_RL: null,
    EST_FIN: null, EST_FIN_1: null, EST_FIN_2: null,
    CERT_ACCI: null, CART_ACEP: null, ARCH_FIRMA: null,
  };
  // Limpiar también claves dinámicas de RL
  const rls = Array.isArray(formData.representantes) ? formData.representantes : [];
  rls.forEach((_, idx) => { formData.documentos[`DOC_ID_RL_${idx}`] = null; });
  document.querySelectorAll('#accordion-docs input[type="file"]')
    .forEach(inp => { inp.value = ''; });
  document.querySelectorAll('#accordion-docs .doc-archivo-nombre')
    .forEach(ind => { ind.textContent = typeof t==='function'?t('sec14_no_file'):'Ningún archivo seleccionado'; ind.className = 'doc-archivo-nombre'; });

  // Errores
  document.querySelector('#accordion-docs .accordion-body')
    .querySelectorAll('.field.error').forEach(f => f.classList.remove('error'));

  mostrarToast(typeof t==='function'?t('toast_sec_clear'):'Sección limpiada.', 'success');
}

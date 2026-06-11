/**
 * guardar.js — Mecanismo de guardado final en cascada
 *
 * Contiene:
 *  · validarTodo()              — recorre todos los acordeones, devuelve array de errores
 *  · mostrarErroresValidacion() — despliega el panel de errores
 *  · ocultarErroresValidacion() — oculta el panel de errores
 *  · onSubmitClick()            — botón "Enviar formulario"
 *  · guardarFormulario()        — construye el payload y llama al backend
 *  · _mostrarProgreso()         — actualiza barra de progreso
 *  · _mostrarConfirmacion()     — pantalla de éxito con NUM_IDEN
 *  · _mostrarErrorGuardado()    — pantalla de error con opción de reintentar
 *
 * Backend esperado: POST /api/guardar-completo  → { success, NUM_IDEN } | { error }
 * Depende de: state.js, utils.js y todas las seccion-*.js
 */
'use strict';

/* ── Helpers de modo ────────────────────────────────────────────────────────── */
const _urlParams       = new URLSearchParams(window.location.search);
const _modoActual      = _urlParams.get('modo');   // 'actualizar' | null
const _esModoActualizar = _modoActual === 'actualizar';

/* ════════════════════════════════════════════════════════════════════════════════
   VALIDACIÓN GLOBAL
   ════════════════════════════════════════════════════════════════════════════════ */

/**
 * Recorre formData y construye un array de mensajes de error.
 * Si el array está vacío, el formulario está listo para enviarse.
 *
 * @returns {string[]}  Lista de descripciones de error (vacía = sin errores)
 */
function validarTodo() {
  const errores = [];

  /* ── Sección 1: Información básica ──────────────────────────────────── */
  if (!formData.basica.NOM_COMP)
    errores.push('Información básica: Razón social requerida');
  if (!formData.basica.NUM_IDEN)
    errores.push('Información básica: Número de documento requerido');
  if (!formData.basica.COD_TPDOC)
    errores.push('Información básica: Tipo de documento requerido');
  if (!formData.basica.COD_PAIS_EXP)
    errores.push('Información básica: País de constitución requerido');
  if (!formData.basica.TEL_TERC)
    errores.push('Información básica: Teléfono celular requerido');
  if (!formData.basica.DIR_MAIL || !esEmailValido(formData.basica.DIR_MAIL))
    errores.push('Información básica: Email corporativo inválido o vacío');
  if (!formData.basica.MAIL_SARL || !esEmailValido(formData.basica.MAIL_SARL))
    errores.push('Información básica: Email SAGRILAFT inválido o vacío');
  if (!formData.basica.COD_VINC)
    errores.push('Información básica: Tipo de vinculación requerido');
  if (!formData.basica.COD_CIIU)
    errores.push('Información básica: Actividad CIIU requerida');
  if (!formData.basica.DIR_TERC)
    errores.push('Información básica: Dirección requerida');

  /* ── Sección 2: Representante legal ──────────────────────────────────── */
  const rp = formData.representantes[0];
  if (!rp.NOM_REPR) errores.push('Representante legal: Nombres del Principal requeridos');
  if (!rp.APE_REPR) errores.push('Representante legal: Apellidos del Principal requeridos');
  if (!rp.TIP_DOCU) errores.push('Representante legal: Tipo de documento del Principal requerido');
  if (!rp.NUM_DOCU) errores.push('Representante legal: Número de documento del Principal requerido');
  if (!rp.COD_PAIS) errores.push('Representante legal: País del Principal requerido');

  /* ── Sección 3: Sociedad ─────────────────────────────────────────────── */
  if (!formData.sociedad.TIP_EMPR)
    errores.push('Información de la sociedad: Tipo de empresa requerido');
  if (!formData.sociedad.GRUP_EMPR)
    errores.push('Información de la sociedad: Grupo empresarial requerido');
  if (formData.sociedad.UBIC_SOC === 'E' && !formData.sociedad.COD_PAIS_SOC)
    errores.push('Información de la sociedad: País requerido para empresa extranjera');
  if (formData.sociedad.GRUP_EMPR === 'S' && !formData.sociedad.REL_GRUPO)
    errores.push('Información de la sociedad: Rol en el grupo empresarial requerido');

  /* ── Sección 4: Países ───────────────────────────────────────────────── */
  if (!formData.paises.length || !formData.paises[0].COD_PAIS)
    errores.push('Países de operación: Seleccione al menos un país');
  if (formData.paises.some(p => !p.COD_PAIS))
    errores.push('Países de operación: Hay entradas sin país seleccionado');

  /* ── Sección 5: Cumplimiento ─────────────────────────────────────────── */
  if (!formData.cumplimiento.DESC_NORM || !String(formData.cumplimiento.DESC_NORM).trim())
    errores.push('Sistema de cumplimiento: Descripción de normatividad requerida');

  /* ── Sección 6: Junta directiva ──────────────────────────────────────── */
  if (formData.juntaDirectiva.TIE_JUNTA === 'S' &&
      formData.juntaDirectiva.miembros.length === 0)
    errores.push('Junta directiva: Debe agregar al menos un miembro');

  /* ── Sección 7: Revisores fiscales ───────────────────────────────────── */
  if (formData.revisores.TIE_REVIS === 'S' &&
      formData.revisores.revisores.length === 0)
    errores.push('Revisores fiscales: Debe agregar al menos un revisor');

  /* ── Sección 8: Composición accionaria ──────────────────────────────── */
  if (!formData.accionistas.length ||
      (!formData.accionistas[0].NOM_ACCI && !formData.accionistas[0].RAZ_ACCI))
    errores.push('Composición accionaria: Registre al menos un accionista');
  // Sin restricción de suma al 100% — se acepta cualquier distribución.

  /* ── Sección 9: Financiera ───────────────────────────────────────────── */
  if (formData.financiera.ACT_TOTAL  === null) errores.push('Información financiera: Activos totales requeridos');
  if (formData.financiera.ING_MENS   === null) errores.push('Información financiera: Ingresos mensuales requeridos');
  if (formData.financiera.PAS_TOTAL  === null) errores.push('Información financiera: Pasivos totales requeridos');
  if (formData.financiera.EGR_MENS   === null) errores.push('Información financiera: Egresos mensuales requeridos');
  if (formData.financiera.PATRIMONIO === null) errores.push('Información financiera: Patrimonio requerido');

  /* ── Sección 10: Bancaria ────────────────────────────────────────────── */
  if (!formData.bancaria.length || !formData.bancaria[0].COD_BANCO)
    errores.push('Información bancaria: Registre al menos una cuenta bancaria');
  formData.bancaria.forEach((b, i) => {
    if (!b.COD_BANCO) errores.push(`Información bancaria: Cuenta ${i + 1} sin entidad bancaria`);
    if (!b.TIP_CUEN)  errores.push(`Información bancaria: Cuenta ${i + 1} sin tipo de cuenta`);
    if (!b.NUM_CUEN)  errores.push(`Información bancaria: Cuenta ${i + 1} sin número de cuenta`);
    if (b.CUEN_EXTR === 'S') {
      if (!b.NOM_ENT_EXT) errores.push(`Información bancaria: Cuenta ${i + 1} sin nombre de entidad extranjera`);
      if (!b.TIP_CUE_EXT) errores.push(`Información bancaria: Cuenta ${i + 1} sin tipo de cuenta extranjera`);
    }
  });

  /* ── Sección 11: PEP ─────────────────────────────────────────────────── */
  if (!formData.pep.MAN_RPUB)
    errores.push('PEP: Debe indicar si la empresa maneja recursos públicos');
  if (!formData.pep.CAR_PUBL)
    errores.push('PEP: Debe indicar si algún representante ejerció cargo público');
  if (formData.actividades.CERT_INFO !== 'S')
    errores.push('Certificación: Debe confirmar que la información es verídica');

  /* ── Sección 12: Beneficiarios finales ───────────────────────────────── */
  if (!formData.beneficiarios.length ||
      (!formData.beneficiarios[0].NOM_BENE && !formData.beneficiarios[0].RAZ_BENE))
    errores.push('Beneficiarios finales: Registre al menos un beneficiario final');

  /* ── Sección 13: Documentos obligatorios ────────────────────────────── */
  // La firma del representante fue eliminada del formulario (sección 13A removida).
  // Los documentos son ahora obligatorios para enviar.
  const _docReqs = [
    ['RUT',       'RUT — Registro Único Tributario'],
    ['CERT_BANC', 'Certificación bancaria'],
    ['CERT_EXIS', 'Certificado de existencia y representación'],
    ['DOC_ID_RL', 'Documento de identidad del Representante Legal'],
    ['EST_FIN',   'Estados financieros del último año fiscal'],
    ['CERT_ACCI', 'Certificado de composición accionaria'],
    ['CART_ACEP', 'Carta de aceptación y autorización'],
  ];
  _docReqs.forEach(([clave, label]) => {
    if (typeof _archivos !== 'undefined' && !_archivos.has(clave))
      errores.push(`Documentos: Adjunte "${label}"`);
  });

  return errores;
}

/* ════════════════════════════════════════════════════════════════════════════════
   UI — PANEL DE ERRORES
   ════════════════════════════════════════════════════════════════════════════════ */

/**
 * Mapea el prefijo de un mensaje de error al ID de su acordeón.
 * @param {string} msg
 * @returns {string|null}
 */
function _acordeonDeError(msg) {
  // Modo Jurídica
  if (msg.startsWith('Información básica'))        return 'accordion-basica';
  if (msg.startsWith('Representante legal'))        return 'accordion-rl';
  if (msg.startsWith('Información de la sociedad')) return 'accordion-sociedad';
  if (msg.startsWith('Países de operación'))        return 'accordion-paises';
  if (msg.startsWith('Sistema de cumplimiento'))    return 'accordion-cumplimiento';
  if (msg.startsWith('Junta directiva'))            return 'accordion-jd';
  if (msg.startsWith('Revisores fiscales'))         return 'accordion-rf';
  if (msg.startsWith('Composición accionaria'))     return 'accordion-ac';
  if (msg.startsWith('Beneficiarios'))              return 'accordion-bf';
  // Modo Natural (usa "Sección 1:")
  if (msg.startsWith('Sección 1'))                 return 'accordion-basica';
  // Compartidos
  if (msg.startsWith('Información financiera'))     return 'accordion-financiera';
  if (msg.startsWith('Información bancaria'))       return 'accordion-bancaria';
  if (msg.startsWith('PEP') || msg.startsWith('Certificación')) return 'accordion-pep';
  if (msg.startsWith('Documentos') || msg.startsWith('Firma'))  return 'accordion-docs';
  return null;
}

/**
 * Abre el acordeón correspondiente a un error y hace scroll hacia él.
 * @param {string} msg  Mensaje de error
 */
function _navegarAlError(msg) {
  const accId = _acordeonDeError(msg);
  if (!accId) return;
  const acc = document.getElementById(accId);
  if (acc) {
    acc.classList.remove('collapsed');
    acc.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

/**
 * Muestra el panel de errores de validación global.
 * Cada error es clicable: abre el acordeón correspondiente y navega hacia él.
 * Al mostrarse, navega automáticamente al primer error.
 *
 * @param {string[]} errores
 */
function mostrarErroresValidacion(errores) {
  const panel = document.getElementById('error-panel');
  const lista = document.getElementById('error-panel-list');
  lista.innerHTML = '';

  errores.forEach((msg, idx) => {
    const li = document.createElement('li');
    li.textContent = msg;
    li.style.cursor = 'pointer';
    li.title = 'Haga clic para ir a este campo';
    li.addEventListener('click', () => _navegarAlError(msg));
    lista.appendChild(li);
  });

  panel.style.display = 'block';
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Auto-navegar al primer error después de 400ms (permitir que el panel aparezca primero)
  if (errores.length > 0) {
    setTimeout(() => _navegarAlError(errores[0]), 400);
  }
}

function ocultarErroresValidacion() {
  const panel = document.getElementById('error-panel');
  if (panel) panel.style.display = 'none';
}

/* ════════════════════════════════════════════════════════════════════════════════
   UI — MODALES DE PROGRESO, CONFIRMACIÓN Y ERROR
   ════════════════════════════════════════════════════════════════════════════════ */

const _PASOS = [
  'Registrando tercero (GN_TERCE)…',
  'Registrando información jurídica (GN_JURID)…',
  'Guardando representantes legales…',
  'Guardando sistema de cumplimiento…',
  'Guardando países de operación…',
  'Guardando junta directiva…',
  'Guardando revisores fiscales…',
  'Guardando composición accionaria…',
  'Guardando información financiera…',
  'Guardando cuentas bancarias…',
  'Guardando información PEP…',
  'Guardando actividades con activos virtuales…',
  'Confirmando transacción…',
];

let _progresoTimer = null;

/**
 * Muestra el modal de progreso y simula avance por pasos.
 * El progreso real lo determina la respuesta del servidor,
 * pero visualmente se anima paso a paso mientras se espera.
 */
function _mostrarProgresoModal() {
  const modal = document.getElementById('progreso-modal');
  modal.classList.add('show');
  let paso = 0;
  const total = _PASOS.length;
  _actualizarProgreso(paso, total, _PASOS[0]);
  _progresoTimer = setInterval(() => {
    paso++;
    if (paso < total) {
      _actualizarProgreso(paso, total, _PASOS[paso]);
    }
  }, 400);
}

function _actualizarProgreso(paso, total, texto) {
  const fill = document.getElementById('progress-bar-fill');
  const txt  = document.getElementById('progress-step-txt');
  if (fill) fill.style.width = `${Math.round((paso / total) * 100)}%`;
  if (txt)  txt.textContent  = texto;
}

function _cerrarProgresoModal() {
  clearInterval(_progresoTimer);
  const modal = document.getElementById('progreso-modal');
  modal.classList.remove('show');
  _actualizarProgreso(0, 1, '');
}

/**
 * Muestra la pantalla de confirmación con el NUM_IDEN asignado.
 * @param {string}      numIden
 * @param {number|null} codTerc  COD_TERC devuelto por el servidor (para Excel)
 */
function _mostrarConfirmacion(numIden, codTerc, esActualizacion) {
  const modal = document.getElementById('confirmacion-modal');
  const idEl  = document.getElementById('confirm-num-iden');
  if (idEl) idEl.textContent = numIden;

  const titleEl = modal.querySelector('.confirm-title');
  const bodyEl  = modal.querySelector('.confirm-body');
  if (titleEl) titleEl.textContent = esActualizacion ? '¡Registro actualizado!' : '¡Registro enviado con éxito!';
  if (bodyEl)  bodyEl.innerHTML    = esActualizacion
    ? 'Los cambios han sido guardados correctamente en la base de datos.<br>Número de identificación:'
    : 'Su información SAGRILAFT ha sido registrada correctamente.<br>Guarde el siguiente número de identificación para sus registros:';

  const btnExcel = document.getElementById('btn-descargar-excel');
  if (btnExcel) {
    if (codTerc) {
      btnExcel.dataset.codTerc = codTerc;
      btnExcel.style.display = '';
    } else {
      btnExcel.style.display = 'none';
    }
  }

  modal.classList.add('show');
}

/** Cierra el modal de confirmación y resetea el formulario. */
function cerrarConfirmacion() {
  document.getElementById('confirmacion-modal').classList.remove('show');
}

/** Imprime la página como resumen. */
function imprimirResumen() {
  window.print();
}

/**
 * Muestra el modal de error de guardado.
 * @param {string} mensajeError
 */
function _mostrarErrorGuardado(mensajeError) {
  const modal = document.getElementById('error-guardado-modal');
  const msg   = document.getElementById('error-guardado-msg');
  if (msg) msg.textContent = mensajeError;
  modal.classList.add('show');
}

function cerrarErrorGuardado() {
  document.getElementById('error-guardado-modal').classList.remove('show');
}

function reintentarGuardado() {
  cerrarErrorGuardado();
  guardarFormulario();
}

/* ════════════════════════════════════════════════════════════════════════════════
   GUARDADO PRINCIPAL
   ════════════════════════════════════════════════════════════════════════════════ */

/**
 * Punto de entrada del botón "Enviar formulario".
 * 1. Valida todo el formulario.
 * 2. Si hay errores, los muestra y detiene.
 * 3. Si no hay errores, inicia el guardado en cascada.
 */
function onSubmitClick() {
  ocultarErroresValidacion();
  const errores = validarTodo();
  if (errores.length > 0) {
    mostrarErroresValidacion(errores);
    mostrarToast(`Hay ${errores.length} campo(s) por completar.`, 'error');
    return;
  }
  if (_esModoActualizar) {
    actualizarFormulario();
  } else {
    guardarFormulario();
  }
}

/**
 * Sube archivos a /api/documentos/:numIden usando XHR para reportar
 * progreso real en la barra de progreso del modal.
 * @returns {Promise<{ok: boolean, status: number, responseText: string}>}
 */
function _subirArchivosConProgreso(fd, numIden) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/documentos/${encodeURIComponent(numIden)}`);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        _actualizarProgreso(pct, 100, `Subiendo documentos (${pct}%)…`);
      }
    });

    xhr.addEventListener('load', () => {
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, responseText: xhr.responseText });
    });
    xhr.addEventListener('error', () => reject(new Error('Error de red al subir documentos')));
    xhr.addEventListener('abort', () => reject(new Error('Subida cancelada')));

    xhr.send(fd);
  });
}

/**
 * Construye el payload completo y llama a POST /api/guardar-completo.
 * Todo el insert se realiza en una sola transacción en el backend.
 */
async function guardarFormulario() {
  const btnSubmit = document.getElementById('btn-submit');
  if (btnSubmit) { btnSubmit.disabled = true; }

  _mostrarProgresoModal();

  try {
    const payload = _construirPayload();

    const response = await fetch('/api/guardar-completo', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    clearInterval(_progresoTimer);
    _actualizarProgreso(14, 15, 'Datos guardados ✓');

    if (!response.ok) {
      await new Promise(r => setTimeout(r, 300));
      _cerrarProgresoModal();
      const data = await response.json().catch(() => ({}));
      const msg  = data.error || `Error HTTP ${response.status}`;
      _mostrarErrorGuardado(msg);
      return;
    }

    const data    = await response.json();
    const numIden = data.NUM_IDEN || payload.NUM_IDEN;

    // ── Subir archivos adjuntos con progreso real ────────────────────────────
    let docWarning = null;
    if (typeof hayArchivosSeleccionados === 'function' && hayArchivosSeleccionados()) {
      try {
        _actualizarProgreso(0, 100, 'Subiendo documentos (0%)…');
        const fd     = construirFormDataArchivos(numIden);
        const docRes = await _subirArchivosConProgreso(fd, numIden);
        _actualizarProgreso(100, 100, 'Documentos subidos ✓');
        if (!docRes.ok) {
          const docData  = JSON.parse(docRes.responseText || '{}');
          const detalles = Array.isArray(docData.detalles) ? docData.detalles.join(' | ') : '';
          docWarning = detalles || docData.error || 'Archivos rechazados por el servidor';
        }
      } catch (docErr) {
        console.warn('guardarFormulario() — subida de documentos falló:', docErr);
        docWarning = 'Error de red al subir documentos';
      }
    }

    await new Promise(r => setTimeout(r, 400));
    _cerrarProgresoModal();

    if (docWarning) {
      mostrarToast(`Datos guardados. Documentos rechazados: ${docWarning}`, 'warning');
    }

    // Limpiar _archivos para que beforeunload no bloquee la navegación post-envío
    if (typeof _archivos !== 'undefined') _archivos.clear();
    borrarBorrador();
    _mostrarConfirmacion(numIden, data.COD_TERC || null);

  } catch (err) {
    clearInterval(_progresoTimer);
    _cerrarProgresoModal();
    _mostrarErrorGuardado(err.message || 'Error de red — verifique su conexión.');
    console.error('guardarFormulario():', err);
  } finally {
    if (btnSubmit) { btnSubmit.disabled = false; }
  }
}

/**
 * Actualiza un registro jurídico existente — PUT /api/actualizar-completo.
 * Usa el mismo payload que guardarFormulario() pero método PUT.
 */
async function actualizarFormulario() {
  const btnSubmit = document.getElementById('btn-submit');
  if (btnSubmit) { btnSubmit.disabled = true; }
  _mostrarProgresoModal();
  try {
    const payload = _construirPayload();
    const response = await fetch('/api/actualizar-completo', {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    clearInterval(_progresoTimer);
    _actualizarProgreso(14, 15, 'Completado ✓');
    await new Promise(r => setTimeout(r, 500));
    _cerrarProgresoModal();
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      _mostrarErrorGuardado(data.error || `Error HTTP ${response.status}`);
      return;
    }
    const data    = await response.json();
    const numIden = data.NUM_IDEN || payload.NUM_IDEN;
    if (typeof hayArchivosSeleccionados === 'function' && hayArchivosSeleccionados()) {
      try {
        const fd = construirFormDataArchivos(numIden);
        await fetch(`/api/documentos/${encodeURIComponent(numIden)}`, { method: 'POST', body: fd });
      } catch (docErr) {
        console.warn('actualizarFormulario() — subida de docs falló:', docErr);
        mostrarToast('Datos actualizados. Algunos documentos no pudieron subirse.', 'warning');
      }
    }
    borrarBorrador();
    _mostrarConfirmacion(numIden, data.COD_TERC || null, true);
  } catch (err) {
    clearInterval(_progresoTimer);
    _cerrarProgresoModal();
    _mostrarErrorGuardado(err.message || 'Error de red — verifique su conexión.');
    console.error('actualizarFormulario():', err);
  } finally {
    if (btnSubmit) { btnSubmit.disabled = false; }
  }
}

/**
 * Construye el objeto completo que el backend necesita para la transacción.
 *
 * El servidor espera un objeto plano para los campos escalares de GN_TERCE,
 * GN_JURID y GN_JURID_CUMP (e.g. d.NUM_IDEN, d.DESC_NORM, d.cump_TIE_JUNTA).
 * Las secciones compuestas (arrays / sub-objetos) se envían como propiedades
 * nombradas (d.representantes, d.paises, d.accionistas, d.financiera, etc.).
 *
 * @returns {object}
 */
function _construirPayload() {
  const b  = formData.basica;
  const s  = formData.sociedad;
  const c  = formData.cumplimiento;
  const jd = formData.juntaDirectiva;
  const rf = formData.revisores;

  return {
    // ── Sección 1 — GN_TERCE + GN_JURID ────────────────────────────────────
    TIP_TERC:     'J',
    COD_TPDOC:    b.COD_TPDOC,
    NUM_IDEN:     b.NUM_IDEN,
    DIG_VERI:     b.DIG_VERI   || null,
    NOM_COMP:     b.NOM_COMP,
    COD_PAIS_EXP: b.COD_PAIS_EXP,
    COD_DEPT_EXP: b.COD_DEPT_EXP || null,
    COD_MPIO_EXP: b.COD_MPIO_EXP || null,
    DIR_TERC:     b.DIR_TERC,
    TEL_TERC:     b.TEL_TERC,
    TEL_TERC2:    b.TEL_TERC2   || null,
    DIR_MAIL:     b.DIR_MAIL,
    COD_VINC:     b.COD_VINC    || null,
    OTR_VINC:     b.OTR_VINC    || null,  // texto libre cuando vinculación = "Otro"
    MAIL_SARL:    b.MAIL_SARL   || null,
    COD_CIIU:     b.COD_CIIU    || null,
    OTR_CIIU:     b.OTR_CIIU    || null,  // texto libre cuando CIIU = "Otro"
    URL_WEB:      b.URL_WEB     || null,
    ACE_POLI:     true,  // T&C aceptados

    // ── Sección 3 — GN_JURID (sociedad) ────────────────────────────────────
    UBIC_SOC:     s.UBIC_SOC     || null,
    COD_PAIS_SOC: s.COD_PAIS_SOC || null,
    OTR_PAIS_SOC: s.OTR_PAIS_SOC || null,
    TIP_EMPR:     s.TIP_EMPR     || null,
    GRUP_EMPR:    s.GRUP_EMPR    || null,
    REL_GRUPO:    s.REL_GRUPO    || null,

    // ── Sección 2 — Representantes legales (GN_JURID_RL) ───────────────────
    representantes: formData.representantes.map(r => ({ ...r })),

    // ── Sección 4 — Países de operación (GN_JURID_PAIS) ────────────────────
    paises: formData.paises.filter(p => p.COD_PAIS).map(p => ({ COD_PAIS: p.COD_PAIS })),

    // ── Sección 5 — Cumplimiento (GN_JURID_CUMP) ───────────────────────────
    // Prefijos para evitar colisiones con campos de otras secciones
    DESC_NORM:      c.DESC_NORM   || null,
    NORM_LAFT:      c.NORM_LAFT   || null,
    cump_TIE_JUNTA: c.TIE_JUNTA  || 'N',
    SIS_PREVE:      c.SIS_PREVE   || null,
    oficiales:      (c.oficiales || []).map(o => _omitir(o, ['_id'])),

    // ── Sección 6 — Junta directiva (GN_JURID_JD) ──────────────────────────
    jd_TIE_JUNTA:  jd.TIE_JUNTA || 'N',
    juntaDirectiva: jd.miembros.map(m => _omitir(m, ['_id'])),

    // ── Sección 7 — Revisores fiscales (GN_JURID_RF) ───────────────────────
    rf_TIE_REVIS: rf.TIE_REVIS || 'N',
    revisores:    rf.revisores.map(r => _omitir(r, ['_id'])),

    // ── Sección 8 — Composición accionaria (GN_JURID_AC) ───────────────────
    accionistas: formData.accionistas.map(a => _omitir(a, ['_id'])),

    // ── Sección 9 — Financiera (GN_JURID_FIN) ──────────────────────────────
    financiera: { ...formData.financiera },

    // ── Sección 10 — Bancaria (GN_TERCE_BANCO) ─────────────────────────────
    bancaria: formData.bancaria.map(b => _omitir(b, ['_id'])),

    // ── Sección 11 — PEP + Actividades virtuales ────────────────────────────
    pep:         { ...formData.pep },
    actividades: { ...formData.actividades },

    // ── Sección 12 — Beneficiarios finales (GN_JURID_BF) ───────────────────
    beneficiarios: formData.beneficiarios.map(b => _omitir(b, ['_id'])),

    // ── Sección 13A — Firma del Representante Legal (GN_JURID_FIRMA) ────────
    // (ARCH_FIRMA se sube por separado vía /api/documentos/:numIden)
    firma: { ...formData.firma },
  };
}

/**
 * Devuelve una copia del objeto sin las claves indicadas.
 * @param {object}   obj
 * @param {string[]} claves  Claves a omitir
 */
function _omitir(obj, claves) {
  const r = { ...obj };
  claves.forEach(k => delete r[k]);
  return r;
}

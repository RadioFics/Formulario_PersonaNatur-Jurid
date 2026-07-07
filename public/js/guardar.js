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
  if (document.getElementById('row-vinc-otro')?.style.display !== 'none' && !formData.basica.OTR_VINC)
    errores.push('Información básica: Especifique el tipo de vinculación');
  if (!formData.basica.COD_CIIU)
    errores.push('Información básica: Actividad CIIU requerida');
  if (formData.basica.COD_CIIU === 'OTRO' && !formData.basica.OTR_CIIU)
    errores.push('Información básica: Especifique la actividad CIIU');
  if (formData.basica.COD_PAIS_EXP === 'OTRO' && !formData.basica.OTR_PAIS_EXP)
    errores.push('Información básica: Especifique el país de constitución');
  if (!formData.basica.DIR_TERC)
    errores.push('Información básica: Dirección requerida');
  if (!formData.basica.COT_BOLSA)
    errores.push('Información básica: Indique si cotiza en bolsa de valores');
  if (formData.basica.COT_BOLSA === 'S' && (!formData.basica.NOM_BOLSA || !String(formData.basica.NOM_BOLSA).trim()))
    errores.push('Información básica: Indique en cuál bolsa de valores cotiza');

  /* ── Sección 2: Representante legal ──────────────────────────────────── */
  const rp = formData.representantes[0];
  if (!rp.NOM_REPR) errores.push('Representante legal: Nombres del Principal requeridos');
  if (!rp.APE_REPR) errores.push('Representante legal: Apellidos del Principal requeridos');
  if (!rp.TIP_DOCU) errores.push('Representante legal: Tipo de documento del Principal requerido');
  if (rp.TIP_DOCU === 'OTR_TPDOC' && !rp.OTR_TPDOC) errores.push('Representante legal: Especifique el tipo de documento del Principal');
  if (!rp.NUM_DOCU) errores.push('Representante legal: Número de documento del Principal requerido');
  if (!rp.COD_PAIS) errores.push('Representante legal: País del Principal requerido');
  if (rp.COD_PAIS === 'OTRO' && !rp.OTR_PAIS) errores.push('Representante legal: Especifique el país del Principal');
  formData.representantes.slice(1).forEach((r, i) => {
    if (r.TIP_DOCU === 'OTR_TPDOC' && !r.OTR_TPDOC)
      errores.push(`Representante legal: Especifique el tipo de documento del Suplente ${i + 1}`);
    if (r.COD_PAIS === 'OTRO' && !r.OTR_PAIS)
      errores.push(`Representante legal: Especifique el país del Suplente ${i + 1}`);
  });

  /* ── Sección 3: Sociedad ─────────────────────────────────────────────── */
  if (!formData.sociedad.UBIC_SOC)
    errores.push('Información de la sociedad: Ubicación de la sociedad requerida');
  if (!formData.sociedad.TIP_EMPR)
    errores.push('Información de la sociedad: Tipo de empresa requerido');
  if (!formData.sociedad.GRUP_EMPR)
    errores.push('Información de la sociedad: Grupo empresarial requerido');
  if (formData.sociedad.UBIC_SOC === 'E' && !formData.sociedad.COD_PAIS_SOC)
    errores.push('Información de la sociedad: País requerido para empresa extranjera');
  if (formData.sociedad.UBIC_SOC === 'E' && formData.sociedad.COD_PAIS_SOC === 'OTRO' && !formData.sociedad.OTR_PAIS_SOC)
    errores.push('Información de la sociedad: Especifique el país de la empresa extranjera');
  if (formData.sociedad.UBIC_SOC === 'SC' && !formData.sociedad.COD_PAIS_ORIG_SOC)
    errores.push('Información de la sociedad: País de origen requerido para Sucursal en Colombia');
  if (formData.sociedad.UBIC_SOC === 'SC' && formData.sociedad.COD_PAIS_ORIG_SOC === 'OTRO' && !formData.sociedad.OTR_PAIS_ORIG_SOC)
    errores.push('Información de la sociedad: Especifique el país de origen de la sucursal');
  if (formData.sociedad.GRUP_EMPR === 'S') {
    if (!formData.sociedad.CTRL_DECLA)
      errores.push('Información de la sociedad: Indique si las situaciones de control están declaradas en el CERL');
    if (formData.sociedad.CTRL_DECLA === 'N') {
      if (!formData.sociedad.CAL_GRUPO)
        errores.push('Información de la sociedad: Calidad dentro del grupo empresarial requerida');
      if (!formData.sociedad.DESC_GRUPO)
        errores.push('Información de la sociedad: Descripción del grupo empresarial requerida');
    }
  }

  /* ── Sección 4: Países ───────────────────────────────────────────────── */
  if (!formData.paises.length || !formData.paises[0].COD_PAIS)
    errores.push('Países de operación: Seleccione al menos un país');
  if (formData.paises.some(p => !p.COD_PAIS))
    errores.push('Países de operación: Hay entradas sin país seleccionado');
  if (formData.paises.some(p => p.COD_PAIS === 'OTRO' && !p.OTR_PAIS))
    errores.push('Países de operación: Especifique el nombre del país en las entradas "Otro"');

  /* ── Sección 5: Cumplimiento ─────────────────────────────────────────── */
  if (!formData.cumplimiento.TIE_NORM)
    errores.push('Sistema de cumplimiento: Indique si está sujeta a normatividad LA/FT');
  if (!formData.cumplimiento.TIE_JUNTA)
    errores.push('Sistema de cumplimiento: Indique si tiene sistema de prevención de riesgos implementado');
  // Delega en el validador de sección: normativa, sistema de prevención (incl. "Otro"),
  // y oficiales de cumplimiento (incl. tipo de documento "Otro").
  if (typeof validarSeccionCumplimiento === 'function' && !validarSeccionCumplimiento())
    errores.push('Sistema de cumplimiento: Complete los campos obligatorios de normativa, sistema de prevención u oficiales de cumplimiento');

  /* ── Sección 6: Junta directiva ──────────────────────────────────────── */
  if (!formData.juntaDirectiva.TIE_JUNTA)
    errores.push('Junta directiva: Indique si tiene junta directiva o consejo de administración');
  if (formData.juntaDirectiva.TIE_JUNTA === 'S') {
    if (formData.juntaDirectiva.miembros.length === 0)
      errores.push('Junta directiva: Debe agregar al menos un miembro');
    else if (!validarSeccionJD())
      errores.push('Junta directiva: Complete los campos obligatorios de cada miembro');
  }

  /* ── Sección 7: Revisores fiscales ───────────────────────────────────── */
  if (!formData.revisores.TIE_REVIS)
    errores.push('Revisores fiscales: Indique si tiene revisor fiscal');
  if (formData.revisores.TIE_REVIS === 'S') {
    if (formData.revisores.revisores.length === 0)
      errores.push('Revisores fiscales: Debe agregar al menos un revisor');
    else if (!validarSeccionRF())
      errores.push('Revisores fiscales: Complete los campos obligatorios de cada revisor');
  }

  /* ── Sección 8: Composición accionaria ──────────────────────────────── */
  if (!formData.accionistas.length)
    errores.push('Composición accionaria: Registre al menos un accionista');
  else if (!validarSeccionAC())
    errores.push('Composición accionaria: Complete los campos obligatorios de cada accionista');
  // Sin restricción de suma al 100% — se acepta cualquier distribución.

  /* ── Sección 9: Financiera ───────────────────────────────────────────── */
  if (formData.financiera.ACT_TOTAL  === null) errores.push('Información financiera: Activos totales requeridos');
  if (formData.financiera.ING_MENS   === null) errores.push('Información financiera: Ingresos anuales requeridos');
  if (formData.financiera.PAS_TOTAL  === null) errores.push('Información financiera: Pasivos totales requeridos');
  if (formData.financiera.EGR_MENS   === null) errores.push('Información financiera: Egresos anuales requeridos');
  if (formData.financiera.PATRIMONIO === null) errores.push('Información financiera: Patrimonio requerido');

  /* ── Sección 10: Bancaria ────────────────────────────────────────────── */
  if (!formData.bancaria.length || !formData.bancaria[0].COD_BANCO)
    errores.push('Información bancaria: Registre al menos una cuenta bancaria');
  formData.bancaria.forEach((b, i) => {
    if (!b.COD_BANCO) errores.push(`Información bancaria: Cuenta ${i + 1} sin entidad bancaria`);
    if (document.getElementById(`field-banco_${b._id}_banco_otro`)?.style.display !== 'none' && !b.OTR_BANCO)
      errores.push(`Información bancaria: Cuenta ${i + 1}, especifique la entidad bancaria`);
    if (!b.TIP_CUEN)  errores.push(`Información bancaria: Cuenta ${i + 1} sin tipo de cuenta`);
    if (document.getElementById(`field-banco_${b._id}_tipcuen_otro`)?.style.display !== 'none' && !b.OTR_CUEN)
      errores.push(`Información bancaria: Cuenta ${i + 1}, especifique el tipo de cuenta`);
    if (!b.NUM_CUEN)  errores.push(`Información bancaria: Cuenta ${i + 1} sin número de cuenta`);
    if (b.CUEN_EXTR === 'S') {
      if (!b.cuentasExt || b.cuentasExt.length === 0)
        errores.push(`Información bancaria: Cuenta ${i + 1} debe registrar al menos una cuenta extranjera`);
      (b.cuentasExt || []).forEach((ext, j) => {
        if (!ext.COD_PAIS_EXT) errores.push(`Información bancaria: Cuenta ${i + 1}, cuenta extranjera ${j + 1} sin país`);
        if (ext.COD_PAIS_EXT === 'OTRO' && !ext.OTR_PAIS_EXT)
          errores.push(`Información bancaria: Cuenta ${i + 1}, cuenta extranjera ${j + 1}, especifique el país`);
        if (!ext.NOM_ENT_EXT)  errores.push(`Información bancaria: Cuenta ${i + 1}, cuenta extranjera ${j + 1} sin entidad`);
        if (!ext.TIP_CUE_EXT)  errores.push(`Información bancaria: Cuenta ${i + 1}, cuenta extranjera ${j + 1} sin tipo de cuenta`);
      });
    }
  });

  /* ── Sección 11: PEP + Activos virtuales ──────────────────────────────── */
  if (!formData.pep.MAN_RPUB)
    errores.push('PEP: Debe indicar si la empresa maneja recursos públicos');
  if (!formData.pep.CAR_PUBL)
    errores.push('PEP: Debe indicar si algún representante ejerció cargo público');
  if (!formData.actividades.OPER_VA)
    errores.push('Activos virtuales: Debe indicar si opera con activos virtuales');
  if (formData.actividades.CERT_INFO !== 'S')
    errores.push('Activos virtuales: Debe certificar la veracidad de la información');
  if (!document.getElementById('decl_juramento')?.checked)
    errores.push('Declaración: Debe declarar bajo juramento que la información es verídica');

  /* ── Sección 12: Beneficiarios finales ───────────────────────────────── */
  if (!formData.beneficiarios.length)
    errores.push('Beneficiarios finales: Registre al menos un beneficiario final');
  else if (!validarSeccionBF())
    errores.push('Beneficiarios finales: Complete los campos obligatorios de cada beneficiario');

  /* ── Sección 13: Documentos obligatorios ────────────────────────────── */
  if (typeof _archivos !== 'undefined') {
    const _docReqsFijos = [
      ['RUT',       'RUT — Registro Único Tributario'],
      ['CERT_BANC', 'Certificación bancaria'],
      ['CERT_EXIS', 'Certificado de existencia y representación'],
      ['CERT_ACCI', 'Certificado de composición accionaria'],
      ['CART_ACEP', 'Carta de aceptación y autorización'],
    ];
    _docReqsFijos.forEach(([clave, label]) => {
      if (!_archivos.has(clave))
        errores.push(`Documentos: Adjunte "${label}"`);
    });

    // Un doc. de identidad por cada RL registrado (claves dinámicas DOC_ID_RL_0, DOC_ID_RL_1, …)
    const rls = Array.isArray(formData.representantes) ? formData.representantes : [];
    rls.forEach((rl, idx) => {
      const clave = `DOC_ID_RL_${idx}`;
      if (!_archivos.has(clave)) {
        const nom = [rl.NOM_REPR, rl.APE_REPR].filter(Boolean).join(' ') ||
                    (idx === 0 ? 'RL Principal' : `RL Suplente ${idx}`);
        errores.push(`Documentos: Adjunte "Documento de identidad del Representante Legal" (${nom})`);
      }
    });

    // Estados financieros: Año 1 (penúltimo) y Año 2 (último) son obligatorios
    if (!_archivos.has('EST_FIN_1'))
      errores.push('Documentos: Adjunte "Estados financieros del penúltimo año fiscal"');
    if (!_archivos.has('EST_FIN_2'))
      errores.push('Documentos: Adjunte "Estados financieros del último año fiscal"');
  }

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
  if (msg.startsWith('Política de privacidad') || msg.startsWith('Declaración')) return null; // fuera de acordeones
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
 * @param {number|null} codTerc          COD_TERC devuelto por el servidor (para Excel)
 * @param {boolean}     esActualizacion
 * @param {string|null} codigoEdicion    Código de edición generado (solo en creación nueva)
 */
function _mostrarConfirmacion(numIden, codTerc, esActualizacion, codigoEdicion) {
  const modal = document.getElementById('confirmacion-modal');
  const idEl  = document.getElementById('confirm-num-iden');
  if (idEl) idEl.textContent = numIden;

  const titleEl = modal.querySelector('.confirm-title');
  const bodyEl  = modal.querySelector('.confirm-body');
  if (titleEl) titleEl.textContent = esActualizacion ? '¡Registro actualizado!' : '¡Registro enviado con éxito!';
  if (bodyEl)  bodyEl.innerHTML    = esActualizacion
    ? 'Los cambios han sido guardados correctamente en la base de datos.<br>Número de identificación:'
    : 'Su información SAGRILAFT ha sido registrada correctamente.<br>Guarde el siguiente número de identificación para sus registros:';

  // ── Código de edición (solo para registros nuevos) ────────────────────────
  let editCodeEl = document.getElementById('confirm-edit-code-box');
  if (!editCodeEl) {
    editCodeEl = document.createElement('div');
    editCodeEl.id = 'confirm-edit-code-box';
    editCodeEl.style.cssText = [
      'margin-top:16px', 'padding:14px 16px',
      'background:#fff8e1', 'border:1.5px solid #f0c040',
      'border-radius:8px', 'font-size:.88rem', 'color:#5a3e00',
    ].join(';');
    const idElRef = document.getElementById('confirm-num-iden');
    if (idElRef && idElRef.parentNode)
      idElRef.parentNode.insertBefore(editCodeEl, idElRef.nextSibling);
  }
  if (codigoEdicion && !esActualizacion) {
    editCodeEl.innerHTML =
      '<strong>⚠️ Código de edición:</strong> ' +
      `<code style="font-size:1.1rem;letter-spacing:.15em;background:#fff3cd;padding:2px 8px;border-radius:4px">${codigoEdicion}</code>` +
      '<br><span style="font-size:.8rem;color:#7a5800">Guarde este código — será necesario para editar este registro en el futuro.</span>';
    editCodeEl.style.display = 'block';
  } else {
    editCodeEl.style.display = 'none';
  }
  // ── Fin código de edición ────────────────────────────────────────────────

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
    if (typeof eliminarBorradorServidor === 'function') eliminarBorradorServidor();
    _mostrarConfirmacion(numIden, data.COD_TERC || null, false, data.codigoEdicion || null);

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
    // Recuperar código de edición desde sessionStorage (depositado al cargar el modo actualizar)
    const _codigoEdit = sessionStorage.getItem('sarlaft_edit_code') || '';
    const response = await fetch('/api/actualizar-completo', {
      method:  'PUT',
      headers: {
        'Content-Type': 'application/json',
        ..._codigoEdit ? { 'X-Codigo-Edicion': _codigoEdit } : {},
      },
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
    COT_BOLSA:    b.COT_BOLSA   || 'N',
    NOM_BOLSA:    b.COT_BOLSA === 'S' ? (b.NOM_BOLSA || null) : null,
    GMAIL_VERIF:  sessionStorage.getItem('SAGRILAFT_gmail') || null,
    ACE_POLI:     true,  // T&C aceptados
    IND_DECL:     document.getElementById('decl_juramento')?.checked ? 'S' : 'N',

    // ── Sección 3 — GN_JURID (sociedad) ────────────────────────────────────
    UBIC_SOC:          s.UBIC_SOC          || null,
    COD_PAIS_SOC:      s.COD_PAIS_SOC      || null,
    OTR_PAIS_SOC:      s.OTR_PAIS_SOC      || null,
    COD_PAIS_ORIG_SOC: s.COD_PAIS_ORIG_SOC || null,
    OTR_PAIS_ORIG_SOC: s.OTR_PAIS_ORIG_SOC || null,
    TIP_EMPR:     s.TIP_EMPR     || null,
    PCT_PART_MIXTA: s.PCT_PART_MIXTA || null,
    GRUP_EMPR:    s.GRUP_EMPR    || null,
    CTRL_DECLA:   s.CTRL_DECLA   || null,
    CAL_GRUPO:    s.CAL_GRUPO    || null,
    DESC_GRUPO:   s.DESC_GRUPO   || null,

    // ── Sección 2 — Representantes legales (GN_JURID_RL) ───────────────────
    representantes: formData.representantes.map(r => ({ ...r })),

    // ── Sección 4 — Países de operación (GN_JURID_PAIS) ────────────────────
    paises: formData.paises.filter(p => p.COD_PAIS || p.OTR_PAIS).map(p => ({ COD_PAIS: p.COD_PAIS, OTR_PAIS: p.OTR_PAIS || null })),

    // ── Sección 5 — Cumplimiento (GN_JURID_CUMP) ───────────────────────────
    TIE_NORM:       c.TIE_NORM    || 'N',
    DESC_NORM:      c.DESC_NORM   || null,
    cump_TIE_JUNTA: c.TIE_JUNTA  || 'N',
    SIS_PREVE:      c.SIS_PREVE   || null,
    OTR_PREVE:      c.OTR_PREVE   || null,
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

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
    errores.push('Información básica: Email SARLAFT inválido o vacío');
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
  if (!formData.sociedad.TIP_SOCIE)
    errores.push('Información de la sociedad: Tipo de sociedad requerido');
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
  const sumaAcc = formData.accionistas.reduce((s, a) => s + (parseFloat(a.PCT_PART) || 0), 0);
  if (formData.accionistas.length > 0 && Math.abs(sumaAcc - 100) > 0.01)
    errores.push(`Composición accionaria: La suma de participaciones es ${Math.round(sumaAcc * 100) / 100}% — debe ser 100%`);

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

  /* ── Sección 13: Firma ───────────────────────────────────────────────── */
  if (!formData.firma.NOM_FIRM)
    errores.push('Firma: Nombres del firmante requeridos');
  if (!formData.firma.APE_FIRM)
    errores.push('Firma: Apellidos del firmante requeridos');
  if (!formData.firma.TIP_DOCU)
    errores.push('Firma: Tipo de documento del firmante requerido');
  if (!formData.firma.NUM_DOCU)
    errores.push('Firma: Número de documento del firmante requerido');
  if (!formData.firma.FEC_FIRMA)
    errores.push('Firma: Fecha de firma requerida');

  return errores;
}

/* ════════════════════════════════════════════════════════════════════════════════
   UI — PANEL DE ERRORES
   ════════════════════════════════════════════════════════════════════════════════ */

/**
 * Muestra el panel de errores de validación global.
 * Cada error es clicable: hace scroll al primer campo con clase .error
 * dentro del acordeón correspondiente.
 *
 * @param {string[]} errores
 */
function mostrarErroresValidacion(errores) {
  const panel = document.getElementById('error-panel');
  const lista = document.getElementById('error-panel-list');
  lista.innerHTML = '';

  errores.forEach(msg => {
    const li = document.createElement('li');
    li.textContent = msg;
    li.addEventListener('click', () => {
      // Intentar hacer scroll al primer campo con error en el acordeón correspondiente
      const campo = document.querySelector('.field.error');
      if (campo) campo.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    lista.appendChild(li);
  });

  panel.style.display = 'block';
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
 * @param {string} numIden
 */
function _mostrarConfirmacion(numIden) {
  const modal = document.getElementById('confirmacion-modal');
  const idEl  = document.getElementById('confirm-num-iden');
  if (idEl) idEl.textContent = numIden;
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
  guardarFormulario();
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
    _actualizarProgreso(14, 15, 'Completado ✓');

    await new Promise(r => setTimeout(r, 500)); // pequeña pausa visual

    _cerrarProgresoModal();

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const msg  = data.error || `Error HTTP ${response.status}`;
      _mostrarErrorGuardado(msg);
      return;
    }

    const data    = await response.json();
    const numIden = data.NUM_IDEN || payload.NUM_IDEN;

    // ── Subir archivos adjuntos si hay alguno seleccionado ───────────────────
    if (typeof hayArchivosSeleccionados === 'function' && hayArchivosSeleccionados()) {
      try {
        _actualizarProgreso(15, 15, 'Subiendo documentos adjuntos…');
        const fd = construirFormDataArchivos(numIden);
        await fetch(`/api/documentos/${encodeURIComponent(numIden)}`, {
          method: 'POST',
          body:   fd,
          // No establecer Content-Type: el navegador lo fija automáticamente con boundary
        });
      } catch (docErr) {
        console.warn('guardarFormulario() — subida de documentos falló:', docErr);
        // No bloqueamos: los datos textuales ya están guardados en BD
        mostrarToast('Datos guardados. Algunos documentos adjuntos no pudieron subirse.', 'warning');
      }
    }

    borrarBorrador();
    _mostrarConfirmacion(numIden);

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
    MAIL_SARL:    b.MAIL_SARL   || null,
    COD_CIIU:     b.COD_CIIU    || null,
    URL_WEB:      b.URL_WEB     || null,

    // ── Sección 3 — GN_JURID (sociedad) ────────────────────────────────────
    UBIC_SOC:     s.UBIC_SOC    || null,
    COD_PAIS_SOC: s.COD_PAIS_SOC|| null,
    TIP_EMPR:     s.TIP_EMPR    || null,
    GRUP_EMPR:    s.GRUP_EMPR   || null,
    REL_GRUPO:    s.REL_GRUPO   || null,
    TIP_SOCIE:    s.TIP_SOCIE   || null,

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
    oficiales:      c.oficiales.map(o => ({ ...o })),

    // ── Sección 6 — Junta directiva (GN_JURID_JD) ──────────────────────────
    jd_TIE_JUNTA:  jd.TIE_JUNTA || 'N',
    juntaDirectiva: jd.miembros.map(m => ({
      Principal: _omitir(m.Principal, []),
      Suplente:  _omitir(m.Suplente,  []),
    })),

    // ── Sección 7 — Revisores fiscales (GN_JURID_RF) ───────────────────────
    rf_TIE_REVIS: rf.TIE_REVIS || 'N',
    revisores:    rf.revisores.map(r => ({
      REVI_FIRMA:   r.REVI_FIRMA   || 'N',
      RAZ_FIRMA:    r.RAZ_FIRMA    || null,
      TIP_DOCU_FIR: r.TIP_DOCU_FIR || null,
      NUM_DOCU_FIR: r.NUM_DOCU_FIR || null,
      Principal:    _omitir(r.Principal, []),
      Suplente:     _omitir(r.Suplente,  []),
    })),

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

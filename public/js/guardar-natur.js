'use strict';
/**
 * guardar-natur.js — Guardado y exportación de Persona Natural.
 *
 * Expone:
 *  · validarTodoNatural()       — valida todas las secciones del modo N
 *  · guardarFormularioNatural() — POST /api/guardar-completo-natural
 *
 * Parcha onSubmitClick() y reintentarGuardado() de guardar.js para
 * bifurcar según window.modoPersona.
 *
 * El Excel para Natural se descarga vía /api/exportar-excel-natural/:codTerc
 * (ya manejado por descargarExcel() en formulario.html una vez que
 *  btn-descargar-excel tenga dataset.tipoTerc = 'N').
 *
 * Depende de: state.js, state-natur.js, utils.js,
 *             seccion-natur-basica.js, seccion-financiera.js,
 *             seccion-bancaria.js, seccion-pep.js, guardar.js
 */

/* ══════════════════════════════════════════════════════════════════════════════
   Validación completa — modo Natural
══════════════════════════════════════════════════════════════════════════════ */

/**
 * Valida todas las secciones visibles en modo Persona Natural.
 * @returns {string[]}  Array de mensajes de error (vacío = OK)
 */
function validarTodoNatural() {
  const errores = [];

  // ── Sección 1: Básica ─────────────────────────────────────────────────────
  const n  = formDataNatur.basica;
  const db = formData.basica;

  if (!db.COD_VINC)   errores.push('Sección 1: Tipo de vinculación requerido');
  if (document.getElementById('row-vinc-otro')?.style.display !== 'none' && !db.OTR_VINC)
    errores.push('Sección 1: Especifique el tipo de vinculación');
  if (!db.COD_TPDOC)  errores.push('Sección 1: Tipo de documento requerido');
  if (db.COD_TPDOC === 'OTR_TPDOC' && !db.OTR_TPDOC) errores.push('Sección 1: Especifique el tipo de documento');
  if (!db.NUM_IDEN)   errores.push('Sección 1: Número de documento requerido');
  if (!n.NOM_TERC)    errores.push('Sección 1: Primer nombre requerido');
  if (!n.APE_TERC)    errores.push('Sección 1: Primer apellido requerido');
  if (!n.COD_PAIS_EXP) errores.push('Sección 1: País de expedición requerido');
  if (n.COD_PAIS_EXP === 'OTRO' && !n.OTR_PAIS_EXP) errores.push('Sección 1: Especifique el país de expedición');
  if (!n.COD_DEPT_EXP) errores.push('Sección 1: Departamento de expedición requerido');
  if (!n.COD_MPIO_EXP) errores.push('Sección 1: Ciudad de expedición requerida');
  if (!db.DIR_TERC)   errores.push('Sección 1: Dirección requerida');
  if (!db.TEL_TERC)   errores.push('Sección 1: Teléfono celular requerido');
  if (!db.DIR_MAIL || !esEmailValido(db.DIR_MAIL))
    errores.push('Sección 1: Email corporativo inválido o vacío');
  if (!n.FEC_EXPE)    errores.push('Sección 1: Fecha de expedición requerida');
  if (!n.COD_NACIO)   errores.push('Sección 1: Nacionalidad requerida');
  if (n.COD_NACIO === 'OTRO' && !n.OTR_NACIO) errores.push('Sección 1: Especifique la nacionalidad');
  if (!n.COD_CIIU)    errores.push('Sección 1: Actividad CIIU requerida');
  if (n.COD_CIIU === 'OTRO' && !n.OTR_CIIU) errores.push('Sección 1: Especifique la actividad CIIU');

  // ── Sección 9N: Participación en sociedades ───────────────────────────────
  const bfn = formDataNatur.beneficiariosN || {};
  if (!bfn.PART_SOC)
    errores.push('Sección 9: Indique si tiene participación en alguna sociedad');
  if (bfn.PART_SOC === 'S') {
    if (!bfn.RAZ_SOC     || !String(bfn.RAZ_SOC).trim())     errores.push('Sección 9: Razón social de la sociedad requerida');
    if (!bfn.TIP_DOC_SOC)                                     errores.push('Sección 9: Tipo de documento de la sociedad requerido');
    if (bfn.TIP_DOC_SOC === 'OTR_TPDOC' && (!bfn.OTR_TIP_DOC_SOC || !String(bfn.OTR_TIP_DOC_SOC).trim()))
                                                              errores.push('Sección 9: Especifique el tipo de documento de la sociedad');
    if (!bfn.NUM_DOC_SOC || !String(bfn.NUM_DOC_SOC).trim()) errores.push('Sección 9: Número de documento de la sociedad requerido');
  }

  // ── Sección 9: Financiera ─────────────────────────────────────────────────
  const fin = formData.financiera;
  if (fin.ACT_TOTAL  === null) errores.push('Información financiera: Activos totales requeridos');
  if (fin.ING_MENS   === null) errores.push('Información financiera: Ingresos anuales requeridos');
  if (fin.PAS_TOTAL  === null) errores.push('Información financiera: Pasivos totales requeridos');
  if (fin.EGR_MENS   === null) errores.push('Información financiera: Egresos anuales requeridos');
  if (fin.PATRIMONIO === null) errores.push('Información financiera: Patrimonio requerido');

  // ── Sección 10: Bancaria ──────────────────────────────────────────────────
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

  // ── Sección 11: PEP + Actividades ─────────────────────────────────────────
  if (!formData.pep.MAN_RPUB)
    errores.push('PEP: Indique si maneja recursos públicos');
  if (!formData.pep.CAR_PUBL)
    errores.push('PEP: Indique si ejerció cargo público');
  if (!formData.actividades.OPER_VA)
    errores.push('Activos virtuales: Debe indicar si opera con activos virtuales');
  if (formData.actividades.CERT_INFO !== 'S')
    errores.push('Activos virtuales: Debe certificar la veracidad de la información');
  if (!document.getElementById('decl_juramento')?.checked)
    errores.push('Declaración: Debe declarar bajo juramento que la información es verídica');

  return errores;
}

/* ══════════════════════════════════════════════════════════════════════════════
   Construcción del payload
══════════════════════════════════════════════════════════════════════════════ */

function _construirPayloadNatural() {
  const db  = formData.basica;
  const n   = formDataNatur.basica;
  const bfn = formDataNatur.beneficiariosN || {};
  const fin = formData.financiera;
  const pep = formData.pep;
  const act = formData.actividades;

  return {
    // ── GN_TERCE ────────────────────────────────────────────────────────────
    COD_TPDOC: db.COD_TPDOC,
    NUM_IDEN:  db.NUM_IDEN,
    NOM_TERC:  n.NOM_TERC,
    SEG_NOMB:  n.SEG_NOMB,
    APE_TERC:  n.APE_TERC,
    SEG_APEL:  n.SEG_APEL,
    DIR_TERC:  db.DIR_TERC,
    TEL_TERC:  db.TEL_TERC,
    TEL_TERC2: db.TEL_TERC2,
    DIR_MAIL:  db.DIR_MAIL,
    // ── GN_NATUR ────────────────────────────────────────────────────────────
    COD_VINC:     db.COD_VINC,     // → TIP_VINC en GN_NATUR
    OTR_TPDOC:    db.OTR_TPDOC,
    MAIL_SARL:    n.MAIL_SARL,
    GMAIL_VERIF:  sessionStorage.getItem('SAGRILAFT_gmail') || null,
    COD_NACIO:    n.COD_NACIO,
    OTR_NACIO:    n.OTR_NACIO,
    COD_CIIU:     n.COD_CIIU,
    FEC_EXPE:     n.FEC_EXPE,
    COD_PAIS_EXP: n.COD_PAIS_EXP,
    OTR_PAIS_EXP: n.OTR_PAIS_EXP,
    COD_DEPT_EXP: n.COD_DEPT_EXP,
    COD_MPIO_EXP: n.COD_MPIO_EXP,
    // ── Participación en sociedades (sección 9N) ────────────────────────────
    PART_SOC:        bfn.PART_SOC    || 'N',
    RAZ_SOC:         bfn.PART_SOC === 'S' ? (bfn.RAZ_SOC          || null) : null,
    TIP_DOC_SOC:     bfn.PART_SOC === 'S' ? (bfn.TIP_DOC_SOC      || null) : null,
    OTR_TIP_DOC_SOC: bfn.PART_SOC === 'S' ? (bfn.OTR_TIP_DOC_SOC || null) : null,
    NUM_DOC_SOC:     bfn.PART_SOC === 'S' ? (bfn.NUM_DOC_SOC      || null) : null,
    // ── Secciones compartidas ───────────────────────────────────────────────
    financiera: fin,
    bancaria:   formData.bancaria,
    pep: {
      MAN_RPUB: pep.MAN_RPUB,
      CAR_PUBL: pep.CAR_PUBL,
    },
    actividades: {
      OPER_VA:      act.OPER_VA      || 'N',
      ACT_VA_FIAT:  act.ACT_VA_FIAT  || 'N',
      ACT_VA_VA:    act.ACT_VA_VA    || 'N',
      ACT_TRANS:    act.ACT_TRANS    || 'N',
      ACT_CUSTO:    act.ACT_CUSTO    || 'N',
      ACT_SERV_FIN: act.ACT_SERV_FIN || 'N',
      ACT_SERV_VAP: act.ACT_SERV_VAP || 'N',
      CERT_INFO:    act.CERT_INFO    || 'N',
    },
    documentos: formData.documentos,
    ACE_POLI:   true,  // T&C aceptados (verificado en index.html)
    IND_DECL:   document.getElementById('decl_juramento')?.checked ? 'S' : 'N',
  };
}

/* ══════════════════════════════════════════════════════════════════════════════
   Guardado principal
══════════════════════════════════════════════════════════════════════════════ */

/**
 * Valida, construye el payload y llama a POST /api/guardar-completo-natural.
 */
async function guardarFormularioNatural() {
  const btnSubmit = document.getElementById('btn-submit');
  if (btnSubmit) btnSubmit.disabled = true;

  _mostrarProgresoModal();

  try {
    const payload = _construirPayloadNatural();

    const resp = await fetch('/api/guardar-completo-natural', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    clearInterval(_progresoTimer);
    _actualizarProgreso(8, 9, 'Datos guardados ✓');

    if (!resp.ok) {
      await new Promise(r => setTimeout(r, 300));
      _cerrarProgresoModal();
      const errData = await resp.json().catch(() => ({}));
      _mostrarErrorGuardado(errData.error || `Error HTTP ${resp.status}`);
      return;
    }

    const data    = await resp.json();
    const numIden = data.NUM_IDEN || formData.basica.NUM_IDEN;

    // ── Subir archivos adjuntos con progreso real ──────────────────────────
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
        console.warn('guardarFormularioNatural() — subida de documentos falló:', docErr);
        docWarning = 'Error de red al subir documentos';
      }
    }

    await new Promise(r => setTimeout(r, 400));
    _cerrarProgresoModal();

    if (docWarning) {
      mostrarToast(`Datos guardados. Documentos rechazados: ${docWarning}`, 'warning');
    }

    // Limpiar estado post-envío
    if (typeof _archivos !== 'undefined') _archivos.clear();
    borrarBorrador();

    // ── Pantalla de confirmación ───────────────────────────────────────────
    const nombreCompleto = [
      formDataNatur.basica.NOM_TERC,
      formDataNatur.basica.SEG_NOMB,
      formDataNatur.basica.APE_TERC,
      formDataNatur.basica.SEG_APEL,
    ].filter(Boolean).join(' ');

    _mostrarConfirmacion(nombreCompleto || numIden, data.COD_TERC);

    const btnExcel = document.getElementById('btn-descargar-excel');
    if (btnExcel) {
      btnExcel.dataset.codTerc  = data.COD_TERC;
      btnExcel.dataset.tipoTerc = 'N';
      btnExcel.style.display    = '';
    }

    console.log('✅ Persona Natural guardada. COD_TERC:', data.COD_TERC);

  } catch (err) {
    clearInterval(_progresoTimer);
    _cerrarProgresoModal();
    _mostrarErrorGuardado(err.message || 'Error al conectar con el servidor.');
    console.error('guardarFormularioNatural:', err);
  } finally {
    if (btnSubmit) btnSubmit.disabled = false;
  }
}

/* ══════════════════════════════════════════════════════════════════════════════
   Actualización de registro existente — modo Natural
══════════════════════════════════════════════════════════════════════════════ */

/**
 * Actualiza un registro de Persona Natural existente — PUT /api/actualizar-completo-natural.
 * Usa el mismo payload que guardarFormularioNatural() pero método PUT.
 */
async function actualizarFormularioNatural() {
  const btnSubmit = document.getElementById('btn-submit');
  if (btnSubmit) btnSubmit.disabled = true;

  _mostrarProgresoModal();

  try {
    const payload = _construirPayloadNatural();

    const _codigoEdit = sessionStorage.getItem('sarlaft_edit_code') || '';
    const resp = await fetch('/api/actualizar-completo-natural', {
      method:  'PUT',
      headers: {
        'Content-Type': 'application/json',
        ..._codigoEdit ? { 'X-Codigo-Edicion': _codigoEdit } : {},
      },
      body:    JSON.stringify(payload),
    });

    clearInterval(_progresoTimer);
    _actualizarProgreso(8, 9, 'Cambios guardados ✓');

    if (!resp.ok) {
      await new Promise(r => setTimeout(r, 300));
      _cerrarProgresoModal();
      const errData = await resp.json().catch(() => ({}));
      _mostrarErrorGuardado(errData.error || `Error HTTP ${resp.status}`);
      return;
    }

    const data = await resp.json();

    // Subir archivos si hay nuevos seleccionados
    let docWarning = null;
    if (typeof hayArchivosSeleccionados === 'function' && hayArchivosSeleccionados()) {
      try {
        _actualizarProgreso(0, 100, 'Subiendo documentos (0%)…');
        const fd     = construirFormDataArchivos(payload.NUM_IDEN);
        const docRes = await _subirArchivosConProgreso(fd, payload.NUM_IDEN);
        _actualizarProgreso(100, 100, 'Documentos subidos ✓');
        if (!docRes.ok) {
          const docData  = JSON.parse(docRes.responseText || '{}');
          const detalles = Array.isArray(docData.detalles) ? docData.detalles.join(' | ') : '';
          docWarning = detalles || docData.error || 'Archivos rechazados por el servidor';
        }
      } catch (docErr) {
        docWarning = 'Error de red al subir documentos';
      }
    }

    await new Promise(r => setTimeout(r, 400));
    _cerrarProgresoModal();

    if (docWarning) mostrarToast(`Cambios guardados. Documentos rechazados: ${docWarning}`, 'warning');
    if (typeof _archivos !== 'undefined') _archivos.clear();
    borrarBorrador();
    if (typeof eliminarBorradorServidor === 'function') eliminarBorradorServidor();

    _mostrarConfirmacion(payload.NUM_IDEN, data.COD_TERC, true);
    console.log('✅ Persona Natural actualizada. COD_TERC:', data.COD_TERC);

  } catch (err) {
    clearInterval(_progresoTimer);
    _cerrarProgresoModal();
    _mostrarErrorGuardado(err.message || 'Error al conectar con el servidor.');
    console.error('actualizarFormularioNatural:', err);
  } finally {
    if (btnSubmit) btnSubmit.disabled = false;
  }
}

/* ══════════════════════════════════════════════════════════════════════════════
   Parches de guardar.js
══════════════════════════════════════════════════════════════════════════════ */

/**
 * Parcha onSubmitClick() para bifurcar según modoPersona y modo actualizar.
 */
(function patchOnSubmitClick() {
  const _orig = window.onSubmitClick;
  window.onSubmitClick = function () {
    if (window.modoPersona !== 'N') {
      return _orig && _orig();
    }
    // ── Modo Natural ──────────────────────────────────────────────────────
    ocultarErroresValidacion();
    const errores = validarTodoNatural();
    if (errores.length > 0) {
      mostrarErroresValidacion(errores);
      mostrarToast(`Hay ${errores.length} campo(s) por completar.`, 'error');
      return;
    }
    if (typeof _esModoActualizar !== 'undefined' && _esModoActualizar) {
      actualizarFormularioNatural();
    } else {
      guardarFormularioNatural();
    }
  };
})();

/**
 * Parcha reintentarGuardado() para usar el guardado correcto.
 */
(function patchReintentarGuardado() {
  window.reintentarGuardado = function () {
    cerrarErrorGuardado();
    if (window.modoPersona === 'N') {
      guardarFormularioNatural();
    } else {
      guardarFormulario();
    }
  };
})();

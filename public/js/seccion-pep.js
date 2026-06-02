/**
 * seccion-pep.js — Sección 11: "PEP y Actividades con activos virtuales"
 *
 * Dos sub-secciones:
 *  A) Exposición Política (PEP)
 *     · MAN_RPUB — radio Sí/No — requerido (no tiene valor por defecto)
 *     · CAR_PUBL — radio Sí/No — requerido (no tiene valor por defecto)
 *
 *  B) Actividades con activos virtuales
 *     · 6 checkboxes independientes (arrancan en 'N')
 *     · CERT_INFO — checkbox de certificación obligatoria (bloquea envío si no marcado)
 *
 * State: formData.pep + formData.actividades
 * Depende de: state.js, utils.js
 */
'use strict';

/* ── Actualización de estado ─────────────────────────────────────────────────── */

/** Escribe en formData.pep[campo]. */
function actualizarPEP(campo, valor) {
  formData.pep[campo] = valor;
  limpiarError(`field-pep_${campo.toLowerCase()}`);
}

/** Escribe en formData.actividades[campo]. */
function actualizarActividad(campo, valor) {
  formData.actividades[campo] = valor;
  if (campo === 'CERT_INFO') {
    limpiarError('field-cert_info');
  }
}

/* ── Validación ─────────────────────────────────────────────────────────────── */
function validarSeccionPEP() {
  let ok = true;

  // Sub-sección A: PEP
  if (!formData.pep.MAN_RPUB) {
    mostrarError('field-pep_man_rpub'); ok = false;
  }
  if (!formData.pep.CAR_PUBL) {
    mostrarError('field-pep_car_publ'); ok = false;
  }

  // Sub-sección B: Certificación (los checkboxes de actividades son opcionales)
  if (formData.actividades.CERT_INFO !== 'S') {
    mostrarError('field-cert_info');
    mostrarToast('Debe certificar la veracidad de la información para continuar.', 'error');
    ok = false;
  }

  return ok;
}

/* ── Acciones de botones ────────────────────────────────────────────────────── */
function validarYContinuarPEP() {
  if (!validarSeccionPEP()) {
    document.getElementById('accordion-pep').classList.remove('collapsed');
    const primerError = document.querySelector('#accordion-pep .field.error');
    if (primerError) primerError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  mostrarToast('Sección 11 completa. Continúe con la siguiente sección.', 'success');
  document.getElementById('accordion-pep').classList.add('collapsed');
  const acc12 = document.getElementById('accordion-bf');
  if (acc12) {
    acc12.classList.remove('collapsed');
    acc12.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  console.log('✅ formData.pep:', JSON.stringify(formData.pep, null, 2));
  console.log('✅ formData.actividades:', JSON.stringify(formData.actividades, null, 2));
}

function limpiarSeccionPEP() {
  // PEP
  formData.pep = { MAN_RPUB: null, CAR_PUBL: null };
  document.querySelectorAll('input[name="pep_man_rpub"], input[name="pep_car_publ"]')
          .forEach(r => { r.checked = false; });
  limpiarError('field-pep_man_rpub');
  limpiarError('field-pep_car_publ');

  // Actividades
  formData.actividades = {
    ACT_VA_FIAT: 'N', ACT_VA_VA: 'N', ACT_TRANS: 'N',
    ACT_CUSTO: 'N', ACT_SERV_FIN: 'N', ACT_SERV_VAP: 'N', CERT_INFO: 'N',
  };
  ['act_va_fiat','act_va_va','act_trans','act_custo',
   'act_serv_fin','act_serv_vap','cert_info'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.checked = false;
  });
  limpiarError('field-cert_info');

  mostrarToast('Sección limpiada.', 'success');
}

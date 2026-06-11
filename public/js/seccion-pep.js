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

  if (!formData.pep.MAN_RPUB) {
    mostrarError('field-pep_man_rpub'); ok = false;
  }
  if (!formData.pep.CAR_PUBL) {
    mostrarError('field-pep_car_publ'); ok = false;
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
  const accVA = document.getElementById('accordion-va');
  if (accVA) {
    accVA.classList.remove('collapsed');
    accVA.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  console.log('✅ formData.pep:', JSON.stringify(formData.pep, null, 2));
}

function limpiarSeccionPEP() {
  formData.pep = { MAN_RPUB: null, CAR_PUBL: null };
  document.querySelectorAll('input[name="pep_man_rpub"], input[name="pep_car_publ"]')
          .forEach(r => { r.checked = false; });
  limpiarError('field-pep_man_rpub');
  limpiarError('field-pep_car_publ');
  mostrarToast('Sección limpiada.', 'success');
}

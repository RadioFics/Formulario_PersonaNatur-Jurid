/**
 * seccion-va.js — Sección 12: "Actividades con activos virtuales"
 *
 * · 6 checkboxes independientes (arrancan en 'N')
 * · CERT_INFO — checkbox de certificación obligatoria
 *
 * State: formData.actividades
 * Depende de: state.js, utils.js
 */
'use strict';

/* ── OPER_VA — toggle checkboxes wrapper ────────────────────────────────── */
function actualizarOperVA(valor) {
  formData.actividades.OPER_VA = valor;
  const wrap = document.getElementById('va-checkboxes-wrap');
  if (!wrap) return;
  if (valor === 'S') {
    wrap.style.display = '';
  } else {
    wrap.style.display = 'none';
    ['act_va_fiat', 'act_va_va', 'act_trans', 'act_custo', 'act_serv_fin', 'act_serv_vap'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.checked = false;
    });
    formData.actividades.ACT_VA_FIAT  = 'N';
    formData.actividades.ACT_VA_VA    = 'N';
    formData.actividades.ACT_TRANS    = 'N';
    formData.actividades.ACT_CUSTO    = 'N';
    formData.actividades.ACT_SERV_FIN = 'N';
    formData.actividades.ACT_SERV_VAP = 'N';
  }
}

/* ── Validación ─────────────────────────────────────────────────────────── */
function validarSeccionVA() {
  if (formData.actividades.CERT_INFO !== 'S') {
    mostrarError('field-cert_info');
    mostrarToast('Debe certificar la veracidad de la información para continuar.', 'error');
    return false;
  }
  return true;
}

/* ── Acciones de botones ────────────────────────────────────────────────── */
function validarYContinuarVA() {
  if (!validarSeccionVA()) {
    document.getElementById('accordion-va').classList.remove('collapsed');
    const primerError = document.querySelector('#accordion-va .field.error');
    if (primerError) primerError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  document.getElementById('accordion-va').classList.add('collapsed');

  if (window.modoPersona === 'N') {
    mostrarToast('Sección 13 completa. Continúe con los documentos.', 'success');
    const accDocs = document.getElementById('accordion-docs');
    if (accDocs) {
      accDocs.classList.remove('collapsed');
      accDocs.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  } else {
    mostrarToast('Sección 13 completa. Continúe con los documentos.', 'success');
    const accDocs2 = document.getElementById('accordion-docs');
    if (accDocs2) {
      accDocs2.classList.remove('collapsed');
      accDocs2.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  console.log('✅ formData.actividades:', JSON.stringify(formData.actividades, null, 2));
}

function limpiarSeccionVA() {
  formData.actividades = {
    OPER_VA: 'N',
    ACT_VA_FIAT: 'N', ACT_VA_VA: 'N', ACT_TRANS: 'N',
    ACT_CUSTO: 'N', ACT_SERV_FIN: 'N', ACT_SERV_VAP: 'N', CERT_INFO: 'N',
  };
  const radioNo = document.querySelector('input[name="oper_va"][value="N"]');
  if (radioNo) radioNo.checked = true;
  const wrap = document.getElementById('va-checkboxes-wrap');
  if (wrap) wrap.style.display = 'none';
  ['act_va_fiat', 'act_va_va', 'act_trans', 'act_custo',
   'act_serv_fin', 'act_serv_vap', 'cert_info'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.checked = false;
  });
  limpiarError('field-cert_info');
  mostrarToast('Sección limpiada.', 'success');
}

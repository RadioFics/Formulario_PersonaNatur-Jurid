'use strict';
/**
 * seccion-bf-natur.js — Sección 9N: Participación en sociedades (solo Persona Natural).
 *
 * Pregunta si la persona posee participación en alguna sociedad o es
 * beneficiario final de ella. Si responde Sí, muestra:
 *   RAZ_SOC     — Razón social de la sociedad
 *   TIP_DOC_SOC — Tipo de documento (NIT o equivalente)
 *   NUM_DOC_SOC — Número de documento
 *
 * Estado: formDataNatur.beneficiariosN
 * DB:     columnas PART_SOC, RAZ_SOC, TIP_DOC_SOC, NUM_DOC_SOC en GN_NATUR
 *
 * Depende de: state-natur.js, utils.js
 */

/* ── Actualización de estado ──────────────────────────────────────────────── */

function actualizarBFN(campo, valor) {
  if (!formDataNatur.beneficiariosN) formDataNatur.beneficiariosN = {};
  formDataNatur.beneficiariosN[campo] = valor === '' ? null : valor;
  guardarBorradorDebounced();
}

/* ── Mostrar / ocultar campos condicionales ───────────────────────────────── */

function onPartSocChange(valor) {
  actualizarBFN('PART_SOC', valor);
  const wrap = document.getElementById('bfn-fields-wrap');
  if (!wrap) return;
  if (valor === 'S') {
    wrap.style.display = '';
  } else {
    wrap.style.display = 'none';
    ['RAZ_SOC', 'TIP_DOC_SOC', 'NUM_DOC_SOC'].forEach(c => actualizarBFN(c, null));
    const razInp = document.getElementById('bfn_raz_soc');
    const tdSel  = document.getElementById('bfn_tip_doc_soc');
    const numInp = document.getElementById('bfn_num_doc_soc');
    if (razInp) razInp.value = '';
    if (tdSel)  tdSel.value = '';
    if (numInp) numInp.value = '';
    ['field-bfn_raz_soc', 'field-bfn_tip_doc_soc', 'field-bfn_num_doc_soc']
      .forEach(id => limpiarError(id));
  }
}

/* ── Validación ───────────────────────────────────────────────────────────── */

function validarBFNatural() {
  const bfn = (formDataNatur && formDataNatur.beneficiariosN) || {};
  if (bfn.PART_SOC !== 'S') return true;
  let ok = true;
  if (!bfn.RAZ_SOC     || !String(bfn.RAZ_SOC).trim())     { mostrarError('field-bfn_raz_soc');     ok = false; }
  if (!bfn.TIP_DOC_SOC)                                     { mostrarError('field-bfn_tip_doc_soc'); ok = false; }
  if (!bfn.NUM_DOC_SOC || !String(bfn.NUM_DOC_SOC).trim()) { mostrarError('field-bfn_num_doc_soc'); ok = false; }
  return ok;
}

/* ── Limpiar sección ──────────────────────────────────────────────────────── */

function limpiarSeccionBFN() {
  if (!formDataNatur.beneficiariosN) formDataNatur.beneficiariosN = {};
  Object.assign(formDataNatur.beneficiariosN, {
    PART_SOC: 'N', RAZ_SOC: null, TIP_DOC_SOC: null, NUM_DOC_SOC: null,
  });
  const radioNo = document.querySelector('input[name="part_soc"][value="N"]');
  if (radioNo) radioNo.checked = true;
  const wrap = document.getElementById('bfn-fields-wrap');
  if (wrap) wrap.style.display = 'none';
  const razInp = document.getElementById('bfn_raz_soc');
  const tdSel  = document.getElementById('bfn_tip_doc_soc');
  const numInp = document.getElementById('bfn_num_doc_soc');
  if (razInp) razInp.value = '';
  if (tdSel)  tdSel.value = '';
  if (numInp) numInp.value = '';
  document.querySelectorAll('#accordion-bf-n .field.error').forEach(f => f.classList.remove('error'));
  mostrarToast(typeof t === 'function' ? t('toast_sec_clear') : 'Sección limpiada.', 'success');
}

/* ── Continuar → sección 10 ──────────────────────────────────────────────── */

function validarYContinuarBFN() {
  if (!validarBFNatural()) {
    document.getElementById('accordion-bf-n').classList.remove('collapsed');
    mostrarToast(
      typeof t === 'function' ? t('toast_check_fields') : 'Corrija los campos marcados en rojo.',
      'error'
    );
    const primerError = document.querySelector('#accordion-bf-n .field.error');
    if (primerError) primerError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  mostrarToast('Sección 9 completa. Continúe con la siguiente sección.', 'success');
  document.getElementById('accordion-bf-n').classList.add('collapsed');
  const acc10 = document.getElementById('accordion-financiera');
  if (acc10) { acc10.classList.remove('collapsed'); acc10.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  console.log('✅ formDataNatur.beneficiariosN:', JSON.stringify(formDataNatur.beneficiariosN, null, 2));
}

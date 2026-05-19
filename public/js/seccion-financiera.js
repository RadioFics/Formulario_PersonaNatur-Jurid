/**
 * seccion-financiera.js — Sección 9: "Información financiera"
 *
 * Campos monetarios COP con:
 *  · Formateo visual en blur (1.234.567,00)
 *  · Almacenamiento como float limpio
 *  · No se aceptan valores negativos
 *  · Patrimonio calculado automáticamente = ACT_TOTAL − PAS_TOTAL
 *    (se desconecta si el usuario edita PATRIMONIO manualmente)
 *
 * State: formData.financiera
 * Depende de: state.js, utils.js
 */
'use strict';

/* ── Flag de edición manual del patrimonio ────────────────────────────────────── */
let _patrimonioManual = false;

/* ── Utilidades de formateo ─────────────────────────────────────────────────── */

/**
 * Formatea un número como moneda COP: 1.234.567,00
 * @param {number|null} valor
 * @returns {string}
 */
function _fmtMoneda(valor) {
  if (valor === null || valor === undefined || valor === '') return '';
  const n = typeof valor === 'number' ? valor : parseFloat(String(valor));
  if (isNaN(n)) return '';
  return n.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Parsea una cadena formateada como moneda COP a float limpio.
 * Acepta: "1.234.567,00" → 1234567.00
 * @param {string} str
 * @returns {number|null}
 */
function _parseMoneda(str) {
  if (!str || !String(str).trim()) return null;
  const limpio = String(str).replace(/\./g, '').replace(',', '.');
  const n = parseFloat(limpio);
  return isNaN(n) ? null : n;
}

/* ── Handlers de campo monetario ─────────────────────────────────────────────── */

/**
 * Reacciona al evento `input` de un campo monetario.
 * Almacena el valor raw en formData.financiera[campo].
 * Dispara el recálculo automático de patrimonio si aplica.
 *
 * @param {string}      campo   Clave en formData.financiera
 * @param {HTMLElement} inputEl El elemento <input>
 */
function onMonedaInput(campo, inputEl) {
  const raw = _parseMoneda(inputEl.value);
  formData.financiera[campo] = raw;
  if (campo === 'ACT_TOTAL' || campo === 'PAS_TOTAL') {
    _recalcPatrimonio();
  }
}

/**
 * Reacciona al evento `blur` de un campo monetario.
 * Formatea el valor almacenado en la representación visual COP.
 *
 * @param {string}      campo
 * @param {HTMLElement} inputEl
 */
function onMonedaBlur(campo, inputEl) {
  const raw = formData.financiera[campo];
  if (raw !== null && raw < 0) {
    // Rechazar negativos: restaurar a 0 y marcar error
    formData.financiera[campo] = null;
    inputEl.value = '';
    mostrarError(`field-fin_${campo.toLowerCase()}`);
    mostrarToast('No se permiten valores negativos.', 'error');
    return;
  }
  inputEl.value = raw !== null ? _fmtMoneda(raw) : '';
}

/**
 * Reacciona al evento `input` del campo Patrimonio.
 * Si el usuario escribe algo, desconecta el cálculo automático.
 *
 * @param {HTMLElement} inputEl
 */
function onPatrimonioInput(inputEl) {
  _patrimonioManual = true;
  const raw = _parseMoneda(inputEl.value);
  formData.financiera.PATRIMONIO = raw;
  const hint = document.getElementById('fin_patrimonio_hint');
  if (hint) hint.textContent = 'Valor ingresado manualmente.';
}

/**
 * Igual que onMonedaBlur pero específico para patrimonio.
 */
function onPatrimonioBlur(inputEl) {
  const raw = formData.financiera.PATRIMONIO;
  if (raw !== null && raw < 0) {
    formData.financiera.PATRIMONIO = null;
    inputEl.value = '';
    mostrarError('field-fin_patrimonio');
    mostrarToast('No se permiten valores negativos.', 'error');
    return;
  }
  inputEl.value = raw !== null ? _fmtMoneda(raw) : '';
}

/* ── Cálculo automático de patrimonio ────────────────────────────────────────── */

/**
 * Si _patrimonioManual es false, calcula PATRIMONIO = ACT_TOTAL − PAS_TOTAL
 * y actualiza el campo visual + hint.
 */
function _recalcPatrimonio() {
  if (_patrimonioManual) return;
  const act = formData.financiera.ACT_TOTAL;
  const pas = formData.financiera.PAS_TOTAL;
  if (act !== null && pas !== null) {
    const calc = Math.round((act - pas) * 100) / 100;
    formData.financiera.PATRIMONIO = calc;
    const inp = document.getElementById('fin_patrimonio');
    if (inp) inp.value = _fmtMoneda(calc);
    const hint = document.getElementById('fin_patrimonio_hint');
    if (hint) hint.textContent = `Calculado automáticamente: ${_fmtMoneda(calc)} — puedes editarlo si difiere`;
    limpiarError('field-fin_patrimonio');
  }
}

/* ── Actualización directa de estado ─────────────────────────────────────────── */
function actualizarFinanciera(campo, valor) {
  formData.financiera[campo] = valor === '' ? null : valor;
}

/* ── Validación ─────────────────────────────────────────────────────────────── */
function validarSeccionFinanciera() {
  const requeridos = [
    ['field-fin_act_total',  formData.financiera.ACT_TOTAL,  'ACT_TOTAL'],
    ['field-fin_ing_mens',   formData.financiera.ING_MENS,   'ING_MENS'],
    ['field-fin_pas_total',  formData.financiera.PAS_TOTAL,  'PAS_TOTAL'],
    ['field-fin_egr_mens',   formData.financiera.EGR_MENS,   'EGR_MENS'],
    ['field-fin_patrimonio', formData.financiera.PATRIMONIO, 'PATRIMONIO'],
  ];
  let ok = true;
  requeridos.forEach(([fid, val]) => {
    if (val === null || val === undefined) {
      mostrarError(fid); ok = false;
    } else if (val < 0) {
      mostrarError(fid); ok = false;
    }
  });
  // OTR_ING es opcional pero no puede ser negativo si está ingresado
  if (formData.financiera.OTR_ING !== null && formData.financiera.OTR_ING < 0) {
    mostrarError('field-fin_otr_ing'); ok = false;
  }
  return ok;
}

/* ── Acciones de botones ────────────────────────────────────────────────────── */
function validarYContinuarFinanciera() {
  if (!validarSeccionFinanciera()) {
    document.getElementById('accordion-financiera').classList.remove('collapsed');
    mostrarToast('Corrija los campos marcados en rojo.', 'error');
    const primerError = document.querySelector('#accordion-financiera .field.error');
    if (primerError) primerError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  mostrarToast('Sección 9 completa. Continúe con la siguiente sección.', 'success');
  document.getElementById('accordion-financiera').classList.add('collapsed');
  const acc10 = document.getElementById('accordion-bancaria');
  acc10.classList.remove('collapsed');
  acc10.scrollIntoView({ behavior: 'smooth', block: 'start' });
  console.log('✅ formData.financiera:', JSON.stringify(formData.financiera, null, 2));
}

function limpiarSeccionFinanciera() {
  formData.financiera = { ACT_TOTAL: null, ING_MENS: null, PAS_TOTAL: null,
                          EGR_MENS: null, PATRIMONIO: null, OTR_ING: null };
  _patrimonioManual = false;
  ['fin_act_total','fin_ing_mens','fin_pas_total',
   'fin_egr_mens','fin_patrimonio','fin_otr_ing'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  ['field-fin_act_total','field-fin_ing_mens','field-fin_pas_total',
   'field-fin_egr_mens','field-fin_patrimonio','field-fin_otr_ing'].forEach(id => limpiarError(id));
  const hint = document.getElementById('fin_patrimonio_hint');
  if (hint) hint.textContent = 'Calculado automáticamente como Activos − Pasivos';
  mostrarToast('Sección limpiada.', 'success');
}

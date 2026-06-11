/**
 * seccion-sociedad.js — Sección 3: "Información de la sociedad"
 *
 * Contiene:
 *  · actualizarSociedad()        — escritura en formData.sociedad
 *  · onUbicacionChange()         — condicional Nacional/SC/Extranjera
 *  · onSocPaisChange()           — muestra campo "Otro país" cuando aplica
 *  · validarSeccionSociedad()    — valida campos requeridos
 *  · validarYContinuarSociedad() — botón "Continuar → Sección 4"
 *  · limpiarSeccionSociedad()    — botón "Limpiar sección"
 *  
 * Depende de: state.js, utils.js
 */
'use strict';

/* ── Estado ─────────────────────────────────────────────────────────────────── */

/**
 * Escribe un valor en formData.sociedad[campo].
 * @param {string} campo  Nombre del campo (p.ej. 'UBIC_SOC')
 * @param {*}      valor
 */
function actualizarSociedad(campo, valor) {
  formData.sociedad[campo] = valor === '' ? null : valor;
}

/* ── Lógica condicional Nacional / SC / Extranjera ─────────────────────────── */

/**
 * Reacciona al cambio del desplegable "Ubicación".
 * · Nacional   → oculta País, limpia su valor, recarga tipos de sociedad filtrados.
 * · Extranjera → muestra País (requerido), recarga tipos de sociedad filtrados.
 *
 * @param {string} ubic  'N' | 'E'
 */
function onUbicacionChange(ubic) {
  actualizarSociedad('UBIC_SOC', ubic);
  limpiarError('field-soc_ubic');

  const fieldPais  = document.getElementById('campo-soc_pais');
  const fieldOtro  = document.getElementById('field-soc_pais_otro');
  const selPais    = document.getElementById('soc_pais');
  const tipEmpr    = document.getElementById('field-soc_tip_empr');
  const grupEmpr   = document.getElementById('field-soc_grup_empr');

  if (ubic === 'E') {
    fieldPais.style.display = '';
    // E: País visible → cols fill naturally; onSocPaisChange will set spans
    if (tipEmpr)  tipEmpr.style.gridColumn  = '';
    if (grupEmpr) grupEmpr.style.gridColumn = '';
  } else {
    // Nacional / SC: only Ubic + TipEmpr visible → GrupEmpr spans remaining 2 cols
    fieldPais.style.display = 'none';
    if (fieldOtro) fieldOtro.style.display = 'none';
    if (fieldOtro) fieldOtro.style.gridColumn = '';
    selPais.value = '';
    actualizarSociedad('COD_PAIS_SOC', null);
    actualizarSociedad('OTR_PAIS_SOC', null);
    const inp = document.getElementById('soc_pais_otro_txt');
    if (inp) inp.value = '';
    limpiarError('campo-soc_pais');
    if (tipEmpr)  tipEmpr.style.gridColumn  = '';
    if (grupEmpr) grupEmpr.style.gridColumn = 'span 2';
  }
}

/**
 * Manejador del selector de país en sección 3 (solo visible en modo Extranjera).
 * Si se elige "OTRO", muestra el campo de texto libre sibling.
 */
function onSocPaisChange(codPais) {
  actualizarSociedad('COD_PAIS_SOC', codPais || null);
  limpiarError('campo-soc_pais');

  const fieldOtro = document.getElementById('field-soc_pais_otro');
  const tipEmpr   = document.getElementById('field-soc_tip_empr');
  const grupEmpr  = document.getElementById('field-soc_grup_empr');

  if (codPais === 'OTRO') {
    // Row 1: Ubic | País | OtroPais(span2) — Row 2: TipEmpr(span2) | GrupEmpr(span2)
    if (fieldOtro) { fieldOtro.style.display = ''; fieldOtro.style.gridColumn = 'span 2'; }
    if (tipEmpr)  tipEmpr.style.gridColumn  = 'span 2';
    if (grupEmpr) grupEmpr.style.gridColumn = 'span 2';
  } else {
    // E no OTRO: Ubic | País | TipEmpr | GrupEmpr (all 1 col)
    if (fieldOtro) { fieldOtro.style.display = 'none'; fieldOtro.style.gridColumn = ''; }
    if (tipEmpr)  tipEmpr.style.gridColumn  = '';
    if (grupEmpr) grupEmpr.style.gridColumn = '';
    actualizarSociedad('OTR_PAIS_SOC', null);
    const inp = document.getElementById('soc_pais_otro_txt');
    if (inp) inp.value = '';
  }
}

/* ── Validación ─────────────────────────────────────────────────────────────── */

/**
 * Valida los campos requeridos de la sección de sociedad.
 * Requeridos: UBIC_SOC, GRUP_EMPR.
 * COD_PAIS_SOC es requerido solo si UBIC_SOC = 'E'.
 *
 * @returns {boolean}
 */
function validarSeccionSociedad() {
  let ok = true;
  const d = formData.sociedad;

  if (!d.UBIC_SOC)  { mostrarError('field-soc_ubic');      ok = false; }
  if (!d.TIP_EMPR)  { mostrarError('field-soc_tip_empr');  ok = false; }
  if (!d.GRUP_EMPR) { mostrarError('field-soc_grup_empr'); ok = false; }

  if (d.UBIC_SOC === 'E') {
    if (!d.COD_PAIS_SOC) { mostrarError('campo-soc_pais'); ok = false; }
    if (d.COD_PAIS_SOC === 'OTRO' && !d.OTR_PAIS_SOC) {
      mostrarError('field-soc_pais_otro'); ok = false;
    }
  }

  return ok;
}

/* ── Acciones de botones ────────────────────────────────────────────────────── */

/** Valida la sección y, si es correcta, avanza al acordeón 4. */
function validarYContinuarSociedad() {
  if (!validarSeccionSociedad()) {
    document.getElementById('accordion-sociedad').classList.remove('collapsed');
    mostrarToast('Corrija los campos marcados en rojo.', 'error');
    const primerError = document.querySelector('#accordion-sociedad .field.error');
    if (primerError) primerError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  mostrarToast('Sección 3 completa. Continúe con la siguiente sección.', 'success');
  document.getElementById('accordion-sociedad').classList.add('collapsed');
  const acc4 = document.getElementById('accordion-paises');
  acc4.classList.remove('collapsed');
  acc4.scrollIntoView({ behavior: 'smooth', block: 'start' });
  console.log('✅ formData.sociedad:', JSON.stringify(formData.sociedad, null, 2));
}

/** Resetea todos los campos de la sección al estado inicial. */
function limpiarSeccionSociedad() {
  formData.sociedad = {
    UBIC_SOC: 'N', COD_PAIS_SOC: null, OTR_PAIS_SOC: '',
    TIP_EMPR: null, GRUP_EMPR: null, REL_GRUPO: '',
  };

  document.getElementById('soc_ubic').value      = 'N';
  document.getElementById('soc_tip_empr').value  = '';
  document.getElementById('soc_grup_empr').value = '';
  document.getElementById('soc_pais').value      = '';
  const inp = document.getElementById('soc_pais_otro_txt');
  if (inp) inp.value = '';

  document.getElementById('campo-soc_pais').style.display = 'none';
  const fo = document.getElementById('field-soc_pais_otro');
  if (fo) { fo.style.display = 'none'; fo.style.gridColumn = ''; }
  const tipEmpr  = document.getElementById('field-soc_tip_empr');
  const grupEmpr = document.getElementById('field-soc_grup_empr');
  if (tipEmpr)  tipEmpr.style.gridColumn  = '';
  if (grupEmpr) grupEmpr.style.gridColumn = 'span 2';

  document.querySelector('#accordion-sociedad .accordion-body')
    .querySelectorAll('.field.error').forEach(f => f.classList.remove('error'));

  mostrarToast('Sección limpiada.', 'success');
}

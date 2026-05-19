/**
 * seccion-sociedad.js — Sección 3: "Información de la sociedad"
 *
 * Contiene:
 *  · actualizarSociedad()        — escritura en formData.sociedad
 *  · onUbicacionChange()         — condicional Nacional/Extranjera
 *  · mostrarCampoCondicional()   — fade-in + display:flex de un .field
 *  · ocultarCampoCondicional()   — fade-out + display:none de un .field
 *  · recargarTiposSociedad()     — filtra MAE_TIP_SOCIE según ubicación
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

/* ── Transiciones condicionales ─────────────────────────────────────────────── */

/**
 * Muestra un .field con transición suave (opacity + max-height).
 * Requiere que el elemento tenga la clase CSS `campo-condicional`.
 * @param {HTMLElement} el
 */
function mostrarCampoCondicional(el) {
  el.style.display = 'flex';
  // Doble rAF garantiza que el navegador aplique display:flex antes de animar
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.style.opacity   = '1';
    el.style.maxHeight = '120px';
  }));
}

/**
 * Oculta un .field con fade-out y elimina su espacio al terminar.
 * @param {HTMLElement} el
 */
function ocultarCampoCondicional(el) {
  el.style.opacity   = '0';
  el.style.maxHeight = '0';
  // Esperar a que finalice la transición CSS (200 ms) antes de display:none
  setTimeout(() => { el.style.display = 'none'; }, 210);
}

/* ── Lógica condicional Nacional / Extranjera ───────────────────────────────── */

/**
 * Reacciona al cambio del desplegable "Ubicación".
 * · Nacional   → oculta País, limpia su valor, recarga tipos de sociedad filtrados.
 * · Extranjera → muestra País (requerido), recarga tipos de sociedad filtrados.
 *
 * @param {string} ubic  'N' | 'E'
 */
async function onUbicacionChange(ubic) {
  actualizarSociedad('UBIC_SOC', ubic);
  limpiarError('field-soc_ubic');

  const fieldPais = document.getElementById('campo-soc_pais');
  const selPais   = document.getElementById('soc_pais');

  if (ubic === 'E') {
    mostrarCampoCondicional(fieldPais);
  } else {
    ocultarCampoCondicional(fieldPais);
    selPais.value = '';
    actualizarSociedad('COD_PAIS_SOC', null);
    limpiarError('campo-soc_pais');
  }

  await recargarTiposSociedad(ubic);
}

/**
 * Recarga el desplegable de Tipo de sociedad según la ubicación activa.
 * Conserva el valor previo si sigue disponible en la nueva lista;
 * de lo contrario lo limpia.
 *
 * @param {string} ubic  'N' | 'E'
 */
async function recargarTiposSociedad(ubic) {
  const selTipo     = document.getElementById('soc_tip_socie');
  const valorPrevio = formData.sociedad.TIP_SOCIE;

  // cargarCatalogo reemplaza las opciones del select
  await cargarCatalogo(
    '/api/catalogo/tipos-sociedad', 'soc_tip_socie',
    'COD_SOCIE', 'NOM_SOCIE', '— Seleccione —',
    { ubicacion: ubic }
  );

  // Restaurar selección previa si aún existe en la nueva lista
  const codsDisponibles = Array.from(selTipo.options).map(o => o.value);
  if (valorPrevio && codsDisponibles.includes(valorPrevio)) {
    selTipo.value = valorPrevio;
  } else {
    selTipo.value = '';
    actualizarSociedad('TIP_SOCIE', null);
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

  if (!d.UBIC_SOC)   { mostrarError('field-soc_ubic');      ok = false; }
  if (!d.TIP_EMPR)   { mostrarError('field-soc_tip_empr'); ok = false; }
  if (!d.GRUP_EMPR)  { mostrarError('field-soc_grup_empr'); ok = false; }
  if (!d.TIP_SOCIE)  { mostrarError('field-soc_tip_socie'); ok = false; }

  if (d.UBIC_SOC === 'E' && !d.COD_PAIS_SOC) {
    mostrarError('campo-soc_pais');
    ok = false;
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
  // Restaurar estado
  formData.sociedad = { UBIC_SOC: 'N', COD_PAIS_SOC: null, TIP_EMPR: null, GRUP_EMPR: null, TIP_SOCIE: null };

  // Restaurar controles
  document.getElementById('soc_ubic').value      = 'N';
  document.getElementById('soc_tip_empr').value  = '';
  document.getElementById('soc_grup_empr').value = '';
  document.getElementById('soc_tip_socie').value = '';
  document.getElementById('soc_pais').value      = '';

  // Ocultar campo País inmediatamente (sin transición)
  const fieldPais = document.getElementById('campo-soc_pais');
  fieldPais.style.display   = 'none';
  fieldPais.style.opacity   = '0';
  fieldPais.style.maxHeight = '0';

  // Recargar tipos de sociedad para Nacional
  recargarTiposSociedad('N');

  // Limpiar errores
  document.querySelector('#accordion-sociedad .accordion-body')
    .querySelectorAll('.field.error').forEach(f => f.classList.remove('error'));

  mostrarToast('Sección limpiada.', 'success');
}

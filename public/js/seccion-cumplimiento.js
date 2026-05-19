/**
 * seccion-cumplimiento.js — Sección 5: "Información del Sistema de cumplimiento"
 *
 * Contiene:
 *  · actualizarCump(campo, valor)          — escribe en formData.cumplimiento
 *  · actualizarOficial(idx, campo, valor)  — escribe en formData.cumplimiento.oficiales[idx]
 *  · mostrarBloqueCump(el)                 — fade-in del bloque B1 (condicional grande)
 *  · ocultarBloqueCump(el)                 — fade-out del bloque B1
 *  · onTieneSistemaChange(valor)           — radio Sí/No → muestra/oculta B1
 *  · onCumpPaisChange(codPais, pref, idx)  — cascada País → Dpto → Ciudad por bloque
 *  · onCumpDeptChange(codDept, pref, idx)  — cascada Dpto → Ciudad por bloque
 *  · validarBloqueOficial(idx)             — valida Principal (siempre) o Suplente (si tocado)
 *  · validarSeccionCumplimiento()          — valida sección completa
 *  · validarYContinuarCumplimiento()       — botón "Continuar → Sección 6"
 *  · limpiarBloqueOficial(idx)             — resetea DOM + estado de un bloque oficial
 *  · limpiarSeccionCumplimiento()          — botón "Limpiar sección"
 *
 * Prefijos de ID por bloque:
 *   Principal → 'cump_p'   (cump_p_pais, cump_p_dept, cump_p_mpio, …)
 *   Suplente  → 'cump_s'   (cump_s_pais, cump_s_dept, cump_s_mpio, …)
 *
 * Depende de: state.js, utils.js
 */
'use strict';

/* ── Estado ─────────────────────────────────────────────────────────────────── */

/**
 * Escribe un valor en formData.cumplimiento[campo].
 * Convierte cadenas vacías a null.
 */
function actualizarCump(campo, valor) {
  formData.cumplimiento[campo] = valor === '' ? null : valor;
}

/**
 * Escribe un valor en formData.cumplimiento.oficiales[idx][campo].
 * @param {number} idx   0 = Principal | 1 = Suplente
 * @param {string} campo Nombre del campo
 * @param {*}      valor
 */
function actualizarOficial(idx, campo, valor) {
  formData.cumplimiento.oficiales[idx][campo] = valor === '' ? null : valor;
}

/* ── Visibilidad condicional del bloque B1 ──────────────────────────────────── */

/**
 * Muestra el bloque B1 con transición suave.
 * Usa max-height:4000px para cubrir el contenido extenso del bloque.
 * @param {HTMLElement} el  El elemento #bloque-cump-sistema
 */
function mostrarBloqueCump(el) {
  el.style.display = 'flex';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.style.opacity   = '1';
    el.style.maxHeight = '4000px';
  }));
}

/**
 * Oculta el bloque B1 con fade-out y colapsa su espacio al terminar.
 * @param {HTMLElement} el
 */
function ocultarBloqueCump(el) {
  el.style.opacity   = '0';
  el.style.maxHeight = '0';
  setTimeout(() => { el.style.display = 'none'; }, 210);
}

/**
 * Reacciona al cambio del radio "¿Tiene sistema implementado?".
 * - 'S' → muestra bloque B1.
 * - 'N' → oculta bloque B1 y limpia errores visuales del sub-bloque.
 *
 * @param {string} valor  'S' | 'N'
 */
function onTieneSistemaChange(valor) {
  actualizarCump('TIE_JUNTA', valor);
  const bloque = document.getElementById('bloque-cump-sistema');
  if (valor === 'S') {
    mostrarBloqueCump(bloque);
  } else {
    ocultarBloqueCump(bloque);
    bloque.querySelectorAll('.field.error').forEach(f => f.classList.remove('error'));
  }
}

/* ── Cascadas geográficas (independientes por bloque) ───────────────────────── */

/**
 * Reacciona al cambio de País en un bloque de oficial.
 * Resetea Departamento y Ciudad del mismo bloque sin afectar el otro.
 *
 * @param {string} codPais  Valor seleccionado
 * @param {string} prefijo  'cump_p' | 'cump_s'
 * @param {number} idx      0 | 1
 */
async function onCumpPaisChange(codPais, prefijo, idx) {
  // Normaliza a string para mantener consistencia con DOM
  actualizarOficial(idx, 'COD_PAIS', codPais ? String(codPais) : null);
  actualizarOficial(idx, 'COD_DEPT', null);
  actualizarOficial(idx, 'COD_MPIO', null);

  const selDept = document.getElementById(`${prefijo}_dept`);
  const selMpio = document.getElementById(`${prefijo}_mpio`);

  selMpio.innerHTML = '<option value="">— Seleccione departamento primero —</option>';
  selMpio.disabled  = true;
  limpiarError(`field-${prefijo}_dept`);
  limpiarError(`field-${prefijo}_mpio`);

  if (!codPais) {
    selDept.innerHTML = '<option value="">— Seleccione país primero —</option>';
    selDept.disabled  = true;
    return;
  }

  if (codPais === COD_COLOMBIA) {
    selDept.disabled = false;
    await cargarCatalogo(
      '/api/catalogo/departamentos', `${prefijo}_dept`,
      'COD_DEPT', 'NOM_DEPT', '— Seleccione departamento —',
      { cod_pais: codPais }
    );
  } else {
    // País extranjero: Departamento = "No aplica"
    selDept.innerHTML = '<option value="NA">No aplica</option>';
    selDept.value     = 'NA';
    selDept.disabled  = true;
    actualizarOficial(idx, 'COD_DEPT', 'NA');

    selMpio.disabled  = false;
    selMpio.innerHTML = '<option value="">Cargando ciudades…</option>';
    await cargarCatalogo(
      '/api/catalogo/ciudades', `${prefijo}_mpio`,
      'COD_MUNI', 'NOM_MUNI', '— Seleccione ciudad —',
      { cod_pais: codPais }
    );
    selMpio.onchange = (e) => {
      actualizarOficial(idx, 'COD_MPIO', e.target.value ? String(e.target.value) : null);
      limpiarError(`field-${prefijo}_mpio`);
    };
  }
}

/**
 * Reacciona al cambio de Departamento en un bloque de oficial.
 * Recarga las ciudades del mismo bloque.
 *
 * @param {string} codDept
 * @param {string} prefijo  'cump_p' | 'cump_s'
 * @param {number} idx      0 | 1
 */
async function onCumpDeptChange(codDept, prefijo, idx) {
  // Normaliza a string para mantener consistencia con DOM
  actualizarOficial(idx, 'COD_DEPT', codDept ? String(codDept) : null);
  actualizarOficial(idx, 'COD_MPIO', null);

  const selMpio = document.getElementById(`${prefijo}_mpio`);
  const codPais = document.getElementById(`${prefijo}_pais`).value;

  selMpio.innerHTML = '<option value="">Cargando ciudades…</option>';
  selMpio.disabled  = true;

  if (!codDept || !codPais) return;

  await cargarCatalogo(
    '/api/catalogo/ciudades', `${prefijo}_mpio`,
    'COD_MUNI', 'NOM_MUNI', '— Seleccione ciudad —',
    { cod_dept: codDept, cod_pais: codPais }
  );
  selMpio.disabled = false;
  selMpio.onchange = (e) => {
    actualizarOficial(idx, 'COD_MPIO', e.target.value ? String(e.target.value) : null);
    limpiarError(`field-${prefijo}_mpio`);
  };
}

/* ── Validación ─────────────────────────────────────────────────────────────── */

/**
 * Valida un bloque de oficial.
 *
 * - Principal (idx 0): todos los campos requeridos son obligatorios.
 * - Suplente  (idx 1): si ningún campo fue tocado → válido (no se guardará).
 *                      Si al menos un campo fue tocado → se exigen todos.
 *
 * @param {number} idx  0 | 1
 * @returns {boolean}
 */
function validarBloqueOficial(idx) {
  const prefijo = idx === 0 ? 'cump_p' : 'cump_s';
  const d       = formData.cumplimiento.oficiales[idx];

  const camposReq = [
    { fieldId: `field-${prefijo}_tipdoc`, valor: d.TIP_DOCU },
    { fieldId: `field-${prefijo}_numdoc`, valor: d.NUM_DOCU },
    { fieldId: `field-${prefijo}_fec`,    valor: d.FEC_EXPE },
    { fieldId: `field-${prefijo}_nom`,    valor: d.NOM_RESP },
    { fieldId: `field-${prefijo}_ape`,    valor: d.APE_RESP },
    { fieldId: `field-${prefijo}_pais`,   valor: d.COD_PAIS },
    { fieldId: `field-${prefijo}_dept`,   valor: d.COD_DEPT },
    { fieldId: `field-${prefijo}_mpio`,   valor: d.COD_MPIO },
    { fieldId: `field-${prefijo}_tel`,    valor: d.TEL_RESP  },
  ];

  // Suplente: si el bloque está completamente intacto → OK sin validar
  if (idx === 1) {
    const alguno = camposReq.some(c => c.valor && String(c.valor).trim() !== '')
                || (d.MAIL_RESP && String(d.MAIL_RESP).trim() !== '')
                || (d.RAZ_RESP  && String(d.RAZ_RESP).trim()  !== '');
    if (!alguno) return true;
  }

  let ok = true;

  camposReq.forEach(({ fieldId, valor }) => {
    if (!valor || String(valor).trim() === '') {
      mostrarError(fieldId);
      ok = false;
    }
  });

  if (!d.MAIL_RESP || !esEmailValido(d.MAIL_RESP)) {
    mostrarError(`field-${prefijo}_mail`);
    ok = false;
  }

  return ok;
}

/**
 * Valida toda la sección de cumplimiento.
 *
 * Siempre requerido:
 *   · DESC_NORM
 *
 * Solo si TIE_JUNTA = 'S':
 *   · SIS_PREVE
 *   · Bloque oficial Principal (completo)
 *   · Bloque oficial Suplente (condicional)
 *
 * @returns {boolean}
 */
function validarSeccionCumplimiento() {
  let ok = true;

  // Normatividad — siempre requerida
  if (!formData.cumplimiento.DESC_NORM || !String(formData.cumplimiento.DESC_NORM).trim()) {
    mostrarError('field-cump_desc_norm');
    ok = false;
  }

  // Campos del sub-bloque B1 — solo si tiene sistema
  if (formData.cumplimiento.TIE_JUNTA === 'S') {
    if (!formData.cumplimiento.SIS_PREVE) {
      mostrarError('field-cump_sis_preve');
      ok = false;
    }
    const okP = validarBloqueOficial(0);
    const okS = validarBloqueOficial(1);
    if (!okP || !okS) ok = false;
  }

  return ok;
}

/* ── Acciones de botones ────────────────────────────────────────────────────── */

/** Valida la sección y, si es correcta, avanza al acordeón 6. */
function validarYContinuarCumplimiento() {
  if (!validarSeccionCumplimiento()) {
    document.getElementById('accordion-cumplimiento').classList.remove('collapsed');
    mostrarToast('Corrija los campos marcados en rojo.', 'error');
    const primerError = document.querySelector('#accordion-cumplimiento .field.error');
    if (primerError) primerError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  mostrarToast('Sección 5 completa. Continúe con la siguiente sección.', 'success');
  document.getElementById('accordion-cumplimiento').classList.add('collapsed');
  const acc6 = document.getElementById('accordion-jd');
  acc6.classList.remove('collapsed');
  acc6.scrollIntoView({ behavior: 'smooth', block: 'start' });
  console.log('✅ formData.cumplimiento:', JSON.stringify(formData.cumplimiento, null, 2));
}

/**
 * Resetea un bloque de oficial: DOM + estado + errores visuales.
 * @param {number} idx  0 = Principal | 1 = Suplente
 */
function limpiarBloqueOficial(idx) {
  const prefijo  = idx === 0 ? 'cump_p'               : 'cump_s';
  const bloqueId = idx === 0 ? 'cump-bloque-principal' : 'cump-bloque-suplente';
  const bloque   = document.getElementById(bloqueId);

  bloque.querySelectorAll('input, select').forEach(el => {
    el.tagName === 'SELECT' ? (el.selectedIndex = 0) : (el.value = '');
  });

  const selDept = document.getElementById(`${prefijo}_dept`);
  const selMpio = document.getElementById(`${prefijo}_mpio`);
  selDept.innerHTML = '<option value="">— Seleccione país primero —</option>';
  selDept.disabled  = true;
  selMpio.innerHTML = '<option value="">— Seleccione departamento primero —</option>';
  selMpio.disabled  = true;

  formData.cumplimiento.oficiales[idx] = {
    TIP_REPR: idx === 0 ? 'P' : 'S',
    TIP_DOCU: null, NUM_DOCU: '', FEC_EXPE: '',
    NOM_RESP: '', APE_RESP: '', RAZ_RESP: '',
    COD_PAIS: null, COD_DEPT: null, COD_MPIO: null,
    DIR_RESP: '', TEL_RESP: '', MAIL_RESP: '',
  };

  bloque.querySelectorAll('.field.error').forEach(f => f.classList.remove('error'));
}

/** Resetea la sección completa al estado inicial. */
function limpiarSeccionCumplimiento() {
  // Textarea
  const ta = document.getElementById('cump_desc_norm');
  if (ta) ta.value = '';
  formData.cumplimiento.DESC_NORM = '';
  limpiarError('field-cump_desc_norm');

  // Radio — volver a "No"
  const radioNo = document.querySelector('input[name="cump_tie_sist"][value="N"]');
  if (radioNo) radioNo.checked = true;
  formData.cumplimiento.TIE_JUNTA = 'N';

  // Ocultar bloque B1 sin transición
  const bloque = document.getElementById('bloque-cump-sistema');
  bloque.style.transition = 'none';
  bloque.style.opacity    = '0';
  bloque.style.maxHeight  = '0';
  bloque.style.display    = 'none';
  setTimeout(() => { bloque.style.transition = ''; }, 50);

  // Limpiar sistema
  const selSist = document.getElementById('cump_sis_preve');
  if (selSist) selSist.selectedIndex = 0;
  formData.cumplimiento.SIS_PREVE = null;
  limpiarError('field-cump_sis_preve');

  // Limpiar bloques de oficiales
  limpiarBloqueOficial(0);
  limpiarBloqueOficial(1);

  mostrarToast('Sección limpiada.', 'success');
}

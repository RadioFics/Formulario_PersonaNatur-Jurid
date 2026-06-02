/**
 * seccion-bancaria.js — Sección 10: "Información bancaria"
 *
 * Lista dinámica de cuentas bancarias con IDs estables.
 * Cada grupo tiene:
 *   · Entidad bancaria (select MAE_BANCO)
 *   · Tipo de cuenta  (select MAE_TPCTA)
 *   · Número de cuenta (texto numérico)
 *   · Condicional CUEN_EXTR: si Sí → NOM_ENT_EXT + TIP_CUE_EXT
 *
 * API IDs: banco_{id}_{campo}
 * State:   formData.bancaria[]
 * Depende de: state.js, utils.js (incluye getOpcionesHTML)
 */
'use strict';

/* ── Counter de IDs estables ─────────────────────────────────────────────────── */
let _bancoId = 0;

/* ── Fábrica de estado ──────────────────────────────────────────────────────── */
function _bancoNuevo() {
  return {
    _id: _bancoId++,
    COD_BANCO: null, OTR_BANCO: '',
    TIP_CUEN: null,  OTR_CUEN: '',
    NUM_CUEN: '',
    CUEN_EXTR: 'N', NOM_ENT_EXT: '', TIP_CUE_EXT: '',
  };
}
function _bancoGet(id) { return formData.bancaria.find(b => b._id === id); }
function _bancoPos(id) { return formData.bancaria.findIndex(b => b._id === id); }

/* ── Actualización de estado ─────────────────────────────────────────────────── */
function actualizarBanco(id, campo, valor) {
  const b = _bancoGet(id);
  if (b) b[campo] = valor === '' ? null : valor;
}

/* ── Título dinámico del grupo ──────────────────────────────────────────────── */
function actualizarTituloBanco(id) {
  const b   = _bancoGet(id);
  const pos = _bancoPos(id) + 1;
  const el  = document.getElementById(`banco_titulo_${id}`);
  if (!el) return;
  // Obtener nombre del banco desde el select
  const sel = document.getElementById(`banco_${id}_banco`);
  const nom = sel ? (sel.options[sel.selectedIndex]?.text || '') : '';
  const lbl = nom && nom !== '— Seleccione entidad —' ? ` — ${nom}` : '';
  el.textContent = `Cuenta ${pos}${lbl}`;
}
function _bancoRenumerarTodos() {
  formData.bancaria.forEach(b => actualizarTituloBanco(b._id));
}

/* ── Colapsar/expandir grupo ─────────────────────────────────────────────────── */
function toggleGrupoBanco(id) {
  const body = document.getElementById(`banco_body_${id}`);
  if (body) body.classList.toggle('collapsed');
}

/* ── Condicional "Otros" en banco y tipo de cuenta ──────────────────────────── */
function _bancoOtrosChange(id, tipo) {
  const selId  = tipo === 'banco' ? `banco_${id}_banco`    : `banco_${id}_tipcuen`;
  const wrapId = tipo === 'banco' ? `banco_${id}_otr_banco_wrap` : `banco_${id}_otr_cuen_wrap`;
  const inpId  = tipo === 'banco' ? `banco_${id}_otr_banco` : `banco_${id}_otr_cuen`;
  const campo  = tipo === 'banco' ? 'OTR_BANCO' : 'OTR_CUEN';
  configurarOtros(selId, wrapId, () => {
    actualizarBanco(id, campo, null);
    const el = document.getElementById(inpId); if (el) el.value = '';
  });
}

/* ── Condicional cuenta extranjera ──────────────────────────────────────────── */
function onTieneExtranjeraChange(id, valor) {
  const b = _bancoGet(id);
  if (b) b.CUEN_EXTR = valor;
  const wrap = document.getElementById(`banco_${id}_ext_wrap`);
  if (!wrap) return;
  if (valor === 'S') {
    wrap.style.display = 'grid';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      wrap.style.opacity = '1'; wrap.style.maxHeight = '200px';
    }));
  } else {
    wrap.style.opacity = '0'; wrap.style.maxHeight = '0';
    setTimeout(() => { wrap.style.display = 'none'; }, 210);
    // Limpiar estado
    if (b) { b.NOM_ENT_EXT = ''; b.TIP_CUE_EXT = ''; }
    const inpNom = document.getElementById(`banco_${id}_ext_nom`);
    const inpTip = document.getElementById(`banco_${id}_ext_tip`);
    if (inpNom) inpNom.value = '';
    if (inpTip) inpTip.value = '';
    limpiarError(`field-banco_${id}_ext_nom`);
    limpiarError(`field-banco_${id}_ext_tip`);
  }
}

/* ── Opciones desde caché ────────────────────────────────────────────────────── */
function _bancoBancoOpts() {
  return getOpcionesHTML('/api/catalogo/bancos', 'COD_BANCO', 'NOM_BANCO', '— Seleccione entidad —');
}
function _bancoTipCtaOpts() {
  return getOpcionesHTML('/api/catalogo/tipos-cuenta', 'COD_TPCTA', 'NOM_TPCTA', '— Seleccione tipo —');
}

/* ── Crear elemento DOM de un grupo ──────────────────────────────────────────── */
function _crearGrupoBancoEl(cuenta) {
  const id  = cuenta._id;
  const pos = _bancoPos(id) + 1;
  const bo  = _bancoBancoOpts();
  const to  = _bancoTipCtaOpts();
  const el  = document.createElement('div');
  el.className = 'grupo-item';
  el.id        = `banco_grupo_${id}`;
  el.innerHTML = `
    <div class="grupo-header" onclick="toggleGrupoBanco(${id})">
      <span class="grupo-titulo" id="banco_titulo_${id}">Cuenta ${pos}</span>
      <button class="btn-eliminar-grupo" type="button" onclick="eliminarBanco(event,${id})" title="Eliminar">✕</button>
    </div>
    <div class="grupo-body" id="banco_body_${id}">
      <div class="grid-4">
        <div class="field col-full" id="field-banco_${id}_banco">
          <label>Entidad bancaria <span class="req">*</span></label>
          <select id="banco_${id}_banco"
                  onchange="actualizarBanco(${id},'COD_BANCO',this.value);actualizarTituloBanco(${id});limpiarError('field-banco_${id}_banco');_bancoOtrosChange(${id},'banco')">
            ${bo}
          </select>
          <span class="error-msg">Campo requerido</span>
          <div id="banco_${id}_otr_banco_wrap" class="otr-wrap">
            <label class="otr-label">Especifique la entidad bancaria <span class="req">*</span></label>
            <input type="text" id="banco_${id}_otr_banco" maxlength="255" placeholder="Nombre de la entidad"
                   oninput="actualizarBanco(${id},'OTR_BANCO',this.value)" />
          </div>
        </div>
        <div class="field" id="field-banco_${id}_tipcuen">
          <label>Tipo de cuenta <span class="req">*</span></label>
          <select id="banco_${id}_tipcuen"
                  onchange="actualizarBanco(${id},'TIP_CUEN',this.value);limpiarError('field-banco_${id}_tipcuen');_bancoOtrosChange(${id},'cuen')">
            ${to}
          </select>
          <span class="error-msg">Campo requerido</span>
          <div id="banco_${id}_otr_cuen_wrap" class="otr-wrap">
            <label class="otr-label">Especifique el tipo de cuenta <span class="req">*</span></label>
            <input type="text" id="banco_${id}_otr_cuen" maxlength="255" placeholder="Ej: cuenta fiduciaria, CDT…"
                   oninput="actualizarBanco(${id},'OTR_CUEN',this.value)" />
          </div>
        </div>
        <div class="field" id="field-banco_${id}_numcuen">
          <label>Número de cuenta <span class="req">*</span></label>
          <input type="text" id="banco_${id}_numcuen" maxlength="30" inputmode="numeric"
                 oninput="this.value=this.value.replace(/\\D/g,'');actualizarBanco(${id},'NUM_CUEN',this.value);limpiarError('field-banco_${id}_numcuen')" />
          <span class="error-msg">Campo requerido</span>
        </div>
      </div>
      <div class="field field-radio">
        <label>¿La empresa posee cuentas en el extranjero? <span class="req">*</span></label>
        <div class="radio-group">
          <label class="radio-option">
            <input type="radio" name="banco_extr_${id}" value="S"
                   onchange="onTieneExtranjeraChange(${id},'S')"> Sí
          </label>
          <label class="radio-option">
            <input type="radio" name="banco_extr_${id}" value="N" checked
                   onchange="onTieneExtranjeraChange(${id},'N')"> No
          </label>
        </div>
      </div>
      <div id="banco_${id}_ext_wrap" class="grid-4"
           style="display:none; opacity:0; max-height:0; overflow:hidden; transition:opacity .2s ease, max-height .2s ease;">
        <div class="field col-full" id="field-banco_${id}_ext_nom">
          <label>Nombre de la entidad extranjera <span class="req">*</span></label>
          <input type="text" id="banco_${id}_ext_nom" maxlength="255"
                 oninput="actualizarBanco(${id},'NOM_ENT_EXT',this.value);limpiarError('field-banco_${id}_ext_nom')" />
          <span class="error-msg">Campo requerido</span>
        </div>
        <div class="field" id="field-banco_${id}_ext_tip">
          <label>Tipo de cuenta extranjera <span class="req">*</span></label>
          <input type="text" id="banco_${id}_ext_tip" maxlength="100"
                 placeholder="Ej: Savings, Checking…"
                 oninput="actualizarBanco(${id},'TIP_CUE_EXT',this.value);limpiarError('field-banco_${id}_ext_tip')" />
          <span class="error-msg">Campo requerido</span>
        </div>
      </div>
    </div>`;
  return el;
}

function _hydrateBancoFields(cuenta, el) {
  const id = cuenta._id;
  const set = (selector, value) => {
    const field = el.querySelector(selector);
    if (field) field.value = value || '';
  };

  set(`#banco_${id}_banco`, cuenta.COD_BANCO);
  set(`#banco_${id}_tipcuen`, cuenta.TIP_CUEN);
  set(`#banco_${id}_numcuen`, cuenta.NUM_CUEN);
  set(`#banco_${id}_ext_nom`, cuenta.NOM_ENT_EXT);
  set(`#banco_${id}_ext_tip`, cuenta.TIP_CUE_EXT);
  set(`#banco_${id}_otr_banco`, cuenta.OTR_BANCO);
  set(`#banco_${id}_otr_cuen`,  cuenta.OTR_CUEN);
  // Evaluar condicionales "otros" con el valor hidratado
  _bancoOtrosChange(id, 'banco');
  _bancoOtrosChange(id, 'cuen');

  if (cuenta.CUEN_EXTR === 'S') {
    const yes = el.querySelector(`input[name="banco_extr_${id}"][value="S"]`);
    if (yes) yes.checked = true;
    onTieneExtranjeraChange(id, 'S');
  }
}

/**
 * Inicializa la lista con una cuenta vacía.
 * Debe llamarse desde DOMContentLoaded una vez que los catálogos estén en cache.
 */
function renderListaBancaria() {
  const list = document.getElementById('banco-grupos-list');
  list.innerHTML = '';
  if (!Array.isArray(formData.bancaria) || formData.bancaria.length === 0) {
    formData.bancaria = [];
    _bancoId = 0;
    const primero = _bancoNuevo();
    formData.bancaria.push(primero);
  } else {
    _bancoId = Math.max(...formData.bancaria.map(b => b._id)) + 1;
  }

  formData.bancaria.forEach(cuenta => {
    const el = _crearGrupoBancoEl(cuenta);
    list.appendChild(el);
    _hydrateBancoFields(cuenta, el);
  });
  _bancoSyncEliminar();
}

/* ── Agregar / Eliminar ──────────────────────────────────────────────────────── */
function agregarBanco() {
  const nuevo = _bancoNuevo();
  formData.bancaria.push(nuevo);
  document.querySelectorAll('#banco-grupos-list .grupo-body').forEach(b => b.classList.add('collapsed'));
  const list = document.getElementById('banco-grupos-list');
  const el   = _crearGrupoBancoEl(nuevo);
  list.appendChild(el);
  _bancoSyncEliminar();
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  guardarBorradorDebounced();
}

function eliminarBanco(event, id) {
  event.stopPropagation();
  if (formData.bancaria.length <= 1) return;
  formData.bancaria.splice(_bancoPos(id), 1);
  document.getElementById(`banco_grupo_${id}`).remove();
  _bancoRenumerarTodos();
  _bancoSyncEliminar();
  guardarBorradorDebounced();
}

function _bancoSyncEliminar() {
  const sola = formData.bancaria.length <= 1;
  document.querySelectorAll('#banco-grupos-list .btn-eliminar-grupo').forEach(b => { b.disabled = sola; });
}

/* ── Validación ─────────────────────────────────────────────────────────────── */
function _validarGrupoBanco(id) {
  const b = _bancoGet(id);
  if (!b) return true;
  let ok = true;
  if (!b.COD_BANCO) { mostrarError(`field-banco_${id}_banco`);   ok = false; }
  if (!b.TIP_CUEN)  { mostrarError(`field-banco_${id}_tipcuen`); ok = false; }
  if (!b.NUM_CUEN || !String(b.NUM_CUEN).trim()) {
    mostrarError(`field-banco_${id}_numcuen`); ok = false;
  }
  if (b.CUEN_EXTR === 'S') {
    if (!b.NOM_ENT_EXT || !String(b.NOM_ENT_EXT).trim()) {
      mostrarError(`field-banco_${id}_ext_nom`); ok = false;
    }
    if (!b.TIP_CUE_EXT || !String(b.TIP_CUE_EXT).trim()) {
      mostrarError(`field-banco_${id}_ext_tip`); ok = false;
    }
  }
  return ok;
}

function validarSeccionBancaria() {
  if (formData.bancaria.length === 0) {
    mostrarToast('Registre al menos una cuenta bancaria.', 'error'); return false;
  }
  let ok = true;
  for (const b of formData.bancaria) {
    if (!_validarGrupoBanco(b._id)) {
      document.getElementById(`banco_body_${b._id}`).classList.remove('collapsed');
      ok = false;
    }
  }
  return ok;
}

/* ── Acciones de botones ────────────────────────────────────────────────────── */
function validarYContinuarBancaria() {
  if (!validarSeccionBancaria()) {
    document.getElementById('accordion-bancaria').classList.remove('collapsed');
    mostrarToast('Corrija los campos marcados en rojo.', 'error');
    const primerError = document.querySelector('#accordion-bancaria .field.error');
    if (primerError) primerError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  mostrarToast('Sección 10 completa. Continúe con la siguiente sección.', 'success');
  document.getElementById('accordion-bancaria').classList.add('collapsed');
  const acc11 = document.getElementById('accordion-pep');
  acc11.classList.remove('collapsed');
  acc11.scrollIntoView({ behavior: 'smooth', block: 'start' });
  console.log('✅ formData.bancaria:', JSON.stringify(formData.bancaria, null, 2));
}

function limpiarSeccionBancaria() {
  renderListaBancaria();
  mostrarToast('Sección limpiada.', 'success');
}

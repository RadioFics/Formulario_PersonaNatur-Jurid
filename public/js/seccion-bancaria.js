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
    CUEN_EXTR: 'N',
    cuentasExt: [],
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
  const sel = document.getElementById(`banco_${id}_banco`);
  const nom = sel ? (sel.options[sel.selectedIndex]?.text || '') : '';
  const lbl = nom && nom !== 'select_ph_entidad' ? ` — ${nom}` : '';
  if (pos === 1) {
    el.innerHTML = `${typeof t==='function'?t('card_cuenta_princ'):'Cuenta principal — Certificación bancaria'}${lbl}`;
  } else {
    el.innerHTML = `<span data-i18n="card_cuenta">${typeof t==='function'?t('card_cuenta'):'Cuenta'}</span> ${pos}${lbl}`;
  }
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
  const selId = tipo === 'banco' ? `banco_${id}_banco`           : `banco_${id}_tipcuen`;
  const fldId = tipo === 'banco' ? `field-banco_${id}_banco_otro`: `field-banco_${id}_tipcuen_otro`;
  const inpId = tipo === 'banco' ? `banco_${id}_otr_banco`       : `banco_${id}_otr_cuen`;
  const campo = tipo === 'banco' ? 'OTR_BANCO'                   : 'OTR_CUEN';

  const sel = document.getElementById(selId);
  const fld = document.getElementById(fldId);
  if (!sel || !fld) return;

  const txt = (sel.selectedOptions[0]?.textContent || '').trim();
  if (/^otro|^sin\s/i.test(txt)) {
    fld.style.display = '';
  } else {
    fld.style.display = 'none';
    actualizarBanco(id, campo, null);
    const el = document.getElementById(inpId); if (el) el.value = '';
  }
}

/* ── Condicional cuenta extranjera ──────────────────────────────────────────── */
function onTieneExtranjeraChange(id, valor) {
  const b = _bancoGet(id);
  if (b) b.CUEN_EXTR = valor;
  const wrap = document.getElementById(`banco_${id}_ext_wrap`);
  if (!wrap) return;
  if (valor === 'S') {
    wrap.style.display = 'block';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      wrap.style.opacity = '1';
    }));
    if (b && b.cuentasExt.length === 0) agregarCuentaExt(id);
  } else {
    wrap.style.opacity = '0';
    setTimeout(() => { wrap.style.display = 'none'; }, 210);
    if (b) {
      b.cuentasExt = [];
      const list = document.getElementById(`banco_${id}_ext_list`);
      if (list) list.innerHTML = '';
    }
  }
}

/* ── Ext account array helpers ──────────────────────────────────────────────── */
function actualizarCuentaExt(bancoId, idx, campo, valor) {
  const b = _bancoGet(bancoId);
  if (!b || !b.cuentasExt[idx]) return;
  b.cuentasExt[idx][campo] = valor === '' ? null : valor;
}

function _extPaisOtroChange(bancoId, idx, codPais) {
  const fieldOtro = document.getElementById(`field-banco_${bancoId}_ext_${idx}_pais_otro`);
  if (!fieldOtro) return;
  if (codPais === 'OTRO') {
    fieldOtro.style.display = '';
  } else {
    fieldOtro.style.display = 'none';
    const b = _bancoGet(bancoId);
    if (b && b.cuentasExt[idx]) b.cuentasExt[idx].OTR_PAIS_EXT = null;
    const inp = document.getElementById(`banco_${bancoId}_ext_${idx}_pais_otro`);
    if (inp) inp.value = '';
  }
}

function _crearExtEntryHTML(bancoId, idx, entry, paOpts) {
  const e = entry || {};
  return `
    <div id="banco_${bancoId}_ext_entry_${idx}" class="ext-entry" style="border:1px solid var(--color-border);border-radius:6px;padding:.75rem 1rem;margin-bottom:.5rem;position:relative">
      <button class="btn-eliminar-grupo" type="button" style="position:absolute;top:.5rem;right:.5rem"
              onclick="eliminarCuentaExt(${bancoId},${idx})" title="Eliminar">✕</button>
      <div class="grid-4">
        <div class="field" id="field-banco_${bancoId}_ext_${idx}_pais">
          <label><span data-i18n="sec11_pais_ext">${typeof t==='function'?t('sec11_pais_ext'):'País de la cuenta'}</span> <span class="req">*</span></label>
          <select id="banco_${bancoId}_ext_${idx}_pais"
                  onchange="actualizarCuentaExt(${bancoId},${idx},'COD_PAIS_EXT',this.value);_extPaisOtroChange(${bancoId},${idx},this.value);limpiarError('field-banco_${bancoId}_ext_${idx}_pais')">
            ${paOpts}
          </select>
          <span class="error-msg" data-i18n="required_field">${typeof t==='function'?t('required_field'):'Campo requerido'}</span>
        </div>
        <div class="field" id="field-banco_${bancoId}_ext_${idx}_nom">
          <label><span data-i18n="sec11_nom_ext">${typeof t==='function'?t('sec11_nom_ext'):'Nombre de la entidad extranjera'}</span> <span class="req">*</span></label>
          <input type="text" id="banco_${bancoId}_ext_${idx}_nom" maxlength="255"
                 oninput="actualizarCuentaExt(${bancoId},${idx},'NOM_ENT_EXT',this.value);limpiarError('field-banco_${bancoId}_ext_${idx}_nom')" />
          <span class="error-msg" data-i18n="required_field">${typeof t==='function'?t('required_field'):'Campo requerido'}</span>
        </div>
        <div class="field" id="field-banco_${bancoId}_ext_${idx}_tip">
          <label><span data-i18n="sec11_tip_ext">${typeof t==='function'?t('sec11_tip_ext'):'Tipo de cuenta extranjera'}</span> <span class="req">*</span></label>
          <input type="text" id="banco_${bancoId}_ext_${idx}_tip" maxlength="100"
                 placeholder="Ej: Savings, Checking&#x2026;"
                 oninput="actualizarCuentaExt(${bancoId},${idx},'TIP_CUE_EXT',this.value);limpiarError('field-banco_${bancoId}_ext_${idx}_tip')" />
          <span class="error-msg" data-i18n="required_field">${typeof t==='function'?t('required_field'):'Campo requerido'}</span>
        </div>
        <div class="field" id="field-banco_${bancoId}_ext_${idx}_pais_otro" style="display:none">
          <label><span data-i18n="field_specify_pais">${typeof t==='function'?t('field_specify_pais'):'Especifique el pa\xEDs'}</span> <span class="req">*</span></label>
          <input type="text" id="banco_${bancoId}_ext_${idx}_pais_otro" maxlength="100"
                 data-i18n-ph="country_name_ph" placeholder="${typeof t==='function'?t('country_name_ph'):'Nombre del pa\xEDs'}"
                 oninput="actualizarCuentaExt(${bancoId},${idx},'OTR_PAIS_EXT',this.value)" />
        </div>
      </div>
    </div>`;
}

function agregarCuentaExt(bancoId) {
  const b = _bancoGet(bancoId);
  if (!b) return;
  const idx = b.cuentasExt.length;
  b.cuentasExt.push({ COD_PAIS_EXT: null, OTR_PAIS_EXT: '', NOM_ENT_EXT: '', TIP_CUE_EXT: '' });
  const list = document.getElementById(`banco_${bancoId}_ext_list`);
  if (!list) return;
  const pa = _bancoPaisOpts();
  const tmpDiv = document.createElement('div');
  tmpDiv.innerHTML = _crearExtEntryHTML(bancoId, idx, b.cuentasExt[idx], pa);
  const entry = tmpDiv.firstElementChild;
  agregarOpcionOtroAlSelect(entry.querySelector(`#banco_${bancoId}_ext_${idx}_pais`));
  list.appendChild(entry);
  guardarBorradorDebounced();
}

function eliminarCuentaExt(bancoId, extIdx) {
  const b = _bancoGet(bancoId);
  if (!b || b.cuentasExt.length <= 1) return;
  b.cuentasExt.splice(extIdx, 1);
  const list = document.getElementById(`banco_${bancoId}_ext_list`);
  if (!list) return;
  list.innerHTML = '';
  const pa = _bancoPaisOpts();
  b.cuentasExt.forEach((e, idx) => {
    const tmpDiv = document.createElement('div');
    tmpDiv.innerHTML = _crearExtEntryHTML(bancoId, idx, e, pa);
    const entryEl = tmpDiv.firstElementChild;
    agregarOpcionOtroAlSelect(entryEl.querySelector(`#banco_${bancoId}_ext_${idx}_pais`));
    const selPais = entryEl.querySelector(`#banco_${bancoId}_ext_${idx}_pais`);
    if (selPais && e.COD_PAIS_EXT) { selPais.value = String(e.COD_PAIS_EXT); _extPaisOtroChange(bancoId, idx, String(e.COD_PAIS_EXT)); }
    const inpNom = entryEl.querySelector(`#banco_${bancoId}_ext_${idx}_nom`); if (inpNom) inpNom.value = e.NOM_ENT_EXT || '';
    const inpTip = entryEl.querySelector(`#banco_${bancoId}_ext_${idx}_tip`); if (inpTip) inpTip.value = e.TIP_CUE_EXT || '';
    const inpOtr = entryEl.querySelector(`#banco_${bancoId}_ext_${idx}_pais_otro`); if (inpOtr) inpOtr.value = e.OTR_PAIS_EXT || '';
    list.appendChild(entryEl);
  });
  guardarBorradorDebounced();
}

/* ── Opciones desde caché ────────────────────────────────────────────────────── */
function _bancoBancoOpts() {
  return getOpcionesHTML('/api/catalogo/bancos', 'COD_BANCO', 'NOM_BANCO', 'select_ph_entidad');
}
function _bancoTipCtaOpts() {
  return getOpcionesHTML('/api/catalogo/tipos-cuenta', 'COD_TPCTA', 'NOM_TPCTA', 'select_ph_tipo');
}
function _bancoPaisOpts() {
  return getOpcionesHTML('/api/catalogo/paises', 'COD_PAIS', 'NOM_PAIS', 'select_ph_pais');
}

/* ── Crear elemento DOM de un grupo ──────────────────────────────────────────── */
function _crearGrupoBancoEl(cuenta) {
  const id  = cuenta._id;
  const pos = _bancoPos(id) + 1;
  const bo  = _bancoBancoOpts();
  const to  = _bancoTipCtaOpts();
  const pa  = _bancoPaisOpts();
  const el  = document.createElement('div');
  el.className = 'grupo-item';
  el.id        = `banco_grupo_${id}`;
  el.innerHTML = `
    <div class="grupo-header" onclick="toggleGrupoBanco(${id})">
      <span class="grupo-titulo" id="banco_titulo_${id}"><span data-i18n="card_cuenta">${typeof t==='function'?t('card_cuenta'):'Cuenta'}</span> ${pos}</span>
      <button class="btn-eliminar-grupo" type="button" onclick="eliminarBanco(event,${id})" title="Eliminar">✕</button>
    </div>
    <div class="grupo-body" id="banco_body_${id}">
      <div class="grid-4">
        <div class="field col-full" id="field-banco_${id}_banco">
          <label><span data-i18n="sec11_entidad">${typeof t==='function'?t('sec11_entidad'):'Entidad bancaria'}</span> <span class="ic-info" data-tip="${typeof t==='function'?t('sec11_cert_tip'):'Corresponde a la cuenta bancaria registrada por el titular, la cual será utilizada para recibir pagos y realizar las operaciones financieras derivadas de la relación comercial. La información suministrada deberá coincidir con la certificación bancaria vigente adjunta al formulario.'}" data-i18n-tip="sec11_cert_tip">i</span> <span class="req">*</span></label>
          <select id="banco_${id}_banco"
                  onchange="actualizarBanco(${id},'COD_BANCO',this.value);actualizarTituloBanco(${id});limpiarError('field-banco_${id}_banco');_bancoOtrosChange(${id},'banco')">
            ${bo}
          </select>
          <span class="error-msg" data-i18n="required_field">${typeof t==='function'?t('required_field'):'Campo requerido'}</span>
        </div>
        <div class="field" id="field-banco_${id}_banco_otro" style="display:none; grid-column: span 2">
          <label><span data-i18n="field_especif_banco">${typeof t==='function'?t('field_especif_banco'):'Especifique la entidad bancaria'}</span> <span class="req">*</span></label>
          <input type="text" id="banco_${id}_otr_banco" maxlength="255"
                 data-i18n-ph="sec11_otr_banco_ph" placeholder="${typeof t==='function'?t('sec11_otr_banco_ph'):'Nombre de la entidad'}"
                 oninput="actualizarBanco(${id},'OTR_BANCO',this.value)" />
          <span class="error-msg" data-i18n="required_field">${typeof t==='function'?t('required_field'):'Campo requerido'}</span>
        </div>
        <div class="field" id="field-banco_${id}_tipcuen">
          <label><span data-i18n="sec11_tip_cuen">${typeof t==='function'?t('sec11_tip_cuen'):'Tipo de cuenta'}</span> <span class="req">*</span></label>
          <select id="banco_${id}_tipcuen"
                  onchange="actualizarBanco(${id},'TIP_CUEN',this.value);limpiarError('field-banco_${id}_tipcuen');_bancoOtrosChange(${id},'cuen')">
            ${to}
          </select>
          <span class="error-msg" data-i18n="required_field">${typeof t==='function'?t('required_field'):'Campo requerido'}</span>
        </div>
        <div class="field" id="field-banco_${id}_tipcuen_otro" style="display:none">
          <label><span data-i18n="field_especif_tipcuen">${typeof t==='function'?t('field_especif_tipcuen'):'Especifique el tipo de cuenta'}</span> <span class="req">*</span></label>
          <input type="text" id="banco_${id}_otr_cuen" maxlength="255"
                 data-i18n-ph="field_tipcuen_ph" placeholder="${typeof t==='function'?t('field_tipcuen_ph'):'Ej: cuenta fiduciaria, CDT…'}"
                 oninput="actualizarBanco(${id},'OTR_CUEN',this.value)" />
          <span class="error-msg" data-i18n="required_field">${typeof t==='function'?t('required_field'):'Campo requerido'}</span>
        </div>
        <div class="field" id="field-banco_${id}_numcuen">
          <label><span data-i18n="sec11_num_cuen">${typeof t==='function'?t('sec11_num_cuen'):'Número de cuenta'}</span> <span class="req">*</span></label>
          <input type="text" id="banco_${id}_numcuen" maxlength="30" inputmode="numeric"
                 oninput="this.value=this.value.replace(/\\D/g,'');actualizarBanco(${id},'NUM_CUEN',this.value);limpiarError('field-banco_${id}_numcuen')" />
          <span class="error-msg" data-i18n="required_field">${typeof t==='function'?t('required_field'):'Campo requerido'}</span>
        </div>
      </div>
      <div class="field field-radio">
        <label>
          <span class="solo-juridica" data-i18n="sec11_cuen_extr"
                style="${window.modoPersona==='N'?'display:none':''}">${typeof t==='function'?t('sec11_cuen_extr'):'¿La empresa posee cuentas en el extranjero?'}</span>
          <span class="solo-natural" data-i18n="sec11_cuen_extr_n"
                style="${window.modoPersona==='N'?'':'display:none'}">${typeof t==='function'?t('sec11_cuen_extr_n'):'¿La persona posee cuentas en el extranjero?'}</span>
          <span class="req">*</span>
        </label>
        <div class="radio-group">
          <label class="radio-option">
            <input type="radio" name="banco_extr_${id}" value="S"
                   onchange="onTieneExtranjeraChange(${id},'S')"> <span data-i18n="yes">${typeof t==='function'?t('yes'):'Sí'}</span>
          </label>
          <label class="radio-option">
            <input type="radio" name="banco_extr_${id}" value="N" checked
                   onchange="onTieneExtranjeraChange(${id},'N')"> <span data-i18n="no">${typeof t==='function'?t('no'):'No'}</span>
          </label>
        </div>
      </div>
      <div id="banco_${id}_ext_wrap"
           style="display:none; opacity:0; transition:opacity .2s ease; margin-top:.5rem">
        <div id="banco_${id}_ext_list"></div>
        <button type="button" class="btn btn-secondary" style="margin-top:.5rem"
                onclick="agregarCuentaExt(${id})">
          <span data-i18n="sec11_add_extr">${typeof t==='function'?t('sec11_add_extr'):'＋ Agregar cuenta extranjera'}</span>
        </button>
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

  // Migrate old flat ext fields to cuentasExt array
  if (!Array.isArray(cuenta.cuentasExt)) cuenta.cuentasExt = [];
  if (cuenta.cuentasExt.length === 0 && (cuenta.NOM_ENT_EXT || cuenta.TIP_CUE_EXT || cuenta.COD_PAIS_EXT)) {
    cuenta.cuentasExt.push({
      COD_PAIS_EXT: cuenta.COD_PAIS_EXT || null,
      OTR_PAIS_EXT: cuenta.OTR_PAIS_EXT || '',
      NOM_ENT_EXT:  cuenta.NOM_ENT_EXT  || '',
      TIP_CUE_EXT:  cuenta.TIP_CUE_EXT  || '',
    });
  }

  set(`#banco_${id}_banco`,   cuenta.COD_BANCO);
  set(`#banco_${id}_tipcuen`, cuenta.TIP_CUEN);
  set(`#banco_${id}_numcuen`, cuenta.NUM_CUEN);
  set(`#banco_${id}_otr_banco`, cuenta.OTR_BANCO);
  set(`#banco_${id}_otr_cuen`,  cuenta.OTR_CUEN);
  _bancoOtrosChange(id, 'banco');
  _bancoOtrosChange(id, 'cuen');

  if (cuenta.CUEN_EXTR === 'S') {
    const yes = el.querySelector(`input[name="banco_extr_${id}"][value="S"]`);
    if (yes) yes.checked = true;
    const wrap = el.querySelector(`#banco_${id}_ext_wrap`);
    if (wrap) { wrap.style.display = 'block'; wrap.style.opacity = '1'; }
    const list = el.querySelector(`#banco_${id}_ext_list`);
    if (list && cuenta.cuentasExt.length > 0) {
      list.innerHTML = '';
      const pa = _bancoPaisOpts();
      cuenta.cuentasExt.forEach((e, idx) => {
        const tmpDiv = document.createElement('div');
        tmpDiv.innerHTML = _crearExtEntryHTML(id, idx, e, pa);
        const entryEl = tmpDiv.firstElementChild;
        agregarOpcionOtroAlSelect(entryEl.querySelector(`#banco_${id}_ext_${idx}_pais`));
        const selPais = entryEl.querySelector(`#banco_${id}_ext_${idx}_pais`);
        if (selPais && e.COD_PAIS_EXT) { selPais.value = String(e.COD_PAIS_EXT); _extPaisOtroChange(id, idx, String(e.COD_PAIS_EXT)); }
        const inpNom = entryEl.querySelector(`#banco_${id}_ext_${idx}_nom`); if (inpNom) inpNom.value = e.NOM_ENT_EXT || '';
        const inpTip = entryEl.querySelector(`#banco_${id}_ext_${idx}_tip`); if (inpTip) inpTip.value = e.TIP_CUE_EXT || '';
        const inpOtr = entryEl.querySelector(`#banco_${id}_ext_${idx}_pais_otro`); if (inpOtr) inpOtr.value = e.OTR_PAIS_EXT || '';
        list.appendChild(entryEl);
      });
    } else if (list) {
      agregarCuentaExt(id);
    }
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
    actualizarTituloBanco(cuenta._id);
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
    if (!b.cuentasExt || b.cuentasExt.length === 0) {
      mostrarToast('Agregue al menos una cuenta extranjera.', 'error');
      ok = false;
    }
    (b.cuentasExt || []).forEach((ext, idx) => {
      if (!ext.COD_PAIS_EXT) { mostrarError(`field-banco_${id}_ext_${idx}_pais`); ok = false; }
      if (!ext.NOM_ENT_EXT || !String(ext.NOM_ENT_EXT).trim()) { mostrarError(`field-banco_${id}_ext_${idx}_nom`); ok = false; }
      if (!ext.TIP_CUE_EXT || !String(ext.TIP_CUE_EXT).trim()) { mostrarError(`field-banco_${id}_ext_${idx}_tip`); ok = false; }
    });
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

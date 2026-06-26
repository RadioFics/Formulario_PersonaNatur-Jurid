/**
 * seccion-ac.js — Sección 8: "Composición accionaria"
 *
 * Cada accionista puede ser Persona Natural ('N') o Jurídica ('J').
 * - Natural:  muestra NOM, APE, FEC_EXPE; TIP_DOCU acepta todos los tipos.
 * - Jurídica: oculta NOM, APE, FEC_EXPE; RAZ_ACCI es obligatoria;
 *             TIP_DOCU se filtra a solo NIT (COD_TPDOC = 8).
 *
 * API IDs: ac_{id}_{campo}
 * State:   formData.accionistas[]
 *
 * Depende de: state.js, utils.js (incluye getOpcionesHTML)
 */
'use strict';

/* ── Counter de IDs estables ─────────────────────────────────────────────────── */
let _acId = 0;

/* ── Fábrica de estado ──────────────────────────────────────────────────────── */
function _acCampos() {
  return {
    TIP_PERS: 'N',
    NOM_ACCI: '', APE_ACCI: '', RAZ_ACCI: '',
    TIP_DOCU: null, NUM_DOCU: '', FEC_EXPE: '',
    COD_PAIS: null, OTR_PAIS: '', COD_DEPT: null, COD_MPIO: null,
    DIR_ACCI: '', CEL_ACCI: '', TEL_ACCI: '', MAIL_ACCI: '',
    PCT_PART: '',
  };
}
function _acNuevo() {
  return { _id: _acId++, ..._acCampos() };
}
function _acGet(id) { return formData.accionistas.find(a => a._id === id); }
function _acPos(id) { return formData.accionistas.findIndex(a => a._id === id); }

/* ── Actualización de estado ─────────────────────────────────────────────────── */
function actualizarAC(id, campo, valor) {
  const a = _acGet(id);
  if (a) a[campo] = valor === '' ? null : valor;
}

function actualizarACPCT(id, valor) {
  const a = _acGet(id);
  if (a) a.PCT_PART = valor === '' ? null : valor;
  _acActualizarIndicador();
  const pct = parseFloat(valor);
  const warnEl = document.getElementById(`ac_${id}_warn5pct`);
  if (warnEl) warnEl.style.display = (!isNaN(pct) && pct > 0 && pct < 5) ? '' : 'none';
}

/* ── Título dinámico del grupo ──────────────────────────────────────────────── */
function actualizarTituloAC(id) {
  const a = _acGet(id);
  if (!a) return;
  const pos = _acPos(id) + 1;
  let nombre = '';
  if (a.TIP_PERS === 'J') {
    nombre = (a.RAZ_ACCI || '').trim().slice(0, 45);
  } else {
    nombre = [(a.NOM_ACCI || '').trim(), (a.APE_ACCI || '').trim(), (a.RAZ_ACCI || '').trim()]
      .filter(Boolean).join(' / ').slice(0, 45);
  }
  const el = document.getElementById(`ac_titulo_${id}`);
  if (el) el.innerHTML = `<span data-i18n="card_accionista">${typeof t==='function'?t('card_accionista'):'Accionista'}</span> ${pos}${nombre ? ' — ' + nombre : ''}`;
}
function _acRenumerarTodos() {
  formData.accionistas.forEach(a => actualizarTituloAC(a._id));
}

/* ── Colapsar/expandir grupo interno ────────────────────────────────────────── */
function toggleGrupoAC(id) {
  const body = document.getElementById(`ac_body_${id}`);
  if (body) body.classList.toggle('collapsed');
}

/* ── Indicador de suma (solo informativo) ───────────────────────────────────── */
function _acActualizarIndicador() {
  // Sin restricción de suma al 100%.
}

/* ── Cambio de tipo de persona (Natural / Jurídica) ─────────────────────────── */
function onACTipoPersonaChange(id, tipPers) {
  const a = _acGet(id);
  if (!a) return;
  a.TIP_PERS = tipPers;

  const naturalWrap = document.getElementById(`ac_${id}_natural_wrap`);
  const razReq      = document.getElementById(`ac_${id}_raz_req`);
  const fieldRaz    = document.getElementById(`field-ac_${id}_raz`);

  if (tipPers === 'J') {
    if (naturalWrap) { naturalWrap.style.opacity = '0'; naturalWrap.style.maxHeight = '0'; naturalWrap.style.overflow = 'hidden'; setTimeout(() => { naturalWrap.style.display = 'none'; }, 210); }
    if (razReq)      razReq.style.display = '';
    a.NOM_ACCI = null; a.APE_ACCI = null; a.FEC_EXPE = null;
    const nomEl = document.getElementById(`ac_${id}_nom`); if (nomEl) nomEl.value = '';
    const apeEl = document.getElementById(`ac_${id}_ape`); if (apeEl) apeEl.value = '';
    const fecEl = document.getElementById(`ac_${id}_fec`); if (fecEl) fecEl.value = '';
    _acFiltrarTipoDoc(id, true);
  } else {
    if (naturalWrap) { naturalWrap.style.display = ''; requestAnimationFrame(() => requestAnimationFrame(() => { naturalWrap.style.opacity = '1'; naturalWrap.style.maxHeight = '99999px'; naturalWrap.style.overflow = ''; })); }
    if (razReq)      razReq.style.display = 'none';
    a.RAZ_ACCI = null;
    const razEl = document.getElementById(`ac_${id}_raz`); if (razEl) razEl.value = '';
    if (fieldRaz) fieldRaz.classList.remove('error');
    _acFiltrarTipoDoc(id, false);
  }
  actualizarTituloAC(id);
}

/* ── Filtrar opciones de tipo de documento ───────────────────────────────────── */
function _acFiltrarTipoDoc(id, soloNit) {
  const sel = document.getElementById(`ac_${id}_tipdoc`);
  if (!sel) return;
  const endpoint = soloNit
    ? '/api/catalogo/tipos-documento'
    : '/api/catalogo/tipos-documento?todos=1';
  const optsHtml = getOpcionesHTML(endpoint, 'COD_TPDOC', 'NOM_TPDOC', 'select_placeholder');
  const current  = sel.value;
  sel.innerHTML  = optsHtml;
  agregarOpcionOtroAlTipdoc(sel);
  if (current && sel.querySelector(`option[value="${current}"]`)) {
    sel.value = current;
  } else {
    sel.value = '';
    actualizarAC(id, 'TIP_DOCU', null);
  }
}

/* ── Opciones desde caché ────────────────────────────────────────────────────── */
function _acTdOpts()    { return getOpcionesHTML('/api/catalogo/tipos-documento?todos=1', 'COD_TPDOC', 'NOM_TPDOC', 'select_placeholder'); }
function _acTdNitOpts() { return getOpcionesHTML('/api/catalogo/tipos-documento',        'COD_TPDOC', 'NOM_TPDOC', 'select_placeholder'); }
function _acPaOpts()    { return getOpcionesHTML('/api/catalogo/paises', 'COD_PAIS', 'NOM_PAIS', 'select_placeholder'); }

/* ── Crear elemento DOM de un grupo ──────────────────────────────────────────── */
function _crearGrupoACEl(accionista) {
  const id  = accionista._id;
  const esJ = accionista.TIP_PERS === 'J';
  const td  = esJ ? _acTdNitOpts() : _acTdOpts();
  const pa  = _acPaOpts();
  const natDisplay    = esJ ? 'display:none;opacity:0;max-height:0;overflow:hidden' : '';
  const razReqDisplay = esJ ? '' : 'display:none';

  const el  = document.createElement('div');
  el.className = 'grupo-item';
  el.id        = `ac_grupo_${id}`;
  el.innerHTML = `
    <div class="grupo-header" onclick="toggleGrupoAC(${id})">
      <span class="grupo-titulo" id="ac_titulo_${id}"><span data-i18n="card_accionista">${typeof t==='function'?t('card_accionista'):'Accionista'}</span> ${_acPos(id)+1}</span>
      <button class="btn-eliminar-grupo" type="button" onclick="eliminarAC(event,${id})" title="Eliminar">✕</button>
    </div>
    <div class="grupo-body" id="ac_body_${id}">

      <!-- Tipo de persona -->
      <div class="grid-2">
        <div class="field field-radio">
          <label><span data-i18n="field_tip_persona">${typeof t==='function'?t('field_tip_persona'):'Tipo de persona'}</span> <span class="req">*</span></label>
          <div class="radio-group">
            <label class="radio-option">
              <input type="radio" name="ac_tippers_${id}" value="N" ${!esJ ? 'checked' : ''}
                     onchange="onACTipoPersonaChange(${id},'N')"> ${typeof t==='function'?t('field_natural'):'Natural'}
            </label>
            <label class="radio-option">
              <input type="radio" name="ac_tippers_${id}" value="J" ${esJ ? 'checked' : ''}
                     onchange="onACTipoPersonaChange(${id},'J')"> ${typeof t==='function'?t('field_juridica'):'Jurídica'}
            </label>
          </div>
        </div>
        <div class="field" id="field-ac_${id}_pct">
          <label><span data-i18n="field_pct_part">${typeof t==='function'?t('field_pct_part'):'% Participación'}</span> <span class="req">*</span></label>
          <input type="number" id="ac_${id}_pct" min="0.01" max="100" step="0.01"
                 placeholder="Ej: 25.50"
                 oninput="actualizarACPCT(${id},this.value);limpiarError('field-ac_${id}_pct')" />
          <span class="error-msg"><span data-i18n="required_field">${typeof t==='function'?t('required_field'):'Campo requerido'}</span> (0.01 – 100)</span>
          <span id="ac_${id}_warn5pct" style="display:none;font-size:.78rem;color:#E65100;margin-top:3px">
            ⚠ ${typeof t==='function'?t('sec8_warn_5pct'):'El porcentaje de participación es menor al 5%. Los accionistas con menos del 5% generalmente no se consideran beneficiarios finales, pero igualmente deben registrarse.'}
          </span>
        </div>
      </div>

      <!-- Campos solo persona natural: NOM, APE, FEC_EXPE -->
      <div id="ac_${id}_natural_wrap" style="${natDisplay}; transition:opacity .2s,max-height .3s">
        <div class="grid-3">
          <div class="field" id="field-ac_${id}_nom">
            <label><span data-i18n="field_nombres">${typeof t==='function'?t('field_nombres'):'Nombres'}</span> <span class="req">*</span></label>
            <input type="text" id="ac_${id}_nom" maxlength="100" data-i18n-ph="ph_nombres" placeholder="${typeof t==='function'?t('ph_nombres'):'Nombres completos'}"
                   oninput="actualizarAC(${id},'NOM_ACCI',this.value);actualizarTituloAC(${id});limpiarError('field-ac_${id}_nom')" />
            <span class="error-msg" data-i18n="required_field">${typeof t==='function'?t('required_field'):'Campo requerido'}</span>
          </div>
          <div class="field" id="field-ac_${id}_ape">
            <label><span data-i18n="field_apellidos">${typeof t==='function'?t('field_apellidos'):'Apellidos'}</span> <span class="req">*</span></label>
            <input type="text" id="ac_${id}_ape" maxlength="100"
                   data-i18n-ph="ph_apellidos" placeholder="${typeof t==='function'?t('ph_apellidos'):'Apellidos completos'}"
                   oninput="actualizarAC(${id},'APE_ACCI',this.value);limpiarError('field-ac_${id}_ape')" />
            <span class="error-msg" data-i18n="required_field">${typeof t==='function'?t('required_field'):'Campo requerido'}</span>
          </div>
          <div class="field" id="field-ac_${id}_fec">
            <label><span data-i18n="field_fec_expe_doc">${typeof t==='function'?t('field_fec_expe_doc'):'Fecha expedición doc.'}</span> <span class="req">*</span></label>
            <input type="date" id="ac_${id}_fec"
                   onchange="actualizarAC(${id},'FEC_EXPE',this.value);limpiarError('field-ac_${id}_fec')" />
            <span class="error-msg" data-i18n="required_field">${typeof t==='function'?t('required_field'):'Campo requerido'}</span>
          </div>
        </div>
      </div>

      <!-- Campos comunes: RAZ, TIP_DOCU, NUM_DOCU -->
      <div class="grid-4">
        <div class="field" id="field-ac_${id}_raz">
          <label><span data-i18n="field_razon_social">${typeof t==='function'?t('field_razon_social'):'Razón social'}</span> <span class="req" id="ac_${id}_raz_req" style="${razReqDisplay}">*</span></label>
          <input type="text" id="ac_${id}_raz" maxlength="255" placeholder="${typeof t==='function'?(esJ?t('field_raz_ph'):t('field_raz_ph_aplica')):(esJ?'Nombre de la empresa':'Si aplica')}"
                 oninput="actualizarAC(${id},'RAZ_ACCI',this.value);actualizarTituloAC(${id});limpiarError('field-ac_${id}_raz')" />
          <span class="error-msg" data-i18n="required_field">${typeof t==='function'?t('required_field'):'Campo requerido'}</span>
        </div>
        <div class="field" id="field-ac_${id}_tipdoc">
          <label><span data-i18n="field_tip_doc">${typeof t==='function'?t('field_tip_doc'):'Tipo de documento'}</span> <span class="req">*</span></label>
          <select id="ac_${id}_tipdoc"
                  onchange="onACTipdocChange(${id},this.value);actualizarAC(${id},'TIP_DOCU',this.value);limpiarError('field-ac_${id}_tipdoc')">
            ${td}
          </select>
          <input type="text" id="ac_${id}_tipdoc_otro" class="otro-inp" maxlength="100" style="display:none"
                 data-i18n-ph="field_specify_doc" placeholder="${typeof t==='function'?t('field_specify_doc'):'Especifique el tipo de documento'}"
                 oninput="actualizarAC(${id},'OTR_TPDOC',this.value)" />
          <span class="error-msg" data-i18n="required_field">${typeof t==='function'?t('required_field'):'Campo requerido'}</span>
        </div>
        <div class="field" id="field-ac_${id}_numdoc">
          <label><span data-i18n="field_num_doc">${typeof t==='function'?t('field_num_doc'):'Número de documento'}</span><span class="req">*</span></label>
          <input type="text" id="ac_${id}_numdoc" maxlength="20" inputmode="numeric"
                 oninput="this.value=this.value.replace(/\\D/g,'');actualizarAC(${id},'NUM_DOCU',this.value);limpiarError('field-ac_${id}_numdoc')" />
          <span class="error-msg" data-i18n="required_field">${typeof t==='function'?t('required_field'):'Campo requerido'}</span>
        </div>
        <div class="field">
          <label><span data-i18n="field_celular">${typeof t==='function'?t('field_celular'):'Celular'}</span></label>
          <input type="tel" id="ac_${id}_cel" maxlength="20"
                 oninput="actualizarAC(${id},'CEL_ACCI',this.value)" />
        </div>
      </div>

      <!-- País / Dept / Ciudad / Dirección -->
      <div class="grid-4">
        <div class="field" id="field-ac_${id}_pais">
          <label><span data-i18n="field_pais">${typeof t==='function'?t('field_pais'):'País'}</span> <span class="req">*</span> <span class="ic-info" data-tip="${typeof t==='function'?t('field_pais_tip'):'País de domicilio o residencia del accionista.'}">i</span></label>
          <select id="ac_${id}_pais"
                  onchange="onACPaisChange(${id},this.value);limpiarError('field-ac_${id}_pais')">
            ${pa}
          </select>
          <span class="error-msg" data-i18n="required_field">${typeof t==='function'?t('required_field'):'Campo requerido'}</span>
        </div>
        <div class="field" id="field-ac_${id}_pais_otro" style="display:none">
          <label><span data-i18n="field_specify_pais">${typeof t==='function'?t('field_specify_pais'):'Especifique el país'}</span> <span class="req">*</span></label>
          <input type="text" id="ac_${id}_pais_otro" maxlength="100"
                 data-i18n-ph="country_name_ph" placeholder="${typeof t==='function'?t('country_name_ph'):'Nombre del país'}"
                 oninput="actualizarAC(${id},'OTR_PAIS',this.value)" />
        </div>
        <div class="field" id="field-ac_${id}_dept">
          <label><span data-i18n="field_dept">${typeof t==='function'?t('field_dept'):'Departamento'}</span> <span class="req">*</span></label>
          <select id="ac_${id}_dept" disabled
                  onchange="onACDeptChange(${id},this.value);limpiarError('field-ac_${id}_dept')">
            <option value="" data-i18n="select_first_country">${typeof t==='function'?t('select_first_country'):'— Seleccione país primero —'}</option>
          </select>
          <span class="error-msg" data-i18n="required_field">${typeof t==='function'?t('required_field'):'Campo requerido'}</span>
        </div>
        <div class="field" id="field-ac_${id}_mpio">
          <label><span data-i18n="field_ciudad">${typeof t==='function'?t('field_ciudad'):'Ciudad'}</span> <span class="req">*</span></label>
          <select id="ac_${id}_mpio" disabled
                  onchange="actualizarAC(${id},'COD_MPIO',this.value);limpiarError('field-ac_${id}_mpio')">
            <option value="" data-i18n="select_first_dept">${typeof t==='function'?t('select_first_dept'):'— Seleccione departamento primero —'}</option>
          </select>
          <span class="error-msg" data-i18n="required_field">${typeof t==='function'?t('required_field'):'Campo requerido'}</span>
        </div>
        <div class="field">
          <label><span data-i18n="field_dir_simple">${typeof t==='function'?t('field_dir_simple'):'Dirección'}</span></label>
          <input type="text" id="ac_${id}_dir" maxlength="255"
                 oninput="actualizarAC(${id},'DIR_ACCI',this.value)" />
        </div>
      </div>

      <!-- Tel / Mail -->
      <div class="grid-2">
        <div class="field">
          <label><span data-i18n="field_tel">${typeof t==='function'?t('field_tel'):'Teléfono fijo'}</span></label>
          <input type="tel" id="ac_${id}_tel" maxlength="20"
                 oninput="actualizarAC(${id},'TEL_ACCI',this.value)" />
        </div>
        <div class="field" id="field-ac_${id}_mail">
          <label><span data-i18n="field_mail">${typeof t==='function'?t('field_mail'):'Correo electrónico'}</span></label>
          <input type="email" id="ac_${id}_mail" maxlength="100"
                 oninput="actualizarAC(${id},'MAIL_ACCI',this.value);limpiarError('field-ac_${id}_mail')" />
          <span class="error-msg" data-i18n="invalid_email">${typeof t==='function'?t('invalid_email'):'Email inválido'}</span>
        </div>
      </div>
    </div>`;
  agregarOpcionOtroAlSelect(el.querySelector(`#ac_${id}_pais`));
  agregarOpcionOtroAlTipdoc(el.querySelector(`#ac_${id}_tipdoc`));
  return el;
}

/* ── Hidratar campos desde estado ────────────────────────────────────────────── */
function _hydrateACFields(accionista, el) {
  const id  = accionista._id;
  const esJ = accionista.TIP_PERS === 'J';
  const set = (selector, value) => {
    const field = el.querySelector(selector);
    if (field) field.value = value || '';
  };

  // Restaurar radio tipo persona
  const radJ = el.querySelector(`input[name="ac_tippers_${id}"][value="J"]`);
  const radN = el.querySelector(`input[name="ac_tippers_${id}"][value="N"]`);
  if (esJ && radJ) radJ.checked = true;
  if (!esJ && radN) radN.checked = true;

  set(`#ac_${id}_nom`,    accionista.NOM_ACCI);
  set(`#ac_${id}_ape`,    accionista.APE_ACCI);
  set(`#ac_${id}_raz`,    accionista.RAZ_ACCI);
  set(`#ac_${id}_pct`,    accionista.PCT_PART);
  set(`#ac_${id}_tipdoc`, accionista.TIP_DOCU);
  if (accionista.TIP_DOCU === 'OTR_TPDOC') {
    const inpOtro = el.querySelector(`#ac_${id}_tipdoc_otro`);
    if (inpOtro) { inpOtro.style.display = ''; inpOtro.value = accionista.OTR_TPDOC || ''; }
  }
  set(`#ac_${id}_numdoc`, accionista.NUM_DOCU);
  set(`#ac_${id}_fec`,    accionista.FEC_EXPE);
  set(`#ac_${id}_cel`,    accionista.CEL_ACCI);
  set(`#ac_${id}_dir`,    accionista.DIR_ACCI);
  set(`#ac_${id}_tel`,    accionista.TEL_ACCI);
  set(`#ac_${id}_mail`,   accionista.MAIL_ACCI);

  // Aplicar visibilidad sin animación en carga
  const naturalWrap = el.querySelector(`#ac_${id}_natural_wrap`);
  const razReq      = el.querySelector(`#ac_${id}_raz_req`);
  if (esJ) {
    if (naturalWrap) { naturalWrap.style.display = 'none'; naturalWrap.style.opacity = '0'; naturalWrap.style.maxHeight = '0'; }
    if (razReq)      razReq.style.display = '';
  } else {
    if (naturalWrap) { naturalWrap.style.display = ''; naturalWrap.style.opacity = '1'; naturalWrap.style.maxHeight = '99999px'; }
    if (razReq)      razReq.style.display = 'none';
  }

  if (accionista.COD_PAIS) {
    onACPaisChange(id, accionista.COD_PAIS).then(() => {
      if (accionista.COD_PAIS === 'OTRO' || String(accionista.COD_PAIS) === '52') {
        const inp = el.querySelector(`#ac_${id}_pais_otro`);
        if (inp) inp.value = accionista.OTR_PAIS || '';
        return Promise.resolve();
      }
      if (accionista.COD_DEPT) {
        const deptEl = el.querySelector(`#ac_${id}_dept`);
        if (deptEl) deptEl.value = accionista.COD_DEPT;
      }
      if (accionista.COD_DEPT && accionista.COD_DEPT !== 'NA') {
        return onACDeptChange(id, accionista.COD_DEPT);
      }
      return Promise.resolve();
    }).then(() => {
      const mpioEl = el.querySelector(`#ac_${id}_mpio`);
      if (mpioEl) mpioEl.value = accionista.COD_MPIO || '';
    }).catch(err => console.error('hydrate AC fields:', err));
  }
}

/* ── Render inicial de la lista ─────────────────────────────────────────────── */
async function renderListaAC() {
  const list = document.getElementById('ac-grupos-list');
  list.innerHTML = '';
  if (!Array.isArray(formData.accionistas) || formData.accionistas.length === 0) {
    formData.accionistas = [];
    _acId = 0;
    const primero = _acNuevo();
    formData.accionistas.push(primero);
  } else {
    // Migrar registros sin TIP_PERS
    formData.accionistas.forEach(a => { if (!a.TIP_PERS) a.TIP_PERS = 'N'; });
    _acId = Math.max(...formData.accionistas.map(a => a._id)) + 1;
  }

  for (const accionista of formData.accionistas) {
    const el = _crearGrupoACEl(accionista);
    list.appendChild(el);
    _hydrateACFields(accionista, el);
  }

  _acSyncEliminar();
  _acActualizarIndicador();
}

/* ── Agregar / Eliminar ──────────────────────────────────────────────────────── */
async function agregarAC() {
  const nuevo = _acNuevo();
  formData.accionistas.push(nuevo);
  document.querySelectorAll('#ac-grupos-list .grupo-body').forEach(b => b.classList.add('collapsed'));
  const list = document.getElementById('ac-grupos-list');
  const el   = _crearGrupoACEl(nuevo);
  list.appendChild(el);
  _acSyncEliminar();
  _acActualizarIndicador();
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function eliminarAC(event, id) {
  event.stopPropagation();
  if (formData.accionistas.length <= 1) return;
  formData.accionistas.splice(_acPos(id), 1);
  document.getElementById(`ac_grupo_${id}`).remove();
  _acRenumerarTodos();
  _acSyncEliminar();
  _acActualizarIndicador();
}

function _acSyncEliminar() {
  const sola = formData.accionistas.length <= 1;
  document.querySelectorAll('#ac-grupos-list .btn-eliminar-grupo').forEach(b => { b.disabled = sola; });
}

/* ── Cascadas geográficas ────────────────────────────────────────────────────── */
async function onACPaisChange(id, codPais) {
  const a = _acGet(id);
  if (!a) return;
  a.COD_PAIS = codPais ? String(codPais) : null;
  a.COD_DEPT = null;
  a.COD_MPIO = null;

  const selDept = document.getElementById(`ac_${id}_dept`);
  const selMpio = document.getElementById(`ac_${id}_mpio`);
  selMpio.innerHTML = '<option value="">' + (typeof t==='function'?t('select_first_dept'):'— Seleccione departamento primero —') + '</option>';
  selMpio.disabled  = true;
  limpiarError(`field-ac_${id}_dept`);
  limpiarError(`field-ac_${id}_mpio`);

  if (!codPais) {
    selDept.innerHTML = '<option value="">' + (typeof t==='function'?t('select_first_country'):'— Seleccione país primero —') + '</option>';
    selDept.disabled  = true; return;
  }

  if (String(codPais) === 'OTRO' || String(codPais) === '52') {
    const fieldOtroAC = document.getElementById(`field-ac_${id}_pais_otro`);
    const fieldDeptAC = document.getElementById(`field-ac_${id}_dept`);
    const fieldMpioAC = document.getElementById(`field-ac_${id}_mpio`);
    if (fieldDeptAC) fieldDeptAC.style.display = 'none';
    if (fieldMpioAC) fieldMpioAC.style.display = 'none';
    if (fieldOtroAC) { fieldOtroAC.style.display = ''; fieldOtroAC.style.gridColumn = 'span 2'; }
    return;
  }
  const fieldOtroACR = document.getElementById(`field-ac_${id}_pais_otro`);
  const fieldDeptACR = document.getElementById(`field-ac_${id}_dept`);
  const fieldMpioACR = document.getElementById(`field-ac_${id}_mpio`);
  if (fieldOtroACR) { fieldOtroACR.style.display = 'none'; fieldOtroACR.style.gridColumn = ''; a.OTR_PAIS = null; const inp = document.getElementById(`ac_${id}_pais_otro`); if (inp) inp.value = ''; }
  if (fieldDeptACR) fieldDeptACR.style.display = '';
  if (fieldMpioACR) fieldMpioACR.style.display = '';

  if (String(codPais) === COD_COLOMBIA) {
    selDept.disabled = false;
    await cargarCatalogo('/api/catalogo/departamentos', `ac_${id}_dept`,
      'COD_DEPT', 'NOM_DEPT', 'select_ph_dept', { cod_pais: codPais });
  } else {
    selDept.innerHTML = '<option value="NA">' + t('no_aplica') + '</option>';
    selDept.value = 'NA'; selDept.disabled = true;
    a.COD_DEPT = 'NA';
    selMpio.disabled = false;
    selMpio.innerHTML = '<option value="">Cargando ciudades…</option>';
    await cargarCatalogo('/api/catalogo/ciudades', `ac_${id}_mpio`,
      'COD_MUNI', 'NOM_MUNI', 'select_ph_ciudad', { cod_pais: codPais });
    if (_autoNoAplicaCiudad(selMpio)) {
      a.COD_MPIO = 'NA';
    } else {
      selMpio.onchange = e => {
        a.COD_MPIO = e.target.value || null;
        limpiarError(`field-ac_${id}_mpio`);
      };
    }
  }
}

async function onACDeptChange(id, codDept) {
  const a = _acGet(id);
  if (!a) return;
  a.COD_DEPT = codDept ? String(codDept) : null;
  a.COD_MPIO = null;

  const selMpio = document.getElementById(`ac_${id}_mpio`);
  const codPais = document.getElementById(`ac_${id}_pais`).value;
  selMpio.innerHTML = '<option value="">Cargando ciudades…</option>';
  selMpio.disabled  = true;
  if (!codDept || !codPais) return;
  await cargarCatalogo('/api/catalogo/ciudades', `ac_${id}_mpio`,
    'COD_MUNI', 'NOM_MUNI', 'select_ph_ciudad', { cod_dept: codDept, cod_pais: codPais });
  selMpio.disabled = false;
  selMpio.onchange = e => {
    a.COD_MPIO = e.target.value || null;
    limpiarError(`field-ac_${id}_mpio`);
  };
}

/* ── Validación ─────────────────────────────────────────────────────────────── */
function _validarGrupoAC(id) {
  const a   = _acGet(id);
  if (!a) return true;
  const esJ = a.TIP_PERS === 'J';
  let ok    = true;

  // Campos solo persona natural
  if (!esJ) {
    [
      [`field-ac_${id}_nom`, a.NOM_ACCI],
      [`field-ac_${id}_ape`, a.APE_ACCI],
      [`field-ac_${id}_fec`, a.FEC_EXPE],
    ].forEach(([fid, v]) => { if (!v || !String(v).trim()) { mostrarError(fid); ok = false; } });
  }

  // RAZ obligatoria para jurídica
  if (esJ && (!a.RAZ_ACCI || !String(a.RAZ_ACCI).trim())) {
    mostrarError(`field-ac_${id}_raz`); ok = false;
  }

  // Campos comunes
  [
    [`field-ac_${id}_tipdoc`, a.TIP_DOCU],
    [`field-ac_${id}_numdoc`, a.NUM_DOCU],
    [`field-ac_${id}_pais`,   a.COD_PAIS],
  ].forEach(([fid, v]) => { if (!v || !String(v).trim()) { mostrarError(fid); ok = false; } });

  if (a.TIP_DOCU === 'OTR_TPDOC' && !a.OTR_TPDOC) { mostrarError(`field-ac_${id}_tipdoc`); ok = false; }

  if (a.COD_PAIS !== 'OTRO' && String(a.COD_PAIS) !== '52') {
    [
      [`field-ac_${id}_dept`, a.COD_DEPT],
      [`field-ac_${id}_mpio`, a.COD_MPIO],
    ].forEach(([fid, v]) => { if (!v || !String(v).trim()) { mostrarError(fid); ok = false; } });
  }

  const pct = parseFloat(a.PCT_PART);
  if (!a.PCT_PART || isNaN(pct) || pct <= 0 || pct > 100) {
    mostrarError(`field-ac_${id}_pct`); ok = false;
  }
  if (a.MAIL_ACCI && !esEmailValido(a.MAIL_ACCI)) {
    mostrarError(`field-ac_${id}_mail`); ok = false;
  }
  return ok;
}

function validarSeccionAC() {
  if (formData.accionistas.length === 0) {
    mostrarToast('Agregue al menos un accionista.', 'error'); return false;
  }
  let ok = true;
  for (const a of formData.accionistas) {
    if (!_validarGrupoAC(a._id)) {
      document.getElementById(`ac_body_${a._id}`).classList.remove('collapsed');
      ok = false;
    }
  }
  return ok;
}

/* ── Acciones de botones ────────────────────────────────────────────────────── */
function validarYContinuarAC() {
  if (!validarSeccionAC()) {
    document.getElementById('accordion-ac').classList.remove('collapsed');
    const errCount = document.querySelectorAll('#accordion-ac .field.error').length;
    mostrarToast(t('toast_fields_missing').replace('{n}', errCount), 'error');
    const primerError = document.querySelector('#accordion-ac .field.error');
    if (primerError) primerError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  mostrarToast('Sección 8 completa. Continúe con la siguiente sección.', 'success');
  document.getElementById('accordion-ac').classList.add('collapsed');
  const acc9 = document.getElementById('accordion-bf');
  if (acc9) {
    acc9.classList.remove('collapsed');
    acc9.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  console.log('✅ formData.accionistas:', JSON.stringify(formData.accionistas, null, 2));
}

function onACTipdocChange(id, val) {
  const inp = document.getElementById(`ac_${id}_tipdoc_otro`);
  if (inp) inp.style.display = val === 'OTR_TPDOC' ? '' : 'none';
  if (val !== 'OTR_TPDOC') {
    if (inp) inp.value = '';
    const a = _acGet(id);
    if (a) a.OTR_TPDOC = null;
  }
}

function limpiarSeccionAC() {
  renderListaAC();
  mostrarToast('Sección limpiada.', 'success');
}

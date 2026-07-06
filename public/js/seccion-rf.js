/**
 * seccion-rf.js — Sección 7: "Revisores fiscales"
 *
 * Cada revisor puede ser Persona Natural ('N') o Jurídica ('J').
 * - Natural:  muestra NOM, APE, FEC_EXPE; TIP_DOCU acepta todos los tipos.
 * - Jurídica: oculta NOM, APE, FEC_EXPE; RAZ_REVI es obligatoria;
 *             TIP_DOCU se filtra a solo NIT (COD_TPDOC = 8).
 *
 * API IDs: rf_{id}_{campo}
 * State:   formData.revisores.revisores[i] = { _id, TIP_REPR, TIP_PERS, REVI_FIRMA, ...campos }
 *
 * Depende de: state.js, utils.js
 */
'use strict';

let _rfId = 0;

/* ── Fábrica de estado ──────────────────────────────────────────────────────── */
function _rfCampos(tipRepr) {
  return {
    TIP_REPR:    tipRepr || 'P',
    TIP_PERS:    'N',
    REVI_FIRMA:  'N',
    RAZ_FIRMA:   '',
    TIP_DOCU_FIR: null,
    OTR_TPDOC_FIR: null,
    NUM_DOCU_FIR: '',
    NOM_REVI:    '', APE_REVI: '', RAZ_REVI: '',
    TIP_DOCU:    null, NUM_DOCU: '', FEC_EXPE: '',
    COD_PAIS:    null, OTR_PAIS: '', COD_DEPT: null, COD_MPIO: null,
    DIR_REVI:    '', CEL_REVI: '', TEL_REVI: '', OBS_REVI: '', MAIL_REVI: '',
  };
}
function _rfNuevo(tipRepr) {
  return Object.assign({ _id: _rfId++ }, _rfCampos(tipRepr));
}
function _rfGet(id) { return formData.revisores.revisores.find(r => r._id === id); }
function _rfPos(id) { return formData.revisores.revisores.findIndex(r => r._id === id); }

/* ── Actualización de estado ─────────────────────────────────────────────────── */
function actualizarRF(id, campo, valor) {
  const r = _rfGet(id);
  if (r) r[campo] = valor === '' ? null : valor;
}

/* ── Título dinámico ─────────────────────────────────────────────────────────── */
function actualizarTituloRF(id) {
  const r = _rfGet(id);
  if (!r) return;
  const pos = _rfPos(id) + 1;
  const rol = r.TIP_REPR === 'S' ? 'Suplente' : 'Principal';
  const nombre = [(r.NOM_REVI || '').trim(), (r.APE_REVI || '').trim()].filter(Boolean).join(' ');
  const el = document.getElementById(`rf_titulo_${id}`);
  if (el) el.innerHTML = `<span data-i18n="card_revisor">${typeof t==='function'?t('card_revisor'):'Revisor'}</span> ${pos} (<span data-i18n="${rol==='S'?'role_suplente':'role_principal'}">${typeof t==='function'?(rol==='S'?t('role_suplente'):t('role_principal')):rol}</span>)${nombre ? ' — ' + nombre : ''}`;
}
function _rfRenumerarTodos() {
  formData.revisores.revisores.forEach(r => { actualizarTituloRF(r._id); _rfActualizarVisibilidadFirma(r._id); });
}

/**
 * "¿Designado por firma auditora?" solo aplica al primer revisor. Muestra/oculta
 * esa sección según la posición actual (que puede cambiar al agregar/eliminar
 * revisores) y, al ocultarla, resetea la respuesta para que un revisor que deja
 * de ser el primero no arrastre una designación que ya no debería tener.
 */
function _rfActualizarVisibilidadFirma(id) {
  const seccion = document.getElementById(`rf_${id}_firma_seccion`);
  if (!seccion) return;
  const esPrimero = _rfPos(id) === 0;
  seccion.style.display = esPrimero ? '' : 'none';
  if (esPrimero) return;

  const r = _rfGet(id);
  if (r && r.REVI_FIRMA === 'S') {
    r.REVI_FIRMA = 'N'; r.RAZ_FIRMA = ''; r.TIP_DOCU_FIR = null; r.OTR_TPDOC_FIR = null; r.NUM_DOCU_FIR = '';
    const wrap = document.getElementById(`rf_${id}_firma_wrap`);
    if (wrap) { wrap.style.display = 'none'; wrap.style.opacity = '0'; wrap.style.maxHeight = '0'; }
    const noRadio = document.querySelector(`input[name="rf_firma_${id}"][value="N"]`);
    if (noRadio) noRadio.checked = true;
  }
}

/* ── Colapsar/expandir ──────────────────────────────────────────────────────── */
function toggleGrupoRF(id) {
  const body = document.getElementById(`rf_body_${id}`);
  if (body) body.classList.toggle('collapsed');
}

/* ── Visibilidad de la lista ─────────────────────────────────────────────────── */
function onTieneRevisorChange(valor) {
  formData.revisores.TIE_REVIS = valor;
  const wrap = document.getElementById('rf-lista-wrap');
  if (valor === 'S') {
    wrap.style.display = 'flex';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      wrap.style.opacity = '1'; wrap.style.maxHeight = '99999px';
    }));
    if (formData.revisores.revisores.length === 0) agregarRF('P');
  } else {
    wrap.style.opacity = '0'; wrap.style.maxHeight = '0';
    setTimeout(() => {
      wrap.style.display = 'none';
      document.querySelectorAll('#accordion-rf .field.error').forEach(f => f.classList.remove('error'));
    }, 210);
  }
}

/* ── Cambio de tipo de persona (Natural / Jurídica) ─────────────────────────── */
function onRFTipoPersonaChange(id, tipPers) {
  const r = _rfGet(id);
  if (!r) return;
  r.TIP_PERS = tipPers;

  const naturalWrap = document.getElementById(`rf_${id}_natural_wrap`);
  const razReq      = document.getElementById(`rf_${id}_raz_req`);
  const fieldRaz    = document.getElementById(`field-rf_${id}_raz`);

  if (tipPers === 'J') {
    if (naturalWrap) { naturalWrap.style.opacity = '0'; naturalWrap.style.maxHeight = '0'; naturalWrap.style.overflow = 'hidden'; setTimeout(() => { naturalWrap.style.display = 'none'; }, 210); }
    if (razReq)   razReq.style.display = 'inline';
    r.NOM_REVI = null; r.APE_REVI = null; r.FEC_EXPE = null;
    const nomEl = document.getElementById(`rf_${id}_nom`); if (nomEl) nomEl.value = '';
    const apeEl = document.getElementById(`rf_${id}_ape`); if (apeEl) apeEl.value = '';
    const fecEl = document.getElementById(`rf_${id}_fec`); if (fecEl) fecEl.value = '';
    _rfFiltrarTipoDoc(id, true);
  } else {
    if (naturalWrap) { naturalWrap.style.display = ''; requestAnimationFrame(() => requestAnimationFrame(() => { naturalWrap.style.opacity = '1'; naturalWrap.style.maxHeight = '99999px'; naturalWrap.style.overflow = ''; })); }
    if (razReq)   razReq.style.display = 'none';
    r.RAZ_REVI = null;
    const razEl = document.getElementById(`rf_${id}_raz`); if (razEl) razEl.value = '';
    if (fieldRaz) fieldRaz.classList.remove('error');
    _rfFiltrarTipoDoc(id, false);
  }
  actualizarTituloRF(id);
}

/* ── Filtrar opciones de tipo de documento ───────────────────────────────────── */
function _rfFiltrarTipoDoc(id, soloNit) {
  const sel = document.getElementById(`rf_${id}_tipdoc`);
  if (!sel) return;
  const endpointBase = soloNit
    ? '/api/catalogo/tipos-documento'
    : '/api/catalogo/tipos-documento?todos=1';
  const optsHtml = getOpcionesHTML(endpointBase, 'COD_TPDOC', 'NOM_TPDOC', 'select_placeholder');
  const current  = sel.value;
  sel.innerHTML  = optsHtml;
  // Si el tipo actual sigue siendo válido, restaurarlo
  if (current && sel.querySelector(`option[value="${current}"]`)) {
    sel.value = current;
  } else {
    sel.value = '';
    actualizarRF(id, 'TIP_DOCU', null);
  }
}

/* ── Condicional de firma (por revisor) ──────────────────────────────────────── */
function onTieneFirmaChange(id, valor) {
  const r = _rfGet(id);
  if (r) r.REVI_FIRMA = valor;
  const wrap = document.getElementById(`rf_${id}_firma_wrap`);
  if (!wrap) return;
  if (valor === 'S') {
    wrap.style.display = 'block';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      wrap.style.opacity = '1'; wrap.style.maxHeight = '500px';
    }));
  } else {
    wrap.style.opacity = '0'; wrap.style.maxHeight = '0';
    setTimeout(() => { wrap.style.display = 'none'; }, 210);
  }
}

/* ── Opciones de catálogo ────────────────────────────────────────────────────── */
function _rfTdOpts()    { return getOpcionesHTML('/api/catalogo/tipos-documento?todos=1', 'COD_TPDOC', 'NOM_TPDOC', 'select_placeholder'); }
function _rfTdNitOpts() { return getOpcionesHTML('/api/catalogo/tipos-documento',        'COD_TPDOC', 'NOM_TPDOC', 'select_placeholder'); }
function _rfPaOpts()    { return getOpcionesHTML('/api/catalogo/paises', 'COD_PAIS', 'NOM_PAIS', 'select_placeholder'); }
function _rfFirmaTdOpts() {
  const nitOpts = getOpcionesHTML('/api/catalogo/tipos-documento', 'COD_TPDOC', 'NOM_TPDOC', 'select_placeholder');
  const label   = typeof t === 'function' ? t('otro_tipdoc_opt') : 'Sin asignar / Otro tipo';
  return nitOpts + `<option value="OTR_TPDOC">${label}</option>`;
}

/* ── HTML de un revisor ──────────────────────────────────────────────────────── */
function _rfMiembroHTML(r) {
  const id  = r._id;
  const td  = _rfTdOpts();
  const pa  = _rfPaOpts();
  const selS = r.TIP_REPR === 'S' ? 'selected' : '';
  const selP = r.TIP_REPR !== 'S' ? 'selected' : '';

  return `
    <div class="grupo-header" onclick="toggleGrupoRF(${id})">
      <span class="grupo-titulo" id="rf_titulo_${id}"><span data-i18n="card_revisor">${typeof t==='function'?t('card_revisor'):'Revisor'}</span> ${_rfPos(id)+1}</span>
      <button class="btn-eliminar-grupo" type="button" onclick="eliminarRF(event,${id})" title="Eliminar">✕</button>
    </div>
    <div class="grupo-body" id="rf_body_${id}">

      <!-- Rol, Nombres, Apellidos, Fecha expedición -->
      <div class="grid-4">
        <div class="field">
          <label><span data-i18n="field_rol">${typeof t==='function'?t('field_rol'):'Rol'}</span> <span class="req">*</span></label>
          <select id="rf_${id}_tipRepr"
                  onchange="actualizarRF(${id},'TIP_REPR',this.value);actualizarTituloRF(${id})">
            <option value="P" ${selP}><span data-i18n="role_principal">${typeof t==='function'?t('role_principal'):'Principal'}</span></option>
            <option value="S" ${selS}><span data-i18n="role_suplente">${typeof t==='function'?t('role_suplente'):'Suplente'}</span></option>
          </select>
        </div>
        <div class="field" id="field-rf_${id}_nom">
          <label><span data-i18n="field_nombres">${typeof t==='function'?t('field_nombres'):'Nombres'}</span> <span class="req">*</span></label>
          <input type="text" id="rf_${id}_nom" maxlength="100" data-i18n-ph="ph_nombres" placeholder="${typeof t==='function'?t('ph_nombres'):'Nombres completos'}"
                 oninput="actualizarRF(${id},'NOM_REVI',this.value);actualizarTituloRF(${id});limpiarError('field-rf_${id}_nom')" />
          <span class="error-msg" data-i18n="required_field">${typeof t==='function'?t('required_field'):'Campo requerido'}</span>
        </div>
        <div class="field" id="field-rf_${id}_ape">
          <label><span data-i18n="field_apellidos">${typeof t==='function'?t('field_apellidos'):'Apellidos'}</span> <span class="req">*</span></label>
          <input type="text" id="rf_${id}_ape" maxlength="100" data-i18n-ph="ph_apellidos" placeholder="${typeof t==='function'?t('ph_apellidos'):'Apellidos completos'}"
                 oninput="actualizarRF(${id},'APE_REVI',this.value);limpiarError('field-rf_${id}_ape')" />
          <span class="error-msg" data-i18n="required_field">${typeof t==='function'?t('required_field'):'Campo requerido'}</span>
        </div>
        <div class="field" id="field-rf_${id}_fec">
          <label><span data-i18n="field_fec_expe_doc">${typeof t==='function'?t('field_fec_expe_doc'):'Fecha expedición doc.'}</span> <span class="req">*</span></label>
          <input type="date" id="rf_${id}_fec"
                 onchange="actualizarRF(${id},'FEC_EXPE',this.value);limpiarError('field-rf_${id}_fec')" />
          <span class="error-msg" data-i18n="required_field">${typeof t==='function'?t('required_field'):'Campo requerido'}</span>
        </div>
      </div>

      <!-- TIP_DOCU, NUM_DOCU, CEL -->
      <div class="grid-3">
        <div class="field" id="field-rf_${id}_tipdoc">
          <label><span data-i18n="field_tip_doc">${typeof t==='function'?t('field_tip_doc'):'Tipo de documento'}</span> <span class="req">*</span></label>
          <select id="rf_${id}_tipdoc"
                  onchange="onRFTipdocChange(${id},this.value);actualizarRF(${id},'TIP_DOCU',this.value);limpiarError('field-rf_${id}_tipdoc')">
            ${td}
          </select>
          <input type="text" id="rf_${id}_tipdoc_otro" class="otro-inp" maxlength="100" style="display:none"
                 data-i18n-ph="field_specify_doc" placeholder="${typeof t==='function'?t('field_specify_doc'):'Especifique el tipo de documento'}"
                 oninput="actualizarRF(${id},'OTR_TPDOC',this.value)" />
          <span class="error-msg" data-i18n="required_field">${typeof t==='function'?t('required_field'):'Campo requerido'}</span>
        </div>
        <div class="field" id="field-rf_${id}_numdoc">
          <label><span data-i18n="field_num_doc">${typeof t==='function'?t('field_num_doc'):'Número de documento'}</span> <span class="req">*</span></label>
          <input type="text" id="rf_${id}_numdoc" maxlength="20" inputmode="numeric"
                 oninput="this.value=this.value.replace(/\D/g,'');actualizarRF(${id},'NUM_DOCU',this.value);limpiarError('field-rf_${id}_numdoc')" />
          <span class="error-msg" data-i18n="required_field">${typeof t==='function'?t('required_field'):'Campo requerido'}</span>
        </div>
        <div class="field" id="field-rf_${id}_cel">
          <label><span data-i18n="field_celular">${typeof t==='function'?t('field_celular'):'Celular'}</span> <span class="req">*</span></label>
          <input type="tel" id="rf_${id}_cel" maxlength="20"
                 oninput="actualizarRF(${id},'CEL_REVI',this.value);limpiarError('field-rf_${id}_cel')" />
          <span class="error-msg" data-i18n="required_field">${typeof t==='function'?t('required_field'):'Campo requerido'}</span>
        </div>
      </div>

      <!-- País / Dept / Ciudad / Dirección -->
      <div class="grid-4">
        <div class="field" id="field-rf_${id}_pais">
          <label><span data-i18n="field_pais">${typeof t==='function'?t('field_pais'):'País'}</span> <span class="req">*</span></label>
          <select id="rf_${id}_pais"
                  onchange="onRFPaisChange(${id},this.value);limpiarError('field-rf_${id}_pais')">
            ${pa}
          </select>
          <span class="error-msg" data-i18n="required_field">${typeof t==='function'?t('required_field'):'Campo requerido'}</span>
        </div>
        <div class="field" id="field-rf_${id}_pais_otro" style="display:none">
          <label><span data-i18n="field_specify_pais">${typeof t==='function'?t('field_specify_pais'):'Especifique el país'}</span> <span class="req">*</span></label>
          <input type="text" id="rf_${id}_pais_otro" maxlength="100" data-i18n-ph="country_name_ph" placeholder="${typeof t==='function'?t('country_name_ph'):'Nombre del país'}"
                 oninput="actualizarRF(${id},'OTR_PAIS',this.value)" />
        </div>
        <div class="field" id="field-rf_${id}_dept">
          <label><span data-i18n="field_dept">${typeof t==='function'?t('field_dept'):'Departamento'}</span> <span class="req">*</span></label>
          <select id="rf_${id}_dept" disabled
                  onchange="onRFDeptChange(${id},this.value);limpiarError('field-rf_${id}_dept')">
            <option value="" data-i18n="select_first_country">${typeof t==='function'?t('select_first_country'):'— Seleccione país primero —'}</option>
          </select>
          <span class="error-msg" data-i18n="required_field">${typeof t==='function'?t('required_field'):'Campo requerido'}</span>
        </div>
        <div class="field" id="field-rf_${id}_mpio">
          <label><span data-i18n="field_ciudad">${typeof t==='function'?t('field_ciudad'):'Ciudad'}</span> <span class="req">*</span></label>
          <select id="rf_${id}_mpio" disabled
                  onchange="actualizarRF(${id},'COD_MPIO',this.value);limpiarError('field-rf_${id}_mpio')">
            <option value="" data-i18n="select_first_dept">${typeof t==='function'?t('select_first_dept'):'— Seleccione departamento primero —'}</option>
          </select>
          <span class="error-msg" data-i18n="required_field">${typeof t==='function'?t('required_field'):'Campo requerido'}</span>
        </div>
        <div class="field">
          <label><span data-i18n="field_dir_simple">${typeof t==='function'?t('field_dir_simple'):'Dirección'}</span></label>
          <input type="text" id="rf_${id}_dir" maxlength="255"
                 oninput="actualizarRF(${id},'DIR_REVI',this.value)" />
        </div>
      </div>

      <!-- Tel / Mail / Obs -->
      <div class="grid-4">
        <div class="field">
          <label><span data-i18n="field_tel">${typeof t==='function'?t('field_tel'):'Teléfono fijo'}</span></label>
          <input type="tel" id="rf_${id}_tel" maxlength="20"
                 oninput="actualizarRF(${id},'TEL_REVI',this.value)" />
        </div>
        <div class="field" id="field-rf_${id}_mail">
          <label><span data-i18n="field_mail">${typeof t==='function'?t('field_mail'):'Correo electrónico'}</span> <span class="req">*</span></label>
          <input type="email" id="rf_${id}_mail" maxlength="100"
                 oninput="actualizarRF(${id},'MAIL_REVI',this.value);limpiarError('field-rf_${id}_mail')" />
          <span class="error-msg" data-i18n="invalid_email">${typeof t==='function'?t('invalid_email'):'Email inválido o vacío'}</span>
        </div>
        <div class="field col-full">
          <label><span data-i18n="field_obs">${typeof t==='function'?t('field_obs'):'Observaciones'}</span></label>
          <textarea id="rf_${id}_obs" rows="2" maxlength="500"
                    data-i18n-ph="field_obs_ph" placeholder="${typeof t==='function'?t('field_obs_ph'):'Observaciones adicionales (opcional)'}"
                    oninput="actualizarRF(${id},'OBS_REVI',this.value)"></textarea>
        </div>
      </div>

      <!-- Firma auditora — solo visible para el primer revisor -->
      <div id="rf_${id}_firma_seccion" style="${_rfPos(id) === 0 ? '' : 'display:none'}">
        <hr class="rl-divider">
        <div class="field field-radio">
          <label><span data-i18n="rf_firm_asked">${typeof t==='function'?t('rf_firm_asked'):'¿El revisor está designado por una firma auditora?'}</span> <span class="req">*</span></label>
          <div class="radio-group">
            <label class="radio-option">
              <input type="radio" name="rf_firma_${id}" value="S"
                     onchange="onTieneFirmaChange(${id},'S')"> <span><span data-i18n="yes">${typeof t==='function'?t('yes'):'Sí'}</span></span>
            </label>
            <label class="radio-option">
              <input type="radio" name="rf_firma_${id}" value="N" checked
                     onchange="onTieneFirmaChange(${id},'N')"> <span><span data-i18n="no">${typeof t==='function'?t('no'):'No'}</span></span>
            </label>
          </div>
        </div>
        <div id="rf_${id}_firma_wrap" class="firma-wrap"
             style="display:none; opacity:0; max-height:0; overflow:hidden; transition:opacity .2s,max-height .3s">
          <div class="grid-4">
            <div class="field col-full" id="field-rf_${id}_firma_raz">
              <label><span data-i18n="rf_firm_raz">${typeof t==='function'?t('rf_firm_raz'):'Razón social de la firma'}</span> <span class="req">*</span></label>
              <input type="text" id="rf_${id}_firma_raz" maxlength="255"
                     oninput="actualizarRF(${id},'RAZ_FIRMA',this.value);limpiarError('field-rf_${id}_firma_raz')" />
              <span class="error-msg" data-i18n="required_field">${typeof t==='function'?t('required_field'):'Campo requerido'}</span>
            </div>
            <div class="field" id="field-rf_${id}_firma_tipdoc">
              <label><span data-i18n="rf_firm_tipdoc">${typeof t==='function'?t('rf_firm_tipdoc'):'Tipo de documento de la firma'}</span><span class="req">*</span></label>
              <select id="rf_${id}_firma_tipdoc"
                      onchange="onRFFirmaTipdocChange(${id},this.value);actualizarRF(${id},'TIP_DOCU_FIR',this.value);limpiarError('field-rf_${id}_firma_tipdoc')">
                ${_rfFirmaTdOpts()}
              </select>
              <input type="text" id="rf_${id}_firma_tipdoc_otro" class="otro-inp" maxlength="100" style="display:none"
                     data-i18n-ph="field_specify_doc" placeholder="${typeof t==='function'?t('field_specify_doc'):'Especifique el tipo de documento'}"
                     oninput="actualizarRF(${id},'OTR_TPDOC_FIR',this.value)" />
              <span class="error-msg" data-i18n="required_field">${typeof t==='function'?t('required_field'):'Campo requerido'}</span>
            </div>
            <div class="field" id="field-rf_${id}_firma_numdoc">
              <label><span data-i18n="rf_firm_numdoc">${typeof t==='function'?t('rf_firm_numdoc'):'Número de documento de la firma'}</span><span class="req">*</span></label>
              <input type="text" id="rf_${id}_firma_numdoc" maxlength="20" inputmode="numeric"
                     oninput="this.value=this.value.replace(/\D/g,'');actualizarRF(${id},'NUM_DOCU_FIR',this.value);limpiarError('field-rf_${id}_firma_numdoc')" />
              <span class="error-msg" data-i18n="required_field">${typeof t==='function'?t('required_field'):'Campo requerido'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

/* ── Crear elemento DOM ──────────────────────────────────────────────────────── */
function _crearGrupoRFEl(r) {
  const el = document.createElement('div');
  el.className = 'grupo-item';
  el.id        = `rf_grupo_${r._id}`;
  el.innerHTML = _rfMiembroHTML(r);
  agregarOpcionOtroAlSelect(el.querySelector(`#rf_${r._id}_pais`));
  agregarOpcionOtroAlTipdoc(el.querySelector(`#rf_${r._id}_tipdoc`));
  return el;
}

/* ── Hidratar campos desde estado ────────────────────────────────────────────── */
function _hydrateRFFields(r, el) {
  const id  = r._id;
  const set = (sel, val) => { const f = el.querySelector(sel); if (f) f.value = val || ''; };

  set(`#rf_${id}_tipRepr`,  r.TIP_REPR);
  set(`#rf_${id}_nom`,      r.NOM_REVI);
  set(`#rf_${id}_ape`,      r.APE_REVI);
  set(`#rf_${id}_cel`,      r.CEL_REVI);
  set(`#rf_${id}_tipdoc`,   r.TIP_DOCU);
  if (r.TIP_DOCU === 'OTR_TPDOC') {
    const inpOtro = el.querySelector(`#rf_${id}_tipdoc_otro`);
    if (inpOtro) { inpOtro.style.display = ''; inpOtro.value = r.OTR_TPDOC || ''; }
  }
  set(`#rf_${id}_numdoc`,   r.NUM_DOCU);
  set(`#rf_${id}_fec`,      r.FEC_EXPE);
  set(`#rf_${id}_tel`,      r.TEL_REVI);
  set(`#rf_${id}_dir`,      r.DIR_REVI);
  set(`#rf_${id}_mail`,     r.MAIL_REVI);
  set(`#rf_${id}_obs`,      r.OBS_REVI);

  if (r.COD_PAIS) {
    onRFPaisChange(id, r.COD_PAIS)
      .then(() => {
        if (r.COD_PAIS === 'OTRO' || String(r.COD_PAIS) === '52') {
          const inp = el.querySelector(`#rf_${id}_pais_otro`);
          if (inp) inp.value = r.OTR_PAIS || '';
          return Promise.resolve();
        }
        const deptEl = el.querySelector(`#rf_${id}_dept`);
        if (deptEl) deptEl.value = r.COD_DEPT || '';
        if (r.COD_DEPT && r.COD_DEPT !== 'NA') return onRFDeptChange(id, r.COD_DEPT);
        return Promise.resolve();
      })
      .then(() => {
        const mpioEl = el.querySelector(`#rf_${id}_mpio`);
        if (mpioEl) mpioEl.value = r.COD_MPIO || '';
      })
      .catch(err => console.error('hydrateRF:', err));
  }

  if (r.REVI_FIRMA === 'S') {
    const yes = el.querySelector(`input[name="rf_firma_${id}"][value="S"]`);
    if (yes) yes.checked = true;
    onTieneFirmaChange(id, 'S');
    set(`#rf_${id}_firma_raz`,    r.RAZ_FIRMA);
    // Reconstruct synthetic OTR_TPDOC value if free-text was stored
    if (r.OTR_TPDOC_FIR && !r.TIP_DOCU_FIR) r.TIP_DOCU_FIR = 'OTR_TPDOC';
    set(`#rf_${id}_firma_tipdoc`, r.TIP_DOCU_FIR);
    if (r.TIP_DOCU_FIR === 'OTR_TPDOC') {
      const inpOtroFir = el.querySelector(`#rf_${id}_firma_tipdoc_otro`);
      if (inpOtroFir) { inpOtroFir.style.display = ''; inpOtroFir.value = r.OTR_TPDOC_FIR || ''; }
    }
    set(`#rf_${id}_firma_numdoc`, r.NUM_DOCU_FIR);
  }

  setTimeout(() => actualizarTituloRF(id), 0);
}

/* ── Renderizado inicial ─────────────────────────────────────────────────────── */
async function renderListaRF() {
  const wrap = document.getElementById('rf-lista-wrap');
  const list = document.getElementById('rf-grupos-list');
  list.innerHTML = '';

  if (!Array.isArray(formData.revisores.revisores)) {
    formData.revisores.revisores = [];
  }

  // Migrar formato antiguo { Principal:{}, Suplente:{} } al nuevo plano
  const migrados = [];
  for (const r of formData.revisores.revisores) {
    if (r.Principal !== undefined || r.Suplente !== undefined) {
      if (r.Principal) {
        const m = Object.assign({ _id: _rfId++, TIP_REPR: 'P', TIP_PERS: 'N',
          REVI_FIRMA: r.REVI_FIRMA || 'N', RAZ_FIRMA: r.RAZ_FIRMA || '',
          TIP_DOCU_FIR: r.TIP_DOCU_FIR || null, NUM_DOCU_FIR: r.NUM_DOCU_FIR || '' },
          r.Principal);
        migrados.push(m);
      }
      if (r.Suplente && r.Suplente.NOM_REVI && String(r.Suplente.NOM_REVI).trim()) {
        const s = Object.assign({ _id: _rfId++, TIP_REPR: 'S', TIP_PERS: 'N',
          REVI_FIRMA: 'N', RAZ_FIRMA: '', TIP_DOCU_FIR: null, NUM_DOCU_FIR: '' }, r.Suplente);
        migrados.push(s);
      }
    } else {
      // Migrar registros sin TIP_PERS al default 'N'
      if (!r.TIP_PERS) r.TIP_PERS = 'N';
      migrados.push(r);
    }
  }
  if (migrados.length > 0) formData.revisores.revisores = migrados;

  if (formData.revisores.revisores.length === 0 && formData.revisores.TIE_REVIS === 'S') {
    formData.revisores.revisores.push(_rfNuevo('P'));
  }
  _rfId = formData.revisores.revisores.length === 0
    ? 0
    : Math.max(...formData.revisores.revisores.map(r => r._id)) + 1;

  if (formData.revisores.TIE_REVIS === 'S') {
    wrap.style.display = 'flex';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      wrap.style.opacity = '1'; wrap.style.maxHeight = '99999px';
    }));
  } else {
    wrap.style.opacity = '0'; wrap.style.maxHeight = '0';
    setTimeout(() => { wrap.style.display = 'none'; }, 210);
  }

  for (const r of formData.revisores.revisores) {
    const el = _crearGrupoRFEl(r);
    list.appendChild(el);
    _hydrateRFFields(r, el);
    _rfActualizarVisibilidadFirma(r._id);
  }
  _rfSyncEliminar();
}

/* ── Agregar / Eliminar ──────────────────────────────────────────────────────── */
function agregarRF(tipRepr) {
  const nuevo = _rfNuevo(tipRepr || 'P');
  formData.revisores.revisores.push(nuevo);
  document.querySelectorAll('#rf-grupos-list .grupo-body').forEach(b => b.classList.add('collapsed'));
  const list = document.getElementById('rf-grupos-list');
  const el   = _crearGrupoRFEl(nuevo);
  list.appendChild(el);
  _rfSyncEliminar();
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  guardarBorradorDebounced();
}

function eliminarRF(event, id) {
  event.stopPropagation();
  if (formData.revisores.revisores.length <= 1) return;
  formData.revisores.revisores.splice(_rfPos(id), 1);
  document.getElementById(`rf_grupo_${id}`).remove();
  _rfRenumerarTodos();
  _rfSyncEliminar();
  guardarBorradorDebounced();
}

function _rfSyncEliminar() {
  const sola = formData.revisores.revisores.length <= 1;
  document.querySelectorAll('#rf-grupos-list .btn-eliminar-grupo').forEach(b => { b.disabled = sola; });
}

/* ── Cascadas geográficas ────────────────────────────────────────────────────── */
async function onRFPaisChange(id, codPais) {
  const r = _rfGet(id);
  if (!r) return;
  r.COD_PAIS = codPais ? String(codPais) : null;
  r.COD_DEPT = null;
  r.COD_MPIO = null;

  const selDept = document.getElementById(`rf_${id}_dept`);
  const selMpio = document.getElementById(`rf_${id}_mpio`);
  selMpio.innerHTML = '<option value="">' + (typeof t==='function'?t('select_first_dept'):'— Seleccione departamento primero —') + '</option>';
  selMpio.disabled  = true;
  limpiarError(`field-rf_${id}_dept`);
  limpiarError(`field-rf_${id}_mpio`);

  if (!codPais) {
    selDept.innerHTML = '<option value="">' + (typeof t==='function'?t('select_first_country'):'— Seleccione país primero —') + '</option>';
    selDept.disabled  = true; return;
  }

  if (String(codPais) === 'OTRO' || String(codPais) === '52') {
    const fieldOtroRF = document.getElementById(`field-rf_${id}_pais_otro`);
    const fieldDeptRF = document.getElementById(`field-rf_${id}_dept`);
    const fieldMpioRF = document.getElementById(`field-rf_${id}_mpio`);
    if (fieldDeptRF) fieldDeptRF.style.display = 'none';
    if (fieldMpioRF) fieldMpioRF.style.display = 'none';
    if (fieldOtroRF) { fieldOtroRF.style.display = ''; fieldOtroRF.style.gridColumn = 'span 2'; }
    return;
  }
  const fieldOtroRFR = document.getElementById(`field-rf_${id}_pais_otro`);
  const fieldDeptRFR = document.getElementById(`field-rf_${id}_dept`);
  const fieldMpioRFR = document.getElementById(`field-rf_${id}_mpio`);
  if (fieldOtroRFR) { fieldOtroRFR.style.display = 'none'; fieldOtroRFR.style.gridColumn = ''; r.OTR_PAIS = null; const inp = document.getElementById(`rf_${id}_pais_otro`); if (inp) inp.value = ''; }
  if (fieldDeptRFR) fieldDeptRFR.style.display = '';
  if (fieldMpioRFR) fieldMpioRFR.style.display = '';

  if (String(codPais) === COD_COLOMBIA) {
    selDept.disabled = false;
    await cargarCatalogo('/api/catalogo/departamentos', `rf_${id}_dept`,
      'COD_DEPT', 'NOM_DEPT', 'select_ph_dept', { cod_pais: codPais });
  } else {
    selDept.innerHTML = '<option value="NA">' + t('no_aplica') + '</option>';
    selDept.value = 'NA'; selDept.disabled = true;
    r.COD_DEPT = 'NA';
    selMpio.disabled = false;
    selMpio.innerHTML = '<option value="">Cargando ciudades…</option>';
    await cargarCatalogo('/api/catalogo/ciudades', `rf_${id}_mpio`,
      'COD_MUNI', 'NOM_MUNI', 'select_ph_ciudad', { cod_pais: codPais });
    if (_autoNoAplicaCiudad(selMpio)) {
      r.COD_MPIO = 'NA';
    } else {
      selMpio.onchange = e => {
        r.COD_MPIO = e.target.value ? String(e.target.value) : null;
        limpiarError(`field-rf_${id}_mpio`);
      };
    }
  }
}

async function onRFDeptChange(id, codDept) {
  const r = _rfGet(id);
  if (!r) return;
  r.COD_DEPT = codDept ? String(codDept) : null;
  r.COD_MPIO = null;

  const selMpio = document.getElementById(`rf_${id}_mpio`);
  const codPais = document.getElementById(`rf_${id}_pais`).value;
  selMpio.innerHTML = '<option value="">Cargando ciudades…</option>';
  selMpio.disabled  = true;
  if (!codDept || !codPais) return;
  await cargarCatalogo('/api/catalogo/ciudades', `rf_${id}_mpio`,
    'COD_MUNI', 'NOM_MUNI', 'select_ph_ciudad', { cod_dept: codDept, cod_pais: codPais });
  selMpio.disabled = false;
  selMpio.onchange = e => {
    r.COD_MPIO = e.target.value ? String(e.target.value) : null;
    limpiarError(`field-rf_${id}_mpio`);
  };
}

/* ── Validación ─────────────────────────────────────────────────────────────── */
function _validarMiembroRF(r) {
  const id  = r._id;
  let ok = true;

  [
    [`field-rf_${id}_nom`,    r.NOM_REVI],
    [`field-rf_${id}_ape`,    r.APE_REVI],
    [`field-rf_${id}_fec`,    r.FEC_EXPE],
    [`field-rf_${id}_tipdoc`, r.TIP_DOCU],
    [`field-rf_${id}_numdoc`, r.NUM_DOCU],
    [`field-rf_${id}_cel`,    r.CEL_REVI],
    [`field-rf_${id}_pais`,   r.COD_PAIS],
  ].forEach(([fid, v]) => { if (!v || !String(v).trim()) { mostrarError(fid); ok = false; } });

  if (r.TIP_DOCU === 'OTR_TPDOC' && !r.OTR_TPDOC) { mostrarError(`field-rf_${id}_tipdoc`); ok = false; }
  if (r.COD_PAIS === 'OTRO' && !r.OTR_PAIS) { mostrarError(`field-rf_${id}_pais_otro`); ok = false; }

  if (r.COD_PAIS !== 'OTRO') {
    [
      [`field-rf_${id}_dept`, r.COD_DEPT],
      [`field-rf_${id}_mpio`, r.COD_MPIO],
    ].forEach(([fid, v]) => { if (!v || !String(v).trim()) { mostrarError(fid); ok = false; } });
  }

  if (!r.MAIL_REVI || !esEmailValido(r.MAIL_REVI)) {
    mostrarError(`field-rf_${id}_mail`); ok = false;
  }
  if (r.REVI_FIRMA === 'S') {
    if (!r.RAZ_FIRMA || !String(r.RAZ_FIRMA).trim()) { mostrarError(`field-rf_${id}_firma_raz`); ok = false; }
    if (!r.TIP_DOCU_FIR) { mostrarError(`field-rf_${id}_firma_tipdoc`); ok = false; }
    if (r.TIP_DOCU_FIR === 'OTR_TPDOC' && !r.OTR_TPDOC_FIR) { mostrarError(`field-rf_${id}_firma_tipdoc`); ok = false; }
    if (!r.NUM_DOCU_FIR || !String(r.NUM_DOCU_FIR).trim()) { mostrarError(`field-rf_${id}_firma_numdoc`); ok = false; }
  }
  return ok;
}

function validarSeccionRF() {
  if (formData.revisores.TIE_REVIS !== 'S') return true;
  if (formData.revisores.revisores.length === 0) {
    mostrarToast('Agregue al menos un revisor fiscal.', 'error'); return false;
  }
  let ok = true;
  for (const r of formData.revisores.revisores) {
    if (!_validarMiembroRF(r)) {
      document.getElementById(`rf_body_${r._id}`).classList.remove('collapsed');
      ok = false;
    }
  }
  return ok;
}

/* ── Acciones de botones ────────────────────────────────────────────────────── */
function validarYContinuarRF() {
  if (!validarSeccionRF()) {
    document.getElementById('accordion-rf').classList.remove('collapsed');
    mostrarToast('Corrija los campos marcados en rojo.', 'error');
    const primerError = document.querySelector('#accordion-rf .field.error');
    if (primerError) primerError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  mostrarToast('Sección 7 completa. Continúe con la siguiente sección.', 'success');
  document.getElementById('accordion-rf').classList.add('collapsed');
  const acc8 = document.getElementById('accordion-ac');
  acc8.classList.remove('collapsed');
  acc8.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function onRFTipdocChange(id, val) {
  const inp = document.getElementById(`rf_${id}_tipdoc_otro`);
  if (inp) inp.style.display = val === 'OTR_TPDOC' ? '' : 'none';
  if (val !== 'OTR_TPDOC') {
    if (inp) inp.value = '';
    const r = _rfGet(id);
    if (r) r.OTR_TPDOC = null;
  }
}

function onRFFirmaTipdocChange(id, val) {
  const inp = document.getElementById(`rf_${id}_firma_tipdoc_otro`);
  if (inp) inp.style.display = val === 'OTR_TPDOC' ? '' : 'none';
  if (val !== 'OTR_TPDOC') {
    if (inp) inp.value = '';
    const r = _rfGet(id);
    if (r) r.OTR_TPDOC_FIR = null;
  }
}

function limpiarSeccionRF() {
  formData.revisores = { TIE_REVIS: 'N', revisores: [] };
  _rfId = 0;
  const radioNo = document.querySelector('input[name="rf_tie_revis"][value="N"]');
  if (radioNo) radioNo.checked = true;
  const wrap = document.getElementById('rf-lista-wrap');
  wrap.style.transition = 'none'; wrap.style.opacity = '0';
  wrap.style.maxHeight  = '0';   wrap.style.display  = 'none';
  setTimeout(() => { wrap.style.transition = ''; }, 50);
  document.getElementById('rf-grupos-list').innerHTML = '';
  mostrarToast('Sección limpiada.', 'success');
}

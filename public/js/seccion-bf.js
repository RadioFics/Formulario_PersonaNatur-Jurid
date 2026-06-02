/**
 * seccion-bf.js — Sección 12: "Beneficiarios Finales"
 *
 * Cada beneficiario puede ser Persona Natural ('N') o Jurídica ('J').
 * El discriminador es TIP_BENE (columna ya existente en GN_JURID_BF).
 * - Natural:  muestra NOM, APE, FEC_EXPE; TIP_DOCU acepta todos los tipos.
 * - Jurídica: oculta NOM, APE, FEC_EXPE; RAZ_BENE es obligatoria;
 *             TIP_DOCU se filtra a solo NIT (COD_TPDOC = 8).
 *
 * Tabla BD: GN_JURID_BF
 * API IDs:  bf_{id}_{campo}
 * State:    formData.beneficiarios[]
 *
 * Depende de: state.js, utils.js
 */
'use strict';

/* ── Counter de IDs estables ─────────────────────────────────────────────────── */
let _bfId = 0;

/* ── Fábrica de estado ──────────────────────────────────────────────────────── */
function _bfCampos() {
  return {
    TIP_BENE: 'N',
    NOM_BENE: '', APE_BENE: '', RAZ_BENE: '',
    TIP_DOCU: null, NUM_DOCU: '', FEC_EXPE: '',
    COD_PAIS: null, COD_DEPT: null, COD_MPIO: null,
    DIR_BENE: '', TEL_BENE: '', MAIL_BENE: '',
  };
}
function _bfNuevo()  { return { _id: _bfId++, ..._bfCampos() }; }
function _bfGet(id)  { return formData.beneficiarios.find(b => b._id === id); }
function _bfPos(id)  { return formData.beneficiarios.findIndex(b => b._id === id); }

/* ── Actualización de estado ─────────────────────────────────────────────────── */
function actualizarBF(id, campo, valor) {
  const b = _bfGet(id);
  if (b) b[campo] = valor === '' ? null : valor;
  guardarBorradorDebounced();
}

/* ── Título dinámico del grupo ──────────────────────────────────────────────── */
function actualizarTituloBF(id) {
  const b = _bfGet(id);
  if (!b) return;
  const pos = _bfPos(id) + 1;
  let nombre = '';
  if (b.TIP_BENE === 'J') {
    nombre = (b.RAZ_BENE || '').trim().slice(0, 45);
  } else {
    nombre = [(b.NOM_BENE || '').trim(), (b.APE_BENE || '').trim(),
              (b.RAZ_BENE || '').trim()].filter(Boolean).join(' / ').slice(0, 45);
  }
  const el = document.getElementById(`bf_titulo_${id}`);
  if (el) el.textContent = `Beneficiario ${pos}${nombre ? ' — ' + nombre : ''}`;
}
function _bfRenumerarTodos() {
  formData.beneficiarios.forEach(b => actualizarTituloBF(b._id));
}

/* ── Colapsar/expandir grupo interno ────────────────────────────────────────── */
function toggleGrupoBF(id) {
  const body = document.getElementById(`bf_body_${id}`);
  if (body) body.classList.toggle('collapsed');
}

/* ── Cambio de tipo de persona (Natural / Jurídica) ─────────────────────────── */
function onBFTipoPersonaChange(id, tipBene) {
  const b = _bfGet(id);
  if (!b) return;
  b.TIP_BENE = tipBene;

  const naturalWrap = document.getElementById(`bf_${id}_natural_wrap`);
  const razReq      = document.getElementById(`bf_${id}_raz_req`);
  const fieldRaz    = document.getElementById(`field-bf_${id}_raz`);

  if (tipBene === 'J') {
    if (naturalWrap) { naturalWrap.style.opacity = '0'; naturalWrap.style.maxHeight = '0'; naturalWrap.style.overflow = 'hidden'; setTimeout(() => { naturalWrap.style.display = 'none'; }, 210); }
    if (razReq)      razReq.style.display = '';
    b.NOM_BENE = null; b.APE_BENE = null; b.FEC_EXPE = null;
    const nomEl = document.getElementById(`bf_${id}_nom`); if (nomEl) nomEl.value = '';
    const apeEl = document.getElementById(`bf_${id}_ape`); if (apeEl) apeEl.value = '';
    const fecEl = document.getElementById(`bf_${id}_fec`); if (fecEl) fecEl.value = '';
    _bfFiltrarTipoDoc(id, true);
  } else {
    if (naturalWrap) { naturalWrap.style.display = ''; requestAnimationFrame(() => requestAnimationFrame(() => { naturalWrap.style.opacity = '1'; naturalWrap.style.maxHeight = '99999px'; naturalWrap.style.overflow = ''; })); }
    if (razReq)      razReq.style.display = 'none';
    b.RAZ_BENE = null;
    const razEl = document.getElementById(`bf_${id}_raz`); if (razEl) razEl.value = '';
    if (fieldRaz) fieldRaz.classList.remove('error');
    _bfFiltrarTipoDoc(id, false);
  }
  actualizarTituloBF(id);
  guardarBorradorDebounced();
}

/* ── Filtrar opciones de tipo de documento ───────────────────────────────────── */
function _bfFiltrarTipoDoc(id, soloNit) {
  const sel = document.getElementById(`bf_${id}_tipdoc`);
  if (!sel) return;
  const endpoint = soloNit
    ? '/api/catalogo/tipos-documento'
    : '/api/catalogo/tipos-documento?todos=1';
  const optsHtml = getOpcionesHTML(endpoint, 'COD_TPDOC', 'NOM_TPDOC', '— Seleccione —');
  const current  = sel.value;
  sel.innerHTML  = optsHtml;
  if (current && sel.querySelector(`option[value="${current}"]`)) {
    sel.value = current;
  } else {
    sel.value = '';
    actualizarBF(id, 'TIP_DOCU', null);
  }
}

/* ── Opciones desde caché ────────────────────────────────────────────────────── */
function _bfTdOpts()    { return getOpcionesHTML('/api/catalogo/tipos-documento?todos=1', 'COD_TPDOC', 'NOM_TPDOC', '— Seleccione —'); }
function _bfTdNitOpts() { return getOpcionesHTML('/api/catalogo/tipos-documento',        'COD_TPDOC', 'NOM_TPDOC', '— Seleccione —'); }
function _bfPaOpts()    { return getOpcionesHTML('/api/catalogo/paises', 'COD_PAIS', 'NOM_PAIS', '— Seleccione —'); }

/* ── Crear elemento DOM de un grupo ──────────────────────────────────────────── */
function _crearGrupoBFEl(beneficiario) {
  const id  = beneficiario._id;
  const esJ = beneficiario.TIP_BENE === 'J';
  const td  = esJ ? _bfTdNitOpts() : _bfTdOpts();
  const pa  = _bfPaOpts();
  const natDisplay    = esJ ? 'display:none;opacity:0;max-height:0;overflow:hidden' : '';
  const razReqDisplay = esJ ? '' : 'display:none';

  const el  = document.createElement('div');
  el.className = 'grupo-item';
  el.id        = `bf_grupo_${id}`;
  el.innerHTML = `
    <div class="grupo-header" onclick="toggleGrupoBF(${id})">
      <span class="grupo-titulo" id="bf_titulo_${id}">Beneficiario ${_bfPos(id)+1}</span>
      <button class="btn-eliminar-grupo" type="button"
              onclick="eliminarBF(event,${id})" title="Eliminar">&#x2715;</button>
    </div>
    <div class="grupo-body" id="bf_body_${id}">

      <!-- Tipo de persona -->
      <div class="grid-4" style="margin-bottom:6px">
        <div class="field field-radio">
          <label>Tipo de persona <span class="req">*</span></label>
          <div class="radio-group">
            <label class="radio-option">
              <input type="radio" name="bf_tippers_${id}" value="N" ${!esJ ? 'checked' : ''}
                     onchange="onBFTipoPersonaChange(${id},'N')"> Natural
            </label>
            <label class="radio-option">
              <input type="radio" name="bf_tippers_${id}" value="J" ${esJ ? 'checked' : ''}
                     onchange="onBFTipoPersonaChange(${id},'J')"> Jur&#xED;dica
            </label>
          </div>
        </div>
      </div>

      <!-- Campos solo persona natural: NOM, APE, FEC_EXPE -->
      <div id="bf_${id}_natural_wrap" style="${natDisplay}; transition:opacity .2s,max-height .3s">
        <div class="grid-4">
          <div class="field" id="field-bf_${id}_nom">
            <label>Nombres <span class="req">*</span></label>
            <input type="text" id="bf_${id}_nom" maxlength="100" placeholder="Nombres completos"
                   oninput="actualizarBF(${id},'NOM_BENE',this.value);actualizarTituloBF(${id});limpiarError('field-bf_${id}_nom')" />
            <span class="error-msg">Campo requerido</span>
          </div>
          <div class="field" id="field-bf_${id}_ape">
            <label>Apellidos <span class="req">*</span></label>
            <input type="text" id="bf_${id}_ape" maxlength="100" placeholder="Apellidos completos"
                   oninput="actualizarBF(${id},'APE_BENE',this.value);actualizarTituloBF(${id});limpiarError('field-bf_${id}_ape')" />
            <span class="error-msg">Campo requerido</span>
          </div>
          <div class="field" id="field-bf_${id}_fec">
            <label>Fecha de expedici&#xF3;n <span class="req">*</span></label>
            <input type="date" id="bf_${id}_fec"
                   onchange="actualizarBF(${id},'FEC_EXPE',this.value);limpiarError('field-bf_${id}_fec')" />
            <span class="error-msg">Campo requerido</span>
          </div>
        </div>
      </div>

      <!-- Campos comunes: RAZ, TIP_DOCU, NUM_DOCU -->
      <div class="grid-4">
        <div class="field" id="field-bf_${id}_raz">
          <label>Raz&#xF3;n social <span class="req" id="bf_${id}_raz_req" style="${razReqDisplay}">*</span></label>
          <input type="text" id="bf_${id}_raz" maxlength="255" placeholder="${esJ ? 'Nombre de la empresa' : 'Si aplica (persona jur&#xED;dica)'}"
                 oninput="actualizarBF(${id},'RAZ_BENE',this.value);actualizarTituloBF(${id});limpiarError('field-bf_${id}_raz')" />
          <span class="error-msg">Campo requerido</span>
        </div>
        <div class="field" id="field-bf_${id}_tipdoc">
          <label>Tipo de doc. <span class="req">*</span></label>
          <select id="bf_${id}_tipdoc"
                  onchange="actualizarBF(${id},'TIP_DOCU',this.value);limpiarError('field-bf_${id}_tipdoc')">
            ${td}
          </select>
          <span class="error-msg">Campo requerido</span>
        </div>
        <div class="field" id="field-bf_${id}_numdoc">
          <label>N&#xFA;mero de doc. <span class="req">*</span></label>
          <input type="text" id="bf_${id}_numdoc" maxlength="20" inputmode="numeric"
                 oninput="this.value=this.value.replace(/\\D/g,'');actualizarBF(${id},'NUM_DOCU',this.value);limpiarError('field-bf_${id}_numdoc')" />
          <span class="error-msg">Campo requerido</span>
        </div>
        <div class="field">
          <label>Tel&#xE9;fono / Celular</label>
          <input type="tel" id="bf_${id}_tel" maxlength="20"
                 oninput="actualizarBF(${id},'TEL_BENE',this.value)" />
        </div>
      </div>

      <!-- País / Dept / Ciudad / Dirección / Mail -->
      <div class="grid-4">
        <div class="field" id="field-bf_${id}_pais">
          <label>Pa&#xED;s <span class="req">*</span></label>
          <select id="bf_${id}_pais"
                  onchange="onBFPaisChange(${id},this.value);limpiarError('field-bf_${id}_pais')">
            ${pa}
          </select>
          <span class="error-msg">Campo requerido</span>
        </div>
        <div class="field" id="field-bf_${id}_dept">
          <label>Departamento <span class="req">*</span></label>
          <select id="bf_${id}_dept" disabled
                  onchange="onBFDeptChange(${id},this.value);limpiarError('field-bf_${id}_dept')">
            <option value="">&#x2014; Seleccione pa&#xED;s primero &#x2014;</option>
          </select>
          <span class="error-msg">Campo requerido</span>
        </div>
        <div class="field" id="field-bf_${id}_mpio">
          <label>Ciudad <span class="req">*</span></label>
          <select id="bf_${id}_mpio" disabled
                  onchange="actualizarBF(${id},'COD_MPIO',this.value);limpiarError('field-bf_${id}_mpio')">
            <option value="">&#x2014; Seleccione departamento primero &#x2014;</option>
          </select>
          <span class="error-msg">Campo requerido</span>
        </div>
        <div class="field">
          <label>Direcci&#xF3;n</label>
          <input type="text" id="bf_${id}_dir" maxlength="255"
                 oninput="actualizarBF(${id},'DIR_BENE',this.value)" />
        </div>
      </div>

      <div class="grid-4">
        <div class="field" id="field-bf_${id}_mail">
          <label>Correo electr&#xF3;nico</label>
          <input type="email" id="bf_${id}_mail" maxlength="100"
                 oninput="actualizarBF(${id},'MAIL_BENE',this.value);limpiarError('field-bf_${id}_mail')" />
          <span class="error-msg">Email inv&#xE1;lido</span>
        </div>
      </div>

    </div>`;
  return el;
}

/* ── Hidratar campos desde estado ────────────────────────────────────────────── */
function _hydrateBFFields(beneficiario, el) {
  const id  = beneficiario._id;
  const esJ = beneficiario.TIP_BENE === 'J';
  const set = (selector, value) => {
    const field = el.querySelector(selector);
    if (field) field.value = value || '';
  };

  // Restaurar radio tipo persona
  const radJ = el.querySelector(`input[name="bf_tippers_${id}"][value="J"]`);
  const radN = el.querySelector(`input[name="bf_tippers_${id}"][value="N"]`);
  if (esJ && radJ) radJ.checked = true;
  if (!esJ && radN) radN.checked = true;

  set(`#bf_${id}_nom`,    beneficiario.NOM_BENE);
  set(`#bf_${id}_ape`,    beneficiario.APE_BENE);
  set(`#bf_${id}_raz`,    beneficiario.RAZ_BENE);
  set(`#bf_${id}_tipdoc`, beneficiario.TIP_DOCU);
  set(`#bf_${id}_numdoc`, beneficiario.NUM_DOCU);
  set(`#bf_${id}_fec`,    beneficiario.FEC_EXPE);
  set(`#bf_${id}_tel`,    beneficiario.TEL_BENE);
  set(`#bf_${id}_mail`,   beneficiario.MAIL_BENE);
  set(`#bf_${id}_dir`,    beneficiario.DIR_BENE);

  // Aplicar visibilidad sin animación en carga
  const naturalWrap = el.querySelector(`#bf_${id}_natural_wrap`);
  const razReq      = el.querySelector(`#bf_${id}_raz_req`);
  if (esJ) {
    if (naturalWrap) { naturalWrap.style.display = 'none'; naturalWrap.style.opacity = '0'; naturalWrap.style.maxHeight = '0'; }
    if (razReq)      razReq.style.display = '';
  } else {
    if (naturalWrap) { naturalWrap.style.display = ''; naturalWrap.style.opacity = '1'; naturalWrap.style.maxHeight = '99999px'; }
    if (razReq)      razReq.style.display = 'none';
  }

  if (beneficiario.COD_PAIS) {
    onBFPaisChange(id, beneficiario.COD_PAIS).then(() => {
      if (beneficiario.COD_DEPT) {
        const deptEl = el.querySelector(`#bf_${id}_dept`);
        if (deptEl) deptEl.value = beneficiario.COD_DEPT;
      }
      if (beneficiario.COD_DEPT && beneficiario.COD_DEPT !== 'NA') {
        return onBFDeptChange(id, beneficiario.COD_DEPT);
      }
      return Promise.resolve();
    }).then(() => {
      const mpioEl = el.querySelector(`#bf_${id}_mpio`);
      if (mpioEl) mpioEl.value = beneficiario.COD_MPIO || '';
    }).catch(err => console.error('hydrate BF fields:', err));
  }
}

/* ── Render inicial de la lista ─────────────────────────────────────────────── */
async function renderListaBF() {
  const list = document.getElementById('bf-grupos-list');
  if (!list) return;
  list.innerHTML = '';

  if (!Array.isArray(formData.beneficiarios) || formData.beneficiarios.length === 0) {
    formData.beneficiarios = [];
    _bfId = 0;
    const primero = _bfNuevo();
    formData.beneficiarios.push(primero);
  } else {
    // Migrar TIP_BENE='P' (valor antiguo erróneo) a 'N'
    formData.beneficiarios.forEach(b => { if (!b.TIP_BENE || b.TIP_BENE === 'P') b.TIP_BENE = 'N'; });
    _bfId = Math.max(...formData.beneficiarios.map(b => b._id)) + 1;
  }

  for (const beneficiario of formData.beneficiarios) {
    const el = _crearGrupoBFEl(beneficiario);
    list.appendChild(el);
    _hydrateBFFields(beneficiario, el);
  }

  _bfSyncEliminar();
}

/* ── Agregar / Eliminar ──────────────────────────────────────────────────────── */
async function agregarBF() {
  const nuevo = _bfNuevo();
  formData.beneficiarios.push(nuevo);
  document.querySelectorAll('#bf-grupos-list .grupo-body').forEach(b => b.classList.add('collapsed'));
  const list = document.getElementById('bf-grupos-list');
  const el   = _crearGrupoBFEl(nuevo);
  list.appendChild(el);
  _bfSyncEliminar();
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  guardarBorradorDebounced();
}

function eliminarBF(event, id) {
  event.stopPropagation();
  if (formData.beneficiarios.length <= 1) return;
  formData.beneficiarios.splice(_bfPos(id), 1);
  document.getElementById(`bf_grupo_${id}`).remove();
  _bfRenumerarTodos();
  _bfSyncEliminar();
  guardarBorradorDebounced();
}

function _bfSyncEliminar() {
  const sola = formData.beneficiarios.length <= 1;
  document.querySelectorAll('#bf-grupos-list .btn-eliminar-grupo')
    .forEach(b => { b.disabled = sola; });
}

/* ── Cascadas geográficas ────────────────────────────────────────────────────── */
async function onBFPaisChange(id, codPais) {
  const b = _bfGet(id);
  if (!b) return;
  b.COD_PAIS = codPais || null;
  b.COD_DEPT = null;
  b.COD_MPIO = null;

  const selDept = document.getElementById(`bf_${id}_dept`);
  const selMpio = document.getElementById(`bf_${id}_mpio`);
  selMpio.innerHTML = '<option value="">&#x2014; Seleccione departamento primero &#x2014;</option>';
  selMpio.disabled  = true;
  limpiarError(`field-bf_${id}_dept`);
  limpiarError(`field-bf_${id}_mpio`);

  if (!codPais) {
    selDept.innerHTML = '<option value="">&#x2014; Seleccione pa&#xED;s primero &#x2014;</option>';
    selDept.disabled  = true;
    return;
  }

  if (codPais === COD_COLOMBIA) {
    selDept.disabled = false;
    await cargarCatalogo(
      '/api/catalogo/departamentos', `bf_${id}_dept`,
      'COD_DEPT', 'NOM_DEPT', '— Seleccione departamento —', { cod_pais: codPais }
    );
  } else {
    selDept.innerHTML = '<option value="NA">No aplica</option>';
    selDept.value    = 'NA';
    selDept.disabled = true;
    b.COD_DEPT = 'NA';
    selMpio.disabled = false;
    selMpio.innerHTML = '<option value="">Cargando ciudades&#x2026;</option>';
    await cargarCatalogo(
      '/api/catalogo/ciudades', `bf_${id}_mpio`,
      'COD_MUNI', 'NOM_MUNI', '— Seleccione ciudad —', { cod_pais: codPais }
    );
    selMpio.onchange = e => {
      b.COD_MPIO = e.target.value || null;
      limpiarError(`field-bf_${id}_mpio`);
    };
  }
}

async function onBFDeptChange(id, codDept) {
  const b = _bfGet(id);
  if (!b) return;
  b.COD_DEPT = codDept || null;
  b.COD_MPIO = null;

  const selMpio = document.getElementById(`bf_${id}_mpio`);
  const codPais = document.getElementById(`bf_${id}_pais`).value;
  selMpio.innerHTML = '<option value="">Cargando ciudades&#x2026;</option>';
  selMpio.disabled  = true;
  if (!codDept || !codPais) return;

  await cargarCatalogo(
    '/api/catalogo/ciudades', `bf_${id}_mpio`,
    'COD_MUNI', 'NOM_MUNI', '— Seleccione ciudad —',
    { cod_dept: codDept, cod_pais: codPais }
  );
  selMpio.disabled = false;
  selMpio.onchange = e => {
    b.COD_MPIO = e.target.value || null;
    limpiarError(`field-bf_${id}_mpio`);
  };
}

/* ── Validación ─────────────────────────────────────────────────────────────── */
function _validarGrupoBF(id) {
  const b   = _bfGet(id);
  if (!b) return true;
  const esJ = b.TIP_BENE === 'J';
  let ok    = true;

  // Campos solo persona natural
  if (!esJ) {
    [
      [`field-bf_${id}_nom`, b.NOM_BENE],
      [`field-bf_${id}_ape`, b.APE_BENE],
      [`field-bf_${id}_fec`, b.FEC_EXPE],
    ].forEach(([fid, v]) => { if (!v || !String(v).trim()) { mostrarError(fid); ok = false; } });
  }

  // RAZ obligatoria para jurídica
  if (esJ && (!b.RAZ_BENE || !String(b.RAZ_BENE).trim())) {
    mostrarError(`field-bf_${id}_raz`); ok = false;
  }

  // Campos comunes
  [
    [`field-bf_${id}_tipdoc`, b.TIP_DOCU],
    [`field-bf_${id}_numdoc`, b.NUM_DOCU],
    [`field-bf_${id}_pais`,   b.COD_PAIS],
    [`field-bf_${id}_dept`,   b.COD_DEPT],
    [`field-bf_${id}_mpio`,   b.COD_MPIO],
  ].forEach(([fid, v]) => {
    if (!v || !String(v).trim()) { mostrarError(fid); ok = false; }
  });

  if (b.MAIL_BENE && !esEmailValido(b.MAIL_BENE)) {
    mostrarError(`field-bf_${id}_mail`); ok = false;
  }
  return ok;
}

function validarSeccionBF() {
  if (formData.beneficiarios.length === 0) {
    mostrarToast('Agregue al menos un beneficiario final.', 'error');
    return false;
  }
  let ok = true;
  for (const b of formData.beneficiarios) {
    if (!_validarGrupoBF(b._id)) {
      document.getElementById(`bf_body_${b._id}`).classList.remove('collapsed');
      ok = false;
    }
  }
  return ok;
}

/* ── Acciones de botones ────────────────────────────────────────────────────── */
function validarYContinuarBF() {
  if (!validarSeccionBF()) {
    document.getElementById('accordion-bf').classList.remove('collapsed');
    mostrarToast('Corrija los campos marcados en rojo.', 'error');
    const primerError = document.querySelector('#accordion-bf .field.error');
    if (primerError) primerError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  mostrarToast('Sección 12 completa. Continúe con la sección 13.', 'success');
  document.getElementById('accordion-bf').classList.add('collapsed');
  const acc13 = document.getElementById('accordion-docs');
  if (acc13) {
    acc13.classList.remove('collapsed');
    acc13.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  console.log('✅ formData.beneficiarios:', JSON.stringify(formData.beneficiarios, null, 2));
}

function limpiarSeccionBF() {
  renderListaBF();
  mostrarToast('Sección limpiada.', 'success');
}

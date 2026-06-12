/**
 * seccion-rl.js — Sección 2: "Información del representante legal"
 *
 * Patrón: bloque Principal fijo en HTML (idx 0) + extras dinámicos (idx >= 1).
 * Los extras se renderizan en #rl-extras-list.
 *
 * State: formData.representantes[]  (array, TIP_REPR: 'P' | 'S')
 * Depende de: state.js, utils.js
 */
'use strict';

let _rlExtraId = 0;
const _rlExtraMap = new Map(); // extraId → arrayIndex

function _rlCampos(tipRepr) {
  return {
    TIP_REPR: tipRepr,
    NOM_REPR: '', APE_REPR: '', TIP_DOCU: null, NUM_DOCU: '',
    FEC_EXPE: '', COD_PAIS: null, OTR_PAIS: '', COD_DEPT: null, COD_MPIO: null,
    DIR_REPR: '', CEL_REPR: '', TEL_REPR: '', MAIL_REPR: '',
  };
}

function actualizarRL(idx, campo, valor) {
  if (!formData.representantes[idx]) return;
  formData.representantes[idx][campo] = valor === '' ? null : valor;
}

function _rlTdOpts() {
  return getOpcionesHTML('/api/catalogo/tipos-documento?todos=1', 'COD_TPDOC', 'NOM_TPDOC', '— Seleccione —');
}
function _rlPaOpts() {
  return getOpcionesHTML('/api/catalogo/paises', 'COD_PAIS', 'NOM_PAIS', '— Seleccione —');
}

/* ── HTML extra ─────────────────────────────────────────────────────────────── */
function _rlExtraHTML(extraId, idx) {
  const td  = _rlTdOpts();
  const pa  = _rlPaOpts();
  const num = idx;
  return `
    <hr class="rl-divider">
    <div class="grupo-item" id="rl_extra_${extraId}">
      <div class="grupo-header" style="cursor:default">
        <span class="grupo-titulo">
          <span class="rl-badge suplente">S</span>
          Representante adicional ${num}
        </span>
        <button class="btn-eliminar-grupo" type="button"
                onclick="eliminarRLExtra(${extraId})" title="Eliminar">&#10005;</button>
      </div>
      <div class="grupo-body">
        <div class="grid-4">
          <div class="field" id="field-rl_x${extraId}_nom">
            <label>Nombres <span class="req">*</span></label>
            <input type="text" id="rl_x${extraId}_nom" maxlength="100" placeholder="Nombres completos"
                   oninput="actualizarRL(${idx},'NOM_REPR',this.value);limpiarError('field-rl_x${extraId}_nom')" />
            <span class="error-msg">Campo requerido</span>
          </div>
          <div class="field" id="field-rl_x${extraId}_ape">
            <label>Apellidos <span class="req">*</span></label>
            <input type="text" id="rl_x${extraId}_ape" maxlength="100" placeholder="Apellidos completos"
                   oninput="actualizarRL(${idx},'APE_REPR',this.value);limpiarError('field-rl_x${extraId}_ape')" />
            <span class="error-msg">Campo requerido</span>
          </div>
          <div class="field" id="field-rl_x${extraId}_tipdoc">
            <label>Tipo de documento <span class="req">*</span></label>
            <select id="rl_x${extraId}_tipdoc"
                    onchange="actualizarRL(${idx},'TIP_DOCU',this.value);limpiarError('field-rl_x${extraId}_tipdoc')">
              ${td}
            </select>
            <span class="error-msg">Campo requerido</span>
          </div>
          <div class="field" id="field-rl_x${extraId}_numdoc">
            <label>Número de documento <span class="req">*</span></label>
            <input type="text" id="rl_x${extraId}_numdoc" maxlength="20" inputmode="numeric"
                   oninput="this.value=this.value.replace(/\D/g,'');actualizarRL(${idx},'NUM_DOCU',this.value);limpiarError('field-rl_x${extraId}_numdoc')" />
            <span class="error-msg">Campo requerido</span>
          </div>
        </div>
        <div class="grid-4">
          <div class="field" id="field-rl_x${extraId}_fec">
            <label>Fecha de expedición <span class="req">*</span></label>
            <input type="date" id="rl_x${extraId}_fec"
                   onchange="actualizarRL(${idx},'FEC_EXPE',this.value);limpiarError('field-rl_x${extraId}_fec')" />
            <span class="error-msg">Campo requerido</span>
          </div>
          <div class="field" id="field-rl_x${extraId}_pais">
            <label>País <span class="req">*</span></label>
            <select id="rl_x${extraId}_pais"
                    onchange="onRLExtraPaisChange(${extraId},${idx},this.value);limpiarError('field-rl_x${extraId}_pais')">
              ${pa}
            </select>
            <span class="error-msg">Campo requerido</span>
          </div>
          <div class="field" id="field-rl_x${extraId}_pais_otro" style="display:none">
            <label>Especifique el pa&#xED;s <span class="req">*</span></label>
            <input type="text" id="rl_x${extraId}_pais_otro" maxlength="100" placeholder="Nombre del pa&#xED;s"
                   oninput="actualizarRL(${idx},'OTR_PAIS',this.value)" />
          </div>
          <div class="field" id="field-rl_x${extraId}_dept">
            <label>Departamento <span class="req">*</span></label>
            <select id="rl_x${extraId}_dept" disabled
                    onchange="onRLExtraDeptChange(${extraId},${idx},this.value);limpiarError('field-rl_x${extraId}_dept')">
              <option value="">— Seleccione país primero —</option>
            </select>
            <span class="error-msg">Campo requerido</span>
          </div>
          <div class="field" id="field-rl_x${extraId}_mpio">
            <label>Ciudad <span class="req">*</span></label>
            <select id="rl_x${extraId}_mpio" disabled
                    onchange="actualizarRL(${idx},'COD_MPIO',this.value);limpiarError('field-rl_x${extraId}_mpio')">
              <option value="">— Seleccione departamento primero —</option>
            </select>
            <span class="error-msg">Campo requerido</span>
          </div>
        </div>
        <div class="grid-4">
          <div class="field" id="field-rl_x${extraId}_dir">
            <label>Direcci\xF3n domicilio <span class="req">*</span></label>
            <input type="text" id="rl_x${extraId}_dir" maxlength="255"
                   oninput="actualizarRL(${idx},'DIR_REPR',this.value);limpiarError('field-rl_x${extraId}_dir')" />
            <span class="error-msg">Campo requerido</span>
          </div>
          <div class="field" id="field-rl_x${extraId}_cel">
            <label>Celular <span class="req">*</span></label>
            <input type="tel" id="rl_x${extraId}_cel" maxlength="20"
                   oninput="actualizarRL(${idx},'CEL_REPR',this.value);limpiarError('field-rl_x${extraId}_cel')" />
            <span class="error-msg">Campo requerido</span>
          </div>
          <div class="field">
            <label>Teléfono fijo</label>
            <input type="tel" id="rl_x${extraId}_tel" maxlength="20"
                   oninput="actualizarRL(${idx},'TEL_REPR',this.value)" />
          </div>
          <div class="field" id="field-rl_x${extraId}_mail">
            <label>Correo electrónico <span class="req">*</span></label>
            <input type="email" id="rl_x${extraId}_mail" maxlength="100"
                   oninput="actualizarRL(${idx},'MAIL_REPR',this.value);limpiarError('field-rl_x${extraId}_mail')" />
            <span class="error-msg">Email inválido o vacío</span>
          </div>
        </div>
      </div>
    </div>`;
}

/* ── Agregar / Eliminar extras ──────────────────────────────────────────────── */
function agregarRLExtra() {
  const idx     = formData.representantes.length;
  const extraId = _rlExtraId++;
  _rlExtraMap.set(extraId, idx);
  formData.representantes.push(_rlCampos('S'));

  const list = document.getElementById('rl-extras-list');
  const div  = document.createElement('div');
  div.id = `rl_extra_wrap_${extraId}`;
  div.innerHTML = _rlExtraHTML(extraId, idx);
  list.appendChild(div);
  div.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  if (typeof renderDocRLFields === 'function') renderDocRLFields();
  guardarBorradorDebounced();
}

function eliminarRLExtra(extraId) {
  const idx = _rlExtraMap.get(extraId);
  if (idx === undefined) return;
  formData.representantes.splice(idx, 1);
  _rlExtraMap.forEach((v, k) => { if (v > idx) _rlExtraMap.set(k, v - 1); });
  _rlExtraMap.delete(extraId);
  const wrap = document.getElementById(`rl_extra_wrap_${extraId}`);
  if (wrap) wrap.remove();
  if (typeof renderDocRLFields === 'function') renderDocRLFields();
  guardarBorradorDebounced();
}

/* ── Cascadas — Principal ───────────────────────────────────────────────────── */
async function onRLPaisChange(codPais, prefijo, idx) {
  actualizarRL(idx, 'COD_PAIS', codPais);
  actualizarRL(idx, 'COD_DEPT', null);
  actualizarRL(idx, 'COD_MPIO', null);

  const selDept    = document.getElementById(`${prefijo}_dept`);
  const selMpio    = document.getElementById(`${prefijo}_mpio`);
  const fieldOtro  = document.getElementById(`field-${prefijo}_pais_otro`);
  const fieldDept  = document.getElementById(`field-${prefijo}_dept`);
  const fieldMpio  = document.getElementById(`field-${prefijo}_mpio`);

  selMpio.innerHTML = '<option value="">— Seleccione departamento primero —</option>';
  selMpio.disabled  = true;
  limpiarError(`field-${prefijo}_dept`);
  limpiarError(`field-${prefijo}_mpio`);

  if (codPais === 'OTRO') {
    if (fieldDept) fieldDept.style.display = 'none';
    if (fieldMpio) fieldMpio.style.display = 'none';
    if (fieldOtro) { fieldOtro.style.display = ''; fieldOtro.style.gridColumn = 'span 2'; }
    return;
  }

  if (fieldOtro) {
    fieldOtro.style.display = 'none';
    fieldOtro.style.gridColumn = '';
    actualizarRL(idx, 'OTR_PAIS', '');
    const inp = document.getElementById(`${prefijo}_pais_otro`);
    if (inp) inp.value = '';
  }
  if (fieldDept) fieldDept.style.display = '';
  if (fieldMpio) fieldMpio.style.display = '';

  if (!codPais) {
    selDept.innerHTML = '<option value="">— Seleccione país primero —</option>';
    selDept.disabled  = true; return;
  }
  if (codPais === COD_COLOMBIA) {
    selDept.disabled = false;
    await cargarCatalogo('/api/catalogo/departamentos', `${prefijo}_dept`,
      'COD_DEPT', 'NOM_DEPT', '— Seleccione departamento —', { cod_pais: codPais });
  } else {
    selDept.innerHTML = '<option value="NA">No aplica</option>';
    selDept.value = 'NA'; selDept.disabled = true;
    actualizarRL(idx, 'COD_DEPT', 'NA');
    selMpio.disabled = false;
    selMpio.innerHTML = '<option value="">Cargando ciudades…</option>';
    await cargarCatalogo('/api/catalogo/ciudades', `${prefijo}_mpio`,
      'COD_MUNI', 'NOM_MUNI', '— Seleccione ciudad —', { cod_pais: codPais });
    if (_autoNoAplicaCiudad(selMpio)) {
      actualizarRL(idx, 'COD_MPIO', 'NA');
    } else {
      selMpio.onchange = e => { actualizarRL(idx, 'COD_MPIO', e.target.value); limpiarError(`field-${prefijo}_mpio`); };
    }
  }
}

async function onRLDeptChange(codDept, prefijo, idx) {
  actualizarRL(idx, 'COD_DEPT', codDept);
  actualizarRL(idx, 'COD_MPIO', null);
  const selMpio = document.getElementById(`${prefijo}_mpio`);
  const codPais = document.getElementById(`${prefijo}_pais`).value;
  selMpio.innerHTML = '<option value="">Cargando ciudades…</option>';
  selMpio.disabled  = true;
  if (!codDept || !codPais) return;
  await cargarCatalogo('/api/catalogo/ciudades', `${prefijo}_mpio`,
    'COD_MUNI', 'NOM_MUNI', '— Seleccione ciudad —', { cod_dept: codDept, cod_pais: codPais });
  selMpio.disabled = false;
  selMpio.onchange = e => { actualizarRL(idx, 'COD_MPIO', e.target.value); limpiarError(`field-${prefijo}_mpio`); };
}

/* ── Cascadas — Extras ──────────────────────────────────────────────────────── */
async function onRLExtraPaisChange(extraId, idx, codPais) {
  actualizarRL(idx, 'COD_PAIS', codPais);
  actualizarRL(idx, 'COD_DEPT', null);
  actualizarRL(idx, 'COD_MPIO', null);

  const selDept    = document.getElementById(`rl_x${extraId}_dept`);
  const selMpio    = document.getElementById(`rl_x${extraId}_mpio`);
  const fieldOtro  = document.getElementById(`field-rl_x${extraId}_pais_otro`);
  const fieldDept  = document.getElementById(`field-rl_x${extraId}_dept`);
  const fieldMpio  = document.getElementById(`field-rl_x${extraId}_mpio`);

  selMpio.innerHTML = '<option value="">— Seleccione departamento primero —</option>';
  selMpio.disabled  = true;
  limpiarError(`field-rl_x${extraId}_dept`);
  limpiarError(`field-rl_x${extraId}_mpio`);

  if (codPais === 'OTRO') {
    if (fieldDept) fieldDept.style.display = 'none';
    if (fieldMpio) fieldMpio.style.display = 'none';
    if (fieldOtro) { fieldOtro.style.display = ''; fieldOtro.style.gridColumn = 'span 2'; }
    return;
  }

  if (fieldOtro) {
    fieldOtro.style.display = 'none';
    fieldOtro.style.gridColumn = '';
    actualizarRL(idx, 'OTR_PAIS', '');
    const inp = document.getElementById(`rl_x${extraId}_pais_otro`);
    if (inp) inp.value = '';
  }
  if (fieldDept) fieldDept.style.display = '';
  if (fieldMpio) fieldMpio.style.display = '';

  if (!codPais) { selDept.innerHTML = '<option value="">— Seleccione país primero —</option>'; selDept.disabled = true; return; }
  if (String(codPais) === COD_COLOMBIA) {
    selDept.disabled = false;
    await cargarCatalogo('/api/catalogo/departamentos', `rl_x${extraId}_dept`,
      'COD_DEPT', 'NOM_DEPT', '— Seleccione departamento —', { cod_pais: codPais });
  } else {
    selDept.innerHTML = '<option value="NA">No aplica</option>';
    selDept.value = 'NA'; selDept.disabled = true;
    actualizarRL(idx, 'COD_DEPT', 'NA');
    selMpio.disabled = false;
    selMpio.innerHTML = '<option value="">Cargando ciudades…</option>';
    await cargarCatalogo('/api/catalogo/ciudades', `rl_x${extraId}_mpio`,
      'COD_MUNI', 'NOM_MUNI', '— Seleccione ciudad —', { cod_pais: codPais });
    if (_autoNoAplicaCiudad(selMpio)) {
      actualizarRL(idx, 'COD_MPIO', 'NA');
    } else {
      selMpio.onchange = e => { actualizarRL(idx, 'COD_MPIO', e.target.value); limpiarError(`field-rl_x${extraId}_mpio`); };
    }
  }
}

async function onRLExtraDeptChange(extraId, idx, codDept) {
  actualizarRL(idx, 'COD_DEPT', codDept);
  actualizarRL(idx, 'COD_MPIO', null);
  const selMpio = document.getElementById(`rl_x${extraId}_mpio`);
  const codPais = document.getElementById(`rl_x${extraId}_pais`).value;
  selMpio.innerHTML = '<option value="">Cargando ciudades…</option>';
  selMpio.disabled  = true;
  if (!codDept || !codPais) return;
  await cargarCatalogo('/api/catalogo/ciudades', `rl_x${extraId}_mpio`,
    'COD_MUNI', 'NOM_MUNI', '— Seleccione ciudad —', { cod_dept: codDept, cod_pais: codPais });
  selMpio.disabled = false;
  selMpio.onchange = e => { actualizarRL(idx, 'COD_MPIO', e.target.value); limpiarError(`field-rl_x${extraId}_mpio`); };
}

/* ── Validación ─────────────────────────────────────────────────────────────── */
function _rlExtraIdFromIdx(idx) {
  for (const [k, v] of _rlExtraMap) { if (v === idx) return k; }
  return null;
}

function validarBloqueRL(idx) {
  const d = formData.representantes[idx];
  if (!d) return true;
  const isExtra  = idx > 0;
  const extraId  = isExtra ? _rlExtraIdFromIdx(idx) : null;
  const pid = (c) => isExtra ? `field-rl_x${extraId}_${c}` : `field-rl_p_${c}`;

  const req = [
    [pid('nom'),    d.NOM_REPR], [pid('ape'),    d.APE_REPR],
    [pid('tipdoc'), d.TIP_DOCU], [pid('numdoc'), d.NUM_DOCU],
    [pid('fec'),    d.FEC_EXPE], [pid('pais'),   d.COD_PAIS],
    [pid('dept'),   d.COD_DEPT], [pid('mpio'),   d.COD_MPIO],
    [pid('dir'),    d.DIR_REPR], [pid('cel'),    d.CEL_REPR],
  ];
  let ok = true;
  req.forEach(([fid, v]) => { if (!v || !String(v).trim()) { mostrarError(fid); ok = false; } });
  if (!d.MAIL_REPR || !esEmailValido(d.MAIL_REPR)) { mostrarError(pid('mail')); ok = false; }
  return ok;
}

function validarSeccionRL() {
  let ok = validarBloqueRL(0);
  for (let i = 1; i < formData.representantes.length; i++) {
    // Saltar entradas huérfanas: entradas que existen en el array de estado
    // pero no tienen una entrada en _rlExtraMap (ej. borradores guardados con el
    // suplente vacío de la versión anterior). Sin esta guarda, fallan silenciosamente
    // porque su fieldId (field-rl_xnull_*) no existe en el DOM.
    if (_rlExtraIdFromIdx(i) === null) continue;
    if (!validarBloqueRL(i)) ok = false;
  }
  return ok;
}

function validarYContinuarRL() {
  if (!validarSeccionRL()) {
    document.getElementById('accordion-rl').classList.remove('collapsed');
    mostrarToast('Corrija los campos marcados en rojo.', 'error');
    const primerError = document.querySelector('#accordion-rl .field.error');
    if (primerError) primerError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  mostrarToast('Sección 2 completa. Continúe con la siguiente sección.', 'success');
  document.getElementById('accordion-rl').classList.add('collapsed');
  const acc3 = document.getElementById('accordion-sociedad');
  acc3.classList.remove('collapsed');
  acc3.scrollIntoView({ behavior: 'smooth', block: 'start' });
  console.log('✅ formData.representantes:', JSON.stringify(formData.representantes, null, 2));
}

function limpiarSeccionRL() {
  document.getElementById('rl-extras-list').innerHTML = '';
  _rlExtraMap.clear();
  _rlExtraId = 0;
  formData.representantes = [_rlCampos('P')];

  const bloque = document.getElementById('rl-bloque-principal');
  if (bloque) {
    bloque.querySelectorAll('input, select').forEach(el => {
      el.tagName === 'SELECT' ? (el.selectedIndex = 0) : (el.value = '');
    });
    const dept = document.getElementById('rl_p_dept');
    const mpio = document.getElementById('rl_p_mpio');
    if (dept) { dept.innerHTML = '<option value="">— Seleccione país primero —</option>'; dept.disabled = true; }
    if (mpio) { mpio.innerHTML = '<option value="">— Seleccione departamento primero —</option>'; mpio.disabled = true; }
    bloque.querySelectorAll('.field.error').forEach(f => f.classList.remove('error'));
  }
  mostrarToast('Sección limpiada.', 'success');
}

/* ── Hidratación (borrador / modo actualizar) ───────────────────────────────── */
async function hidratarBloqueRLPrincipal() {
  const d = formData.representantes[0];
  if (!d) return;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  set('rl_p_nom',    d.NOM_REPR);
  set('rl_p_ape',    d.APE_REPR);
  set('rl_p_tipdoc', d.TIP_DOCU);
  set('rl_p_numdoc', d.NUM_DOCU);
  set('rl_p_fec',    d.FEC_EXPE);
  set('rl_p_dir',    d.DIR_REPR);
  set('rl_p_cel',    d.CEL_REPR);
  set('rl_p_tel',    d.TEL_REPR);
  set('rl_p_mail',   d.MAIL_REPR);
  if (d.COD_PAIS) {
    await onRLPaisChange(d.COD_PAIS, 'rl_p', 0);
    set('rl_p_pais', d.COD_PAIS);
    if (d.COD_PAIS === 'OTRO') {
      set('rl_p_pais_otro', d.OTR_PAIS);
    } else {
      if (d.COD_DEPT && d.COD_DEPT !== 'NA') {
        await onRLDeptChange(d.COD_DEPT, 'rl_p', 0);
        set('rl_p_dept', d.COD_DEPT);
      }
      set('rl_p_mpio', d.COD_MPIO);
    }
  }
}

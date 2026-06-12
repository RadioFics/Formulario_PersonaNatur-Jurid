/**
 * seccion-jd.js — Sección 6: "Junta directiva / Consejo de administración"
 *
 * Patrón: lista plana de miembros. Cada miembro tiene un selector de Rol
 * (Principal / Suplente). El botón "+ Agregar miembro" añade cualquier tipo.
 *
 * API IDs: jd_{id}_{campo}
 * State:   formData.juntaDirectiva.miembros[i] = { _id, TIP_REPR, ...campos }
 *
 * Depende de: state.js, utils.js
 */
'use strict';

let _jdId = 0;

function _jdCampos(tipRepr) {
  return {
    TIP_REPR: tipRepr || 'P',
    TIP_MIEM: '', NOM_MIEM: '', APE_MIEM: '',
    TIP_DOCU: null, NUM_DOCU: '', FEC_EXPE: '',
    COD_PAIS: null, OTR_PAIS: '', COD_DEPT: null, COD_MPIO: null,
    DIR_MIEM: '', CEL_MIEM: '', TEL_MIEM: '', MAIL_MIEM: '',
  };
}
function _jdNuevo(tipRepr) {
  return Object.assign({ _id: _jdId++ }, _jdCampos(tipRepr));
}
function _jdGet(id)  { return formData.juntaDirectiva.miembros.find(m => m._id === id); }
function _jdPos(id)  { return formData.juntaDirectiva.miembros.findIndex(m => m._id === id); }

function actualizarJDMiem(id, campo, valor) {
  const m = _jdGet(id);
  if (m) m[campo] = valor === '' ? null : valor;
}

function actualizarTituloJD(id) {
  const m = _jdGet(id);
  if (!m) return;
  const pos = _jdPos(id);
  // TIP_REPR siempre refleja la posición actual
  m.TIP_REPR = pos === 0 ? 'P' : 'S';
  const nom = [(m.NOM_MIEM || '').trim(), (m.APE_MIEM || '').trim()].filter(Boolean).join(' ');
  const rol = pos === 0 ? 'Principal' : 'Suplente';
  const el  = document.getElementById(`jd_titulo_${id}`);
  if (el) el.textContent = `Miembro ${pos + 1} (${rol})${nom ? ' — ' + nom : ''}`;
}
function _jdRenumerarTodos() {
  formData.juntaDirectiva.miembros.forEach(m => actualizarTituloJD(m._id));
}

function toggleGrupoJD(id) {
  const body = document.getElementById(`jd_body_${id}`);
  if (body) body.classList.toggle('collapsed');
}

function onTieneJuntaChange(valor) {
  formData.juntaDirectiva.TIE_JUNTA = valor;
  const wrap = document.getElementById('jd-lista-wrap');
  if (valor === 'S') {
    wrap.style.display = 'flex';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      wrap.style.opacity = '1'; wrap.style.maxHeight = '99999px';
    }));
    if (formData.juntaDirectiva.miembros.length === 0) agregarJD('P');
  } else {
    wrap.style.opacity = '0'; wrap.style.maxHeight = '0';
    setTimeout(() => {
      wrap.style.display = 'none';
      document.querySelectorAll('#accordion-jd .field.error').forEach(f => f.classList.remove('error'));
    }, 210);
  }
}

function _jdTdOpts() { return getOpcionesHTML('/api/catalogo/tipos-documento?todos=1','COD_TPDOC','NOM_TPDOC','— Seleccione —'); }
function _jdPaOpts() { return getOpcionesHTML('/api/catalogo/paises','COD_PAIS','NOM_PAIS','— Seleccione —'); }

function _jdMiembroHTML(m) {
  const id  = m._id;
  const pos = _jdPos(id);
  const rol = pos === 0 ? 'Principal' : 'Suplente';
  const td  = _jdTdOpts();
  const pa  = _jdPaOpts();
  return `
    <div class="grupo-header" onclick="toggleGrupoJD(${id})">
      <span class="grupo-titulo" id="jd_titulo_${id}">Miembro ${pos + 1} (${rol})</span>
      <button class="btn-eliminar-grupo" type="button" onclick="eliminarJD(event,${id})" title="Eliminar">✕</button>
    </div>
    <div class="grupo-body" id="jd_body_${id}">
      <div class="grid-4">
        <div class="field" style="grid-column: span 2" id="field-jd_${id}_tipmiem">
          <label>Tipo de miembro <span class="req">*</span></label>
          <input type="text" id="jd_${id}_tipmiem" maxlength="100"
                 placeholder="Ej: Titular, Suplente de consejo…"
                 oninput="actualizarJDMiem(${id},'TIP_MIEM',this.value);limpiarError('field-jd_${id}_tipmiem')" />
          <span class="error-msg">Campo requerido</span>
        </div>
        <div class="field" id="field-jd_${id}_nom">
          <label>Nombres <span class="req">*</span></label>
          <input type="text" id="jd_${id}_nom" maxlength="100"
                 oninput="actualizarJDMiem(${id},'NOM_MIEM',this.value);actualizarTituloJD(${id});limpiarError('field-jd_${id}_nom')" />
          <span class="error-msg">Campo requerido</span>
        </div>
        <div class="field" id="field-jd_${id}_ape">
          <label>Apellidos <span class="req">*</span></label>
          <input type="text" id="jd_${id}_ape" maxlength="100"
                 oninput="actualizarJDMiem(${id},'APE_MIEM',this.value);limpiarError('field-jd_${id}_ape')" />
          <span class="error-msg">Campo requerido</span>
        </div>
      </div>
      <div class="grid-3">
        <div class="field" id="field-jd_${id}_tipdoc">
          <label>Tipo de documento <span class="req">*</span></label>
          <select id="jd_${id}_tipdoc"
                  onchange="onJDTipdocChange(${id},this.value);actualizarJDMiem(${id},'TIP_DOCU',this.value);limpiarError('field-jd_${id}_tipdoc')">
            ${td}
          </select>
          <input type="text" id="jd_${id}_tipdoc_otro" class="otro-inp" maxlength="100" style="display:none"
                 placeholder="Especifique el tipo de documento"
                 oninput="actualizarJDMiem(${id},'OTR_TPDOC',this.value)" />
          <span class="error-msg">Campo requerido</span>
        </div>
        <div class="field" id="field-jd_${id}_numdoc">
          <label>Número de documento <span class="req">*</span></label>
          <input type="text" id="jd_${id}_numdoc" maxlength="20" inputmode="numeric"
                 oninput="this.value=this.value.replace(/\D/g,'');actualizarJDMiem(${id},'NUM_DOCU',this.value);limpiarError('field-jd_${id}_numdoc')" />
          <span class="error-msg">Campo requerido</span>
        </div>
        <div class="field" id="field-jd_${id}_fec">
          <label>Fecha de expedición <span class="req">*</span></label>
          <input type="date" id="jd_${id}_fec"
                 onchange="actualizarJDMiem(${id},'FEC_EXPE',this.value);limpiarError('field-jd_${id}_fec')" />
          <span class="error-msg">Campo requerido</span>
        </div>
      </div>
      <div class="grid-4">
        <div class="field" id="field-jd_${id}_pais">
          <label>País <span class="req">*</span></label>
          <select id="jd_${id}_pais"
                  onchange="onJDPaisChange(${id},this.value);limpiarError('field-jd_${id}_pais')">
            ${pa}
          </select>
          <span class="error-msg">Campo requerido</span>
        </div>
        <div class="field" id="field-jd_${id}_pais_otro" style="display:none">
          <label>Especifique el país <span class="req">*</span></label>
          <input type="text" id="jd_${id}_pais_otro" maxlength="100" placeholder="Nombre del país"
                 oninput="actualizarJDMiem(${id},'OTR_PAIS',this.value)" />
        </div>
        <div class="field" id="field-jd_${id}_dept">
          <label>Departamento <span class="req">*</span></label>
          <select id="jd_${id}_dept" disabled
                  onchange="onJDDeptChange(${id},this.value);limpiarError('field-jd_${id}_dept')">
            <option value="">— Seleccione país primero —</option>
          </select>
          <span class="error-msg">Campo requerido</span>
        </div>
        <div class="field" id="field-jd_${id}_mpio">
          <label>Ciudad <span class="req">*</span></label>
          <select id="jd_${id}_mpio" disabled
                  onchange="actualizarJDMiem(${id},'COD_MPIO',this.value);limpiarError('field-jd_${id}_mpio')">
            <option value="">— Seleccione departamento primero —</option>
          </select>
          <span class="error-msg">Campo requerido</span>
        </div>
        <div class="field">
          <label>Dirección domicilio</label>
          <input type="text" id="jd_${id}_dir" maxlength="255"
                 oninput="actualizarJDMiem(${id},'DIR_MIEM',this.value)" />
        </div>
      </div>
      <div class="grid-3">
        <div class="field" id="field-jd_${id}_cel">
          <label>Celular <span class="req">*</span></label>
          <input type="tel" id="jd_${id}_cel" maxlength="20"
                 oninput="actualizarJDMiem(${id},'CEL_MIEM',this.value);limpiarError('field-jd_${id}_cel')" />
          <span class="error-msg">Campo requerido</span>
        </div>
        <div class="field">
          <label>Teléfono fijo</label>
          <input type="tel" id="jd_${id}_tel" maxlength="20"
                 oninput="actualizarJDMiem(${id},'TEL_MIEM',this.value)" />
        </div>
        <div class="field" id="field-jd_${id}_mail">
          <label>Correo electrónico <span class="req">*</span></label>
          <input type="email" id="jd_${id}_mail" maxlength="100"
                 oninput="actualizarJDMiem(${id},'MAIL_MIEM',this.value);limpiarError('field-jd_${id}_mail')" />
          <span class="error-msg">Email inválido o vacío</span>
        </div>
      </div>
    </div>`;
}

function _crearGrupoJDEl(m) {
  const el = document.createElement('div');
  el.className = 'grupo-item';
  el.id        = `jd_grupo_${m._id}`;
  el.innerHTML = _jdMiembroHTML(m);
  agregarOpcionOtroAlSelect(el.querySelector(`#jd_${m._id}_pais`));
  agregarOpcionOtroAlTipdoc(el.querySelector(`#jd_${m._id}_tipdoc`));
  return el;
}

function _hydrateJDFields(m, el) {
  const id  = m._id;
  const set = (sel, val) => { const f = el.querySelector(sel); if (f) f.value = val || ''; };
  set(`#jd_${id}_tipmiem`,  m.TIP_MIEM);
  set(`#jd_${id}_nom`,      m.NOM_MIEM);
  set(`#jd_${id}_ape`,      m.APE_MIEM);
  set(`#jd_${id}_tipdoc`,   m.TIP_DOCU);
  if (m.TIP_DOCU === 'OTR_TPDOC') {
    const inpOtro = el.querySelector(`#jd_${id}_tipdoc_otro`);
    if (inpOtro) { inpOtro.style.display = ''; inpOtro.value = m.OTR_TPDOC || ''; }
  }
  set(`#jd_${id}_numdoc`,   m.NUM_DOCU);
  set(`#jd_${id}_fec`,      m.FEC_EXPE);
  set(`#jd_${id}_pais`,     m.COD_PAIS);
  set(`#jd_${id}_dir`,      m.DIR_MIEM);
  set(`#jd_${id}_cel`,      m.CEL_MIEM);
  set(`#jd_${id}_tel`,      m.TEL_MIEM);
  set(`#jd_${id}_mail`,     m.MAIL_MIEM);
  if (m.COD_PAIS) {
    onJDPaisChange(id, m.COD_PAIS)
      .then(() => {
        if (m.COD_PAIS === 'OTRO' || String(m.COD_PAIS) === '52') {
          const inp = el.querySelector(`#jd_${id}_pais_otro`);
          if (inp) inp.value = m.OTR_PAIS || '';
          return Promise.resolve();
        }
        const deptEl = el.querySelector(`#jd_${id}_dept`);
        if (deptEl) deptEl.value = m.COD_DEPT || '';
        if (m.COD_DEPT && m.COD_DEPT !== 'NA') return onJDDeptChange(id, m.COD_DEPT);
      })
      .then(() => {
        const mpioEl = el.querySelector(`#jd_${id}_mpio`);
        if (mpioEl) mpioEl.value = m.COD_MPIO || '';
      })
      .catch(err => console.error('hydrate JD:', err));
  }
  actualizarTituloJD(id);
}

async function renderListaJD() {
  const wrap = document.getElementById('jd-lista-wrap');
  const list = document.getElementById('jd-grupos-list');
  list.innerHTML = '';

  if (!Array.isArray(formData.juntaDirectiva.miembros)) {
    formData.juntaDirectiva.miembros = [];
  }

  // Migrar formato antiguo {_id, Principal:{}, Suplente:{}} → plano
  formData.juntaDirectiva.miembros = formData.juntaDirectiva.miembros.map(m => {
    if (m.Principal || m.Suplente) {
      const roles = [];
      if (m.Principal && (m.Principal.NOM_MIEM || m.Principal.APE_MIEM)) {
        roles.push(Object.assign({ _id: m._id, TIP_REPR: 'P' }, m.Principal));
      }
      if (m.Suplente && (m.Suplente.NOM_MIEM || m.Suplente.APE_MIEM)) {
        roles.push(Object.assign({ _id: _jdId++ }, m.Suplente, { TIP_REPR: 'S' }));
      }
      return roles.length ? roles : null;
    }
    return m;
  }).flat().filter(Boolean);

  if (formData.juntaDirectiva.miembros.length === 0 && formData.juntaDirectiva.TIE_JUNTA === 'S') {
    formData.juntaDirectiva.miembros.push(_jdNuevo('P'));
  }
  _jdId = formData.juntaDirectiva.miembros.length === 0
    ? 0
    : Math.max(...formData.juntaDirectiva.miembros.map(m => m._id)) + 1;

  if (formData.juntaDirectiva.TIE_JUNTA === 'S') {
    wrap.style.display = 'flex';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      wrap.style.opacity = '1'; wrap.style.maxHeight = '99999px';
    }));
  } else {
    wrap.style.opacity = '0'; wrap.style.maxHeight = '0';
    setTimeout(() => { wrap.style.display = 'none'; }, 210);
  }

  for (const m of formData.juntaDirectiva.miembros) {
    const el = _crearGrupoJDEl(m);
    list.appendChild(el);
    _hydrateJDFields(m, el);
  }
  _jdSyncEliminar();
}

function agregarJD() {
  const nuevo = _jdNuevo('P');
  formData.juntaDirectiva.miembros.push(nuevo);
  document.querySelectorAll('#jd-grupos-list .grupo-body').forEach(b => b.classList.add('collapsed'));
  const list = document.getElementById('jd-grupos-list');
  const el   = _crearGrupoJDEl(nuevo);
  list.appendChild(el);
  _jdSyncEliminar();
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  guardarBorradorDebounced();
}

function eliminarJD(event, id) {
  event.stopPropagation();
  if (formData.juntaDirectiva.miembros.length <= 1) return;
  formData.juntaDirectiva.miembros.splice(_jdPos(id), 1);
  document.getElementById(`jd_grupo_${id}`).remove();
  _jdRenumerarTodos();
  _jdSyncEliminar();
  guardarBorradorDebounced();
}

function _jdSyncEliminar() {
  const sola = formData.juntaDirectiva.miembros.length <= 1;
  document.querySelectorAll('#jd-grupos-list .btn-eliminar-grupo').forEach(b => { b.disabled = sola; });
}

/* ── Cascadas geográficas ─────────────────────────────────────────────────── */
async function onJDPaisChange(id, codPais) {
  const m = _jdGet(id);
  if (!m) return;
  m.COD_PAIS = codPais ? String(codPais) : null;
  m.COD_DEPT = null;
  m.COD_MPIO = null;
  const selDept = document.getElementById(`jd_${id}_dept`);
  const selMpio = document.getElementById(`jd_${id}_mpio`);
  selMpio.innerHTML = '<option value="">— Seleccione departamento primero —</option>';
  selMpio.disabled  = true;
  limpiarError(`field-jd_${id}_dept`);
  limpiarError(`field-jd_${id}_mpio`);
  if (!codPais) { selDept.innerHTML = '<option value="">— Seleccione país primero —</option>'; selDept.disabled = true; return; }

  if (String(codPais) === 'OTRO' || String(codPais) === '52') {
    const fieldOtroJD = document.getElementById(`field-jd_${id}_pais_otro`);
    const fieldDeptJD = document.getElementById(`field-jd_${id}_dept`);
    const fieldMpioJD = document.getElementById(`field-jd_${id}_mpio`);
    if (fieldDeptJD) fieldDeptJD.style.display = 'none';
    if (fieldMpioJD) fieldMpioJD.style.display = 'none';
    if (fieldOtroJD) { fieldOtroJD.style.display = ''; fieldOtroJD.style.gridColumn = 'span 2'; }
    return;
  }
  const fieldOtroJDR = document.getElementById(`field-jd_${id}_pais_otro`);
  const fieldDeptJDR = document.getElementById(`field-jd_${id}_dept`);
  const fieldMpioJDR = document.getElementById(`field-jd_${id}_mpio`);
  if (fieldOtroJDR) { fieldOtroJDR.style.display = 'none'; fieldOtroJDR.style.gridColumn = ''; m.OTR_PAIS = null; const inp = document.getElementById(`jd_${id}_pais_otro`); if (inp) inp.value = ''; }
  if (fieldDeptJDR) fieldDeptJDR.style.display = '';
  if (fieldMpioJDR) fieldMpioJDR.style.display = '';

  if (String(codPais) === COD_COLOMBIA) {
    selDept.disabled = false;
    await cargarCatalogo('/api/catalogo/departamentos', `jd_${id}_dept`, 'COD_DEPT', 'NOM_DEPT', '— Seleccione departamento —', { cod_pais: codPais });
  } else {
    selDept.innerHTML = '<option value="NA">No aplica</option>';
    selDept.value = 'NA'; selDept.disabled = true;
    m.COD_DEPT = 'NA';
    selMpio.disabled = false;
    await cargarCatalogo('/api/catalogo/ciudades', `jd_${id}_mpio`, 'COD_MUNI', 'NOM_MUNI', '— Seleccione ciudad —', { cod_pais: codPais });
    selMpio.onchange = e => { m.COD_MPIO = e.target.value || null; limpiarError(`field-jd_${id}_mpio`); };
  }
}

async function onJDDeptChange(id, codDept) {
  const m = _jdGet(id);
  if (!m) return;
  m.COD_DEPT = codDept ? String(codDept) : null;
  m.COD_MPIO = null;
  const selMpio = document.getElementById(`jd_${id}_mpio`);
  const codPais = document.getElementById(`jd_${id}_pais`)?.value;
  selMpio.innerHTML = '<option value="">Cargando ciudades…</option>';
  selMpio.disabled  = true;
  if (!codDept || !codPais) return;
  await cargarCatalogo('/api/catalogo/ciudades', `jd_${id}_mpio`, 'COD_MUNI', 'NOM_MUNI', '— Seleccione ciudad —', { cod_dept: codDept, cod_pais: codPais });
  selMpio.disabled = false;
  selMpio.onchange = e => { m.COD_MPIO = e.target.value || null; limpiarError(`field-jd_${id}_mpio`); };
}

/* ── Validación ──────────────────────────────────────────────────────────── */
function _validarMiembroJD(m) {
  const id  = m._id;
  const req = [
    [`field-jd_${id}_tipmiem`, m.TIP_MIEM],
    [`field-jd_${id}_nom`,     m.NOM_MIEM],
    [`field-jd_${id}_ape`,     m.APE_MIEM],
    [`field-jd_${id}_tipdoc`,  m.TIP_DOCU],
    [`field-jd_${id}_numdoc`,  m.NUM_DOCU],
    [`field-jd_${id}_fec`,     m.FEC_EXPE],
    [`field-jd_${id}_pais`,    m.COD_PAIS],
    [`field-jd_${id}_cel`,     m.CEL_MIEM],
  ];
  let ok = true;
  req.forEach(([fid, v]) => { if (!v || !String(v).trim()) { mostrarError(fid); ok = false; } });
  if (m.COD_PAIS !== 'OTRO') {
    [
      [`field-jd_${id}_dept`, m.COD_DEPT],
      [`field-jd_${id}_mpio`, m.COD_MPIO],
    ].forEach(([fid, v]) => { if (!v || !String(v).trim()) { mostrarError(fid); ok = false; } });
  }
  if (!m.MAIL_MIEM || !esEmailValido(m.MAIL_MIEM)) { mostrarError(`field-jd_${id}_mail`); ok = false; }
  return ok;
}

function validarSeccionJD() {
  if (formData.juntaDirectiva.TIE_JUNTA !== 'S') return true;
  if (formData.juntaDirectiva.miembros.length === 0) {
    mostrarToast('Agregue al menos un miembro de junta directiva.', 'error'); return false;
  }
  let ok = true;
  for (const m of formData.juntaDirectiva.miembros) {
    if (!_validarMiembroJD(m)) {
      document.getElementById(`jd_body_${m._id}`)?.classList.remove('collapsed');
      ok = false;
    }
  }
  return ok;
}

function validarYContinuarJD() {
  if (!validarSeccionJD()) {
    document.getElementById('accordion-jd').classList.remove('collapsed');
    mostrarToast('Corrija los campos marcados en rojo.', 'error');
    document.querySelector('#accordion-jd .field.error')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  mostrarToast('Sección 6 completa.', 'success');
  document.getElementById('accordion-jd').classList.add('collapsed');
  const acc7 = document.getElementById('accordion-rf');
  acc7.classList.remove('collapsed');
  acc7.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function onJDTipdocChange(id, val) {
  const inp = document.getElementById(`jd_${id}_tipdoc_otro`);
  if (inp) inp.style.display = val === 'OTR_TPDOC' ? '' : 'none';
  if (val !== 'OTR_TPDOC') {
    if (inp) inp.value = '';
    const m = _jdGet(id);
    if (m) m.OTR_TPDOC = null;
  }
}

function limpiarSeccionJD() {
  formData.juntaDirectiva = { TIE_JUNTA: 'N', miembros: [] };
  _jdId = 0;
  const radioNo = document.querySelector('input[name="jd_tie_junta"][value="N"]');
  if (radioNo) radioNo.checked = true;
  const wrap = document.getElementById('jd-lista-wrap');
  wrap.style.transition = 'none'; wrap.style.opacity = '0';
  wrap.style.maxHeight  = '0';    wrap.style.display  = 'none';
  setTimeout(() => { wrap.style.transition = ''; }, 50);
  document.getElementById('jd-grupos-list').innerHTML = '';
  mostrarToast('Sección limpiada.', 'success');
}

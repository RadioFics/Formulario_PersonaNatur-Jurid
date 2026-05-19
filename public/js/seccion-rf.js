/**
 * seccion-rf.js — Sección 7: "Revisores fiscales"
 *
 * Patrón: grupos dinámicos con IDs estables (_id) que no cambian al borrar.
 * Cada grupo tiene bloque Principal (requerido) + Suplente (opcional) +
 * condicional de firma (REVI_FIRMA).
 *
 * API IDs: rf_{id}_{bloc}_{campo}   bloc = 'p' | 's'
 *          rf_{id}_firma_wrap / rf_{id}_firma_raz / rf_{id}_firma_tipdoc / rf_{id}_firma_numdoc
 * State:   formData.revisores.revisores[i].Principal / .Suplente
 *
 * Depende de: state.js, utils.js (incluye getOpcionesHTML)
 */
'use strict';

/* ── Counter de IDs estables ─────────────────────────────────────────────────── */
let _rfId = 0;

/* ── Fábrica de estado ──────────────────────────────────────────────────────── */
function _rfCampos() {
  return {
    NOM_REVI: '', APE_REVI: '', RAZ_REVI: '',
    TIP_DOCU: null, NUM_DOCU: '', FEC_EXPE: '',
    COD_PAIS: null, COD_DEPT: null, COD_MPIO: null,
    DIR_REVI: '', CEL_REVI: '', TEL_REVI: '', OBS_REVI: '', MAIL_REVI: '',
  };
}
function _rfNuevo() {
  return {
    _id: _rfId++,
    REVI_FIRMA: 'N', RAZ_FIRMA: '', TIP_DOCU_FIR: null, NUM_DOCU_FIR: '',
    Principal: _rfCampos(), Suplente: _rfCampos(),
  };
}
function _rfGet(id) { return formData.revisores.revisores.find(r => r._id === id); }
function _rfPos(id) { return formData.revisores.revisores.findIndex(r => r._id === id); }

/* ── Actualización de estado ─────────────────────────────────────────────────── */
function actualizarRFRev(id, SK, campo, valor) {
  const r = _rfGet(id);
  if (r) r[SK][campo] = valor === '' ? null : valor;
}
function actualizarRFGrupo(id, campo, valor) {
  const r = _rfGet(id);
  if (r) r[campo] = valor === '' ? null : valor;
}

/* ── Título dinámico del grupo ──────────────────────────────────────────────── */
function actualizarTituloRF(id) {
  const r = _rfGet(id);
  if (!r) return;
  const pos    = _rfPos(id) + 1;
  const nombre = [(r.Principal.NOM_REVI || '').trim(), (r.Principal.APE_REVI || '').trim()]
                   .filter(Boolean).join(' ');
  const el = document.getElementById(`rf_titulo_${id}`);
  if (el) el.textContent = `Revisor ${pos}${nombre ? ' — ' + nombre : ''}`;
}
function _rfRenumerarTodos() {
  formData.revisores.revisores.forEach(r => actualizarTituloRF(r._id));
}

/* ── Colapsar/expandir grupo interno ────────────────────────────────────────── */
function toggleGrupoRF(id) {
  const body = document.getElementById(`rf_body_${id}`);
  if (body) body.classList.toggle('collapsed');
}

/* ── Visibilidad de la lista (booleano de cabecera) ─────────────────────────── */
function onTieneRevisorChange(valor) {
  formData.revisores.TIE_REVIS = valor;
  const wrap = document.getElementById('rf-lista-wrap');
  if (valor === 'S') {
    wrap.style.display = 'flex';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      wrap.style.opacity = '1'; wrap.style.maxHeight = '99999px';
    }));
    if (formData.revisores.revisores.length === 0) agregarRF();
  } else {
    wrap.style.opacity = '0'; wrap.style.maxHeight = '0';
    setTimeout(() => {
      wrap.style.display = 'none';
      document.querySelectorAll('#accordion-rf .field.error').forEach(f => f.classList.remove('error'));
    }, 210);
  }
}

/* ── Condicional de firma (por grupo) ────────────────────────────────────────── */
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

/* ── Opciones desde caché ────────────────────────────────────────────────────── */
function _rfTdOpts() {
  return getOpcionesHTML('/api/catalogo/tipos-documento?todos=1', 'COD_TPDOC', 'NOM_TPDOC', '— Seleccione —');
}
function _rfPaOpts() {
  return getOpcionesHTML('/api/catalogo/paises', 'COD_PAIS', 'NOM_PAIS', '— Seleccione —');
}

/* ── HTML de un bloque (Principal o Suplente) ───────────────────────────────── */
function _rfBloque(id, bloc) {
  const SK  = bloc === 'p' ? 'Principal' : 'Suplente';
  const R   = bloc === 'p' ? ' <span class="req">*</span>' : '';
  const td  = _rfTdOpts();
  const pa  = _rfPaOpts();
  const lbl = bloc === 'p' ? 'Principal' : 'Suplente';
  const bdg = bloc === 'p'
    ? '<span class="rl-badge principal">P</span>'
    : '<span class="rl-badge suplente">S</span>';
  const opt = bloc === 's'
    ? '<span style="font-size:.72rem;font-weight:400;color:#9e9e9e;margin-left:4px">(opcional)</span>'
    : '';
  return `
    <div class="rl-bloque">
      <div class="rl-block-header">${bdg} ${lbl} ${opt}</div>
      <div class="grid-4">
        <div class="field" id="field-rf_${id}_${bloc}_nom">
          <label>Nombres${R}</label>
          <input type="text" id="rf_${id}_${bloc}_nom" maxlength="100" placeholder="Nombres completos"
                 oninput="actualizarRFRev(${id},'${SK}','NOM_REVI',this.value);actualizarTituloRF(${id});limpiarError('field-rf_${id}_${bloc}_nom')" />
          <span class="error-msg">Campo requerido</span>
        </div>
        <div class="field" id="field-rf_${id}_${bloc}_ape">
          <label>Apellidos${R}</label>
          <input type="text" id="rf_${id}_${bloc}_ape" maxlength="100" placeholder="Apellidos completos"
                 oninput="actualizarRFRev(${id},'${SK}','APE_REVI',this.value);limpiarError('field-rf_${id}_${bloc}_ape')" />
          <span class="error-msg">Campo requerido</span>
        </div>
        <div class="field">
          <label>Razón social</label>
          <input type="text" id="rf_${id}_${bloc}_raz" maxlength="255" placeholder="Si aplica"
                 oninput="actualizarRFRev(${id},'${SK}','RAZ_REVI',this.value)" />
        </div>
        <div class="field" id="field-rf_${id}_${bloc}_cel">
          <label>Celular${R}</label>
          <input type="tel" id="rf_${id}_${bloc}_cel" maxlength="20"
                 oninput="actualizarRFRev(${id},'${SK}','CEL_REVI',this.value);limpiarError('field-rf_${id}_${bloc}_cel')" />
          <span class="error-msg">Campo requerido</span>
        </div>
      </div>
      <div class="grid-4">
        <div class="field" id="field-rf_${id}_${bloc}_tipdoc">
          <label>Tipo doc.${R}</label>
          <select id="rf_${id}_${bloc}_tipdoc"
                  onchange="actualizarRFRev(${id},'${SK}','TIP_DOCU',this.value);limpiarError('field-rf_${id}_${bloc}_tipdoc')">
            ${td}
          </select>
          <span class="error-msg">Campo requerido</span>
        </div>
        <div class="field" id="field-rf_${id}_${bloc}_numdoc">
          <label>Número doc.${R}</label>
          <input type="text" id="rf_${id}_${bloc}_numdoc" maxlength="20" inputmode="numeric"
                 oninput="this.value=this.value.replace(/\\D/g,'');actualizarRFRev(${id},'${SK}','NUM_DOCU',this.value);limpiarError('field-rf_${id}_${bloc}_numdoc')" />
          <span class="error-msg">Campo requerido</span>
        </div>
        <div class="field" id="field-rf_${id}_${bloc}_fec">
          <label>Fecha expedición${R}</label>
          <input type="date" id="rf_${id}_${bloc}_fec"
                 onchange="actualizarRFRev(${id},'${SK}','FEC_EXPE',this.value);limpiarError('field-rf_${id}_${bloc}_fec')" />
          <span class="error-msg">Campo requerido</span>
        </div>
        <div class="field">
          <label>Teléfono fijo</label>
          <input type="tel" id="rf_${id}_${bloc}_tel" maxlength="20"
                 oninput="actualizarRFRev(${id},'${SK}','TEL_REVI',this.value)" />
        </div>
      </div>
      <div class="grid-4">
        <div class="field" id="field-rf_${id}_${bloc}_pais">
          <label>País${R}</label>
          <select id="rf_${id}_${bloc}_pais"
                  onchange="onRFPaisChange(${id},'${bloc}',this.value);limpiarError('field-rf_${id}_${bloc}_pais')">
            ${pa}
          </select>
          <span class="error-msg">Campo requerido</span>
        </div>
        <div class="field" id="field-rf_${id}_${bloc}_dept">
          <label>Departamento${R}</label>
          <select id="rf_${id}_${bloc}_dept" disabled
                  onchange="onRFDeptChange(${id},'${bloc}',this.value);limpiarError('field-rf_${id}_${bloc}_dept')">
            <option value="">— Seleccione país primero —</option>
          </select>
          <span class="error-msg">Campo requerido</span>
        </div>
        <div class="field" id="field-rf_${id}_${bloc}_mpio">
          <label>Ciudad${R}</label>
          <select id="rf_${id}_${bloc}_mpio" disabled
                  onchange="actualizarRFRev(${id},'${SK}','COD_MPIO',this.value);limpiarError('field-rf_${id}_${bloc}_mpio')">
            <option value="">— Seleccione departamento primero —</option>
          </select>
          <span class="error-msg">Campo requerido</span>
        </div>
        <div class="field">
          <label>Dirección</label>
          <input type="text" id="rf_${id}_${bloc}_dir" maxlength="255"
                 oninput="actualizarRFRev(${id},'${SK}','DIR_REVI',this.value)" />
        </div>
      </div>
      <div class="grid-4">
        <div class="field" id="field-rf_${id}_${bloc}_mail">
          <label>Correo electrónico${R}</label>
          <input type="email" id="rf_${id}_${bloc}_mail" maxlength="100"
                 oninput="actualizarRFRev(${id},'${SK}','MAIL_REVI',this.value);limpiarError('field-rf_${id}_${bloc}_mail')" />
          <span class="error-msg">Email inválido o vacío</span>
        </div>
        <div class="field col-full">
          <label>Observaciones</label>
          <textarea id="rf_${id}_${bloc}_obs" rows="2" maxlength="500"
                    placeholder="Observaciones adicionales (opcional)"
                    oninput="actualizarRFRev(${id},'${SK}','OBS_REVI',this.value)"></textarea>
        </div>
      </div>
    </div>`;
}

/* ── Crear elemento DOM de un grupo ──────────────────────────────────────────── */
function _crearGrupoRFEl(revisor) {
  const id  = revisor._id;
  const pos = _rfPos(id) + 1;
  const td  = _rfTdOpts();
  const el  = document.createElement('div');
  el.className = 'grupo-item';
  el.id        = `rf_grupo_${id}`;
  el.innerHTML = `
    <div class="grupo-header" onclick="toggleGrupoRF(${id})">
      <span class="grupo-titulo" id="rf_titulo_${id}">Revisor ${pos}</span>
      <button class="btn-eliminar-grupo" type="button" onclick="eliminarRF(event,${id})" title="Eliminar">✕</button>
    </div>
    <div class="grupo-body" id="rf_body_${id}">
      ${_rfBloque(id, 'p')}
      <hr class="rl-divider">
      ${_rfBloque(id, 's')}
      <hr class="rl-divider">
      <div class="field field-radio">
        <label>¿El revisor está designado por una firma auditora? <span class="req">*</span></label>
        <div class="radio-group">
          <label class="radio-option">
            <input type="radio" name="rf_firma_${id}" value="S"
                   onchange="onTieneFirmaChange(${id},'S')"> Sí
          </label>
          <label class="radio-option">
            <input type="radio" name="rf_firma_${id}" value="N" checked
                   onchange="onTieneFirmaChange(${id},'N')"> No
          </label>
        </div>
      </div>
      <div id="rf_${id}_firma_wrap" class="firma-wrap"
           style="display:none; opacity:0; max-height:0">
        <div class="grid-4">
          <div class="field col-full" id="field-rf_${id}_firma_raz">
            <label>Razón social de la firma <span class="req">*</span></label>
            <input type="text" id="rf_${id}_firma_raz" maxlength="255"
                   oninput="actualizarRFGrupo(${id},'RAZ_FIRMA',this.value);limpiarError('field-rf_${id}_firma_raz')" />
            <span class="error-msg">Campo requerido</span>
          </div>
          <div class="field" id="field-rf_${id}_firma_tipdoc">
            <label>Tipo doc. de la firma <span class="req">*</span></label>
            <select id="rf_${id}_firma_tipdoc"
                    onchange="actualizarRFGrupo(${id},'TIP_DOCU_FIR',this.value);limpiarError('field-rf_${id}_firma_tipdoc')">
              ${td}
            </select>
            <span class="error-msg">Campo requerido</span>
          </div>
          <div class="field" id="field-rf_${id}_firma_numdoc">
            <label>Número doc. de la firma <span class="req">*</span></label>
            <input type="text" id="rf_${id}_firma_numdoc" maxlength="20" inputmode="numeric"
                   oninput="this.value=this.value.replace(/\\D/g,'');actualizarRFGrupo(${id},'NUM_DOCU_FIR',this.value);limpiarError('field-rf_${id}_firma_numdoc')" />
            <span class="error-msg">Campo requerido</span>
          </div>
        </div>
      </div>
    </div>`;
  return el;
}

function _hydrateRFFields(revisor, el) {
  const id = revisor._id;
  const set = (selector, value) => {
    const field = el.querySelector(selector);
    if (field) field.value = value || '';
  };

  [['p', 'Principal'], ['s', 'Suplente']].forEach(([bloc, SK]) => {
    const data = revisor[SK];
    set(`#rf_${id}_${bloc}_nom`, data.NOM_REVI);
    set(`#rf_${id}_${bloc}_ape`, data.APE_REVI);
    set(`#rf_${id}_${bloc}_raz`, data.RAZ_REVI);
    set(`#rf_${id}_${bloc}_cel`, data.CEL_REVI);
    set(`#rf_${id}_${bloc}_tipdoc`, data.TIP_DOCU);
    set(`#rf_${id}_${bloc}_numdoc`, data.NUM_DOCU);
    set(`#rf_${id}_${bloc}_fec`, data.FEC_EXPE);
    set(`#rf_${id}_${bloc}_pais`, data.COD_PAIS);
    set(`#rf_${id}_${bloc}_dir`, data.DIR_REVI);
    set(`#rf_${id}_${bloc}_tel`, data.TEL_REVI);
    set(`#rf_${id}_${bloc}_mail`, data.MAIL_REVI);
    set(`#rf_${id}_${bloc}_obs`, data.OBS_REVI);

    if (data.COD_PAIS) {
      onRFPaisChange(id, bloc, data.COD_PAIS)
        .then(() => {
          const deptEl = el.querySelector(`#rf_${id}_${bloc}_dept`);
          if (deptEl) deptEl.value = data.COD_DEPT || '';
          if (data.COD_DEPT && data.COD_DEPT !== 'NA') {
            return onRFDeptChange(id, bloc, data.COD_DEPT);
          }
          return Promise.resolve();
        })
        .then(() => {
          const mpioEl = el.querySelector(`#rf_${id}_${bloc}_mpio`);
          if (mpioEl) mpioEl.value = data.COD_MPIO || '';
        })
        .catch(err => console.error('hydrate RF fields:', err));
    }
  });

  if (revisor.REVI_FIRMA === 'S') {
    const yes = el.querySelector(`input[name="rf_firma_${id}"][value="S"]`);
    if (yes) yes.checked = true;
    onTieneFirmaChange(id, 'S');
  }
  setTimeout(() => actualizarTituloRF(id), 0);
}

async function renderListaRF() {
  const wrap = document.getElementById('rf-lista-wrap');
  const list = document.getElementById('rf-grupos-list');
  list.innerHTML = '';

  if (!Array.isArray(formData.revisores.revisores)) {
    formData.revisores.revisores = [];
  }
  if (formData.revisores.revisores.length === 0 && formData.revisores.TIE_REVIS === 'S') {
    formData.revisores.revisores.push(_rfNuevo());
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

  for (const revisor of formData.revisores.revisores) {
    const el = _crearGrupoRFEl(revisor);
    list.appendChild(el);
    _hydrateRFFields(revisor, el);
  }
  _rfSyncEliminar();
}

function agregarRF() {
  const nuevo = _rfNuevo();
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
async function onRFPaisChange(id, bloc, codPais) {
  const r = _rfGet(id);
  if (!r) return;
  const SK = bloc === 'p' ? 'Principal' : 'Suplente';
  // Normaliza a string para mantener consistencia con DOM
  r[SK].COD_PAIS = codPais ? String(codPais) : null;
  r[SK].COD_DEPT = null;
  r[SK].COD_MPIO = null;

  const selDept = document.getElementById(`rf_${id}_${bloc}_dept`);
  const selMpio = document.getElementById(`rf_${id}_${bloc}_mpio`);
  selMpio.innerHTML = '<option value="">— Seleccione departamento primero —</option>';
  selMpio.disabled  = true;
  limpiarError(`field-rf_${id}_${bloc}_dept`);
  limpiarError(`field-rf_${id}_${bloc}_mpio`);

  if (!codPais) {
    selDept.innerHTML = '<option value="">— Seleccione país primero —</option>';
    selDept.disabled  = true; return;
  }
  if (String(codPais) === COD_COLOMBIA) {
    selDept.disabled = false;
    await cargarCatalogo('/api/catalogo/departamentos', `rf_${id}_${bloc}_dept`,
      'COD_DEPT', 'NOM_DEPT', '— Seleccione departamento —', { cod_pais: codPais });
  } else {
    selDept.innerHTML = '<option value="NA">No aplica</option>';
    selDept.value = 'NA'; selDept.disabled = true;
    r[SK].COD_DEPT = 'NA';
    selMpio.disabled = false;
    selMpio.innerHTML = '<option value="">Cargando ciudades…</option>';
    await cargarCatalogo('/api/catalogo/ciudades', `rf_${id}_${bloc}_mpio`,
      'COD_MUNI', 'NOM_MUNI', '— Seleccione ciudad —', { cod_pais: codPais });
    selMpio.onchange = e => {
      r[SK].COD_MPIO = e.target.value ? String(e.target.value) : null;
      limpiarError(`field-rf_${id}_${bloc}_mpio`);
    };
  }
}

async function onRFDeptChange(id, bloc, codDept) {
  const r = _rfGet(id);
  if (!r) return;
  const SK = bloc === 'p' ? 'Principal' : 'Suplente';
  // Normaliza a string para mantener consistencia con DOM
  r[SK].COD_DEPT = codDept ? String(codDept) : null;
  r[SK].COD_MPIO = null;

  const selMpio = document.getElementById(`rf_${id}_${bloc}_mpio`);
  const codPais = document.getElementById(`rf_${id}_${bloc}_pais`).value;
  selMpio.innerHTML = '<option value="">Cargando ciudades…</option>';
  selMpio.disabled  = true;
  if (!codDept || !codPais) return;
  await cargarCatalogo('/api/catalogo/ciudades', `rf_${id}_${bloc}_mpio`,
    'COD_MUNI', 'NOM_MUNI', '— Seleccione ciudad —', { cod_dept: codDept, cod_pais: codPais });
  selMpio.disabled = false;
  selMpio.onchange = e => {
    r[SK].COD_MPIO = e.target.value ? String(e.target.value) : null;
    limpiarError(`field-rf_${id}_${bloc}_mpio`);
  };
}

/* ── Validación ─────────────────────────────────────────────────────────────── */
function _validarBloqueRF(id, SK) {
  const r = _rfGet(id);
  if (!r) return true;
  const d    = r[SK];
  const bloc = SK === 'Principal' ? 'p' : 's';
  const req  = [
    [`field-rf_${id}_${bloc}_nom`,    d.NOM_REVI],
    [`field-rf_${id}_${bloc}_ape`,    d.APE_REVI],
    [`field-rf_${id}_${bloc}_cel`,    d.CEL_REVI],
    [`field-rf_${id}_${bloc}_tipdoc`, d.TIP_DOCU],
    [`field-rf_${id}_${bloc}_numdoc`, d.NUM_DOCU],
    [`field-rf_${id}_${bloc}_fec`,    d.FEC_EXPE],
    [`field-rf_${id}_${bloc}_pais`,   d.COD_PAIS],
    [`field-rf_${id}_${bloc}_dept`,   d.COD_DEPT],
    [`field-rf_${id}_${bloc}_mpio`,   d.COD_MPIO],
  ];
  if (SK === 'Suplente') {
    const tocado = req.some(([, v]) => v && String(v).trim())
                || (d.MAIL_REVI && String(d.MAIL_REVI).trim())
                || (d.RAZ_REVI  && String(d.RAZ_REVI).trim());
    if (!tocado) return true;
  }
  let ok = true;
  req.forEach(([fid, v]) => { if (!v || !String(v).trim()) { mostrarError(fid); ok = false; } });
  if (!d.MAIL_REVI || !esEmailValido(d.MAIL_REVI)) {
    mostrarError(`field-rf_${id}_${bloc}_mail`); ok = false;
  }
  return ok;
}

function _validarFirmaRF(id) {
  const r = _rfGet(id);
  if (!r || r.REVI_FIRMA !== 'S') return true;
  let ok = true;
  if (!r.RAZ_FIRMA || !String(r.RAZ_FIRMA).trim()) {
    mostrarError(`field-rf_${id}_firma_raz`); ok = false;
  }
  if (!r.TIP_DOCU_FIR) {
    mostrarError(`field-rf_${id}_firma_tipdoc`); ok = false;
  }
  if (!r.NUM_DOCU_FIR || !String(r.NUM_DOCU_FIR).trim()) {
    mostrarError(`field-rf_${id}_firma_numdoc`); ok = false;
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
    const okP = _validarBloqueRF(r._id, 'Principal');
    const okS = _validarBloqueRF(r._id, 'Suplente');
    const okF = _validarFirmaRF(r._id);
    if (!okP || !okS || !okF) {
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
  console.log('✅ formData.revisores:', JSON.stringify(formData.revisores, null, 2));
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

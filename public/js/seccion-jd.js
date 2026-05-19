/**
 * seccion-jd.js — Sección 6: "Junta directiva / Consejo de administración"
 *
 * Patrón: grupos dinámicos con IDs estables (_id) que no cambian al borrar.
 * Cada grupo tiene bloque Principal (requerido) + Suplente (opcional).
 *
 * API IDs: jd_{id}_{bloc}_{campo}   bloc = 'p' | 's'
 * State:   formData.juntaDirectiva.miembros[i].Principal / .Suplente
 *
 * Depende de: state.js, utils.js (incluye getOpcionesHTML)
 */
'use strict';

/* ── Counter de IDs estables ─────────────────────────────────────────────────── */
let _jdId = 0;

/* ── Fábrica de estado ──────────────────────────────────────────────────────── */
function _jdCampos() {
  return {
    TIP_MIEM: '', NOM_MIEM: '', APE_MIEM: '', RAZ_MIEM: '',
    TIP_DOCU: null, NUM_DOCU: '', FEC_EXPE: '',
    COD_PAIS: null, COD_DEPT: null, COD_MPIO: null,
    DIR_MIEM: '', TEL_MIEM: '', MAIL_MIEM: '',
  };
}
function _jdNuevo() {
  return { _id: _jdId++, Principal: _jdCampos(), Suplente: _jdCampos() };
}
function _jdGet(id)  { return formData.juntaDirectiva.miembros.find(m => m._id === id); }
function _jdPos(id)  { return formData.juntaDirectiva.miembros.findIndex(m => m._id === id); }

/* ── Actualización de estado ─────────────────────────────────────────────────── */
function actualizarJDMiem(id, SK, campo, valor) {
  const m = _jdGet(id);
  if (m) m[SK][campo] = valor === '' ? null : valor;
}

/* ── Título dinámico del grupo ──────────────────────────────────────────────── */
function actualizarTituloJD(id) {
  const m = _jdGet(id);
  if (!m) return;
  const pos    = _jdPos(id) + 1;
  const nombre = [(m.Principal.NOM_MIEM || '').trim(), (m.Principal.APE_MIEM || '').trim()]
                   .filter(Boolean).join(' ');
  const el = document.getElementById(`jd_titulo_${id}`);
  if (el) el.textContent = `Miembro ${pos}${nombre ? ' — ' + nombre : ''}`;
}
function _jdRenumerarTodos() {
  formData.juntaDirectiva.miembros.forEach(m => actualizarTituloJD(m._id));
}

/* ── Colapsar/expandir grupo interno ────────────────────────────────────────── */
function toggleGrupoJD(id) {
  const body = document.getElementById(`jd_body_${id}`);
  if (body) body.classList.toggle('collapsed');
}

/* ── Visibilidad de la lista (booleano de cabecera) ─────────────────────────── */
function onTieneJuntaChange(valor) {
  formData.juntaDirectiva.TIE_JUNTA = valor;
  const wrap = document.getElementById('jd-lista-wrap');
  if (valor === 'S') {
    wrap.style.display = 'flex';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      wrap.style.opacity = '1'; wrap.style.maxHeight = '99999px';
    }));
    if (formData.juntaDirectiva.miembros.length === 0) agregarJD();
  } else {
    wrap.style.opacity = '0'; wrap.style.maxHeight = '0';
    setTimeout(() => {
      wrap.style.display = 'none';
      document.querySelectorAll('#accordion-jd .field.error').forEach(f => f.classList.remove('error'));
    }, 210);
  }
}

/* ── Opciones desde caché ────────────────────────────────────────────────────── */
function _jdTdOpts() { return getOpcionesHTML('/api/catalogo/tipos-documento?todos=1','COD_TPDOC','NOM_TPDOC','— Seleccione —'); }
function _jdPaOpts() { return getOpcionesHTML('/api/catalogo/paises','COD_PAIS','NOM_PAIS','— Seleccione —'); }

/* ── HTML de un bloque (Principal o Suplente) ───────────────────────────────── */
function _jdBloque(id, bloc) {
  const SK   = bloc === 'p' ? 'Principal' : 'Suplente';
  const R    = bloc === 'p' ? ' <span class="req">*</span>' : '';
  const td   = _jdTdOpts();
  const pa   = _jdPaOpts();
  const lbl  = bloc === 'p' ? 'Principal' : 'Suplente';
  const bdg  = bloc === 'p' ? '<span class="rl-badge principal">P</span>' : '<span class="rl-badge suplente">S</span>';
  const opt  = bloc === 's' ? '<span style="font-size:.72rem;font-weight:400;color:#9e9e9e;margin-left:4px">(opcional)</span>' : '';
  return `
    <div class="rl-bloque">
      <div class="rl-block-header">${bdg} ${lbl} ${opt}</div>
      <div class="grid-4">
        <div class="field" id="field-jd_${id}_${bloc}_tipmiem">
          <label>Tipo de miembro${R}</label>
          <input type="text" id="jd_${id}_${bloc}_tipmiem" maxlength="100" placeholder="Ej: Titular, Suplente de consejo…"
                 oninput="actualizarJDMiem(${id},'${SK}','TIP_MIEM',this.value);limpiarError('field-jd_${id}_${bloc}_tipmiem')" />
          <span class="error-msg">Campo requerido</span>
        </div>
        <div class="field" id="field-jd_${id}_${bloc}_nom">
          <label>Nombres${R}</label>
          <input type="text" id="jd_${id}_${bloc}_nom" maxlength="100" placeholder="Nombres completos"
                 oninput="actualizarJDMiem(${id},'${SK}','NOM_MIEM',this.value);actualizarTituloJD(${id});limpiarError('field-jd_${id}_${bloc}_nom')" />
          <span class="error-msg">Campo requerido</span>
        </div>
        <div class="field" id="field-jd_${id}_${bloc}_ape">
          <label>Apellidos${R}</label>
          <input type="text" id="jd_${id}_${bloc}_ape" maxlength="100" placeholder="Apellidos completos"
                 oninput="actualizarJDMiem(${id},'${SK}','APE_MIEM',this.value);limpiarError('field-jd_${id}_${bloc}_ape')" />
          <span class="error-msg">Campo requerido</span>
        </div>
        <div class="field">
          <label>Razón social</label>
          <input type="text" id="jd_${id}_${bloc}_raz" maxlength="255" placeholder="Si aplica"
                 oninput="actualizarJDMiem(${id},'${SK}','RAZ_MIEM',this.value)" />
        </div>
      </div>
      <div class="grid-4">
        <div class="field" id="field-jd_${id}_${bloc}_tipdoc">
          <label>Tipo doc.${R}</label>
          <select id="jd_${id}_${bloc}_tipdoc"
                  onchange="actualizarJDMiem(${id},'${SK}','TIP_DOCU',this.value);limpiarError('field-jd_${id}_${bloc}_tipdoc')">
            ${td}
          </select>
          <span class="error-msg">Campo requerido</span>
        </div>
        <div class="field" id="field-jd_${id}_${bloc}_numdoc">
          <label>Número doc.${R}</label>
          <input type="text" id="jd_${id}_${bloc}_numdoc" maxlength="20" inputmode="numeric"
                 oninput="this.value=this.value.replace(/\\D/g,'');actualizarJDMiem(${id},'${SK}','NUM_DOCU',this.value);limpiarError('field-jd_${id}_${bloc}_numdoc')" />
          <span class="error-msg">Campo requerido</span>
        </div>
        <div class="field" id="field-jd_${id}_${bloc}_fec">
          <label>Fecha expedición${R}</label>
          <input type="date" id="jd_${id}_${bloc}_fec"
                 onchange="actualizarJDMiem(${id},'${SK}','FEC_EXPE',this.value);limpiarError('field-jd_${id}_${bloc}_fec')" />
          <span class="error-msg">Campo requerido</span>
        </div>
      </div>
      <div class="grid-4">
        <div class="field" id="field-jd_${id}_${bloc}_pais">
          <label>País${R}</label>
          <select id="jd_${id}_${bloc}_pais"
                  onchange="onJDPaisChange(${id},'${bloc}',this.value);limpiarError('field-jd_${id}_${bloc}_pais')">
            ${pa}
          </select>
          <span class="error-msg">Campo requerido</span>
        </div>
        <div class="field" id="field-jd_${id}_${bloc}_dept">
          <label>Departamento${R}</label>
          <select id="jd_${id}_${bloc}_dept" disabled
                  onchange="onJDDeptChange(${id},'${bloc}',this.value);limpiarError('field-jd_${id}_${bloc}_dept')">
            <option value="">— Seleccione país primero —</option>
          </select>
          <span class="error-msg">Campo requerido</span>
        </div>
        <div class="field" id="field-jd_${id}_${bloc}_mpio">
          <label>Ciudad${R}</label>
          <select id="jd_${id}_${bloc}_mpio" disabled
                  onchange="actualizarJDMiem(${id},'${SK}','COD_MPIO',this.value);limpiarError('field-jd_${id}_${bloc}_mpio')">
            <option value="">— Seleccione departamento primero —</option>
          </select>
          <span class="error-msg">Campo requerido</span>
        </div>
        <div class="field">
          <label>Dirección</label>
          <input type="text" id="jd_${id}_${bloc}_dir" maxlength="255"
                 oninput="actualizarJDMiem(${id},'${SK}','DIR_MIEM',this.value)" />
        </div>
      </div>
      <div class="grid-4">
        <div class="field" id="field-jd_${id}_${bloc}_tel">
          <label>Teléfono${R}</label>
          <input type="tel" id="jd_${id}_${bloc}_tel" maxlength="20"
                 oninput="actualizarJDMiem(${id},'${SK}','TEL_MIEM',this.value);limpiarError('field-jd_${id}_${bloc}_tel')" />
          <span class="error-msg">Campo requerido</span>
        </div>
        <div class="field" id="field-jd_${id}_${bloc}_mail">
          <label>Correo electrónico${R}</label>
          <input type="email" id="jd_${id}_${bloc}_mail" maxlength="100"
                 oninput="actualizarJDMiem(${id},'${SK}','MAIL_MIEM',this.value);limpiarError('field-jd_${id}_${bloc}_mail')" />
          <span class="error-msg">Email inválido o vacío</span>
        </div>
      </div>
    </div>`;
}

/* ── Crear elemento DOM de un grupo ──────────────────────────────────────────── */
function _crearGrupoJDEl(miembro) {
  const id  = miembro._id;
  const pos = _jdPos(id) + 1;
  const el  = document.createElement('div');
  el.className = 'grupo-item';
  el.id        = `jd_grupo_${id}`;
  el.innerHTML = `
    <div class="grupo-header" onclick="toggleGrupoJD(${id})">
      <span class="grupo-titulo" id="jd_titulo_${id}">Miembro ${pos}</span>
      <button class="btn-eliminar-grupo" type="button" onclick="eliminarJD(event,${id})" title="Eliminar">✕</button>
    </div>
    <div class="grupo-body" id="jd_body_${id}">
      ${_jdBloque(id, 'p')}
      <hr class="rl-divider">
      ${_jdBloque(id, 's')}
    </div>`;
  return el;
}

function _hydrateJDFields(miembro, el) {
  const id = miembro._id;
  const set = (selector, value) => {
    const field = el.querySelector(selector);
    if (field) field.value = value || '';
  };

  [['p', 'Principal'], ['s', 'Suplente']].forEach(([bloc, SK]) => {
    const data = miembro[SK];
    set(`#jd_${id}_${bloc}_tipmiem`, data.TIP_MIEM);
    set(`#jd_${id}_${bloc}_nom`, data.NOM_MIEM);
    set(`#jd_${id}_${bloc}_ape`, data.APE_MIEM);
    set(`#jd_${id}_${bloc}_raz`, data.RAZ_MIEM);
    set(`#jd_${id}_${bloc}_tipdoc`, data.TIP_DOCU);
    set(`#jd_${id}_${bloc}_numdoc`, data.NUM_DOCU);
    set(`#jd_${id}_${bloc}_fec`, data.FEC_EXPE);
    set(`#jd_${id}_${bloc}_pais`, data.COD_PAIS);
    set(`#jd_${id}_${bloc}_dir`, data.DIR_MIEM);
    set(`#jd_${id}_${bloc}_tel`, data.TEL_MIEM);
    set(`#jd_${id}_${bloc}_mail`, data.MAIL_MIEM);

    if (data.COD_PAIS) {
      onJDPaisChange(id, bloc, data.COD_PAIS)
        .then(() => {
          const deptEl = el.querySelector(`#jd_${id}_${bloc}_dept`);
          if (deptEl) deptEl.value = data.COD_DEPT || '';
          if (data.COD_DEPT && data.COD_DEPT !== 'NA') {
            return onJDDeptChange(id, bloc, data.COD_DEPT);
          }
          return Promise.resolve();
        })
        .then(() => {
          const mpioEl = el.querySelector(`#jd_${id}_${bloc}_mpio`);
          if (mpioEl) mpioEl.value = data.COD_MPIO || '';
        })
        .catch(err => console.error('hydrate JD fields:', err));
    }
  });
  actualizarTituloJD(id);
}

async function renderListaJD() {
  const wrap = document.getElementById('jd-lista-wrap');
  const list = document.getElementById('jd-grupos-list');
  list.innerHTML = '';

  if (!Array.isArray(formData.juntaDirectiva.miembros)) {
    formData.juntaDirectiva.miembros = [];
  }
  if (formData.juntaDirectiva.miembros.length === 0 && formData.juntaDirectiva.TIE_JUNTA === 'S') {
    formData.juntaDirectiva.miembros.push(_jdNuevo());
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

  for (const miembro of formData.juntaDirectiva.miembros) {
    const el = _crearGrupoJDEl(miembro);
    list.appendChild(el);
    _hydrateJDFields(miembro, el);
  }
  _jdSyncEliminar();
}

function agregarJD() {
  const nuevo = _jdNuevo();
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

/* ── Cascadas geográficas ────────────────────────────────────────────────────── */
async function onJDPaisChange(id, bloc, codPais) {
  const m = _jdGet(id);
  if (!m) return;
  const SK = bloc === 'p' ? 'Principal' : 'Suplente';
  // Normaliza a string para mantener consistencia con DOM
  m[SK].COD_PAIS = codPais ? String(codPais) : null;
  m[SK].COD_DEPT = null;
  m[SK].COD_MPIO = null;

  const selDept = document.getElementById(`jd_${id}_${bloc}_dept`);
  const selMpio = document.getElementById(`jd_${id}_${bloc}_mpio`);
  selMpio.innerHTML = '<option value="">— Seleccione departamento primero —</option>';
  selMpio.disabled  = true;
  limpiarError(`field-jd_${id}_${bloc}_dept`);
  limpiarError(`field-jd_${id}_${bloc}_mpio`);

  if (!codPais) {
    selDept.innerHTML = '<option value="">— Seleccione país primero —</option>';
    selDept.disabled  = true; return;
  }
  if (String(codPais) === COD_COLOMBIA) {
    selDept.disabled = false;
    await cargarCatalogo('/api/catalogo/departamentos', `jd_${id}_${bloc}_dept`,
      'COD_DEPT', 'NOM_DEPT', '— Seleccione departamento —', { cod_pais: codPais });
  } else {
    selDept.innerHTML = '<option value="NA">No aplica</option>';
    selDept.value = 'NA'; selDept.disabled = true;
    m[SK].COD_DEPT = 'NA';
    selMpio.disabled = false;
    selMpio.innerHTML = '<option value="">Cargando ciudades…</option>';
    await cargarCatalogo('/api/catalogo/ciudades', `jd_${id}_${bloc}_mpio`,
      'COD_MUNI', 'NOM_MUNI', '— Seleccione ciudad —', { cod_pais: codPais });
    selMpio.onchange = e => { m[SK].COD_MPIO = e.target.value ? String(e.target.value) : null; limpiarError(`field-jd_${id}_${bloc}_mpio`); };
  }
}

async function onJDDeptChange(id, bloc, codDept) {
  const m = _jdGet(id);
  if (!m) return;
  const SK = bloc === 'p' ? 'Principal' : 'Suplente';
  // Normaliza a string para mantener consistencia con DOM
  m[SK].COD_DEPT = codDept ? String(codDept) : null;
  m[SK].COD_MPIO = null;

  const selMpio = document.getElementById(`jd_${id}_${bloc}_mpio`);
  const codPais = document.getElementById(`jd_${id}_${bloc}_pais`).value;
  selMpio.innerHTML = '<option value="">Cargando ciudades…</option>';
  selMpio.disabled  = true;
  if (!codDept || !codPais) return;
  await cargarCatalogo('/api/catalogo/ciudades', `jd_${id}_${bloc}_mpio`,
    'COD_MUNI', 'NOM_MUNI', '— Seleccione ciudad —', { cod_dept: codDept, cod_pais: codPais });
  selMpio.disabled = false;
  selMpio.onchange = e => { m[SK].COD_MPIO = e.target.value ? String(e.target.value) : null; limpiarError(`field-jd_${id}_${bloc}_mpio`); };
}

/* ── Validación ─────────────────────────────────────────────────────────────── */
function _validarBloqueJD(id, SK) {
  const m = _jdGet(id);
  if (!m) return true;
  const d    = m[SK];
  const bloc = SK === 'Principal' ? 'p' : 's';
  const req  = [
    [`field-jd_${id}_${bloc}_tipmiem`, d.TIP_MIEM],
    [`field-jd_${id}_${bloc}_nom`,     d.NOM_MIEM],
    [`field-jd_${id}_${bloc}_ape`,     d.APE_MIEM],
    [`field-jd_${id}_${bloc}_tipdoc`,  d.TIP_DOCU],
    [`field-jd_${id}_${bloc}_numdoc`,  d.NUM_DOCU],
    [`field-jd_${id}_${bloc}_fec`,     d.FEC_EXPE],
    [`field-jd_${id}_${bloc}_pais`,    d.COD_PAIS],
    [`field-jd_${id}_${bloc}_dept`,    d.COD_DEPT],
    [`field-jd_${id}_${bloc}_mpio`,    d.COD_MPIO],
    [`field-jd_${id}_${bloc}_tel`,     d.TEL_MIEM],
  ];
  if (SK === 'Suplente') {
    const tocado = req.some(([, v]) => v && String(v).trim())
                || (d.MAIL_MIEM && String(d.MAIL_MIEM).trim());
    if (!tocado) return true;
  }
  let ok = true;
  req.forEach(([fid, v]) => { if (!v || !String(v).trim()) { mostrarError(fid); ok = false; } });
  if (!d.MAIL_MIEM || !esEmailValido(d.MAIL_MIEM)) { mostrarError(`field-jd_${id}_${bloc}_mail`); ok = false; }
  return ok;
}

function validarSeccionJD() {
  if (formData.juntaDirectiva.TIE_JUNTA !== 'S') return true;
  if (formData.juntaDirectiva.miembros.length === 0) {
    mostrarToast('Agregue al menos un miembro de junta directiva.', 'error'); return false;
  }
  let ok = true;
  for (const m of formData.juntaDirectiva.miembros) {
    const okP = _validarBloqueJD(m._id, 'Principal');
    const okS = _validarBloqueJD(m._id, 'Suplente');
    if (!okP || !okS) { document.getElementById(`jd_body_${m._id}`).classList.remove('collapsed'); ok = false; }
  }
  return ok;
}

/* ── Acciones de botones ────────────────────────────────────────────────────── */
function validarYContinuarJD() {
  if (!validarSeccionJD()) {
    document.getElementById('accordion-jd').classList.remove('collapsed');
    mostrarToast('Corrija los campos marcados en rojo.', 'error');
    const primerError = document.querySelector('#accordion-jd .field.error');
    if (primerError) primerError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  mostrarToast('Sección 6 completa. Continúe con la siguiente sección.', 'success');
  document.getElementById('accordion-jd').classList.add('collapsed');
  const acc7 = document.getElementById('accordion-rf');
  acc7.classList.remove('collapsed');
  acc7.scrollIntoView({ behavior: 'smooth', block: 'start' });
  console.log('✅ formData.juntaDirectiva:', JSON.stringify(formData.juntaDirectiva, null, 2));
}

function limpiarSeccionJD() {
  formData.juntaDirectiva = { TIE_JUNTA: 'N', miembros: [] };
  _jdId = 0;
  const radioNo = document.querySelector('input[name="jd_tie_junta"][value="N"]');
  if (radioNo) radioNo.checked = true;
  const wrap = document.getElementById('jd-lista-wrap');
  wrap.style.transition = 'none'; wrap.style.opacity = '0';
  wrap.style.maxHeight  = '0';   wrap.style.display  = 'none';
  setTimeout(() => { wrap.style.transition = ''; }, 50);
  document.getElementById('jd-grupos-list').innerHTML = '';
  mostrarToast('Sección limpiada.', 'success');
}

/**
 * seccion-bf.js — Sección 12: "Beneficiarios Finales"
 *
 * Sigue exactamente el patrón de seccion-ac.js.
 * Un registro por beneficiario final (TIP_BENE = 'P' siempre).
 * Sin porcentaje ni suplente integrado: cada beneficiario es un elemento
 * independiente en formData.beneficiarios[].
 *
 * Tabla BD: GN_JURID_BF
 * API IDs:  bf_{id}_{campo}
 * State:    formData.beneficiarios[]
 *
 * Depende de: state.js, utils.js (incluye getOpcionesHTML, cargarCatalogo)
 */
'use strict';

/* ── Counter de IDs estables ─────────────────────────────────────────────────── */
let _bfId = 0;

/* ── Fábrica de estado ──────────────────────────────────────────────────────── */
function _bfCampos() {
  return {
    TIP_BENE: 'P',
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
  const pos    = _bfPos(id) + 1;
  const partes = [(b.NOM_BENE || '').trim(), (b.APE_BENE || '').trim(),
                  (b.RAZ_BENE || '').trim()].filter(Boolean);
  const nombre = partes.join(' / ').slice(0, 45);
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

/* ── Opciones desde caché ────────────────────────────────────────────────────── */
function _bfTdOpts() {
  return getOpcionesHTML('/api/catalogo/tipos-documento?todos=1', 'COD_TPDOC', 'NOM_TPDOC', '— Seleccione —');
}
function _bfPaOpts() {
  return getOpcionesHTML('/api/catalogo/paises', 'COD_PAIS', 'NOM_PAIS', '— Seleccione —');
}

/* ── Crear elemento DOM de un grupo ──────────────────────────────────────────── */
function _crearGrupoBFEl(beneficiario) {
  const id  = beneficiario._id;
  const pos = _bfPos(id) + 1;
  const td  = _bfTdOpts();
  const pa  = _bfPaOpts();
  const el  = document.createElement('div');
  el.className = 'grupo-item';
  el.id        = `bf_grupo_${id}`;
  el.innerHTML = `
    <div class="grupo-header" onclick="toggleGrupoBF(${id})">
      <span class="grupo-titulo" id="bf_titulo_${id}">Beneficiario ${pos}</span>
      <button class="btn-eliminar-grupo" type="button"
              onclick="eliminarBF(event,${id})" title="Eliminar">&#x2715;</button>
    </div>
    <div class="grupo-body" id="bf_body_${id}">

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
        <div class="field">
          <label>Razón social</label>
          <input type="text" id="bf_${id}_raz" maxlength="255" placeholder="Si aplica (persona jurídica)"
                 oninput="actualizarBF(${id},'RAZ_BENE',this.value);actualizarTituloBF(${id})" />
        </div>
        <div class="field" id="field-bf_${id}_tipdoc">
          <label>Tipo de doc. <span class="req">*</span></label>
          <select id="bf_${id}_tipdoc"
                  onchange="actualizarBF(${id},'TIP_DOCU',this.value);limpiarError('field-bf_${id}_tipdoc')">
            ${td}
          </select>
          <span class="error-msg">Campo requerido</span>
        </div>
      </div>

      <div class="grid-4">
        <div class="field" id="field-bf_${id}_numdoc">
          <label>N&#xFA;mero de doc. <span class="req">*</span></label>
          <input type="text" id="bf_${id}_numdoc" maxlength="20" inputmode="numeric"
                 oninput="this.value=this.value.replace(/\\D/g,'');actualizarBF(${id},'NUM_DOCU',this.value);limpiarError('field-bf_${id}_numdoc')" />
          <span class="error-msg">Campo requerido</span>
        </div>
        <div class="field" id="field-bf_${id}_fec">
          <label>Fecha de expedici&#xF3;n <span class="req">*</span></label>
          <input type="date" id="bf_${id}_fec"
                 onchange="actualizarBF(${id},'FEC_EXPE',this.value);limpiarError('field-bf_${id}_fec')" />
          <span class="error-msg">Campo requerido</span>
        </div>
        <div class="field">
          <label>Tel&#xE9;fono / Celular</label>
          <input type="tel" id="bf_${id}_tel" maxlength="20"
                 oninput="actualizarBF(${id},'TEL_BENE',this.value)" />
        </div>
        <div class="field" id="field-bf_${id}_mail">
          <label>Correo electr&#xF3;nico</label>
          <input type="email" id="bf_${id}_mail" maxlength="100"
                 oninput="actualizarBF(${id},'MAIL_BENE',this.value);limpiarError('field-bf_${id}_mail')" />
          <span class="error-msg">Email inv&#xE1;lido</span>
        </div>
      </div>

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

    </div>`;
  return el;
}

/* ── Hidratar campos desde estado (p.ej. borrador) ──────────────────────────── */
function _hydrateBFFields(beneficiario, el) {
  const id = beneficiario._id;
  const set = (selector, value) => {
    const field = el.querySelector(selector);
    if (field) field.value = value || '';
  };

  set(`#bf_${id}_nom`,    beneficiario.NOM_BENE);
  set(`#bf_${id}_ape`,    beneficiario.APE_BENE);
  set(`#bf_${id}_raz`,    beneficiario.RAZ_BENE);
  set(`#bf_${id}_tipdoc`, beneficiario.TIP_DOCU);
  set(`#bf_${id}_numdoc`, beneficiario.NUM_DOCU);
  set(`#bf_${id}_fec`,    beneficiario.FEC_EXPE);
  set(`#bf_${id}_tel`,    beneficiario.TEL_BENE);
  set(`#bf_${id}_mail`,   beneficiario.MAIL_BENE);
  set(`#bf_${id}_dir`,    beneficiario.DIR_BENE);

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
/**
 * Inicializa la lista de beneficiarios con un registro vacío.
 * Se llama desde app.js tras cargar los catálogos en cache.
 */
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
  // Colapsar grupos existentes antes de agregar el nuevo
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
  const b = _bfGet(id);
  if (!b) return true;
  const req = [
    [`field-bf_${id}_nom`,    b.NOM_BENE],
    [`field-bf_${id}_ape`,    b.APE_BENE],
    [`field-bf_${id}_tipdoc`, b.TIP_DOCU],
    [`field-bf_${id}_numdoc`, b.NUM_DOCU],
    [`field-bf_${id}_fec`,    b.FEC_EXPE],
    [`field-bf_${id}_pais`,   b.COD_PAIS],
    [`field-bf_${id}_dept`,   b.COD_DEPT],
    [`field-bf_${id}_mpio`,   b.COD_MPIO],
  ];
  let ok = true;
  req.forEach(([fid, v]) => {
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

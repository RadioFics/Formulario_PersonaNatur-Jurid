/**
 * seccion-ac.js — Sección 8: "Composición accionaria"
 *
 * Diferencias respecto a JD/RF:
 *  · Sin bloque Suplente — un registro por accionista.
 *  · Sin booleano de cabecera — la lista es siempre visible.
 *  · Campo PCT_PART (decimal): validación de suma = 100 % en tiempo real.
 *  · renderListaAC() inicializa la lista con un accionista vacío al arrancar.
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
    NOM_ACCI: '', APE_ACCI: '', RAZ_ACCI: '',
    TIP_DOCU: null, NUM_DOCU: '', FEC_EXPE: '',
    COD_PAIS: null, COD_DEPT: null, COD_MPIO: null,
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

/**
 * Actualiza PCT_PART y recalcula el indicador de suma.
 */
function actualizarACPCT(id, valor) {
  const a = _acGet(id);
  if (a) a.PCT_PART = valor === '' ? null : valor;
  _acActualizarIndicador();
}

/* ── Título dinámico del grupo ──────────────────────────────────────────────── */
function actualizarTituloAC(id) {
  const a = _acGet(id);
  if (!a) return;
  const pos    = _acPos(id) + 1;
  const partes = [(a.NOM_ACCI || '').trim(), (a.APE_ACCI || '').trim(),
                  (a.RAZ_ACCI || '').trim()].filter(Boolean);
  const nombre = partes.join(' / ').slice(0, 45);
  const el = document.getElementById(`ac_titulo_${id}`);
  if (el) el.textContent = `Accionista ${pos}${nombre ? ' — ' + nombre : ''}`;
}
function _acRenumerarTodos() {
  formData.accionistas.forEach(a => actualizarTituloAC(a._id));
}

/* ── Colapsar/expandir grupo interno ────────────────────────────────────────── */
function toggleGrupoAC(id) {
  const body = document.getElementById(`ac_body_${id}`);
  if (body) body.classList.toggle('collapsed');
}

/* ── Indicador de suma de porcentajes ───────────────────────────────────────── */
function _acActualizarIndicador() {
  const ind = document.getElementById('ac-pct-indicador');
  if (!ind) return;

  if (formData.accionistas.length === 0) {
    ind.textContent = 'Sin accionistas registrados.';
    ind.className   = 'pct-indicador pct-neutro';
    return;
  }

  const vals  = formData.accionistas.map(a => parseFloat(a.PCT_PART) || 0);
  const suma  = vals.reduce((s, v) => s + v, 0);
  const total = Math.round(suma * 100) / 100;
  const sinPct = vals.some(v => v === 0);

  if (sinPct) {
    ind.textContent = `Suma actual: ${total}% — Hay accionistas sin porcentaje definido.`;
    ind.className   = 'pct-indicador pct-neutro';
  } else if (Math.abs(total - 100) < 0.01) {
    ind.textContent = `✓ La suma de participaciones es ${total}% — Correcto.`;
    ind.className   = 'pct-indicador pct-ok';
  } else {
    ind.textContent = `⚠ La suma de participaciones es ${total}% — Debe ser exactamente 100%.`;
    ind.className   = 'pct-indicador pct-error';
  }
}

/* ── Opciones desde caché ────────────────────────────────────────────────────── */
function _acTdOpts() {
  return getOpcionesHTML('/api/catalogo/tipos-documento?todos=1', 'COD_TPDOC', 'NOM_TPDOC', '— Seleccione —');
}
function _acPaOpts() {
  return getOpcionesHTML('/api/catalogo/paises', 'COD_PAIS', 'NOM_PAIS', '— Seleccione —');
}

/* ── Crear elemento DOM de un grupo ──────────────────────────────────────────── */
function _crearGrupoACEl(accionista) {
  const id  = accionista._id;
  const pos = _acPos(id) + 1;
  const td  = _acTdOpts();
  const pa  = _acPaOpts();
  const el  = document.createElement('div');
  el.className = 'grupo-item';
  el.id        = `ac_grupo_${id}`;
  el.innerHTML = `
    <div class="grupo-header" onclick="toggleGrupoAC(${id})">
      <span class="grupo-titulo" id="ac_titulo_${id}">Accionista ${pos}</span>
      <button class="btn-eliminar-grupo" type="button" onclick="eliminarAC(event,${id})" title="Eliminar">✕</button>
    </div>
    <div class="grupo-body" id="ac_body_${id}">
      <div class="grid-4">
        <div class="field" id="field-ac_${id}_nom">
          <label>Nombres <span class="req">*</span></label>
          <input type="text" id="ac_${id}_nom" maxlength="100" placeholder="Nombres completos"
                 oninput="actualizarAC(${id},'NOM_ACCI',this.value);actualizarTituloAC(${id});limpiarError('field-ac_${id}_nom')" />
          <span class="error-msg">Campo requerido</span>
        </div>
        <div class="field" id="field-ac_${id}_ape">
          <label>Apellidos <span class="req">*</span></label>
          <input type="text" id="ac_${id}_ape" maxlength="100" placeholder="Apellidos completos"
                 oninput="actualizarAC(${id},'APE_ACCI',this.value);limpiarError('field-ac_${id}_ape')" />
          <span class="error-msg">Campo requerido</span>
        </div>
        <div class="field">
          <label>Razón social</label>
          <input type="text" id="ac_${id}_raz" maxlength="255" placeholder="Si aplica"
                 oninput="actualizarAC(${id},'RAZ_ACCI',this.value);actualizarTituloAC(${id})" />
        </div>
        <div class="field" id="field-ac_${id}_pct">
          <label>% Participación <span class="req">*</span></label>
          <input type="number" id="ac_${id}_pct" min="0.01" max="100" step="0.01"
                 placeholder="Ej: 25.50"
                 oninput="actualizarACPCT(${id},this.value);limpiarError('field-ac_${id}_pct')" />
          <span class="error-msg">Requerido (0.01 – 100)</span>
        </div>
      </div>
      <div class="grid-4">
        <div class="field" id="field-ac_${id}_tipdoc">
          <label>Tipo doc. <span class="req">*</span></label>
          <select id="ac_${id}_tipdoc"
                  onchange="actualizarAC(${id},'TIP_DOCU',this.value);limpiarError('field-ac_${id}_tipdoc')">
            ${td}
          </select>
          <span class="error-msg">Campo requerido</span>
        </div>
        <div class="field" id="field-ac_${id}_numdoc">
          <label>Número doc. <span class="req">*</span></label>
          <input type="text" id="ac_${id}_numdoc" maxlength="20" inputmode="numeric"
                 oninput="this.value=this.value.replace(/\\D/g,'');actualizarAC(${id},'NUM_DOCU',this.value);limpiarError('field-ac_${id}_numdoc')" />
          <span class="error-msg">Campo requerido</span>
        </div>
        <div class="field" id="field-ac_${id}_fec">
          <label>Fecha expedición <span class="req">*</span></label>
          <input type="date" id="ac_${id}_fec"
                 onchange="actualizarAC(${id},'FEC_EXPE',this.value);limpiarError('field-ac_${id}_fec')" />
          <span class="error-msg">Campo requerido</span>
        </div>
        <div class="field">
          <label>Celular</label>
          <input type="tel" id="ac_${id}_cel" maxlength="20"
                 oninput="actualizarAC(${id},'CEL_ACCI',this.value)" />
        </div>
      </div>
      <div class="grid-4">
        <div class="field" id="field-ac_${id}_pais">
          <label>País <span class="req">*</span></label>
          <select id="ac_${id}_pais"
                  onchange="onACPaisChange(${id},this.value);limpiarError('field-ac_${id}_pais')">
            ${pa}
          </select>
          <span class="error-msg">Campo requerido</span>
        </div>
        <div class="field" id="field-ac_${id}_dept">
          <label>Departamento <span class="req">*</span></label>
          <select id="ac_${id}_dept" disabled
                  onchange="onACDeptChange(${id},this.value);limpiarError('field-ac_${id}_dept')">
            <option value="">— Seleccione país primero —</option>
          </select>
          <span class="error-msg">Campo requerido</span>
        </div>
        <div class="field" id="field-ac_${id}_mpio">
          <label>Ciudad <span class="req">*</span></label>
          <select id="ac_${id}_mpio" disabled
                  onchange="actualizarAC(${id},'COD_MPIO',this.value);limpiarError('field-ac_${id}_mpio')">
            <option value="">— Seleccione departamento primero —</option>
          </select>
          <span class="error-msg">Campo requerido</span>
        </div>
        <div class="field">
          <label>Dirección</label>
          <input type="text" id="ac_${id}_dir" maxlength="255"
                 oninput="actualizarAC(${id},'DIR_ACCI',this.value)" />
        </div>
      </div>
      <div class="grid-4">
        <div class="field">
          <label>Teléfono fijo</label>
          <input type="tel" id="ac_${id}_tel" maxlength="20"
                 oninput="actualizarAC(${id},'TEL_ACCI',this.value)" />
        </div>
        <div class="field" id="field-ac_${id}_mail">
          <label>Correo electrónico</label>
          <input type="email" id="ac_${id}_mail" maxlength="100"
                 oninput="actualizarAC(${id},'MAIL_ACCI',this.value);limpiarError('field-ac_${id}_mail')" />
          <span class="error-msg">Email inválido</span>
        </div>
      </div>
    </div>`;
  return el;
}

function _hydrateACFields(accionista, el) {
  const id = accionista._id;
  const set = (selector, value) => {
    const field = el.querySelector(selector);
    if (field) field.value = value || '';
  };

  set(`#ac_${id}_nom`, accionista.NOM_ACCI);
  set(`#ac_${id}_ape`, accionista.APE_ACCI);
  set(`#ac_${id}_raz`, accionista.RAZ_ACCI);
  set(`#ac_${id}_pct`, accionista.PCT_PART);
  set(`#ac_${id}_tipdoc`, accionista.TIP_DOCU);
  set(`#ac_${id}_numdoc`, accionista.NUM_DOCU);
  set(`#ac_${id}_fec`, accionista.FEC_EXPE);
  set(`#ac_${id}_cel`, accionista.CEL_ACCI);
  set(`#ac_${id}_pais`, accionista.COD_PAIS);
  set(`#ac_${id}_dir`, accionista.DIR_ACCI);
  set(`#ac_${id}_tel`, accionista.TEL_ACCI);
  set(`#ac_${id}_mail`, accionista.MAIL_ACCI);

  if (accionista.COD_PAIS) {
    onACPaisChange(id, accionista.COD_PAIS).then(() => {
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
} // cierra _hydrateACFields

/**
 * Inicializa la lista de accionistas con un registro vacío.
 * Se llama una sola vez desde app.js, una vez que el catálogo de países
 * y tipos de documento están en cache.
 */
async function renderListaAC() {
  const list = document.getElementById('ac-grupos-list');
  list.innerHTML = '';
  if (!Array.isArray(formData.accionistas) || formData.accionistas.length === 0) {
    formData.accionistas = [];
    _acId = 0;
    const primero = _acNuevo();
    formData.accionistas.push(primero);
  } else {
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
  // Normaliza a string para mantener consistencia con DOM
  a.COD_PAIS = codPais ? String(codPais) : null;
  a.COD_DEPT = null;
  a.COD_MPIO = null;

  const selDept = document.getElementById(`ac_${id}_dept`);
  const selMpio = document.getElementById(`ac_${id}_mpio`);
  selMpio.innerHTML = '<option value="">— Seleccione departamento primero —</option>';
  selMpio.disabled  = true;
  limpiarError(`field-ac_${id}_dept`);
  limpiarError(`field-ac_${id}_mpio`);

  if (!codPais) {
    selDept.innerHTML = '<option value="">— Seleccione país primero —</option>';
    selDept.disabled  = true; return;
  }
  if (String(codPais) === COD_COLOMBIA) {
    selDept.disabled = false;
    await cargarCatalogo('/api/catalogo/departamentos', `ac_${id}_dept`,
      'COD_DEPT', 'NOM_DEPT', '— Seleccione departamento —', { cod_pais: codPais });
  } else {
    selDept.innerHTML = '<option value="NA">No aplica</option>';
    selDept.value = 'NA'; selDept.disabled = true;
    a.COD_DEPT = 'NA';
    selMpio.disabled = false;
    selMpio.innerHTML = '<option value="">Cargando ciudades…</option>';
    await cargarCatalogo('/api/catalogo/ciudades', `ac_${id}_mpio`,
      'COD_MUNI', 'NOM_MUNI', '— Seleccione ciudad —', { cod_pais: codPais });
    selMpio.onchange = e => {
      a.COD_MPIO = e.target.value || null;
      limpiarError(`field-ac_${id}_mpio`);
    };
  }
}

async function onACDeptChange(id, codDept) {
  const a = _acGet(id);
  if (!a) return;
  // Normaliza a string para mantener consistencia con DOM
  a.COD_DEPT = codDept ? String(codDept) : null;
  a.COD_MPIO = null;

  const selMpio = document.getElementById(`ac_${id}_mpio`);
  const codPais = document.getElementById(`ac_${id}_pais`).value;
  selMpio.innerHTML = '<option value="">Cargando ciudades…</option>';
  selMpio.disabled  = true;
  if (!codDept || !codPais) return;
  await cargarCatalogo('/api/catalogo/ciudades', `ac_${id}_mpio`,
    'COD_MUNI', 'NOM_MUNI', '— Seleccione ciudad —', { cod_dept: codDept, cod_pais: codPais });
  selMpio.disabled = false;
  selMpio.onchange = e => {
    a.COD_MPIO = e.target.value || null;
    limpiarError(`field-ac_${id}_mpio`);
  };
}

/* ── Validación ─────────────────────────────────────────────────────────────── */
function _validarGrupoAC(id) {
  const a = _acGet(id);
  if (!a) return true;
  const req = [
    [`field-ac_${id}_nom`,    a.NOM_ACCI],
    [`field-ac_${id}_ape`,    a.APE_ACCI],
    [`field-ac_${id}_tipdoc`, a.TIP_DOCU],
    [`field-ac_${id}_numdoc`, a.NUM_DOCU],
    [`field-ac_${id}_fec`,    a.FEC_EXPE],
    [`field-ac_${id}_pais`,   a.COD_PAIS],
    [`field-ac_${id}_dept`,   a.COD_DEPT],
    [`field-ac_${id}_mpio`,   a.COD_MPIO],
  ];
  let ok = true;
  req.forEach(([fid, v]) => { if (!v || !String(v).trim()) { mostrarError(fid); ok = false; } });
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
  if (ok) {
    const suma = formData.accionistas.reduce((s, a) => s + (parseFloat(a.PCT_PART) || 0), 0);
    if (Math.abs(suma - 100) > 0.01) {
      const total = Math.round(suma * 100) / 100;
      mostrarToast(`La suma de participaciones es ${total}%. Debe ser exactamente 100%.`, 'error');
      ok = false;
    }
  }
  return ok;
}

/* ── Acciones de botones ────────────────────────────────────────────────────── */
function validarYContinuarAC() {
  if (!validarSeccionAC()) {
    document.getElementById('accordion-ac').classList.remove('collapsed');
    mostrarToast('Corrija los campos marcados en rojo.', 'error');
    const primerError = document.querySelector('#accordion-ac .field.error');
    if (primerError) primerError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  mostrarToast('Sección 8 completa. Puede enviar el formulario.', 'success');
  document.getElementById('accordion-ac').classList.add('collapsed');
  console.log('✅ formData.accionistas:', JSON.stringify(formData.accionistas, null, 2));
}

function limpiarSeccionAC() {
  renderListaAC();
  mostrarToast('Sección limpiada.', 'success');
}

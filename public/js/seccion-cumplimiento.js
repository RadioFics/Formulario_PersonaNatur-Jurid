/**
 * seccion-cumplimiento.js — Sección 5: "Información del Sistema de cumplimiento"
 *
 * Patrón: lista plana de oficiales. Cada oficial tiene un selector de Rol
 * (Principal / Suplente). El botón "+ Agregar miembro" añade cualquier tipo.
 *
 * State: formData.cumplimiento.oficiales[i] = { _id, TIP_REPR, ...campos }
 * API IDs: cump_{id}_{campo}
 *
 * Depende de: state.js, utils.js
 */
'use strict';

let _cumpId = 0;

/* ── Estado ─────────────────────────────────────────────────────────────────── */
function actualizarCump(campo, valor) {
  formData.cumplimiento[campo] = valor === '' ? null : valor;
}

/* ── Fábrica de oficial ──────────────────────────────────────────────────────── */
function _cumpCampos(tipRepr) {
  return {
    TIP_REPR: tipRepr || 'P',
    NOM_RESP: '', APE_RESP: '',
    TIP_DOCU: null, NUM_DOCU: '', FEC_EXPE: '',
    COD_PAIS: null, OTR_PAIS: '', COD_DEPT: null, COD_MPIO: null,
    DIR_RESP: '', CEL_RESP: '', TEL_RESP: '', MAIL_RESP: '',
  };
}
function _cumpNuevo(tipRepr) {
  return Object.assign({ _id: _cumpId++ }, _cumpCampos(tipRepr));
}
function _cumpGet(id) { return formData.cumplimiento.oficiales.find(o => o._id === id); }
function _cumpPos(id) { return formData.cumplimiento.oficiales.findIndex(o => o._id === id); }

function actualizarOficial(id, campo, valor) {
  const o = _cumpGet(id);
  if (o) o[campo] = valor === '' ? null : valor;
}

/* ── Título dinámico ─────────────────────────────────────────────────────────── */
function actualizarTituloCump(id) {
  const o = _cumpGet(id);
  if (!o) return;
  const pos = _cumpPos(id);
  // TIP_REPR siempre refleja la posición actual
  o.TIP_REPR = pos === 0 ? 'P' : 'S';
  const nom = [(o.NOM_RESP || '').trim(), (o.APE_RESP || '').trim()].filter(Boolean).join(' ');
  const roleLabel = typeof t==='function'?(pos===0?t('role_principal'):t('role_suplente')):(pos===0?'Principal':'Suplente');
  const el  = document.getElementById(`cump_titulo_${id}`);
  if (el) el.innerHTML = `<span data-i18n="card_oficial">${typeof t==='function'?t('card_oficial'):'Oficial'}</span> ${pos + 1} (<span data-i18n="${pos===0?'role_principal':'role_suplente'}">${roleLabel}</span>)${nom ? ' — ' + nom : ''}`;
}
function _cumpRenumerarTodos() {
  formData.cumplimiento.oficiales.forEach(o => actualizarTituloCump(o._id));
}

/* ── Colapsar/expandir ──────────────────────────────────────────────────────── */
function toggleGrupoCump(id) {
  const body = document.getElementById(`cump_body_${id}`);
  if (body) body.classList.toggle('collapsed');
}

/* ── Visibilidad condicional del bloque B1 ──────────────────────────────────── */
function mostrarBloqueCump(el) {
  el.style.display = 'flex';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.style.opacity   = '1';
    el.style.maxHeight = '99999px';
  }));
}

function ocultarBloqueCump(el) {
  el.style.opacity   = '0';
  el.style.maxHeight = '0';
  setTimeout(() => { el.style.display = 'none'; }, 210);
}

function onTieneSistemaChange(valor) {
  actualizarCump('TIE_JUNTA', valor);
  const bloque = document.getElementById('bloque-cump-sistema');
  if (!bloque) return;
  if (valor === 'S') {
    mostrarBloqueCump(bloque);
    if (formData.cumplimiento.oficiales.length === 0) agregarCump('P');
    renderListaCump();
  } else {
    ocultarBloqueCump(bloque);
    bloque.querySelectorAll('.field.error').forEach(f => f.classList.remove('error'));
  }
}

function onTieNormChange(valor) {
  actualizarCump('TIE_NORM', valor);
  const wrap = document.getElementById('bloque-cump-normativa');
  if (!wrap) return;
  if (valor === 'S') {
    wrap.style.display = 'flex';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      wrap.style.opacity   = '1';
      wrap.style.maxHeight = '99999px';
    }));
  } else {
    wrap.style.opacity   = '0';
    wrap.style.maxHeight = '0';
    setTimeout(() => {
      wrap.style.display = 'none';
      wrap.querySelectorAll('.field.error').forEach(f => f.classList.remove('error'));
    }, 210);
  }
}

/**
 * Carga los checkboxes de "Tipo de sistema implementado" desde el catálogo.
 * Usa catalogCache para evitar fetch duplicado. Restaura el estado actual.
 */
async function cargarCheckboxesSisPrev() {
  const wrap = document.getElementById('cump_sis_preve_checks');
  if (!wrap) return;

  const endpoint = '/api/catalogo/sistemas-prevencion';
  const cacheKey = new URL(endpoint, window.location.origin).toString();

  let datos = catalogCache[cacheKey];
  if (!datos) {
    try {
      const resp = await fetch(cacheKey);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      datos = await resp.json();
      catalogCache[cacheKey] = datos;
    } catch (e) {
      console.error('cargarCheckboxesSisPrev:', e);
      wrap.innerHTML = '<span style="color:var(--color-error);font-size:.85rem">⚠ Error al cargar opciones</span>';
      return;
    }
  }

  window._sistPrevDatos = datos;
  _buildSistPrevMultiselect(wrap, datos);
}

/* ── Multi-select helpers ────────────────────────────────────────────────── */
function _htmlEsc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function _buildSistPrevMultiselect(wrap, datos) {
  const seleccionados = formData.cumplimiento.SIS_PREVE
    ? String(formData.cumplimiento.SIS_PREVE).split(',').filter(Boolean)
    : [];
  const hasOtr = seleccionados.includes('OTR');
  const lang = window._currentLang || 'es';
  const placeholder = typeof t === 'function' ? t('sec5_select_ph') : 'Seleccione uno o varios...';

  const labelText = seleccionados.length
    ? datos.filter(r => seleccionados.includes(r.COD_ABREV))
           .map(r => (lang === 'en' && r.NOM_EN) ? r.NOM_EN : r.NOM_SIST)
           .join(', ')
    : placeholder;

  const isEmpty = seleccionados.length === 0;

  wrap.innerHTML = `
    <div class="ms-wrap" id="cump_sis_preve_ms">
      <button type="button" class="ms-trigger" id="cump_sis_preve_btn"
              onclick="toggleSistPrevPanel(event)">
        <span class="ms-label${isEmpty ? ' ms-empty' : ''}" id="cump_sis_preve_label">${_htmlEsc(labelText)}</span>
        <span class="ms-arrow" aria-hidden="true">&#9660;</span>
      </button>
      <div class="ms-panel" id="cump_sis_preve_panel" style="display:none">
        ${datos.map(row => {
          const lbl = (lang === 'en' && row.NOM_EN) ? row.NOM_EN : row.NOM_SIST;
          const chk = seleccionados.includes(row.COD_ABREV) ? 'checked' : '';
          const dis = (hasOtr && row.COD_ABREV !== 'OTR') ? 'ms-disabled' : '';
          const disAttr = (hasOtr && row.COD_ABREV !== 'OTR') ? 'disabled' : '';
          return `<label class="ms-option ${dis}" id="ms-opt-${row.COD_ABREV}">
            <input type="checkbox" value="${row.COD_ABREV}" ${chk} ${disAttr}
                   onchange="onSistPreveChange('${row.COD_ABREV}',this.checked);limpiarError('field-cump_sis_preve')">
            <span>${_htmlEsc(lbl)}</span>
          </label>`;
        }).join('')}
      </div>
    </div>`;

  // Close when clicking outside
  document.removeEventListener('click', _closeSistPrevOnOutside);
  document.addEventListener('click', _closeSistPrevOnOutside);
}

function toggleSistPrevPanel(e) {
  e.stopPropagation();
  const panel = document.getElementById('cump_sis_preve_panel');
  if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  const btn = document.getElementById('cump_sis_preve_btn');
  if (btn) btn.classList.toggle('ms-open', !isOpen);
}

function _closeSistPrevOnOutside(e) {
  const wrap = document.getElementById('cump_sis_preve_ms');
  if (!wrap || wrap.contains(e.target)) return;
  const panel = document.getElementById('cump_sis_preve_panel');
  if (panel) panel.style.display = 'none';
  const btn = document.getElementById('cump_sis_preve_btn');
  if (btn) btn.classList.remove('ms-open');
}

function _updateSistPrevTrigger() {
  const datos = window._sistPrevDatos || [];
  const lang = window._currentLang || 'es';
  const seleccionados = formData.cumplimiento.SIS_PREVE
    ? String(formData.cumplimiento.SIS_PREVE).split(',').filter(Boolean)
    : [];
  const placeholder = typeof t === 'function' ? t('sec5_select_ph') : 'Seleccione uno o varios...';
  const labelEl = document.getElementById('cump_sis_preve_label');
  if (!labelEl) return;
  if (seleccionados.length) {
    labelEl.textContent = datos
      .filter(r => seleccionados.includes(r.COD_ABREV))
      .map(r => (lang === 'en' && r.NOM_EN) ? r.NOM_EN : r.NOM_SIST)
      .join(', ');
    labelEl.classList.remove('ms-empty');
  } else {
    labelEl.textContent = placeholder;
    labelEl.classList.add('ms-empty');
  }
}

function refreshSistPrevLabels() {
  const datos = window._sistPrevDatos;
  if (!datos) return;
  const lang = window._currentLang || 'es';
  datos.forEach(row => {
    const optEl = document.getElementById(`ms-opt-${row.COD_ABREV}`);
    if (!optEl) return;
    const spanEl = optEl.querySelector('span');
    if (spanEl) spanEl.textContent = (lang === 'en' && row.NOM_EN) ? row.NOM_EN : row.NOM_SIST;
  });
  _updateSistPrevTrigger();
}
window.refreshSistPrevLabels = refreshSistPrevLabels;
window.toggleSistPrevPanel   = toggleSistPrevPanel;

/**
 * Llamado por onchange de cada checkbox de "Tipo de sistema implementado".
 * Acumula/elimina el valor en SIS_PREVE (CSV) y controla el campo "Otro".
 * @param {string}  codAbrev — COD_ABREV del sistema (p. ej. 'OTR', 'SAGRILAFT')
 * @param {boolean} checked  — si el checkbox fue marcado o desmarcado
 */
function onSistPreveChange(codAbrev, checked) {
  let vals = formData.cumplimiento.SIS_PREVE
    ? String(formData.cumplimiento.SIS_PREVE).split(',').filter(Boolean)
    : [];

  if (checked) {
    if (!vals.includes(codAbrev)) vals.push(codAbrev);
  } else {
    vals = vals.filter(v => v !== codAbrev);
  }

  // OTR logic: when Otro is selected, uncheck & disable all other options
  const hasOtr = vals.includes('OTR');
  const panel = document.getElementById('cump_sis_preve_panel');
  if (panel) {
    panel.querySelectorAll('.ms-option').forEach(opt => {
      const inp = opt.querySelector('input[type="checkbox"]');
      if (!inp || inp.value === 'OTR') return;
      opt.classList.toggle('ms-disabled', hasOtr);
      inp.disabled = hasOtr;
      if (hasOtr && inp.checked) {
        inp.checked = false;
        vals = vals.filter(v => v !== inp.value);
      }
    });
  }

  actualizarCump('SIS_PREVE', vals.length ? vals.join(',') : null);
  _updateSistPrevTrigger();

  const fieldOtro = document.getElementById('field-cump_sis_preve_otro');
  if (!fieldOtro) return;
  if (vals.includes('OTR')) {
    fieldOtro.style.display = '';
  } else {
    fieldOtro.style.display = 'none';
    actualizarCump('OTR_PREVE', '');
    const inp = document.getElementById('otr_preve');
    if (inp) inp.value = '';
  }
}

/* ── Opciones de catálogo ────────────────────────────────────────────────────── */
function _cumpTdOpts() {
  return getOpcionesHTML('/api/catalogo/tipos-documento?todos=1', 'COD_TPDOC', 'NOM_TPDOC', 'select_placeholder');
}
function _cumpPaOpts() {
  return getOpcionesHTML('/api/catalogo/paises', 'COD_PAIS', 'NOM_PAIS', 'select_placeholder');
}

/* ── HTML de un oficial ──────────────────────────────────────────────────────── */
function _cumpOficialHTML(o) {
  const id  = o._id;
  const pos = _cumpPos(id);
  const roleLabel = typeof t==='function'?(pos===0?t('role_principal'):t('role_suplente')):(pos===0?'Principal':'Suplente');
  const td  = _cumpTdOpts();
  const pa  = _cumpPaOpts();
  return `
    <div class="grupo-header" onclick="toggleGrupoCump(${id})">
      <span class="grupo-titulo" id="cump_titulo_${id}"><span data-i18n="card_oficial">${typeof t==='function'?t('card_oficial'):'Oficial'}</span> ${pos + 1} (<span data-i18n="${pos===0?'role_principal':'role_suplente'}">${roleLabel}</span>)</span>
      <button class="btn-eliminar-grupo" type="button" onclick="eliminarCump(event,${id})" title="Eliminar">✕</button>
    </div>
    <div class="grupo-body" id="cump_body_${id}">
      <div class="grid-4">
        <div class="field" id="field-cump_${id}_nom">
          <label><span data-i18n="field_nombres">${typeof t==='function'?t('field_nombres'):'Nombres'}</span> <span class="req">*</span></label>
          <input type="text" id="cump_${id}_nom" maxlength="100"
                 oninput="actualizarOficial(${id},'NOM_RESP',this.value);actualizarTituloCump(${id});limpiarError('field-cump_${id}_nom')" />
          <span class="error-msg" data-i18n="required_field">${typeof t==='function'?t('required_field'):'Campo requerido'}</span>
        </div>
        <div class="field" id="field-cump_${id}_ape">
          <label><span data-i18n="field_apellidos">${typeof t==='function'?t('field_apellidos'):'Apellidos'}</span> <span class="req">*</span></label>
          <input type="text" id="cump_${id}_ape" maxlength="100"
                 oninput="actualizarOficial(${id},'APE_RESP',this.value);limpiarError('field-cump_${id}_ape')" />
          <span class="error-msg" data-i18n="required_field">${typeof t==='function'?t('required_field'):'Campo requerido'}</span>
        </div>
        <div class="field" id="field-cump_${id}_tipdoc">
          <label><span data-i18n="field_tip_doc">${typeof t==='function'?t('field_tip_doc'):'Tipo de documento'}</span> <span class="req">*</span></label>
          <select id="cump_${id}_tipdoc"
                  onchange="onCumpTipdocChange(${id},this.value);actualizarOficial(${id},'TIP_DOCU',this.value);limpiarError('field-cump_${id}_tipdoc')">
            ${td}
          </select>
          <input type="text" id="cump_${id}_tipdoc_otro" class="otro-inp" maxlength="100" style="display:none"
                 data-i18n-ph="field_specify_doc" placeholder="${typeof t==='function'?t('field_specify_doc'):'Especifique el tipo de documento'}"
                 oninput="actualizarOficial(${id},'OTR_TPDOC',this.value)" />
          <span class="error-msg" data-i18n="required_field">${typeof t==='function'?t('required_field'):'Campo requerido'}</span>
        </div>
        <div class="field" id="field-cump_${id}_numdoc">
          <label><span data-i18n="field_num_doc">${typeof t==='function'?t('field_num_doc'):'Número de documento'}</span> <span class="req">*</span></label>
          <input type="text" id="cump_${id}_numdoc" maxlength="20" inputmode="numeric"
                 oninput="this.value=this.value.replace(/\D/g,'');actualizarOficial(${id},'NUM_DOCU',this.value);limpiarError('field-cump_${id}_numdoc')" />
          <span class="error-msg" data-i18n="required_field">${typeof t==='function'?t('required_field'):'Campo requerido'}</span>
        </div>
      </div>
      <div class="grid-4">
        <div class="field" id="field-cump_${id}_fec">
          <label><span data-i18n="field_fec_expe">${typeof t==='function'?t('field_fec_expe'):'Fecha de expedición'}</span> <span class="req">*</span></label>
          <input type="date" id="cump_${id}_fec"
                 onchange="actualizarOficial(${id},'FEC_EXPE',this.value);limpiarError('field-cump_${id}_fec')" />
          <span class="error-msg" data-i18n="required_field">${typeof t==='function'?t('required_field'):'Campo requerido'}</span>
        </div>
        <div class="field" id="field-cump_${id}_pais">
          <label><span data-i18n="field_pais">${typeof t==='function'?t('field_pais'):'País'}</span> <span class="req">*</span></label>
          <select id="cump_${id}_pais"
                  onchange="onCumpPaisChange(${id},this.value);limpiarError('field-cump_${id}_pais')">
            ${pa}
          </select>
          <span class="error-msg" data-i18n="required_field">${typeof t==='function'?t('required_field'):'Campo requerido'}</span>
        </div>
        <div class="field" id="field-cump_${id}_pais_otro" style="display:none">
          <label><span data-i18n="specify_country">${typeof t==='function'?t('specify_country'):'Especifique el pa\xEDs'}</span> <span class="req">*</span></label>
          <input type="text" id="cump_${id}_pais_otro" maxlength="100"
                 data-i18n-ph="country_name_ph" placeholder="${typeof t==='function'?t('country_name_ph'):'Nombre del pa\xEDs'}"
                 oninput="actualizarOficial(${id},'OTR_PAIS',this.value)" />
        </div>
        <div class="field" id="field-cump_${id}_dept">
          <label><span data-i18n="field_dept">${typeof t==='function'?t('field_dept'):'Departamento'}</span> <span class="req">*</span></label>
          <select id="cump_${id}_dept" disabled
                  onchange="onCumpDeptChange(${id},this.value);limpiarError('field-cump_${id}_dept')">
            <option value="" data-i18n="select_first_country">${typeof t==='function'?t('select_first_country'):'— Seleccione país primero —'}</option>
          </select>
          <span class="error-msg" data-i18n="required_field">${typeof t==='function'?t('required_field'):'Campo requerido'}</span>
        </div>
        <div class="field" id="field-cump_${id}_mpio">
          <label><span data-i18n="field_ciudad">${typeof t==='function'?t('field_ciudad'):'Ciudad'}</span> <span class="req">*</span></label>
          <select id="cump_${id}_mpio" disabled
                  onchange="actualizarOficial(${id},'COD_MPIO',this.value);limpiarError('field-cump_${id}_mpio')">
            <option value="" data-i18n="select_first_dept">${typeof t==='function'?t('select_first_dept'):'— Seleccione departamento primero —'}</option>
          </select>
          <span class="error-msg" data-i18n="required_field">${typeof t==='function'?t('required_field'):'Campo requerido'}</span>
        </div>
      </div>
      <div class="grid-4">
        <div class="field">
          <label><span data-i18n="field_dir">${typeof t==='function'?t('field_dir'):'Dirección domicilio'}</span></label>
          <input type="text" id="cump_${id}_dir" maxlength="255"
                 oninput="actualizarOficial(${id},'DIR_RESP',this.value)" />
        </div>
        <div class="field" id="field-cump_${id}_cel">
          <label><span data-i18n="field_celular">${typeof t==='function'?t('field_celular'):'Celular'}</span> <span class="req">*</span></label>
          <input type="tel" id="cump_${id}_cel" maxlength="20"
                 oninput="actualizarOficial(${id},'CEL_RESP',this.value);limpiarError('field-cump_${id}_cel')" />
          <span class="error-msg" data-i18n="required_field">${typeof t==='function'?t('required_field'):'Campo requerido'}</span>
        </div>
        <div class="field">
          <label><span data-i18n="field_tel">${typeof t==='function'?t('field_tel'):'Teléfono fijo'}</span></label>
          <input type="tel" id="cump_${id}_tel" maxlength="20"
                 oninput="actualizarOficial(${id},'TEL_RESP',this.value)" />
        </div>
        <div class="field" id="field-cump_${id}_mail">
          <label><span data-i18n="field_mail">${typeof t==='function'?t('field_mail'):'Correo electrónico'}</span> <span class="req">*</span></label>
          <input type="email" id="cump_${id}_mail" maxlength="100"
                 oninput="actualizarOficial(${id},'MAIL_RESP',this.value);limpiarError('field-cump_${id}_mail')" />
          <span class="error-msg" data-i18n="invalid_email">${typeof t==='function'?t('invalid_email'):'Email inválido o vacío'}</span>
        </div>
      </div>
    </div>`;
}

/* ── Crear elemento DOM ──────────────────────────────────────────────────────── */
function _crearGrupoCumpEl(o) {
  const el = document.createElement('div');
  el.className = 'grupo-item';
  el.id        = `cump_grupo_${o._id}`;
  el.innerHTML = _cumpOficialHTML(o);
  agregarOpcionOtroAlSelect(el.querySelector(`#cump_${o._id}_pais`));
  agregarOpcionOtroAlTipdoc(el.querySelector(`#cump_${o._id}_tipdoc`));
  return el;
}

/* ── Hidratar campos ─────────────────────────────────────────────────────────── */
function _hydrateCumpFields(o, el) {
  const id  = o._id;
  const set = (sel, val) => { const f = el.querySelector(sel); if (f) f.value = val || ''; };

  set(`#cump_${id}_tipdoc`,  o.TIP_DOCU);
  if (o.TIP_DOCU === 'OTR_TPDOC') {
    const inpOtro = el.querySelector(`#cump_${id}_tipdoc_otro`);
    if (inpOtro) { inpOtro.style.display = ''; inpOtro.value = o.OTR_TPDOC || ''; }
  }
  set(`#cump_${id}_numdoc`,  o.NUM_DOCU);
  set(`#cump_${id}_fec`,     o.FEC_EXPE);
  set(`#cump_${id}_nom`,     o.NOM_RESP);
  set(`#cump_${id}_ape`,     o.APE_RESP);
  set(`#cump_${id}_cel`,     o.CEL_RESP);
  set(`#cump_${id}_tel`,     o.TEL_RESP);
  set(`#cump_${id}_mail`,    o.MAIL_RESP);
  set(`#cump_${id}_dir`,     o.DIR_RESP);

  if (o.COD_PAIS) {
    onCumpPaisChange(id, o.COD_PAIS)
      .then(() => {
        if (o.COD_PAIS === 'OTRO' || String(o.COD_PAIS) === '52') {
          const otrInp = el.querySelector(`#cump_${id}_pais_otro`);
          if (otrInp) otrInp.value = o.OTR_PAIS || '';
          const fo = el.querySelector(`#field-cump_${id}_pais_otro`);
          if (fo) { fo.style.display = ''; fo.style.gridColumn = 'span 2'; }
          return Promise.resolve();
        }
        const deptEl = el.querySelector(`#cump_${id}_dept`);
        if (deptEl) deptEl.value = o.COD_DEPT || '';
        if (o.COD_DEPT && o.COD_DEPT !== 'NA') return onCumpDeptChange(id, o.COD_DEPT);
        return Promise.resolve();
      })
      .then(() => {
        if (o.COD_PAIS !== 'OTRO' && String(o.COD_PAIS) !== '52') {
          const mpioEl = el.querySelector(`#cump_${id}_mpio`);
          if (mpioEl) mpioEl.value = o.COD_MPIO || '';
        }
      })
      .catch(err => console.error('hydrateCump:', err));
  }

  setTimeout(() => actualizarTituloCump(id), 0);
}

/* ── Renderizado de la lista ─────────────────────────────────────────────────── */
function renderListaCump() {
  const list = document.getElementById('cump-oficiales-list');
  if (!list) return;
  list.innerHTML = '';

  if (!Array.isArray(formData.cumplimiento.oficiales)) {
    formData.cumplimiento.oficiales = [];
  }

  // Migrar formato antiguo (array indexado sin _id) al nuevo plano
  const migrados = [];
  for (const o of formData.cumplimiento.oficiales) {
    if (o._id === undefined) {
      // Formato viejo: objeto sin _id con TIP_REPR
      migrados.push(Object.assign({ _id: _cumpId++ }, o));
    } else {
      migrados.push(o);
    }
  }
  if (migrados.length > 0) formData.cumplimiento.oficiales = migrados;

  _cumpId = formData.cumplimiento.oficiales.length === 0
    ? 0
    : Math.max(...formData.cumplimiento.oficiales.map(o => o._id)) + 1;

  for (const o of formData.cumplimiento.oficiales) {
    const el = _crearGrupoCumpEl(o);
    list.appendChild(el);
    _hydrateCumpFields(o, el);
  }
  _cumpSyncEliminar();
}

/* ── Validación y navegación ────────────────────────────────────────────────── */

/**
 * Valida la sección 5 (Cumplimiento).
 * Si TIE_NORM = 'S': requiere DESC_NORM y, si TIE_JUNTA = 'S', valida oficiales.
 * @returns {boolean}
 */
function validarSeccionCumplimiento() {
  let ok = true;
  const c = formData.cumplimiento;

  if (c.TIE_NORM === 'S') {
    // DESC_NORM requerido cuando sujeta a normatividad
    if (!c.DESC_NORM || !String(c.DESC_NORM).trim()) {
      mostrarError('field-cump_desc_norm');
      ok = false;
    } else {
      limpiarError('field-cump_desc_norm');
    }

    // Si tiene sistema implementado, validar tipo (multiselect) y oficiales
    if (c.TIE_JUNTA === 'S') {
      const sistemasMarcados = c.SIS_PREVE
        ? String(c.SIS_PREVE).split(',').filter(Boolean)
        : [];
      if (sistemasMarcados.length === 0) {
        mostrarError('field-cump_sis_preve');
        ok = false;
      }
      if (sistemasMarcados.includes('OTR') && (!c.OTR_PREVE || !String(c.OTR_PREVE).trim())) {
        mostrarError('field-cump_sis_preve_otro');
        ok = false;
      }
      if (!Array.isArray(c.oficiales) || c.oficiales.length === 0) {
        mostrarToast(typeof t==='function'?t('sec5_need_oficial'):'Agregue al menos un oficial de cumplimiento.', 'error');
        ok = false;
      } else {
        for (const o of c.oficiales) {
          const esOtro = o.COD_PAIS === 'OTRO' || String(o.COD_PAIS) === '52';
          const req = [
            [`field-cump_${o._id}_nom`,    o.NOM_RESP],
            [`field-cump_${o._id}_ape`,    o.APE_RESP],
            [`field-cump_${o._id}_tipdoc`, o.TIP_DOCU],
            [`field-cump_${o._id}_numdoc`, o.NUM_DOCU],
            [`field-cump_${o._id}_fec`,    o.FEC_EXPE],
            [`field-cump_${o._id}_pais`,   o.COD_PAIS],
            ...(!esOtro ? [
              [`field-cump_${o._id}_dept`, o.COD_DEPT],
              [`field-cump_${o._id}_mpio`, o.COD_MPIO],
            ] : []),
            [`field-cump_${o._id}_cel`,    o.CEL_RESP],
          ];
          req.forEach(([fid, v]) => {
            if (!v || !String(v).trim()) { mostrarError(fid); ok = false; }
          });
          if (!o.MAIL_RESP || !esEmailValido(o.MAIL_RESP)) {
            mostrarError(`field-cump_${o._id}_mail`); ok = false;
          }
        }
      }
    }
  }

  return ok;
}

/**
 * Botón "Continuar → Sección 6".
 * Valida la sección 5 y, si es correcta, abre la sección 6 (Junta Directiva).
 */
function validarYContinuarCumplimiento() {
  if (!validarSeccionCumplimiento()) {
    document.getElementById('accordion-cumplimiento').classList.remove('collapsed');
    const errCount = document.querySelectorAll('#accordion-cumplimiento .field.error').length;
    if (errCount > 0) {
      mostrarToast(t('toast_fields_missing').replace('{n}', errCount), 'error');
      const primerError = document.querySelector('#accordion-cumplimiento .field.error');
      if (primerError) primerError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return;
  }
  mostrarToast(typeof t==='function'?t('toast_sec_ok'):'Sección 5 completa.', 'success');
  document.getElementById('accordion-cumplimiento').classList.add('collapsed');
  const acc6 = document.getElementById('accordion-jd');
  if (acc6) {
    acc6.classList.remove('collapsed');
    acc6.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  console.log('✅ formData.cumplimiento:', JSON.stringify(formData.cumplimiento, null, 2));
}

function onCumpTipdocChange(id, val) {
  const inp = document.getElementById(`cump_${id}_tipdoc_otro`);
  if (inp) inp.style.display = val === 'OTR_TPDOC' ? '' : 'none';
  if (val !== 'OTR_TPDOC') {
    if (inp) inp.value = '';
    const o = _cumpGet(id);
    if (o) o.OTR_TPDOC = null;
  }
}

/** Limpia todos los campos de la sección 5. */
function limpiarSeccionCumplimiento() {
  formData.cumplimiento.TIE_NORM  = 'N';
  formData.cumplimiento.DESC_NORM = '';
  formData.cumplimiento.NORM_LAFT = '';
  formData.cumplimiento.TIE_JUNTA = 'N';
  formData.cumplimiento.SIS_PREVE = null;
  formData.cumplimiento.OTR_PREVE = '';
  formData.cumplimiento.oficiales = [];

  const radioNorm = document.querySelector('input[name="cump_tie_norm"][value="N"]');
  if (radioNorm) { radioNorm.checked = true; onTieNormChange('N'); }

  const descEl = document.getElementById('cump_desc_norm');
  if (descEl) descEl.value = '';
  const normEl = document.getElementById('cump_norm_laft');
  if (normEl) normEl.value = '';

  const radioNo = document.querySelector('input[name="cump_tie_sist"][value="N"]');
  if (radioNo) radioNo.checked = true;

  // Resetear multi-select de tipo de sistema
  const sisPanel = document.getElementById('cump_sis_preve_panel');
  if (sisPanel) {
    sisPanel.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.checked = false;
      cb.disabled = false;
    });
    sisPanel.querySelectorAll('.ms-option').forEach(o => o.classList.remove('ms-disabled'));
    sisPanel.style.display = 'none';
  }
  const sisBtn = document.getElementById('cump_sis_preve_btn');
  if (sisBtn) sisBtn.classList.remove('ms-open');
  const sisLabel = document.getElementById('cump_sis_preve_label');
  if (sisLabel) {
    sisLabel.textContent = typeof t === 'function' ? t('sec5_select_ph') : 'Seleccione uno o varios...';
    sisLabel.classList.add('ms-empty');
  }
  const fieldOtroSis = document.getElementById('field-cump_sis_preve_otro');
  if (fieldOtroSis) fieldOtroSis.style.display = 'none';
  const otrPreve = document.getElementById('otr_preve');
  if (otrPreve) otrPreve.value = '';

  document.querySelectorAll('#accordion-cumplimiento .field.error')
    .forEach(f => f.classList.remove('error'));
  mostrarToast(typeof t==='function'?t('toast_sec_clear'):'Sección limpiada.', 'success');
}

/* ── Cascadas ────────────────────────────────────────────────────────────────── */
async function onCumpPaisChange(id, codPais) {
  const o = _cumpGet(id);
  if (!o) return;
  o.COD_PAIS = codPais || null;
  o.COD_DEPT = null;
  o.COD_MPIO = null;

  const selDept    = document.getElementById(`cump_${id}_dept`);
  const selMpio    = document.getElementById(`cump_${id}_mpio`);
  const fieldOtro  = document.getElementById(`field-cump_${id}_pais_otro`);
  const fieldDept  = document.getElementById(`field-cump_${id}_dept`);
  const fieldMpio  = document.getElementById(`field-cump_${id}_mpio`);

  selMpio.innerHTML = '<option value="">' + (typeof t==='function'?t('select_first_dept'):'— Seleccione departamento primero —') + '</option>';
  selMpio.disabled  = true;
  limpiarError(`field-cump_${id}_dept`);
  limpiarError(`field-cump_${id}_mpio`);

  if (codPais === 'OTRO' || String(codPais) === '52') {
    if (fieldDept) fieldDept.style.display = 'none';
    if (fieldMpio) fieldMpio.style.display = 'none';
    if (fieldOtro) { fieldOtro.style.display = ''; fieldOtro.style.gridColumn = 'span 2'; }
    return;
  }

  if (fieldOtro) {
    fieldOtro.style.display = 'none';
    fieldOtro.style.gridColumn = '';
    o.OTR_PAIS = '';
    const inp = document.getElementById(`cump_${id}_pais_otro`);
    if (inp) inp.value = '';
  }
  if (fieldDept) fieldDept.style.display = '';
  if (fieldMpio) fieldMpio.style.display = '';

  if (!codPais) {
    selDept.innerHTML = '<option value="">' + (typeof t==='function'?t('select_first_country'):'— Seleccione pa\xEDs primero —') + '</option>';
    selDept.disabled  = true;
    return;
  }

  if (codPais === COD_COLOMBIA) {
    selDept.disabled = false;
    await cargarCatalogo('/api/catalogo/departamentos', `cump_${id}_dept`,
      'COD_DEPT', 'NOM_DEPT', 'select_ph_dept', { cod_pais: codPais });
  } else {
    selDept.innerHTML = '<option value="NA">' + (typeof t==='function'?t('no_aplica'):'No aplica') + '</option>';
    selDept.value = 'NA'; selDept.disabled = true;
    o.COD_DEPT = 'NA';
    selMpio.disabled = false;
    selMpio.innerHTML = '<option value="">' + (typeof t==='function'?t('loading_cities'):'Cargando ciudades…') + '</option>';
    await cargarCatalogo('/api/catalogo/ciudades', `cump_${id}_mpio`,
      'COD_MUNI', 'NOM_MUNI', 'select_ph_ciudad', { cod_pais: codPais });
    if (_autoNoAplicaCiudad(selMpio)) {
      actualizarOficial(id, 'COD_MPIO', 'NA');
    } else {
      selMpio.onchange = e => { actualizarOficial(id, 'COD_MPIO', e.target.value); limpiarError(`field-cump_${id}_mpio`); };
    }
  }
}

async function onCumpDeptChange(id, codDept) {
  const o = _cumpGet(id);
  if (!o) return;
  o.COD_DEPT = codDept || null;
  o.COD_MPIO = null;
  const selMpio = document.getElementById(`cump_${id}_mpio`);
  const codPais = document.getElementById(`cump_${id}_pais`).value;
  selMpio.innerHTML = '<option value="">' + (typeof t==='function'?t('loading_cities'):'Cargando ciudades…') + '</option>';
  selMpio.disabled  = true;
  if (!codDept || !codPais) return;
  await cargarCatalogo('/api/catalogo/ciudades', `cump_${id}_mpio`,
    'COD_MUNI', 'NOM_MUNI', 'select_ph_ciudad', { cod_dept: codDept, cod_pais: codPais });
  selMpio.disabled = false;
  selMpio.onchange = e => { actualizarOficial(id, 'COD_MPIO', e.target.value); limpiarError(`field-cump_${id}_mpio`); };
}

/* ── Agregar / Eliminar ──────────────────────────────────────────────────────── */
function agregarCump(tipRepr) {
  if (!Array.isArray(formData.cumplimiento.oficiales)) {
    formData.cumplimiento.oficiales = [];
  }
  // First item = Principal; extras = Suplente unless explicitly set
  const rol  = tipRepr || (formData.cumplimiento.oficiales.length > 0 ? 'S' : 'P');
  const nuevo = _cumpNuevo(rol);
  formData.cumplimiento.oficiales.push(nuevo);
  document.querySelectorAll('#cump-oficiales-list .grupo-body').forEach(b => b.classList.add('collapsed'));
  const list = document.getElementById('cump-oficiales-list');
  const el   = _crearGrupoCumpEl(nuevo);
  list.appendChild(el);
  _cumpSyncEliminar();
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  guardarBorradorDebounced();
}

function eliminarCump(event, id) {
  event.stopPropagation();
  if (formData.cumplimiento.oficiales.length <= 1) return;
  formData.cumplimiento.oficiales.splice(_cumpPos(id), 1);
  document.getElementById(`cump_grupo_${id}`).remove();
  _cumpRenumerarTodos();
  _cumpSyncEliminar();
  guardarBorradorDebounced();
}

function _cumpSyncEliminar() {
  const sola = formData.cumplimiento.oficiales.length <= 1;
  document.querySelectorAll('#cump-oficiales-list .btn-eliminar-grupo').forEach(b => { b.disabled = sola; });
}

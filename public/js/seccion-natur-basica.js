'use strict';
/**
 * seccion-natur-basica.js — Lógica de Persona Natural en la Sección 1.
 *
 * Gestiona:
 *  · onTipTercChange()              — conmuta formulario entre modo J y N
 *  · actualizarNatur()              — escribe en formDataNatur.basica
 *  · onCiiuInputNatur()             — datalist CIIU para Natural
 *  · validarNaturBasica()           — valida sección 1 en modo N
 *  · validarYContinuarBasicaNatural() — botón "Continuar" modo N
 *  · inicializarNaturBasica()       — carga catálogos exclusivos de Natural
 *
 * Parcha onPaisChange, onDeptChange y validarYContinuar para bifurcar
 * según window.modoPersona.
 *
 * Depende de: state.js, state-natur.js, utils.js, seccion-basica.js
 */

/* ══════════════════════════════════════════════════════════════════════════════
   Tipos de documento según TIP_TERC
══════════════════════════════════════════════════════════════════════════════ */

/** COD_TPDOC del NIT en la tabla MAE_TPDOC */
const COD_NIT = 8;

/**
 * Repuebla el select #cod_tpdoc filtrando según el tipo de persona.
 *  · Jurídica (J): muestra solo NIT (COD_TPDOC = 8) y lo auto-selecciona.
 *  · Natural   (N): muestra todos los tipos disponibles.
 *
 * Depende de que '/api/catalogo/tipos-documento?todos=1' ya esté en catalogCache.
 * @param {'J'|'N'} tipTerc
 */
function _repoblarTipoDocumento(tipTerc) {
  const sel = document.getElementById('cod_tpdoc');
  if (!sel) return;

  // Obtener todos los tipos del cache
  // Nota: catalogCache es const global (state.js), NO está en window — no usar window.catalogCache
  const urlKey = new URL('/api/catalogo/tipos-documento?todos=1', window.location.origin).toString();
  const todos  = catalogCache[urlKey] || [];

  const filtrados = tipTerc === 'J'
    ? todos.filter(d => d.COD_TPDOC === COD_NIT)
    : todos;

  sel.innerHTML = '<option value="">— Seleccione —</option>';
  filtrados.forEach(d => {
    const opt = document.createElement('option');
    opt.value       = d.COD_TPDOC;
    opt.textContent = d.NOM_TPDOC;
    sel.appendChild(opt);
  });

  // Agregar opción "Otro tipo" solo en modo Natural
  if (tipTerc === 'N') {
    agregarOpcionOtroAlTipdoc(sel);
  }

  if (tipTerc === 'J' && filtrados.length === 1) {
    sel.value = filtrados[0].COD_TPDOC;
    actualizarFormData('basica', 'COD_TPDOC', filtrados[0].COD_TPDOC);
    // Notificar cambio para que _activarSiblingOtro oculte el campo libre de tipo doc
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    // Limpiar selección al cambiar a Natural
    actualizarFormData('basica', 'COD_TPDOC', null);
    limpiarError('field-cod_tpdoc');
  }
}

/* ══════════════════════════════════════════════════════════════════════════════
   Escritura de estado
══════════════════════════════════════════════════════════════════════════════ */

/**
 * Escribe en formDataNatur.basica[campo].
 * @param {string} campo
 * @param {*}      valor
 */
function actualizarNatur(campo, valor) {
  if (!window.formDataNatur) return;
  formDataNatur.basica[campo] = (valor === '' || valor === undefined) ? null : valor;
}

function onNacioNChange(val) {
  const fld = document.getElementById('field-cod_nacio_n_otro');
  if (!fld) return;
  fld.style.display = val === 'OTRO' ? '' : 'none';
  if (val !== 'OTRO') {
    actualizarNatur('OTR_NACIO', null);
    const inp = document.getElementById('nacio_n_otro_txt');
    if (inp) inp.value = '';
  }
}

function onCiiuNChange(val) {
  const fld = document.getElementById('field-cod_ciiu_n_otro');
  if (!fld) return;
  fld.style.display = val === 'OTRO' ? '' : 'none';
  if (val !== 'OTRO') {
    actualizarNatur('OTR_CIIU', null);
    const inp = document.getElementById('ciiu_n_otro_txt');
    if (inp) inp.value = '';
  }
}

/* ══════════════════════════════════════════════════════════════════════════════
   Conmutador principal
══════════════════════════════════════════════════════════════════════════════ */

/**
 * Cambia el formulario entre modo Jurídica (J) y Natural (N).
 * Muestra/oculta secciones y campos correspondientes.
 * @param {string} val  'J' | 'N'
 */
function onTipTercChange(val) {
  window.modoPersona = val;
  const esN = (val === 'N');

  // ── Título de página ──────────────────────────────────────────────────────
  const h1 = document.querySelector('.page-header h1');
  if (h1) h1.textContent = esN
    ? 'Registro SAGRILAFT — Persona Natural'
    : 'Registro SAGRILAFT — Persona Jurídica';

  // ── Título sección 1 ──────────────────────────────────────────────────────
  const s1label = document.getElementById('section1-label');
  if (s1label) s1label.textContent = esN
    ? 'Información básica de la persona natural'
    : 'Información básica de la empresa';

  // ── Etiqueta Dirección (Sección 1) ────────────────────────────────────────
  const dirLabel = document.getElementById('dir_terc_label');
  if (dirLabel) dirLabel.textContent = esN
    ? 'Dirección'
    : 'Dirección oficina principal';

  // ── Divider de geografía ──────────────────────────────────────────────────
  const divGeo = document.getElementById('divider-geo');
  if (divGeo) divGeo.textContent = esN
    ? 'Lugar de residencia'
    : 'Lugar de domicilio principal';

  // ── Texto del botón Continuar ──────────────────────────────────────────────
  const btnCont = document.getElementById('btn-continuar-basica');
  if (btnCont) btnCont.textContent = esN
    ? 'Continuar → Información financiera'
    : 'Continuar → Sección 2';

  // ── Botón de la sección 12 (Activos Virtuales) ────────────────────────────
  const btnVA = document.getElementById('btn-continuar-va');
  if (btnVA) btnVA.textContent = esN
    ? 'Continuar → Documentos (Secc. 14)'
    : 'Continuar → Sección 13';

  // ── Secciones del acordeón exclusivas de Jurídica ────────────────────────
  ['accordion-rl', 'accordion-sociedad', 'accordion-paises',
   'accordion-cumplimiento', 'accordion-jd', 'accordion-rf',
   'accordion-ac', 'accordion-bf'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = esN ? 'none' : '';
  });

  // ── Campos de Sección 1: solo Jurídica / solo Natural ────────────────────
  document.querySelectorAll('.solo-juridica').forEach(el => {
    el.style.display = esN ? 'none' : '';
  });
  document.querySelectorAll('.solo-natural').forEach(el => {
    el.style.display = esN ? '' : 'none';
  });

  // accordion-bf-n: solo Natural + vinculación laboral (COD_VINC=10)
  const accBfn  = document.getElementById('accordion-bf-n');
  const codVinc = document.getElementById('cod_vinc');
  if (accBfn) accBfn.style.display = (esN && codVinc && String(codVinc.value) === '10') ? '' : 'none';

  // ── Sincronizar TIP_TERC en estado compartido ────────────────────────────
  if (window.formData && window.formData.basica) {
    formData.basica.TIP_TERC = val;
  }

  // ── Limpiar aviso de duplicado ────────────────────────────────────────────
  const aviso = document.getElementById('aviso-duplicado');
  if (aviso) aviso.style.display = 'none';
  window._numIdenBloqueado = false;

  // ── Repoblar select de tipo de documento según persona ───────────────────
  _repoblarTipoDocumento(val);

  // ── Filtrar/reordenar vinculaciones según persona ─────────────────────────
  if (typeof _filtrarVinculaciones === 'function') _filtrarVinculaciones(val);

  // ── Colapsar secciones Jurídica que quedaron abiertas ─────────────────────
  if (esN) {
    ['accordion-rl', 'accordion-sociedad', 'accordion-paises',
     'accordion-cumplimiento', 'accordion-jd', 'accordion-rf',
     'accordion-ac', 'accordion-bf'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('collapsed');
    });
  }

  // ── Ajustar grid para aprovechar el espacio en modo Natural ───────────────
  // Email ocupa el slot que Jurídica usa para "Email SAGRILAFT" → span 2
  const mailField = document.getElementById('field-dir_mail');
  if (mailField) mailField.style.gridColumn = esN ? 'span 2' : '';
  // Nacionalidad y CIIU se distribuyen simétricamente (2 col cada uno)
  // al no existir el campo abierto "Actividad económica principal"
  const nacioNField = document.getElementById('field-cod_nacio_n');
  if (nacioNField) nacioNField.style.gridColumn = esN ? 'span 2' : '';
  const ciiuNField = document.getElementById('field-cod_ciiu_n');
  if (ciiuNField) ciiuNField.style.gridColumn = esN ? 'span 2' : '';

  // ── Tooltip dinámico de "Tipo de persona" ─────────────────────────────────
  const icTipoPersona = document.getElementById('ic-tipo-persona');
  if (icTipoPersona) {
    const tipKey = esN ? 'sec1_tip_natural' : 'sec1_tip_juridica';
    icTipoPersona.setAttribute('data-i18n-tip', tipKey);
    if (typeof t === 'function') icTipoPersona.dataset.tip = t(tipKey) || '';
  }

  console.log('[onTipTercChange] modo =', val);
}

/* ══════════════════════════════════════════════════════════════════════════════
   Parches de funciones de Sección Básica
══════════════════════════════════════════════════════════════════════════════ */

/**
 * Parcha onPaisChange para bifurcar según modoPersona.
 * Natural → escribe en formDataNatur.basica
 * Jurídica → comportamiento original
 */
(function patchOnPaisChange() {
  const _orig = window.onPaisChange;
  window.onPaisChange = async function (codPais) {
    if (window.modoPersona !== 'N') {
      return _orig && _orig(codPais);
    }
    // ── Modo Natural ────────────────────────────────────────────────────────
    actualizarNatur('COD_PAIS_EXP', codPais);
    actualizarNatur('COD_DEPT_EXP', null);
    actualizarNatur('COD_MPIO_EXP', null);
    limpiarError('field-cod_pais_exp');

    const selDept = document.getElementById('cod_dept_exp');
    const selMpio = document.getElementById('cod_mpio_exp');
    selMpio.innerHTML = '<option value="">' + (typeof t==='function'?t('select_first_dept'):'— Seleccione departamento primero —') + '</option>';
    selMpio.disabled  = true;

    if (!codPais) {
      selDept.innerHTML = '<option value="">' + (typeof t==='function'?t('select_first_country'):'— Seleccione país primero —') + '</option>';
      selDept.disabled  = true;
      return;
    }
    if (codPais === COD_COLOMBIA) {
      selDept.disabled = false;
      await cargarCatalogo(
        '/api/catalogo/departamentos', 'cod_dept_exp',
        'COD_DEPT', 'NOM_DEPT', 'select_ph_dept',
        { cod_pais: codPais }
      );
    } else {
      selDept.innerHTML = '<option value="NA">' + t('no_aplica') + '</option>';
      selDept.value     = 'NA';
      selDept.disabled  = true;
      actualizarNatur('COD_DEPT_EXP', 'NA');
      selMpio.disabled  = false;
      await cargarCatalogo(
        '/api/catalogo/ciudades', 'cod_mpio_exp',
        'COD_MUNI', 'NOM_MUNI', 'select_ph_ciudad',
        { cod_pais: codPais }
      );
      selMpio.onchange = e => {
        actualizarNatur('COD_MPIO_EXP', e.target.value);
        limpiarError('field-cod_mpio_exp');
      };
    }
  };
})();

/**
 * Parcha onDeptChange para bifurcar según modoPersona.
 */
(function patchOnDeptChange() {
  const _orig = window.onDeptChange;
  window.onDeptChange = async function (codDept) {
    if (window.modoPersona !== 'N') {
      return _orig && _orig(codDept);
    }
    // ── Modo Natural ────────────────────────────────────────────────────────
    actualizarNatur('COD_DEPT_EXP', codDept);
    actualizarNatur('COD_MPIO_EXP', null);
    limpiarError('field-cod_dept_exp');

    const selMpio = document.getElementById('cod_mpio_exp');
    const codPais = document.getElementById('cod_pais_exp').value;
    selMpio.innerHTML = '<option value="">Cargando ciudades…</option>';
    selMpio.disabled  = true;
    if (!codDept || !codPais) return;

    await cargarCatalogo(
      '/api/catalogo/ciudades', 'cod_mpio_exp',
      'COD_MUNI', 'NOM_MUNI', 'select_ph_ciudad',
      { cod_dept: codDept, cod_pais: codPais }
    );
    selMpio.disabled = false;
    selMpio.onchange = e => {
      actualizarNatur('COD_MPIO_EXP', e.target.value);
      limpiarError('field-cod_mpio_exp');
    };
  };
})();

/**
 * Parcha validarYContinuar para bifurcar según modoPersona.
 * Se aplica después de que seccion-basica.js ya definió la función original.
 */
(function patchValidarYContinuar() {
  const _orig = window.validarYContinuar;
  window.validarYContinuar = function () {
    if (window.modoPersona === 'N') {
      validarYContinuarBasicaNatural();
    } else {
      if (typeof _orig === 'function') _orig();
    }
  };
})();

/* ══════════════════════════════════════════════════════════════════════════════
   CIIU Natural
══════════════════════════════════════════════════════════════════════════════ */

/**
 * Detecta si el texto escrito en el input coincide con el datalist
 * y guarda el código CIIU en formDataNatur.basica.
 * @param {string} valor  Texto actual del input
 */
function onCiiuInputNatur(valor) {
  const opts  = Array.from(document.getElementById('lista-ciiu-n').options);
  const match = opts.find(o => o.value === valor);
  actualizarNatur('COD_CIIU', match ? match.dataset.cod : null);
}

/* ══════════════════════════════════════════════════════════════════════════════
   Validación
══════════════════════════════════════════════════════════════════════════════ */

/**
 * Valida los campos requeridos de la Sección 1 en modo Persona Natural.
 * @returns {boolean}
 */
function validarNaturBasica() {
  let ok = true;
  const n  = formDataNatur.basica;  // campos exclusivos de Natural
  const db = formData.basica;       // campos compartidos (COD_VINC, NUM_IDEN…)

  const req = [
    { fieldId: 'field-cod_vinc',     valor: db.COD_VINC      },
    { fieldId: 'field-cod_tpdoc',    valor: db.COD_TPDOC     },
    { fieldId: 'field-num_iden',     valor: db.NUM_IDEN      },
    { fieldId: 'field-nom_terc_n',   valor: n.NOM_TERC       },
    { fieldId: 'field-ape_terc_n',   valor: n.APE_TERC       },
    { fieldId: 'field-cod_pais_exp', valor: n.COD_PAIS_EXP   },
    { fieldId: 'field-cod_dept_exp', valor: n.COD_DEPT_EXP   },
    { fieldId: 'field-cod_mpio_exp', valor: n.COD_MPIO_EXP   },
    { fieldId: 'field-dir_terc',     valor: db.DIR_TERC      },
    { fieldId: 'field-tel_terc',     valor: db.TEL_TERC      },
    { fieldId: 'field-fec_expe_n',   valor: n.FEC_EXPE       },
    { fieldId: 'field-cod_nacio_n',  valor: n.COD_NACIO      },
    { fieldId: 'field-cod_ciiu_n',   valor: n.COD_CIIU       },
  ];

  req.forEach(({ fieldId, valor }) => {
    if (!valor || String(valor).trim() === '') {
      mostrarError(fieldId);
      ok = false;
    }
  });

  if (!db.DIR_MAIL || !esEmailValido(db.DIR_MAIL)) {
    mostrarError('field-dir_mail');
    ok = false;
  }

  return ok;
}

/* ══════════════════════════════════════════════════════════════════════════════
   Botón Continuar — modo Natural
══════════════════════════════════════════════════════════════════════════════ */

function validarYContinuarBasicaNatural() {
  if (window._numIdenBloqueado) {
    document.getElementById('accordion-basica').classList.remove('collapsed');
    mostrarToast('Este número ya existe. Use la opción "Actualizar registro".', 'error');
    return;
  }
  if (!validarNaturBasica()) {
    document.getElementById('accordion-basica').classList.remove('collapsed');
    const errCount = document.querySelectorAll('#accordion-basica .field.error').length;
    mostrarToast(t('toast_fields_missing').replace('{n}', errCount), 'error');
    const primerError = document.querySelector('#accordion-basica .field.error');
    if (primerError) primerError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  mostrarToast('Sección 1 completa. Continúe con la información financiera.', 'success');
  document.getElementById('accordion-basica').classList.add('collapsed');
  const accFin = document.getElementById('accordion-financiera');
  if (accFin) {
    accFin.classList.remove('collapsed');
    accFin.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  console.log('✅ formDataNatur.basica:', JSON.stringify(formDataNatur.basica, null, 2));
}

/* ══════════════════════════════════════════════════════════════════════════════
   Inicialización de catálogos exclusivos de Natural
══════════════════════════════════════════════════════════════════════════════ */

/**
 * Carga los catálogos necesarios solo para el modo Persona Natural.
 * Se llama desde app.js en paralelo con los demás catálogos.
 */
async function inicializarNaturBasica() {
  await Promise.all([
    // Nacionalidad — reutiliza el catálogo de países (ya en cache)
    cargarCatalogo(
      '/api/catalogo/paises', 'cod_nacio_n',
      'COD_PAIS', 'NOM_PAIS', 'select_placeholder'
    ),
    // CIIU para Natural — select buscable, mismo catálogo que Jurídica
    cargarCatalogo(
      '/api/catalogo/ciiu', 'cod_ciiu_n',
      'COD_CIIU', 'NOM_CIIU', 'select_ph_act',
      {}, d => `${d.COD_CIIU} — ${d.NOM_CIIU}`
    ).then(() => {
      const sel = document.getElementById('cod_ciiu_n');
      if (sel && !sel.querySelector('option[value="OTRO"]')) {
        const opt = document.createElement('option');
        opt.value = 'OTRO'; opt.textContent = 'Otro CIIU (no listado)';
        sel.appendChild(opt);
      }
    }),
  ]);
}

/* Nota: onCiiuInputNatur() ya no se usa — CIIU pasó de datalist a select. */
function onCiiuInputNatur() { /* obsoleto — mantenido por compatibilidad */ }

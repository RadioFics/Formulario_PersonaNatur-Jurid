/**
 * seccion-basica.js — Lógica de la Sección 1: "Información básica de la empresa"
 *
 * Contiene:
 *  · actualizarFormData()   — escritura genérica en formData[seccion]
 *  · onPaisChange()         — cascada País → Departamento → Ciudad (sección 1)
 *  · onDeptChange()         — cascada Departamento → Ciudad (sección 1)
 *  · onCiiuInput()          — match del datalist CIIU al escribir
 *  · validarSeccionBasica() — valida campos requeridos de la sección
 *  · validarYContinuar()    — botón "Continuar → Sección 2"
 *  · limpiarSeccionBasica() — botón "Limpiar sección"
 *
 * Depende de: state.js, utils.js
 */
'use strict';

/* ── Estado ─────────────────────────────────────────────────────────────────── */

/**
 * Escribe un valor en formData[seccion][campo].
 * Convierte cadenas vacías a null para mantener el estado limpio.
 *
 * @param {string} seccion  Clave de sección, p.ej. 'basica'
 * @param {string} campo    Nombre del campo de BD, p.ej. 'COD_PAIS_EXP'
 * @param {*}      valor
 */
function actualizarFormData(seccion, campo, valor) {
  if (!formData[seccion]) formData[seccion] = {};
  formData[seccion][campo] = valor === '' ? null : valor;
}

/* ── Cascada geográfica (Sección 1) ─────────────────────────────────────────── */

/**
 * Reacciona al cambio de País en la sección básica.
 * Resetea y recarga Departamento y Ciudad.
 *
 * @param {string} codPais  Valor del <select> de país
 */
async function onPaisChange(codPais) {
  actualizarFormData('basica', 'COD_PAIS_EXP', codPais);
  actualizarFormData('basica', 'COD_DEPT_EXP', null);
  actualizarFormData('basica', 'COD_MPIO_EXP', null);

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
    // País extranjero: Departamento no aplica
    selDept.innerHTML = '<option value="NA">' + t('no_aplica') + '</option>';
    selDept.value     = 'NA';
    selDept.disabled  = true;
    actualizarFormData('basica', 'COD_DEPT_EXP', 'NA');

    // Ciudades directamente por país
    selMpio.disabled = false;
    await cargarCatalogo(
      '/api/catalogo/ciudades', 'cod_mpio_exp',
      'COD_MUNI', 'NOM_MUNI', 'select_ph_ciudad',
      { cod_pais: codPais }
    );
    if (_autoNoAplicaCiudad(selMpio)) {
      actualizarFormData('basica', 'COD_MPIO_EXP', 'NA');
    } else {
      selMpio.onchange = (e) => {
        actualizarFormData('basica', 'COD_MPIO_EXP', e.target.value);
        limpiarError('field-cod_mpio_exp');
      };
    }
  }
}

/**
 * Reacciona al cambio de Departamento en la sección básica.
 * Recarga el listado de ciudades.
 *
 * @param {string} codDept
 */
async function onDeptChange(codDept) {
  actualizarFormData('basica', 'COD_DEPT_EXP', codDept);
  actualizarFormData('basica', 'COD_MPIO_EXP', null);

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
  selMpio.onchange = (e) => {
    actualizarFormData('basica', 'COD_MPIO_EXP', e.target.value);
    limpiarError('field-cod_mpio_exp');
  };
}

/* ── CIIU ───────────────────────────────────────────────────────────────────── */

/**
 * Detecta si el texto escrito en el input CIIU coincide con alguna opción del
 * datalist y extrae el código para guardarlo en estado.
 *
 * @param {string} valor  Texto actual del input
 */
/* onCiiuInput ya no se usa — CIIU pasó de datalist a select buscable. */
function onCiiuInput() { /* obsoleto — mantenido por compatibilidad */ }

/* ── Validación ─────────────────────────────────────────────────────────────── */

/**
 * Valida todos los campos requeridos de la sección básica.
 * Marca con .error los campos incompletos.
 *
 * @returns {boolean}  true si la sección es válida
 */
function validarSeccionBasica() {
  let ok = true;
  const d = formData.basica;

  const camposReq = [
    { fieldId: 'field-cod_vinc',     valor: d.COD_VINC     },
    { fieldId: 'field-cod_tpdoc',    valor: d.COD_TPDOC    },
    { fieldId: 'field-num_iden',     valor: d.NUM_IDEN     },
    { fieldId: 'field-nom_comp',     valor: d.NOM_COMP     },
    { fieldId: 'field-cod_pais_exp', valor: d.COD_PAIS_EXP },
    { fieldId: 'field-cod_dept_exp', valor: d.COD_DEPT_EXP },
    { fieldId: 'field-cod_mpio_exp', valor: d.COD_MPIO_EXP },
    { fieldId: 'field-dir_terc',     valor: d.DIR_TERC     },
    { fieldId: 'field-tel_terc',     valor: d.TEL_TERC     },
  ];

  camposReq.forEach(({ fieldId, valor }) => {
    if (!valor || String(valor).trim() === '') {
      mostrarError(fieldId);
      ok = false;
    }
  });

  if (!d.DIR_MAIL  || !esEmailValido(d.DIR_MAIL))  { mostrarError('field-dir_mail');  ok = false; }
  if (!d.MAIL_SARL || !esEmailValido(d.MAIL_SARL)) { mostrarError('field-mail_sarl'); ok = false; }
  if (!d.COD_CIIU)                                  { mostrarError('field-cod_ciiu');  ok = false; }

  return ok;
}

/* ── Acciones de botones ────────────────────────────────────────────────────── */

/** Valida la sección y, si es correcta, avanza al acordeón 2. */
function validarYContinuar() {
  if (!validarSeccionBasica()) {
    document.getElementById('accordion-basica').classList.remove('collapsed');
    const errCount = document.querySelectorAll('#accordion-basica .field.error').length;
    mostrarToast(t('toast_fields_missing').replace('{n}', errCount), 'error');
    const primerError = document.querySelector('#accordion-basica .field.error');
    if (primerError) primerError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  mostrarToast('Sección 1 completa. Continúe con la siguiente sección.', 'success');
  document.getElementById('accordion-basica').classList.add('collapsed');
  const acc2 = document.getElementById('accordion-rl');
  acc2.classList.remove('collapsed');
  acc2.scrollIntoView({ behavior: 'smooth', block: 'start' });

  console.log('✅ formData.basica:', JSON.stringify(formData.basica, null, 2));
}

/** Resetea todos los campos de la sección básica al estado inicial. */
function limpiarSeccionBasica() {
  const body = document.querySelector('#accordion-basica .accordion-body');

  body.querySelectorAll('input:not([disabled]), select:not([disabled])').forEach(el => {
    el.tagName === 'SELECT' ? (el.selectedIndex = 0) : (el.value = '');
  });

  Object.keys(formData.basica).forEach(k => {
    formData.basica[k] = k === 'TIP_TERC' ? 'J'
      : (typeof formData.basica[k] === 'string' ? '' : null);
  });

  const selDept = document.getElementById('cod_dept_exp');
  const selMpio = document.getElementById('cod_mpio_exp');
  selDept.innerHTML = '<option value="">' + (typeof t==='function'?t('select_first_country'):'— Seleccione país primero —') + '</option>';
  selDept.disabled  = true;
  selMpio.innerHTML = '<option value="">' + (typeof t==='function'?t('select_first_dept'):'— Seleccione departamento primero —') + '</option>';
  selMpio.disabled  = true;

  body.querySelectorAll('.field.error').forEach(f => f.classList.remove('error'));
  mostrarToast('Sección limpiada.', 'success');
}

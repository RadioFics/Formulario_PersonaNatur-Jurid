/**
 * seccion-rl.js — Lógica de la Sección 2: "Información del representante legal"
 *
 * Contiene:
 *  · actualizarRL()         — escritura en formData.representantes[idx]
 *  · onRLPaisChange()       — cascada País → Dpto → Ciudad (por bloque)
 *  · onRLDeptChange()       — cascada Dpto → Ciudad (por bloque)
 *  · validarBloqueRL()      — valida Principal (siempre) o Suplente (si tocado)
 *  · validarSeccionRL()     — valida ambos bloques
 *  · validarYContinuarRL()  — botón "Continuar → Sección 3"
 *  · limpiarBloqueRL()      — botón "Limpiar sección" (por bloque)
 *
 * Depende de: state.js, utils.js
 *
 * Convención de IDs por bloque:
 *   Principal → prefijo 'rl_p'  (rl_p_pais, rl_p_dept, rl_p_mpio, …)
 *   Suplente  → prefijo 'rl_s'  (rl_s_pais, rl_s_dept, rl_s_mpio, …)
 */
'use strict';

/* ── Estado ─────────────────────────────────────────────────────────────────── */

/**
 * Escribe un valor en formData.representantes[idx][campo].
 * Convierte cadenas vacías a null.
 *
 * @param {number} idx    0 = Principal | 1 = Suplente
 * @param {string} campo  Nombre del campo (p.ej. 'NOM_REPR')
 * @param {*}      valor
 */
function actualizarRL(idx, campo, valor) {
  formData.representantes[idx][campo] = valor === '' ? null : valor;
}

/* ── Cascadas geográficas (independientes por bloque) ───────────────────────── */

/**
 * Reacciona al cambio de País dentro de un bloque RL.
 * Resetea Departamento y Ciudad del mismo bloque (sin afectar el otro).
 *
 * @param {string} codPais  Valor seleccionado en el <select> de país
 * @param {string} prefijo  'rl_p' | 'rl_s'
 * @param {number} idx      0 | 1
 */
async function onRLPaisChange(codPais, prefijo, idx) {
  actualizarRL(idx, 'COD_PAIS', codPais);
  actualizarRL(idx, 'COD_DEPT', null);
  actualizarRL(idx, 'COD_MPIO', null);

  const selDept = document.getElementById(`${prefijo}_dept`);
  const selMpio = document.getElementById(`${prefijo}_mpio`);

  selMpio.innerHTML = '<option value="">— Seleccione departamento primero —</option>';
  selMpio.disabled  = true;
  limpiarError(`field-${prefijo}_dept`);
  limpiarError(`field-${prefijo}_mpio`);

  if (!codPais) {
    selDept.innerHTML = '<option value="">— Seleccione país primero —</option>';
    selDept.disabled  = true;
    return;
  }

  if (codPais === COD_COLOMBIA) {
    selDept.disabled = false;
    await cargarCatalogo(
      '/api/catalogo/departamentos', `${prefijo}_dept`,
      'COD_DEPT', 'NOM_DEPT', '— Seleccione departamento —',
      { cod_pais: codPais }
    );
  } else {
    // País extranjero: Departamento = "No aplica"
    selDept.innerHTML = '<option value="NA">No aplica</option>';
    selDept.value     = 'NA';
    selDept.disabled  = true;
    actualizarRL(idx, 'COD_DEPT', 'NA');

    selMpio.disabled  = false;
    selMpio.innerHTML = '<option value="">Cargando ciudades…</option>';
    await cargarCatalogo(
      '/api/catalogo/ciudades', `${prefijo}_mpio`,
      'COD_MUNI', 'NOM_MUNI', '— Seleccione ciudad —',
      { cod_pais: codPais }
    );
    selMpio.onchange = (e) => {
      actualizarRL(idx, 'COD_MPIO', e.target.value);
      limpiarError(`field-${prefijo}_mpio`);
    };
  }
}

/**
 * Reacciona al cambio de Departamento dentro de un bloque RL.
 * Recarga el listado de ciudades del mismo bloque.
 *
 * @param {string} codDept
 * @param {string} prefijo  'rl_p' | 'rl_s'
 * @param {number} idx      0 | 1
 */
async function onRLDeptChange(codDept, prefijo, idx) {
  actualizarRL(idx, 'COD_DEPT', codDept);
  actualizarRL(idx, 'COD_MPIO', null);

  const selMpio = document.getElementById(`${prefijo}_mpio`);
  const codPais = document.getElementById(`${prefijo}_pais`).value;

  selMpio.innerHTML = '<option value="">Cargando ciudades…</option>';
  selMpio.disabled  = true;

  if (!codDept || !codPais) return;

  await cargarCatalogo(
    '/api/catalogo/ciudades', `${prefijo}_mpio`,
    'COD_MUNI', 'NOM_MUNI', '— Seleccione ciudad —',
    { cod_dept: codDept, cod_pais: codPais }
  );
  selMpio.disabled = false;
  selMpio.onchange = (e) => {
    actualizarRL(idx, 'COD_MPIO', e.target.value);
    limpiarError(`field-${prefijo}_mpio`);
  };
}

/* ── Validación ─────────────────────────────────────────────────────────────── */

/**
 * Valida un bloque RL.
 *
 * - Principal (idx 0): todos los campos requeridos son obligatorios.
 * - Suplente  (idx 1): si ningún campo fue tocado → válido (no se guardará).
 *                      Si al menos un campo fue tocado → se exigen todos.
 *
 * @param {number} idx  0 | 1
 * @returns {boolean}
 */
function validarBloqueRL(idx) {
  const prefijo = idx === 0 ? 'rl_p' : 'rl_s';
  const d       = formData.representantes[idx];

  const camposReq = [
    { fieldId: `field-${prefijo}_nom`,    valor: d.NOM_REPR },
    { fieldId: `field-${prefijo}_ape`,    valor: d.APE_REPR },
    { fieldId: `field-${prefijo}_tipdoc`, valor: d.TIP_DOCU },
    { fieldId: `field-${prefijo}_numdoc`, valor: d.NUM_DOCU },
    { fieldId: `field-${prefijo}_fec`,    valor: d.FEC_EXPE },
    { fieldId: `field-${prefijo}_pais`,   valor: d.COD_PAIS },
    { fieldId: `field-${prefijo}_dept`,   valor: d.COD_DEPT },
    { fieldId: `field-${prefijo}_mpio`,   valor: d.COD_MPIO },
    { fieldId: `field-${prefijo}_dir`,    valor: d.DIR_REPR },
    { fieldId: `field-${prefijo}_cel`,    valor: d.CEL_REPR },
  ];

  // Suplente: si el bloque está completamente intacto → OK sin validar
  if (idx === 1) {
    const alguno = camposReq.some(c => c.valor && String(c.valor).trim() !== '')
                || (d.MAIL_REPR && String(d.MAIL_REPR).trim() !== '')
                || (d.TEL_REPR  && String(d.TEL_REPR).trim()  !== '');
    if (!alguno) return true;
  }

  let ok = true;

  camposReq.forEach(({ fieldId, valor }) => {
    if (!valor || String(valor).trim() === '') {
      mostrarError(fieldId);
      ok = false;
    }
  });

  if (!d.MAIL_REPR || !esEmailValido(d.MAIL_REPR)) {
    mostrarError(`field-${prefijo}_mail`);
    ok = false;
  }

  return ok;
}

/** Valida ambos bloques (Principal obligatorio, Suplente condicional). */
function validarSeccionRL() {
  const okP = validarBloqueRL(0);
  const okS = validarBloqueRL(1);
  return okP && okS;
}

/* ── Acciones de botones ────────────────────────────────────────────────────── */

/** Valida la sección y, si es correcta, avanza al acordeón 3. */
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

/**
 * Resetea un bloque RL completo: DOM + estado + errores visuales.
 *
 * @param {number} idx  0 = Principal | 1 = Suplente
 */
function limpiarBloqueRL(idx) {
  const prefijo  = idx === 0 ? 'rl_p'               : 'rl_s';
  const bloqueId = idx === 0 ? 'rl-bloque-principal' : 'rl-bloque-suplente';
  const bloque   = document.getElementById(bloqueId);

  bloque.querySelectorAll('input, select').forEach(el => {
    el.tagName === 'SELECT' ? (el.selectedIndex = 0) : (el.value = '');
  });

  const selDept = document.getElementById(`${prefijo}_dept`);
  const selMpio = document.getElementById(`${prefijo}_mpio`);
  selDept.innerHTML = '<option value="">— Seleccione país primero —</option>';
  selDept.disabled  = true;
  selMpio.innerHTML = '<option value="">— Seleccione departamento primero —</option>';
  selMpio.disabled  = true;

  formData.representantes[idx] = {
    TIP_REPR: idx === 0 ? 'P' : 'S',
    NOM_REPR: '', APE_REPR: '', TIP_DOCU: null, NUM_DOCU: '',
    FEC_EXPE: '', COD_PAIS: null, COD_DEPT: null, COD_MPIO: null,
    DIR_REPR: '', CEL_REPR: '', TEL_REPR: '', MAIL_REPR: '',
  };

  bloque.querySelectorAll('.field.error').forEach(f => f.classList.remove('error'));
}

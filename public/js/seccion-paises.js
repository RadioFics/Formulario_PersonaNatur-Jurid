/**
 * seccion-paises.js — Sección 4: "Países de operación"
 *
 * Contiene:
 *  · getPaisesData()             — lee la lista de países del cache global
 *  · renderListaPaises()         — dibuja las entradas en el DOM
 *  · onPaisOperacionChange()     — actualiza estado y re-renderiza exclusiones
 *  · agregarPais()               — añade una nueva entrada vacía
 *  · eliminarPais()              — elimina una entrada por índice
 *  · validarSeccionPaises()      — verifica que no haya entradas vacías
 *  · validarYContinuarPaises()   — botón "Continuar → Sección 5"
 *  · limpiarSeccionPaises()      — botón "Limpiar sección"
 *
 * Depende de: state.js, utils.js
 */
'use strict';

/* ── Acceso al catálogo de países ───────────────────────────────────────────── */

/**
 * Devuelve el array de países desde el cache compartido.
 * El cache fue poblado por app.js al inicializar (misma URL que sec1 y sec2).
 * @returns {Array<{COD_PAIS: string, NOM_PAIS: string}>}
 */
function getPaisesData() {
  const cacheKey = new URL('/api/catalogo/paises', window.location.origin).toString();
  return catalogCache[cacheKey] || [];
}

/* ── Renderizado de la lista dinámica ───────────────────────────────────────── */

/**
 * Dibuja todas las entradas de formData.paises en el contenedor HTML.
 * Cada entrada excluye de su desplegable los países ya elegidos en las demás.
 * Reconstruye el DOM completo en cada llamada (lista corta, sin problema de rendimiento).
 */
function renderListaPaises() {
  const container   = document.getElementById('lista-paises-container');
  const todosPaises = getPaisesData();
  const yaElegidos  = formData.paises.map(p => p.COD_PAIS).filter(Boolean);
  const soloUna     = formData.paises.length === 1;

  container.innerHTML = '';

  formData.paises.forEach((entrada, idx) => {
    const entradaCod   = entrada.COD_PAIS != null ? String(entrada.COD_PAIS) : null;
    const elegidosCods = yaElegidos.map(c => String(c));

    const usaEN = document.documentElement.lang === 'en';
    let opciones = `<option value="">${typeof t==='function'?t('select_ph_pais'):'— Seleccione país —'}</option>`;
    todosPaises.forEach(p => {
      const pCod           = String(p.COD_PAIS);
      const ocupadoPorOtro = elegidosCods.includes(pCod) && pCod !== entradaCod;
      if (!ocupadoPorOtro) {
        const sel     = pCod === entradaCod ? ' selected' : '';
        const nomPais = usaEN && p.NOM_EN ? p.NOM_EN : p.NOM_PAIS;
        opciones += `<option value="${pCod}"${sel}>${nomPais}</option>`;
      }
    });

    const esOtro     = entradaCod === 'OTRO';
    const otroPh     = typeof t==='function' ? t('country_name_ph') : 'Nombre del país';
    const otroPaisV  = entrada.OTR_PAIS || '';

    const fila = document.createElement('div');
    fila.className = 'pais-entry';
    fila.id        = `pais-entry-${idx}`;
    fila.innerHTML = `
      <div class="field pais-entry-field" id="field-pais_op_${idx}">
        <select id="pais_op_${idx}"
                onchange="onPaisOperacionChange(${idx}, this.value)">
          ${opciones}
        </select>
        <input type="text" id="pais_op_${idx}_otro" maxlength="100"
               style="display:${esOtro ? '' : 'none'};margin-top:6px"
               placeholder="${otroPh}"
               value="${otroPaisV.replace(/"/g, '&quot;')}"
               oninput="onPaisOpOtroInput(${idx}, this.value)" />
        <span class="error-msg" data-i18n="sec4_err_pais">${typeof t==='function'?t('sec4_err_pais'):'Seleccione un país'}</span>
      </div>
      <button class="btn-eliminar-pais"
              onclick="eliminarPais(${idx})"
              ${soloUna ? 'disabled' : ''}
              title="Eliminar entrada">✕</button>
    `;
    container.appendChild(fila);
  });
}

/** Actualiza OTR_PAIS para una entrada de la lista de países. */
function onPaisOpOtroInput(idx, valor) {
  if (formData.paises[idx]) formData.paises[idx].OTR_PAIS = valor || '';
}

/* ── Manejadores de eventos ─────────────────────────────────────────────────── */

/**
 * Se llama cuando el usuario cambia el país de una entrada.
 * Actualiza el estado y re-renderiza la lista para recalcular exclusiones.
 *
 * @param {number} idx    Índice de la entrada en formData.paises
 * @param {string} valor  COD_PAIS seleccionado ('' si vacío)
 */
function onPaisOperacionChange(idx, valor) {
  formData.paises[idx].COD_PAIS = valor ? String(valor) : null;
  if (valor !== 'OTRO') formData.paises[idx].OTR_PAIS = '';
  limpiarError(`field-pais_op_${idx}`);
  renderListaPaises();   // recalcula exclusiones en todas las entradas
}

/**
 * Agrega una nueva entrada vacía al final de la lista y desplaza la vista.
 */
function agregarPais() {
  formData.paises.push({ COD_PAIS: null, OTR_PAIS: '' });
  renderListaPaises();

  // Scroll suave hasta la nueva entrada
  const container = document.getElementById('lista-paises-container');
  if (container.lastElementChild) {
    container.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

/**
 * Elimina la entrada en la posición `idx`.
 * No permite eliminar si solo queda una entrada.
 *
 * @param {number} idx
 */
function eliminarPais(idx) {
  if (formData.paises.length <= 1) return;
  formData.paises.splice(idx, 1);
  renderListaPaises();
}

/* ── Validación ─────────────────────────────────────────────────────────────── */

/**
 * Verifica que todas las entradas tengan un país seleccionado.
 * Marca con error las que estén vacías.
 *
 * @returns {boolean}
 */
function validarSeccionPaises() {
  let ok = true;
  formData.paises.forEach((entrada, idx) => {
    if (!entrada.COD_PAIS) {
      mostrarError(`field-pais_op_${idx}`);
      ok = false;
    } else if (entrada.COD_PAIS === 'OTRO' && !entrada.OTR_PAIS) {
      mostrarError(`field-pais_op_${idx}`);
      ok = false;
    }
  });
  return ok;
}

/* ── Acciones de botones ────────────────────────────────────────────────────── */

/** Valida la sección y, si es correcta, avanza al acordeón 5. */
function validarYContinuarPaises() {
  if (!validarSeccionPaises()) {
    document.getElementById('accordion-paises').classList.remove('collapsed');
    mostrarToast(typeof t==='function'?t('sec4_err_pais_vacia'):'Seleccione un país en cada entrada o elimine las vacías.', 'error');
    const primerError = document.querySelector('#accordion-paises .field.error');
    if (primerError) primerError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  mostrarToast(typeof t==='function'?t('toast_sec_ok'):'Sección 4 completa.', 'success');
  document.getElementById('accordion-paises').classList.add('collapsed');
  const acc5 = document.getElementById('accordion-cumplimiento');
  acc5.classList.remove('collapsed');
  acc5.scrollIntoView({ behavior: 'smooth', block: 'start' });
  console.log('✅ formData.paises:', JSON.stringify(formData.paises, null, 2));
}

/** Resetea la lista a una sola entrada vacía. */
function limpiarSeccionPaises() {
  formData.paises = [{ COD_PAIS: null, OTR_PAIS: '' }];
  renderListaPaises();
  mostrarToast(typeof t==='function'?t('toast_sec_clear'):'Sección limpiada.', 'success');
}

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
    // Normalizar a string para evitar discrepancias de tipo entre el DOM (siempre string)
    // y los valores del cache (pueden ser number si la columna SQL es INT/NUMERIC).
    const entradaCod   = entrada.COD_PAIS != null ? String(entrada.COD_PAIS) : null;
    const elegidosCods = yaElegidos.map(c => String(c));

    // Construir opciones: incluir el propio valor + los no elegidos en otras entradas
    let opciones = '<option value="">— Seleccione país —</option>';
    todosPaises.forEach(p => {
      const pCod         = String(p.COD_PAIS);
      const ocupadoPorOtro = elegidosCods.includes(pCod) && pCod !== entradaCod;
      if (!ocupadoPorOtro) {
        const sel = pCod === entradaCod ? ' selected' : '';
        opciones += `<option value="${pCod}"${sel}>${p.NOM_PAIS}</option>`;
      }
    });

    const fila = document.createElement('div');
    fila.className = 'pais-entry';
    fila.id        = `pais-entry-${idx}`;
    fila.innerHTML = `
      <div class="field pais-entry-field" id="field-pais_op_${idx}">
        <select id="pais_op_${idx}"
                onchange="onPaisOperacionChange(${idx}, this.value)">
          ${opciones}
        </select>
        <span class="error-msg">Seleccione un país</span>
      </div>
      <button class="btn-eliminar-pais"
              onclick="eliminarPais(${idx})"
              ${soloUna ? 'disabled' : ''}
              title="Eliminar entrada">✕</button>
    `;
    container.appendChild(fila);
  });
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
  // Normaliza a string para mantener consistencia con DOM (siempre string)
  formData.paises[idx].COD_PAIS = valor ? String(valor) : null;
  limpiarError(`field-pais_op_${idx}`);
  renderListaPaises();   // recalcula exclusiones en todas las entradas
}

/**
 * Agrega una nueva entrada vacía al final de la lista y desplaza la vista.
 */
function agregarPais() {
  formData.paises.push({ COD_PAIS: null });
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
    }
  });
  return ok;
}

/* ── Acciones de botones ────────────────────────────────────────────────────── */

/** Valida la sección y, si es correcta, avanza al acordeón 5. */
function validarYContinuarPaises() {
  if (!validarSeccionPaises()) {
    document.getElementById('accordion-paises').classList.remove('collapsed');
    mostrarToast('Seleccione un país en cada entrada o elimine las vacías.', 'error');
    const primerError = document.querySelector('#accordion-paises .field.error');
    if (primerError) primerError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  mostrarToast('Sección 4 completa. Continúe con la siguiente sección.', 'success');
  document.getElementById('accordion-paises').classList.add('collapsed');
  const acc5 = document.getElementById('accordion-cumplimiento');
  acc5.classList.remove('collapsed');
  acc5.scrollIntoView({ behavior: 'smooth', block: 'start' });
  console.log('✅ formData.paises:', JSON.stringify(formData.paises, null, 2));
}

/** Resetea la lista a una sola entrada vacía. */
function limpiarSeccionPaises() {
  formData.paises = [{ COD_PAIS: null }];
  renderListaPaises();
  mostrarToast('Sección limpiada.', 'success');
}

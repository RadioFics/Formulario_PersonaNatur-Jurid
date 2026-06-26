/**
 * app.js — Punto de entrada y arranque de la aplicación SAGRILAFT
 *
 * Responsabilidades:
 *  · Cargar todos los catálogos iniciales al arrancar la página
 *  · Registrar el listener DOMContentLoaded
 *
 * Patrón para agregar nuevas secciones:
 *  1. Crear public/js/seccion-<nombre>.js con la lógica de esa sección.
 *  2. Referenciar el nuevo script en index.html (antes de app.js).
 *  3. Agregar las llamadas a cargarCatalogo() necesarias en inicializar().
 *
 * Depende de: state.js, utils.js, seccion-basica.js, seccion-rl.js,
 *             seccion-sociedad.js, seccion-paises.js, seccion-cumplimiento.js,
 *             seccion-jd.js, seccion-rf.js, seccion-ac.js,
 *             seccion-financiera.js, seccion-bancaria.js, seccion-pep.js,
 *             guardar.js
 * (debe cargarse ÚLTIMO entre los scripts JS)
 */
'use strict';

/**
 * Carga en paralelo todos los catálogos que necesita el formulario al abrir.
 * Cada sección declara aquí sus peticiones de catálogo iniciales.
 */
async function inicializar() {
  showLoading(true);
  try {
    await Promise.all([

      // ── Sección 1: Información básica ──────────────────────────────────────

      // Tipo de documento — carga TODOS los tipos; se filtra según TIP_TERC (J/N)
      // en _repoblarTipoDocumento() (seccion-natur-basica.js).
      // Al arrancar siempre estamos en modo Jurídica → pre-seleccionar NIT (COD_TPDOC=8).
      cargarCatalogo(
        '/api/catalogo/tipos-documento?todos=1', 'cod_tpdoc',
        'COD_TPDOC', 'NOM_TPDOC', 'select_placeholder'
      ).then(() => {
        // Modo inicial = Jurídica → mostrar solo NIT y auto-seleccionar
        _repoblarTipoDocumento('J');
      }),

      // Tipos de vinculación — se filtra/reordena tras cargar según modoPersona
      cargarCatalogo(
        '/api/catalogo/vinculaciones', 'cod_vinc',
        'COD_VINC', 'NOM_VINC', 'select_ph_vinc'
      ).then(() => _filtrarVinculaciones('J')),

      // Países (Colombia primero)
      cargarCatalogo(
        '/api/catalogo/paises', 'cod_pais_exp',
        'COD_PAIS', 'NOM_PAIS', 'select_ph_pais'
      ),

      // Actividades CIIU — solo jurídicas (excluye códigos 00XX de personas naturales)
      cargarCatalogo(
        '/api/catalogo/ciiu', 'cod_ciiu',
        'COD_CIIU', 'NOM_CIIU', 'select_ph_act',
        { tipo: 'J' }, d => `${d.COD_CIIU} — ${d.NOM_CIIU}`
      ).then(() => {
        const sel = document.getElementById('cod_ciiu');
        if (sel && !sel.querySelector('option[value="OTRO"]')) {
          const opt = document.createElement('option');
          opt.value = 'OTRO'; opt.textContent = 'Otro CIIU (no listado)';
          sel.appendChild(opt);
        }
      }),

      // ── Sección 2: Representante Legal ─────────────────────────────────────

      // Tipos de documento (todos) — Principal
      cargarCatalogo(
        '/api/catalogo/tipos-documento?todos=1', 'rl_p_tipdoc',
        'COD_TPDOC', 'NOM_TPDOC', 'select_placeholder'
      ).then(() => {
        agregarOpcionOtroAlTipdoc('rl_p_tipdoc');
      }),

      // Países — Principal
      cargarCatalogo(
        '/api/catalogo/paises', 'rl_p_pais',
        'COD_PAIS', 'NOM_PAIS', 'select_placeholder'
      ),

      // Países para el desplegable del campo "País" en sección 3
      cargarCatalogo(
        '/api/catalogo/paises', 'soc_pais',
        'COD_PAIS', 'NOM_PAIS', 'select_ph_pais'
      ),

      // País de origen — visible solo cuando Ubicación = Sucursal en Colombia
      cargarCatalogo(
        '/api/catalogo/paises', 'soc_pais_orig',
        'COD_PAIS', 'NOM_PAIS', 'select_ph_pais'
      ),

      // ── Sección 5: Sistema de cumplimiento ────────────────────────────────
      // Carga los checkboxes de sistemas de prevención.
      cargarCheckboxesSisPrev(),
      // Los campos de oficiales son dinámicos (renderListaCump); no hay IDs estáticos.

      // ── Secciones 6–8 (JD / RF / AC) ─────────────────────────────────────
      // Los catálogos de tipos-documento y paises ya están en cache desde
      // las secciones anteriores. getOpcionesHTML() los lee sin petición extra.

      // ── Sección 10: Bancaria ──────────────────────────────────────────────
      // Pre-carga bancos y tipos de cuenta en cache (sin DOM destino).
      // renderListaBancaria() los usa vía getOpcionesHTML() al crear grupos.
      preCargarCatalogo('/api/catalogo/bancos'),
      preCargarCatalogo('/api/catalogo/tipos-cuenta'),
      // Tipos de documento SIN ?todos=1 → solo NIT; usado por los filtros
      // de tipo persona en secciones 7 (RF), 8 (AC) y 12 (BF) al cambiar a Jurídica.
      preCargarCatalogo('/api/catalogo/tipos-documento'),

      // ── Persona Natural: catálogos exclusivos ────────────────────────────
      // Nacionalidad (cod_nacio_n) y CIIU select para Natural.
      // inicializarNaturBasica() está en seccion-natur-basica.js.
      inicializarNaturBasica(),

      // Tipos de documento para sección 9N: solo NIT + "Sin asignar / Otro tipo"
      cargarCatalogo(
        '/api/catalogo/tipos-documento', 'bfn_tip_doc_soc',
        'COD_TPDOC', 'NOM_TPDOC', 'select_placeholder'
      ).then(() => {
        agregarOpcionOtroAlTipdoc('bfn_tip_doc_soc');
      }),

      // Moneda de reporte — sección 9 Financiera
      cargarCatalogo(
        '/api/catalogo/monedas', 'fin_moneda',
        'COD_MONE', 'NOM_MONE', 'select_placeholder'
      ).then(() => {
        const sel = document.getElementById('fin_moneda');
        if (!sel) return;
        const cacheKey = new URL('/api/catalogo/monedas', window.location.origin).toString();
        const rows = catalogCache[cacheKey] || [];
        Array.from(sel.options).forEach(opt => {
          const row = rows.find(r => String(r.COD_MONE) === opt.value);
          if (row && row.INI_MONE) opt.dataset.ini = String(row.INI_MONE).trim();
        });
        sel.value = '20';
        if (typeof onFinMonedaChange === 'function') onFinMonedaChange('20', 'COP');
      }),

    ]);
  } catch (err) {
    console.error('Error en inicializar():', err);
    mostrarToast('Error al cargar los catálogos. Verifique la conexión.', 'error');
  } finally {
    showLoading(false);
    // Detectar catálogos críticos que fallaron y ofrecer reintento
    _verificarCatalogosCriticos();
  }
}

/**
 * Revisa si algún select crítico quedó en estado de error tras la carga inicial.
 * Si detecta fallos, inserta un banner prominente con botón de reintento.
 */
function _verificarCatalogosCriticos() {
  const criticos = ['cod_tpdoc', 'cod_vinc', 'cod_pais_exp'];
  const fallidos = criticos.filter(id => {
    const sel = document.getElementById(id);
    return sel && sel.options.length === 1 && sel.options[0].textContent.includes('Error');
  });

  if (!fallidos.length) return;

  const banner = document.createElement('div');
  banner.id = 'banner-error-catalogo';
  banner.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:9999',
    'background:#dc3545', 'color:#fff', 'padding:12px 20px',
    'display:flex', 'align-items:center', 'gap:16px',
    'font-size:.9rem', 'font-weight:500', 'box-shadow:0 2px 8px rgba(0,0,0,.25)',
  ].join(';');
  banner.innerHTML = `
    <span>⚠ No se pudieron cargar algunos campos del formulario. Verifique la conexión con el servidor.</span>
    <button onclick="location.reload()" style="
      background:#fff;color:#dc3545;border:none;padding:6px 14px;
      border-radius:4px;font-weight:700;cursor:pointer;white-space:nowrap
    ">↻ Reintentar</button>
    <button onclick="document.getElementById('banner-error-catalogo').remove()" style="
      background:transparent;color:#fff;border:1px solid rgba(255,255,255,.5);
      padding:4px 10px;border-radius:4px;cursor:pointer;margin-left:auto
    ">✕</button>
  `;
  document.body.prepend(banner);
}

/* ── Campos "Otros" — activar después de hidratar ──────────────────────────── */
function _activarCamposOtros() {
  _activarSiblingOtro('cod_vinc',       'row-vinc-otro',               () => {
    actualizarFormData('basica', 'OTR_VINC', null);
    const el = document.getElementById('otr_vinc'); if (el) el.value = '';
  });

  _activarSiblingOtro('cod_tpdoc',      'cod_tpdoc_otro',              () => {
    actualizarFormData('basica', 'OTR_TPDOC', null);
    const el = document.getElementById('cod_tpdoc_otro'); if (el) el.value = '';
  });

  _activarSiblingOtro('cod_ciiu',       'field-cod_ciiu_otro',         () => {
    actualizarFormData('basica', 'OTR_CIIU', null);
    const el = document.getElementById('otr_ciiu'); if (el) el.value = '';
  });

  _activarSiblingOtro('cod_ciiu_n',     'field-cod_ciiu_n_otro',       () => {
    if (typeof actualizarNatur === 'function') actualizarNatur('OTR_CIIU', null);
    const el = document.getElementById('ciiu_n_otro_txt'); if (el) el.value = '';
  });

  _activarSiblingOtro('cod_nacio_n',    'field-cod_nacio_n_otro',      () => {
    if (typeof actualizarNatur === 'function') actualizarNatur('OTR_NACIO', null);
    const el = document.getElementById('nacio_n_otro_txt'); if (el) el.value = '';
  });

  _activarSiblingOtro('rl_p_tipdoc',   'rl_p_tipdoc_otro',            () => {
    actualizarRL(0, 'OTR_TPDOC', null);
    const el = document.getElementById('rl_p_tipdoc_otro'); if (el) el.value = '';
  });

  _activarSiblingOtro('bfn_tip_doc_soc', 'bfn_tip_doc_soc_otro',      () => {
    if (typeof actualizarBFN === 'function') actualizarBFN('OTR_TIP_DOC_SOC', null);
    const el = document.getElementById('bfn_tip_doc_soc_otro'); if (el) el.value = '';
  });

  // cump_sis_preve — checkboxes: cargarCheckboxesSisPrev() restaura el estado
  // desde formData.cumplimiento.SIS_PREVE al renderizar.
  // No se necesita acción adicional aquí.
}

/* ── "Otro país" — inyectar opción en todos los selects de país ─────────────── */

/**
 * Añade la opción "Otro país (no listado)" al cache de países y a todos los
 * <select> de países ya presentes en el DOM. Los grupos dinámicos (BF, bancaria)
 * la recibirán automáticamente vía getOpcionesHTML() al ser creados.
 */
function _agregarOtroPais() {
  const cacheKey = new URL('/api/catalogo/paises', window.location.origin).toString();
  if (catalogCache[cacheKey]) {
    // Eliminar entradas de BD que comiencen con "Otro/Other" para evitar duplicados
    catalogCache[cacheKey] = catalogCache[cacheKey].filter(
      p => !/^otro|^other/i.test((p.NOM_PAIS || '').trim())
    );
    if (!catalogCache[cacheKey].find(p => p.COD_PAIS === 'OTRO')) {
      catalogCache[cacheKey].push({ COD_PAIS: 'OTRO', NOM_PAIS: 'Otro pa\xEDs (no listado)', NOM_EN: 'Other country (not listed)' });
    }
  }
  ['cod_pais_exp', 'rl_p_pais', 'soc_pais', 'soc_pais_orig', 'cod_nacio_n'].forEach(agregarOpcionOtroAlSelect);
}

/**
 * Manejador del selector de país principal (sección 1).
 * Intercepta el valor 'OTRO' para suprimir la cascada geográfica.
 * @param {string} v  Valor del select
 */
function _handlePaisExpChange(v) {
  const fieldOtro = document.getElementById('field-pais_exp_otro');
  const fieldDept = document.getElementById('field-cod_dept_exp');
  const fieldMpio = document.getElementById('field-cod_mpio_exp');
  if (v === 'OTRO') {
    if (fieldDept) fieldDept.style.display = 'none';
    if (fieldMpio) fieldMpio.style.display = 'none';
    if (fieldOtro) { fieldOtro.style.display = ''; fieldOtro.style.gridColumn = 'span 2'; }
    actualizarFormData('basica', 'COD_PAIS_EXP', 'OTRO');
    actualizarFormData('basica', 'COD_DEPT_EXP', null);
    actualizarFormData('basica', 'COD_MPIO_EXP', null);
    if (typeof actualizarNatur === 'function') {
      actualizarNatur('COD_PAIS_EXP', 'OTRO');
      actualizarNatur('COD_DEPT_EXP', null);
      actualizarNatur('COD_MPIO_EXP', null);
    }
  } else {
    if (fieldOtro) {
      fieldOtro.style.display = 'none';
      fieldOtro.style.gridColumn = '';
      actualizarFormData('basica', 'OTR_PAIS_EXP', null);
      if (typeof actualizarNatur === 'function') actualizarNatur('OTR_PAIS_EXP', null);
      const inp = document.getElementById('pais_exp_otro_txt');
      if (inp) inp.value = '';
    }
    if (fieldDept) fieldDept.style.display = '';
    if (fieldMpio) fieldMpio.style.display = '';
    onPaisChange(v);
  }
}

/* ── Filtrado y orden de vinculaciones según tipo de persona ────────────────── */

/**
 * Reordena y filtra las opciones del select #cod_vinc según modoPersona.
 * Jurídica: elimina "Vinculación laboral", ordena alfabéticamente, "Cliente" al final.
 * Natural: restaura todas las opciones en el orden original de la API.
 * @param {'J'|'N'} tipTerc
 */
function _filtrarVinculaciones(tipTerc) {
  const sel = document.getElementById('cod_vinc');
  if (!sel) return;

  const cacheKey = new URL('/api/catalogo/vinculaciones', window.location.origin).toString();
  const todos    = catalogCache[cacheKey] || [];
  if (!todos.length) return;

  const valActual = sel.value;
  const _t = key => (typeof t === 'function' ? t(key) || key : key);

  sel.innerHTML = `<option value="">${_t('select_ph_vinc')}</option>`;

  if (tipTerc === 'J') {
    const sinLaboralYCliente = todos.filter(d => d.COD_VINC !== 10 && d.COD_VINC !== 3);
    sinLaboralYCliente.sort((a, b) => {
      const na = (window._currentLang === 'en' && a.NOM_EN) ? a.NOM_EN : a.NOM_VINC;
      const nb = (window._currentLang === 'en' && b.NOM_EN) ? b.NOM_EN : b.NOM_VINC;
      return na.localeCompare(nb, 'es');
    });
    const cliente = todos.find(d => d.COD_VINC === 3);
    const ordenados = cliente ? [...sinLaboralYCliente, cliente] : sinLaboralYCliente;
    ordenados.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.COD_VINC;
      opt.textContent = (window._currentLang === 'en' && d.NOM_EN) ? d.NOM_EN : d.NOM_VINC;
      sel.appendChild(opt);
    });
  } else {
    todos.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.COD_VINC;
      opt.textContent = (window._currentLang === 'en' && d.NOM_EN) ? d.NOM_EN : d.NOM_VINC;
      sel.appendChild(opt);
    });
  }

  // Restaurar selección si sigue siendo válida en el nuevo filtro
  sel.value = valActual;
}

/* ── Selects con buscador — activar después de cargar catálogos ─────────────── */
function _activarBuscadores() {
  // Sección 1 — Básica (geo + vinculación + tipo doc + CIIU)
  ['cod_vinc', 'cod_tpdoc', 'cod_pais_exp', 'cod_dept_exp', 'cod_mpio_exp',
   'cod_ciiu', 'cod_ciiu_n', 'cod_nacio_n'].forEach(convertirABuscable);

  // Sección 2 — Representante Legal Principal
  ['rl_p_tipdoc', 'rl_p_pais', 'rl_p_dept', 'rl_p_mpio'].forEach(convertirABuscable);

  // Sección 3 — Sociedad
  ['soc_ubic', 'soc_tip_empr', 'soc_grup_empr', 'soc_pais', 'soc_pais_orig'].forEach(convertirABuscable);

  // Sección 5 — Cumplimiento: cump_sis_preve es ahora checkboxes; no usa convertirABuscable.

  // Sección 13 — Firma
  ['firma_tipdoc'].forEach(convertirABuscable);
}

/* ── Recarga de catálogos al cambiar de idioma ───────────────────────────────
 * Llamado desde applyLang() en i18n.js cuando el usuario alterna ES ↔ EN.
 * Re-renderiza los <select> estáticos desde el cache existente (sin peticiones
 * HTTP adicionales) usando NOM_EN cuando el idioma activo es inglés.
 */
async function recargarCatalogosIdioma() {
  // Definición de cada select estático con su endpoint y columnas.
  // Debe mantenerse sincronizado con las llamadas en inicializar().
  const selects = [
    { endpoint: '/api/catalogo/tipos-documento?todos=1', id: 'cod_tpdoc',    val: 'COD_TPDOC', txt: 'NOM_TPDOC', ph: 'select_placeholder' },
    { endpoint: '/api/catalogo/tipos-documento?todos=1', id: 'rl_p_tipdoc',  val: 'COD_TPDOC', txt: 'NOM_TPDOC', ph: 'select_placeholder' },
    { endpoint: '/api/catalogo/vinculaciones',           id: 'cod_vinc',     val: 'COD_VINC',  txt: 'NOM_VINC',  ph: 'select_ph_vinc' },
    { endpoint: '/api/catalogo/paises',                  id: 'cod_pais_exp', val: 'COD_PAIS',  txt: 'NOM_PAIS',  ph: 'select_ph_pais' },
    { endpoint: '/api/catalogo/paises',                  id: 'rl_p_pais',    val: 'COD_PAIS',  txt: 'NOM_PAIS',  ph: 'select_placeholder' },
    { endpoint: '/api/catalogo/paises',                  id: 'soc_pais',      val: 'COD_PAIS',  txt: 'NOM_PAIS',  ph: 'select_ph_pais' },
    { endpoint: '/api/catalogo/paises',                  id: 'soc_pais_orig', val: 'COD_PAIS',  txt: 'NOM_PAIS',  ph: 'select_ph_pais' },
    { endpoint: '/api/catalogo/paises',                  id: 'cod_nacio_n',   val: 'COD_PAIS',  txt: 'NOM_PAIS',  ph: 'select_ph_pais' },
    // cump_sis_preve es checkboxes; se re-renderiza con cargarCheckboxesSisPrev() abajo.
    { endpoint: '/api/catalogo/tipos-cuenta',            id: 'cod_tpcta',    val: 'COD_TPCTA', txt: 'NOM_TPCTA', ph: 'select_placeholder' },
    // cod_ciiu (jurídica) excluye códigos 00XX de personas naturales; cod_ciiu_n los incluye todos
    { endpoint: '/api/catalogo/ciiu?tipo=J',             id: 'cod_ciiu',     val: 'COD_CIIU',  txt: 'NOM_CIIU',  ph: 'select_placeholder' },
    { endpoint: '/api/catalogo/ciiu',                    id: 'cod_ciiu_n',   val: 'COD_CIIU',  txt: 'NOM_CIIU',  ph: 'select_placeholder' },
    { endpoint: '/api/catalogo/tipos-documento', id: 'bfn_tip_doc_soc', val: 'COD_TPDOC', txt: 'NOM_TPDOC', ph: 'select_placeholder' },
  ];

  for (const cfg of selects) {
    const sel = document.getElementById(cfg.id);
    if (!sel) continue;
    const valActual = sel.value;
    // cargarCatalogo re-renderiza desde cache (sin fetch si ya está cacheado)
    await cargarCatalogo(cfg.endpoint, cfg.id, cfg.val, cfg.txt, cfg.ph);
    if (valActual) sel.value = valActual; // restaurar selección
  }

  // Restaurar "Otro tipo doc" en selects de tipo de documento (no está en el catálogo de BD)
  const rlTipdocSel = document.getElementById('rl_p_tipdoc');
  if (rlTipdocSel) agregarOpcionOtroAlTipdoc(rlTipdocSel);
  agregarOpcionOtroAlTipdoc('bfn_tip_doc_soc');

  // Re-aplicar el filtro de tipo de documento según el tipo de persona activo
  if (typeof _repoblarTipoDocumento === 'function') {
    const tipTerc = (document.getElementById('tip_terc') || {}).value || formData.basica?.TIP_TERC || 'J';
    _repoblarTipoDocumento(tipTerc);
  }

  // Re-aplicar el filtro/orden de vinculaciones según el modo activo
  if (typeof _filtrarVinculaciones === 'function') {
    _filtrarVinculaciones(window.modoPersona || 'J');
  }

  // Re-renderizar checkboxes de SIS_PREVE (usan NOM_EN si idioma = en)
  await cargarCheckboxesSisPrev();

  // Actualizar títulos de fichas dinámicas (Principal / Suplente → Primary / Alternate)
  if (typeof _cumpRenumerarTodos  === 'function') _cumpRenumerarTodos();
  if (typeof _jdRenumerarTodos    === 'function') _jdRenumerarTodos();
  if (typeof _rfRenumerarTodos    === 'function') _rfRenumerarTodos();
  if (typeof _bancoRenumerarTodos === 'function') _bancoRenumerarTodos();
  // Re-renderizar campos de documentos de RL en sección 14
  if (typeof renderDocRLFields    === 'function') renderDocRLFields();
  // Re-renderizar lista de países de operación (Sección 4) con NOM_EN
  if (typeof renderListaPaises    === 'function') await renderListaPaises();
  // Re-renderizar secciones dinámicas (fichas BF, AC, JD, RF, Bancaria, RL)
  // para que sus selects internos (tipo doc, país, etc.) reflejen el idioma activo
  if (typeof renderListaBF        === 'function') await renderListaBF();
  if (typeof renderListaAC        === 'function') await renderListaAC();
  if (typeof renderListaJD        === 'function') await renderListaJD();
  if (typeof renderListaRF        === 'function') await renderListaRF();
  if (typeof renderListaBancaria  === 'function') await renderListaBancaria();
  if (typeof renderListaRL        === 'function') await renderListaRL();
  if (typeof renderListaCump      === 'function') await renderListaCump();
  // Forzar refresco visual de selects estáticos con opciones data-i18n
  // (algunos navegadores no actualizan el texto seleccionado con sólo cambiar textContent)
  document.querySelectorAll('select').forEach(sel => {
    if (sel.disabled || !sel.id) return;
    if (sel.querySelector('option[data-i18n]')) {
      const v = sel.value;
      sel.value = '\x00';   // valor inexistente → fuerza repintado
      sel.value = v;
    }
  });

  // Sincronizar texto visible del sb-input tras reconstruir opciones y cambiar idioma.
  // cargarCatalogo() dispara el MutationObserver que resetea el sb-input a '',
  // y luego sel.value se restaura sin disparar 'change', por lo que hay que
  // sincronizar manualmente aquí (igual que en DOMContentLoaded).
  document.querySelectorAll('select[data-buscable="1"]').forEach(sel => {
    sel.querySelectorAll('option[value="NA"]').forEach(opt => { opt.textContent = t('no_aplica'); });
    const cur = sel.options[sel.selectedIndex];
    const inp = sel.parentElement && sel.parentElement.querySelector('.sb-input');
    if (!inp) return;
    const phOpt = sel.querySelector('option[value=""]');
    if (phOpt) inp.placeholder = phOpt.textContent.trim();
    if (cur && cur.value) inp.value = cur.textContent.trim();
  });
}

/* ── Arranque ───────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  await inicializar();
  _agregarOtroPais();
  _activarBuscadores();
  inicializarTooltips();

  const _qp      = new URLSearchParams(window.location.search);
  const _modo    = _qp.get('modo');
  const _numIden = _qp.get('numIden');

  if (_modo === 'actualizar' && _numIden) {
    // Cargar datos desde la BD; ignorar borrador local
    await _cargarRegistroExistente(_numIden);
  } else {
    const hasDraft = cargarBorrador();
    if (hasDraft) {
      mostrarToast('Borrador restaurado desde la sesión anterior.', 'info');
    }
  }

  // Renderizar listas dinámicas con el estado restaurado.
  await renderListaPaises();
  await renderListaAC();
  await renderListaBancaria();
  await renderListaJD();
  await renderListaRF();
  await renderListaBF();
  await renderListaRL();
  await initSeccionDocs();

  // Hidratación de campos estáticos a partir del estado global.
  await hidratarFormularioVisual();

  // Activar campos "Otros" después de hidratar (evalúa el valor actual del select)
  _activarCamposOtros();

  // Hidrata los inputs "otros" si hay borrador o modo actualizar
  const _otrMap = {
    otr_vinc:       formData.basica?.OTR_VINC,
    cod_tpdoc_otro: formData.basica?.OTR_TPDOC,
    otr_ciiu:       formData.basica?.OTR_CIIU,
    otr_socie:      formData.sociedad?.OTR_SOCIE,
    otr_preve:      formData.cumplimiento?.OTR_PREVE,
    // RL principal — tipo de documento "otro"
    rl_p_tipdoc_otro: formData.representantes?.[0]?.OTR_TPDOC,
    // Persona Natural — nacionalidad y CIIU "otro"
    nacio_n_otro_txt: window.formDataNatur?.basica?.OTR_NACIO,
    ciiu_n_otro_txt:  window.formDataNatur?.basica?.OTR_CIIU,
  };
  Object.entries(_otrMap).forEach(([id, val]) => {
    const el = document.getElementById(id); if (el && val) el.value = val;
  });

  // Sincronizar texto visible de todos los buscable selects después de hidratar.
  // hidratarFormularioVisual() asigna .value directamente sin disparar 'change',
  // por lo que los sb-input necesitan actualizarse manualmente.
  document.querySelectorAll('select[data-buscable="1"]').forEach(sel => {
    const cur = sel.options[sel.selectedIndex];
    const inp = sel.parentElement && sel.parentElement.querySelector('.sb-input');
    if (inp && cur && cur.value) inp.value = cur.textContent;
  });

  // Inicializar idioma (restaura preferencia guardada en localStorage).
  if (typeof initLang === 'function') initLang();

  // Guardado automático de borrador al interactuar con el formulario.
  document.body.addEventListener('input', guardarBorradorDebounced);
  document.body.addEventListener('change', guardarBorradorDebounced);
  window.addEventListener('beforeunload', guardarBorrador);

  // Adaptar UI para modo actualizar
  if (_modo === 'actualizar') {
    const btnSubmit = document.getElementById('btn-submit');
    if (btnSubmit) {
      btnSubmit.textContent = '💾 Guardar cambios';
      btnSubmit.title = 'Actualiza el registro existente en la base de datos';
    }
    const header = document.querySelector('.form-header') || document.querySelector('header');
    if (header) {
      const banner = document.createElement('div');
      banner.id = 'modo-actualizar-banner';
      banner.innerHTML = `<span>✏️ Modo actualizar — modificando registro <strong>${_numIden}</strong></span>`;
      banner.style.cssText = 'background:#fff3cd;color:#856404;border:1px solid #ffc107;border-radius:6px;padding:8px 14px;margin-bottom:12px;font-size:.875rem;font-weight:500;display:block';
      header.insertAdjacentElement('afterend', banner);
    }
    // Notificar a formulario.html que el registro fue cargado e hidratado
    window.dispatchEvent(new Event('registroCargado'));
  }
});

/**
 * Carga el registro completo de una Persona Jurídica desde la BD
 * y lo vuelca en formData para que hidratarFormularioVisual() lo pinte.
 */
async function _cargarRegistroExistente(numIden) {
  try {
    mostrarToast('Cargando registro…', 'info');
    const _editCode = sessionStorage.getItem('sarlaft_edit_code') || '';
    const resp = await fetch(`/api/cargar-completo/${encodeURIComponent(numIden)}`, {
      headers: _editCode ? { 'X-Codigo-Edicion': _editCode } : {},
    });
    if (!resp.ok) {
      const d = await resp.json().catch(() => ({}));
      if (d.error === 'codigoRequerido' || d.error === 'codigoInvalido') {
        mostrarToast('Código de edición inválido o ausente. Regrese al inicio e intente de nuevo.', 'error');
      } else {
        mostrarToast(d.error || `Error al cargar el registro (${resp.status}).`, 'error');
      }
      return;
    }
    const datos = await resp.json();

    // ── Persona Natural — cargar en el objeto de estado correcto ──────────────
    if (datos.TIP_TERC === 'N' && window.formDataNatur) {
      // Activar modo Natural en la UI
      if (typeof onTipTercChange === 'function') onTipTercChange('N');

      // Campos compartidos (GN_TERCE): NUM_IDEN, COD_TPDOC, contacto
      if (datos.basica) Object.assign(formData.basica, {
        TIP_TERC:    'N',
        COD_TPDOC:   datos.basica.COD_TPDOC,
        OTR_TPDOC:   datos.basica.OTR_TPDOC,
        NUM_IDEN:    datos.basica.NUM_IDEN,
        COD_VINC:    datos.basica.COD_VINC,
        DIR_TERC:    datos.basica.DIR_TERC,
        TEL_TERC:    datos.basica.TEL_TERC,
        TEL_TERC2:   datos.basica.TEL_TERC2,
        DIR_MAIL:    datos.basica.DIR_MAIL,
      });

      // Campos exclusivos de Natural (GN_NATUR + nombres de GN_TERCE)
      if (datos.naturBasica) Object.assign(formDataNatur.basica, datos.naturBasica);

      // Secciones compartidas
      if (datos.financiera)  Object.assign(formData.financiera,  datos.financiera);
      if (datos.pep)         Object.assign(formData.pep,         datos.pep);
      if (datos.actividades) Object.assign(formData.actividades, datos.actividades);
      if (Array.isArray(datos.bancaria)) formData.bancaria = datos.bancaria;

      // Sección 9N — Participación en sociedades
      if (datos.beneficiariosN) {
        Object.assign(formDataNatur.beneficiariosN, datos.beneficiariosN);
        // Hidratar radio PART_SOC
        const partSoc = datos.beneficiariosN.PART_SOC || 'N';
        const radioSel = document.querySelector(`input[name="part_soc"][value="${partSoc}"]`);
        if (radioSel) radioSel.checked = true;
        // Mostrar campos condicionales si aplica
        const bfnWrap = document.getElementById('bfn-fields-wrap');
        if (bfnWrap) bfnWrap.style.display = partSoc === 'S' ? '' : 'none';
        if (partSoc === 'S') {
          const razInp = document.getElementById('bfn_raz_soc');
          const tdSel  = document.getElementById('bfn_tip_doc_soc');
          const tdOtr  = document.getElementById('bfn_tip_doc_soc_otro');
          const numInp = document.getElementById('bfn_num_doc_soc');
          if (razInp && datos.beneficiariosN.RAZ_SOC)     razInp.value = datos.beneficiariosN.RAZ_SOC;
          if (tdSel  && datos.beneficiariosN.TIP_DOC_SOC) {
            tdSel.value = datos.beneficiariosN.TIP_DOC_SOC;
            tdSel.dispatchEvent(new Event('change'));
          }
          if (tdOtr  && datos.beneficiariosN.OTR_TIP_DOC_SOC) tdOtr.value = datos.beneficiariosN.OTR_TIP_DOC_SOC;
          if (numInp && datos.beneficiariosN.NUM_DOC_SOC) numInp.value = datos.beneficiariosN.NUM_DOC_SOC;
        }
      }

      mostrarToast('Registro de Persona Natural cargado.', 'success');
      return;
    }

    // ── Persona Jurídica — comportamiento original ────────────────────────────
    if (datos.basica)        Object.assign(formData.basica,      datos.basica);
    if (datos.sociedad)      Object.assign(formData.sociedad,    datos.sociedad);
    if (datos.financiera)    Object.assign(formData.financiera,  datos.financiera);
    if (datos.pep)           Object.assign(formData.pep,         datos.pep);
    if (datos.actividades)   Object.assign(formData.actividades, datos.actividades);
    if (Array.isArray(datos.paises)) {
      formData.paises = datos.paises.map(p => ({
        COD_PAIS: p.COD_PAIS ? String(p.COD_PAIS) : (p.OTR_PAIS ? 'OTRO' : null),
        OTR_PAIS: p.OTR_PAIS || '',
      }));
    }
    if (Array.isArray(datos.bancaria))      formData.bancaria      = datos.bancaria;
    if (Array.isArray(datos.accionistas))   formData.accionistas   = datos.accionistas;
    if (Array.isArray(datos.beneficiarios)) formData.beneficiarios = datos.beneficiarios;
    if (datos.firma)         Object.assign(formData.firma,       datos.firma);

    // Representantes: el API devuelve filas planas (TIP_REPR P/S)
    if (Array.isArray(datos.representantes) && datos.representantes.length) {
      formData.representantes = datos.representantes.map(r => ({
        TIP_REPR:  r.TIP_REPR,
        NOM_REPR:  r.NOM_REPR  || '',
        APE_REPR:  r.APE_REPR  || '',
        TIP_DOCU:  r.TIP_DOCU,
        OTR_TPDOC: r.OTR_TPDOC || null,
        NUM_DOCU:  r.NUM_DOCU  || '',
        FEC_EXPE:  r.FEC_EXPE  || '',
        COD_PAIS:  r.COD_PAIS,
        OTR_PAIS:  r.OTR_PAIS  || '',
        COD_DEPT:  r.COD_DEPT,
        COD_MPIO:  r.COD_MPIO,
        DIR_REPR:  r.DIR_REPR  || '',
        CEL_REPR:  r.CEL_REPR  || '',
        TEL_REPR:  r.TEL_REPR  || '',
        MAIL_REPR: r.MAIL_REPR || '',
      }));
    }

    // Cumplimiento
    if (datos.cumplimiento) {
      formData.cumplimiento.TIE_NORM  = datos.cumplimiento.TIE_NORM  || 'N';
      formData.cumplimiento.DESC_NORM = datos.cumplimiento.DESC_NORM || '';
      formData.cumplimiento.NORM_LAFT = datos.cumplimiento.NORM_LAFT || '';
      formData.cumplimiento.TIE_JUNTA = datos.cumplimiento.TIE_JUNTA || 'N';
      formData.cumplimiento.SIS_PREVE = datos.cumplimiento.SIS_PREVE || null;
      formData.cumplimiento.OTR_PREVE = datos.cumplimiento.OTR_PREVE || '';
      if (Array.isArray(datos.cumplimiento.oficiales) && datos.cumplimiento.oficiales.length) {
        formData.cumplimiento.oficiales = datos.cumplimiento.oficiales.map(o => ({
          TIP_REPR:  o.TIP_REPR,
          NOM_RESP:  o.NOM_RESP  || '',
          APE_RESP:  o.APE_RESP  || '',
          TIP_DOCU:  o.TIP_DOCU,
          NUM_DOCU:  o.NUM_DOCU  || '',
          FEC_EXPE:  o.FEC_EXPE  || '',
          COD_PAIS:  o.COD_PAIS,
          COD_DEPT:  o.COD_DEPT,
          COD_MPIO:  o.COD_MPIO,
          DIR_RESP:  o.DIR_RESP  || '',
          CEL_RESP:  o.CEL_RESP  || '',
          TEL_RESP:  o.TEL_RESP  || '',
          MAIL_RESP: o.MAIL_RESP || '',
        }));
      }
    }

    if (datos.juntaDirectiva) {
      formData.juntaDirectiva.TIE_JUNTA = datos.juntaDirectiva.TIE_JUNTA || 'N';
      formData.juntaDirectiva.miembros  = datos.juntaDirectiva.miembros  || [];
    }
    if (datos.revisores) {
      formData.revisores.TIE_REVIS = datos.revisores.TIE_REVIS || 'N';
      formData.revisores.revisores = datos.revisores.revisores || [];
    }

    mostrarToast('Registro cargado correctamente.', 'success');
  } catch (err) {
    console.error('_cargarRegistroExistente():', err);
    mostrarToast('Error al cargar el registro desde el servidor.', 'error');
  }
}

/**
 * Rellena los campos del formulario a partir del estado global.
 */
async function hidratarFormularioVisual() {
  try {
    // Sección 1: Información básica
    const basicaMap = {
      cod_vinc: 'COD_VINC',
      cod_tpdoc: 'COD_TPDOC',
      num_iden: 'NUM_IDEN',
      nom_comp: 'NOM_COMP',
      cod_pais_exp: 'COD_PAIS_EXP',
      cod_dept_exp: 'COD_DEPT_EXP',
      cod_mpio_exp: 'COD_MPIO_EXP',
      dir_terc: 'DIR_TER',
      tel_terc2: 'TEL_TER2',
      tel_terc: 'TEL_TER',
      dir_mail: 'DIR_MAIL',
      mail_sarl: 'MAIL_SARL',
      cod_ciiu: 'COD_CIIU',
      url_web: 'URL_WEB',
    };
    Object.entries(basicaMap).forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (el) el.value = formData.basica[key] || '';
    });

    // Sección 1: COT_BOLSA (solo Jurídica)
    {
      const cotBolsa = formData.basica.COT_BOLSA || 'N';
      const radioCot = document.querySelector(`input[name="cot_bolsa"][value="${cotBolsa}"]`);
      if (radioCot) radioCot.checked = true;
      if (typeof onCotBolsaChange === 'function') onCotBolsaChange(cotBolsa);
      if (cotBolsa === 'S') {
        const nomInp = document.getElementById('nom_bolsa');
        if (nomInp) nomInp.value = formData.basica.NOM_BOLSA || '';
      }
    }

    // Sección 1: cascada/OTRO para País de expedición del documento
    {
      const cpe = formData.basica.COD_PAIS_EXP;
      if (cpe === 'OTRO') {
        const fieldOtro = document.getElementById('field-pais_exp_otro');
        const fieldDept = document.getElementById('field-cod_dept_exp');
        const fieldMpio = document.getElementById('field-cod_mpio_exp');
        if (fieldDept) fieldDept.style.display = 'none';
        if (fieldMpio) fieldMpio.style.display = 'none';
        if (fieldOtro) { fieldOtro.style.display = ''; fieldOtro.style.gridColumn = 'span 2'; }
        const inp = document.getElementById('pais_exp_otro_txt');
        if (inp) inp.value = formData.basica.OTR_PAIS_EXP || '';
      } else if (cpe) {
        if (cpe === COD_COLOMBIA) {
          await cargarCatalogo('/api/catalogo/departamentos', 'cod_dept_exp',
            'COD_DEPT', 'NOM_DEPT', 'select_ph_dept', { cod_pais: cpe });
          const selDept = document.getElementById('cod_dept_exp');
          if (selDept) {
            selDept.disabled = false;
            if (formData.basica.COD_DEPT_EXP) {
              selDept.value = formData.basica.COD_DEPT_EXP;
              if (formData.basica.COD_MPIO_EXP) {
                await cargarCatalogo('/api/catalogo/ciudades', 'cod_mpio_exp',
                  'COD_MUNI', 'NOM_MUNI', 'select_ph_ciudad',
                  { cod_dept: formData.basica.COD_DEPT_EXP, cod_pais: cpe });
                const selMpio = document.getElementById('cod_mpio_exp');
                if (selMpio) { selMpio.disabled = false; selMpio.value = formData.basica.COD_MPIO_EXP; }
              }
            }
          }
        } else {
          // País extranjero: dpto = NA, ciudades sin filtro de dpto
          const selDept = document.getElementById('cod_dept_exp');
          if (selDept) {
            selDept.innerHTML = '<option value="NA">' + t('no_aplica') + '</option>';
            selDept.value = 'NA'; selDept.disabled = true;
          }
          const selMpio2 = document.getElementById('cod_mpio_exp');
          if (selMpio2) {
            selMpio2.disabled = false;
            await cargarCatalogo('/api/catalogo/ciudades', 'cod_mpio_exp',
              'COD_MUNI', 'NOM_MUNI', 'select_ph_ciudad', { cod_pais: cpe });
            const hadNoCities2 = _autoNoAplicaCiudad(selMpio2);
            if (!hadNoCities2 && formData.basica.COD_MPIO_EXP && formData.basica.COD_MPIO_EXP !== 'NA') {
              selMpio2.value = formData.basica.COD_MPIO_EXP;
            }
          }
        }
      }
    }

    // Sección 2: Representante Legal Principal (idx 0 — bloque estático)
    // Los suplentes/extras (idx ≥ 1) los maneja renderListaRL() con _rlExtraHTML().
    const rlPrincipalMap = [
      ['rl_p_nom', 'NOM_REPR'], ['rl_p_ape', 'APE_REPR'], ['rl_p_tipdoc', 'TIP_DOCU'],
      ['rl_p_numdoc', 'NUM_DOCU'], ['rl_p_fec', 'FEC_EXPE'], ['rl_p_pais', 'COD_PAIS'],
      ['rl_p_dept', 'COD_DEPT'], ['rl_p_mpio', 'COD_MPIO'], ['rl_p_dir', 'DIR_REPR'],
      ['rl_p_cel', 'CEL_REPR'], ['rl_p_tel', 'TEL_REPR'], ['rl_p_mail', 'MAIL_REPR'],
    ];
    {
      const rep = formData.representantes[0];
      if (rep) {
        rlPrincipalMap.forEach(([id, key]) => {
          const el = document.getElementById(id);
          if (!el) return;
          el.value = rep[key] || '';
        });
        await _hydrateGeoCascade('rl_p_', rep);
      }
    }

    // Sección 3: Sociedad
    const ubic = formData.sociedad.UBIC_SOC || 'N';
    const socUbic = document.getElementById('soc_ubic');
    if (socUbic) socUbic.value = ubic;
    await onUbicacionChange(ubic);

    const socMap = {
      soc_tip_empr:  'TIP_EMPR',
      soc_grup_empr: 'GRUP_EMPR',
      soc_pais:      'COD_PAIS_SOC',
    };
    Object.entries(socMap).forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (el) el.value = formData.sociedad[key] || '';
    });
    // Hidratar campo "Otro país" en sección 3 si aplica
    if (formData.sociedad.COD_PAIS_SOC === 'OTRO') {
      onSocPaisChange('OTRO');
      const inp = document.getElementById('soc_pais_otro_txt');
      if (inp) inp.value = formData.sociedad.OTR_PAIS_SOC || '';
    }

    // Hidratar cascada grupo empresarial (sección 3)
    if (formData.sociedad.GRUP_EMPR === 'S') {
      const selGrp = document.getElementById('soc_grup_empr');
      if (selGrp) selGrp.value = 'S';
      onGrupEmprChange('S');
      if (formData.sociedad.CTRL_DECLA) {
        const rCtrl = document.querySelector(`input[name="soc_ctrl_decla"][value="${formData.sociedad.CTRL_DECLA}"]`);
        if (rCtrl) rCtrl.checked = true;
        onCtrlDeclaChange(formData.sociedad.CTRL_DECLA);
        if (formData.sociedad.CTRL_DECLA === 'N') {
          const selCal = document.getElementById('soc_cal_grupo');
          if (selCal) selCal.value = formData.sociedad.CAL_GRUPO || '';
          const tDesc = document.getElementById('soc_desc_grupo');
          if (tDesc) tDesc.value = formData.sociedad.DESC_GRUPO || '';
        }
      }
    }

    // Sección 4: Países de operación
    // renderListaPaises ya maneja los valores.

    // Sección 5: Cumplimiento — los campos son dinámicos (renderListaCump)
    const tieNormRadio = document.querySelector(`input[name="cump_tie_norm"][value="${formData.cumplimiento.TIE_NORM || 'N'}"]`);
    if (tieNormRadio) tieNormRadio.checked = true;
    if (formData.cumplimiento.TIE_NORM === 'S') {
      onTieNormChange('S');
      const descNorm = document.getElementById('cump_desc_norm');
      if (descNorm) descNorm.value = formData.cumplimiento.DESC_NORM || '';
      const normLaft = document.getElementById('cump_norm_laft');
      if (normLaft) normLaft.value = formData.cumplimiento.NORM_LAFT || '';

      const cumpRadio = document.querySelector(`input[name="cump_tie_sist"][value="${formData.cumplimiento.TIE_JUNTA}"]`);
      if (cumpRadio) cumpRadio.checked = true;
      if (formData.cumplimiento.TIE_JUNTA === 'S') {
        onTieneSistemaChange('S');
        // Checkboxes — re-renderizar con el estado cargado desde la BD
        await cargarCheckboxesSisPrev();
        const inp = document.getElementById('otr_preve');
        if (inp) inp.value = formData.cumplimiento.OTR_PREVE || '';
      }
    }

    // Sección 11A: PEP
    const pepRadioMan = document.querySelector(`input[name="pep_man_rpub"][value="${formData.pep.MAN_RPUB}"]`);
    if (pepRadioMan) pepRadioMan.checked = true;
    const pepRadioCar = document.querySelector(`input[name="pep_car_publ"][value="${formData.pep.CAR_PUBL}"]`);
    if (pepRadioCar) pepRadioCar.checked = true;

    // Sección 11B: Actividades
    const operVA = formData.actividades.OPER_VA || 'N';
    const radioOperVA = document.querySelector(`input[name="oper_va"][value="${operVA}"]`);
    if (radioOperVA) radioOperVA.checked = true;
    const vaWrap = document.getElementById('va-checkboxes-wrap');
    if (vaWrap) vaWrap.style.display = operVA === 'S' ? '' : 'none';
    ['act_va_fiat','act_va_va','act_trans','act_custo','act_serv_fin','act_serv_vap','cert_info']
      .forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const stateKey = id === 'cert_info' ? 'CERT_INFO' : id.toUpperCase();
        el.checked = formData.actividades[stateKey] === 'S';
      });

    // Sección 9: Financiera
    const finMap = {
      act_total: 'ACT_TOTAL', ing_mens: 'ING_MENS', pas_total: 'PAS_TOTAL',
      egr_mens: 'EGR_MENS', patrimonio: 'PATRIMONIO', otr_ing: 'OTR_ING',
    };
    Object.entries(finMap).forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (!el) return;
      const value = formData.financiera[key];
      el.value = value !== null && value !== undefined ? (typeof _fmtMoneda === 'function' ? _fmtMoneda(value) : String(value)) : '';
    });
    const patrimonioHint = document.getElementById('patrimonio-hint');
    if (patrimonioHint && formData.financiera.PATRIMONIO !== null && formData.financiera.PATRIMONIO !== undefined) {
      patrimonioHint.textContent = 'Valor ingresado manualmente.';
    }

    // Moneda de reporte (fin_moneda)
    {
      const codMone = formData.financiera.COD_MONE;
      if (codMone) {
        const selMone = document.getElementById('fin_moneda');
        if (selMone) {
          selMone.value = String(codMone);
          const optSel = selMone.options[selMone.selectedIndex];
          const ini = (optSel && optSel.dataset.ini) ? optSel.dataset.ini : 'COP';
          if (typeof onFinMonedaChange === 'function') onFinMonedaChange(String(codMone), ini);
        }
      }
    }

    // Sección 6: Junta Directiva
    const jdRadio = document.querySelector(`input[name="jd_tie_junta"][value="${formData.juntaDirectiva.TIE_JUNTA}"]`);
    if (jdRadio) jdRadio.checked = true;

    // Sección 7: Revisores fiscales
    const rfRadio = document.querySelector(`input[name="rf_tie_revis"][value="${formData.revisores.TIE_REVIS}"]`);
    if (rfRadio) rfRadio.checked = true;
  } catch (err) {
    console.error('hidratarFormularioVisual():', err);
  }
}

/**
 * Carga opciones de departamento/ciudad para un bloque de ubicación y restablece valores.
 * No modifica el estado global; solamente rellena los selects del DOM.
 */
async function _hydrateGeoCascade(prefix, item) {
  if (!item || !item.COD_PAIS) return;

  const selDept = document.getElementById(`${prefix}dept`);
  const selMpio = document.getElementById(`${prefix}mpio`);
  if (!selDept || !selMpio) return;

  if (item.COD_PAIS === 'OTRO') {
    // País extranjero no listado — mostrar campo libre, ocultar dept/mpio
    const fieldDept = document.getElementById(`field-${prefix}dept`);
    const fieldMpio = document.getElementById(`field-${prefix}mpio`);
    if (fieldDept) fieldDept.style.display = 'none';
    if (fieldMpio) fieldMpio.style.display = 'none';
    const fieldOtro = document.getElementById(`field-${prefix}pais_otro`);
    if (fieldOtro) {
      fieldOtro.style.display = '';
      fieldOtro.style.gridColumn = 'span 2';
      const inp = document.getElementById(`${prefix}pais_otro`);
      if (inp) inp.value = item.OTR_PAIS || '';
    }
    return;
  } else if (item.COD_PAIS === COD_COLOMBIA) {
    await cargarCatalogo(
      '/api/catalogo/departamentos', `${prefix}dept`,
      'COD_DEPT', 'NOM_DEPT', 'select_ph_dept',
      { cod_pais: item.COD_PAIS }
    );
    selDept.disabled = false;
  } else {
    selDept.innerHTML = '<option value="NA">' + t('no_aplica') + '</option>';
    selDept.disabled = true;
  }

  if (item.COD_DEPT) {
    selDept.value = item.COD_DEPT;
  }

  const params = { cod_pais: item.COD_PAIS };
  if (item.COD_DEPT && item.COD_DEPT !== 'NA') {
    params.cod_dept = item.COD_DEPT;
  }

  await cargarCatalogo(
    '/api/catalogo/ciudades', `${prefix}mpio`,
    'COD_MUNI', 'NOM_MUNI', 'select_ph_ciudad',
    params
  );
  selMpio.disabled = false;
  const hadNoCities = _autoNoAplicaCiudad(selMpio);
  if (!hadNoCities && item.COD_MPIO && item.COD_MPIO !== 'NA') {
    selMpio.value = item.COD_MPIO;
  }
}

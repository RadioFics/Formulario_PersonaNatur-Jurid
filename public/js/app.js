/**
 * app.js — Punto de entrada y arranque de la aplicación SARLAFT
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
        'COD_TPDOC', 'NOM_TPDOC', '— Seleccione —'
      ).then(() => {
        // Modo inicial = Jurídica → mostrar solo NIT y auto-seleccionar
        _repoblarTipoDocumento('J');
      }),

      // Tipos de vinculación
      cargarCatalogo(
        '/api/catalogo/vinculaciones', 'cod_vinc',
        'COD_VINC', 'NOM_VINC', '— Seleccione tipo de vinculación —'
      ),

      // Países (Colombia primero)
      cargarCatalogo(
        '/api/catalogo/paises', 'cod_pais_exp',
        'COD_PAIS', 'NOM_PAIS', '— Seleccione país —'
      ),

      // Actividades CIIU — select buscable, muestra "COD — Nombre"
      cargarCatalogo(
        '/api/catalogo/ciiu', 'cod_ciiu',
        'COD_CIIU', 'NOM_CIIU', '— Seleccione actividad —',
        {}, d => `${d.COD_CIIU} — ${d.NOM_CIIU}`
      ),

      // ── Sección 2: Representante Legal ─────────────────────────────────────

      // Tipos de documento (todos) — Principal; se clona al Suplente
      cargarCatalogo(
        '/api/catalogo/tipos-documento?todos=1', 'rl_p_tipdoc',
        'COD_TPDOC', 'NOM_TPDOC', '— Seleccione —'
      ).then(() => {
        const src  = document.getElementById('rl_p_tipdoc');
        const dest = document.getElementById('rl_s_tipdoc');
        if (src && dest) dest.innerHTML = src.innerHTML;
      }),

      // Países — Principal; se clona al Suplente
      cargarCatalogo(
        '/api/catalogo/paises', 'rl_p_pais',
        'COD_PAIS', 'NOM_PAIS', '— Seleccione —'
      ).then(() => {
        const src  = document.getElementById('rl_p_pais');
        const dest = document.getElementById('rl_s_pais');
        if (src && dest) dest.innerHTML = src.innerHTML;
      }),

      // ── Sección 3: Tipos de sociedad (carga inicial para Nacional) ───────────
      cargarCatalogo(
        '/api/catalogo/tipos-sociedad', 'soc_tip_socie',
        'COD_SOCIE', 'NOM_SOCIE', '— Seleccione —',
        { ubicacion: 'N' }
      ),

      // Países para el desplegable del campo "País" en sección 3
      cargarCatalogo(
        '/api/catalogo/paises', 'soc_pais',
        'COD_PAIS', 'NOM_PAIS', '— Seleccione país —'
      ),

      // ── Sección 5: Sistema de cumplimiento ────────────────────────────────

      // Sistemas de prevención LA/FT (MAE_SIST_PREV)
      cargarCatalogo(
        '/api/catalogo/sistemas-prevencion', 'cump_sis_preve',
        'COD_SIST', 'NOM_SIST', '— Seleccione —'
      ),

      // Tipos de documento para oficial de cumplimiento Principal
      // Reutiliza la carga de sec2 (ya en cache); clona al Suplente
      cargarCatalogo(
        '/api/catalogo/tipos-documento?todos=1', 'cump_p_tipdoc',
        'COD_TPDOC', 'NOM_TPDOC', '— Seleccione —'
      ).then(() => {
        const src  = document.getElementById('cump_p_tipdoc');
        const dest = document.getElementById('cump_s_tipdoc');
        if (src && dest) dest.innerHTML = src.innerHTML;
      }),

      // Países para oficial de cumplimiento Principal; clona al Suplente
      cargarCatalogo(
        '/api/catalogo/paises', 'cump_p_pais',
        'COD_PAIS', 'NOM_PAIS', '— Seleccione —'
      ).then(() => {
        const src  = document.getElementById('cump_p_pais');
        const dest = document.getElementById('cump_s_pais');
        if (src && dest) dest.innerHTML = src.innerHTML;
      }),

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
  // Vinculación
  configurarOtros('cod_vinc', 'otr_vinc_wrap', () => {
    actualizarFormData('basica', 'OTR_VINC', null);
    const el = document.getElementById('otr_vinc'); if (el) el.value = '';
  });

  // CIIU
  configurarOtros('cod_ciiu', 'otr_ciiu_wrap', () => {
    actualizarFormData('basica', 'OTR_CIIU', null);
    const el = document.getElementById('otr_ciiu'); if (el) el.value = '';
  });

  // Tipo de sociedad
  configurarOtros('soc_tip_socie', 'otr_socie_wrap', () => {
    actualizarSociedad('OTR_SOCIE', null);
    const el = document.getElementById('otr_socie'); if (el) el.value = '';
  });

  // Sistema de prevención
  configurarOtros('cump_sis_preve', 'otr_preve_wrap', () => {
    actualizarCump('OTR_PREVE', null);
    const el = document.getElementById('otr_preve'); if (el) el.value = '';
  });
}

/* ── Selects con buscador — activar después de cargar catálogos ─────────────── */
function _activarBuscadores() {
  // Sección 1 — Básica (geo + vinculación + tipo doc + CIIU)
  ['cod_vinc', 'cod_tpdoc', 'cod_pais_exp', 'cod_dept_exp', 'cod_mpio_exp',
   'cod_ciiu', 'cod_ciiu_n', 'cod_nacio_n'].forEach(convertirABuscable);

  // Sección 2 — Representante Legal Principal
  ['rl_p_tipdoc', 'rl_p_pais', 'rl_p_dept', 'rl_p_mpio'].forEach(convertirABuscable);

  // Sección 3 — Sociedad
  ['soc_ubic', 'soc_tip_empr', 'soc_grup_empr', 'soc_tip_socie', 'soc_pais'].forEach(convertirABuscable);

  // Sección 5 — Cumplimiento
  ['cump_sis_preve', 'cump_p_tipdoc', 'cump_p_pais', 'cump_p_dept', 'cump_p_mpio'].forEach(convertirABuscable);

  // Sección 13 — Firma
  ['firma_tipdoc'].forEach(convertirABuscable);
}

/* ── Arranque ───────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  await inicializar();
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
  await initSeccionDocs();

  // Hidratación de campos estáticos a partir del estado global.
  await hidratarFormularioVisual();

  // Activar campos "Otros" después de hidratar (evalúa el valor actual del select)
  _activarCamposOtros();

  // Hidrata los inputs "otros" si hay borrador o modo actualizar
  const _otrMap = {
    otr_vinc:  formData.basica?.OTR_VINC,
    otr_ciiu:  formData.basica?.OTR_CIIU,
    otr_socie: formData.sociedad?.OTR_SOCIE,
    otr_preve: formData.cumplimiento?.OTR_PREVE,
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
  }
});

/**
 * Carga el registro completo de una Persona Jurídica desde la BD
 * y lo vuelca en formData para que hidratarFormularioVisual() lo pinte.
 */
async function _cargarRegistroExistente(numIden) {
  try {
    mostrarToast('Cargando registro…', 'info');
    const resp = await fetch(`/api/cargar-completo/${encodeURIComponent(numIden)}`);
    if (!resp.ok) {
      const d = await resp.json().catch(() => ({}));
      mostrarToast(d.error || `Error al cargar el registro (${resp.status}).`, 'error');
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

      mostrarToast('Registro de Persona Natural cargado.', 'success');
      return;
    }

    // ── Persona Jurídica — comportamiento original ────────────────────────────
    if (datos.basica)        Object.assign(formData.basica,      datos.basica);
    if (datos.sociedad)      Object.assign(formData.sociedad,    datos.sociedad);
    if (datos.financiera)    Object.assign(formData.financiera,  datos.financiera);
    if (datos.pep)           Object.assign(formData.pep,         datos.pep);
    if (datos.actividades)   Object.assign(formData.actividades, datos.actividades);
    if (Array.isArray(datos.paises))        formData.paises        = datos.paises;
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
        NUM_DOCU:  r.NUM_DOCU  || '',
        FEC_EXPE:  r.FEC_EXPE  || '',
        COD_PAIS:  r.COD_PAIS,
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
      formData.cumplimiento.DESC_NORM = datos.cumplimiento.DESC_NORM || '';
      formData.cumplimiento.NORM_LAFT = datos.cumplimiento.NORM_LAFT || '';
      formData.cumplimiento.TIE_JUNTA = datos.cumplimiento.TIE_JUNTA || 'N';
      formData.cumplimiento.SIS_PREVE = datos.cumplimiento.SIS_PREVE || null;
      if (Array.isArray(datos.cumplimiento.oficiales) && datos.cumplimiento.oficiales.length) {
        formData.cumplimiento.oficiales = datos.cumplimiento.oficiales.map(o => ({
          TIP_REPR:  o.TIP_REPR,
          TIP_DOCU:  o.TIP_DOCU,
          NUM_DOCU:  o.NUM_DOCU  || '',
          FEC_EXPE:  o.FEC_EXPE  || '',
          NOM_RESP:  o.NOM_RESP  || '',
          APE_RESP:  o.APE_RESP  || '',
          RAZ_RESP:  o.RAZ_RESP  || '',
          COD_PAIS:  o.COD_PAIS,
          COD_DEPT:  o.COD_DEPT,
          COD_MPIO:  o.COD_MPIO,
          DIR_RESP:  o.DIR_RESP  || '',
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

    // Sección 2: Representante Legal
    const rlMap = [
      ['rl_p_nom', 'NOM_REPR'], ['rl_p_ape', 'APE_REPR'], ['rl_p_tipdoc', 'TIP_DOCU'],
      ['rl_p_numdoc', 'NUM_DOCU'], ['rl_p_fec', 'FEC_EXPE'], ['rl_p_pais', 'COD_PAIS'],
      ['rl_p_dept', 'COD_DEPT'], ['rl_p_mpio', 'COD_MPIO'], ['rl_p_dir', 'DIR_REPR'],
      ['rl_p_cel', 'CEL_REPR'], ['rl_p_tel', 'TEL_REPR'], ['rl_p_mail', 'MAIL_REPR'],
      ['rl_s_nom', 'NOM_REPR'], ['rl_s_ape', 'APE_REPR'], ['rl_s_tipdoc', 'TIP_DOCU'],
      ['rl_s_numdoc', 'NUM_DOCU'], ['rl_s_fec', 'FEC_EXPE'], ['rl_s_pais', 'COD_PAIS'],
      ['rl_s_dept', 'COD_DEPT'], ['rl_s_mpio', 'COD_MPIO'], ['rl_s_dir', 'DIR_REPR'],
      ['rl_s_cel', 'CEL_REPR'], ['rl_s_tel', 'TEL_REPR'], ['rl_s_mail', 'MAIL_REPR'],
    ];
    for (let index = 0; index < 2; index += 1) {
      const rep = formData.representantes[index];
      if (!rep) continue;
      const prefix = index === 0 ? 'rl_p_' : 'rl_s_';
      rlMap.filter(([id]) => id.startsWith(prefix)).forEach(([id, key]) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.value = rep[key] || '';
      });
      await _hydrateGeoCascade(prefix, rep);
    }

    // Sección 3: Sociedad
    const ubic = formData.sociedad.UBIC_SOC || 'N';
    const socUbic = document.getElementById('soc_ubic');
    if (socUbic) socUbic.value = ubic;
    await onUbicacionChange(ubic);

    const socMap = {
      soc_tip_empr: 'TIP_EMPR',
      soc_grup_empr: 'GRUP_EMPR',
      soc_tip_socie: 'TIP_SOCIE',
      soc_pais: 'COD_PAIS_SOC',
    };
    Object.entries(socMap).forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (el) el.value = formData.sociedad[key] || '';
    });

    // Sección 4: Países de operación
    // renderListaPaises ya maneja los valores.

    // Sección 5: Cumplimiento
    const descNorm = document.getElementById('cump_desc_norm');
    if (descNorm) descNorm.value = formData.cumplimiento.DESC_NORM || '';

    const cumpRadio = document.querySelector(`input[name="cump_tie_sist"][value="${formData.cumplimiento.TIE_JUNTA}"]`);
    if (cumpRadio) cumpRadio.checked = true;
    if (formData.cumplimiento.TIE_JUNTA === 'S') {
      onTieneSistemaChange('S');
      const selSist = document.getElementById('cump_sis_preve');
      if (selSist) selSist.value = formData.cumplimiento.SIS_PREVE || '';
    }

    const cumpMap = [
      ['cump_p_tipdoc', 'TIP_DOCU'], ['cump_p_numdoc', 'NUM_DOCU'], ['cump_p_fec', 'FEC_EXPE'],
      ['cump_p_pais', 'COD_PAIS'], ['cump_p_dept', 'COD_DEPT'], ['cump_p_mpio', 'COD_MPIO'],
      ['cump_p_dir', 'DIR_RESP'], ['cump_p_cel', 'CEL_RESP'], ['cump_p_tel', 'TEL_RESP'],
      ['cump_p_mail', 'MAIL_RESP'],
      ['cump_s_tipdoc', 'TIP_DOCU'], ['cump_s_numdoc', 'NUM_DOCU'], ['cump_s_fec', 'FEC_EXPE'],
      ['cump_s_pais', 'COD_PAIS'], ['cump_s_dept', 'COD_DEPT'], ['cump_s_mpio', 'COD_MPIO'],
      ['cump_s_dir', 'DIR_RESP'], ['cump_s_cel', 'CEL_RESP'], ['cump_s_tel', 'TEL_RESP'],
      ['cump_s_mail', 'MAIL_RESP'],
    ];
    for (let index = 0; index < 2; index += 1) {
      const oficial = formData.cumplimiento.oficiales[index];
      if (!oficial) continue;
      const prefix = index === 0 ? 'cump_p_' : 'cump_s_';
      cumpMap.filter(([id]) => id.startsWith(prefix)).forEach(([id, key]) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.value = oficial[key] || '';
      });
      await _hydrateGeoCascade(prefix, oficial);
    }

    // Sección 11A: PEP
    const pepRadioMan = document.querySelector(`input[name="pep_man_rpub"][value="${formData.pep.MAN_RPUB}"]`);
    if (pepRadioMan) pepRadioMan.checked = true;
    const pepRadioCar = document.querySelector(`input[name="pep_car_publ"][value="${formData.pep.CAR_PUBL}"]`);
    if (pepRadioCar) pepRadioCar.checked = true;

    // Sección 11B: Actividades
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

  if (item.COD_PAIS === COD_COLOMBIA) {
    await cargarCatalogo(
      '/api/catalogo/departamentos', `${prefix}dept`,
      'COD_DEPT', 'NOM_DEPT', '— Seleccione departamento —',
      { cod_pais: item.COD_PAIS }
    );
    selDept.disabled = false;
  } else {
    selDept.innerHTML = '<option value="NA">No aplica</option>';
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
    'COD_MUNI', 'NOM_MUNI', '— Seleccione ciudad —',
    params
  );
  selMpio.disabled = false;
  if (item.COD_MPIO) {
    selMpio.value = item.COD_MPIO;
  }
}

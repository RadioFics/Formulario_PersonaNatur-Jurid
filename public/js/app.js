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

      // Tipo de documento — solo NIT (COD_TPDOC = 8) para persona jurídica
      cargarCatalogo(
        '/api/catalogo/tipos-documento', 'cod_tpdoc',
        'COD_TPDOC', 'NOM_TPDOC', '— Seleccione —'
      ).then(datos => {
        // Si la API devuelve un único tipo, seleccionarlo automáticamente
        if (datos.length === 1) {
          const sel = document.getElementById('cod_tpdoc');
          sel.value = datos[0].COD_TPDOC;
          actualizarFormData('basica', 'COD_TPDOC', datos[0].COD_TPDOC);
        }
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

      // Actividades CIIU en datalist
      cargarDatalist(
        '/api/catalogo/ciiu', 'lista-ciiu',
        'COD_CIIU', 'NOM_CIIU'
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

      // ── Persona Natural: catálogos exclusivos ────────────────────────────
      // Nacionalidad (cod_nacio_n) y datalist CIIU para Natural.
      // inicializarNaturBasica() está en seccion-natur-basica.js.
      inicializarNaturBasica(),

    ]);
  } catch (err) {
    console.error('Error en inicializar():', err);
    mostrarToast('Error al cargar los catálogos. Verifique la conexión.', 'error');
  } finally {
    showLoading(false);
  }
}

/* ── Arranque ───────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  await inicializar();
  const hasDraft = cargarBorrador();

  // Renderizar listas dinámicas con el estado restaurado si existe borrador.
  await renderListaPaises();
  await renderListaAC();
  await renderListaBancaria();
  await renderListaJD();
  await renderListaRF();
  await renderListaBF();
  await initSeccionDocs();

  // Hidratación de campos estáticos a partir del estado global.
  await hidratarFormularioVisual();

  // Guardado automático de borrador al interactuar con el formulario.
  document.body.addEventListener('input', guardarBorradorDebounced);
  document.body.addEventListener('change', guardarBorradorDebounced);
  window.addEventListener('beforeunload', guardarBorrador);

  if (hasDraft) {
    mostrarToast('Borrador restaurado desde la sesión anterior.', 'info');
  }
});

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

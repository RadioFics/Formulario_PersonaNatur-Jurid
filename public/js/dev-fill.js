/**
 * dev-fill.js — Relleno automático de prueba (SOLO DESARROLLO)
 *
 * Inyecta un botón flotante "🧪 Rellenar prueba" en la página.
 * Al hacer clic, carga los catálogos reales desde la API y rellena
 * TODOS los campos del formulario con datos ficticios coherentes.
 *
 * ⚠️  ELIMINAR este <script> antes de pasar a producción.
 *
 * Uso:
 *   1. El botón aparece automáticamente al cargar la página.
 *   2. También se puede llamar desde consola: rellenarPrueba()
 */
'use strict';

/* ─── Datos ficticios fijos ──────────────────────────────────────────────────── */

const _TEST = {
  // Sección 1 — Básica
  NUM_IDEN:    '900123456',
  DIG_VERI:    '7',
  NOM_COMP:    'EMPRESA DEMO SAGRILAFT S.A.S.',
  DIR_TERC:    'Carrera 15 # 93-47 Oficina 301',
  TEL_TERC:    '3001234567',
  TEL_TERC2:   '6017654321',
  DIR_MAIL:    'contacto@empresademo.co',
  MAIL_SARL:   'sarlaft@empresademo.co',
  URL_WEB:     'https://www.empresademo.co',

  // Sección 3 — Sociedad
  TIP_EMPR:    'PRIVADA',
  GRUP_EMPR:   'N',
  REL_GRUPO:   '',

  // Sección 5 — Cumplimiento
  DESC_NORM:   'La empresa aplica el Sistema de Administración del Riesgo de Lavado de Activos y Financiación del Terrorismo (SAGRILAFT) conforme a la Circular Básica Jurídica de la SFC y la Ley 526 de 1999. Se han implementado políticas internas, procedimientos de debida diligencia y controles de monitoreo de transacciones.',
  NORM_LAFT:   'Ley 526 de 1999 - Circular Básica Jurídica SFC - Resolución UIAF',

  // Representante legal
  RL: {
    NOM_REPR:  'Carlos Alberto',
    APE_REPR:  'Martínez Gómez',
    NUM_DOCU:  '79512345',
    FEC_EXPE:  '2015-03-20',
    DIR_REPR:  'Calle 100 # 19-50 Apto 402',
    CEL_REPR:  '3109876543',
    TEL_REPR:  '6012345678',
    MAIL_REPR: 'carlos.martinez@empresademo.co',
  },
  RL_SUP: {
    NOM_REPR:  'Ana Lucía',
    APE_REPR:  'Torres Herrera',
    NUM_DOCU:  '52601234',
    FEC_EXPE:  '2018-07-10',
    DIR_REPR:  'Transversal 22 # 45-30',
    CEL_REPR:  '3157654321',
    TEL_REPR:  '6015678901',
    MAIL_REPR: 'ana.torres@empresademo.co',
  },

  // Sección 6 — Junta directiva
  JD: {
    TIP_MIEM:  'Presidente',
    NOM_MIEM:  'Roberto',
    APE_MIEM:  'Sánchez Pérez',
    NUM_DOCU:  '80234567',
    FEC_EXPE:  '2010-11-05',
    DIR_MIEM:  'Avenida El Dorado # 68C-61',
    TEL_MIEM:  '6013456789',
    MAIL_MIEM: 'roberto.sanchez@empresademo.co',
  },

  // Sección 7 — Revisor fiscal
  RF: {
    NOM_REVI:  'Lucía',
    APE_REVI:  'Vargas Castro',
    RAZ_REVI:  '',
    NUM_DOCU:  '43567890',
    FEC_EXPE:  '2012-05-15',
    DIR_REVI:  'Calle 72 # 10-34 Of. 506',
    CEL_REVI:  '3166789012',
    TEL_REVI:  '6016789012',
    MAIL_REVI: 'lucia.vargas@revisoriaempresa.co',
    OBS_REVI:  'Revisora fiscal certificada. Matrícula profesional CP 123456-T.',
  },

  // Sección 8 — Accionistas
  AC: {
    NOM_ACCI:  'Jorge Luis',
    APE_ACCI:  'Ramírez López',
    NUM_DOCU:  '19456789',
    FEC_EXPE:  '2008-02-28',
    DIR_ACCI:  'Calle 134 # 55-20 Casa 12',
    CEL_ACCI:  '3012345678',
    TEL_ACCI:  '6014567890',
    MAIL_ACCI: 'jorge.ramirez@gmail.com',
    PCT_PART:  '60.00',
  },
  AC2: {
    NOM_ACCI:  'Sandra Milena',
    APE_ACCI:  'Niño Castillo',
    NUM_DOCU:  '35678901',
    FEC_EXPE:  '2011-08-14',
    DIR_ACCI:  'Carrera 7 # 27-18 Apto 501',
    CEL_ACCI:  '3183456789',
    TEL_ACCI:  '6017890123',
    MAIL_ACCI: 'sandra.nino@gmail.com',
    PCT_PART:  '40.00',
  },

  // Sección 9 — Financiera
  FIN: {
    ACT_TOTAL:  '850000000',
    ING_MENS:   '120000000',
    PAS_TOTAL:  '320000000',
    EGR_MENS:   '95000000',
    PATRIMONIO: '530000000',
    OTR_ING:    '8500000',
  },

  // Sección 10 — Bancaria
  BANCO: {
    NUM_CUEN:    '20012345678',
    CUEN_EXTR:   'N',
    NOM_ENT_EXT: '',
    TIP_CUE_EXT: '',
  },

  // Sección 11 — PEP
  PEP: {
    MAN_RPUB: 'N',
    CAR_PUBL: 'N',
  },

  // Sección 12 — Beneficiarios finales
  BF: {
    TIP_BENE:  'N',
    NOM_BENE:  'Jorge Luis',
    APE_BENE:  'Ramírez López',
    NUM_DOCU:  '19456789',
    FEC_EXPE:  '2008-02-28',
    DIR_BENE:  'Calle 134 # 55-20 Casa 12',
    TEL_BENE:  '3012345678',
    MAIL_BENE: 'jorge.ramirez@gmail.com',
  },

  // Sección 13 — Firma
  FIRMA: {
    NOM_FIRM:  'Carlos Alberto',
    APE_FIRM:  'Martínez Gómez',
    NUM_DOCU:  '79512345',
    FEC_FIRMA: new Date().toISOString().slice(0, 10),
  },
};

/* ─── Helpers internos ───────────────────────────────────────────────────────── */

/** Pone un valor en un <input> o <textarea> y dispara los eventos. */
function _setInput(id, val) {
  const el = document.getElementById(id);
  if (!el) { console.warn('[dev-fill] No encontrado:', id); return; }
  el.value = val ?? '';
  el.dispatchEvent(new Event('input',  { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Pone un valor en un <select> y dispara 'change'. */
function _setSelect(id, val) {
  const el = document.getElementById(id);
  if (!el || val == null) { if (!el) console.warn('[dev-fill] No encontrado:', id); return; }
  el.value = String(val);
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Pone un valor en un <input type="radio"> por name+value y dispara 'change'. */
function _setRadio(name, val) {
  const el = document.querySelector(`input[name="${name}"][value="${val}"]`);
  if (!el) { console.warn('[dev-fill] Radio no encontrado:', name, val); return; }
  el.checked = true;
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Llama a fetch y devuelve el JSON, o [] si hay error. */
async function _fetch(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch (e) {
    console.warn('[dev-fill] fetch error:', url, e.message);
    return [];
  }
}

/** Devuelve el primer valor de un array de objetos que tenga la clave dada. */
function _primero(arr, key) {
  return arr && arr.length ? arr[0][key] : null;
}

/** Espera ms milisegundos. */
const _esperar = ms => new Promise(r => setTimeout(r, ms));

/**
 * Selecciona País → Departamento → Ciudad en una cascada geográfica y
 * actualiza el objeto de estado indicado.
 *
 * Usa _setSelect() que dispara 'change' en el select nativo, activando
 * automáticamente el onchange del HTML (onPaisChange, onACPaisChange, etc.).
 * Así no se duplica la ejecución ni hay que pasar funciones de cascade.
 *
 * @param {string}   idPais     ID del select de país
 * @param {string}   idDept     ID del select de departamento
 * @param {string}   idMpio     ID del select de ciudad
 * @param {*}        codPais    Código de país a seleccionar
 * @param {Object}   ref        Objeto de estado (formData.basica, miem, ac, etc.)
 * @param {string}   campoDept  Clave de COD_DEPT en ref
 * @param {string}   campoMpio  Clave de COD_MPIO en ref
 */
async function _fillGeoCascade(idPais, idDept, idMpio, codPais, ref, campoDept, campoMpio) {
  _setSelect(idPais, codPais);        // dispara onchange → carga departamentos
  await _esperar(700);

  const selDept = document.getElementById(idDept);
  if (selDept && selDept.options.length > 1) {
    const codDept = selDept.options[1].value;
    if (ref && campoDept) ref[campoDept] = codDept;
    _setSelect(idDept, codDept);      // dispara onchange → carga ciudades
    await _esperar(700);
  }

  const selMpio = document.getElementById(idMpio);
  if (selMpio && selMpio.options.length > 1) {
    const codMpio = selMpio.options[1].value;
    if (ref && campoMpio) ref[campoMpio] = codMpio;
    _setSelect(idMpio, codMpio);
  }
}

/* ─── Función principal de relleno ──────────────────────────────────────────── */

async function rellenarPrueba() {
  const btn = document.getElementById('_dev_fill_btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Cargando catálogos…'; }

  try {
    /* ── Cargar todos los catálogos en paralelo ───────────────────────────── */
    const [tiposDoc, paises, vinculaciones, ciius, bancos, tiposCuenta] =
      await Promise.all([
        _fetch('/api/catalogo/tipos-documento'),
        _fetch('/api/catalogo/paises'),
        _fetch('/api/catalogo/vinculaciones'),
        _fetch('/api/catalogo/ciiu'),
        _fetch('/api/catalogo/bancos'),
        _fetch('/api/catalogo/tipos-cuenta'),
      ]);

    if (btn) btn.textContent = '⏳ Rellenando sección 1…';

    /* ════════════════════════════════════════════════════════════════════════
       SECCIÓN 1 — Información básica
    ════════════════════════════════════════════════════════════════════════ */
    const codTpdoc = _primero(tiposDoc, 'COD_TPDOC');
    const codPais  = _primero(paises,   'COD_PAIS') ?? COD_COLOMBIA;

    if (codTpdoc != null) {
      _setSelect('cod_tpdoc', codTpdoc);
      actualizarFormData('basica', 'COD_TPDOC', codTpdoc);
    }

    _setInput('num_iden', _TEST.NUM_IDEN);  actualizarFormData('basica', 'NUM_IDEN', _TEST.NUM_IDEN);
    // Verificar duplicado solo en modo creación — en modo actualizar el NIT ya
    // existe por definición (es el registro que se edita) y causaría un ciclo
    // de modal → redirección → dev-fill → modal.
    const _devModo = new URLSearchParams(window.location.search).get('modo');
    if (typeof verificarDuplicado === 'function' && _devModo !== 'actualizar') {
      verificarDuplicado(_TEST.NUM_IDEN);
    }
    _setInput('dig_veri', _TEST.DIG_VERI);  actualizarFormData('basica', 'DIG_VERI', _TEST.DIG_VERI);
    _setInput('nom_comp', _TEST.NOM_COMP);  actualizarFormData('basica', 'NOM_COMP', _TEST.NOM_COMP);

    const codVinc = _primero(vinculaciones, 'COD_VINC');
    if (codVinc != null) {
      // COD_VINC es int en el catálogo; se convierte a string porque TIP_VINC es varchar
      _setSelect('cod_vinc', codVinc);
      actualizarFormData('basica', 'COD_VINC', String(codVinc));
    }

    // País de expedición → Colombia (con cascada dept → ciudad)
    actualizarFormData('basica', 'COD_PAIS_EXP', codPais);
    await _fillGeoCascade(
      'cod_pais_exp', 'cod_dept_exp', 'cod_mpio_exp',
      codPais, formData.basica, 'COD_DEPT_EXP', 'COD_MPIO_EXP'
    );

    _setInput('dir_terc',  _TEST.DIR_TERC);  actualizarFormData('basica', 'DIR_TERC',  _TEST.DIR_TERC);
    _setInput('tel_terc',  _TEST.TEL_TERC);  actualizarFormData('basica', 'TEL_TERC',  _TEST.TEL_TERC);
    _setInput('tel_terc2', _TEST.TEL_TERC2); actualizarFormData('basica', 'TEL_TERC2', _TEST.TEL_TERC2);
    _setInput('dir_mail',  _TEST.DIR_MAIL);  actualizarFormData('basica', 'DIR_MAIL',  _TEST.DIR_MAIL);
    _setInput('mail_sarl', _TEST.MAIL_SARL); actualizarFormData('basica', 'MAIL_SARL', _TEST.MAIL_SARL);
    _setInput('url_web',   _TEST.URL_WEB);   actualizarFormData('basica', 'URL_WEB',   _TEST.URL_WEB);

    // CIIU — ahora es un select (no datalist), usar _setSelect directamente
    if (ciius.length) {
      const codCiiu = _primero(ciius, 'COD_CIIU');
      if (codCiiu != null) {
        _setSelect('cod_ciiu', codCiiu);
        actualizarFormData('basica', 'COD_CIIU', codCiiu);
      }
    }

    if (btn) btn.textContent = '⏳ Sección 2 — Rep. legal…';

    /* ════════════════════════════════════════════════════════════════════════
       SECCIÓN 2 — Representante Legal Principal
       Solo se rellenan los campos DOM del Principal (rl_p_*); el Suplente
       se actualiza en estado pero sus IDs estáticos no existen en el DOM.
    ════════════════════════════════════════════════════════════════════════ */
    // Nota: representantes[1] (suplente) fue eliminado del estado inicial;
    // solo existe el Principal en formData.representantes[0].
    // Estado + DOM del Principal con cascada geo completa
    Object.assign(formData.representantes[0], {
      TIP_REPR: 'P', TIP_DOCU: codTpdoc, COD_PAIS: codPais,
      COD_DEPT: null, COD_MPIO: null, ..._TEST.RL,
    });
    _setInput( 'rl_p_nom',    _TEST.RL.NOM_REPR);
    _setInput( 'rl_p_ape',    _TEST.RL.APE_REPR);
    _setInput( 'rl_p_numdoc', _TEST.RL.NUM_DOCU);
    _setInput( 'rl_p_fec',    _TEST.RL.FEC_EXPE);
    _setInput( 'rl_p_dir',    _TEST.RL.DIR_REPR);
    _setInput( 'rl_p_cel',    _TEST.RL.CEL_REPR);
    _setInput( 'rl_p_tel',    _TEST.RL.TEL_REPR);
    _setInput( 'rl_p_mail',   _TEST.RL.MAIL_REPR);
    _setSelect('rl_p_tipdoc', codTpdoc);

    // Cascada País → Dept → Ciudad
    await _fillGeoCascade(
      'rl_p_pais', 'rl_p_dept', 'rl_p_mpio',
      codPais, formData.representantes[0], 'COD_DEPT', 'COD_MPIO'
    );

    if (btn) btn.textContent = '⏳ Sección 3 — Sociedad…';

    /* ════════════════════════════════════════════════════════════════════════
       SECCIÓN 3 — Información de la sociedad
    ════════════════════════════════════════════════════════════════════════ */
    formData.sociedad.UBIC_SOC     = 'N';
    formData.sociedad.TIP_EMPR     = _TEST.TIP_EMPR;
    formData.sociedad.GRUP_EMPR    = _TEST.GRUP_EMPR;
    formData.sociedad.REL_GRUPO    = _TEST.REL_GRUPO;
    formData.sociedad.COD_PAIS_SOC = null;

    // IDs correctos: soc_ubic (select), soc_tip_empr (select), soc_grup_empr (select)
    _setSelect('soc_ubic',     'N');
    _setSelect('soc_tip_empr', _TEST.TIP_EMPR);
    _setSelect('soc_grup_empr', 'N');

    if (btn) btn.textContent = '⏳ Sección 4 — Países…';

    /* ════════════════════════════════════════════════════════════════════════
       SECCIÓN 4 — Países de operación
    ════════════════════════════════════════════════════════════════════════ */
    formData.paises[0].COD_PAIS = codPais;
    const selPais0 = document.querySelector('[id^="pais_sel_"]');
    if (selPais0) {
      selPais0.value = String(codPais);
      selPais0.dispatchEvent(new Event('change', { bubbles: true }));
    }

    if (btn) btn.textContent = '⏳ Sección 5 — Cumplimiento…';

    /* ════════════════════════════════════════════════════════════════════════
       SECCIÓN 5 — Sistema de cumplimiento
    ════════════════════════════════════════════════════════════════════════ */
    formData.cumplimiento.DESC_NORM = _TEST.DESC_NORM;
    formData.cumplimiento.NORM_LAFT = _TEST.NORM_LAFT;
    formData.cumplimiento.TIE_JUNTA = 'N';
    formData.cumplimiento.SIS_PREVE = null;

    // IDs correctos: cump_desc_norm (textarea), cump_norm_laft (input), cump_tie_sist (radio name)
    _setInput('cump_desc_norm', _TEST.DESC_NORM);
    _setInput('cump_norm_laft', _TEST.NORM_LAFT);
    _setRadio('cump_tie_sist',  'N');

    if (btn) btn.textContent = '⏳ Sección 6 — Junta directiva…';

    /* ════════════════════════════════════════════════════════════════════════
       SECCIÓN 6 — Junta directiva
       IDs reales: jd_{id}_p_{campo}
    ════════════════════════════════════════════════════════════════════════ */
    formData.juntaDirectiva.TIE_JUNTA = 'S';
    _setRadio('jd_tie_junta', 'S');
    await _esperar(150);

    if (formData.juntaDirectiva.miembros.length === 0) {
      if (typeof agregarJD === 'function') agregarJD();
      await _esperar(200);
    }

    if (formData.juntaDirectiva.miembros.length > 0) {
      // Estructura PLANA: { _id, TIP_REPR, NOM_MIEM, APE_MIEM, ... } — sin .Principal
      const miem = formData.juntaDirectiva.miembros[0];
      const jdId = miem._id;
      Object.assign(miem, {
        TIP_MIEM:  _TEST.JD.TIP_MIEM,
        NOM_MIEM:  _TEST.JD.NOM_MIEM,
        APE_MIEM:  _TEST.JD.APE_MIEM,
        TIP_DOCU:  codTpdoc,
        NUM_DOCU:  _TEST.JD.NUM_DOCU,
        FEC_EXPE:  _TEST.JD.FEC_EXPE,
        COD_PAIS:  codPais,
        DIR_MIEM:  _TEST.JD.DIR_MIEM,
        TEL_MIEM:  _TEST.JD.TEL_MIEM,
        MAIL_MIEM: _TEST.JD.MAIL_MIEM,
      });
      // IDs reales: jd_{id}_tipmiem, jd_{id}_nom, jd_{id}_ape, etc.
      _setInput( `jd_${jdId}_tipmiem`, _TEST.JD.TIP_MIEM);
      _setInput( `jd_${jdId}_nom`,     _TEST.JD.NOM_MIEM);
      _setInput( `jd_${jdId}_ape`,     _TEST.JD.APE_MIEM);
      _setInput( `jd_${jdId}_numdoc`,  _TEST.JD.NUM_DOCU);
      _setInput( `jd_${jdId}_fec`,     _TEST.JD.FEC_EXPE);
      _setInput( `jd_${jdId}_dir`,     _TEST.JD.DIR_MIEM);
      _setInput( `jd_${jdId}_tel`,     _TEST.JD.TEL_MIEM);
      _setInput( `jd_${jdId}_mail`,    _TEST.JD.MAIL_MIEM);
      _setSelect(`jd_${jdId}_tipdoc`,  codTpdoc);
      // Cascada País → Dept → Ciudad
      await _fillGeoCascade(
        `jd_${jdId}_pais`, `jd_${jdId}_dept`, `jd_${jdId}_mpio`,
        codPais, miem, 'COD_DEPT', 'COD_MPIO'
      );
    }

    if (btn) btn.textContent = '⏳ Sección 7 — Revisores fiscales…';

    /* ════════════════════════════════════════════════════════════════════════
       SECCIÓN 7 — Revisores fiscales
       IDs reales: rf_{id}_p_{campo}
    ════════════════════════════════════════════════════════════════════════ */
    formData.revisores.TIE_REVIS = 'S';
    _setRadio('rf_tie_revis', 'S');
    await _esperar(150);

    if (formData.revisores.revisores.length === 0) {
      if (typeof agregarRF === 'function') agregarRF();
      await _esperar(200);
    }

    if (formData.revisores.revisores.length > 0) {
      // Estructura PLANA: { _id, TIP_REPR, REVI_FIRMA, NOM_REVI, ... } — sin .Principal
      const rev  = formData.revisores.revisores[0];
      const rfId = rev._id;
      Object.assign(rev, {
        NOM_REVI:    _TEST.RF.NOM_REVI,
        APE_REVI:    _TEST.RF.APE_REVI,
        RAZ_REVI:    _TEST.RF.RAZ_REVI,
        TIP_DOCU:    codTpdoc,
        NUM_DOCU:    _TEST.RF.NUM_DOCU,
        FEC_EXPE:    _TEST.RF.FEC_EXPE,
        COD_PAIS:    codPais,
        DIR_REVI:    _TEST.RF.DIR_REVI,
        CEL_REVI:    _TEST.RF.CEL_REVI,
        TEL_REVI:    _TEST.RF.TEL_REVI,
        MAIL_REVI:   _TEST.RF.MAIL_REVI,
        OBS_REVI:    _TEST.RF.OBS_REVI,
        REVI_FIRMA:  'N',
        RAZ_FIRMA:   null,
        TIP_DOCU_FIR: null,
        NUM_DOCU_FIR: null,
      });

      // IDs reales: rf_{id}_nom, rf_{id}_ape, etc.
      _setInput( `rf_${rfId}_nom`,    _TEST.RF.NOM_REVI);
      _setInput( `rf_${rfId}_ape`,    _TEST.RF.APE_REVI);
      _setInput( `rf_${rfId}_numdoc`, _TEST.RF.NUM_DOCU);
      _setInput( `rf_${rfId}_fec`,    _TEST.RF.FEC_EXPE);
      _setInput( `rf_${rfId}_cel`,    _TEST.RF.CEL_REVI);
      _setInput( `rf_${rfId}_tel`,    _TEST.RF.TEL_REVI);
      _setInput( `rf_${rfId}_mail`,   _TEST.RF.MAIL_REVI);
      _setInput( `rf_${rfId}_obs`,    _TEST.RF.OBS_REVI);
      _setSelect(`rf_${rfId}_tipdoc`, codTpdoc);
      _setRadio( `rf_firma_${rfId}`,  'N');
      // Cascada País → Dept → Ciudad
      await _fillGeoCascade(
        `rf_${rfId}_pais`, `rf_${rfId}_dept`, `rf_${rfId}_mpio`,
        codPais, rev, 'COD_DEPT', 'COD_MPIO'
      );
    }

    if (btn) btn.textContent = '⏳ Sección 8 — Accionistas…';

    /* ════════════════════════════════════════════════════════════════════════
       SECCIÓN 8 — Composición accionaria (2 accionistas = 100%)
       IDs reales: ac_{id}_{campo}
    ════════════════════════════════════════════════════════════════════════ */
    // renderListaAC resetea DOM + crea 1 accionista limpio; luego agregamos 1 más
    formData.accionistas = [];
    if (typeof renderListaAC === 'function') {
      await renderListaAC(); await _esperar(150);
    }
    if (typeof agregarAC === 'function') {
      await agregarAC(); await _esperar(150);
    }

    for (const [idx, datos] of [_TEST.AC, _TEST.AC2].entries()) {
      const ac = formData.accionistas[idx];
      if (!ac) continue;
      const acId = ac._id;
      Object.assign(ac, {
        TIP_DOCU: codTpdoc,
        COD_PAIS: codPais,
        COD_DEPT: null,
        COD_MPIO: null,
        ...datos,
      });
      // IDs: ac_{id}_{campo}
      _setInput( `ac_${acId}_nom`,    datos.NOM_ACCI);
      _setInput( `ac_${acId}_ape`,    datos.APE_ACCI);
      _setInput( `ac_${acId}_numdoc`, datos.NUM_DOCU);
      _setInput( `ac_${acId}_fec`,    datos.FEC_EXPE);
      _setInput( `ac_${acId}_dir`,    datos.DIR_ACCI);
      _setInput( `ac_${acId}_cel`,    datos.CEL_ACCI);
      _setInput( `ac_${acId}_tel`,    datos.TEL_ACCI);
      _setInput( `ac_${acId}_mail`,   datos.MAIL_ACCI);
      _setInput( `ac_${acId}_pct`,    datos.PCT_PART);
      _setSelect(`ac_${acId}_tipdoc`, codTpdoc);
      // Cascada País → Dept → Ciudad
      await _fillGeoCascade(
        `ac_${acId}_pais`, `ac_${acId}_dept`, `ac_${acId}_mpio`,
        codPais, ac, 'COD_DEPT', 'COD_MPIO'
      );
    }

    if (btn) btn.textContent = '⏳ Sección 9 — Financiera…';

    /* ════════════════════════════════════════════════════════════════════════
       SECCIÓN 9 — Información financiera
    ════════════════════════════════════════════════════════════════════════ */
    Object.entries(_TEST.FIN).forEach(([campo, val]) => {
      formData.financiera[campo] = Number(val);
      _setInput(campo.toLowerCase(), val);
    });

    if (btn) btn.textContent = '⏳ Sección 10 — Bancaria…';

    /* ════════════════════════════════════════════════════════════════════════
       SECCIÓN 10 — Información bancaria
       IDs reales: banco_{id}_banco, banco_{id}_tipcuen, banco_{id}_numcuen
       Radio:      banco_extr_{id}
    ════════════════════════════════════════════════════════════════════════ */
    // Limpiar el array y re-renderizar con una sola cuenta inicial
    formData.bancaria.length = 0;
    if (typeof renderListaBancaria === 'function') {
      renderListaBancaria();
      await _esperar(150);
    } else if (typeof agregarBanco === 'function') {
      agregarBanco(); await _esperar(150);
    }

    if (formData.bancaria.length > 0) {
      const banco     = formData.bancaria[0];
      const bId       = banco._id;
      const codBanco   = _primero(bancos,     'COD_BANCO');
      const codTipCuen = _primero(tiposCuenta, 'COD_TPCTA');

      Object.assign(banco, {
        COD_BANCO:   codBanco,
        TIP_CUEN:    codTipCuen,
        NUM_CUEN:    _TEST.BANCO.NUM_CUEN,
        CUEN_EXTR:   'N',
        NOM_ENT_EXT: null,
        TIP_CUE_EXT: null,
      });

      _setSelect(`banco_${bId}_banco`,   codBanco);
      _setSelect(`banco_${bId}_tipcuen`, codTipCuen);
      _setInput( `banco_${bId}_numcuen`, _TEST.BANCO.NUM_CUEN);
      _setRadio( `banco_extr_${bId}`,   'N');
    }

    if (btn) btn.textContent = '⏳ Sección 11 — PEP…';

    /* ════════════════════════════════════════════════════════════════════════
       SECCIÓN 11 — PEP + Actividades virtuales
    ════════════════════════════════════════════════════════════════════════ */
    formData.pep.MAN_RPUB = _TEST.PEP.MAN_RPUB;
    formData.pep.CAR_PUBL = _TEST.PEP.CAR_PUBL;
    // Radio names correctos: pep_man_rpub, pep_car_publ
    _setRadio('pep_man_rpub', _TEST.PEP.MAN_RPUB);
    _setRadio('pep_car_publ', _TEST.PEP.CAR_PUBL);

    // Actividades virtuales: todas en 'N', CERT_INFO en 'S'
    if (formData.actividades) {
      Object.keys(formData.actividades).forEach(k => {
        formData.actividades[k] = k === 'CERT_INFO' ? 'S' : 'N';
        _setRadio(k.toLowerCase(), formData.actividades[k]);
        const chk = document.querySelector(`input[type="checkbox"][name="${k.toLowerCase()}"]`);
        if (chk) {
          chk.checked = (k === 'CERT_INFO');
          chk.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    }
    const chkCert = document.getElementById('cert_info');
    if (chkCert) {
      chkCert.checked = true;
      chkCert.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (formData.actividades) formData.actividades.CERT_INFO = 'S';

    if (btn) btn.textContent = '⏳ Sección 12 — Beneficiarios…';

    /* ════════════════════════════════════════════════════════════════════════
       SECCIÓN 12 — Beneficiarios finales
       IDs reales: bf_{id}_{campo}
    ════════════════════════════════════════════════════════════════════════ */
    formData.beneficiarios = [];
    if (typeof renderListaBF === 'function') {
      await renderListaBF(); await _esperar(150);
    }

    if (formData.beneficiarios.length > 0) {
      const bf   = formData.beneficiarios[0];
      const bfId = bf._id;
      Object.assign(bf, {
        TIP_DOCU: codTpdoc,
        COD_PAIS: codPais,
        COD_DEPT: null,
        COD_MPIO: null,
        ..._TEST.BF,
      });
      // IDs: bf_{id}_{campo}
      _setInput( `bf_${bfId}_nom`,    _TEST.BF.NOM_BENE);
      _setInput( `bf_${bfId}_ape`,    _TEST.BF.APE_BENE);
      _setInput( `bf_${bfId}_numdoc`, _TEST.BF.NUM_DOCU);
      _setInput( `bf_${bfId}_fec`,    _TEST.BF.FEC_EXPE);
      _setInput( `bf_${bfId}_tel`,    _TEST.BF.TEL_BENE);
      _setInput( `bf_${bfId}_mail`,   _TEST.BF.MAIL_BENE);
      _setSelect(`bf_${bfId}_tipdoc`, codTpdoc);
      // Cascada País → Dept → Ciudad
      await _fillGeoCascade(
        `bf_${bfId}_pais`, `bf_${bfId}_dept`, `bf_${bfId}_mpio`,
        codPais, bf, 'COD_DEPT', 'COD_MPIO'
      );
    }

    if (btn) btn.textContent = '⏳ Sección 13 — Firma…';

    /* ════════════════════════════════════════════════════════════════════════
       SECCIÓN 13 — Firma del representante legal
       IDs reales: firma_nom, firma_ape, firma_tipdoc, firma_numdoc, firma_fec
    ════════════════════════════════════════════════════════════════════════ */
    Object.assign(formData.firma, {
      TIP_DOCU: codTpdoc,
      ..._TEST.FIRMA,
    });
    _setInput( 'firma_nom',    _TEST.FIRMA.NOM_FIRM);
    _setInput( 'firma_ape',    _TEST.FIRMA.APE_FIRM);
    _setInput( 'firma_numdoc', _TEST.FIRMA.NUM_DOCU);
    _setInput( 'firma_fec',    _TEST.FIRMA.FEC_FIRMA);
    _setSelect('firma_tipdoc', codTpdoc);

    /* ── Listo ─────────────────────────────────────────────────────────────── */
    console.log('✅ [dev-fill] formData final:', JSON.parse(JSON.stringify(formData)));
    if (btn) {
      btn.disabled    = false;
      btn.textContent = '✅ Relleno completado';
      setTimeout(() => { btn.textContent = '🧪 Rellenar prueba'; }, 3000);
    }
    mostrarToast('Formulario de prueba rellenado correctamente.', 'success');

  } catch (err) {
    console.error('[dev-fill] Error:', err);
    if (btn) {
      btn.disabled    = false;
      btn.textContent = '❌ Error — ver consola';
      setTimeout(() => { btn.textContent = '🧪 Rellenar prueba'; }, 3000);
    }
    mostrarToast('Error en relleno automático: ' + err.message, 'error');
  }
}

/* ─── Inyección del botón flotante ───────────────────────────────────────────── */
(function _inyectarBoton() {
  const btn = document.createElement('button');
  btn.id          = '_dev_fill_btn';
  btn.textContent = '🧪 Rellenar prueba';
  btn.title       = 'Rellena todos los campos con datos ficticios de prueba (solo desarrollo)';
  Object.assign(btn.style, {
    position:     'fixed',
    bottom:       '16px',
    left:         '16px',
    zIndex:       '9999',
    padding:      '10px 16px',
    background:   '#ff6d00',
    color:        '#fff',
    border:       'none',
    borderRadius: '8px',
    fontWeight:   '700',
    fontSize:     '13px',
    cursor:       'pointer',
    boxShadow:    '0 4px 12px rgba(0,0,0,0.3)',
    letterSpacing: '0.3px',
  });
  btn.addEventListener('mouseenter', () => btn.style.background = '#e65100');
  btn.addEventListener('mouseleave', () => btn.style.background = '#ff6d00');
  btn.addEventListener('click', rellenarPrueba);
  document.body.appendChild(btn);
  console.log('%c[dev-fill] Modo prueba activo — botón 🧪 disponible. También: rellenarPrueba()',
              'color:#ff6d00; font-weight:bold');
})();

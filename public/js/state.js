/**
 * state.js — Estado global del formulario SAGRILAFT (Persona Jurídica)
 *
 * Patrón: cada sección del formulario tiene su propia sub-clave en `formData`.
 * Al agregar un nuevo acordeón, basta con añadir su clave aquí siguiendo el
 * mismo esquema { CAMPO: valorInicial }.
 *
 * Orden de carga: debe cargarse ANTES que cualquier otro script JS.
 */
'use strict';

/* ── Estado central del formulario ─────────────────────────────────────────── */
const formData = {

  // Sección 1 — Información básica de la empresa
  basica: {
    TIP_TERC:     'J',   // fijo: persona jurídica
    COD_TPDOC:    null,
    NUM_IDEN:     '',
    DIG_VERI:     '',   // Dígito de verificación del NIT (GN_TERCE)
    NOM_COMP:     '',
    COD_PAIS_EXP: null,
    OTR_PAIS_EXP: '',   // texto libre cuando país = 'OTRO'
    COD_DEPT_EXP: null,
    COD_MPIO_EXP: null,
    DIR_TERC:     '',
    TEL_TERC:     '',
    TEL_TERC2:    '',
    DIR_MAIL:     '',
    COD_VINC:     null,
    OTR_VINC:     '',   // texto libre cuando vinculación = "Otro"
    MAIL_SARL:    '',
    COD_CIIU:     null,
    OTR_CIIU:     '',   // texto libre cuando CIIU = "Otro"
    URL_WEB:      '',
  },

  // Sección 2 — Representantes legales
  // Solo el Principal en el estado inicial. Representantes adicionales se
  // agregan dinámicamente con agregarRLExtra() y se mapean en _rlExtraMap.
  // El suplente vacío fue eliminado: causaba que validarBloqueRL(1) siempre
  // fallara aunque el usuario no hubiera agregado ningún representante extra.
  representantes: [
    {
      TIP_REPR: 'P', NOM_REPR: '', APE_REPR: '', TIP_DOCU: null,
      NUM_DOCU: '', FEC_EXPE: '', COD_PAIS: null, OTR_PAIS: '',
      COD_DEPT: null, COD_MPIO: null, DIR_REPR: '', CEL_REPR: '', TEL_REPR: '', MAIL_REPR: '',
    },
  ],

  // Sección 3 — Información de la sociedad
  sociedad: {
    UBIC_SOC:     'N',   // 'N' = Nacional | 'E' = Extranjera | 'SC' = Sucursal en Colombia
    COD_PAIS_SOC: null,  // solo si UBIC_SOC = 'E'
    OTR_PAIS_SOC: '',    // texto libre cuando COD_PAIS_SOC = 'OTRO'
    TIP_EMPR:     null,  // 'PUBLICA' | 'PRIVADA' | 'MIXTA'
    GRUP_EMPR:    null,  // 'S' | 'N'
    REL_GRUPO:    '',    // Rol en el grupo: MATRIZ / FILIAL / SUCURSAL / etc. (GN_JURID_CUMP)
  },

  // Sección 4 — Países de operación
  paises: [
    { COD_PAIS: null },  // una entrada por país; se agregan/eliminan dinámicamente
  ],

  // Sección 5 — Sistema de cumplimiento
  cumplimiento: {
    DESC_NORM:  '',   // textarea: normatividad aplicable (siempre requerida)
    NORM_LAFT:  '',   // Referencia específica normativa LA/FT, ej. "LEY XXXX DE 2026"
    TIE_JUNTA:  'N', // radio: ¿tiene sistema implementado? — 'S' | 'N'

    // Solo aplican cuando TIE_JUNTA = 'S':
    SIS_PREVE: null,  // FK → MAE_SIST_PREV
    OTR_PREVE: '',   // texto libre cuando sistema prevención = "Otro"

    // Oficial de cumplimiento (Principal + Suplente)
    oficiales: [
      {
        TIP_REPR: 'P', TIP_DOCU: null, NUM_DOCU: '', FEC_EXPE: '',
        NOM_RESP: '', APE_RESP: '', RAZ_RESP: '',
        COD_PAIS: null, COD_DEPT: null, COD_MPIO: null,
        DIR_RESP: '', TEL_RESP: '', MAIL_RESP: '',
      },
      {
        TIP_REPR: 'S', TIP_DOCU: null, NUM_DOCU: '', FEC_EXPE: '',
        NOM_RESP: '', APE_RESP: '', RAZ_RESP: '',
        COD_PAIS: null, COD_DEPT: null, COD_MPIO: null,
        DIR_RESP: '', TEL_RESP: '', MAIL_RESP: '',
      },
    ],
  },

  // Sección 6 — Junta directiva / Consejo de administración
  juntaDirectiva: {
    TIE_JUNTA: 'N',    // 'S' | 'N'
    miembros:  [],     // array de { _id, Principal, Suplente }
  },

  // Sección 7 — Revisores fiscales
  revisores: {
    TIE_REVIS: 'N',
    revisores: [],     // array de { _id, Principal, Suplente }
  },

  // Sección 8 — Composición accionaria
  accionistas: [],     // array de { _id, NOM_ACCI, … PCT_PART }

  // Sección 9 — Información financiera
  financiera: {
    ACT_TOTAL:  null,
    ING_MENS:   null,
    PAS_TOTAL:  null,
    EGR_MENS:   null,
    PATRIMONIO: null,
    OTR_ING:    null,
  },

  // Sección 10 — Información bancaria (lista dinámica)
  bancaria: [],

  // Sección 11a — Exposición política (PEP)
  pep: {
    MAN_RPUB: null,
    CAR_PUBL: null,
  },

  // Sección 11b — Actividades con activos virtuales
  actividades: {
    ACT_VA_FIAT:  'N',
    ACT_VA_VA:    'N',
    ACT_TRANS:    'N',
    ACT_CUSTO:    'N',
    ACT_SERV_FIN: 'N',
    ACT_SERV_VAP: 'N',
    CERT_INFO:    'N',
  },

  // Sección 12 — Beneficiarios finales (GN_JURID_BF)
  beneficiarios: [],

  // Sección 13A — Firma del Representante Legal (GN_JURID_FIRMA)
  firma: {
    NOM_FIRM:  null,
    APE_FIRM:  null,
    TIP_DOCU:  null,
    NUM_DOCU:  null,
    FEC_FIRMA: null,
    // ARCH_FIRMA: el File vive en _archivos (seccion-docs.js), no se serializa
  },

  // Sección 13B — Documentos requeridos (GN_TERCE_DOC)
  // Solo se persiste el nombre del archivo seleccionado; el File vive en _archivos.
  documentos: {
    RUT:       null,
    CERT_BANC: null,
    CERT_EXIS: null,
    DOC_ID_RL: null,
    EST_FIN:   null,
    CERT_ACCI: null,
    CART_ACEP: null,
    ARCH_FIRMA: null,
  },

};

/* ── Constantes globales ────────────────────────────────────────────────────── */

/**
 * Código de Colombia en MAE_PAIS.
 * Ajustar si el valor real en la BD difiere.
 */
const COD_COLOMBIA = '1';

/**
 * Cache en memoria de respuestas de los endpoints de catálogo.
 * Evita peticiones duplicadas al cambiar cascadas.
 */
const catalogCache = {};

const BORRADOR_BASE_KEY = 'formularioSarlaftBorrador';
let _draftTimer = null;

/**
 * Devuelve la clave de localStorage para el borrador actual.
 * Si el formulario tiene NUM_IDEN cargado, usa una clave específica por NIT
 * para que distintos borradores no se sobreescriban entre sí.
 */
function _borradorKey() {
  const numIden = (formData.basica && formData.basica.NUM_IDEN)
    ? String(formData.basica.NUM_IDEN).trim()
    : '';
  return numIden ? `${BORRADOR_BASE_KEY}_${numIden}` : BORRADOR_BASE_KEY;
}

/**
 * Guarda el estado actual en localStorage como borrador.
 * La clave incluye el NIT cuando ya está disponible.
 */
function guardarBorrador() {
  try {
    // Incluir formDataNatur bajo _natur para que el borrador sobreviva recargas en modo Natural
    const datos = { ...formData };
    if (window.formDataNatur) datos._natur = window.formDataNatur;
    localStorage.setItem(_borradorKey(), JSON.stringify(datos));
  } catch (err) {
    console.error('guardarBorrador():', err);
  }
}

/**
 * Guarda el estado actual en localStorage con debounce.
 */
function guardarBorradorDebounced() {
  clearTimeout(_draftTimer);
  _draftTimer = setTimeout(guardarBorrador, 300);
}

/**
 * Elimina el borrador guardado (clave actual y clave genérica).
 */
function borrarBorrador() {
  try {
    localStorage.removeItem(_borradorKey());
    localStorage.removeItem(BORRADOR_BASE_KEY);
  } catch (err) {
    console.error('borrarBorrador():', err);
  }
}

/**
 * Carga el borrador desde localStorage.
 * Primero intenta con la clave NIT-específica (si NUM_IDEN está en la URL),
 * luego con la clave genérica.
 * Devuelve true si se encontró un borrador válido.
 */
function cargarBorrador() {
  try {
    // Detectar numIden desde la URL (?numIden=...)
    const urlParams = new URLSearchParams(window.location.search);
    const numIdenUrl = urlParams.get('numIden') || '';
    const claveEspecifica = numIdenUrl
      ? `${BORRADOR_BASE_KEY}_${numIdenUrl}`
      : null;

    const raw = (claveEspecifica && localStorage.getItem(claveEspecifica))
      || localStorage.getItem(BORRADOR_BASE_KEY);

    if (!raw) return false;
    const datos = JSON.parse(raw);
    if (!datos || typeof datos !== 'object') return false;

    // Restaurar formData (jurídica y campos compartidos)
    Object.keys(formData).forEach(key => {
      if (datos[key] !== undefined) formData[key] = datos[key];
    });

    // Restaurar formDataNatur si el borrador lo contiene (modo Persona Natural)
    if (datos._natur && window.formDataNatur) {
      Object.keys(formDataNatur).forEach(key => {
        if (datos._natur[key] !== undefined) formDataNatur[key] = datos._natur[key];
      });
      // Restablecer el modo visual si el borrador era de persona natural
      if (datos.basica && datos.basica.TIP_TERC === 'N' && typeof onTipTercChange === 'function') {
        onTipTercChange('N');
      }
    }

    return true;
  } catch (err) {
    console.error('cargarBorrador():', err);
    return false;
  }
}

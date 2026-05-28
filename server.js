/**
 * server.js — API REST para formulario SARLAFT (Persona Jurídica)
 * Base de datos: MineDax (SQL Server)
 *
 * Endpoints de catálogos (GET, solo lectura):
 *   /api/catalogo/tipos-documento
 *   /api/catalogo/paises
 *   /api/catalogo/departamentos?cod_pais=XX
 *   /api/catalogo/ciudades?cod_dept=XX&cod_pais=XX
 *   /api/catalogo/vinculaciones
 *   /api/catalogo/ciiu
 *
 * Endpoint de escritura (POST):
 *   /api/juridica  → inserta en GN_TERCE + GN_JURID
 */

require('dotenv').config();
const express = require('express');
const sql     = require('mssql');
const cors    = require('cors');
const path    = require('path');
const multer  = require('multer');
const fs      = require('fs');
const ExcelJS = require('exceljs');

// ─── Configuración de multer para subida de documentos ──────────────────────
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const _multerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const numIden = req.params.numIden || req.body.NUM_IDEN || 'sin_id';
    const dir = path.join(UPLOAD_DIR, String(numIden));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const base = file.fieldname;
    cb(null, `${base}${ext}`);
  },
});
const upload = multer({
  storage: _multerStorage,
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10 MB por archivo
});

const app  = express();
const PORT = process.env.PORT || 3000;

// TIP_TERC para personas jurídicas — configurable en .env si la BD lo requiere.
// Visitar GET /api/debug/tip-terc para ver qué valores acepta la constraint GNC03TERCE.
const TIP_TERC_JURID = process.env.TIP_TERC_JURID || 'J';

// ─── Configuración SQL Server ────────────────────────────────────────────────
// Ajusta estos valores según tu entorno Windows / IIS
const dbConfig = {
  server:   process.env.DB_SERVER   || 'localhost',       // nombre o IP del servidor
  database: process.env.DB_NAME     || 'MineDax',
  user:     process.env.DB_USER     || 'sa',
  password: process.env.DB_PASSWORD || 'LetItHappen35*',
  options: {
    encrypt:                false,   // true si usas Azure
    trustServerCertificate: true,    // requerido en SQL Server local/auto-firmado
    enableArithAbort:       true,
  },
  pool: {
    max:              10,
    min:              0,
    idleTimeoutMillis: 30000,
  },
};

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));   // sirve index.html

// ─── Pool de conexiones global ────────────────────────────────────────────────
let pool;
async function getPool() {
  if (!pool) {
    pool = await sql.connect(dbConfig);
    console.log('✅  Conectado a SQL Server — MineDax');
  }
  return pool;
}

// ─── Helper: ejecutar query con parámetros ────────────────────────────────────
async function query(queryStr, params = {}) {
  const p = await getPool();
  const req = p.request();
  for (const [key, { type, value }] of Object.entries(params)) {
    req.input(key, type, value);
  }
  const result = await req.query(queryStr);
  return result.recordset;
}

// ─── Constantes y helpers globales (accesibles en todos los endpoints) ────────
const COD_EMPR  = Number(process.env.COD_EMPR || 1);
const ACT_USUA_GLOBAL = (process.env.APP_USER || 'SARLAFT').padEnd(8, ' ').slice(0, 8);

/** Convierte cualquier valor a entero o null. */
const intOrNull = v => (v != null && v !== '' && !isNaN(Number(v))) ? Number(v) : null;

/**
 * Convierte cualquier valor a string o null.
 * Evita "Validation failed … Invalid string" cuando el frontend envía un número
 * JS en un campo que en la BD es varchar/char.
 */
const strOrNull = v => (v != null && v !== '') ? String(v) : null;

// ═══════════════════════════════════════════════════════════════════════════════
//  DEBUG — Endpoint temporal para diagnosticar la constraint GNC03TERCE
//  Llamar: GET /api/debug/tip-terc   (eliminar en producción)
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/debug/tip-terc', async (req, res) => {
  try {
    const rows = await query(`
      -- Definición de la constraint
      SELECT cc.name        AS constraint_name,
             cc.definition  AS constraint_definition
      FROM   sys.check_constraints cc
      JOIN   sys.tables            t  ON cc.parent_object_id = t.object_id
      JOIN   sys.columns           c  ON cc.parent_object_id = c.object_id
                                      AND cc.parent_column_id = c.column_id
      WHERE  t.name = 'GN_TERCE'
        AND  c.name = 'TIP_TERC';`);

    const existentes = await query(`
      -- Valores distintos de TIP_TERC en registros ya guardados
      SELECT DISTINCT TIP_TERC FROM GN_TERCE WHERE TIP_TERC IS NOT NULL;`);

    res.json({ constraint: rows, valoresExistentes: existentes });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  CATÁLOGOS — Solo lectura
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/catalogo/tipos-documento
 * Para personas jurídicas se devuelve solo NIT (COD_TPDOC = 8).
 * Si necesitas todos los tipos, agrega ?todos=1
 */
app.get('/api/catalogo/tipos-documento', async (req, res) => {
  try {
    const soloNit = req.query.todos !== '1';
    const rows = await query(
      `SELECT COD_TPDOC, NOM_TPDOC, COD_ABREV
         FROM MAE_TPDOC
        ${soloNit ? 'WHERE COD_TPDOC = 8' : ''}
        ORDER BY NOM_TPDOC`
    );
    res.json(rows);
  } catch (err) {
    console.error('tipos-documento:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/catalogo/paises
 * Colombia (IND_PRINCI = 'S') va primero, luego el resto alfabéticamente.
 */
app.get('/api/catalogo/paises', async (req, res) => {
  try {
    const rows = await query(
      `SELECT COD_PAIS, NOM_PAIS, IND_PRINCI
         FROM MAE_PAIS
        ORDER BY CASE WHEN IND_PRINCI = 'S' THEN 0 ELSE 1 END, NOM_PAIS`
    );
    res.json(rows);
  } catch (err) {
    console.error('paises:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/catalogo/departamentos?cod_pais=XX
 * Devuelve los departamentos del país indicado.
 */
app.get('/api/catalogo/departamentos', async (req, res) => {
  const { cod_pais } = req.query;
  if (!cod_pais) return res.status(400).json({ error: 'Se requiere cod_pais' });
  try {
    const rows = await query(
      `SELECT COD_DEPT, NOM_DEPT, COD_PAIS
         FROM MAE_DEPT
        WHERE COD_PAIS = @cod_pais
        ORDER BY NOM_DEPT`,
      { cod_pais: { type: sql.VarChar(10), value: cod_pais } }
    );
    res.json(rows);
  } catch (err) {
    console.error('departamentos:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/catalogo/ciudades?cod_dept=XX&cod_pais=XX
 * Cuando cod_dept no viene (país extranjero), filtra solo por cod_pais.
 */
app.get('/api/catalogo/ciudades', async (req, res) => {
  const { cod_dept, cod_pais } = req.query;
  if (!cod_pais) return res.status(400).json({ error: 'Se requiere cod_pais' });
  try {
    let rows;
    if (cod_dept) {
      rows = await query(
        `SELECT COD_MUNI, NOM_MUNI, COD_DEPT, COD_PAIS
           FROM MAE_MUNI
          WHERE COD_DEPT = @cod_dept AND COD_PAIS = @cod_pais
          ORDER BY NOM_MUNI`,
        {
          cod_dept: { type: sql.VarChar(10), value: cod_dept },
          cod_pais: { type: sql.VarChar(10), value: cod_pais },
        }
      );
    } else {
      // País extranjero: ciudades internacionales de ese país
      rows = await query(
        `SELECT COD_MUNI, NOM_MUNI, COD_DEPT, COD_PAIS
           FROM MAE_MUNI
          WHERE COD_PAIS = @cod_pais
          ORDER BY NOM_MUNI`,
        { cod_pais: { type: sql.VarChar(10), value: cod_pais } }
      );
    }
    res.json(rows);
  } catch (err) {
    console.error('ciudades:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/catalogo/vinculaciones
 */
app.get('/api/catalogo/vinculaciones', async (req, res) => {
  try {
    const rows = await query(
      `SELECT COD_VINC, NOM_VINC FROM MAE_VINC ORDER BY NOM_VINC`
    );
    res.json(rows);
  } catch (err) {
    console.error('vinculaciones:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/catalogo/ciiu
 * Retorna código + nombre para el buscador del campo CIIU.
 */
app.get('/api/catalogo/ciiu', async (req, res) => {
  try {
    const rows = await query(
      `SELECT COD_CIIU, NOM_CIIU FROM MAE_CIIU ORDER BY COD_CIIU`
    );
    res.json(rows);
  } catch (err) {
    console.error('ciiu:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/catalogo/tipos-sociedad?ubicacion=N|E
 * Filtra MAE_TIP_SOCIE por UBIC_SOCIE:
 *   ubicacion=N → UBIC_SOCIE IN ('N','A')
 *   ubicacion=E → UBIC_SOCIE IN ('E','A')
 *   (sin param)  → todos los registros
 */
app.get('/api/catalogo/tipos-sociedad', async (req, res) => {
  const { ubicacion } = req.query;
  let where = '';
  if (ubicacion === 'N')      where = "WHERE UBIC_SOCIE IN ('N','A')";
  else if (ubicacion === 'E') where = "WHERE UBIC_SOCIE IN ('E','A')";
  try {
    const rows = await query(
      `SELECT COD_SOCIE, NOM_SOCIE, UBIC_SOCIE
         FROM MAE_TIP_SOCIE
        ${where}
        ORDER BY NOM_SOCIE`
    );
    res.json(rows);
  } catch (err) {
    console.error('tipos-sociedad:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/catalogo/sistemas-prevencion
 * Devuelve los sistemas de prevención LA/FT registrados en MAE_SIST_PREV.
 */
app.get('/api/catalogo/sistemas-prevencion', async (req, res) => {
  try {
    const rows = await query(
      `SELECT COD_SIST, NOM_SIST, COD_ABREV
         FROM MAE_SIST_PREV
        ORDER BY NOM_SIST`
    );
    res.json(rows);
  } catch (err) {
    console.error('sistemas-prevencion:', err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  ESCRITURA — Guardar persona jurídica
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/juridica
 * Body esperado (objeto plano con todos los campos del formulario).
 * Inserta primero en GN_TERCE y luego en GN_JURID dentro de una transacción.
 *
 * Campos GN_TERCE:
 *   TIP_TERC, COD_TPDOC, NUM_IDEN, NOM_COMP, COD_PAIS_EXP,
 *   DIR_TERC, TEL_TERC, TEL_TERC2, DIR_MAIL
 *
 * Campos GN_JURID (sección 1 + sección 3):
 *   NUM_IDEN (FK), COD_VINC, COD_DEPT_EXP, COD_MPIO_EXP,
 *   MAIL_SARL, COD_CIIU, URL_WEB,
 *   UBIC_SOC, COD_PAIS_SOC, TIP_EMPR, GRUP_EMPR, TIP_SOCIE
 */
app.post('/api/juridica', async (req, res) => {
  const d = req.body;

  // Validación mínima server-side
  const required = ['NUM_IDEN', 'NOM_COMP', 'COD_PAIS_EXP', 'DIR_TERC', 'TEL_TERC', 'DIR_MAIL', 'MAIL_SARL'];
  const missing  = required.filter(f => !d[f]);
  if (missing.length) {
    return res.status(400).json({ error: `Campos requeridos faltantes: ${missing.join(', ')}` });
  }

  let transaction;
  try {
    const p = await getPool();
    transaction = new sql.Transaction(p);
    await transaction.begin();

    const req1 = new sql.Request(transaction);

    // ── GN_TERCE ──────────────────────────────────────────────────────────────
    req1.input('TIP_TERC',    sql.Char(1),      'J');
    req1.input('COD_TPDOC',   sql.Int,           d.COD_TPDOC   || 8);
    req1.input('NUM_IDEN',    sql.VarChar(20),   d.NUM_IDEN);
    req1.input('DIG_VERI',    sql.Char(1),       d.DIG_VERI    || null);
    req1.input('NOM_COMP',    sql.VarChar(255),  d.NOM_COMP);
    req1.input('COD_PAIS_EXP',sql.VarChar(10),   d.COD_PAIS_EXP);
    req1.input('DIR_TERC',    sql.VarChar(255),  d.DIR_TERC);
    req1.input('TEL_TERC',    sql.VarChar(30),   d.TEL_TERC);
    req1.input('TEL_TERC2',   sql.VarChar(30),   d.TEL_TERC2   || null);
    req1.input('DIR_MAIL',    sql.VarChar(100),  d.DIR_MAIL);

    await req1.query(`
      INSERT INTO GN_TERCE
        (TIP_TERC, COD_TPDOC, NUM_IDEN, DIG_VERI, NOM_COMP, COD_PAIS_EXP, DIR_TERC, TEL_TERC, TEL_TERC2, DIR_MAIL)
      VALUES
        (@TIP_TERC, @COD_TPDOC, @NUM_IDEN, @DIG_VERI, @NOM_COMP, @COD_PAIS_EXP, @DIR_TERC, @TEL_TERC, @TEL_TERC2, @DIR_MAIL)
    `);

    // ── GN_JURID ──────────────────────────────────────────────────────────────
    const req2 = new sql.Request(transaction);
    req2.input('NUM_IDEN',     sql.VarChar(20),   d.NUM_IDEN);
    req2.input('COD_VINC',     sql.VarChar(10),   d.COD_VINC     || null);
    req2.input('COD_DEPT_EXP', sql.VarChar(10),   d.COD_DEPT_EXP || null);
    req2.input('COD_MPIO_EXP', sql.VarChar(10),   d.COD_MPIO_EXP || null);
    req2.input('MAIL_SARL',    sql.VarChar(100),  d.MAIL_SARL);
    req2.input('COD_CIIU',     sql.VarChar(10),   d.COD_CIIU     || null);
    req2.input('URL_WEB',      sql.VarChar(255),  d.URL_WEB      || null);
    // Sección 3 — Información de la sociedad
    req2.input('UBIC_SOC',     sql.Char(1),        d.UBIC_SOC     || null);
    req2.input('COD_PAIS_SOC', sql.VarChar(10),   d.COD_PAIS_SOC || null);
    req2.input('TIP_EMPR',     sql.VarChar(10),   d.TIP_EMPR     || null);
    req2.input('GRUP_EMPR',    sql.Char(1),        d.GRUP_EMPR    || null);
    req2.input('TIP_SOCIE',    sql.VarChar(10),   d.TIP_SOCIE    || null);

    await req2.query(`
      INSERT INTO GN_JURID
        (NUM_IDEN, COD_VINC, COD_DEPT_EXP, COD_MPIO_EXP, MAIL_SARL, COD_CIIU, URL_WEB,
         UBIC_SOC, COD_PAIS_SOC, TIP_EMPR, GRUP_EMPR, TIP_SOCIE)
      VALUES
        (@NUM_IDEN, @COD_VINC, @COD_DEPT_EXP, @COD_MPIO_EXP, @MAIL_SARL, @COD_CIIU, @URL_WEB,
         @UBIC_SOC, @COD_PAIS_SOC, @TIP_EMPR, @GRUP_EMPR, @TIP_SOCIE)
    `);

    await transaction.commit();
    res.json({ success: true, NUM_IDEN: d.NUM_IDEN });

  } catch (err) {
    if (transaction) await transaction.rollback().catch(() => {});
    console.error('POST /api/juridica:', err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  ESCRITURA — Representantes legales (GN_JURID_RL)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/representante-legal
 * Body: { NUM_IDEN: string, representantes: Array<RL> }
 *
 * Cada RL tiene:
 *   TIP_REPR, NOM_REPR, APE_REPR, TIP_DOCU, NUM_DOCU, FEC_EXPE,
 *   COD_PAIS, COD_DEPT, COD_MPIO, DIR_REPR, CEL_REPR, TEL_REPR, MAIL_REPR
 *
 * Si TIP_REPR='S' y NOM_REPR está vacío, no se inserta (suplente omitido).
 * Se ejecuta dentro de una transacción; los campos COD_EMPR y COD_TERC
 * se deben ajustar según el esquema real de GN_JURID_RL.
 */
app.post('/api/representante-legal', async (req, res) => {
  const { NUM_IDEN, representantes } = req.body;

  if (!NUM_IDEN || !Array.isArray(representantes) || representantes.length === 0) {
    return res.status(400).json({ error: 'Se requiere NUM_IDEN y al menos un representante' });
  }

  let transaction;
  try {
    const p = await getPool();
    transaction = new sql.Transaction(p);
    await transaction.begin();

    for (const rl of representantes) {
      // Suplente vacío → omitir
      if (rl.TIP_REPR === 'S' && (!rl.NOM_REPR || !String(rl.NOM_REPR).trim())) continue;

      // Validación mínima por fila
      const reqFields = ['TIP_REPR', 'NOM_REPR', 'APE_REPR', 'TIP_DOCU', 'NUM_DOCU',
                         'FEC_EXPE', 'COD_PAIS', 'COD_MPIO', 'DIR_REPR', 'CEL_REPR', 'MAIL_REPR'];
      const missing = reqFields.filter(f => !rl[f]);
      if (missing.length) {
        await transaction.rollback();
        return res.status(400).json({
          error: `Representante ${rl.TIP_REPR}: faltan campos ${missing.join(', ')}`
        });
      }

      const r = new sql.Request(transaction);
      r.input('NUM_IDEN',  sql.VarChar(20),   NUM_IDEN);
      r.input('TIP_REPR',  sql.Char(1),        rl.TIP_REPR);
      r.input('NOM_REPR',  sql.VarChar(100),   rl.NOM_REPR);
      r.input('APE_REPR',  sql.VarChar(100),   rl.APE_REPR);
      r.input('TIP_DOCU',  sql.Int,             Number(rl.TIP_DOCU));
      r.input('NUM_DOCU',  sql.VarChar(20),    rl.NUM_DOCU);
      r.input('FEC_EXPE',  sql.Date,            new Date(rl.FEC_EXPE));
      r.input('COD_PAIS',  sql.VarChar(10),    rl.COD_PAIS);
      // 'NA' es el valor centinela del frontend para "país extranjero, no aplica" → null en BD
      const codDeptDB = (!rl.COD_DEPT || rl.COD_DEPT === 'NA') ? null : rl.COD_DEPT;
      r.input('COD_DEPT',  sql.VarChar(10),    codDeptDB);
      r.input('COD_MPIO',  sql.VarChar(10),    rl.COD_MPIO);
      r.input('DIR_REPR',  sql.VarChar(255),   rl.DIR_REPR);
      r.input('CEL_REPR',  sql.VarChar(30),    rl.CEL_REPR);
      r.input('TEL_REPR',  sql.VarChar(30),    rl.TEL_REPR || null);
      r.input('MAIL_REPR', sql.VarChar(100),   rl.MAIL_REPR);

      await r.query(`
        INSERT INTO GN_JURID_RL
          (NUM_IDEN, TIP_REPR, NOM_REPR, APE_REPR, TIP_DOCU, NUM_DOCU,
           FEC_EXPE, COD_PAIS, COD_DEPT, COD_MPIO, DIR_REPR, CEL_REPR, TEL_REPR, MAIL_REPR)
        VALUES
          (@NUM_IDEN, @TIP_REPR, @NOM_REPR, @APE_REPR, @TIP_DOCU, @NUM_DOCU,
           @FEC_EXPE, @COD_PAIS, @COD_DEPT, @COD_MPIO, @DIR_REPR, @CEL_REPR, @TEL_REPR, @MAIL_REPR)
      `);
    }

    await transaction.commit();
    res.json({ success: true, insertados: representantes.length });

  } catch (err) {
    if (transaction) await transaction.rollback().catch(() => {});
    console.error('POST /api/representante-legal:', err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  ESCRITURA — Países de operación (GN_JURID_PAIS)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/paises-operacion
 * Body: { NUM_IDEN: string, paises: [{ COD_PAIS }] }
 * Inserta una fila en GN_JURID_PAIS por cada país declarado.
 * Entradas con COD_PAIS nulo o vacío se omiten sin error.
 */
app.post('/api/paises-operacion', async (req, res) => {
  const { NUM_IDEN, paises } = req.body;

  if (!NUM_IDEN || !Array.isArray(paises) || paises.length === 0) {
    return res.status(400).json({ error: 'Se requiere NUM_IDEN y al menos un país' });
  }

  const validos = paises.filter(p => p.COD_PAIS);
  if (validos.length === 0) {
    return res.status(400).json({ error: 'Ningún país válido en el listado' });
  }

  let transaction;
  try {
    const p = await getPool();
    transaction = new sql.Transaction(p);
    await transaction.begin();

    for (const { COD_PAIS } of validos) {
      const r = new sql.Request(transaction);
      r.input('NUM_IDEN', sql.VarChar(20), NUM_IDEN);
      r.input('COD_PAIS', sql.VarChar(10), COD_PAIS);
      await r.query(`
        INSERT INTO GN_JURID_PAIS (NUM_IDEN, COD_PAIS)
        VALUES (@NUM_IDEN, @COD_PAIS)
      `);
    }

    await transaction.commit();
    res.json({ success: true, insertados: validos.length });

  } catch (err) {
    if (transaction) await transaction.rollback().catch(() => {});
    console.error('POST /api/paises-operacion:', err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  ESCRITURA — Sistema de cumplimiento (GN_JURID_CUMP)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/cumplimiento
 * Body: { NUM_IDEN, DESC_NORM, TIE_JUNTA, SIS_PREVE, oficiales: [...] }
 *
 * Lógica de inserción en GN_JURID_CUMP:
 *   1. Siempre: una fila "cabecera" con DESC_NORM, TIE_JUNTA y SIS_PREVE.
 *      TIP_REPR = NULL en esta fila (no es un oficial).
 *   2. Si TIE_JUNTA = 'S': una fila por cada oficial con datos
 *      (TIP_REPR 'P' o 'S'). Suplente vacío → se omite.
 *
 * COD_DEPT con valor 'NA' (centinela frontend país extranjero) → NULL en BD.
 */
app.post('/api/cumplimiento', async (req, res) => {
  const { NUM_IDEN, DESC_NORM, TIE_JUNTA, SIS_PREVE, oficiales } = req.body;

  if (!NUM_IDEN) {
    return res.status(400).json({ error: 'Se requiere NUM_IDEN' });
  }

  let transaction;
  try {
    const p = await getPool();
    transaction = new sql.Transaction(p);
    await transaction.begin();

    // ── Fila cabecera: normatividad + sistema ──────────────────────────────────
    const r0 = new sql.Request(transaction);
    r0.input('NUM_IDEN',  sql.VarChar(20),       NUM_IDEN);
    r0.input('DESC_NORM', sql.VarChar(sql.MAX),  DESC_NORM || null);
    r0.input('TIE_JUNTA', sql.Char(1),            TIE_JUNTA || 'N');
    r0.input('SIS_PREVE', sql.VarChar(10),        TIE_JUNTA === 'S' ? (SIS_PREVE || null) : null);

    await r0.query(`
      INSERT INTO GN_JURID_CUMP (NUM_IDEN, DESC_NORM, TIE_JUNTA, SIS_PREVE)
      VALUES (@NUM_IDEN, @DESC_NORM, @TIE_JUNTA, @SIS_PREVE)
    `);

    // ── Filas de oficial (solo si tiene sistema) ───────────────────────────────
    if (TIE_JUNTA === 'S' && Array.isArray(oficiales)) {
      for (const of of oficiales) {
        // Suplente vacío → omitir
        if (of.TIP_REPR === 'S' && (!of.NOM_RESP || !String(of.NOM_RESP).trim())) continue;

        const codDeptDB = (!of.COD_DEPT || of.COD_DEPT === 'NA') ? null : of.COD_DEPT;

        const r = new sql.Request(transaction);
        r.input('NUM_IDEN',  sql.VarChar(20),   NUM_IDEN);
        r.input('TIP_REPR',  sql.Char(1),        of.TIP_REPR);
        r.input('TIP_DOCU',  sql.Int,             of.TIP_DOCU  ? Number(of.TIP_DOCU)  : null);
        r.input('NUM_DOCU',  sql.VarChar(20),    of.NUM_DOCU  || null);
        r.input('FEC_EXPE',  sql.Date,            of.FEC_EXPE  ? new Date(of.FEC_EXPE) : null);
        r.input('NOM_RESP',  sql.VarChar(100),   of.NOM_RESP  || null);
        r.input('APE_RESP',  sql.VarChar(100),   of.APE_RESP  || null);
        r.input('RAZ_RESP',  sql.VarChar(255),   of.RAZ_RESP  || null);
        r.input('COD_PAIS',  sql.VarChar(10),    of.COD_PAIS  || null);
        r.input('COD_DEPT',  sql.VarChar(10),    codDeptDB);
        r.input('COD_MPIO',  sql.VarChar(10),    of.COD_MPIO  || null);
        r.input('DIR_RESP',  sql.VarChar(255),   of.DIR_RESP  || null);
        r.input('TEL_RESP',  sql.VarChar(30),    of.TEL_RESP  || null);
        r.input('MAIL_RESP', sql.VarChar(100),   of.MAIL_RESP || null);

        await r.query(`
          INSERT INTO GN_JURID_CUMP
            (NUM_IDEN, TIP_REPR, TIP_DOCU, NUM_DOCU, FEC_EXPE,
             NOM_RESP, APE_RESP, RAZ_RESP,
             COD_PAIS, COD_DEPT, COD_MPIO, DIR_RESP, TEL_RESP, MAIL_RESP)
          VALUES
            (@NUM_IDEN, @TIP_REPR, @TIP_DOCU, @NUM_DOCU, @FEC_EXPE,
             @NOM_RESP, @APE_RESP, @RAZ_RESP,
             @COD_PAIS, @COD_DEPT, @COD_MPIO, @DIR_RESP, @TEL_RESP, @MAIL_RESP)
        `);
      }
    }

    await transaction.commit();
    res.json({ success: true, NUM_IDEN });

  } catch (err) {
    if (transaction) await transaction.rollback().catch(() => {});
    console.error('POST /api/cumplimiento:', err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  ESCRITURA — Junta directiva (GN_JURID_JD)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/junta-directiva
 * Body: { NUM_IDEN, miembros: [{ _id, Principal:{…}, Suplente:{…} }] }
 * Por cada miembro inserta fila P; si Suplente.NOM_MIEM no está vacío, inserta fila S.
 * COD_DEPT='NA' → null en BD.
 */
app.post('/api/junta-directiva', async (req, res) => {
  const { NUM_IDEN, miembros } = req.body;
  if (!NUM_IDEN || !Array.isArray(miembros)) {
    return res.status(400).json({ error: 'Se requiere NUM_IDEN y miembros' });
  }

  const insertarJD = async (txn, NUM_IDEN, d, TIP_REPR) => {
    const dept = (!d.COD_DEPT || d.COD_DEPT === 'NA') ? null : d.COD_DEPT;
    const r = new sql.Request(txn);
    r.input('NUM_IDEN',  sql.VarChar(20),  NUM_IDEN);
    r.input('TIP_REPR',  sql.Char(1),       TIP_REPR);
    r.input('TIP_MIEM',  sql.VarChar(100),  d.TIP_MIEM  || null);
    r.input('NOM_MIEM',  sql.VarChar(100),  d.NOM_MIEM  || null);
    r.input('APE_MIEM',  sql.VarChar(100),  d.APE_MIEM  || null);
    r.input('RAZ_MIEM',  sql.VarChar(255),  d.RAZ_MIEM  || null);
    r.input('TIP_DOCU',  sql.Int,            d.TIP_DOCU  ? Number(d.TIP_DOCU) : null);
    r.input('NUM_DOCU',  sql.VarChar(20),   d.NUM_DOCU  || null);
    r.input('FEC_EXPE',  sql.Date,           d.FEC_EXPE  ? new Date(d.FEC_EXPE) : null);
    r.input('COD_PAIS',  sql.VarChar(10),   d.COD_PAIS  || null);
    r.input('COD_DEPT',  sql.VarChar(10),   dept);
    r.input('COD_MPIO',  sql.VarChar(10),   d.COD_MPIO  || null);
    r.input('DIR_MIEM',  sql.VarChar(255),  d.DIR_MIEM  || null);
    r.input('TEL_MIEM',  sql.VarChar(30),   d.TEL_MIEM  || null);
    r.input('MAIL_MIEM', sql.VarChar(100),  d.MAIL_MIEM || null);
    await r.query(`
      INSERT INTO GN_JURID_JD
        (NUM_IDEN,TIP_REPR,TIP_MIEM,NOM_MIEM,APE_MIEM,RAZ_MIEM,TIP_DOCU,NUM_DOCU,
         FEC_EXPE,COD_PAIS,COD_DEPT,COD_MPIO,DIR_MIEM,TEL_MIEM,MAIL_MIEM)
      VALUES
        (@NUM_IDEN,@TIP_REPR,@TIP_MIEM,@NOM_MIEM,@APE_MIEM,@RAZ_MIEM,@TIP_DOCU,@NUM_DOCU,
         @FEC_EXPE,@COD_PAIS,@COD_DEPT,@COD_MPIO,@DIR_MIEM,@TEL_MIEM,@MAIL_MIEM)`);
  };

  let transaction;
  try {
    const p = await getPool();
    transaction = new sql.Transaction(p);
    await transaction.begin();
    for (const m of miembros) {
      await insertarJD(transaction, NUM_IDEN, m.Principal, 'P');
      if (m.Suplente && m.Suplente.NOM_MIEM && String(m.Suplente.NOM_MIEM).trim()) {
        await insertarJD(transaction, NUM_IDEN, m.Suplente, 'S');
      }
    }
    await transaction.commit();
    res.json({ success: true, insertados: miembros.length });
  } catch (err) {
    if (transaction) await transaction.rollback().catch(() => {});
    console.error('POST /api/junta-directiva:', err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  ESCRITURA — Revisores fiscales (GN_JURID_RF)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/revisores-fiscales
 * Body: { NUM_IDEN, TIE_REVIS, revisores: [{ _id, Principal:{…}, Suplente:{…} }] }
 */
app.post('/api/revisores-fiscales', async (req, res) => {
  const { NUM_IDEN, TIE_REVIS, revisores } = req.body;
  if (!NUM_IDEN) return res.status(400).json({ error: 'Se requiere NUM_IDEN' });

  const insertarRF = async (txn, NUM_IDEN, d, TIP_REPR, TIE_REVIS) => {
    const dept = (!d.COD_DEPT || d.COD_DEPT === 'NA') ? null : d.COD_DEPT;
    const r = new sql.Request(txn);
    r.input('NUM_IDEN',     sql.VarChar(20),  NUM_IDEN);
    r.input('TIP_REPR',     sql.Char(1),       TIP_REPR);
    r.input('TIE_REVIS',    sql.Char(1),       TIE_REVIS || 'N');
    r.input('NOM_REVI',     sql.VarChar(100),  d.NOM_REVI     || null);
    r.input('APE_REVI',     sql.VarChar(100),  d.APE_REVI     || null);
    r.input('RAZ_REVI',     sql.VarChar(255),  d.RAZ_REVI     || null);
    r.input('TIP_DOCU',     sql.Int,            d.TIP_DOCU     ? Number(d.TIP_DOCU) : null);
    r.input('NUM_DOCU',     sql.VarChar(20),   d.NUM_DOCU     || null);
    r.input('FEC_EXPE',     sql.Date,           d.FEC_EXPE     ? new Date(d.FEC_EXPE) : null);
    r.input('COD_PAIS',     sql.VarChar(10),   d.COD_PAIS     || null);
    r.input('COD_DEPT',     sql.VarChar(10),   dept);
    r.input('COD_MPIO',     sql.VarChar(10),   d.COD_MPIO     || null);
    r.input('DIR_REVI',     sql.VarChar(255),  d.DIR_REVI     || null);
    r.input('CEL_REVI',     sql.VarChar(30),   d.CEL_REVI     || null);
    r.input('TEL_REVI',     sql.VarChar(30),   d.TEL_REVI     || null);
    r.input('MAIL_REVI',    sql.VarChar(100),  d.MAIL_REVI    || null);
    r.input('REVI_FIRMA',   sql.Char(1),        d.REVI_FIRMA   || 'N');
    r.input('RAZ_FIRMA',    sql.VarChar(255),  d.RAZ_FIRMA    || null);
    r.input('TIP_DOCU_FIR', sql.Int,            d.TIP_DOCU_FIR ? Number(d.TIP_DOCU_FIR) : null);
    r.input('NUM_DOCU_FIR', sql.VarChar(20),   d.NUM_DOCU_FIR || null);
    r.input('OBS_REVI',     sql.VarChar(sql.MAX), d.OBS_REVI  || null);
    await r.query(`
      INSERT INTO GN_JURID_RF
        (NUM_IDEN,TIP_REPR,TIE_REVIS,NOM_REVI,APE_REVI,RAZ_REVI,TIP_DOCU,NUM_DOCU,
         FEC_EXPE,COD_PAIS,COD_DEPT,COD_MPIO,DIR_REVI,CEL_REVI,TEL_REVI,MAIL_REVI,
         REVI_FIRMA,RAZ_FIRMA,TIP_DOCU_FIR,NUM_DOCU_FIR,OBS_REVI)
      VALUES
        (@NUM_IDEN,@TIP_REPR,@TIE_REVIS,@NOM_REVI,@APE_REVI,@RAZ_REVI,@TIP_DOCU,@NUM_DOCU,
         @FEC_EXPE,@COD_PAIS,@COD_DEPT,@COD_MPIO,@DIR_REVI,@CEL_REVI,@TEL_REVI,@MAIL_REVI,
         @REVI_FIRMA,@RAZ_FIRMA,@TIP_DOCU_FIR,@NUM_DOCU_FIR,@OBS_REVI)`);
  };

  let transaction;
  try {
    const p = await getPool();
    transaction = new sql.Transaction(p);
    await transaction.begin();

    if (TIE_REVIS === 'S' && Array.isArray(revisores)) {
      for (const rv of revisores) {
        await insertarRF(transaction, NUM_IDEN, rv.Principal, 'P', TIE_REVIS);
        if (rv.Suplente && rv.Suplente.NOM_REVI && String(rv.Suplente.NOM_REVI).trim()) {
          await insertarRF(transaction, NUM_IDEN, rv.Suplente, 'S', TIE_REVIS);
        }
      }
    } else {
      // Solo insertar fila cabecera con TIE_REVIS='N'
      const r0 = new sql.Request(transaction);
      r0.input('NUM_IDEN',  sql.VarChar(20), NUM_IDEN);
      r0.input('TIE_REVIS', sql.Char(1),      'N');
      await r0.query(`INSERT INTO GN_JURID_RF (NUM_IDEN,TIE_REVIS) VALUES (@NUM_IDEN,@TIE_REVIS)`);
    }

    await transaction.commit();
    res.json({ success: true });
  } catch (err) {
    if (transaction) await transaction.rollback().catch(() => {});
    console.error('POST /api/revisores-fiscales:', err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  ESCRITURA — Composición accionaria (GN_JURID_AC)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/accionistas
 * Body: { NUM_IDEN, accionistas: [{ NOM_ACCI, APE_ACCI, … PCT_PART }] }
 */
app.post('/api/accionistas', async (req, res) => {
  const { NUM_IDEN, accionistas } = req.body;
  if (!NUM_IDEN || !Array.isArray(accionistas) || accionistas.length === 0) {
    return res.status(400).json({ error: 'Se requiere NUM_IDEN y al menos un accionista' });
  }

  let transaction;
  try {
    const p = await getPool();
    transaction = new sql.Transaction(p);
    await transaction.begin();
    for (const a of accionistas) {
      const dept = (!a.COD_DEPT || a.COD_DEPT === 'NA') ? null : a.COD_DEPT;
      const r = new sql.Request(transaction);
      r.input('NUM_IDEN', sql.VarChar(20),     NUM_IDEN);
      r.input('NOM_ACCI', sql.VarChar(100),    a.NOM_ACCI || null);
      r.input('APE_ACCI', sql.VarChar(100),    a.APE_ACCI || null);
      r.input('RAZ_ACCI', sql.VarChar(255),    a.RAZ_ACCI || null);
      r.input('TIP_DOCU', sql.Int,              a.TIP_DOCU ? Number(a.TIP_DOCU) : null);
      r.input('NUM_DOCU', sql.VarChar(20),     a.NUM_DOCU || null);
      r.input('FEC_EXPE', sql.Date,             a.FEC_EXPE ? new Date(a.FEC_EXPE) : null);
      r.input('COD_PAIS', sql.VarChar(10),     a.COD_PAIS || null);
      r.input('COD_DEPT', sql.VarChar(10),     dept);
      r.input('COD_MPIO', sql.VarChar(10),     a.COD_MPIO || null);
      r.input('DIR_ACCI', sql.VarChar(255),    a.DIR_ACCI || null);
      r.input('CEL_ACCI', sql.VarChar(30),     a.CEL_ACCI || null);
      r.input('TEL_ACCI', sql.VarChar(30),     a.TEL_ACCI || null);
      r.input('MAIL_ACCI',sql.VarChar(100),    a.MAIL_ACCI|| null);
      r.input('PCT_PART', sql.Decimal(6, 2),   a.PCT_PART != null ? Number(a.PCT_PART) : null);
      await r.query(`
        INSERT INTO GN_JURID_AC
          (NUM_IDEN,NOM_ACCI,APE_ACCI,RAZ_ACCI,TIP_DOCU,NUM_DOCU,FEC_EXPE,
           COD_PAIS,COD_DEPT,COD_MPIO,DIR_ACCI,CEL_ACCI,TEL_ACCI,MAIL_ACCI,PCT_PART)
        VALUES
          (@NUM_IDEN,@NOM_ACCI,@APE_ACCI,@RAZ_ACCI,@TIP_DOCU,@NUM_DOCU,@FEC_EXPE,
           @COD_PAIS,@COD_DEPT,@COD_MPIO,@DIR_ACCI,@CEL_ACCI,@TEL_ACCI,@MAIL_ACCI,@PCT_PART)`);
    }
    await transaction.commit();
    res.json({ success: true, insertados: accionistas.length });
  } catch (err) {
    if (transaction) await transaction.rollback().catch(() => {});
    console.error('POST /api/accionistas:', err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  CATÁLOGOS — Bancaria
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/catalogo/bancos
 * Lista de bancos activos desde MAE_BANCO.
 */
app.get('/api/catalogo/bancos', async (req, res) => {
  try {
    const rows = await query(
      `SELECT COD_BANCO, NOM_BANCO
         FROM MAE_BANCO
        WHERE ACT_ESTA = 'A'
        ORDER BY NOM_BANCO`
    );
    res.json(rows);
  } catch (err) {
    console.error('bancos:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/catalogo/tipos-cuenta
 * Lista de tipos de cuenta desde MAE_TPCTA.
 */
app.get('/api/catalogo/tipos-cuenta', async (req, res) => {
  try {
    const rows = await query(
      `SELECT COD_TPCTA, NOM_TPCTA FROM MAE_TPCTA ORDER BY NOM_TPCTA`
    );
    res.json(rows);
  } catch (err) {
    console.error('tipos-cuenta:', err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  CONSULTA — Verificar si un número de identificación ya existe en GN_TERCE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/verificar-identidad/:numIden
 *
 * Responde { existe: true, NUM_IDEN, NOM_COMP, TIP_TPDOC, COD_TERC }
 *       o  { existe: false }
 */
app.get('/api/verificar-identidad/:numIden', async (req, res) => {
  const { numIden } = req.params;
  try {
    const pool = await sql.connect(dbConfig);
    const r    = pool.request();
    r.input('NUM_IDEN', sql.VarChar(20), numIden);
    r.input('COD_EMPR', sql.SmallInt, COD_EMPR);

    const result = await r.query(`
      SELECT TOP 1
        t.COD_TERC,
        t.NUM_IDEN,
        t.NOM_COMP,
        td.NOM_TDOC AS TIP_TPDOC
      FROM GN_TERCE t
      LEFT JOIN MAE_TIP_DOC td
        ON td.COD_TDOC = t.COD_TPDOC
      WHERE t.COD_EMPR = @COD_EMPR
        AND t.NUM_IDEN  = @NUM_IDEN
    `);

    if (result.recordset.length > 0) {
      res.json({ existe: true, ...result.recordset[0] });
    } else {
      res.json({ existe: false });
    }
  } catch (err) {
    console.error('GET /api/verificar-identidad:', err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  EXPORTACIÓN — Generar Excel con los datos de un tercero
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/exportar-excel/:codTerc
 *
 * Genera y descarga un archivo Excel con todos los datos registrados
 * del tercero identificado por COD_TERC.
 *
 * Si no se tiene COD_TERC, también acepta ?numIden=XXX para buscarlo.
 */
app.get('/api/exportar-excel/:codTerc', async (req, res) => {
  const codTerc = parseInt(req.params.codTerc, 10);
  if (!codTerc) return res.status(400).json({ error: 'codTerc inválido' });

  try {
    const pool = await sql.connect(dbConfig);

    // ── Consultar todas las tablas relevantes ────────────────────────────────
    const q = async (query, params = {}) => {
      const r = pool.request();
      r.input('COD_EMPR', sql.SmallInt, COD_EMPR);
      r.input('COD_TERC', sql.BigInt,   codTerc);
      Object.entries(params).forEach(([k, v]) => r.input(k, v[0], v[1]));
      return (await r.query(query)).recordset;
    };

    const [terce, jurid, rl, paises, cump, jd, rf, ac, fin, banco, pep, bf] = await Promise.all([
      q('SELECT * FROM GN_TERCE       WHERE COD_EMPR=@COD_EMPR AND COD_TERC=@COD_TERC'),
      q('SELECT * FROM GN_JURID       WHERE COD_EMPR=@COD_EMPR AND COD_TERC=@COD_TERC'),
      q('SELECT * FROM GN_JURID_RL    WHERE COD_EMPR=@COD_EMPR AND COD_TERC=@COD_TERC'),
      q('SELECT * FROM GN_JURID_PAIS  WHERE COD_EMPR=@COD_EMPR AND COD_TERC=@COD_TERC'),
      q('SELECT * FROM GN_JURID_CUMP  WHERE COD_EMPR=@COD_EMPR AND COD_TERC=@COD_TERC'),
      q('SELECT * FROM GN_JURID_JD    WHERE COD_EMPR=@COD_EMPR AND COD_TERC=@COD_TERC'),
      q('SELECT * FROM GN_JURID_RF    WHERE COD_EMPR=@COD_EMPR AND COD_TERC=@COD_TERC'),
      q('SELECT * FROM GN_JURID_AC    WHERE COD_EMPR=@COD_EMPR AND COD_TERC=@COD_TERC'),
      q('SELECT * FROM GN_JURID_FIN   WHERE COD_EMPR=@COD_EMPR AND COD_TERC=@COD_TERC'),
      q('SELECT * FROM GN_TERCE_BANCO WHERE COD_EMPR=@COD_EMPR AND COD_TERC=@COD_TERC'),
      q('SELECT * FROM GN_JURID_PEP   WHERE COD_EMPR=@COD_EMPR AND COD_TERC=@COD_TERC'),
      q('SELECT * FROM GN_JURID_BF    WHERE COD_EMPR=@COD_EMPR AND COD_TERC=@COD_TERC'),
    ]);

    // ── Construir libro Excel ─────────────────────────────────────────────────
    const wb = new ExcelJS.Workbook();
    wb.creator  = 'SARLAFT Sistema';
    wb.created  = new Date();

    const PRIMARY   = '1B5E20';
    const HEADER_BG = 'E8F5E9';
    const ACCENT    = '2E7D32';

    /**
     * Agrega una hoja con datos de una tabla.
     * @param {string}   name   Nombre de la hoja
     * @param {Array}    rows   Registros de la BD
     */
    function addSheet(name, rows) {
      const ws = wb.addWorksheet(name);

      if (!rows || rows.length === 0) {
        ws.addRow(['Sin datos registrados']);
        return;
      }

      const cols = Object.keys(rows[0]);

      // Fila de título
      ws.mergeCells(1, 1, 1, cols.length);
      const titleCell = ws.getCell(1, 1);
      titleCell.value = name;
      titleCell.font  = { bold: true, size: 13, color: { argb: 'FF' + PRIMARY } };
      titleCell.alignment = { horizontal: 'center' };

      // Cabecera
      const headerRow = ws.addRow(cols);
      headerRow.eachCell(cell => {
        cell.font    = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill    = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + ACCENT } };
        cell.border  = { bottom: { style: 'thin', color: { argb: 'FF' + PRIMARY } } };
        cell.alignment = { horizontal: 'center' };
      });

      // Datos
      rows.forEach((row, i) => {
        const dataRow = ws.addRow(cols.map(c => row[c] instanceof Date
          ? row[c].toLocaleDateString('es-CO')
          : (row[c] ?? '')));
        if (i % 2 === 0) {
          dataRow.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F8E9' } };
          });
        }
      });

      // Auto-ancho aproximado
      cols.forEach((col, idx) => {
        const maxLen = Math.max(col.length,
          ...rows.map(r => String(r[col] ?? '').length));
        ws.getColumn(idx + 1).width = Math.min(Math.max(maxLen + 2, 10), 40);
      });
    }

    addSheet('Datos Generales (GN_TERCE)',          terce);
    addSheet('Datos Jurídicos (GN_JURID)',           jurid);
    addSheet('Representantes Legales (GN_JURID_RL)', rl);
    addSheet('Países de Operación (GN_JURID_PAIS)',  paises);
    addSheet('Cumplimiento (GN_JURID_CUMP)',         cump);
    addSheet('Junta Directiva (GN_JURID_JD)',        jd);
    addSheet('Revisores Fiscales (GN_JURID_RF)',     rf);
    addSheet('Accionistas (GN_JURID_AC)',            ac);
    addSheet('Información Financiera (GN_JURID_FIN)',fin);
    addSheet('Cuentas Bancarias (GN_TERCE_BANCO)',   banco);
    addSheet('PEP (GN_JURID_PEP)',                   pep);
    addSheet('Beneficiarios Finales (GN_JURID_BF)',  bf);

    // ── Enviar como descarga ──────────────────────────────────────────────────
    const nomComp = (terce[0]?.NOM_COMP || `TERC_${codTerc}`)
      .replace(/[^a-zA-Z0-9_\-\s]/g, '').trim().replace(/\s+/g, '_');
    const filename = `SARLAFT_${nomComp}_${new Date().toISOString().slice(0,10)}.xlsx`;

    res.setHeader('Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',
      `attachment; filename="${filename}"`);

    await wb.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error('GET /api/exportar-excel:', err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  ESCRITURA — Guardar completo (todas las secciones en una transacción)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/guardar-completo
 *
 * Esquema real de MineDax:
 *  - Todas las tablas usan COD_EMPR (smallint) + COD_TERC (bigint) como PK/FK.
 *  - COD_PAIS_EXP está en GN_JURID, NO en GN_TERCE.
 *  - El campo de vinculación en GN_JURID se llama TIP_VINC (no COD_VINC).
 *  - COD_PAIS, COD_DEPT, COD_MPIO son INT en todas las tablas.
 *  - COD_BANCO y TIP_CUEN son INT en GN_TERCE_BANCO.
 *  - Todas las tablas requieren ACT_USUA (char 8), ACT_HORA (datetime), ACT_ESTA (char 1).
 *  - GN_JURID_JD NO tiene columna TIE_JUNTA.
 *  - GN_TERCE_DOC usa patrón fila-por-documento (TIP_DOC, NOM_DOC, RUT_DOC…).
 */
app.post('/api/guardar-completo', async (req, res) => {
  const d        = req.body;
  const ACT_USUA = ACT_USUA_GLOBAL;
  const ACT_HORA = new Date();
  const ACT_ESTA = 'A';

  if (!d.NUM_IDEN || !d.NOM_COMP || !d.DIR_TERC || !d.TEL_TERC || !d.DIR_MAIL) {
    return res.status(400).json({ error: 'Faltan campos obligatorios del tercero (sección 1).' });
  }

  let transaction;
  let COD_TERC;

  try {
    const p = await getPool();
    transaction = new sql.Transaction(p);
    await transaction.begin();

    // ── 1. GN_TERCE ────────────────────────────────────────────────────────────
    // TIP_TERC  = tipo de tercero (constraint GNC03TERCE — ver .env TIP_TERC_JURID)
    // TIP_VINCU = código de vinculación (MAE_VINC.COD_VINC, int → guardamos como int)
    // NUM_IDEN  = bigint; DIG_VERI = smallint
    // COD_PAIS_EXP / COD_DEPT_EXP / COD_MPIO_EXP van en GN_JURID, NO aquí.
    {
      const r = new sql.Request(transaction);
      r.input('COD_EMPR',  sql.SmallInt,     COD_EMPR);
      r.input('TIP_TERC',  sql.Char(1),       TIP_TERC_JURID);
      r.input('COD_TPDOC', sql.Int,            intOrNull(d.COD_TPDOC) || 8);
      r.input('NUM_IDEN',  sql.BigInt,         Number(d.NUM_IDEN));
      r.input('DIG_VERI',  sql.SmallInt,       intOrNull(d.DIG_VERI));
      r.input('NOM_COMP',  sql.VarChar(240),  d.NOM_COMP);
      r.input('DIR_TERC',  sql.Char(120),      d.DIR_TERC);
      r.input('TEL_TERC',  sql.Char(30),       d.TEL_TERC);
      r.input('TEL_TERC2', sql.Char(40),       d.TEL_TERC2 || null);
      r.input('DIR_MAIL',  sql.VarChar(150),  d.DIR_MAIL);
      r.input('ACT_USUA',  sql.Char(8),        ACT_USUA);
      r.input('ACT_HORA',  sql.DateTime,       ACT_HORA);
      r.input('ACT_ESTA',  sql.Char(1),        ACT_ESTA);
      const result = await r.query(`
        INSERT INTO GN_TERCE
          (COD_EMPR,TIP_TERC,COD_TPDOC,NUM_IDEN,DIG_VERI,NOM_COMP,
           DIR_TERC,TEL_TERC,TEL_TERC2,DIR_MAIL,ACT_USUA,ACT_HORA,ACT_ESTA)
        OUTPUT INSERTED.COD_TERC
        VALUES
          (@COD_EMPR,@TIP_TERC,@COD_TPDOC,@NUM_IDEN,@DIG_VERI,@NOM_COMP,
           @DIR_TERC,@TEL_TERC,@TEL_TERC2,@DIR_MAIL,@ACT_USUA,@ACT_HORA,@ACT_ESTA)`);
      COD_TERC = result.recordset[0].COD_TERC;
    }

    // ── 2. GN_JURID ────────────────────────────────────────────────────────────
    // COD_PAIS_EXP SÍ existe aquí (int).
    // El campo de vinculación es TIP_VINC (no COD_VINC).
    // COD_DEPT_EXP, COD_MPIO_EXP, COD_PAIS_SOC son int.
    {
      const r = new sql.Request(transaction);
      r.input('COD_EMPR',    sql.SmallInt,    COD_EMPR);
      r.input('COD_TERC',    sql.BigInt,       COD_TERC);
      // TIP_VINC / TIP_SOCIE / TIP_EMPR son varchar en GN_JURID pero reciben
      // el COD_* (int) del catálogo → strOrNull garantiza que lleguen como string.
      r.input('TIP_VINC',    sql.VarChar(40), strOrNull(d.COD_VINC));
      r.input('COD_PAIS_EXP',sql.Int,          intOrNull(d.COD_PAIS_EXP));
      r.input('COD_DEPT_EXP',sql.Int,          intOrNull(d.COD_DEPT_EXP));
      r.input('COD_MPIO_EXP',sql.Int,          intOrNull(d.COD_MPIO_EXP));
      r.input('MAIL_SARL',   sql.VarChar(150), strOrNull(d.MAIL_SARL));
      r.input('COD_CIIU',    sql.VarChar(10),  strOrNull(d.COD_CIIU));
      r.input('URL_WEB',     sql.VarChar(200), strOrNull(d.URL_WEB));
      r.input('UBIC_SOC',    sql.Char(1),       strOrNull(d.UBIC_SOC));
      r.input('COD_PAIS_SOC',sql.Int,           intOrNull(d.COD_PAIS_SOC));
      r.input('TIP_EMPR',    sql.VarChar(10),  strOrNull(d.TIP_EMPR));
      r.input('GRUP_EMPR',   sql.Char(1),       strOrNull(d.GRUP_EMPR));
      r.input('TIP_SOCIE',   sql.VarChar(60),  strOrNull(d.TIP_SOCIE));
      r.input('ACT_USUA',    sql.Char(8),      ACT_USUA);
      r.input('ACT_HORA',    sql.DateTime,     ACT_HORA);
      r.input('ACT_ESTA',    sql.Char(1),      ACT_ESTA);
      await r.query(`
        INSERT INTO GN_JURID
          (COD_EMPR,COD_TERC,TIP_VINC,COD_PAIS_EXP,COD_DEPT_EXP,COD_MPIO_EXP,
           MAIL_SARL,COD_CIIU,URL_WEB,UBIC_SOC,COD_PAIS_SOC,TIP_EMPR,GRUP_EMPR,TIP_SOCIE,
           ACT_USUA,ACT_HORA,ACT_ESTA)
        VALUES
          (@COD_EMPR,@COD_TERC,@TIP_VINC,@COD_PAIS_EXP,@COD_DEPT_EXP,@COD_MPIO_EXP,
           @MAIL_SARL,@COD_CIIU,@URL_WEB,@UBIC_SOC,@COD_PAIS_SOC,@TIP_EMPR,@GRUP_EMPR,@TIP_SOCIE,
           @ACT_USUA,@ACT_HORA,@ACT_ESTA)`);
    }

    // ── 3. GN_JURID_RL — Representantes legales ────────────────────────────────
    for (const rl of (d.representantes || [])) {
      if (rl.TIP_REPR === 'S' && (!rl.NOM_REPR || !String(rl.NOM_REPR).trim())) continue;
      const dept = (!rl.COD_DEPT || rl.COD_DEPT === 'NA') ? null : intOrNull(rl.COD_DEPT);
      const r = new sql.Request(transaction);
      r.input('COD_EMPR', sql.SmallInt,    COD_EMPR);
      r.input('COD_TERC', sql.BigInt,       COD_TERC);
      r.input('TIP_REPR', sql.Char(1),      rl.TIP_REPR);
      r.input('NOM_REPR', sql.VarChar(80), rl.NOM_REPR  || null);
      r.input('APE_REPR', sql.VarChar(80), rl.APE_REPR  || null);
      r.input('TIP_DOCU', sql.Int,           intOrNull(rl.TIP_DOCU));
      r.input('NUM_DOCU', sql.VarChar(20), rl.NUM_DOCU  || null);
      r.input('FEC_EXPE', sql.Date,          rl.FEC_EXPE ? new Date(rl.FEC_EXPE) : null);
      r.input('COD_PAIS', sql.Int,           intOrNull(rl.COD_PAIS));
      r.input('COD_DEPT', sql.Int,           dept);
      r.input('COD_MPIO', sql.Int,           intOrNull(rl.COD_MPIO));
      r.input('DIR_REPR', sql.VarChar(120),rl.DIR_REPR  || null);
      r.input('CEL_REPR', sql.VarChar(30), rl.CEL_REPR  || null);
      r.input('TEL_REPR', sql.VarChar(30), rl.TEL_REPR  || null);
      r.input('MAIL_REPR',sql.VarChar(150),rl.MAIL_REPR || null);
      r.input('ACT_USUA', sql.Char(8),      ACT_USUA);
      r.input('ACT_HORA', sql.DateTime,     ACT_HORA);
      r.input('ACT_ESTA', sql.Char(1),      ACT_ESTA);
      await r.query(`
        INSERT INTO GN_JURID_RL
          (COD_EMPR,COD_TERC,TIP_REPR,NOM_REPR,APE_REPR,TIP_DOCU,NUM_DOCU,
           FEC_EXPE,COD_PAIS,COD_DEPT,COD_MPIO,DIR_REPR,CEL_REPR,TEL_REPR,MAIL_REPR,
           ACT_USUA,ACT_HORA,ACT_ESTA)
        VALUES
          (@COD_EMPR,@COD_TERC,@TIP_REPR,@NOM_REPR,@APE_REPR,@TIP_DOCU,@NUM_DOCU,
           @FEC_EXPE,@COD_PAIS,@COD_DEPT,@COD_MPIO,@DIR_REPR,@CEL_REPR,@TEL_REPR,@MAIL_REPR,
           @ACT_USUA,@ACT_HORA,@ACT_ESTA)`);
    }

    // ── 4. GN_JURID_CUMP — Cumplimiento (cabecera + oficiales) ────────────────
    {
      const r = new sql.Request(transaction);
      r.input('COD_EMPR',  sql.SmallInt,      COD_EMPR);
      r.input('COD_TERC',  sql.BigInt,          COD_TERC);
      r.input('DESC_NORM', sql.VarChar(500),   strOrNull(d.DESC_NORM));
      r.input('NORM_LAFT', sql.VarChar(200),   strOrNull(d.NORM_LAFT));
      r.input('TIE_JUNTA', sql.Char(1),         d.cump_TIE_JUNTA || 'N');
      // SIS_PREVE viene de MAE_SIST_PREV (COD_SIST puede ser int) → strOrNull
      r.input('SIS_PREVE', sql.VarChar(60),    d.cump_TIE_JUNTA === 'S' ? strOrNull(d.SIS_PREVE) : null);
      r.input('REL_GRUPO', sql.VarChar(120),   strOrNull(d.REL_GRUPO));
      r.input('ACT_USUA',  sql.Char(8),         ACT_USUA);
      r.input('ACT_HORA',  sql.DateTime,        ACT_HORA);
      r.input('ACT_ESTA',  sql.Char(1),         ACT_ESTA);
      await r.query(`
        INSERT INTO GN_JURID_CUMP
          (COD_EMPR,COD_TERC,DESC_NORM,NORM_LAFT,TIE_JUNTA,SIS_PREVE,REL_GRUPO,ACT_USUA,ACT_HORA,ACT_ESTA)
        VALUES
          (@COD_EMPR,@COD_TERC,@DESC_NORM,@NORM_LAFT,@TIE_JUNTA,@SIS_PREVE,@REL_GRUPO,@ACT_USUA,@ACT_HORA,@ACT_ESTA)`);
    }
    if (d.cump_TIE_JUNTA === 'S') {
      for (const of_ of (d.oficiales || [])) {
        if (of_.TIP_REPR === 'S' && (!of_.NOM_RESP || !String(of_.NOM_RESP).trim())) continue;
        const dept = (!of_.COD_DEPT || of_.COD_DEPT === 'NA') ? null : intOrNull(of_.COD_DEPT);
        const r = new sql.Request(transaction);
        r.input('COD_EMPR',  sql.SmallInt,    COD_EMPR);
        r.input('COD_TERC',  sql.BigInt,       COD_TERC);
        r.input('TIP_REPR',  sql.Char(1),      of_.TIP_REPR);
        r.input('TIP_DOCU',  sql.Int,           intOrNull(of_.TIP_DOCU));
        r.input('NUM_DOCU',  sql.VarChar(20), of_.NUM_DOCU  || null);
        r.input('FEC_EXPE',  sql.Date,          of_.FEC_EXPE ? new Date(of_.FEC_EXPE) : null);
        r.input('NOM_RESP',  sql.VarChar(80), of_.NOM_RESP  || null);
        r.input('APE_RESP',  sql.VarChar(80), of_.APE_RESP  || null);
        r.input('RAZ_RESP',  sql.VarChar(200),of_.RAZ_RESP  || null);
        r.input('COD_PAIS',  sql.Int,           intOrNull(of_.COD_PAIS));
        r.input('COD_DEPT',  sql.Int,           dept);
        r.input('COD_MPIO',  sql.Int,           intOrNull(of_.COD_MPIO));
        r.input('DIR_RESP',  sql.VarChar(120),of_.DIR_RESP  || null);
        r.input('TEL_RESP',  sql.VarChar(40), of_.TEL_RESP  || null);
        r.input('MAIL_RESP', sql.VarChar(150),of_.MAIL_RESP || null);
        r.input('ACT_USUA',  sql.Char(8),      ACT_USUA);
        r.input('ACT_HORA',  sql.DateTime,     ACT_HORA);
        r.input('ACT_ESTA',  sql.Char(1),      ACT_ESTA);
        await r.query(`
          INSERT INTO GN_JURID_CUMP
            (COD_EMPR,COD_TERC,TIP_REPR,TIP_DOCU,NUM_DOCU,FEC_EXPE,
             NOM_RESP,APE_RESP,RAZ_RESP,COD_PAIS,COD_DEPT,COD_MPIO,DIR_RESP,TEL_RESP,MAIL_RESP,
             ACT_USUA,ACT_HORA,ACT_ESTA)
          VALUES
            (@COD_EMPR,@COD_TERC,@TIP_REPR,@TIP_DOCU,@NUM_DOCU,@FEC_EXPE,
             @NOM_RESP,@APE_RESP,@RAZ_RESP,@COD_PAIS,@COD_DEPT,@COD_MPIO,@DIR_RESP,@TEL_RESP,@MAIL_RESP,
             @ACT_USUA,@ACT_HORA,@ACT_ESTA)`);
      }
    }

    // ── 5. GN_JURID_PAIS — Países de operación ─────────────────────────────────
    // COD_PAIS es int (no varchar)
    for (const { COD_PAIS } of (d.paises || [])) {
      if (!COD_PAIS) continue;
      const r = new sql.Request(transaction);
      r.input('COD_EMPR', sql.SmallInt, COD_EMPR);
      r.input('COD_TERC', sql.BigInt,   COD_TERC);
      r.input('COD_PAIS', sql.Int,       intOrNull(COD_PAIS));
      r.input('ACT_USUA', sql.Char(8),  ACT_USUA);
      r.input('ACT_HORA', sql.DateTime, ACT_HORA);
      r.input('ACT_ESTA', sql.Char(1),  ACT_ESTA);
      await r.query(`
        INSERT INTO GN_JURID_PAIS (COD_EMPR,COD_TERC,COD_PAIS,ACT_USUA,ACT_HORA,ACT_ESTA)
        VALUES (@COD_EMPR,@COD_TERC,@COD_PAIS,@ACT_USUA,@ACT_HORA,@ACT_ESTA)`);
    }

    // ── 6. GN_JURID_JD — Junta directiva ───────────────────────────────────────
    // IMPORTANTE: GN_JURID_JD NO tiene columna TIE_JUNTA.
    // Si no hay junta ('N'), simplemente no se insertan filas.
    if (d.jd_TIE_JUNTA === 'S') {
      const insertJD = async (txn, data, TIP_REPR) => {
        const dept = (!data.COD_DEPT || data.COD_DEPT === 'NA') ? null : intOrNull(data.COD_DEPT);
        const r = new sql.Request(txn);
        r.input('COD_EMPR',  sql.SmallInt,    COD_EMPR);
        r.input('COD_TERC',  sql.BigInt,       COD_TERC);
        r.input('TIP_REPR',  sql.Char(1),      TIP_REPR);
        r.input('TIP_MIEM',  sql.VarChar(100),data.TIP_MIEM  || null);
        r.input('NOM_MIEM',  sql.VarChar(80), data.NOM_MIEM  || null);
        r.input('APE_MIEM',  sql.VarChar(80), data.APE_MIEM  || null);
        r.input('RAZ_MIEM',  sql.VarChar(200),data.RAZ_MIEM  || null);
        r.input('TIP_DOCU',  sql.Int,           intOrNull(data.TIP_DOCU));
        r.input('NUM_DOCU',  sql.VarChar(20), data.NUM_DOCU  || null);
        r.input('FEC_EXPE',  sql.Date,          data.FEC_EXPE ? new Date(data.FEC_EXPE) : null);
        r.input('COD_PAIS',  sql.Int,           intOrNull(data.COD_PAIS));
        r.input('COD_DEPT',  sql.Int,           dept);
        r.input('COD_MPIO',  sql.Int,           intOrNull(data.COD_MPIO));
        r.input('DIR_MIEM',  sql.VarChar(120),data.DIR_MIEM  || null);
        r.input('TEL_MIEM',  sql.VarChar(30), data.TEL_MIEM  || null);
        r.input('MAIL_MIEM', sql.VarChar(150),data.MAIL_MIEM || null);
        r.input('ACT_USUA',  sql.Char(8),      ACT_USUA);
        r.input('ACT_HORA',  sql.DateTime,     ACT_HORA);
        r.input('ACT_ESTA',  sql.Char(1),      ACT_ESTA);
        await r.query(`
          INSERT INTO GN_JURID_JD
            (COD_EMPR,COD_TERC,TIP_REPR,TIP_MIEM,NOM_MIEM,APE_MIEM,RAZ_MIEM,TIP_DOCU,NUM_DOCU,
             FEC_EXPE,COD_PAIS,COD_DEPT,COD_MPIO,DIR_MIEM,TEL_MIEM,MAIL_MIEM,ACT_USUA,ACT_HORA,ACT_ESTA)
          VALUES
            (@COD_EMPR,@COD_TERC,@TIP_REPR,@TIP_MIEM,@NOM_MIEM,@APE_MIEM,@RAZ_MIEM,@TIP_DOCU,@NUM_DOCU,
             @FEC_EXPE,@COD_PAIS,@COD_DEPT,@COD_MPIO,@DIR_MIEM,@TEL_MIEM,@MAIL_MIEM,@ACT_USUA,@ACT_HORA,@ACT_ESTA)`);
      };
      for (const m of (d.juntaDirectiva || [])) {
        await insertJD(transaction, m.Principal, 'P');
        if (m.Suplente && m.Suplente.NOM_MIEM && String(m.Suplente.NOM_MIEM).trim()) {
          await insertJD(transaction, m.Suplente, 'S');
        }
      }
    }

    // ── 7. GN_JURID_RF — Revisores fiscales ────────────────────────────────────
    if (d.rf_TIE_REVIS === 'S') {
      const insertRF = async (txn, data, TIP_REPR) => {
        const dept = (!data.COD_DEPT || data.COD_DEPT === 'NA') ? null : intOrNull(data.COD_DEPT);
        const r = new sql.Request(txn);
        r.input('COD_EMPR',     sql.SmallInt,       COD_EMPR);
        r.input('COD_TERC',     sql.BigInt,           COD_TERC);
        r.input('TIP_REPR',     sql.Char(1),           TIP_REPR);
        r.input('TIE_REVIS',    sql.Char(1),           'S');
        r.input('NOM_REVI',     sql.VarChar(80),      data.NOM_REVI     || null);
        r.input('APE_REVI',     sql.VarChar(80),      data.APE_REVI     || null);
        r.input('RAZ_REVI',     sql.VarChar(200),     data.RAZ_REVI     || null);
        r.input('TIP_DOCU',     sql.Int,               intOrNull(data.TIP_DOCU));
        r.input('NUM_DOCU',     sql.VarChar(20),      data.NUM_DOCU     || null);
        r.input('FEC_EXPE',     sql.Date,              data.FEC_EXPE     ? new Date(data.FEC_EXPE) : null);
        r.input('COD_PAIS',     sql.Int,               intOrNull(data.COD_PAIS));
        r.input('COD_DEPT',     sql.Int,               dept);
        r.input('COD_MPIO',     sql.Int,               intOrNull(data.COD_MPIO));
        r.input('DIR_REVI',     sql.VarChar(120),     data.DIR_REVI     || null);
        r.input('CEL_REVI',     sql.VarChar(30),      data.CEL_REVI     || null);
        r.input('TEL_REVI',     sql.VarChar(30),      data.TEL_REVI     || null);
        r.input('MAIL_REVI',    sql.VarChar(150),     data.MAIL_REVI    || null);
        r.input('REVI_FIRMA',   sql.Char(1),           data.REVI_FIRMA   || 'N');
        r.input('RAZ_FIRMA',    sql.VarChar(200),     data.RAZ_FIRMA    || null);
        r.input('TIP_DOCU_FIR', sql.Int,               intOrNull(data.TIP_DOCU_FIR));
        r.input('NUM_DOCU_FIR', sql.VarChar(20),      data.NUM_DOCU_FIR || null);
        r.input('OBS_REVI',     sql.VarChar(300),     data.OBS_REVI     || null);
        r.input('ACT_USUA',     sql.Char(8),           ACT_USUA);
        r.input('ACT_HORA',     sql.DateTime,          ACT_HORA);
        r.input('ACT_ESTA',     sql.Char(1),           ACT_ESTA);
        await r.query(`
          INSERT INTO GN_JURID_RF
            (COD_EMPR,COD_TERC,TIP_REPR,TIE_REVIS,NOM_REVI,APE_REVI,RAZ_REVI,TIP_DOCU,NUM_DOCU,
             FEC_EXPE,COD_PAIS,COD_DEPT,COD_MPIO,DIR_REVI,CEL_REVI,TEL_REVI,MAIL_REVI,
             REVI_FIRMA,RAZ_FIRMA,TIP_DOCU_FIR,NUM_DOCU_FIR,OBS_REVI,ACT_USUA,ACT_HORA,ACT_ESTA)
          VALUES
            (@COD_EMPR,@COD_TERC,@TIP_REPR,@TIE_REVIS,@NOM_REVI,@APE_REVI,@RAZ_REVI,@TIP_DOCU,@NUM_DOCU,
             @FEC_EXPE,@COD_PAIS,@COD_DEPT,@COD_MPIO,@DIR_REVI,@CEL_REVI,@TEL_REVI,@MAIL_REVI,
             @REVI_FIRMA,@RAZ_FIRMA,@TIP_DOCU_FIR,@NUM_DOCU_FIR,@OBS_REVI,@ACT_USUA,@ACT_HORA,@ACT_ESTA)`);
      };
      for (const rv of (d.revisores || [])) {
        const firmaFields = {
          REVI_FIRMA:   rv.REVI_FIRMA   || 'N',
          RAZ_FIRMA:    rv.RAZ_FIRMA    || null,
          TIP_DOCU_FIR: rv.TIP_DOCU_FIR || null,
          NUM_DOCU_FIR: rv.NUM_DOCU_FIR || null,
        };
        await insertRF(transaction, { ...rv.Principal, ...firmaFields }, 'P');
        if (rv.Suplente && rv.Suplente.NOM_REVI && String(rv.Suplente.NOM_REVI).trim()) {
          await insertRF(transaction, { ...rv.Suplente, ...firmaFields }, 'S');
        }
      }
    } else {
      const r0 = new sql.Request(transaction);
      r0.input('COD_EMPR',  sql.SmallInt, COD_EMPR);
      r0.input('COD_TERC',  sql.BigInt,   COD_TERC);
      r0.input('TIE_REVIS', sql.Char(1),  'N');
      r0.input('ACT_USUA',  sql.Char(8),  ACT_USUA);
      r0.input('ACT_HORA',  sql.DateTime, ACT_HORA);
      r0.input('ACT_ESTA',  sql.Char(1),  ACT_ESTA);
      await r0.query(`
        INSERT INTO GN_JURID_RF (COD_EMPR,COD_TERC,TIE_REVIS,ACT_USUA,ACT_HORA,ACT_ESTA)
        VALUES (@COD_EMPR,@COD_TERC,@TIE_REVIS,@ACT_USUA,@ACT_HORA,@ACT_ESTA)`);
    }

    // ── 8. GN_JURID_AC — Composición accionaria ─────────────────────────────────
    for (const a of (d.accionistas || [])) {
      const dept = (!a.COD_DEPT || a.COD_DEPT === 'NA') ? null : intOrNull(a.COD_DEPT);
      const r = new sql.Request(transaction);
      r.input('COD_EMPR', sql.SmallInt,    COD_EMPR);
      r.input('COD_TERC', sql.BigInt,       COD_TERC);
      r.input('NOM_ACCI', sql.VarChar(80), a.NOM_ACCI || null);
      r.input('APE_ACCI', sql.VarChar(80), a.APE_ACCI || null);
      r.input('RAZ_ACCI', sql.VarChar(200),a.RAZ_ACCI || null);
      r.input('TIP_DOCU', sql.Int,           intOrNull(a.TIP_DOCU));
      r.input('NUM_DOCU', sql.VarChar(20), a.NUM_DOCU || null);
      r.input('FEC_EXPE', sql.Date,          a.FEC_EXPE ? new Date(a.FEC_EXPE) : null);
      r.input('COD_PAIS', sql.Int,           intOrNull(a.COD_PAIS));
      r.input('COD_DEPT', sql.Int,           dept);
      r.input('COD_MPIO', sql.Int,           intOrNull(a.COD_MPIO));
      r.input('DIR_ACCI', sql.VarChar(120), a.DIR_ACCI || null);
      r.input('CEL_ACCI', sql.VarChar(30), a.CEL_ACCI || null);
      r.input('TEL_ACCI', sql.VarChar(30), a.TEL_ACCI || null);
      r.input('MAIL_ACCI',sql.VarChar(150),a.MAIL_ACCI|| null);
      r.input('PCT_PART', sql.Decimal(6,2), a.PCT_PART != null ? Number(a.PCT_PART) : null);
      r.input('ACT_USUA', sql.Char(8),      ACT_USUA);
      r.input('ACT_HORA', sql.DateTime,     ACT_HORA);
      r.input('ACT_ESTA', sql.Char(1),      ACT_ESTA);
      await r.query(`
        INSERT INTO GN_JURID_AC
          (COD_EMPR,COD_TERC,NOM_ACCI,APE_ACCI,RAZ_ACCI,TIP_DOCU,NUM_DOCU,FEC_EXPE,
           COD_PAIS,COD_DEPT,COD_MPIO,DIR_ACCI,CEL_ACCI,TEL_ACCI,MAIL_ACCI,PCT_PART,
           ACT_USUA,ACT_HORA,ACT_ESTA)
        VALUES
          (@COD_EMPR,@COD_TERC,@NOM_ACCI,@APE_ACCI,@RAZ_ACCI,@TIP_DOCU,@NUM_DOCU,@FEC_EXPE,
           @COD_PAIS,@COD_DEPT,@COD_MPIO,@DIR_ACCI,@CEL_ACCI,@TEL_ACCI,@MAIL_ACCI,@PCT_PART,
           @ACT_USUA,@ACT_HORA,@ACT_ESTA)`);
    }

    // ── 9. GN_JURID_FIN — Información financiera ───────────────────────────────
    {
      const fin = d.financiera || {};
      const r = new sql.Request(transaction);
      r.input('COD_EMPR',   sql.SmallInt,      COD_EMPR);
      r.input('COD_TERC',   sql.BigInt,          COD_TERC);
      r.input('ACT_TOTAL',  sql.Decimal(18,2),  fin.ACT_TOTAL  != null ? Number(fin.ACT_TOTAL)  : null);
      r.input('ING_MENS',   sql.Decimal(18,2),  fin.ING_MENS   != null ? Number(fin.ING_MENS)   : null);
      r.input('PAS_TOTAL',  sql.Decimal(18,2),  fin.PAS_TOTAL  != null ? Number(fin.PAS_TOTAL)  : null);
      r.input('EGR_MENS',   sql.Decimal(18,2),  fin.EGR_MENS   != null ? Number(fin.EGR_MENS)   : null);
      r.input('PATRIMONIO', sql.Decimal(18,2),  fin.PATRIMONIO != null ? Number(fin.PATRIMONIO) : null);
      r.input('OTR_ING',    sql.Decimal(18,2),  fin.OTR_ING    != null ? Number(fin.OTR_ING)    : null);
      r.input('ACT_USUA',   sql.Char(8),         ACT_USUA);
      r.input('ACT_HORA',   sql.DateTime,        ACT_HORA);
      r.input('ACT_ESTA',   sql.Char(1),         ACT_ESTA);
      await r.query(`
        INSERT INTO GN_JURID_FIN
          (COD_EMPR,COD_TERC,ACT_TOTAL,ING_MENS,PAS_TOTAL,EGR_MENS,PATRIMONIO,OTR_ING,
           ACT_USUA,ACT_HORA,ACT_ESTA)
        VALUES
          (@COD_EMPR,@COD_TERC,@ACT_TOTAL,@ING_MENS,@PAS_TOTAL,@EGR_MENS,@PATRIMONIO,@OTR_ING,
           @ACT_USUA,@ACT_HORA,@ACT_ESTA)`);
    }

    // ── 10. GN_TERCE_BANCO — Información bancaria ───────────────────────────────
    // COD_BANCO y TIP_CUEN son int (no varchar) en la BD
    for (const b of (d.bancaria || [])) {
      const r = new sql.Request(transaction);
      r.input('COD_EMPR',    sql.SmallInt,    COD_EMPR);
      r.input('COD_TERC',    sql.BigInt,       COD_TERC);
      r.input('COD_BANCO',   sql.Int,           intOrNull(b.COD_BANCO));
      r.input('TIP_CUEN',    sql.Int,           intOrNull(b.TIP_CUEN));
      r.input('NUM_CUEN',    sql.VarChar(30), b.NUM_CUEN    || null);
      r.input('CUEN_EXTR',   sql.Char(1),      b.CUEN_EXTR   || 'N');
      r.input('NOM_ENT_EXT', sql.VarChar(120),b.NOM_ENT_EXT || null);
      r.input('TIP_CUE_EXT', sql.VarChar(40), b.TIP_CUE_EXT || null);
      r.input('ACT_USUA',    sql.Char(8),      ACT_USUA);
      r.input('ACT_HORA',    sql.DateTime,     ACT_HORA);
      r.input('ACT_ESTA',    sql.Char(1),      ACT_ESTA);
      await r.query(`
        INSERT INTO GN_TERCE_BANCO
          (COD_EMPR,COD_TERC,COD_BANCO,TIP_CUEN,NUM_CUEN,CUEN_EXTR,NOM_ENT_EXT,TIP_CUE_EXT,
           ACT_USUA,ACT_HORA,ACT_ESTA)
        VALUES
          (@COD_EMPR,@COD_TERC,@COD_BANCO,@TIP_CUEN,@NUM_CUEN,@CUEN_EXTR,@NOM_ENT_EXT,@TIP_CUE_EXT,
           @ACT_USUA,@ACT_HORA,@ACT_ESTA)`);
    }

    // ── 11. GN_JURID_PEP — Exposición política ─────────────────────────────────
    {
      const pep = d.pep || {};
      const r = new sql.Request(transaction);
      r.input('COD_EMPR', sql.SmallInt, COD_EMPR);
      r.input('COD_TERC', sql.BigInt,   COD_TERC);
      r.input('MAN_RPUB', sql.Char(1),  pep.MAN_RPUB || null);
      r.input('CAR_PUBL', sql.Char(1),  pep.CAR_PUBL || null);
      r.input('ACT_USUA', sql.Char(8),  ACT_USUA);
      r.input('ACT_HORA', sql.DateTime, ACT_HORA);
      r.input('ACT_ESTA', sql.Char(1),  ACT_ESTA);
      await r.query(`
        INSERT INTO GN_JURID_PEP (COD_EMPR,COD_TERC,MAN_RPUB,CAR_PUBL,ACT_USUA,ACT_HORA,ACT_ESTA)
        VALUES (@COD_EMPR,@COD_TERC,@MAN_RPUB,@CAR_PUBL,@ACT_USUA,@ACT_HORA,@ACT_ESTA)`);
    }

    // ── 12. GN_JURID_ACT — Actividades con activos virtuales ───────────────────
    {
      const act = d.actividades || {};
      const r = new sql.Request(transaction);
      r.input('COD_EMPR',     sql.SmallInt, COD_EMPR);
      r.input('COD_TERC',     sql.BigInt,   COD_TERC);
      r.input('ACT_VA_FIAT',  sql.Char(1),  act.ACT_VA_FIAT  || 'N');
      r.input('ACT_VA_VA',    sql.Char(1),  act.ACT_VA_VA    || 'N');
      r.input('ACT_TRANS',    sql.Char(1),  act.ACT_TRANS    || 'N');
      r.input('ACT_CUSTO',    sql.Char(1),  act.ACT_CUSTO    || 'N');
      r.input('ACT_SERV_FIN', sql.Char(1),  act.ACT_SERV_FIN || 'N');
      r.input('ACT_SERV_VAP', sql.Char(1),  act.ACT_SERV_VAP || 'N');
      r.input('ACT_USUA', sql.Char(8),  ACT_USUA);
      r.input('ACT_HORA', sql.DateTime, ACT_HORA);
      r.input('ACT_ESTA', sql.Char(1),  ACT_ESTA);
      await r.query(`
        INSERT INTO GN_JURID_ACT
          (COD_EMPR,COD_TERC,ACT_VA_FIAT,ACT_VA_VA,ACT_TRANS,ACT_CUSTO,
           ACT_SERV_FIN,ACT_SERV_VAP,ACT_USUA,ACT_HORA,ACT_ESTA)
        VALUES
          (@COD_EMPR,@COD_TERC,@ACT_VA_FIAT,@ACT_VA_VA,@ACT_TRANS,@ACT_CUSTO,
           @ACT_SERV_FIN,@ACT_SERV_VAP,@ACT_USUA,@ACT_HORA,@ACT_ESTA)`);
    }

    // ── 13. GN_JURID_BF — Beneficiarios finales ────────────────────────────────
    {
      const bfs = Array.isArray(d.beneficiarios) ? d.beneficiarios : [];
      for (const bf of bfs) {
        if (!bf.NOM_BENE && !bf.RAZ_BENE) continue; // omitir filas vacías
        const r = new sql.Request(transaction);
        r.input('COD_EMPR',  sql.SmallInt,    COD_EMPR);
        r.input('COD_TERC',  sql.BigInt,       COD_TERC);
        r.input('TIP_BENE',  sql.Char(1),      bf.TIP_BENE   || 'P');
        r.input('NOM_BENE',  sql.VarChar(100), strOrNull(bf.NOM_BENE));
        r.input('APE_BENE',  sql.VarChar(100), strOrNull(bf.APE_BENE));
        r.input('RAZ_BENE',  sql.VarChar(200), strOrNull(bf.RAZ_BENE));
        r.input('TIP_DOCU',  sql.Int,           intOrNull(bf.TIP_DOCU));
        r.input('NUM_DOCU',  sql.VarChar(20),  strOrNull(bf.NUM_DOCU));
        r.input('FEC_EXPE',  sql.DateTime,     bf.FEC_EXPE ? new Date(bf.FEC_EXPE) : null);
        r.input('COD_PAIS',  sql.Int,           intOrNull(bf.COD_PAIS));
        r.input('COD_DEPT',  sql.Int,           intOrNull(bf.COD_DEPT));
        r.input('COD_MPIO',  sql.Int,           intOrNull(bf.COD_MPIO));
        r.input('DIR_BENE',  sql.VarChar(255), strOrNull(bf.DIR_BENE));
        r.input('TEL_BENE',  sql.VarChar(40),  strOrNull(bf.TEL_BENE));
        r.input('MAIL_BENE', sql.VarChar(150), strOrNull(bf.MAIL_BENE));
        r.input('ACT_USUA',  sql.Char(8),      ACT_USUA);
        r.input('ACT_HORA',  sql.DateTime,     ACT_HORA);
        r.input('ACT_ESTA',  sql.Char(1),      ACT_ESTA);
        await r.query(`
          INSERT INTO GN_JURID_BF
            (COD_EMPR,COD_TERC,TIP_BENE,NOM_BENE,APE_BENE,RAZ_BENE,TIP_DOCU,NUM_DOCU,
             FEC_EXPE,COD_PAIS,COD_DEPT,COD_MPIO,DIR_BENE,TEL_BENE,MAIL_BENE,
             ACT_USUA,ACT_HORA,ACT_ESTA)
          VALUES
            (@COD_EMPR,@COD_TERC,@TIP_BENE,@NOM_BENE,@APE_BENE,@RAZ_BENE,@TIP_DOCU,@NUM_DOCU,
             @FEC_EXPE,@COD_PAIS,@COD_DEPT,@COD_MPIO,@DIR_BENE,@TEL_BENE,@MAIL_BENE,
             @ACT_USUA,@ACT_HORA,@ACT_ESTA)`);
      }
    }

    // ── 14. GN_JURID_FIRMA — Firma del representante legal ─────────────────────
    {
      const fi = d.firma || {};
      if (fi.NOM_FIRM && fi.APE_FIRM) {
        const r = new sql.Request(transaction);
        r.input('COD_EMPR',  sql.SmallInt,   COD_EMPR);
        r.input('COD_TERC',  sql.BigInt,      COD_TERC);
        r.input('NOM_FIRM',  sql.VarChar(100), strOrNull(fi.NOM_FIRM));
        r.input('APE_FIRM',  sql.VarChar(100), strOrNull(fi.APE_FIRM));
        r.input('TIP_DOCU',  sql.Int,          intOrNull(fi.TIP_DOCU));
        r.input('NUM_DOCU',  sql.VarChar(20),  strOrNull(fi.NUM_DOCU));
        r.input('FEC_FIRMA', sql.DateTime,     fi.FEC_FIRMA ? new Date(fi.FEC_FIRMA) : null);
        r.input('ACT_USUA',  sql.Char(8),     ACT_USUA);
        r.input('ACT_HORA',  sql.DateTime,    ACT_HORA);
        r.input('ACT_ESTA',  sql.Char(1),     ACT_ESTA);
        await r.query(`
          INSERT INTO GN_JURID_FIRMA
            (COD_EMPR,COD_TERC,NOM_FIRM,APE_FIRM,TIP_DOCU,NUM_DOCU,FEC_FIRMA,
             ACT_USUA,ACT_HORA,ACT_ESTA)
          VALUES
            (@COD_EMPR,@COD_TERC,@NOM_FIRM,@APE_FIRM,@TIP_DOCU,@NUM_DOCU,@FEC_FIRMA,
             @ACT_USUA,@ACT_HORA,@ACT_ESTA)`);
      }
    }

    // ── Confirmar transacción ──────────────────────────────────────────────────
    await transaction.commit();

    console.log(`✅ guardar-completo OK — COD_TERC=${COD_TERC}, NUM_IDEN=${d.NUM_IDEN}`);
    res.json({
      success:  true,
      NUM_IDEN: d.NUM_IDEN,
      COD_TERC: COD_TERC,
    });

  } catch (err) {
    try { await transaction.rollback(); } catch (_) {}
    console.error('POST /api/guardar-completo:', err);
    res.status(500).json({ error: err.message || 'Error interno del servidor' });
  }
});

/* ── Puerto ──────────────────────────────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`🚀 Servidor SARLAFT escuchando en http://localhost:${PORT}`);
});

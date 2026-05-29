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

// Valores permitidos por CHECK constraint GNC03TERCE en GN_TERCE.TIP_TERC:
//   'A', 'E', 'T', 'C', 'N', 'U'  — 'J' NO está permitido.
// 'E' = Empresa/Entidad Jurídica | 'N' = Persona Natural
const TIP_TERC_JURID = 'E';
const TIP_TERC_NATUR = 'N';

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
    req1.input('TIP_TERC',    sql.Char(1),      TIP_TERC_JURID);
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
      // Flat format: m has TIP_REPR directly
      await insertarJD(transaction, NUM_IDEN, m, m.TIP_REPR || 'P');
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
        // Flat format: rv has TIP_REPR directly
        await insertarRF(transaction, NUM_IDEN, rv, rv.TIP_REPR || 'P', TIE_REVIS);
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
        t.TIP_TERC,
        td.NOM_TPDOC AS TIP_TPDOC
      FROM GN_TERCE t
      LEFT JOIN MAE_TPDOC td
        ON td.COD_TPDOC = t.COD_TPDOC
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
 * Genera un Excel organizado en hojas temáticas con solo los campos
 * capturados en el formulario, etiquetas legibles en español y códigos
 * resueltos a nombres mediante JOINs a los catálogos.
 */
app.get('/api/exportar-excel/:codTerc', async (req, res) => {
  const codTerc = parseInt(req.params.codTerc, 10);
  if (!codTerc) return res.status(400).json({ error: 'codTerc inválido' });

  try {
    const pool = await sql.connect(dbConfig);

    const q = async (query) => {
      const rq = pool.request();
      rq.input('COD_EMPR', sql.SmallInt, COD_EMPR);
      rq.input('COD_TERC', sql.BigInt,   codTerc);
      return (await rq.query(query)).recordset;
    };

    const [empresa, financiera, bancaria, pep, rl, jd, rf, ac, bf, cump, paises, documentos] = await Promise.all([

      // ── Datos de la empresa (GN_TERCE + GN_JURID) ────────────────────────
      q(`SELECT
          td.NOM_TPDOC                                  AS [Tipo de documento],
          t.NUM_IDEN                                    AS [Número de identificación / NIT],
          t.DIG_VERI                                    AS [Dígito de verificación],
          LTRIM(RTRIM(ISNULL(t.NOM_COMP,'')))           AS [Razón social],
          LTRIM(RTRIM(ISNULL(t.DIR_TERC,'')))           AS [Dirección],
          LTRIM(RTRIM(ISNULL(t.TEL_TERC,'')))           AS [Teléfono],
          LTRIM(RTRIM(ISNULL(t.TEL_TERC2,'')))          AS [Teléfono 2],
          t.DIR_MAIL                                    AS [Email corporativo],
          ISNULL(v.NOM_VINC, j.TIP_VINC)               AS [Tipo de vinculación],
          j.MAIL_SARL                                   AS [Email SARLAFT],
          j.URL_WEB                                     AS [Sitio web],
          j.COD_CIIU + CASE WHEN ci.NOM_CIIU IS NOT NULL THEN ' — ' + ci.NOM_CIIU ELSE '' END
                                                        AS [Actividad CIIU],
          ISNULL(ts.NOM_SOCIE, j.TIP_SOCIE)            AS [Tipo de sociedad],
          ISNULL(po.NOM_PAIS, '')                       AS [País de origen],
          CASE j.UBIC_SOC WHEN 'N' THEN 'Nacional' WHEN 'E' THEN 'Extranjera' ELSE j.UBIC_SOC END
                                                        AS [Ubicación de la sociedad],
          ISNULL(ps.NOM_PAIS, '')                       AS [País de constitución],
          j.TIP_EMPR                                    AS [Tipo de empresa],
          CASE j.GRUP_EMPR WHEN 'S' THEN 'Sí' ELSE 'No' END AS [Pertenece a grupo empresarial],
          ISNULL(pe.NOM_PAIS,'')                        AS [País de expedición],
          ISNULL(dp.NOM_DEPT,'')                        AS [Departamento de expedición],
          ISNULL(mn.NOM_MUNI,'')                        AS [Ciudad de expedición]
        FROM GN_TERCE t
          JOIN GN_JURID j   ON j.COD_EMPR = t.COD_EMPR AND j.COD_TERC = t.COD_TERC
          LEFT JOIN MAE_TPDOC   td ON td.COD_TPDOC = t.COD_TPDOC
          LEFT JOIN MAE_VINC     v ON CAST(v.COD_VINC AS VARCHAR) = j.TIP_VINC
          LEFT JOIN MAE_CIIU    ci ON ci.COD_CIIU = j.COD_CIIU
          LEFT JOIN MAE_TIP_SOCIE ts ON CAST(ts.COD_SOCIE AS VARCHAR) = j.TIP_SOCIE
          LEFT JOIN MAE_PAIS    po ON po.COD_PAIS = j.COD_PAIS_ORI
          LEFT JOIN MAE_PAIS    ps ON ps.COD_PAIS = j.COD_PAIS_SOC
          LEFT JOIN MAE_PAIS    pe ON pe.COD_PAIS = j.COD_PAIS_EXP
          LEFT JOIN MAE_DEPT    dp ON dp.COD_DEPT = j.COD_DEPT_EXP
          LEFT JOIN MAE_MUNI    mn ON mn.COD_MUNI = j.COD_MPIO_EXP
        WHERE t.COD_EMPR = @COD_EMPR AND t.COD_TERC = @COD_TERC
          AND t.TIP_TERC = 'E'`),

      // ── Financiera ────────────────────────────────────────────────────────
      q(`SELECT
          ACT_TOTAL  AS [Activos totales ($)],
          ING_MENS   AS [Ingresos mensuales ($)],
          PAS_TOTAL  AS [Pasivos totales ($)],
          EGR_MENS   AS [Egresos mensuales ($)],
          PATRIMONIO AS [Patrimonio ($)],
          OTR_ING    AS [Otros ingresos ($)]
        FROM GN_JURID_FIN
        WHERE COD_EMPR = @COD_EMPR AND COD_TERC = @COD_TERC`),

      // ── Cuentas bancarias ─────────────────────────────────────────────────
      q(`SELECT
          mb.NOM_BANCO                                  AS [Entidad bancaria],
          ISNULL(tc.NOM_TPCTA,'')                       AS [Tipo de cuenta],
          b.NUM_CUEN                                    AS [Número de cuenta],
          CASE b.CUEN_EXTR WHEN 'S' THEN 'Sí' ELSE 'No' END AS [Cuenta extranjera],
          ISNULL(b.NOM_ENT_EXT,'')                      AS [Nombre entidad extranjera],
          ISNULL(b.TIP_CUE_EXT,'')                      AS [Tipo cuenta extranjera]
        FROM GN_TERCE_BANCO b
          LEFT JOIN MAE_BANCO mb ON mb.COD_BANCO = b.COD_BANCO
          LEFT JOIN MAE_TPCTA tc ON tc.COD_TPCTA = b.TIP_CUEN
        WHERE b.COD_EMPR = @COD_EMPR AND b.COD_TERC = @COD_TERC`),

      // ── PEP ───────────────────────────────────────────────────────────────
      q(`SELECT
          CASE MAN_RPUB WHEN 'S' THEN 'Sí' ELSE 'No' END AS [¿Maneja recursos públicos?],
          CASE CAR_PUBL WHEN 'S' THEN 'Sí' ELSE 'No' END AS [¿Ejerció cargo público?]
        FROM GN_JURID_PEP
        WHERE COD_EMPR = @COD_EMPR AND COD_TERC = @COD_TERC`),

      // ── Representantes legales ────────────────────────────────────────────
      q(`SELECT
          CASE TIP_REPR WHEN 'P' THEN 'Principal' WHEN 'S' THEN 'Suplente' ELSE TIP_REPR END
                                                        AS [Rol],
          NOM_REPR                                      AS [Primer nombre],
          APE_REPR                                      AS [Primer apellido],
          td.NOM_TPDOC                                  AS [Tipo documento],
          NUM_DOCU                                      AS [Número documento],
          CONVERT(varchar, FEC_EXPE, 103)               AS [Fecha expedición],
          ISNULL(p.NOM_PAIS,'')                         AS [País expedición],
          ISNULL(d.NOM_DEPT,'')                         AS [Departamento expedición],
          ISNULL(m.NOM_MUNI,'')                         AS [Ciudad expedición],
          DIR_REPR                                      AS [Dirección],
          CEL_REPR                                      AS [Celular],
          TEL_REPR                                      AS [Teléfono],
          MAIL_REPR                                     AS [Email]
        FROM GN_JURID_RL r
          LEFT JOIN MAE_TPDOC td ON td.COD_TPDOC = r.TIP_DOCU
          LEFT JOIN MAE_PAIS   p ON p.COD_PAIS   = r.COD_PAIS
          LEFT JOIN MAE_DEPT   d ON d.COD_DEPT   = r.COD_DEPT
          LEFT JOIN MAE_MUNI   m ON m.COD_MUNI   = r.COD_MPIO
        WHERE r.COD_EMPR = @COD_EMPR AND r.COD_TERC = @COD_TERC`),

      // ── Junta directiva ───────────────────────────────────────────────────
      q(`SELECT
          CASE TIP_REPR WHEN 'P' THEN 'Principal' WHEN 'S' THEN 'Suplente' ELSE TIP_REPR END
                                                        AS [Rol],
          TIP_MIEM                                      AS [Tipo miembro],
          NOM_MIEM                                      AS [Nombre],
          APE_MIEM                                      AS [Apellido],
          RAZ_MIEM                                      AS [Razón social],
          td.NOM_TPDOC                                  AS [Tipo documento],
          NUM_DOCU                                      AS [Número documento],
          CONVERT(varchar, FEC_EXPE, 103)               AS [Fecha expedición],
          ISNULL(p.NOM_PAIS,'')                         AS [País],
          DIR_MIEM                                      AS [Dirección],
          TEL_MIEM                                      AS [Teléfono],
          MAIL_MIEM                                     AS [Email]
        FROM GN_JURID_JD jd
          LEFT JOIN MAE_TPDOC td ON td.COD_TPDOC = jd.TIP_DOCU
          LEFT JOIN MAE_PAIS   p ON p.COD_PAIS   = jd.COD_PAIS
        WHERE jd.COD_EMPR = @COD_EMPR AND jd.COD_TERC = @COD_TERC`),

      // ── Revisores fiscales ────────────────────────────────────────────────
      q(`SELECT
          CASE TIP_REPR WHEN 'P' THEN 'Principal' WHEN 'S' THEN 'Suplente' ELSE TIP_REPR END
                                                        AS [Rol],
          CASE TIE_REVIS WHEN 'S' THEN 'Sí' ELSE 'No' END AS [Tiene revisor fiscal],
          NOM_REVI                                      AS [Nombre],
          APE_REVI                                      AS [Apellido],
          RAZ_REVI                                      AS [Razón social],
          td.NOM_TPDOC                                  AS [Tipo documento],
          NUM_DOCU                                      AS [Número documento],
          CONVERT(varchar, FEC_EXPE, 103)               AS [Fecha expedición],
          DIR_REVI                                      AS [Dirección],
          CEL_REVI                                      AS [Celular],
          TEL_REVI                                      AS [Teléfono],
          MAIL_REVI                                     AS [Email]
        FROM GN_JURID_RF rf
          LEFT JOIN MAE_TPDOC td ON td.COD_TPDOC = rf.TIP_DOCU
        WHERE rf.COD_EMPR = @COD_EMPR AND rf.COD_TERC = @COD_TERC`),

      // ── Accionistas ───────────────────────────────────────────────────────
      q(`SELECT
          NOM_ACCI                                      AS [Nombre],
          APE_ACCI                                      AS [Apellido],
          RAZ_ACCI                                      AS [Razón social],
          td.NOM_TPDOC                                  AS [Tipo documento],
          NUM_DOCU                                      AS [Número documento],
          CONVERT(varchar, FEC_EXPE, 103)               AS [Fecha expedición],
          ISNULL(p.NOM_PAIS,'')                         AS [País],
          ISNULL(d.NOM_DEPT,'')                         AS [Departamento],
          ISNULL(m.NOM_MUNI,'')                         AS [Ciudad],
          DIR_ACCI                                      AS [Dirección],
          CEL_ACCI                                      AS [Celular],
          TEL_ACCI                                      AS [Teléfono],
          MAIL_ACCI                                     AS [Email],
          PCT_PART                                      AS [Porcentaje de participación (%)]
        FROM GN_JURID_AC ac
          LEFT JOIN MAE_TPDOC td ON td.COD_TPDOC = ac.TIP_DOCU
          LEFT JOIN MAE_PAIS   p ON p.COD_PAIS   = ac.COD_PAIS
          LEFT JOIN MAE_DEPT   d ON d.COD_DEPT   = ac.COD_DEPT
          LEFT JOIN MAE_MUNI   m ON m.COD_MUNI   = ac.COD_MPIO
        WHERE ac.COD_EMPR = @COD_EMPR AND ac.COD_TERC = @COD_TERC`),

      // ── Beneficiarios finales ─────────────────────────────────────────────
      q(`SELECT
          CASE TIP_BENE WHEN 'N' THEN 'Natural' WHEN 'J' THEN 'Jurídica' ELSE TIP_BENE END
                                                        AS [Tipo],
          NOM_BENE                                      AS [Nombre],
          APE_BENE                                      AS [Apellido],
          RAZ_BENE                                      AS [Razón social],
          td.NOM_TPDOC                                  AS [Tipo documento],
          NUM_DOCU                                      AS [Número documento],
          CONVERT(varchar, FEC_EXPE, 103)               AS [Fecha expedición],
          ISNULL(p.NOM_PAIS,'')                         AS [País],
          ISNULL(d.NOM_DEPT,'')                         AS [Departamento],
          ISNULL(m.NOM_MUNI,'')                         AS [Ciudad],
          DIR_BENE                                      AS [Dirección],
          TEL_BENE                                      AS [Teléfono],
          MAIL_BENE                                     AS [Email]
        FROM GN_JURID_BF bf
          LEFT JOIN MAE_TPDOC td ON td.COD_TPDOC = bf.TIP_DOCU
          LEFT JOIN MAE_PAIS   p ON p.COD_PAIS   = bf.COD_PAIS
          LEFT JOIN MAE_DEPT   d ON d.COD_DEPT   = bf.COD_DEPT
          LEFT JOIN MAE_MUNI   m ON m.COD_MUNI   = bf.COD_MPIO
        WHERE bf.COD_EMPR = @COD_EMPR AND bf.COD_TERC = @COD_TERC`),

      // ── Cumplimiento LAFT ─────────────────────────────────────────────────
      q(`SELECT
          REL_GRUPO                                     AS [Pertenencia a grupo empresarial],
          NORM_LAFT                                     AS [Normativa LAFT aplicable],
          SIS_PREVE                                     AS [Sistema de prevención],
          DESC_NORM                                     AS [Descripción normativa],
          CASE TIE_JUNTA WHEN 'S' THEN 'Sí' ELSE 'No' END AS [Tiene junta directiva],
          TIP_SIST                                      AS [Tipo de sistema],
          CASE TIP_REPR WHEN 'P' THEN 'Principal' WHEN 'S' THEN 'Suplente' ELSE '' END
                                                        AS [Tipo representante oficial],
          NOM_RESP                                      AS [Nombre responsable],
          APE_RESP                                      AS [Apellido responsable],
          td.NOM_TPDOC                                  AS [Tipo documento responsable],
          NUM_DOCU                                      AS [Número documento],
          ISNULL(p.NOM_PAIS,'')                         AS [País responsable],
          DIR_RESP                                      AS [Dirección responsable],
          TEL_RESP                                      AS [Teléfono responsable],
          MAIL_RESP                                     AS [Email responsable]
        FROM GN_JURID_CUMP c
          LEFT JOIN MAE_TPDOC td ON td.COD_TPDOC = c.TIP_DOCU
          LEFT JOIN MAE_PAIS   p ON p.COD_PAIS   = c.COD_PAIS
        WHERE c.COD_EMPR = @COD_EMPR AND c.COD_TERC = @COD_TERC`),

      // ── Países de operación ───────────────────────────────────────────────
      q(`SELECT
          ISNULL(p.NOM_PAIS,'')                         AS [País]
        FROM GN_JURID_PAIS gp
          LEFT JOIN MAE_PAIS p ON p.COD_PAIS = gp.COD_PAIS
        WHERE gp.COD_EMPR = @COD_EMPR AND gp.COD_TERC = @COD_TERC`),

      // ── Documentos ───────────────────────────────────────────────────────
      q(`SELECT
          d.TIP_DOC                                     AS [Tipo de documento],
          ISNULL(d.NOM_DOC,'')                          AS [Nombre del documento],
          ISNULL(d.NOM_ARCH,'')                         AS [Nombre del archivo],
          CONVERT(varchar, d.FEC_CARG, 103)             AS [Fecha de carga],
          '/api/documentos/' + CAST(t.NUM_IDEN AS VARCHAR) + '/' + d.TIP_DOC
                                                        AS [URL de descarga]
        FROM GN_TERCE_DOC d
          JOIN GN_TERCE t ON t.COD_EMPR = d.COD_EMPR AND t.COD_TERC = d.COD_TERC
        WHERE d.COD_EMPR = @COD_EMPR AND d.COD_TERC = @COD_TERC`),
    ]);

    // ── Construir libro Excel ─────────────────────────────────────────────────
    const wb    = new ExcelJS.Workbook();
    wb.creator  = 'SARLAFT Sistema';
    wb.created  = new Date();

    const PRIMARY      = '0C6B8C';
    const HEADER_BG    = 'E5F5FA';
    const ACCENT       = '20A7C9';
    const CURRENCY_FMT = '#,##0.00';

    function addSheetJ(name, rows, currencyColumns = []) {
      const ws = wb.addWorksheet(name);
      if (!rows || rows.length === 0) {
        ws.getColumn(1).width = 40;
        ws.mergeCells('A1:B1');
        const tc = ws.getCell('A1');
        tc.value = name;
        tc.font  = { bold: true, size: 13, color: { argb: 'FF' + PRIMARY } };
        tc.alignment = { horizontal: 'center' };
        tc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + HEADER_BG } };
        const nr = ws.addRow(['No se registraron datos para esta sección.']);
        nr.getCell(1).font = { italic: true, color: { argb: 'FF888888' } };
        return;
      }
      const cols = Object.keys(rows[0]);

      if (rows.length === 1) {
        ws.getColumn(1).width = 38;
        ws.getColumn(2).width = 42;
        ws.mergeCells('A1:B1');
        const tc = ws.getCell('A1');
        tc.value = name;
        tc.font  = { bold: true, size: 13, color: { argb: 'FF' + PRIMARY } };
        tc.alignment = { horizontal: 'center' };
        tc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + HEADER_BG } };

        const hRow = ws.addRow(['Campo', 'Valor']);
        hRow.eachCell(cell => {
          cell.font  = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + ACCENT } };
          cell.alignment = { horizontal: 'center' };
        });

        cols.forEach((col, i) => {
          const val = rows[0][col];
          const row = ws.addRow([col, val ?? '']);
          if (i % 2 === 0) {
            row.eachCell(cell => {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF6FA' } };
            });
          }
          if (currencyColumns.includes(col) && typeof val === 'number') {
            row.getCell(2).numFmt = CURRENCY_FMT;
          }
        });

      } else {
        ws.mergeCells(1, 1, 1, cols.length);
        const tc = ws.getCell(1, 1);
        tc.value = name;
        tc.font  = { bold: true, size: 13, color: { argb: 'FF' + PRIMARY } };
        tc.alignment = { horizontal: 'center' };

        const hRow = ws.addRow(cols);
        hRow.eachCell(cell => {
          cell.font  = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + ACCENT } };
          cell.border = { bottom: { style: 'thin', color: { argb: 'FF' + PRIMARY } } };
          cell.alignment = { horizontal: 'center' };
        });

        rows.forEach((row, ri) => {
          const dRow = ws.addRow(cols.map(c => row[c] ?? ''));
          if (ri % 2 === 0) {
            dRow.eachCell(cell => {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + HEADER_BG } };
            });
          }
          currencyColumns.forEach(cc => {
            const ci = cols.indexOf(cc);
            if (ci >= 0 && typeof row[cc] === 'number') {
              dRow.getCell(ci + 1).numFmt = CURRENCY_FMT;
            }
          });
        });

        cols.forEach((col, colIdx) => {
          const maxLen = Math.max(col.length, ...rows.map(rw => String(rw[col] ?? '').length));
          ws.getColumn(colIdx + 1).width = Math.min(Math.max(maxLen + 2, 14), 45);
        });
      }
    }

    const CURRENCY_COLS = ['Activos totales ($)','Ingresos mensuales ($)','Pasivos totales ($)',
                           'Egresos mensuales ($)','Patrimonio ($)','Otros ingresos ($)'];

    addSheetJ('Datos de la Empresa',        empresa);
    addSheetJ('Información Financiera',     financiera, CURRENCY_COLS);
    addSheetJ('Cuentas Bancarias',          bancaria);
    addSheetJ('PEP',                        pep);
    addSheetJ('Representantes Legales',     rl);
    addSheetJ('Junta Directiva',            jd);
    addSheetJ('Revisores Fiscales',         rf);
    addSheetJ('Accionistas',                ac);
    addSheetJ('Beneficiarios Finales',      bf);
    addSheetJ('Cumplimiento LAFT',          cump);
    addSheetJ('Países de Operación',        paises);

    // ── Hoja documentos con hipervínculo ─────────────────────────────────────
    if (documentos.length > 0) {
      const wsDoc  = wb.addWorksheet('Documentos Adjuntos');
      const dCols  = Object.keys(documentos[0]).filter(c => c !== 'URL de descarga');
      const allCols = [...dCols, 'Acceder al archivo'];

      wsDoc.mergeCells(1, 1, 1, allCols.length);
      const tCell = wsDoc.getCell(1, 1);
      tCell.value = 'Documentos Adjuntos';
      tCell.font  = { bold: true, size: 13, color: { argb: 'FF' + PRIMARY } };
      tCell.alignment = { horizontal: 'center' };

      const hRow = wsDoc.addRow(allCols);
      hRow.eachCell(cell => {
        cell.font  = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + ACCENT } };
        cell.alignment = { horizontal: 'center' };
      });

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      documentos.forEach((doc, ri) => {
        const values = dCols.map(c => doc[c] ?? '');
        values.push(doc['Nombre del archivo'] || '');
        const dRow = wsDoc.addRow(values);
        if (ri % 2 === 0) {
          dRow.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + HEADER_BG } };
          });
        }
        const urlRel = doc['URL de descarga'] || '';
        if (urlRel && doc['Nombre del archivo']) {
          const linkCell = dRow.getCell(allCols.length);
          linkCell.value = {
            text:      doc['Nombre del archivo'],
            hyperlink: baseUrl + urlRel,
          };
          linkCell.font = { color: { argb: 'FF0563C1' }, underline: true };
        }
      });

      allCols.forEach((col, ci) => {
        wsDoc.getColumn(ci + 1).width = Math.min(Math.max(col.length + 4, 16), 45);
      });
    } else {
      const wsDoc = wb.addWorksheet('Documentos Adjuntos');
      wsDoc.addRow(['Sin documentos adjuntos registrados.']);
    }

    // ── Enviar como descarga ──────────────────────────────────────────────────
    const nomComp = (empresa[0]?.['Razón social'] || `TERC_${codTerc}`)
      .replace(/[^a-zA-Z0-9_\-\s]/g, '').trim().replace(/\s+/g, '_');
    const filename = `SARLAFT_Juridica_${nomComp}_${new Date().toISOString().slice(0,10)}.xlsx`;

    res.setHeader('Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await wb.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error('GET /api/exportar-excel:', err);
    if (!res.headersSent) res.status(500).json({ error: err.message || 'Error generando Excel' });
  }
});





// ═══════════════════════════════════════════════════════════════════════════════
//  PERSONA JURÍDICA — Cargar registro existente (modo actualizar)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/cargar-completo/:numIden
 * Devuelve el registro completo de una Persona Jurídica para pre-llenar el
 * formulario en modo actualizar.
 */
app.get('/api/cargar-completo/:numIden', async (req, res) => {
  const { numIden } = req.params;
  try {
    const pool = await sql.connect(dbConfig);
    const r    = () => pool.request()
      .input('COD_EMPR', sql.SmallInt, COD_EMPR)
      .input('NUM_IDEN',  sql.VarChar(20), numIden);

    const basica = await r().query(`
      SELECT t.COD_TERC, t.COD_TPDOC, t.NUM_IDEN, t.DIG_VERI, t.NOM_COMP,
             t.DIR_TERC, t.TEL_TERC, t.TEL_TERC2, t.DIR_MAIL,
             j.TIP_VINC AS COD_VINC, j.MAIL_SARL, j.COD_CIIU, j.URL_WEB,
             j.UBIC_SOC, j.COD_PAIS_SOC, j.TIP_EMPR, j.GRUP_EMPR, j.TIP_SOCIE,
             j.COD_PAIS_EXP, j.COD_DEPT_EXP, j.COD_MPIO_EXP
      FROM GN_TERCE t
      LEFT JOIN GN_JURID j ON j.COD_EMPR=t.COD_EMPR AND j.COD_TERC=t.COD_TERC
      WHERE t.COD_EMPR=@COD_EMPR AND t.NUM_IDEN=@NUM_IDEN`);

    if (!basica.recordset.length) return res.status(404).json({ error: 'Registro no encontrado.' });
    const row      = basica.recordset[0];
    const COD_TERC = row.COD_TERC;
    const rC       = () => pool.request()
      .input('COD_EMPR', sql.SmallInt, COD_EMPR)
      .input('COD_TERC', sql.BigInt, COD_TERC);

    const rlRes  = await rC().query(`
      SELECT TIP_REPR, NOM_REPR, APE_REPR, TIP_DOCU, NUM_DOCU,
             CONVERT(varchar(10),FEC_EXPE,23) AS FEC_EXPE,
             COD_PAIS, COD_DEPT, COD_MPIO, DIR_REPR, CEL_REPR, TEL_REPR, MAIL_REPR
      FROM GN_JURID_RL WHERE COD_EMPR=@COD_EMPR AND COD_TERC=@COD_TERC ORDER BY TIP_REPR`);

    const paisesRes = await rC().query(
      `SELECT COD_PAIS FROM GN_JURID_PAIS WHERE COD_EMPR=@COD_EMPR AND COD_TERC=@COD_TERC`);

    const cumpRes = await rC().query(`
      SELECT REL_GRUPO, NORM_LAFT, SIS_PREVE, DESC_NORM, TIE_JUNTA,
             TIP_REPR, TIP_DOCU, NUM_DOCU,
             CONVERT(varchar(10),FEC_EXPE,23) AS FEC_EXPE,
             NOM_RESP, APE_RESP, RAZ_RESP, COD_PAIS, COD_DEPT, COD_MPIO,
             DIR_RESP, TEL_RESP, MAIL_RESP
      FROM GN_JURID_CUMP WHERE COD_EMPR=@COD_EMPR AND COD_TERC=@COD_TERC ORDER BY TIP_REPR`);

    const jdRes  = await rC().query(`
      SELECT TIP_REPR, TIP_MIEM, NOM_MIEM, APE_MIEM, RAZ_MIEM, TIP_DOCU, NUM_DOCU,
             CONVERT(varchar(10),FEC_EXPE,23) AS FEC_EXPE,
             COD_PAIS, COD_DEPT, COD_MPIO, DIR_MIEM, TEL_MIEM, MAIL_MIEM
      FROM GN_JURID_JD WHERE COD_EMPR=@COD_EMPR AND COD_TERC=@COD_TERC ORDER BY TIP_REPR`);

    const rfRes  = await rC().query(`
      SELECT TIP_REPR, TIE_REVIS, NOM_REVI, APE_REVI, RAZ_REVI, TIP_DOCU, NUM_DOCU,
             CONVERT(varchar(10),FEC_EXPE,23) AS FEC_EXPE,
             COD_PAIS, COD_DEPT, COD_MPIO, DIR_REVI, CEL_REVI, TEL_REVI, MAIL_REVI,
             REVI_FIRMA, RAZ_FIRMA, TIP_DOCU_FIR, NUM_DOCU_FIR
      FROM GN_JURID_RF WHERE COD_EMPR=@COD_EMPR AND COD_TERC=@COD_TERC ORDER BY TIP_REPR`);

    const acRes  = await rC().query(`
      SELECT NOM_ACCI, APE_ACCI, RAZ_ACCI, TIP_DOCU, NUM_DOCU,
             CONVERT(varchar(10),FEC_EXPE,23) AS FEC_EXPE,
             COD_PAIS, COD_DEPT, COD_MPIO, DIR_ACCI, CEL_ACCI, TEL_ACCI, MAIL_ACCI, PCT_PART
      FROM GN_JURID_AC WHERE COD_EMPR=@COD_EMPR AND COD_TERC=@COD_TERC`);

    const finRes = await rC().query(`
      SELECT ACT_TOTAL, ING_MENS, PAS_TOTAL, EGR_MENS, PATRIMONIO, OTR_ING
      FROM GN_JURID_FIN WHERE COD_EMPR=@COD_EMPR AND COD_TERC=@COD_TERC`);

    const banRes = await rC().query(`
      SELECT COD_BANCO, TIP_CUEN, NUM_CUEN, CUEN_EXTR, NOM_ENT_EXT, TIP_CUE_EXT
      FROM GN_TERCE_BANCO WHERE COD_EMPR=@COD_EMPR AND COD_TERC=@COD_TERC`);

    const pepRes = await rC().query(`
      SELECT MAN_RPUB, CAR_PUBL FROM GN_JURID_PEP
      WHERE COD_EMPR=@COD_EMPR AND COD_TERC=@COD_TERC`);

    const actRes = await rC().query(`
      SELECT ACT_VA_FIAT, ACT_VA_VA, ACT_TRANS, ACT_CUSTO, ACT_SERV_FIN, ACT_SERV_VAP, CERT_INFO
      FROM GN_JURID_ACT WHERE COD_EMPR=@COD_EMPR AND COD_TERC=@COD_TERC`);

    const bfRes  = await rC().query(`
      SELECT TIP_BENE, NOM_BENE, APE_BENE, RAZ_BENE, TIP_DOCU, NUM_DOCU,
             CONVERT(varchar(10),FEC_EXPE,23) AS FEC_EXPE,
             COD_PAIS, COD_DEPT, COD_MPIO, DIR_BENE, TEL_BENE, MAIL_BENE
      FROM GN_JURID_BF WHERE COD_EMPR=@COD_EMPR AND COD_TERC=@COD_TERC`);

    const firmaRes = await rC().query(`
      SELECT NOM_FIRM, APE_FIRM, TIP_DOCU, NUM_DOCU,
             CONVERT(varchar(10),FEC_FIRMA,23) AS FEC_FIRMA
      FROM GN_JURID_FIRMA WHERE COD_EMPR=@COD_EMPR AND COD_TERC=@COD_TERC`);

    // Cumplimiento: fila sin TIP_REPR = datos generales; filas con TIP_REPR = oficiales
    const cumpMain   = cumpRes.recordset.find(c => !c.TIP_REPR) || cumpRes.recordset[0] || {};
    const cumpOficial = cumpRes.recordset.filter(c => c.TIP_REPR);

    // JD: flat array (new format)
    const jdFlat = jdRes.recordset; // already has TIP_REPR per row

    // RF: flat array (new format)
    const rfFlat = rfRes.recordset.filter(m => m.TIP_REPR); // exclude header-only rows
    const rfTieRevis = rfRes.recordset[0]?.TIE_REVIS || 'N';

    res.json({
      COD_TERC,
      basica: {
        COD_TPDOC: row.COD_TPDOC, NUM_IDEN: row.NUM_IDEN, DIG_VERI: row.DIG_VERI,
        NOM_COMP: row.NOM_COMP, DIR_TERC: row.DIR_TERC, TEL_TERC: row.TEL_TERC,
        TEL_TERC2: row.TEL_TERC2, DIR_MAIL: row.DIR_MAIL, COD_VINC: row.COD_VINC,
        MAIL_SARL: row.MAIL_SARL, COD_CIIU: row.COD_CIIU, URL_WEB: row.URL_WEB,
        COD_PAIS_EXP: row.COD_PAIS_EXP, COD_DEPT_EXP: row.COD_DEPT_EXP,
        COD_MPIO_EXP: row.COD_MPIO_EXP,
      },
      sociedad: {
        UBIC_SOC: row.UBIC_SOC, COD_PAIS_SOC: row.COD_PAIS_SOC,
        TIP_EMPR: row.TIP_EMPR, GRUP_EMPR: row.GRUP_EMPR, TIP_SOCIE: row.TIP_SOCIE,
        REL_GRUPO: cumpMain.REL_GRUPO || '',
      },
      representantes: rlRes.recordset,
      paises:         paisesRes.recordset,
      cumplimiento: {
        DESC_NORM: cumpMain.DESC_NORM || '', NORM_LAFT: cumpMain.NORM_LAFT || '',
        TIE_JUNTA: cumpMain.TIE_JUNTA || 'N', SIS_PREVE: cumpMain.SIS_PREVE || null,
        oficiales: cumpOficial,
      },
      juntaDirectiva: { TIE_JUNTA: jdFlat.length > 0 ? 'S' : 'N', miembros: jdFlat },
      revisores:      { TIE_REVIS: rfTieRevis, revisores: rfFlat },
      accionistas:    acRes.recordset,
      financiera:     finRes.recordset[0] || {},
      bancaria:       banRes.recordset,
      pep:            pepRes.recordset[0] || { MAN_RPUB: 'N', CAR_PUBL: 'N' },
      actividades:    actRes.recordset[0] || {},
      beneficiarios:  bfRes.recordset,
      firma:          firmaRes.recordset[0] || {},
    });

  } catch (err) {
    console.error('GET /api/cargar-completo:', err);
    res.status(500).json({ error: err.message });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
//  PERSONA JURÍDICA — Actualizar registro existente
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * PUT /api/actualizar-completo
 * Actualiza GN_TERCE y GN_JURID, luego elimina y re-inserta todas las tablas
 * hijas. Acepta el mismo payload que POST /api/guardar-completo.
 */
app.put('/api/actualizar-completo', async (req, res) => {
  const d = req.body;
  if (!d.NUM_IDEN || !d.NOM_COMP) {
    return res.status(400).json({ error: 'Campos obligatorios faltantes: NUM_IDEN, NOM_COMP' });
  }
  const toInt  = v => (v !== null && v !== undefined && v !== '' && v !== 'NA') ? parseInt(v, 10) : null;
  const toDec  = v => (v !== null && v !== undefined && v !== '') ? parseFloat(v) : null;
  const toDate = v => v ? new Date(v) : null;
  const toChar = v => v || null;

  let pool, transaction;
  try {
    pool = await sql.connect(dbConfig);
    const lookup = await pool.request()
      .input('COD_EMPR', sql.SmallInt, COD_EMPR)
      .input('NUM_IDEN',  sql.VarChar(20), d.NUM_IDEN)
      .query(`SELECT COD_TERC FROM GN_TERCE WHERE COD_EMPR=@COD_EMPR AND NUM_IDEN=@NUM_IDEN`);
    if (!lookup.recordset.length)
      return res.status(404).json({ error: `No se encontró registro para NUM_IDEN=${d.NUM_IDEN}` });
    const COD_TERC = lookup.recordset[0].COD_TERC;

    transaction = new sql.Transaction(pool);
    await transaction.begin();
    const r = () => new sql.Request(transaction);

    // 1. UPDATE GN_TERCE
    await r()
      .input('COD_EMPR',  sql.SmallInt,    COD_EMPR)
      .input('COD_TERC',  sql.BigInt,      COD_TERC)
      .input('COD_TPDOC', sql.Int,         toInt(d.COD_TPDOC) || 8)
      .input('DIG_VERI',  sql.SmallInt,    toInt(d.DIG_VERI))
      .input('NOM_COMP',  sql.VarChar(240),String(d.NOM_COMP).substring(0,240))
      .input('DIR_TERC',  sql.Char(120),   toChar(d.DIR_TERC))
      .input('TEL_TERC',  sql.Char(30),    toChar(d.TEL_TERC))
      .input('TEL_TERC2', sql.Char(40),    toChar(d.TEL_TERC2))
      .input('DIR_MAIL',  sql.VarChar(150),toChar(d.DIR_MAIL))
      .query(`UPDATE GN_TERCE SET COD_TPDOC=@COD_TPDOC,DIG_VERI=@DIG_VERI,NOM_COMP=@NOM_COMP,
              DIR_TERC=@DIR_TERC,TEL_TERC=@TEL_TERC,TEL_TERC2=@TEL_TERC2,DIR_MAIL=@DIR_MAIL
              WHERE COD_EMPR=@COD_EMPR AND COD_TERC=@COD_TERC`);

    // 2. UPDATE GN_JURID
    await r()
      .input('COD_EMPR',    sql.SmallInt,    COD_EMPR)
      .input('COD_TERC',    sql.BigInt,      COD_TERC)
      .input('TIP_VINC',    sql.VarChar(40), toChar(d.COD_VINC))
      .input('MAIL_SARL',   sql.VarChar(150),toChar(d.MAIL_SARL))
      .input('COD_CIIU',    sql.VarChar(10), toChar(d.COD_CIIU))
      .input('URL_WEB',     sql.VarChar(200),toChar(d.URL_WEB))
      .input('TIP_SOCIE',   sql.VarChar(10), toChar(d.TIP_SOCIE))
      .input('COD_PAIS_ORI',sql.Int,         toInt(d.COD_PAIS_EXP))
      .input('UBIC_SOC',    sql.Char(1),     toChar(d.UBIC_SOC))
      .input('COD_PAIS_SOC',sql.Int,         toInt(d.COD_PAIS_SOC))
      .input('TIP_EMPR',    sql.VarChar(10), toChar(d.TIP_EMPR))
      .input('GRUP_EMPR',   sql.Char(1),     toChar(d.GRUP_EMPR))
      .input('COD_PAIS_EXP',sql.Int,         toInt(d.COD_PAIS_EXP))
      .input('COD_DEPT_EXP',sql.Int,         toInt(d.COD_DEPT_EXP))
      .input('COD_MPIO_EXP',sql.Int,         toInt(d.COD_MPIO_EXP))
      .query(`UPDATE GN_JURID SET TIP_VINC=@TIP_VINC,MAIL_SARL=@MAIL_SARL,COD_CIIU=@COD_CIIU,
              URL_WEB=@URL_WEB,TIP_SOCIE=@TIP_SOCIE,COD_PAIS_ORI=@COD_PAIS_ORI,UBIC_SOC=@UBIC_SOC,
              COD_PAIS_SOC=@COD_PAIS_SOC,TIP_EMPR=@TIP_EMPR,GRUP_EMPR=@GRUP_EMPR,
              COD_PAIS_EXP=@COD_PAIS_EXP,COD_DEPT_EXP=@COD_DEPT_EXP,COD_MPIO_EXP=@COD_MPIO_EXP
              WHERE COD_EMPR=@COD_EMPR AND COD_TERC=@COD_TERC`);

    const del = async tabla =>
      r().input('COD_EMPR',sql.SmallInt,COD_EMPR).input('COD_TERC',sql.BigInt,COD_TERC)
         .query(`DELETE FROM ${tabla} WHERE COD_EMPR=@COD_EMPR AND COD_TERC=@COD_TERC`);

    // 3. GN_JURID_RL
    await del('GN_JURID_RL');
    for (const rl of (Array.isArray(d.representantes) ? d.representantes : [])) {
      for (const rol of ['Principal','Suplente']) {
        const p = rl[rol] || rl;
        if (!p.NOM_REPR && !p.APE_REPR) continue;
        await r()
          .input('COD_EMPR', sql.SmallInt,    COD_EMPR).input('COD_TERC',sql.BigInt,COD_TERC)
          .input('TIP_REPR', sql.Char(1),     rol==='Principal'?'P':'S')
          .input('NOM_REPR', sql.VarChar(60), toChar(p.NOM_REPR))
          .input('APE_REPR', sql.VarChar(60), toChar(p.APE_REPR))
          .input('TIP_DOCU', sql.Int,         toInt(p.TIP_DOCU))
          .input('NUM_DOCU', sql.VarChar(20), toChar(p.NUM_DOCU))
          .input('FEC_EXPE', sql.Date,        toDate(p.FEC_EXPE))
          .input('COD_PAIS', sql.Int,         toInt(p.COD_PAIS))
          .input('COD_DEPT', sql.Int,         toInt(p.COD_DEPT))
          .input('COD_MPIO', sql.Int,         toInt(p.COD_MPIO))
          .input('DIR_REPR', sql.VarChar(120),toChar(p.DIR_REPR))
          .input('CEL_REPR', sql.VarChar(30), toChar(p.CEL_REPR))
          .input('TEL_REPR', sql.VarChar(30), toChar(p.TEL_REPR))
          .input('MAIL_REPR',sql.VarChar(100),toChar(p.MAIL_REPR))
          .query(`INSERT INTO GN_JURID_RL(COD_EMPR,COD_TERC,TIP_REPR,NOM_REPR,APE_REPR,TIP_DOCU,
                  NUM_DOCU,FEC_EXPE,COD_PAIS,COD_DEPT,COD_MPIO,DIR_REPR,CEL_REPR,TEL_REPR,MAIL_REPR)
                  VALUES(@COD_EMPR,@COD_TERC,@TIP_REPR,@NOM_REPR,@APE_REPR,@TIP_DOCU,
                  @NUM_DOCU,@FEC_EXPE,@COD_PAIS,@COD_DEPT,@COD_MPIO,@DIR_REPR,@CEL_REPR,@TEL_REPR,@MAIL_REPR)`);
      }
    }

    // 4. GN_JURID_PAIS
    await del('GN_JURID_PAIS');
    for (const p of (Array.isArray(d.paises)?d.paises:[])) {
      if (!p.COD_PAIS) continue;
      await r().input('COD_EMPR',sql.SmallInt,COD_EMPR).input('COD_TERC',sql.BigInt,COD_TERC)
               .input('COD_PAIS',sql.Int,toInt(p.COD_PAIS))
               .query(`INSERT INTO GN_JURID_PAIS(COD_EMPR,COD_TERC,COD_PAIS)VALUES(@COD_EMPR,@COD_TERC,@COD_PAIS)`);
    }

    // 5. GN_JURID_CUMP
    await del('GN_JURID_CUMP');
    const tieCump = d.cump_TIE_JUNTA || 'N';
    await r()
      .input('COD_EMPR', sql.SmallInt,    COD_EMPR).input('COD_TERC',sql.BigInt,COD_TERC)
      .input('REL_GRUPO',sql.VarChar(200),toChar(d.REL_GRUPO))
      .input('NORM_LAFT',sql.VarChar(200),toChar(d.NORM_LAFT))
      .input('SIS_PREVE',sql.VarChar(200),toChar(d.SIS_PREVE))
      .input('DESC_NORM',sql.VarChar(500),toChar(d.DESC_NORM))
      .input('TIE_JUNTA',sql.Char(1),    tieCump)
      .query(`INSERT INTO GN_JURID_CUMP(COD_EMPR,COD_TERC,REL_GRUPO,NORM_LAFT,SIS_PREVE,DESC_NORM,TIE_JUNTA)
              VALUES(@COD_EMPR,@COD_TERC,@REL_GRUPO,@NORM_LAFT,@SIS_PREVE,@DESC_NORM,@TIE_JUNTA)`);
    for (const of_ of (Array.isArray(d.oficiales)?d.oficiales:[])) {
      // Flat format: TIP_REPR is directly on the object
      const p = of_;
      if (!p.NOM_RESP && !p.RAZ_RESP) continue;
      await r()
          .input('COD_EMPR', sql.SmallInt,    COD_EMPR).input('COD_TERC',sql.BigInt,COD_TERC)
          .input('TIP_REPR', sql.Char(1),     p.TIP_REPR || 'P')
          .input('TIP_SIST', sql.VarChar(10), toChar(p.TIP_SIST))
          .input('TIP_DOCU', sql.Int,         toInt(p.TIP_DOCU))
          .input('NUM_DOCU', sql.VarChar(20), toChar(p.NUM_DOCU))
          .input('FEC_EXPE', sql.Date,        toDate(p.FEC_EXPE))
          .input('NOM_RESP', sql.VarChar(60), toChar(p.NOM_RESP))
          .input('APE_RESP', sql.VarChar(60), toChar(p.APE_RESP))
          .input('RAZ_RESP', sql.VarChar(120),toChar(p.RAZ_RESP))
          .input('COD_PAIS', sql.Int,         toInt(p.COD_PAIS))
          .input('COD_DEPT', sql.Int,         toInt(p.COD_DEPT))
          .input('COD_MPIO', sql.Int,         toInt(p.COD_MPIO))
          .input('DIR_RESP', sql.VarChar(120),toChar(p.DIR_RESP))
          .input('TEL_RESP', sql.VarChar(30), toChar(p.TEL_RESP))
          .input('MAIL_RESP',sql.VarChar(100),toChar(p.MAIL_RESP))
          .query(`INSERT INTO GN_JURID_CUMP(COD_EMPR,COD_TERC,TIP_REPR,TIP_SIST,TIP_DOCU,NUM_DOCU,FEC_EXPE,
                  NOM_RESP,APE_RESP,RAZ_RESP,COD_PAIS,COD_DEPT,COD_MPIO,DIR_RESP,TEL_RESP,MAIL_RESP)
                  VALUES(@COD_EMPR,@COD_TERC,@TIP_REPR,@TIP_SIST,@TIP_DOCU,@NUM_DOCU,@FEC_EXPE,
                  @NOM_RESP,@APE_RESP,@RAZ_RESP,@COD_PAIS,@COD_DEPT,@COD_MPIO,@DIR_RESP,@TEL_RESP,@MAIL_RESP)`);
    }

    // 6. GN_JURID_JD
    await del('GN_JURID_JD');
    for (const m of (Array.isArray(d.juntaDirectiva)?d.juntaDirectiva:[])) {
      // Flat format: TIP_REPR is directly on the object
      if (!m.NOM_MIEM && !m.RAZ_MIEM) continue;
      await r()
          .input('COD_EMPR', sql.SmallInt,    COD_EMPR).input('COD_TERC',sql.BigInt,COD_TERC)
          .input('TIP_REPR', sql.Char(1),     m.TIP_REPR || 'P')
          .input('TIP_MIEM', sql.VarChar(10), toChar(m.TIP_MIEM))
          .input('NOM_MIEM', sql.VarChar(60), toChar(m.NOM_MIEM))
          .input('APE_MIEM', sql.VarChar(60), toChar(m.APE_MIEM))
          .input('RAZ_MIEM', sql.VarChar(120),toChar(m.RAZ_MIEM))
          .input('TIP_DOCU', sql.Int,         toInt(m.TIP_DOCU))
          .input('NUM_DOCU', sql.VarChar(20), toChar(m.NUM_DOCU))
          .input('FEC_EXPE', sql.Date,        toDate(m.FEC_EXPE))
          .input('COD_PAIS', sql.Int,         toInt(m.COD_PAIS))
          .input('COD_DEPT', sql.Int,         toInt(m.COD_DEPT))
          .input('COD_MPIO', sql.Int,         toInt(m.COD_MPIO))
          .input('DIR_MIEM', sql.VarChar(120),toChar(m.DIR_MIEM))
          .input('TEL_MIEM', sql.VarChar(30), toChar(m.TEL_MIEM))
          .input('MAIL_MIEM',sql.VarChar(100),toChar(m.MAIL_MIEM))
          .query(`INSERT INTO GN_JURID_JD(COD_EMPR,COD_TERC,TIP_REPR,TIP_MIEM,NOM_MIEM,APE_MIEM,RAZ_MIEM,
                  TIP_DOCU,NUM_DOCU,FEC_EXPE,COD_PAIS,COD_DEPT,COD_MPIO,DIR_MIEM,TEL_MIEM,MAIL_MIEM)
                  VALUES(@COD_EMPR,@COD_TERC,@TIP_REPR,@TIP_MIEM,@NOM_MIEM,@APE_MIEM,@RAZ_MIEM,
                  @TIP_DOCU,@NUM_DOCU,@FEC_EXPE,@COD_PAIS,@COD_DEPT,@COD_MPIO,@DIR_MIEM,@TEL_MIEM,@MAIL_MIEM)`);
    }

    // 7. GN_JURID_RF
    await del('GN_JURID_RF');
    const tieRevis = d.rf_TIE_REVIS || 'N';
    for (const rv of (Array.isArray(d.revisores)?d.revisores:[])) {
      // Flat format: TIP_REPR is directly on the object
      if (!rv.NOM_REVI && !rv.RAZ_REVI) continue;
      await r()
          .input('COD_EMPR',    sql.SmallInt,    COD_EMPR).input('COD_TERC',sql.BigInt,COD_TERC)
          .input('TIP_REPR',    sql.Char(1),     rv.TIP_REPR || 'P')
          .input('TIE_REVIS',   sql.Char(1),     tieRevis)
          .input('NOM_REVI',    sql.VarChar(60), toChar(rv.NOM_REVI))
          .input('APE_REVI',    sql.VarChar(60), toChar(rv.APE_REVI))
          .input('RAZ_REVI',    sql.VarChar(120),toChar(rv.RAZ_REVI))
          .input('TIP_DOCU',    sql.Int,         toInt(rv.TIP_DOCU))
          .input('NUM_DOCU',    sql.VarChar(20), toChar(rv.NUM_DOCU))
          .input('FEC_EXPE',    sql.Date,        toDate(rv.FEC_EXPE))
          .input('COD_PAIS',    sql.Int,         toInt(rv.COD_PAIS))
          .input('COD_DEPT',    sql.Int,         toInt(rv.COD_DEPT))
          .input('COD_MPIO',    sql.Int,         toInt(rv.COD_MPIO))
          .input('DIR_REVI',    sql.VarChar(120),toChar(rv.DIR_REVI))
          .input('CEL_REVI',    sql.VarChar(30), toChar(rv.CEL_REVI))
          .input('TEL_REVI',    sql.VarChar(30), toChar(rv.TEL_REVI))
          .input('MAIL_REVI',   sql.VarChar(100),toChar(rv.MAIL_REVI))
          .input('REVI_FIRMA',  sql.Char(1),     toChar(rv.REVI_FIRMA)||'N')
          .input('RAZ_FIRMA',   sql.VarChar(120),toChar(rv.RAZ_FIRMA))
          .input('TIP_DOCU_FIR',sql.Int,         toInt(rv.TIP_DOCU_FIR))
          .input('NUM_DOCU_FIR',sql.VarChar(20), toChar(rv.NUM_DOCU_FIR))
          .query(`INSERT INTO GN_JURID_RF(COD_EMPR,COD_TERC,TIP_REPR,TIE_REVIS,NOM_REVI,APE_REVI,RAZ_REVI,
                  TIP_DOCU,NUM_DOCU,FEC_EXPE,COD_PAIS,COD_DEPT,COD_MPIO,DIR_REVI,CEL_REVI,TEL_REVI,MAIL_REVI,
                  REVI_FIRMA,RAZ_FIRMA,TIP_DOCU_FIR,NUM_DOCU_FIR)
                  VALUES(@COD_EMPR,@COD_TERC,@TIP_REPR,@TIE_REVIS,@NOM_REVI,@APE_REVI,@RAZ_REVI,
                  @TIP_DOCU,@NUM_DOCU,@FEC_EXPE,@COD_PAIS,@COD_DEPT,@COD_MPIO,@DIR_REVI,@CEL_REVI,@TEL_REVI,@MAIL_REVI,
                  @REVI_FIRMA,@RAZ_FIRMA,@TIP_DOCU_FIR,@NUM_DOCU_FIR)`);
    }

    // 8. GN_JURID_AC
    await del('GN_JURID_AC');
    for (const ac of (Array.isArray(d.accionistas)?d.accionistas:[])) {
      if (!ac.NOM_ACCI && !ac.RAZ_ACCI) continue;
      await r()
        .input('COD_EMPR', sql.SmallInt,    COD_EMPR).input('COD_TERC',sql.BigInt,COD_TERC)
        .input('NOM_ACCI', sql.VarChar(60), toChar(ac.NOM_ACCI))
        .input('APE_ACCI', sql.VarChar(60), toChar(ac.APE_ACCI))
        .input('RAZ_ACCI', sql.VarChar(120),toChar(ac.RAZ_ACCI))
        .input('TIP_DOCU', sql.Int,         toInt(ac.TIP_DOCU))
        .input('NUM_DOCU', sql.VarChar(20), toChar(ac.NUM_DOCU))
        .input('FEC_EXPE', sql.Date,        toDate(ac.FEC_EXPE))
        .input('COD_PAIS', sql.Int,         toInt(ac.COD_PAIS))
        .input('COD_DEPT', sql.Int,         toInt(ac.COD_DEPT))
        .input('COD_MPIO', sql.Int,         toInt(ac.COD_MPIO))
        .input('DIR_ACCI', sql.VarChar(120),toChar(ac.DIR_ACCI))
        .input('CEL_ACCI', sql.VarChar(30), toChar(ac.CEL_ACCI))
        .input('TEL_ACCI', sql.VarChar(30), toChar(ac.TEL_ACCI))
        .input('MAIL_ACCI',sql.VarChar(100),toChar(ac.MAIL_ACCI))
        .input('PCT_PART', sql.Decimal(5,2),toDec(ac.PCT_PART))
        .query(`INSERT INTO GN_JURID_AC(COD_EMPR,COD_TERC,NOM_ACCI,APE_ACCI,RAZ_ACCI,TIP_DOCU,NUM_DOCU,
                FEC_EXPE,COD_PAIS,COD_DEPT,COD_MPIO,DIR_ACCI,CEL_ACCI,TEL_ACCI,MAIL_ACCI,PCT_PART)
                VALUES(@COD_EMPR,@COD_TERC,@NOM_ACCI,@APE_ACCI,@RAZ_ACCI,@TIP_DOCU,@NUM_DOCU,
                @FEC_EXPE,@COD_PAIS,@COD_DEPT,@COD_MPIO,@DIR_ACCI,@CEL_ACCI,@TEL_ACCI,@MAIL_ACCI,@PCT_PART)`);
    }

    // 9. GN_JURID_FIN
    await del('GN_JURID_FIN');
    const fin = d.financiera || {};
    await r()
      .input('COD_EMPR',   sql.SmallInt,    COD_EMPR).input('COD_TERC',sql.BigInt,COD_TERC)
      .input('ACT_TOTAL',  sql.Decimal(18,2),toDec(fin.ACT_TOTAL))
      .input('ING_MENS',   sql.Decimal(18,2),toDec(fin.ING_MENS))
      .input('PAS_TOTAL',  sql.Decimal(18,2),toDec(fin.PAS_TOTAL))
      .input('EGR_MENS',   sql.Decimal(18,2),toDec(fin.EGR_MENS))
      .input('PATRIMONIO', sql.Decimal(18,2),toDec(fin.PATRIMONIO))
      .input('OTR_ING',    sql.Decimal(18,2),toDec(fin.OTR_ING))
      .query(`INSERT INTO GN_JURID_FIN(COD_EMPR,COD_TERC,ACT_TOTAL,ING_MENS,PAS_TOTAL,EGR_MENS,PATRIMONIO,OTR_ING)
              VALUES(@COD_EMPR,@COD_TERC,@ACT_TOTAL,@ING_MENS,@PAS_TOTAL,@EGR_MENS,@PATRIMONIO,@OTR_ING)`);

    // 10. GN_TERCE_BANCO
    await del('GN_TERCE_BANCO');
    for (const b of (Array.isArray(d.bancaria)?d.bancaria:[])) {
      if (!b.COD_BANCO) continue;
      await r()
        .input('COD_EMPR',    sql.SmallInt,    COD_EMPR).input('COD_TERC',sql.BigInt,COD_TERC)
        .input('COD_BANCO',   sql.Int,         toInt(b.COD_BANCO))
        .input('TIP_CUEN',    sql.Int,         toInt(b.TIP_CUEN))
        .input('NUM_CUEN',    sql.VarChar(30), toChar(b.NUM_CUEN))
        .input('CUEN_EXTR',   sql.Char(1),     toChar(b.CUEN_EXTR)||'N')
        .input('NOM_ENT_EXT', sql.VarChar(120),toChar(b.NOM_ENT_EXT))
        .input('TIP_CUE_EXT', sql.VarChar(40), toChar(b.TIP_CUE_EXT))
        .query(`INSERT INTO GN_TERCE_BANCO(COD_EMPR,COD_TERC,COD_BANCO,TIP_CUEN,NUM_CUEN,CUEN_EXTR,NOM_ENT_EXT,TIP_CUE_EXT)
                VALUES(@COD_EMPR,@COD_TERC,@COD_BANCO,@TIP_CUEN,@NUM_CUEN,@CUEN_EXTR,@NOM_ENT_EXT,@TIP_CUE_EXT)`);
    }

    // 11. GN_JURID_PEP
    await del('GN_JURID_PEP');
    const pep = d.pep || {};
    await r().input('COD_EMPR',sql.SmallInt,COD_EMPR).input('COD_TERC',sql.BigInt,COD_TERC)
             .input('MAN_RPUB',sql.Char(1),pep.MAN_RPUB||'N').input('CAR_PUBL',sql.Char(1),pep.CAR_PUBL||'N')
             .query(`INSERT INTO GN_JURID_PEP(COD_EMPR,COD_TERC,MAN_RPUB,CAR_PUBL)VALUES(@COD_EMPR,@COD_TERC,@MAN_RPUB,@CAR_PUBL)`);

    // 12. GN_JURID_ACT
    await del('GN_JURID_ACT');
    const act = d.actividades || {};
    await r()
      .input('COD_EMPR',    sql.SmallInt,COD_EMPR).input('COD_TERC',sql.BigInt,COD_TERC)
      .input('ACT_VA_FIAT', sql.Char(1), act.ACT_VA_FIAT ||'N')
      .input('ACT_VA_VA',   sql.Char(1), act.ACT_VA_VA   ||'N')
      .input('ACT_TRANS',   sql.Char(1), act.ACT_TRANS   ||'N')
      .input('ACT_CUSTO',   sql.Char(1), act.ACT_CUSTO   ||'N')
      .input('ACT_SERV_FIN',sql.Char(1), act.ACT_SERV_FIN||'N')
      .input('ACT_SERV_VAP',sql.Char(1), act.ACT_SERV_VAP||'N')
      .input('CERT_INFO',   sql.Char(1), act.CERT_INFO   ||'N')
      .query(`INSERT INTO GN_JURID_ACT(COD_EMPR,COD_TERC,ACT_VA_FIAT,ACT_VA_VA,ACT_TRANS,ACT_CUSTO,ACT_SERV_FIN,ACT_SERV_VAP,CERT_INFO)
              VALUES(@COD_EMPR,@COD_TERC,@ACT_VA_FIAT,@ACT_VA_VA,@ACT_TRANS,@ACT_CUSTO,@ACT_SERV_FIN,@ACT_SERV_VAP,@CERT_INFO)`);

    // 13. GN_JURID_BF
    await del('GN_JURID_BF');
    for (const bf of (Array.isArray(d.beneficiarios)?d.beneficiarios:[])) {
      if (!bf.NOM_BENE && !bf.RAZ_BENE) continue;
      await r()
        .input('COD_EMPR', sql.SmallInt,    COD_EMPR).input('COD_TERC',sql.BigInt,COD_TERC)
        .input('TIP_BENE', sql.Char(1),     toChar(bf.TIP_BENE)||'N')
        .input('NOM_BENE', sql.VarChar(60), toChar(bf.NOM_BENE))
        .input('APE_BENE', sql.VarChar(60), toChar(bf.APE_BENE))
        .input('RAZ_BENE', sql.VarChar(120),toChar(bf.RAZ_BENE))
        .input('TIP_DOCU', sql.Int,         toInt(bf.TIP_DOCU))
        .input('NUM_DOCU', sql.VarChar(20), toChar(bf.NUM_DOCU))
        .input('FEC_EXPE', sql.Date,        toDate(bf.FEC_EXPE))
        .input('COD_PAIS', sql.Int,         toInt(bf.COD_PAIS))
        .input('COD_DEPT', sql.Int,         toInt(bf.COD_DEPT))
        .input('COD_MPIO', sql.Int,         toInt(bf.COD_MPIO))
        .input('DIR_BENE', sql.VarChar(120),toChar(bf.DIR_BENE))
        .input('TEL_BENE', sql.VarChar(30), toChar(bf.TEL_BENE))
        .input('MAIL_BENE',sql.VarChar(100),toChar(bf.MAIL_BENE))
        .query(`INSERT INTO GN_JURID_BF(COD_EMPR,COD_TERC,TIP_BENE,NOM_BENE,APE_BENE,RAZ_BENE,TIP_DOCU,NUM_DOCU,
                FEC_EXPE,COD_PAIS,COD_DEPT,COD_MPIO,DIR_BENE,TEL_BENE,MAIL_BENE)
                VALUES(@COD_EMPR,@COD_TERC,@TIP_BENE,@NOM_BENE,@APE_BENE,@RAZ_BENE,@TIP_DOCU,@NUM_DOCU,
                @FEC_EXPE,@COD_PAIS,@COD_DEPT,@COD_MPIO,@DIR_BENE,@TEL_BENE,@MAIL_BENE)`);
    }

    // 14. GN_JURID_FIRMA
    await del('GN_JURID_FIRMA');
    const firma = d.firma || {};
    if (firma.NOM_FIRM || firma.APE_FIRM) {
      await r()
        .input('COD_EMPR', sql.SmallInt,    COD_EMPR).input('COD_TERC',sql.BigInt,COD_TERC)
        .input('NOM_FIRM', sql.VarChar(60), toChar(firma.NOM_FIRM))
        .input('APE_FIRM', sql.VarChar(60), toChar(firma.APE_FIRM))
        .input('TIP_DOCU', sql.Int,         toInt(firma.TIP_DOCU))
        .input('NUM_DOCU', sql.VarChar(20), toChar(firma.NUM_DOCU))
        .input('FEC_FIRMA',sql.Date,        toDate(firma.FEC_FIRMA))
        .query(`INSERT INTO GN_JURID_FIRMA(COD_EMPR,COD_TERC,NOM_FIRM,APE_FIRM,TIP_DOCU,NUM_DOCU,FEC_FIRMA)
                VALUES(@COD_EMPR,@COD_TERC,@NOM_FIRM,@APE_FIRM,@TIP_DOCU,@NUM_DOCU,@FEC_FIRMA)`);
    }

    await transaction.commit();
    console.log(`✅ Jurídica actualizada. COD_TERC=${COD_TERC}, NUM_IDEN=${d.NUM_IDEN}`);
    res.json({ success: true, NUM_IDEN: d.NUM_IDEN, COD_TERC });

  } catch (err) {
    try { if (transaction) await transaction.rollback(); } catch (_) {}
    console.error('PUT /api/actualizar-completo:', err);
    res.status(500).json({ error: err.message || 'Error interno del servidor' });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
//  PERSONA JURÍDICA — Guardar registro completo
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/guardar-completo
 *
 * Inserta en una sola transacción todos los datos de Persona Jurídica:
 *   1.  GN_TERCE          — cabecera (TIP_TERC='J')
 *   2.  GN_JURID          — datos jurídicos principales
 *   3.  GN_JURID_RL       — representantes legales
 *   4.  GN_JURID_PAIS     — países de operación
 *   5.  GN_JURID_CUMP     — cumplimiento LAFT + oficiales
 *   6.  GN_JURID_JD       — junta directiva
 *   7.  GN_JURID_RF       — revisores fiscales
 *   8.  GN_JURID_AC       — composición accionaria
 *   9.  GN_JURID_FIN      — información financiera
 *   10. GN_TERCE_BANCO    — cuentas bancarias
 *   11. GN_JURID_PEP      — preguntas PEP
 *   12. GN_JURID_ACT      — actividades de riesgo SARLAFT
 *   13. GN_JURID_BF       — beneficiarios finales
 *   14. GN_JURID_FIRMA    — datos de la firma del representante
 *
 * Devuelve { success, NUM_IDEN, COD_TERC }.
 */
app.post('/api/guardar-completo', async (req, res) => {
  const d = req.body;

  if (!d.NUM_IDEN || !d.NOM_COMP) {
    return res.status(400).json({ error: 'Campos obligatorios faltantes: NUM_IDEN, NOM_COMP' });
  }

  const toInt  = v => (v !== null && v !== undefined && v !== '' && v !== 'NA') ? parseInt(v, 10) : null;
  const toDec  = v => (v !== null && v !== undefined && v !== '') ? parseFloat(v) : null;
  const toDate = v => v ? new Date(v) : null;
  const toChar = v => v || null;

  let pool, transaction;
  try {
    pool        = await sql.connect(dbConfig);
    transaction = new sql.Transaction(pool);
    await transaction.begin();
    const r = () => new sql.Request(transaction);

    // ── 1. GN_TERCE ──────────────────────────────────────────────────────────
    const resTerce = await r()
      .input('COD_EMPR',   sql.SmallInt,    COD_EMPR)
      .input('TIP_TERC',   sql.Char(1),     TIP_TERC_JURID)
      .input('COD_TPDOC',  sql.Int,         toInt(d.COD_TPDOC) || 8)
      .input('NUM_IDEN',   sql.VarChar(20), d.NUM_IDEN)
      .input('DIG_VERI',   sql.SmallInt,    toInt(d.DIG_VERI))
      .input('NOM_COMP',   sql.VarChar(240),String(d.NOM_COMP).substring(0, 240))
      .input('DIR_TERC',   sql.Char(120),   toChar(d.DIR_TERC))
      .input('TEL_TERC',   sql.Char(30),    toChar(d.TEL_TERC))
      .input('TEL_TERC2',  sql.Char(40),    toChar(d.TEL_TERC2))
      .input('DIR_MAIL',   sql.VarChar(150),toChar(d.DIR_MAIL))
      .query(`
        INSERT INTO GN_TERCE
          (COD_EMPR, TIP_TERC, COD_TPDOC, NUM_IDEN, DIG_VERI, NOM_COMP,
           DIR_TERC, TEL_TERC, TEL_TERC2, DIR_MAIL)
        OUTPUT INSERTED.COD_TERC
        VALUES
          (@COD_EMPR, @TIP_TERC, @COD_TPDOC, @NUM_IDEN, @DIG_VERI, @NOM_COMP,
           @DIR_TERC, @TEL_TERC, @TEL_TERC2, @DIR_MAIL)
      `);

    const COD_TERC = resTerce.recordset[0].COD_TERC;

    // ── 2. GN_JURID ──────────────────────────────────────────────────────────
    await r()
      .input('COD_EMPR',    sql.SmallInt,    COD_EMPR)
      .input('COD_TERC',    sql.BigInt,      COD_TERC)
      .input('TIP_VINC',    sql.VarChar(40), toChar(d.COD_VINC))
      .input('MAIL_SARL',   sql.VarChar(150),toChar(d.MAIL_SARL))
      .input('COD_CIIU',    sql.VarChar(10), toChar(d.COD_CIIU))
      .input('URL_WEB',     sql.VarChar(200),toChar(d.URL_WEB))
      .input('TIP_SOCIE',   sql.VarChar(10), toChar(d.TIP_SOCIE))
      .input('COD_PAIS_ORI',sql.Int,         toInt(d.COD_PAIS_EXP))   // país de constitución
      .input('UBIC_SOC',    sql.Char(1),     toChar(d.UBIC_SOC))
      .input('COD_PAIS_SOC',sql.Int,         toInt(d.COD_PAIS_SOC))
      .input('TIP_EMPR',    sql.VarChar(10), toChar(d.TIP_EMPR))
      .input('GRUP_EMPR',   sql.Char(1),     toChar(d.GRUP_EMPR))
      .input('COD_PAIS_EXP',sql.Int,         toInt(d.COD_PAIS_EXP))
      .input('COD_DEPT_EXP',sql.Int,         toInt(d.COD_DEPT_EXP))
      .input('COD_MPIO_EXP',sql.Int,         toInt(d.COD_MPIO_EXP))
      .query(`
        INSERT INTO GN_JURID
          (COD_EMPR, COD_TERC, TIP_VINC, MAIL_SARL, COD_CIIU, URL_WEB,
           TIP_SOCIE, COD_PAIS_ORI, UBIC_SOC, COD_PAIS_SOC, TIP_EMPR, GRUP_EMPR,
           COD_PAIS_EXP, COD_DEPT_EXP, COD_MPIO_EXP)
        VALUES
          (@COD_EMPR, @COD_TERC, @TIP_VINC, @MAIL_SARL, @COD_CIIU, @URL_WEB,
           @TIP_SOCIE, @COD_PAIS_ORI, @UBIC_SOC, @COD_PAIS_SOC, @TIP_EMPR, @GRUP_EMPR,
           @COD_PAIS_EXP, @COD_DEPT_EXP, @COD_MPIO_EXP)
      `);

    // ── 3. GN_JURID_RL — Representantes legales ───────────────────────────────
    const representantes = Array.isArray(d.representantes) ? d.representantes : [];
    for (const rl of representantes) {
      // Iterar Principal y Suplente dentro de cada grupo
      for (const rol of ['Principal', 'Suplente']) {
        const p = rl[rol] || rl; // compatibilidad con objeto plano
        if (!p.NOM_REPR && !p.APE_REPR) continue;
        await r()
          .input('COD_EMPR',  sql.SmallInt,    COD_EMPR)
          .input('COD_TERC',  sql.BigInt,      COD_TERC)
          .input('TIP_REPR',  sql.Char(1),     rol === 'Principal' ? 'P' : 'S')
          .input('NOM_REPR',  sql.VarChar(60), toChar(p.NOM_REPR))
          .input('APE_REPR',  sql.VarChar(60), toChar(p.APE_REPR))
          .input('TIP_DOCU',  sql.Int,         toInt(p.TIP_DOCU))
          .input('NUM_DOCU',  sql.VarChar(20), toChar(p.NUM_DOCU))
          .input('FEC_EXPE',  sql.Date,        toDate(p.FEC_EXPE))
          .input('COD_PAIS',  sql.Int,         toInt(p.COD_PAIS))
          .input('COD_DEPT',  sql.Int,         toInt(p.COD_DEPT))
          .input('COD_MPIO',  sql.Int,         toInt(p.COD_MPIO))
          .input('DIR_REPR',  sql.VarChar(120),toChar(p.DIR_REPR))
          .input('CEL_REPR',  sql.VarChar(30), toChar(p.CEL_REPR))
          .input('TEL_REPR',  sql.VarChar(30), toChar(p.TEL_REPR))
          .input('MAIL_REPR', sql.VarChar(100),toChar(p.MAIL_REPR))
          .query(`
            INSERT INTO GN_JURID_RL
              (COD_EMPR, COD_TERC, TIP_REPR, NOM_REPR, APE_REPR,
               TIP_DOCU, NUM_DOCU, FEC_EXPE,
               COD_PAIS, COD_DEPT, COD_MPIO,
               DIR_REPR, CEL_REPR, TEL_REPR, MAIL_REPR)
            VALUES
              (@COD_EMPR, @COD_TERC, @TIP_REPR, @NOM_REPR, @APE_REPR,
               @TIP_DOCU, @NUM_DOCU, @FEC_EXPE,
               @COD_PAIS, @COD_DEPT, @COD_MPIO,
               @DIR_REPR, @CEL_REPR, @TEL_REPR, @MAIL_REPR)
          `);
      }
    }

    // ── 4. GN_JURID_PAIS — Países de operación ────────────────────────────────
    const paises = Array.isArray(d.paises) ? d.paises : [];
    for (const p of paises) {
      if (!p.COD_PAIS) continue;
      await r()
        .input('COD_EMPR', sql.SmallInt, COD_EMPR)
        .input('COD_TERC', sql.BigInt,   COD_TERC)
        .input('COD_PAIS', sql.Int,      toInt(p.COD_PAIS))
        .query(`INSERT INTO GN_JURID_PAIS (COD_EMPR, COD_TERC, COD_PAIS)
                VALUES (@COD_EMPR, @COD_TERC, @COD_PAIS)`);
    }

    // ── 5. GN_JURID_CUMP — Cumplimiento LAFT ─────────────────────────────────
    const tieCump = d.cump_TIE_JUNTA || 'N';
    await r()
      .input('COD_EMPR',   sql.SmallInt,    COD_EMPR)
      .input('COD_TERC',   sql.BigInt,      COD_TERC)
      .input('REL_GRUPO',  sql.VarChar(200),toChar(d.REL_GRUPO))
      .input('NORM_LAFT',  sql.VarChar(200),toChar(d.NORM_LAFT))
      .input('SIS_PREVE',  sql.VarChar(200),toChar(d.SIS_PREVE))
      .input('DESC_NORM',  sql.VarChar(500),toChar(d.DESC_NORM))
      .input('TIE_JUNTA',  sql.Char(1),     tieCump)
      .query(`
        INSERT INTO GN_JURID_CUMP (COD_EMPR, COD_TERC, REL_GRUPO, NORM_LAFT, SIS_PREVE, DESC_NORM, TIE_JUNTA)
        VALUES (@COD_EMPR, @COD_TERC, @REL_GRUPO, @NORM_LAFT, @SIS_PREVE, @DESC_NORM, @TIE_JUNTA)
      `);

    // Oficiales de cumplimiento
    const oficiales = Array.isArray(d.oficiales) ? d.oficiales : [];
    for (const of_ of oficiales) {
      for (const rol of ['Principal', 'Suplente']) {
        const p = of_[rol] || of_;
        if (!p.NOM_RESP && !p.RAZ_RESP) continue;
        await r()
          .input('COD_EMPR',  sql.SmallInt,    COD_EMPR)
          .input('COD_TERC',  sql.BigInt,      COD_TERC)
          .input('TIP_REPR',  sql.Char(1),     rol === 'Principal' ? 'P' : 'S')
          .input('TIP_SIST',  sql.VarChar(10), toChar(p.TIP_SIST))
          .input('TIP_DOCU',  sql.Int,         toInt(p.TIP_DOCU))
          .input('NUM_DOCU',  sql.VarChar(20), toChar(p.NUM_DOCU))
          .input('FEC_EXPE',  sql.Date,        toDate(p.FEC_EXPE))
          .input('NOM_RESP',  sql.VarChar(60), toChar(p.NOM_RESP))
          .input('APE_RESP',  sql.VarChar(60), toChar(p.APE_RESP))
          .input('RAZ_RESP',  sql.VarChar(120),toChar(p.RAZ_RESP))
          .input('COD_PAIS',  sql.Int,         toInt(p.COD_PAIS))
          .input('COD_DEPT',  sql.Int,         toInt(p.COD_DEPT))
          .input('COD_MPIO',  sql.Int,         toInt(p.COD_MPIO))
          .input('DIR_RESP',  sql.VarChar(120),toChar(p.DIR_RESP))
          .input('TEL_RESP',  sql.VarChar(30), toChar(p.TEL_RESP))
          .input('MAIL_RESP', sql.VarChar(100),toChar(p.MAIL_RESP))
          .query(`
            INSERT INTO GN_JURID_CUMP
              (COD_EMPR, COD_TERC, TIP_REPR, TIP_SIST, TIP_DOCU, NUM_DOCU, FEC_EXPE,
               NOM_RESP, APE_RESP, RAZ_RESP, COD_PAIS, COD_DEPT, COD_MPIO,
               DIR_RESP, TEL_RESP, MAIL_RESP)
            VALUES
              (@COD_EMPR, @COD_TERC, @TIP_REPR, @TIP_SIST, @TIP_DOCU, @NUM_DOCU, @FEC_EXPE,
               @NOM_RESP, @APE_RESP, @RAZ_RESP, @COD_PAIS, @COD_DEPT, @COD_MPIO,
               @DIR_RESP, @TEL_RESP, @MAIL_RESP)
          `);
      }
    }

    // ── 6. GN_JURID_JD — Junta directiva ─────────────────────────────────────
    const jdMiembros = Array.isArray(d.juntaDirectiva) ? d.juntaDirectiva : [];
    for (const grupo of jdMiembros) {
      for (const rol of ['Principal', 'Suplente']) {
        const m = grupo[rol] || {};
        if (!m.NOM_MIEM && !m.RAZ_MIEM) continue;
        await r()
          .input('COD_EMPR',  sql.SmallInt,    COD_EMPR)
          .input('COD_TERC',  sql.BigInt,      COD_TERC)
          .input('TIP_REPR',  sql.Char(1),     rol === 'Principal' ? 'P' : 'S')
          .input('TIP_MIEM',  sql.VarChar(10), toChar(m.TIP_MIEM))
          .input('NOM_MIEM',  sql.VarChar(60), toChar(m.NOM_MIEM))
          .input('APE_MIEM',  sql.VarChar(60), toChar(m.APE_MIEM))
          .input('RAZ_MIEM',  sql.VarChar(120),toChar(m.RAZ_MIEM))
          .input('TIP_DOCU',  sql.Int,         toInt(m.TIP_DOCU))
          .input('NUM_DOCU',  sql.VarChar(20), toChar(m.NUM_DOCU))
          .input('FEC_EXPE',  sql.Date,        toDate(m.FEC_EXPE))
          .input('COD_PAIS',  sql.Int,         toInt(m.COD_PAIS))
          .input('COD_DEPT',  sql.Int,         toInt(m.COD_DEPT))
          .input('COD_MPIO',  sql.Int,         toInt(m.COD_MPIO))
          .input('DIR_MIEM',  sql.VarChar(120),toChar(m.DIR_MIEM))
          .input('TEL_MIEM',  sql.VarChar(30), toChar(m.TEL_MIEM))
          .input('MAIL_MIEM', sql.VarChar(100),toChar(m.MAIL_MIEM))
          .query(`
            INSERT INTO GN_JURID_JD
              (COD_EMPR, COD_TERC, TIP_REPR, TIP_MIEM, NOM_MIEM, APE_MIEM, RAZ_MIEM,
               TIP_DOCU, NUM_DOCU, FEC_EXPE, COD_PAIS, COD_DEPT, COD_MPIO,
               DIR_MIEM, TEL_MIEM, MAIL_MIEM)
            VALUES
              (@COD_EMPR, @COD_TERC, @TIP_REPR, @TIP_MIEM, @NOM_MIEM, @APE_MIEM, @RAZ_MIEM,
               @TIP_DOCU, @NUM_DOCU, @FEC_EXPE, @COD_PAIS, @COD_DEPT, @COD_MPIO,
               @DIR_MIEM, @TEL_MIEM, @MAIL_MIEM)
          `);
      }
    }

    // ── 7. GN_JURID_RF — Revisores fiscales ──────────────────────────────────
    const revisores = Array.isArray(d.revisores) ? d.revisores : [];
    for (const rf of revisores) {
      const tieRevis = rf.rf_TIE_REVIS || d.rf_TIE_REVIS || 'N';
      for (const rol of ['Principal', 'Suplente']) {
        const rv = rf[rol] || {};
        if (!rv.NOM_REVI && !rv.RAZ_REVI) {
          // Si solo se indica que no tiene, insertar fila mínima para Principal
          if (rol === 'Principal') {
            await r()
              .input('COD_EMPR',  sql.SmallInt, COD_EMPR)
              .input('COD_TERC',  sql.BigInt,   COD_TERC)
              .input('TIP_REPR',  sql.Char(1),  'P')
              .input('TIE_REVIS', sql.Char(1),  tieRevis)
              .query(`INSERT INTO GN_JURID_RF (COD_EMPR, COD_TERC, TIP_REPR, TIE_REVIS)
                      VALUES (@COD_EMPR, @COD_TERC, @TIP_REPR, @TIE_REVIS)`);
          }
          continue;
        }
        await r()
          .input('COD_EMPR',      sql.SmallInt,    COD_EMPR)
          .input('COD_TERC',      sql.BigInt,      COD_TERC)
          .input('TIP_REPR',      sql.Char(1),     rol === 'Principal' ? 'P' : 'S')
          .input('TIE_REVIS',     sql.Char(1),     tieRevis)
          .input('NOM_REVI',      sql.VarChar(60), toChar(rv.NOM_REVI))
          .input('APE_REVI',      sql.VarChar(60), toChar(rv.APE_REVI))
          .input('RAZ_REVI',      sql.VarChar(120),toChar(rv.RAZ_REVI))
          .input('TIP_DOCU',      sql.Int,         toInt(rv.TIP_DOCU))
          .input('NUM_DOCU',      sql.VarChar(20), toChar(rv.NUM_DOCU))
          .input('FEC_EXPE',      sql.Date,        toDate(rv.FEC_EXPE))
          .input('COD_PAIS',      sql.Int,         toInt(rv.COD_PAIS))
          .input('COD_DEPT',      sql.Int,         toInt(rv.COD_DEPT))
          .input('COD_MPIO',      sql.Int,         toInt(rv.COD_MPIO))
          .input('DIR_REVI',      sql.VarChar(120),toChar(rv.DIR_REVI))
          .input('CEL_REVI',      sql.VarChar(30), toChar(rv.CEL_REVI))
          .input('TEL_REVI',      sql.VarChar(30), toChar(rv.TEL_REVI))
          .input('MAIL_REVI',     sql.VarChar(100),toChar(rv.MAIL_REVI))
          .input('REVI_FIRMA',    sql.Char(1),     toChar(rf.REVI_FIRMA) || 'N')
          .input('RAZ_FIRMA',     sql.VarChar(120),toChar(rf.RAZ_FIRMA))
          .input('TIP_DOCU_FIR',  sql.Int,         toInt(rf.TIP_DOCU_FIR))
          .input('NUM_DOCU_FIR',  sql.VarChar(20), toChar(rf.NUM_DOCU_FIR))
          .query(`
            INSERT INTO GN_JURID_RF
              (COD_EMPR, COD_TERC, TIP_REPR, TIE_REVIS,
               NOM_REVI, APE_REVI, RAZ_REVI,
               TIP_DOCU, NUM_DOCU, FEC_EXPE, COD_PAIS, COD_DEPT, COD_MPIO,
               DIR_REVI, CEL_REVI, TEL_REVI, MAIL_REVI,
               REVI_FIRMA, RAZ_FIRMA, TIP_DOCU_FIR, NUM_DOCU_FIR)
            VALUES
              (@COD_EMPR, @COD_TERC, @TIP_REPR, @TIE_REVIS,
               @NOM_REVI, @APE_REVI, @RAZ_REVI,
               @TIP_DOCU, @NUM_DOCU, @FEC_EXPE, @COD_PAIS, @COD_DEPT, @COD_MPIO,
               @DIR_REVI, @CEL_REVI, @TEL_REVI, @MAIL_REVI,
               @REVI_FIRMA, @RAZ_FIRMA, @TIP_DOCU_FIR, @NUM_DOCU_FIR)
          `);
      }
    }

    // ── 8. GN_JURID_AC — Accionistas ──────────────────────────────────────────
    const accionistas = Array.isArray(d.accionistas) ? d.accionistas : [];
    for (const ac of accionistas) {
      if (!ac.NOM_ACCI && !ac.RAZ_ACCI) continue;
      await r()
        .input('COD_EMPR',  sql.SmallInt,      COD_EMPR)
        .input('COD_TERC',  sql.BigInt,        COD_TERC)
        .input('NOM_ACCI',  sql.VarChar(60),   toChar(ac.NOM_ACCI))
        .input('APE_ACCI',  sql.VarChar(60),   toChar(ac.APE_ACCI))
        .input('RAZ_ACCI',  sql.VarChar(120),  toChar(ac.RAZ_ACCI))
        .input('TIP_DOCU',  sql.Int,           toInt(ac.TIP_DOCU))
        .input('NUM_DOCU',  sql.VarChar(20),   toChar(ac.NUM_DOCU))
        .input('FEC_EXPE',  sql.Date,          toDate(ac.FEC_EXPE))
        .input('COD_PAIS',  sql.Int,           toInt(ac.COD_PAIS))
        .input('COD_DEPT',  sql.Int,           toInt(ac.COD_DEPT))
        .input('COD_MPIO',  sql.Int,           toInt(ac.COD_MPIO))
        .input('DIR_ACCI',  sql.VarChar(120),  toChar(ac.DIR_ACCI))
        .input('CEL_ACCI',  sql.VarChar(30),   toChar(ac.CEL_ACCI))
        .input('TEL_ACCI',  sql.VarChar(30),   toChar(ac.TEL_ACCI))
        .input('MAIL_ACCI', sql.VarChar(100),  toChar(ac.MAIL_ACCI))
        .input('PCT_PART',  sql.Decimal(5,2),  toDec(ac.PCT_PART))
        .query(`
          INSERT INTO GN_JURID_AC
            (COD_EMPR, COD_TERC, NOM_ACCI, APE_ACCI, RAZ_ACCI,
             TIP_DOCU, NUM_DOCU, FEC_EXPE, COD_PAIS, COD_DEPT, COD_MPIO,
             DIR_ACCI, CEL_ACCI, TEL_ACCI, MAIL_ACCI, PCT_PART)
          VALUES
            (@COD_EMPR, @COD_TERC, @NOM_ACCI, @APE_ACCI, @RAZ_ACCI,
             @TIP_DOCU, @NUM_DOCU, @FEC_EXPE, @COD_PAIS, @COD_DEPT, @COD_MPIO,
             @DIR_ACCI, @CEL_ACCI, @TEL_ACCI, @MAIL_ACCI, @PCT_PART)
        `);
    }

    // ── 9. GN_JURID_FIN — Financiera ─────────────────────────────────────────
    const fin = d.financiera || {};
    await r()
      .input('COD_EMPR',   sql.SmallInt,      COD_EMPR)
      .input('COD_TERC',   sql.BigInt,        COD_TERC)
      .input('ACT_TOTAL',  sql.Decimal(18,2), toDec(fin.ACT_TOTAL))
      .input('ING_MENS',   sql.Decimal(18,2), toDec(fin.ING_MENS))
      .input('PAS_TOTAL',  sql.Decimal(18,2), toDec(fin.PAS_TOTAL))
      .input('EGR_MENS',   sql.Decimal(18,2), toDec(fin.EGR_MENS))
      .input('PATRIMONIO', sql.Decimal(18,2), toDec(fin.PATRIMONIO))
      .input('OTR_ING',    sql.Decimal(18,2), toDec(fin.OTR_ING))
      .query(`
        INSERT INTO GN_JURID_FIN
          (COD_EMPR, COD_TERC, ACT_TOTAL, ING_MENS, PAS_TOTAL, EGR_MENS, PATRIMONIO, OTR_ING)
        VALUES
          (@COD_EMPR, @COD_TERC, @ACT_TOTAL, @ING_MENS, @PAS_TOTAL, @EGR_MENS, @PATRIMONIO, @OTR_ING)
      `);

    // ── 10. GN_TERCE_BANCO — Cuentas bancarias ────────────────────────────────
    const bancos = Array.isArray(d.bancaria) ? d.bancaria : [];
    for (const b of bancos) {
      if (!b.COD_BANCO) continue;
      await r()
        .input('COD_EMPR',    sql.SmallInt,    COD_EMPR)
        .input('COD_TERC',    sql.BigInt,      COD_TERC)
        .input('COD_BANCO',   sql.Int,         toInt(b.COD_BANCO))
        .input('TIP_CUEN',    sql.Int,         toInt(b.TIP_CUEN))
        .input('NUM_CUEN',    sql.VarChar(30), toChar(b.NUM_CUEN))
        .input('CUEN_EXTR',   sql.Char(1),     toChar(b.CUEN_EXTR) || 'N')
        .input('NOM_ENT_EXT', sql.VarChar(120),toChar(b.NOM_ENT_EXT))
        .input('TIP_CUE_EXT', sql.VarChar(40), toChar(b.TIP_CUE_EXT))
        .query(`
          INSERT INTO GN_TERCE_BANCO
            (COD_EMPR, COD_TERC, COD_BANCO, TIP_CUEN, NUM_CUEN, CUEN_EXTR, NOM_ENT_EXT, TIP_CUE_EXT)
          VALUES
            (@COD_EMPR, @COD_TERC, @COD_BANCO, @TIP_CUEN, @NUM_CUEN, @CUEN_EXTR, @NOM_ENT_EXT, @TIP_CUE_EXT)
        `);
    }

    // ── 11. GN_JURID_PEP ─────────────────────────────────────────────────────
    const pep = d.pep || {};
    await r()
      .input('COD_EMPR', sql.SmallInt, COD_EMPR)
      .input('COD_TERC', sql.BigInt,   COD_TERC)
      .input('MAN_RPUB', sql.Char(1),  pep.MAN_RPUB || 'N')
      .input('CAR_PUBL', sql.Char(1),  pep.CAR_PUBL || 'N')
      .query(`INSERT INTO GN_JURID_PEP (COD_EMPR, COD_TERC, MAN_RPUB, CAR_PUBL)
              VALUES (@COD_EMPR, @COD_TERC, @MAN_RPUB, @CAR_PUBL)`);

    // ── 12. GN_JURID_ACT — Actividades virtuales ──────────────────────────────
    const act = d.actividades || {};
    await r()
      .input('COD_EMPR',     sql.SmallInt, COD_EMPR)
      .input('COD_TERC',     sql.BigInt,   COD_TERC)
      .input('ACT_VA_FIAT',  sql.Char(1),  act.ACT_VA_FIAT  || 'N')
      .input('ACT_VA_VA',    sql.Char(1),  act.ACT_VA_VA    || 'N')
      .input('ACT_TRANS',    sql.Char(1),  act.ACT_TRANS    || 'N')
      .input('ACT_CUSTO',    sql.Char(1),  act.ACT_CUSTO    || 'N')
      .input('ACT_SERV_FIN', sql.Char(1),  act.ACT_SERV_FIN || 'N')
      .input('ACT_SERV_VAP', sql.Char(1),  act.ACT_SERV_VAP || 'N')
      .input('CERT_INFO',    sql.Char(1),  act.CERT_INFO    || 'N')
      .query(`
        INSERT INTO GN_JURID_ACT
          (COD_EMPR, COD_TERC, ACT_VA_FIAT, ACT_VA_VA, ACT_TRANS, ACT_CUSTO,
           ACT_SERV_FIN, ACT_SERV_VAP, CERT_INFO)
        VALUES
          (@COD_EMPR, @COD_TERC, @ACT_VA_FIAT, @ACT_VA_VA, @ACT_TRANS, @ACT_CUSTO,
           @ACT_SERV_FIN, @ACT_SERV_VAP, @CERT_INFO)
      `);

    // ── 13. GN_JURID_BF — Beneficiarios finales ───────────────────────────────
    const beneficiarios = Array.isArray(d.beneficiarios) ? d.beneficiarios : [];
    for (const bf of beneficiarios) {
      if (!bf.NOM_BENE && !bf.RAZ_BENE) continue;
      await r()
        .input('COD_EMPR',  sql.SmallInt,    COD_EMPR)
        .input('COD_TERC',  sql.BigInt,      COD_TERC)
        .input('TIP_BENE',  sql.Char(1),     toChar(bf.TIP_BENE) || 'N')
        .input('NOM_BENE',  sql.VarChar(60), toChar(bf.NOM_BENE))
        .input('APE_BENE',  sql.VarChar(60), toChar(bf.APE_BENE))
        .input('RAZ_BENE',  sql.VarChar(120),toChar(bf.RAZ_BENE))
        .input('TIP_DOCU',  sql.Int,         toInt(bf.TIP_DOCU))
        .input('NUM_DOCU',  sql.VarChar(20), toChar(bf.NUM_DOCU))
        .input('FEC_EXPE',  sql.Date,        toDate(bf.FEC_EXPE))
        .input('COD_PAIS',  sql.Int,         toInt(bf.COD_PAIS))
        .input('COD_DEPT',  sql.Int,         toInt(bf.COD_DEPT))
        .input('COD_MPIO',  sql.Int,         toInt(bf.COD_MPIO))
        .input('DIR_BENE',  sql.VarChar(120),toChar(bf.DIR_BENE))
        .input('TEL_BENE',  sql.VarChar(30), toChar(bf.TEL_BENE))
        .input('MAIL_BENE', sql.VarChar(100),toChar(bf.MAIL_BENE))
        .query(`
          INSERT INTO GN_JURID_BF
            (COD_EMPR, COD_TERC, TIP_BENE, NOM_BENE, APE_BENE, RAZ_BENE,
             TIP_DOCU, NUM_DOCU, FEC_EXPE, COD_PAIS, COD_DEPT, COD_MPIO,
             DIR_BENE, TEL_BENE, MAIL_BENE)
          VALUES
            (@COD_EMPR, @COD_TERC, @TIP_BENE, @NOM_BENE, @APE_BENE, @RAZ_BENE,
             @TIP_DOCU, @NUM_DOCU, @FEC_EXPE, @COD_PAIS, @COD_DEPT, @COD_MPIO,
             @DIR_BENE, @TEL_BENE, @MAIL_BENE)
        `);
    }

    // ── 14. GN_JURID_FIRMA — Firma del representante ──────────────────────────
    const firma = d.firma || {};
    if (firma.NOM_FIRM || firma.APE_FIRM) {
      await r()
        .input('COD_EMPR',  sql.SmallInt,    COD_EMPR)
        .input('COD_TERC',  sql.BigInt,      COD_TERC)
        .input('NOM_FIRM',  sql.VarChar(60), toChar(firma.NOM_FIRM))
        .input('APE_FIRM',  sql.VarChar(60), toChar(firma.APE_FIRM))
        .input('TIP_DOCU',  sql.Int,         toInt(firma.TIP_DOCU))
        .input('NUM_DOCU',  sql.VarChar(20), toChar(firma.NUM_DOCU))
        .input('FEC_FIRMA', sql.Date,        toDate(firma.FEC_FIRMA))
        .query(`
          INSERT INTO GN_JURID_FIRMA (COD_EMPR, COD_TERC, NOM_FIRM, APE_FIRM, TIP_DOCU, NUM_DOCU, FEC_FIRMA)
          VALUES (@COD_EMPR, @COD_TERC, @NOM_FIRM, @APE_FIRM, @TIP_DOCU, @NUM_DOCU, @FEC_FIRMA)
        `);
    }

    await transaction.commit();

    console.log(`✅ Jurídica guardada. COD_TERC=${COD_TERC}, NUM_IDEN=${d.NUM_IDEN}`);
    res.json({ success: true, NUM_IDEN: d.NUM_IDEN, COD_TERC });

  } catch (err) {
    try { await transaction.rollback(); } catch (_) {}
    console.error('POST /api/guardar-completo:', err);
    res.status(500).json({ error: err.message || 'Error interno del servidor' });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
//  PERSONA NATURAL — Guardar registro completo
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/guardar-completo-natural
 *
 * Inserta en una sola transacción:
 *   1. GN_TERCE       — cabecera (TIP_TERC='N'), incluyendo nombres propios
 *   2. GN_NATUR       — datos exclusivos de persona natural
 *   3. GN_NATUR_FIN   — información financiera
 *   4. GN_TERCE_BANCO — cuentas bancarias (1..n)
 *   5. GN_NATUR_PEP   — preguntas PEP
 *   6. GN_NATUR_ACT   — actividades de riesgo SARLAFT
 *   7. GN_TERCE_DOC   — documentos adjuntos (0..n)
 *
 * Devuelve { success, NUM_IDEN, COD_TERC }.
 */
app.post('/api/guardar-completo-natural', async (req, res) => {
  const b = req.body;

  if (!b.NUM_IDEN || !b.NOM_TERC || !b.APE_TERC) {
    return res.status(400).json({ error: 'Faltan campos obligatorios (NUM_IDEN, NOM_TERC, APE_TERC).' });
  }

  // Helpers de conversión
  const toInt  = v => (v !== null && v !== undefined && v !== '' && v !== 'NA') ? parseInt(v, 10)   : null;
  const toChar = v => v || null;

  let pool, transaction;
  try {
    pool        = await sql.connect(dbConfig);
    transaction = new sql.Transaction(pool);
    await transaction.begin();
    const r = () => new sql.Request(transaction);

    // ── 1. GN_TERCE ──────────────────────────────────────────────────────────
    // Para persona natural guardamos también NOM_TERC / APE_TERC como campos
    // separados (además de NOM_COMP para búsquedas).
    const nomComp = [b.NOM_TERC, b.SEG_NOMB, b.APE_TERC, b.SEG_APEL]
      .filter(Boolean).join(' ');

    const resTerce = await r()
      .input('COD_EMPR',  sql.SmallInt,    COD_EMPR)
      .input('TIP_TERC',  sql.Char(1),     TIP_TERC_NATUR)
      .input('COD_TPDOC', sql.Int,         toInt(b.COD_TPDOC) || 8)
      .input('NUM_IDEN',  sql.VarChar(20), b.NUM_IDEN)
      .input('NOM_TERC',  sql.Char(40),    (b.NOM_TERC || '').substring(0,40))
      .input('SEG_NOMB',  sql.VarChar(40), b.SEG_NOMB || null)
      .input('APE_TERC',  sql.Char(40),    (b.APE_TERC || '').substring(0,40))
      .input('SEG_APEL',  sql.VarChar(40), b.SEG_APEL || null)
      .input('NOM_COMP',  sql.VarChar(240),nomComp.substring(0,240))
      .input('DIR_TERC',  sql.Char(120),   b.DIR_TERC  || null)
      .input('TEL_TERC',  sql.Char(30),    b.TEL_TERC  || null)
      .input('TEL_TERC2', sql.Char(40),    b.TEL_TERC2 || null)
      .input('DIR_MAIL',  sql.VarChar(150),b.DIR_MAIL  || null)
      .query(`
        INSERT INTO GN_TERCE
          (COD_EMPR, TIP_TERC, COD_TPDOC, NUM_IDEN,
           NOM_TERC, SEG_NOMB, APE_TERC, SEG_APEL, NOM_COMP,
           DIR_TERC, TEL_TERC, TEL_TERC2, DIR_MAIL)
        OUTPUT INSERTED.COD_TERC
        VALUES
          (@COD_EMPR, @TIP_TERC, @COD_TPDOC, @NUM_IDEN,
           @NOM_TERC, @SEG_NOMB, @APE_TERC, @SEG_APEL, @NOM_COMP,
           @DIR_TERC, @TEL_TERC, @TEL_TERC2, @DIR_MAIL)
      `);

    const COD_TERC = resTerce.recordset[0].COD_TERC;

    // ── 2. GN_NATUR ──────────────────────────────────────────────────────────
    // COD_NACIO, COD_PAIS_EXP, COD_DEPT_EXP, COD_MPIO_EXP son int en la BD.
    // COD_DEPT_EXP puede llegar como 'NA' (pais extranjero) → null.
    await r()
      .input('COD_EMPR',    sql.SmallInt,    COD_EMPR)
      .input('COD_TERC',    sql.BigInt,      COD_TERC)
      .input('TIP_VINC',    sql.VarChar(40), toChar(b.COD_VINC))
      .input('MAIL_SARL',   sql.VarChar(150),b.MAIL_SARL   || null)
      .input('COD_NACIO',   sql.Int,         toInt(b.COD_NACIO))
      .input('ACT_PRINC',   sql.VarChar(100),b.ACT_PRINC   || null)
      .input('COD_CIIU',    sql.VarChar(10), b.COD_CIIU    || null)
      .input('FEC_EXPE',    sql.Date,        b.FEC_EXPE ? new Date(b.FEC_EXPE) : null)
      .input('COD_PAIS_EXP',sql.Int,         toInt(b.COD_PAIS_EXP))
      .input('COD_DEPT_EXP',sql.Int,         toInt(b.COD_DEPT_EXP))
      .input('COD_MPIO_EXP',sql.Int,         toInt(b.COD_MPIO_EXP))
      .query(`
        INSERT INTO GN_NATUR
          (COD_EMPR, COD_TERC, TIP_VINC, MAIL_SARL, COD_NACIO,
           ACT_PRINC, COD_CIIU, FEC_EXPE,
           COD_PAIS_EXP, COD_DEPT_EXP, COD_MPIO_EXP)
        VALUES
          (@COD_EMPR, @COD_TERC, @TIP_VINC, @MAIL_SARL, @COD_NACIO,
           @ACT_PRINC, @COD_CIIU, @FEC_EXPE,
           @COD_PAIS_EXP, @COD_DEPT_EXP, @COD_MPIO_EXP)
      `);

    // ── 3. GN_NATUR_FIN ──────────────────────────────────────────────────────
    const fin = b.financiera || {};
    await r()
      .input('COD_EMPR',   sql.SmallInt,       COD_EMPR)
      .input('COD_TERC',   sql.BigInt,          COD_TERC)
      .input('ACT_TOTAL',  sql.Decimal(18,2),   fin.ACT_TOTAL  ?? null)
      .input('ING_MENS',   sql.Decimal(18,2),   fin.ING_MENS   ?? null)
      .input('PAS_TOTAL',  sql.Decimal(18,2),   fin.PAS_TOTAL  ?? null)
      .input('EGR_MENS',   sql.Decimal(18,2),   fin.EGR_MENS   ?? null)
      .input('PATRIMONIO', sql.Decimal(18,2),   fin.PATRIMONIO ?? null)
      .input('OTR_ING',    sql.Decimal(18,2),   fin.OTR_ING    ?? null)
      .query(`
        INSERT INTO GN_NATUR_FIN
          (COD_EMPR, COD_TERC,
           ACT_TOTAL, ING_MENS, PAS_TOTAL, EGR_MENS, PATRIMONIO, OTR_ING)
        VALUES
          (@COD_EMPR, @COD_TERC,
           @ACT_TOTAL, @ING_MENS, @PAS_TOTAL, @EGR_MENS, @PATRIMONIO, @OTR_ING)
      `);

    // ── 4. GN_TERCE_BANCO ────────────────────────────────────────────────────
    // Columnas reales: COD_BANCO(int), TIP_CUEN(int), NUM_CUEN, CUEN_EXTR,
    //                  NOM_ENT_EXT, TIP_CUE_EXT
    const bancos = Array.isArray(b.bancaria) ? b.bancaria : [];
    for (const cuenta of bancos) {
      if (!cuenta.COD_BANCO) continue;
      await r()
        .input('COD_EMPR',    sql.SmallInt,    COD_EMPR)
        .input('COD_TERC',    sql.BigInt,      COD_TERC)
        .input('COD_BANCO',   sql.Int,         toInt(cuenta.COD_BANCO))
        .input('TIP_CUEN',    sql.Int,         toInt(cuenta.TIP_CUEN))
        .input('NUM_CUEN',    sql.VarChar(30), cuenta.NUM_CUEN   || null)
        .input('CUEN_EXTR',   sql.Char(1),     cuenta.CUEN_EXTR  || 'N')
        .input('NOM_ENT_EXT', sql.VarChar(120),cuenta.NOM_ENT_EXT|| null)
        .input('TIP_CUE_EXT', sql.VarChar(40), cuenta.TIP_CUE_EXT|| null)
        .query(`
          INSERT INTO GN_TERCE_BANCO
            (COD_EMPR, COD_TERC, COD_BANCO, TIP_CUEN, NUM_CUEN,
             CUEN_EXTR, NOM_ENT_EXT, TIP_CUE_EXT)
          VALUES
            (@COD_EMPR, @COD_TERC, @COD_BANCO, @TIP_CUEN, @NUM_CUEN,
             @CUEN_EXTR, @NOM_ENT_EXT, @TIP_CUE_EXT)
        `);
    }

    // ── 5. GN_NATUR_PEP ──────────────────────────────────────────────────────
    const pep = b.pep || {};
    await r()
      .input('COD_EMPR', sql.SmallInt, COD_EMPR)
      .input('COD_TERC', sql.BigInt,   COD_TERC)
      .input('MAN_RPUB', sql.Char(1),  pep.MAN_RPUB || 'N')
      .input('CAR_PUBL', sql.Char(1),  pep.CAR_PUBL || 'N')
      .query(`
        INSERT INTO GN_NATUR_PEP (COD_EMPR, COD_TERC, MAN_RPUB, CAR_PUBL)
        VALUES (@COD_EMPR, @COD_TERC, @MAN_RPUB, @CAR_PUBL)
      `);

    // ── 6. GN_NATUR_ACT ──────────────────────────────────────────────────────
    const act = b.actividades || {};
    await r()
      .input('COD_EMPR',     sql.SmallInt, COD_EMPR)
      .input('COD_TERC',     sql.BigInt,   COD_TERC)
      .input('ACT_VA_FIAT',  sql.Char(1),  act.ACT_VA_FIAT  || 'N')
      .input('ACT_VA_VA',    sql.Char(1),  act.ACT_VA_VA    || 'N')
      .input('ACT_TRANS',    sql.Char(1),  act.ACT_TRANS    || 'N')
      .input('ACT_CUSTO',    sql.Char(1),  act.ACT_CUSTO    || 'N')
      .input('ACT_SERV_FIN', sql.Char(1),  act.ACT_SERV_FIN || 'N')
      .input('ACT_SERV_VAP', sql.Char(1),  act.ACT_SERV_VAP || 'N')
      .input('CERT_INFO',    sql.Char(1),  act.CERT_INFO    || 'N')
      .query(`
        INSERT INTO GN_NATUR_ACT
          (COD_EMPR, COD_TERC,
           ACT_VA_FIAT, ACT_VA_VA, ACT_TRANS, ACT_CUSTO,
           ACT_SERV_FIN, ACT_SERV_VAP, CERT_INFO)
        VALUES
          (@COD_EMPR, @COD_TERC,
           @ACT_VA_FIAT, @ACT_VA_VA, @ACT_TRANS, @ACT_CUSTO,
           @ACT_SERV_FIN, @ACT_SERV_VAP, @CERT_INFO)
      `);

    // ── 7. GN_TERCE_DOC ──────────────────────────────────────────────────────
    // Columnas reales: TIP_DOC, NOM_DOC, RUT_DOC, FEC_CARG, NOM_ARCH, EXT_ARCH
    const docs = Array.isArray(b.documentos) ? b.documentos : [];
    for (const doc of docs) {
      if (!doc.TIP_DOC && !doc.TIP_DOCU) continue;
      const tipDoc  = doc.TIP_DOC  || doc.TIP_DOCU || null;
      const nomDoc  = doc.NOM_DOC  || doc.NOM_ARCH || null;
      const rutDoc  = doc.RUT_DOC  || doc.RUT_ARCH || null;
      await r()
        .input('COD_EMPR', sql.SmallInt,    COD_EMPR)
        .input('COD_TERC', sql.BigInt,      COD_TERC)
        .input('TIP_DOC',  sql.VarChar(20), tipDoc)
        .input('NOM_DOC',  sql.VarChar(120),nomDoc)
        .input('RUT_DOC',  sql.VarChar(500),rutDoc)
        .input('FEC_CARG', sql.Date,        doc.FEC_CARG ? new Date(doc.FEC_CARG) : new Date())
        .input('NOM_ARCH', sql.VarChar(260),doc.NOM_ARCH || null)
        .input('EXT_ARCH', sql.VarChar(10), doc.EXT_ARCH || null)
        .query(`
          INSERT INTO GN_TERCE_DOC
            (COD_EMPR, COD_TERC, TIP_DOC, NOM_DOC, RUT_DOC, FEC_CARG, NOM_ARCH, EXT_ARCH)
          VALUES
            (@COD_EMPR, @COD_TERC, @TIP_DOC, @NOM_DOC, @RUT_DOC, @FEC_CARG, @NOM_ARCH, @EXT_ARCH)
        `);
    }

    await transaction.commit();

    console.log(`✅ Natural guardado. COD_TERC=${COD_TERC}, NUM_IDEN=${b.NUM_IDEN}`);
    res.json({ success: true, NUM_IDEN: b.NUM_IDEN, COD_TERC });

  } catch (err) {
    try { await transaction.rollback(); } catch (_) {}
    console.error('POST /api/guardar-completo-natural:', err);
    res.status(500).json({ error: err.message || 'Error interno del servidor' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  PERSONA NATURAL — Exportar Excel
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/exportar-excel-natural/:codTerc
 *
 * Genera un Excel con 4 hojas temáticas. Solo muestra los campos que el
 * formulario recopila, con etiquetas legibles y códigos resueltos a nombres
 * mediante JOINs a los catálogos correspondientes.
 */
app.get('/api/exportar-excel-natural/:codTerc', async (req, res) => {
  const codTerc = parseInt(req.params.codTerc, 10);
  if (!codTerc) return res.status(400).json({ error: 'codTerc inválido' });

  try {
    const pool = await sql.connect(dbConfig);

    const q = async (query) => {
      const rq = pool.request();
      rq.input('COD_EMPR', sql.SmallInt, COD_EMPR);
      rq.input('COD_TERC', sql.BigInt,   codTerc);
      return (await rq.query(query)).recordset;
    };

    // ── 1. Datos personales (GN_TERCE + GN_NATUR + catálogos) ────────────────
    const [personales, financiera, bancaria, pepAct, documentos] = await Promise.all([

      q(`SELECT
          td.NOM_TPDOC                                  AS [Tipo de documento],
          t.NUM_IDEN                                    AS [Número de identificación],
          LTRIM(RTRIM(ISNULL(t.NOM_TERC,'')))           AS [Primer nombre],
          LTRIM(RTRIM(ISNULL(t.SEG_NOMB,'')))           AS [Segundo nombre],
          LTRIM(RTRIM(ISNULL(t.APE_TERC,'')))           AS [Primer apellido],
          LTRIM(RTRIM(ISNULL(t.SEG_APEL,'')))           AS [Segundo apellido],
          LTRIM(RTRIM(ISNULL(t.DIR_TERC,'')))           AS [Dirección],
          LTRIM(RTRIM(ISNULL(t.TEL_TERC,'')))           AS [Teléfono celular],
          LTRIM(RTRIM(ISNULL(t.TEL_TERC2,'')))          AS [Teléfono fijo],
          t.DIR_MAIL                                    AS [Email corporativo],
          ISNULL(v.NOM_VINC, n.TIP_VINC)               AS [Tipo de vinculación],
          n.MAIL_SARL                                   AS [Email SARLAFT],
          ISNULL(pn.NOM_PAIS,'')                        AS [Nacionalidad],
          ISNULL(n.ACT_PRINC,'')                        AS [Actividad principal],
          ISNULL(n.COD_CIIU,'') + CASE WHEN ci.NOM_CIIU IS NOT NULL THEN ' — ' + ci.NOM_CIIU ELSE '' END
                                                        AS [Actividad CIIU],
          CONVERT(varchar,n.FEC_EXPE,103)               AS [Fecha expedición documento],
          ISNULL(pp.NOM_PAIS,'')                        AS [País de expedición],
          ISNULL(dp.NOM_DEPT,'')                        AS [Departamento de expedición],
          ISNULL(mn.NOM_MUNI,'')                        AS [Ciudad de expedición]
        FROM GN_TERCE t
          JOIN GN_NATUR n  ON n.COD_EMPR = t.COD_EMPR AND n.COD_TERC = t.COD_TERC
          LEFT JOIN MAE_TPDOC td ON td.COD_TPDOC = t.COD_TPDOC
          LEFT JOIN MAE_VINC  v  ON CAST(v.COD_VINC AS VARCHAR) = n.TIP_VINC
          LEFT JOIN MAE_PAIS  pn ON pn.COD_PAIS = n.COD_NACIO
          LEFT JOIN MAE_CIIU  ci ON ci.COD_CIIU  = n.COD_CIIU
          LEFT JOIN MAE_PAIS  pp ON pp.COD_PAIS  = n.COD_PAIS_EXP
          LEFT JOIN MAE_DEPT  dp ON dp.COD_DEPT  = n.COD_DEPT_EXP
          LEFT JOIN MAE_MUNI  mn ON mn.COD_MUNI  = n.COD_MPIO_EXP
        WHERE t.COD_EMPR = @COD_EMPR AND t.COD_TERC = @COD_TERC
          AND t.TIP_TERC = 'N'`),

      q(`SELECT
          ACT_TOTAL  AS [Activos totales ($)],
          ING_MENS   AS [Ingresos mensuales ($)],
          PAS_TOTAL  AS [Pasivos totales ($)],
          EGR_MENS   AS [Egresos mensuales ($)],
          PATRIMONIO AS [Patrimonio ($)],
          OTR_ING    AS [Otros ingresos ($)]
        FROM GN_NATUR_FIN
        WHERE COD_EMPR = @COD_EMPR AND COD_TERC = @COD_TERC`),

      q(`SELECT
          mb.NOM_BANCO                            AS [Entidad bancaria],
          ISNULL(tc.NOM_TPCTA, '')               AS [Tipo de cuenta],
          b.NUM_CUEN                              AS [Número de cuenta],
          CASE b.CUEN_EXTR WHEN 'S' THEN 'Sí' ELSE 'No' END
                                                  AS [Cuenta extranjera],
          ISNULL(b.NOM_ENT_EXT,'')               AS [Nombre entidad extranjera],
          ISNULL(b.TIP_CUE_EXT,'')               AS [Tipo cuenta extranjera]
        FROM GN_TERCE_BANCO b
          LEFT JOIN MAE_BANCO mb ON mb.COD_BANCO = b.COD_BANCO
          LEFT JOIN MAE_TPCTA tc ON tc.COD_TPCTA = b.TIP_CUEN
        WHERE b.COD_EMPR = @COD_EMPR AND b.COD_TERC = @COD_TERC`),

      q(`SELECT
          CASE p.MAN_RPUB WHEN 'S' THEN 'Sí' ELSE 'No' END AS [¿Maneja recursos públicos?],
          CASE p.CAR_PUBL WHEN 'S' THEN 'Sí' ELSE 'No' END AS [¿Ejerció cargo público?],
          CASE a.ACT_VA_FIAT  WHEN 'S' THEN 'Sí' ELSE 'No' END
                                                            AS [Compra/venta activos virtuales (fiat)],
          CASE a.ACT_VA_VA    WHEN 'S' THEN 'Sí' ELSE 'No' END
                                                            AS [Compra/venta activos virtuales (VA x VA)],
          CASE a.ACT_TRANS    WHEN 'S' THEN 'Sí' ELSE 'No' END
                                                            AS [Transferencia y canje activos virtuales],
          CASE a.ACT_CUSTO    WHEN 'S' THEN 'Sí' ELSE 'No' END
                                                            AS [Custodia de activos virtuales],
          CASE a.ACT_SERV_FIN WHEN 'S' THEN 'Sí' ELSE 'No' END
                                                            AS [Servicios financieros para PSAV],
          CASE a.ACT_SERV_VAP WHEN 'S' THEN 'Sí' ELSE 'No' END
                                                            AS [Servicios VAP],
          CASE a.CERT_INFO    WHEN 'S' THEN 'Sí' ELSE 'No' END
                                                            AS [Certifica veracidad de la información]
        FROM GN_NATUR_PEP p
          LEFT JOIN GN_NATUR_ACT a ON a.COD_EMPR = p.COD_EMPR AND a.COD_TERC = p.COD_TERC
        WHERE p.COD_EMPR = @COD_EMPR AND p.COD_TERC = @COD_TERC`),

      q(`SELECT
          d.TIP_DOC                             AS [Tipo de documento],
          ISNULL(d.NOM_DOC,'')                  AS [Nombre del documento],
          ISNULL(d.NOM_ARCH,'')                 AS [Nombre del archivo],
          CONVERT(varchar, d.FEC_CARG, 103)     AS [Fecha de carga],
          '/api/documentos/' + t.NUM_IDEN + '/' + d.TIP_DOC
                                                AS [URL de descarga]
        FROM GN_TERCE_DOC d
          JOIN GN_TERCE t ON t.COD_EMPR = d.COD_EMPR AND t.COD_TERC = d.COD_TERC
        WHERE d.COD_EMPR = @COD_EMPR AND d.COD_TERC = @COD_TERC`),
    ]);

    // ── Construir libro Excel ─────────────────────────────────────────────────
    const wb    = new ExcelJS.Workbook();
    wb.creator  = 'SARLAFT Sistema';
    wb.created  = new Date();

    const PRIMARY   = '0C6B8C';
    const HEADER_BG = 'E5F5FA';
    const ACCENT    = '20A7C9';
    const CURRENCY_FMT = '#,##0.00';

    /**
     * Agrega una hoja con etiqueta-valor en dos columnas (para filas únicas)
     * o en modo tabla (para arrays).
     */
    function addSheetLabelValue(name, rows, currencyColumns = []) {
      const ws = wb.addWorksheet(name);
      if (!rows || rows.length === 0) {
        ws.getColumn(1).width = 40;
        ws.mergeCells('A1:B1');
        const tc = ws.getCell('A1');
        tc.value = name;
        tc.font  = { bold: true, size: 13, color: { argb: 'FF' + PRIMARY } };
        tc.alignment = { horizontal: 'center' };
        tc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + HEADER_BG } };
        const nr = ws.addRow(['No se registraron datos para esta sección.']);
        nr.getCell(1).font = { italic: true, color: { argb: 'FF888888' } };
        return;
      }

      const cols = Object.keys(rows[0]);

      if (rows.length === 1) {
        // ── Modo vertical (una fila → dos columnas: Campo / Valor) ────────────
        ws.getColumn(1).width = 38;
        ws.getColumn(2).width = 42;

        // Título
        ws.mergeCells('A1:B1');
        const titleCell   = ws.getCell('A1');
        titleCell.value   = name;
        titleCell.font    = { bold: true, size: 13, color: { argb: 'FF' + PRIMARY } };
        titleCell.alignment = { horizontal: 'center' };
        titleCell.fill    = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + HEADER_BG } };

        // Cabecera de columnas
        const hRow = ws.addRow(['Campo', 'Valor']);
        hRow.eachCell(cell => {
          cell.font  = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + ACCENT } };
          cell.alignment = { horizontal: 'center' };
        });

        // Datos
        cols.forEach((col, i) => {
          const val = rows[0][col];
          const row = ws.addRow([col, val ?? '']);
          if (i % 2 === 0) {
            row.eachCell(cell => {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF6FA' } };
            });
          }
          if (currencyColumns.includes(col) && typeof val === 'number') {
            row.getCell(2).numFmt = CURRENCY_FMT;
          }
        });

      } else {
        // ── Modo tabla horizontal (varias filas) ──────────────────────────────
        // Título
        ws.mergeCells(1, 1, 1, cols.length);
        const titleCell = ws.getCell(1, 1);
        titleCell.value = name;
        titleCell.font  = { bold: true, size: 13, color: { argb: 'FF' + PRIMARY } };
        titleCell.alignment = { horizontal: 'center' };

        // Cabecera
        const hRow = ws.addRow(cols);
        hRow.eachCell(cell => {
          cell.font  = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + ACCENT } };
          cell.border = { bottom: { style: 'thin', color: { argb: 'FF' + PRIMARY } } };
          cell.alignment = { horizontal: 'center' };
        });

        // Datos
        rows.forEach((row, ri) => {
          const dRow = ws.addRow(cols.map(c => row[c] ?? ''));
          if (ri % 2 === 0) {
            dRow.eachCell(cell => {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + HEADER_BG } };
            });
          }
          // Formato moneda
          currencyColumns.forEach(cc => {
            const ci = cols.indexOf(cc);
            if (ci >= 0 && typeof row[cc] === 'number') {
              dRow.getCell(ci + 1).numFmt = CURRENCY_FMT;
            }
          });
        });

        // Auto-ancho
        cols.forEach((col, colIdx) => {
          const maxLen = Math.max(col.length, ...rows.map(rw => String(rw[col] ?? '').length));
          ws.getColumn(colIdx + 1).width = Math.min(Math.max(maxLen + 2, 14), 45);
        });
      }
    }

    addSheetLabelValue('Datos Personales',      personales);
    addSheetLabelValue('Información Financiera', financiera,
      ['Activos totales ($)', 'Ingresos mensuales ($)', 'Pasivos totales ($)',
       'Egresos mensuales ($)', 'Patrimonio ($)', 'Otros ingresos ($)']);
    addSheetLabelValue('Cuentas Bancarias',      bancaria);
    addSheetLabelValue('PEP y Actividades',      pepAct);

    // ── Hoja de documentos con hipervínculo de descarga ──────────────────────
    if (documentos.length > 0) {
      const wsDoc = wb.addWorksheet('Documentos Adjuntos');
      const dCols = Object.keys(documentos[0]).filter(c => c !== 'URL de descarga');
      const allCols = [...dCols, 'Acceder al archivo'];

      // Título
      wsDoc.mergeCells(1, 1, 1, allCols.length);
      const tCell = wsDoc.getCell(1, 1);
      tCell.value = 'Documentos Adjuntos';
      tCell.font  = { bold: true, size: 13, color: { argb: 'FF' + PRIMARY } };
      tCell.alignment = { horizontal: 'center' };

      // Cabecera
      const hRow = wsDoc.addRow(allCols);
      hRow.eachCell(cell => {
        cell.font  = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + ACCENT } };
        cell.alignment = { horizontal: 'center' };
      });

      // Datos + hipervínculo
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      documentos.forEach((doc, ri) => {
        const values = dCols.map(c => doc[c] ?? '');
        values.push(doc['Nombre del archivo'] || '');
        const dRow = wsDoc.addRow(values);
        if (ri % 2 === 0) {
          dRow.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + HEADER_BG } };
          });
        }
        // Hipervínculo en la última columna
        const urlRel  = doc['URL de descarga'] || '';
        if (urlRel && doc['Nombre del archivo']) {
          const linkCell = dRow.getCell(allCols.length);
          linkCell.value = {
            text:      doc['Nombre del archivo'],
            hyperlink: baseUrl + urlRel,
          };
          linkCell.font = { color: { argb: 'FF0563C1' }, underline: true };
        }
      });

      // Auto-ancho
      allCols.forEach((col, colIdx) => {
        wsDoc.getColumn(colIdx + 1).width = Math.min(Math.max(col.length + 4, 16), 45);
      });
    } else {
      // Sin documentos: hoja informativa
      const wsDoc = wb.addWorksheet('Documentos Adjuntos');
      wsDoc.addRow(['Sin documentos adjuntos registrados.']);
    }

    // ── Enviar como descarga ──────────────────────────────────────────────────
    const nomComp = (personales[0]?.['Primer nombre'] || '' + ' ' + (personales[0]?.['Primer apellido'] || '') || `TERC_${codTerc}`)
      .replace(/[^a-zA-Z0-9_\-\s]/g, '').trim().replace(/\s+/g, '_');
    const filename = `SARLAFT_Natural_${nomComp}_${new Date().toISOString().slice(0,10)}.xlsx`;

    res.setHeader('Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await wb.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error('GET /api/exportar-excel-natural:', err);
    if (!res.headersSent) res.status(500).json({ error: err.message || 'Error generando Excel' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  DOCUMENTOS ADJUNTOS — Upload y descarga
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/documentos/:numIden
 *
 * Recibe archivos adjuntos vía multipart/form-data y los guarda en disco
 * (uploads/:numIden/).  Cada campo del FormData es el código TIP_DOC del
 * documento (ej. 'RUT', 'CERT_BANC', 'DOC_ID').
 *
 * Inserta o actualiza filas en GN_TERCE_DOC.
 */
app.post('/api/documentos/:numIden',
  upload.any(),   // acepta cualquier cantidad de campos de archivo
  async (req, res) => {
    const numIden = req.params.numIden;

    if (!numIden) return res.status(400).json({ error: 'numIden requerido' });
    if (!req.files || req.files.length === 0)
      return res.status(400).json({ error: 'No se recibieron archivos' });

    try {
      const pool = await sql.connect(dbConfig);

      // Buscar el COD_TERC correspondiente al NUM_IDEN
      const tercResult = await pool.request()
        .input('COD_EMPR', sql.SmallInt,    COD_EMPR)
        .input('NUM_IDEN', sql.VarChar(20), numIden)
        .query(`SELECT TOP 1 COD_TERC FROM GN_TERCE
                WHERE COD_EMPR = @COD_EMPR AND NUM_IDEN = @NUM_IDEN`);

      if (!tercResult.recordset.length)
        return res.status(404).json({ error: `No se encontró el tercero ${numIden}` });

      const COD_TERC = tercResult.recordset[0].COD_TERC;

      // Insertar o actualizar cada archivo en GN_TERCE_DOC
      const guardados = [];
      for (const file of req.files) {
        const tipDoc  = file.fieldname;                       // clave del campo
        const nomArch = file.originalname;
        const rutDoc  = file.path;                            // ruta absoluta en servidor
        const extArch = path.extname(nomArch).replace('.','').toLowerCase();

        // Verificar si ya existe un registro para este TIP_DOC + COD_TERC
        const exists = await pool.request()
          .input('COD_EMPR', sql.SmallInt,    COD_EMPR)
          .input('COD_TERC', sql.BigInt,      COD_TERC)
          .input('TIP_DOC',  sql.VarChar(20), tipDoc)
          .query(`SELECT COD_DOC FROM GN_TERCE_DOC
                  WHERE COD_EMPR=@COD_EMPR AND COD_TERC=@COD_TERC AND TIP_DOC=@TIP_DOC`);

        if (exists.recordset.length > 0) {
          // Actualizar
          await pool.request()
            .input('COD_EMPR', sql.SmallInt,    COD_EMPR)
            .input('COD_TERC', sql.BigInt,      COD_TERC)
            .input('TIP_DOC',  sql.VarChar(20), tipDoc)
            .input('NOM_ARCH', sql.VarChar(260),nomArch)
            .input('RUT_DOC',  sql.VarChar(500),rutDoc)
            .input('EXT_ARCH', sql.VarChar(10), extArch)
            .input('FEC_CARG', sql.Date,        new Date())
            .query(`UPDATE GN_TERCE_DOC
                    SET NOM_ARCH=@NOM_ARCH, RUT_DOC=@RUT_DOC,
                        EXT_ARCH=@EXT_ARCH, FEC_CARG=@FEC_CARG
                    WHERE COD_EMPR=@COD_EMPR AND COD_TERC=@COD_TERC AND TIP_DOC=@TIP_DOC`);
        } else {
          // Insertar nuevo
          await pool.request()
            .input('COD_EMPR', sql.SmallInt,    COD_EMPR)
            .input('COD_TERC', sql.BigInt,      COD_TERC)
            .input('TIP_DOC',  sql.VarChar(20), tipDoc)
            .input('NOM_DOC',  sql.VarChar(120),tipDoc)   // el nombre legible se puede mejorar
            .input('NOM_ARCH', sql.VarChar(260),nomArch)
            .input('RUT_DOC',  sql.VarChar(500),rutDoc)
            .input('EXT_ARCH', sql.VarChar(10), extArch)
            .input('FEC_CARG', sql.Date,        new Date())
            .query(`INSERT INTO GN_TERCE_DOC
                      (COD_EMPR, COD_TERC, TIP_DOC, NOM_DOC, NOM_ARCH, RUT_DOC, EXT_ARCH, FEC_CARG)
                    VALUES
                      (@COD_EMPR, @COD_TERC, @TIP_DOC, @NOM_DOC, @NOM_ARCH, @RUT_DOC, @EXT_ARCH, @FEC_CARG)`);
        }

        guardados.push({ tipDoc, nomArch });
        console.log(`📎 Documento guardado: ${tipDoc} → ${nomArch} (COD_TERC=${COD_TERC})`);
      }

      res.json({ success: true, guardados, COD_TERC });

    } catch (err) {
      console.error('POST /api/documentos:', err);
      res.status(500).json({ error: err.message || 'Error al guardar documentos' });
    }
  }
);

/**
 * GET /api/documentos/:numIden/:tipDoc
 *
 * Sirve el archivo adjunto para el tipo de documento indicado.
 * El campo tipDoc identifica el documento dentro de la carpeta del tercero
 * (ej. 'RUT', 'CERT_BANC', 'DOC_ID').
 */
app.get('/api/documentos/:numIden/:tipDoc', async (req, res) => {
  const { numIden, tipDoc } = req.params;

  try {
    const pool = await sql.connect(dbConfig);

    const result = await pool.request()
      .input('COD_EMPR', sql.SmallInt,    COD_EMPR)
      .input('NUM_IDEN', sql.VarChar(20), numIden)
      .input('TIP_DOC',  sql.VarChar(20), tipDoc)
      .query(`SELECT d.RUT_DOC, d.NOM_ARCH, d.EXT_ARCH
              FROM GN_TERCE_DOC d
                JOIN GN_TERCE t ON t.COD_EMPR = d.COD_EMPR AND t.COD_TERC = d.COD_TERC
              WHERE t.COD_EMPR = @COD_EMPR
                AND t.NUM_IDEN = @NUM_IDEN
                AND d.TIP_DOC  = @TIP_DOC`);

    if (!result.recordset.length)
      return res.status(404).json({ error: 'Documento no encontrado' });

    const { RUT_DOC, NOM_ARCH } = result.recordset[0];

    if (!fs.existsSync(RUT_DOC))
      return res.status(404).json({ error: 'Archivo no encontrado en el servidor' });

    res.setHeader('Content-Disposition', `inline; filename="${NOM_ARCH}"`);
    res.sendFile(RUT_DOC);

  } catch (err) {
    console.error('GET /api/documentos:', err);
    res.status(500).json({ error: err.message });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
//  CONSOLIDADOS — Descarga de todos los registros acumulados
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/exportar-consolidado-natural
 * Genera un Excel con TODOS los registros de Persona Natural (TIP_TERC='N').
 * Hoja "Datos personales" con una fila por persona.
 */
app.get('/api/exportar-consolidado-natural', async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig);
    const rq = pool.request();
    rq.input('COD_EMPR',  sql.SmallInt, COD_EMPR);
    rq.input('TIP_TERC',  sql.Char(1),  TIP_TERC_NATUR);

    const [personales, financiera, bancaria] = await Promise.all([
      rq.query(`
        SELECT
          td.NOM_TPDOC                                  AS [Tipo de documento],
          t.NUM_IDEN                                    AS [Número de identificación],
          LTRIM(RTRIM(ISNULL(t.NOM_TERC,'')))           AS [Primer nombre],
          LTRIM(RTRIM(ISNULL(t.SEG_NOMB,'')))           AS [Segundo nombre],
          LTRIM(RTRIM(ISNULL(t.APE_TERC,'')))           AS [Primer apellido],
          LTRIM(RTRIM(ISNULL(t.SEG_APEL,'')))           AS [Segundo apellido],
          LTRIM(RTRIM(ISNULL(t.DIR_TERC,'')))           AS [Dirección],
          LTRIM(RTRIM(ISNULL(t.TEL_TERC,'')))           AS [Teléfono celular],
          t.DIR_MAIL                                    AS [Email corporativo],
          ISNULL(v.NOM_VINC, n.TIP_VINC)               AS [Tipo de vinculación],
          n.MAIL_SARL                                   AS [Email SARLAFT],
          ISNULL(pn.NOM_PAIS,'')                        AS [Nacionalidad],
          ISNULL(n.COD_CIIU,'') + CASE WHEN ci.NOM_CIIU IS NOT NULL THEN ' — ' + ci.NOM_CIIU ELSE '' END
                                                        AS [Actividad CIIU],
          CONVERT(varchar,n.FEC_EXPE,103)               AS [Fecha expedición],
          ISNULL(pp.NOM_PAIS,'')                        AS [País de expedición],
          ISNULL(dp.NOM_DEPT,'')                        AS [Departamento de expedición],
          ISNULL(mn.NOM_MUNI,'')                        AS [Ciudad de expedición]
        FROM GN_TERCE t
          JOIN GN_NATUR n  ON n.COD_EMPR = t.COD_EMPR AND n.COD_TERC = t.COD_TERC
          LEFT JOIN MAE_TPDOC td ON td.COD_TPDOC = t.COD_TPDOC
          LEFT JOIN MAE_VINC  v  ON CAST(v.COD_VINC AS VARCHAR) = n.TIP_VINC
          LEFT JOIN MAE_PAIS  pn ON pn.COD_PAIS = n.COD_NACIO
          LEFT JOIN MAE_CIIU  ci ON ci.COD_CIIU  = n.COD_CIIU
          LEFT JOIN MAE_PAIS  pp ON pp.COD_PAIS  = n.COD_PAIS_EXP
          LEFT JOIN MAE_DEPT  dp ON dp.COD_DEPT  = n.COD_DEPT_EXP
          LEFT JOIN MAE_MUNI  mn ON mn.COD_MUNI  = n.COD_MPIO_EXP
        WHERE t.COD_EMPR = @COD_EMPR AND t.TIP_TERC = @TIP_TERC
        ORDER BY t.COD_TERC`),

      pool.request()
        .input('COD_EMPR', sql.SmallInt, COD_EMPR)
        .input('TIP_TERC', sql.Char(1),  TIP_TERC_NATUR)
        .query(`
          SELECT t.NUM_IDEN AS [Número de identificación],
            f.ACT_TOTAL AS [Activos totales ($)], f.ING_MENS AS [Ingresos mensuales ($)],
            f.PAS_TOTAL AS [Pasivos totales ($)], f.EGR_MENS AS [Egresos mensuales ($)],
            f.PATRIMONIO AS [Patrimonio ($)], f.OTR_ING AS [Otros ingresos ($)]
          FROM GN_NATUR_FIN f
            JOIN GN_TERCE t ON t.COD_EMPR = f.COD_EMPR AND t.COD_TERC = f.COD_TERC
          WHERE f.COD_EMPR = @COD_EMPR AND t.TIP_TERC = @TIP_TERC
          ORDER BY f.COD_TERC`),

      pool.request()
        .input('COD_EMPR', sql.SmallInt, COD_EMPR)
        .input('TIP_TERC', sql.Char(1),  TIP_TERC_NATUR)
        .query(`
          SELECT t.NUM_IDEN AS [Número de identificación],
            mb.NOM_BANCO AS [Entidad bancaria],
            ISNULL(tc.NOM_TPCTA,'') AS [Tipo de cuenta],
            b.NUM_CUEN AS [Número de cuenta],
            CASE b.CUEN_EXTR WHEN 'S' THEN 'Sí' ELSE 'No' END AS [Cuenta extranjera]
          FROM GN_TERCE_BANCO b
            JOIN GN_TERCE t ON t.COD_EMPR = b.COD_EMPR AND t.COD_TERC = b.COD_TERC
            LEFT JOIN MAE_BANCO mb ON mb.COD_BANCO = b.COD_BANCO
            LEFT JOIN MAE_TPCTA tc ON tc.COD_TPCTA = b.TIP_CUEN
          WHERE b.COD_EMPR = @COD_EMPR AND t.TIP_TERC = @TIP_TERC
          ORDER BY b.COD_TERC`),
    ]);

    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    wb.creator = 'SARLAFT'; wb.created = new Date();

    const addSheet = (name, rows) => {
      if (!rows || !rows.length) return;
      const ws = wb.addWorksheet(name);
      ws.columns = Object.keys(rows[0]).map(k => ({ header: k, key: k, width: 22 }));
      ws.getRow(1).font = { bold: true };
      ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD4A017' } };
      rows.forEach(row => ws.addRow(row));
    };

    addSheet('Datos personales',    personales.recordset);
    addSheet('Información financiera', financiera.recordset);
    addSheet('Cuentas bancarias',   bancaria.recordset);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Consolidado_Natural_${Date.now()}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error('GET /api/exportar-consolidado-natural:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/exportar-consolidado-juridica
 * Genera un Excel con TODOS los registros de Persona Jurídica (TIP_TERC='E').
 */
app.get('/api/exportar-consolidado-juridica', async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig);

    const [empresas, financiera, bancaria] = await Promise.all([
      pool.request()
        .input('COD_EMPR', sql.SmallInt, COD_EMPR)
        .input('TIP_TERC', sql.Char(1),  TIP_TERC_JURID)
        .query(`
          SELECT
            td.NOM_TPDOC                                  AS [Tipo de documento],
            t.NUM_IDEN                                    AS [Número NIT],
            t.DIG_VERI                                    AS [Dígito verificación],
            LTRIM(RTRIM(ISNULL(t.NOM_COMP,'')))           AS [Razón social],
            LTRIM(RTRIM(ISNULL(t.DIR_TERC,'')))           AS [Dirección],
            LTRIM(RTRIM(ISNULL(t.TEL_TERC,'')))           AS [Teléfono],
            t.DIR_MAIL                                    AS [Email corporativo],
            ISNULL(v.NOM_VINC, j.TIP_VINC)               AS [Tipo de vinculación],
            j.MAIL_SARL                                   AS [Email SARLAFT],
            j.URL_WEB                                     AS [Sitio web],
            ISNULL(ts.NOM_SOCIE, j.TIP_SOCIE)            AS [Tipo de sociedad],
            ISNULL(po.NOM_PAIS, '')                       AS [País de origen],
            CASE j.GRUP_EMPR WHEN 'S' THEN 'Sí' ELSE 'No' END AS [Grupo empresarial]
          FROM GN_TERCE t
            JOIN GN_JURID j ON j.COD_EMPR = t.COD_EMPR AND j.COD_TERC = t.COD_TERC
            LEFT JOIN MAE_TPDOC td ON td.COD_TPDOC = t.COD_TPDOC
            LEFT JOIN MAE_VINC  v  ON CAST(v.COD_VINC AS VARCHAR) = j.TIP_VINC
            LEFT JOIN MAE_TIP_SOCIE ts ON CAST(ts.COD_SOCIE AS VARCHAR) = j.TIP_SOCIE
            LEFT JOIN MAE_PAIS  po ON po.COD_PAIS = j.COD_PAIS_ORI
          WHERE t.COD_EMPR = @COD_EMPR AND t.TIP_TERC = @TIP_TERC
          ORDER BY t.COD_TERC`),

      pool.request()
        .input('COD_EMPR', sql.SmallInt, COD_EMPR)
        .input('TIP_TERC', sql.Char(1),  TIP_TERC_JURID)
        .query(`
          SELECT t.NUM_IDEN AS [NIT],
            f.ACT_TOTAL AS [Activos totales ($)], f.ING_MENS AS [Ingresos mensuales ($)],
            f.PAS_TOTAL AS [Pasivos totales ($)], f.EGR_MENS AS [Egresos mensuales ($)],
            f.PATRIMONIO AS [Patrimonio ($)]
          FROM GN_JURID_FIN f
            JOIN GN_TERCE t ON t.COD_EMPR = f.COD_EMPR AND t.COD_TERC = f.COD_TERC
          WHERE f.COD_EMPR = @COD_EMPR AND t.TIP_TERC = @TIP_TERC
          ORDER BY f.COD_TERC`),

      pool.request()
        .input('COD_EMPR', sql.SmallInt, COD_EMPR)
        .input('TIP_TERC', sql.Char(1),  TIP_TERC_JURID)
        .query(`
          SELECT t.NUM_IDEN AS [NIT],
            mb.NOM_BANCO AS [Entidad bancaria],
            ISNULL(tc.NOM_TPCTA,'') AS [Tipo de cuenta],
            b.NUM_CUEN AS [Número de cuenta],
            CASE b.CUEN_EXTR WHEN 'S' THEN 'Sí' ELSE 'No' END AS [Cuenta extranjera]
          FROM GN_TERCE_BANCO b
            JOIN GN_TERCE t ON t.COD_EMPR = b.COD_EMPR AND t.COD_TERC = b.COD_TERC
            LEFT JOIN MAE_BANCO mb ON mb.COD_BANCO = b.COD_BANCO
            LEFT JOIN MAE_TPCTA tc ON tc.COD_TPCTA = b.TIP_CUEN
          WHERE b.COD_EMPR = @COD_EMPR AND t.TIP_TERC = @TIP_TERC
          ORDER BY b.COD_TERC`),
    ]);

    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    wb.creator = 'SARLAFT'; wb.created = new Date();

    const addSheet = (name, rows) => {
      if (!rows || !rows.length) return;
      const ws = wb.addWorksheet(name);
      ws.columns = Object.keys(rows[0]).map(k => ({ header: k, key: k, width: 22 }));
      ws.getRow(1).font = { bold: true };
      ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD4A017' } };
      rows.forEach(row => ws.addRow(row));
    };

    addSheet('Empresas',               empresas.recordset);
    addSheet('Información financiera', financiera.recordset);
    addSheet('Cuentas bancarias',      bancaria.recordset);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Consolidado_Juridica_${Date.now()}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error('GET /api/exportar-consolidado-juridica:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ── Puerto ──────────────────────────────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`\n  🚀  Servidor SARLAFT corriendo en http://localhost:${PORT}\n`);
});

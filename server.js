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

const express = require('express');
const sql     = require('mssql');
const cors    = require('cors');
const path    = require('path');
const multer  = require('multer');
const fs      = require('fs');

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
//  ESCRITURA — Guardar completo (todas las secciones en una transacción)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/guardar-completo
 * Persiste el formulario completo de persona jurídica en una sola transacción SQL.
 *
 * Tablas que se insertan (en orden de dependencia):
 *   1.  GN_TERCE          — Tercero base
 *   2.  GN_JURID          — Datos jurídicos (sección 1 + 3)
 *   3.  GN_JURID_RL       — Representantes legales (sección 2)
 *   4.  GN_JURID_CUMP     — Sistema de cumplimiento (sección 5)
 *   5.  GN_JURID_PAIS     — Países de operación (sección 4)
 *   6.  GN_JURID_JD       — Junta directiva (sección 6)
 *   7.  GN_JURID_RF       — Revisores fiscales (sección 7)
 *   8.  GN_JURID_AC       — Composición accionaria (sección 8)
 *   9.  GN_JURID_FIN      — Información financiera (sección 9)
 *   10. GN_TERCE_BANCO    — Información bancaria (sección 10)
 *   11. GN_JURID_PEP      — Exposición política (sección 11a)
 *   12. GN_JURID_ACT      — Actividades activos virtuales (sección 11b)
 */
app.post('/api/guardar-completo', async (req, res) => {
  const d = req.body;

  // Validación mínima server-side
  if (!d.NUM_IDEN || !d.NOM_COMP || !d.COD_PAIS_EXP || !d.DIR_TERC || !d.TEL_TERC || !d.DIR_MAIL) {
    return res.status(400).json({ error: 'Faltan campos obligatorios del tercero (sección 1).' });
  }

  let transaction;
  try {
    const p = await getPool();
    transaction = new sql.Transaction(p);
    await transaction.begin();

    // ── 1. GN_TERCE ────────────────────────────────────────────────────────────
    {
      const r = new sql.Request(transaction);
      r.input('TIP_TERC',    sql.Char(1),       'J');
      r.input('COD_TPDOC',   sql.Int,            d.COD_TPDOC   || 8);
      r.input('NUM_IDEN',    sql.VarChar(20),    d.NUM_IDEN);
      r.input('DIG_VERI',    sql.Char(1),        d.DIG_VERI    || null);
      r.input('NOM_COMP',    sql.VarChar(255),   d.NOM_COMP);
      r.input('COD_PAIS_EXP',sql.VarChar(10),    d.COD_PAIS_EXP);
      r.input('DIR_TERC',    sql.VarChar(255),   d.DIR_TERC);
      r.input('TEL_TERC',    sql.VarChar(30),    d.TEL_TERC);
      r.input('TEL_TERC2',   sql.VarChar(30),    d.TEL_TERC2   || null);
      r.input('DIR_MAIL',    sql.VarChar(100),   d.DIR_MAIL);
      await r.query(`
        INSERT INTO GN_TERCE
          (TIP_TERC,COD_TPDOC,NUM_IDEN,DIG_VERI,NOM_COMP,COD_PAIS_EXP,DIR_TERC,TEL_TERC,TEL_TERC2,DIR_MAIL)
        VALUES
          (@TIP_TERC,@COD_TPDOC,@NUM_IDEN,@DIG_VERI,@NOM_COMP,@COD_PAIS_EXP,@DIR_TERC,@TEL_TERC,@TEL_TERC2,@DIR_MAIL)`);
    }

    // ── 2. GN_JURID ────────────────────────────────────────────────────────────
    {
      const r = new sql.Request(transaction);
      r.input('NUM_IDEN',     sql.VarChar(20),   d.NUM_IDEN);
      r.input('COD_VINC',     sql.VarChar(10),   d.COD_VINC     || null);
      r.input('COD_DEPT_EXP', sql.VarChar(10),   d.COD_DEPT_EXP || null);
      r.input('COD_MPIO_EXP', sql.VarChar(10),   d.COD_MPIO_EXP || null);
      r.input('MAIL_SARL',    sql.VarChar(100),  d.MAIL_SARL    || null);
      r.input('COD_CIIU',     sql.VarChar(10),   d.COD_CIIU     || null);
      r.input('URL_WEB',      sql.VarChar(255),  d.URL_WEB      || null);
      r.input('UBIC_SOC',     sql.Char(1),        d.UBIC_SOC     || null);
      r.input('COD_PAIS_SOC', sql.VarChar(10),   d.COD_PAIS_SOC || null);
      r.input('TIP_EMPR',     sql.VarChar(10),   d.TIP_EMPR     || null);
      r.input('GRUP_EMPR',    sql.Char(1),        d.GRUP_EMPR    || null);
      r.input('TIP_SOCIE',    sql.VarChar(10),   d.TIP_SOCIE    || null);
      await r.query(`
        INSERT INTO GN_JURID
          (NUM_IDEN,COD_VINC,COD_DEPT_EXP,COD_MPIO_EXP,MAIL_SARL,COD_CIIU,URL_WEB,
           UBIC_SOC,COD_PAIS_SOC,TIP_EMPR,GRUP_EMPR,TIP_SOCIE)
        VALUES
          (@NUM_IDEN,@COD_VINC,@COD_DEPT_EXP,@COD_MPIO_EXP,@MAIL_SARL,@COD_CIIU,@URL_WEB,
           @UBIC_SOC,@COD_PAIS_SOC,@TIP_EMPR,@GRUP_EMPR,@TIP_SOCIE)`);
    }

    // ── 3. GN_JURID_RL — Representantes legales ────────────────────────────────
    for (const rl of (d.representantes || [])) {
      if (rl.TIP_REPR === 'S' && (!rl.NOM_REPR || !String(rl.NOM_REPR).trim())) continue;
      const dept = (!rl.COD_DEPT || rl.COD_DEPT === 'NA') ? null : rl.COD_DEPT;
      const r = new sql.Request(transaction);
      r.input('NUM_IDEN',  sql.VarChar(20),   d.NUM_IDEN);
      r.input('TIP_REPR',  sql.Char(1),        rl.TIP_REPR);
      r.input('NOM_REPR',  sql.VarChar(100),   rl.NOM_REPR  || null);
      r.input('APE_REPR',  sql.VarChar(100),   rl.APE_REPR  || null);
      r.input('TIP_DOCU',  sql.Int,             rl.TIP_DOCU  ? Number(rl.TIP_DOCU) : null);
      r.input('NUM_DOCU',  sql.VarChar(20),    rl.NUM_DOCU  || null);
      r.input('FEC_EXPE',  sql.Date,            rl.FEC_EXPE  ? new Date(rl.FEC_EXPE) : null);
      r.input('COD_PAIS',  sql.VarChar(10),    rl.COD_PAIS  || null);
      r.input('COD_DEPT',  sql.VarChar(10),    dept);
      r.input('COD_MPIO',  sql.VarChar(10),    rl.COD_MPIO  || null);
      r.input('DIR_REPR',  sql.VarChar(255),   rl.DIR_REPR  || null);
      r.input('CEL_REPR',  sql.VarChar(30),    rl.CEL_REPR  || null);
      r.input('TEL_REPR',  sql.VarChar(30),    rl.TEL_REPR  || null);
      r.input('MAIL_REPR', sql.VarChar(100),   rl.MAIL_REPR || null);
      await r.query(`
        INSERT INTO GN_JURID_RL
          (NUM_IDEN,TIP_REPR,NOM_REPR,APE_REPR,TIP_DOCU,NUM_DOCU,
           FEC_EXPE,COD_PAIS,COD_DEPT,COD_MPIO,DIR_REPR,CEL_REPR,TEL_REPR,MAIL_REPR)
        VALUES
          (@NUM_IDEN,@TIP_REPR,@NOM_REPR,@APE_REPR,@TIP_DOCU,@NUM_DOCU,
           @FEC_EXPE,@COD_PAIS,@COD_DEPT,@COD_MPIO,@DIR_REPR,@CEL_REPR,@TEL_REPR,@MAIL_REPR)`);
    }

    // ── 4. GN_JURID_CUMP — Cumplimiento (cabecera + oficiales) ────────────────
    {
      const r = new sql.Request(transaction);
      r.input('NUM_IDEN',  sql.VarChar(20),      d.NUM_IDEN);
      r.input('DESC_NORM', sql.VarChar(sql.MAX),  d.DESC_NORM  || null);
      r.input('NORM_LAFT', sql.VarChar(255),      d.NORM_LAFT  || null);
      r.input('TIE_JUNTA', sql.Char(1),           d.cump_TIE_JUNTA || 'N');
      r.input('SIS_PREVE', sql.VarChar(10),       d.cump_TIE_JUNTA === 'S' ? (d.SIS_PREVE || null) : null);
      r.input('REL_GRUPO', sql.VarChar(100),      d.REL_GRUPO  || null);
      await r.query(`
        INSERT INTO GN_JURID_CUMP (NUM_IDEN,DESC_NORM,NORM_LAFT,TIE_JUNTA,SIS_PREVE,REL_GRUPO)
        VALUES (@NUM_IDEN,@DESC_NORM,@NORM_LAFT,@TIE_JUNTA,@SIS_PREVE,@REL_GRUPO)`);
    }
    if (d.cump_TIE_JUNTA === 'S') {
      for (const of_ of (d.oficiales || [])) {
        if (of_.TIP_REPR === 'S' && (!of_.NOM_RESP || !String(of_.NOM_RESP).trim())) continue;
        const dept = (!of_.COD_DEPT || of_.COD_DEPT === 'NA') ? null : of_.COD_DEPT;
        const r = new sql.Request(transaction);
        r.input('NUM_IDEN',  sql.VarChar(20),   d.NUM_IDEN);
        r.input('TIP_REPR',  sql.Char(1),        of_.TIP_REPR);
        r.input('TIP_DOCU',  sql.Int,             of_.TIP_DOCU  ? Number(of_.TIP_DOCU)  : null);
        r.input('NUM_DOCU',  sql.VarChar(20),    of_.NUM_DOCU  || null);
        r.input('FEC_EXPE',  sql.Date,            of_.FEC_EXPE  ? new Date(of_.FEC_EXPE) : null);
        r.input('NOM_RESP',  sql.VarChar(100),   of_.NOM_RESP  || null);
        r.input('APE_RESP',  sql.VarChar(100),   of_.APE_RESP  || null);
        r.input('RAZ_RESP',  sql.VarChar(255),   of_.RAZ_RESP  || null);
        r.input('COD_PAIS',  sql.VarChar(10),    of_.COD_PAIS  || null);
        r.input('COD_DEPT',  sql.VarChar(10),    dept);
        r.input('COD_MPIO',  sql.VarChar(10),    of_.COD_MPIO  || null);
        r.input('DIR_RESP',  sql.VarChar(255),   of_.DIR_RESP  || null);
        r.input('TEL_RESP',  sql.VarChar(30),    of_.TEL_RESP  || null);
        r.input('MAIL_RESP', sql.VarChar(100),   of_.MAIL_RESP || null);
        await r.query(`
          INSERT INTO GN_JURID_CUMP
            (NUM_IDEN,TIP_REPR,TIP_DOCU,NUM_DOCU,FEC_EXPE,
             NOM_RESP,APE_RESP,RAZ_RESP,COD_PAIS,COD_DEPT,COD_MPIO,DIR_RESP,TEL_RESP,MAIL_RESP)
          VALUES
            (@NUM_IDEN,@TIP_REPR,@TIP_DOCU,@NUM_DOCU,@FEC_EXPE,
             @NOM_RESP,@APE_RESP,@RAZ_RESP,@COD_PAIS,@COD_DEPT,@COD_MPIO,@DIR_RESP,@TEL_RESP,@MAIL_RESP)`);
      }
    }

    // ── 5. GN_JURID_PAIS — Países de operación ─────────────────────────────────
    for (const { COD_PAIS } of (d.paises || [])) {
      if (!COD_PAIS) continue;
      const r = new sql.Request(transaction);
      r.input('NUM_IDEN', sql.VarChar(20), d.NUM_IDEN);
      r.input('COD_PAIS', sql.VarChar(10), COD_PAIS);
      await r.query(`INSERT INTO GN_JURID_PAIS (NUM_IDEN,COD_PAIS) VALUES (@NUM_IDEN,@COD_PAIS)`);
    }

    // ── 6. GN_JURID_JD — Junta directiva ───────────────────────────────────────
    if (d.jd_TIE_JUNTA === 'S') {
      const insertJD = async (txn, data, TIP_REPR) => {
        const dept = (!data.COD_DEPT || data.COD_DEPT === 'NA') ? null : data.COD_DEPT;
        const r = new sql.Request(txn);
        r.input('NUM_IDEN',  sql.VarChar(20),  d.NUM_IDEN);
        r.input('TIP_REPR',  sql.Char(1),       TIP_REPR);
        r.input('TIP_MIEM',  sql.VarChar(100),  data.TIP_MIEM  || null);
        r.input('NOM_MIEM',  sql.VarChar(100),  data.NOM_MIEM  || null);
        r.input('APE_MIEM',  sql.VarChar(100),  data.APE_MIEM  || null);
        r.input('RAZ_MIEM',  sql.VarChar(255),  data.RAZ_MIEM  || null);
        r.input('TIP_DOCU',  sql.Int,            data.TIP_DOCU  ? Number(data.TIP_DOCU) : null);
        r.input('NUM_DOCU',  sql.VarChar(20),   data.NUM_DOCU  || null);
        r.input('FEC_EXPE',  sql.Date,           data.FEC_EXPE  ? new Date(data.FEC_EXPE) : null);
        r.input('COD_PAIS',  sql.VarChar(10),   data.COD_PAIS  || null);
        r.input('COD_DEPT',  sql.VarChar(10),   dept);
        r.input('COD_MPIO',  sql.VarChar(10),   data.COD_MPIO  || null);
        r.input('DIR_MIEM',  sql.VarChar(255),  data.DIR_MIEM  || null);
        r.input('TEL_MIEM',  sql.VarChar(30),   data.TEL_MIEM  || null);
        r.input('MAIL_MIEM', sql.VarChar(100),  data.MAIL_MIEM || null);
        await r.query(`
          INSERT INTO GN_JURID_JD
            (NUM_IDEN,TIP_REPR,TIP_MIEM,NOM_MIEM,APE_MIEM,RAZ_MIEM,TIP_DOCU,NUM_DOCU,
             FEC_EXPE,COD_PAIS,COD_DEPT,COD_MPIO,DIR_MIEM,TEL_MIEM,MAIL_MIEM)
          VALUES
            (@NUM_IDEN,@TIP_REPR,@TIP_MIEM,@NOM_MIEM,@APE_MIEM,@RAZ_MIEM,@TIP_DOCU,@NUM_DOCU,
             @FEC_EXPE,@COD_PAIS,@COD_DEPT,@COD_MPIO,@DIR_MIEM,@TEL_MIEM,@MAIL_MIEM)`);
      };
      for (const m of (d.juntaDirectiva || [])) {
        await insertJD(transaction, m.Principal, 'P');
        if (m.Suplente && m.Suplente.NOM_MIEM && String(m.Suplente.NOM_MIEM).trim()) {
          await insertJD(transaction, m.Suplente, 'S');
        }
      }
    } else {
      const r0 = new sql.Request(transaction);
      r0.input('NUM_IDEN',  sql.VarChar(20), d.NUM_IDEN);
      r0.input('TIE_JUNTA', sql.Char(1),      'N');
      await r0.query(`INSERT INTO GN_JURID_JD (NUM_IDEN,TIE_JUNTA) VALUES (@NUM_IDEN,@TIE_JUNTA)`);
    }

    // ── 7. GN_JURID_RF — Revisores fiscales ────────────────────────────────────
    if (d.rf_TIE_REVIS === 'S') {
      const insertRF = async (txn, data, TIP_REPR) => {
        const dept = (!data.COD_DEPT || data.COD_DEPT === 'NA') ? null : data.COD_DEPT;
        const r = new sql.Request(txn);
        r.input('NUM_IDEN',     sql.VarChar(20),      d.NUM_IDEN);
        r.input('TIP_REPR',     sql.Char(1),           TIP_REPR);
        r.input('TIE_REVIS',    sql.Char(1),           'S');
        r.input('NOM_REVI',     sql.VarChar(100),      data.NOM_REVI     || null);
        r.input('APE_REVI',     sql.VarChar(100),      data.APE_REVI     || null);
        r.input('RAZ_REVI',     sql.VarChar(255),      data.RAZ_REVI     || null);
        r.input('TIP_DOCU',     sql.Int,                data.TIP_DOCU     ? Number(data.TIP_DOCU) : null);
        r.input('NUM_DOCU',     sql.VarChar(20),       data.NUM_DOCU     || null);
        r.input('FEC_EXPE',     sql.Date,               data.FEC_EXPE     ? new Date(data.FEC_EXPE) : null);
        r.input('COD_PAIS',     sql.VarChar(10),       data.COD_PAIS     || null);
        r.input('COD_DEPT',     sql.VarChar(10),       dept);
        r.input('COD_MPIO',     sql.VarChar(10),       data.COD_MPIO     || null);
        r.input('DIR_REVI',     sql.VarChar(255),      data.DIR_REVI     || null);
        r.input('CEL_REVI',     sql.VarChar(30),       data.CEL_REVI     || null);
        r.input('TEL_REVI',     sql.VarChar(30),       data.TEL_REVI     || null);
        r.input('MAIL_REVI',    sql.VarChar(100),      data.MAIL_REVI    || null);
        r.input('REVI_FIRMA',   sql.Char(1),            data.REVI_FIRMA   || 'N');
        r.input('RAZ_FIRMA',    sql.VarChar(255),      data.RAZ_FIRMA    || null);
        r.input('TIP_DOCU_FIR', sql.Int,                data.TIP_DOCU_FIR ? Number(data.TIP_DOCU_FIR) : null);
        r.input('NUM_DOCU_FIR', sql.VarChar(20),       data.NUM_DOCU_FIR || null);
        r.input('OBS_REVI',     sql.VarChar(sql.MAX),  data.OBS_REVI     || null);
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
      for (const rv of (d.revisores || [])) {
        await insertRF(transaction, rv.Principal, 'P');
        if (rv.Suplente && rv.Suplente.NOM_REVI && String(rv.Suplente.NOM_REVI).trim()) {
          await insertRF(transaction, rv.Suplente, 'S');
        }
      }
    } else {
      const r0 = new sql.Request(transaction);
      r0.input('NUM_IDEN',  sql.VarChar(20), d.NUM_IDEN);
      r0.input('TIE_REVIS', sql.Char(1),      'N');
      await r0.query(`INSERT INTO GN_JURID_RF (NUM_IDEN,TIE_REVIS) VALUES (@NUM_IDEN,@TIE_REVIS)`);
    }

    // ── 8. GN_JURID_AC — Composición accionaria ─────────────────────────────────
    for (const a of (d.accionistas || [])) {
      const dept = (!a.COD_DEPT || a.COD_DEPT === 'NA') ? null : a.COD_DEPT;
      const r = new sql.Request(transaction);
      r.input('NUM_IDEN', sql.VarChar(20),    d.NUM_IDEN);
      r.input('NOM_ACCI', sql.VarChar(100),   a.NOM_ACCI || null);
      r.input('APE_ACCI', sql.VarChar(100),   a.APE_ACCI || null);
      r.input('RAZ_ACCI', sql.VarChar(255),   a.RAZ_ACCI || null);
      r.input('TIP_DOCU', sql.Int,             a.TIP_DOCU ? Number(a.TIP_DOCU) : null);
      r.input('NUM_DOCU', sql.VarChar(20),    a.NUM_DOCU || null);
      r.input('FEC_EXPE', sql.Date,            a.FEC_EXPE ? new Date(a.FEC_EXPE) : null);
      r.input('COD_PAIS', sql.VarChar(10),    a.COD_PAIS || null);
      r.input('COD_DEPT', sql.VarChar(10),    dept);
      r.input('COD_MPIO', sql.VarChar(10),    a.COD_MPIO || null);
      r.input('DIR_ACCI', sql.VarChar(255),   a.DIR_ACCI || null);
      r.input('CEL_ACCI', sql.VarChar(30),    a.CEL_ACCI || null);
      r.input('TEL_ACCI', sql.VarChar(30),    a.TEL_ACCI || null);
      r.input('MAIL_ACCI',sql.VarChar(100),   a.MAIL_ACCI|| null);
      r.input('PCT_PART', sql.Decimal(6, 2),  a.PCT_PART != null ? Number(a.PCT_PART) : null);
      await r.query(`
        INSERT INTO GN_JURID_AC
          (NUM_IDEN,NOM_ACCI,APE_ACCI,RAZ_ACCI,TIP_DOCU,NUM_DOCU,FEC_EXPE,
           COD_PAIS,COD_DEPT,COD_MPIO,DIR_ACCI,CEL_ACCI,TEL_ACCI,MAIL_ACCI,PCT_PART)
        VALUES
          (@NUM_IDEN,@NOM_ACCI,@APE_ACCI,@RAZ_ACCI,@TIP_DOCU,@NUM_DOCU,@FEC_EXPE,
           @COD_PAIS,@COD_DEPT,@COD_MPIO,@DIR_ACCI,@CEL_ACCI,@TEL_ACCI,@MAIL_ACCI,@PCT_PART)`);
    }

    // ── 9. GN_JURID_FIN — Información financiera ───────────────────────────────
    {
      const fin = d.financiera || {};
      const r = new sql.Request(transaction);
      r.input('NUM_IDEN',  sql.VarChar(20),     d.NUM_IDEN);
      r.input('ACT_TOTAL', sql.Decimal(18, 2),  fin.ACT_TOTAL  != null ? Number(fin.ACT_TOTAL)  : null);
      r.input('ING_MENS',  sql.Decimal(18, 2),  fin.ING_MENS   != null ? Number(fin.ING_MENS)   : null);
      r.input('PAS_TOTAL', sql.Decimal(18, 2),  fin.PAS_TOTAL  != null ? Number(fin.PAS_TOTAL)  : null);
      r.input('EGR_MENS',  sql.Decimal(18, 2),  fin.EGR_MENS   != null ? Number(fin.EGR_MENS)   : null);
      r.input('PATRIMONIO',sql.Decimal(18, 2),  fin.PATRIMONIO != null ? Number(fin.PATRIMONIO) : null);
      r.input('OTR_ING',   sql.Decimal(18, 2),  fin.OTR_ING    != null ? Number(fin.OTR_ING)    : null);
      await r.query(`
        INSERT INTO GN_JURID_FIN
          (NUM_IDEN,ACT_TOTAL,ING_MENS,PAS_TOTAL,EGR_MENS,PATRIMONIO,OTR_ING)
        VALUES
          (@NUM_IDEN,@ACT_TOTAL,@ING_MENS,@PAS_TOTAL,@EGR_MENS,@PATRIMONIO,@OTR_ING)`);
    }

    // ── 10. GN_TERCE_BANCO — Información bancaria ───────────────────────────────
    for (const b of (d.bancaria || [])) {
      const r = new sql.Request(transaction);
      r.input('NUM_IDEN',   sql.VarChar(20),   d.NUM_IDEN);
      r.input('COD_BANCO',  sql.VarChar(10),   b.COD_BANCO   || null);
      r.input('TIP_CUEN',   sql.VarChar(10),   b.TIP_CUEN    || null);
      r.input('NUM_CUEN',   sql.VarChar(30),   b.NUM_CUEN    || null);
      r.input('CUEN_EXTR',  sql.Char(1),        b.CUEN_EXTR   || 'N');
      r.input('NOM_ENT_EXT',sql.VarChar(255),  b.NOM_ENT_EXT || null);
      r.input('TIP_CUE_EXT',sql.VarChar(10),   b.TIP_CUE_EXT || null);
      await r.query(`
        INSERT INTO GN_TERCE_BANCO
          (NUM_IDEN,COD_BANCO,TIP_CUEN,NUM_CUEN,CUEN_EXTR,NOM_ENT_EXT,TIP_CUE_EXT)
        VALUES
          (@NUM_IDEN,@COD_BANCO,@TIP_CUEN,@NUM_CUEN,@CUEN_EXTR,@NOM_ENT_EXT,@TIP_CUE_EXT)`);
    }

    // ── 11. GN_JURID_PEP — Exposición política ─────────────────────────────────
    {
      const pep = d.pep || {};
      const r = new sql.Request(transaction);
      r.input('NUM_IDEN',  sql.VarChar(20), d.NUM_IDEN);
      r.input('MAN_RPUB',  sql.Char(1),      pep.MAN_RPUB || null);
      r.input('CAR_PUBL',  sql.Char(1),      pep.CAR_PUBL || null);
      await r.query(`
        INSERT INTO GN_JURID_PEP (NUM_IDEN,MAN_RPUB,CAR_PUBL)
        VALUES (@NUM_IDEN,@MAN_RPUB,@CAR_PUBL)`);
    }

    // ── 12. GN_JURID_ACT — Actividades con activos virtuales ───────────────────
    {
      const act = d.actividades || {};
      const r = new sql.Request(transaction);
      r.input('NUM_IDEN',    sql.VarChar(20), d.NUM_IDEN);
      r.input('ACT_VA_FIAT', sql.Char(1),      act.ACT_VA_FIAT  || 'N');
      r.input('ACT_VA_VA',   sql.Char(1),      act.ACT_VA_VA    || 'N');
      r.input('ACT_TRANS',   sql.Char(1),      act.ACT_TRANS    || 'N');
      r.input('ACT_CUSTO',   sql.Char(1),      act.ACT_CUSTO    || 'N');
      r.input('ACT_SERV_FIN',sql.Char(1),      act.ACT_SERV_FIN || 'N');
      r.input('ACT_SERV_VAP',sql.Char(1),      act.ACT_SERV_VAP || 'N');
      r.input('CERT_INFO',   sql.Char(1),      act.CERT_INFO    || 'N');
      await r.query(`
        INSERT INTO GN_JURID_ACT
          (NUM_IDEN,ACT_VA_FIAT,ACT_VA_VA,ACT_TRANS,ACT_CUSTO,ACT_SERV_FIN,ACT_SERV_VAP,CERT_INFO)
        VALUES
          (@NUM_IDEN,@ACT_VA_FIAT,@ACT_VA_VA,@ACT_TRANS,@ACT_CUSTO,@ACT_SERV_FIN,@ACT_SERV_VAP,@CERT_INFO)`);
    }

    // ── 13. GN_JURID_BF — Beneficiarios finales ────────────────────────────────
    for (const bf of (d.beneficiarios || [])) {
      const dept = (!bf.COD_DEPT || bf.COD_DEPT === 'NA') ? null : bf.COD_DEPT;
      const r = new sql.Request(transaction);
      r.input('NUM_IDEN',  sql.VarChar(20),   d.NUM_IDEN);
      r.input('TIP_BENE',  sql.Char(1),        bf.TIP_BENE  || 'P');
      r.input('NOM_BENE',  sql.VarChar(100),   bf.NOM_BENE  || null);
      r.input('APE_BENE',  sql.VarChar(100),   bf.APE_BENE  || null);
      r.input('RAZ_BENE',  sql.VarChar(255),   bf.RAZ_BENE  || null);
      r.input('TIP_DOCU',  sql.Int,             bf.TIP_DOCU  ? Number(bf.TIP_DOCU) : null);
      r.input('NUM_DOCU',  sql.VarChar(20),    bf.NUM_DOCU  || null);
      r.input('FEC_EXPE',  sql.Date,            bf.FEC_EXPE  ? new Date(bf.FEC_EXPE) : null);
      r.input('COD_PAIS',  sql.VarChar(10),    bf.COD_PAIS  || null);
      r.input('COD_DEPT',  sql.VarChar(10),    dept);
      r.input('COD_MPIO',  sql.VarChar(10),    bf.COD_MPIO  || null);
      r.input('DIR_BENE',  sql.VarChar(255),   bf.DIR_BENE  || null);
      r.input('TEL_BENE',  sql.VarChar(30),    bf.TEL_BENE  || null);
      r.input('MAIL_BENE', sql.VarChar(100),   bf.MAIL_BENE || null);
      await r.query(`
        INSERT INTO GN_JURID_BF
          (NUM_IDEN,TIP_BENE,NOM_BENE,APE_BENE,RAZ_BENE,TIP_DOCU,NUM_DOCU,FEC_EXPE,
           COD_PAIS,COD_DEPT,COD_MPIO,DIR_BENE,TEL_BENE,MAIL_BENE)
        VALUES
          (@NUM_IDEN,@TIP_BENE,@NOM_BENE,@APE_BENE,@RAZ_BENE,@TIP_DOCU,@NUM_DOCU,@FEC_EXPE,
           @COD_PAIS,@COD_DEPT,@COD_MPIO,@DIR_BENE,@TEL_BENE,@MAIL_BENE)`);
    }

    // ── 14. GN_JURID_FIRMA — Firma del Representante Legal ─────────────────────
    {
      const fi = d.firma || {};
      if (fi.NOM_FIRM || fi.APE_FIRM || fi.NUM_DOCU || fi.FEC_FIRMA) {
        const r = new sql.Request(transaction);
        r.input('NUM_IDEN',  sql.VarChar(20),  d.NUM_IDEN);
        r.input('NOM_FIRM',  sql.VarChar(100), fi.NOM_FIRM  || null);
        r.input('APE_FIRM',  sql.VarChar(100), fi.APE_FIRM  || null);
        r.input('TIP_DOCU',  sql.Int,           fi.TIP_DOCU  ? Number(fi.TIP_DOCU) : null);
        r.input('NUM_DOCU',  sql.VarChar(20),  fi.NUM_DOCU  || null);
        r.input('FEC_FIRMA', sql.Date,          fi.FEC_FIRMA ? new Date(fi.FEC_FIRMA) : null);
        await r.query(`
          INSERT INTO GN_JURID_FIRMA
            (NUM_IDEN,NOM_FIRM,APE_FIRM,TIP_DOCU,NUM_DOCU,FEC_FIRMA)
          VALUES
            (@NUM_IDEN,@NOM_FIRM,@APE_FIRM,@TIP_DOCU,@NUM_DOCU,@FEC_FIRMA)`);
      }
    }

    await transaction.commit();
    res.json({ success: true, NUM_IDEN: d.NUM_IDEN });

  } catch (err) {
    if (transaction) await transaction.rollback().catch(() => {});
    console.error('POST /api/guardar-completo:', err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  DOCUMENTOS — Subida de archivos adjuntos (GN_TERCE_DOC + ARCH_FIRMA)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/documentos/:numIden
 * Recibe multipart/form-data con los archivos adjuntos del formulario.
 * Los archivos se guardan en uploads/<NUM_IDEN>/<CAMPO>.<ext>.
 * Se registran los nombres en GN_TERCE_DOC y, si viene ARCH_FIRMA,
 * también se actualiza la ruta en GN_JURID_FIRMA.
 *
 * Campos esperados (todos opcionales):
 *   RUT, CERT_BANC, CERT_EXIS, DOC_ID_RL, EST_FIN, CERT_ACCI, CART_ACEP,
 *   ARCH_FIRMA
 */
const DOC_CAMPOS = ['RUT','CERT_BANC','CERT_EXIS','DOC_ID_RL','EST_FIN','CERT_ACCI','CART_ACEP','ARCH_FIRMA'];

app.post('/api/documentos/:numIden',
  upload.fields(DOC_CAMPOS.map(name => ({ name, maxCount: 1 }))),
  async (req, res) => {
    const numIden = req.params.numIden;
    if (!numIden) return res.status(400).json({ error: 'Se requiere numIden en la URL' });

    const files = req.files || {};
    if (Object.keys(files).length === 0) {
      return res.json({ success: true, insertados: 0, mensaje: 'Sin archivos enviados' });
    }

    let transaction;
    try {
      const p = await getPool();
      transaction = new sql.Transaction(p);
      await transaction.begin();

      // ── GN_TERCE_DOC: campos de documento (excluye ARCH_FIRMA) ──────────────
      const docCampos = DOC_CAMPOS.filter(c => c !== 'ARCH_FIRMA' && files[c]);
      if (docCampos.length > 0) {
        const cols   = docCampos.map(c => c).join(',');
        const params = docCampos.map(c => `@${c}`).join(',');
        const r = new sql.Request(transaction);
        r.input('NUM_IDEN', sql.VarChar(20), numIden);
        docCampos.forEach(c => {
          r.input(c, sql.VarChar(500), files[c][0].path);
        });
        await r.query(`
          INSERT INTO GN_TERCE_DOC (NUM_IDEN,${cols}) VALUES (@NUM_IDEN,${params})`);
      }

      // ── GN_JURID_FIRMA: ruta del archivo de firma (ARCH_FIRMA) ───────────────
      if (files['ARCH_FIRMA']) {
        const r = new sql.Request(transaction);
        r.input('NUM_IDEN',   sql.VarChar(20),  numIden);
        r.input('ARCH_FIRMA', sql.VarChar(500), files['ARCH_FIRMA'][0].path);
        await r.query(`
          UPDATE GN_JURID_FIRMA SET ARCH_FIRMA = @ARCH_FIRMA WHERE NUM_IDEN = @NUM_IDEN`);
      }

      await transaction.commit();
      res.json({ success: true, insertados: Object.keys(files).length });

    } catch (err) {
      if (transaction) await transaction.rollback().catch(() => {});
      console.error('POST /api/documentos:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

// ─── Arranque ─────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀  Servidor SARLAFT escuchando en http://localhost:${PORT}`);
  // Pre-calentar el pool al iniciar
  getPool().catch(err => console.error('❌  Error de conexión inicial:', err.message));
});

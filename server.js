/**
 * server.js — API REST para formulario SAGRILAFT (Persona Jurídica)
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
const express      = require('express');
const sql          = require('mssql');
const cors         = require('cors');
const path         = require('path');
const multer       = require('multer');
const fs           = require('fs');
const ExcelJS      = require('exceljs');
const { S3Client, PutObjectCommand, GetObjectCommand,
        ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const session      = require('express-session');
const crypto       = require('crypto');
const nodemailer   = require('nodemailer');

// ─── Validación MIME de archivos ─────────────────────────────────────────────
const TIPOS_DOC_PERMITIDOS = new Set([
  'RUT', 'CERT_BANC', 'CERT_EXIS', 'DOC_ID_RL', 'EST_FIN', 'EST_FIN_1', 'EST_FIN_2',
  'CERT_ACCI', 'CART_ACEP', 'ARCH_FIRMA',
]);

const _EXTENSIONES_PERMITIDAS = new Set(['pdf']);

// Magic bytes (primeros bytes) que identifican cada formato de forma inequívoca
const _FIRMAS_MIME = [
  { mime: 'application/pdf', extensiones: ['pdf'], firma: Buffer.from([0x25, 0x50, 0x44, 0x46]) }, // %PDF
];
const _MAX_FIRMA_BYTES = Math.max(..._FIRMAS_MIME.map(f => f.firma.length));

function _detectarMimePorFirma(rutaArchivo) {
  const fd  = fs.openSync(rutaArchivo, 'r');
  const buf = Buffer.alloc(_MAX_FIRMA_BYTES);
  fs.readSync(fd, buf, 0, _MAX_FIRMA_BYTES, 0);
  fs.closeSync(fd);
  for (const tipo of _FIRMAS_MIME) {
    if (buf.subarray(0, tipo.firma.length).equals(tipo.firma)) return tipo;
  }
  return null;
}

function _validarArchivoMime(file) {
  const extDeclarada = path.extname(file.originalname).replace('.', '').toLowerCase();
  const tipoReal     = _detectarMimePorFirma(file.path);
  if (!tipoReal) {
    return `"${file.fieldname}": el contenido del archivo no es un PDF, JPG ni PNG válido`;
  }
  if (!tipoReal.extensiones.includes(extDeclarada)) {
    return `"${file.fieldname}": la extensión .${extDeclarada} no corresponde al contenido real del archivo (${tipoReal.mime})`;
  }
  return null;
}

// Middleware post-multer: verifica magic bytes de cada archivo y elimina los inválidos
function _mwValidarMime(req, res, next) {
  if (!req.files || req.files.length === 0) return next();
  const errores = req.files.map(_validarArchivoMime).filter(Boolean);
  if (errores.length > 0) {
    // Eliminar todos los archivos del request para no dejar huérfanos en disco
    for (const f of req.files) { try { fs.unlinkSync(f.path); } catch (_) {} }
    return res.status(400).json({ error: 'Archivos rechazados por tipo de contenido', detalles: errores });
  }
  next();
}

// ─── Cloudflare R2 (almacenamiento externo, S3-compatible) ───────────────────
// Si R2_ENDPOINT no está en .env, el sistema cae a disco local automáticamente.
//
// Variables de entorno requeridas para activar R2:
//   R2_ENDPOINT        = https://<account-id>.r2.cloudflarestorage.com
//   R2_BUCKET          = nombre-del-bucket
//   R2_ACCESS_KEY_ID   = clave de acceso (API token de R2)
//   R2_SECRET_ACCESS_KEY = clave secreta
const _r2Client = process.env.R2_ENDPOINT
  ? new S3Client({
      region:   'auto',
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId:     process.env.R2_ACCESS_KEY_ID     || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
      },
    })
  : null;

const _R2_BUCKET  = process.env.R2_BUCKET || '';
const _R2_URL_TTL = 3600; // Signed URL válida 1 hora

async function _r2Subir(localPath, key) {
  const stat   = fs.statSync(localPath);
  const stream = fs.createReadStream(localPath);
  await _r2Client.send(new PutObjectCommand({
    Bucket:        _R2_BUCKET,
    Key:           key,
    Body:          stream,
    ContentLength: stat.size,
    ContentType:   'application/pdf',
  }));
}

async function _r2UrlFirmada(key, nomArch) {
  return getSignedUrl(
    _r2Client,
    new GetObjectCommand({
      Bucket:                     _R2_BUCKET,
      Key:                        key,
      ResponseContentDisposition: `inline; filename="${encodeURIComponent(nomArch)}"`,
    }),
    { expiresIn: _R2_URL_TTL }
  );
}

// Distingue claves R2 (relativas) de rutas locales (absolutas Windows o Unix)
function _esRutaLocal(rutaDoc) {
  return !rutaDoc || /^[A-Za-z]:[\\\/]/.test(rutaDoc) || rutaDoc.startsWith('/');
}

// ─── Configuración de multer para subida de documentos ──────────────────────
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const _multerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Siempre aterriza en _tmp; el handler lo mueve a {AÑO}/{numIden}/
    const tmpDir = path.join(UPLOAD_DIR, '_tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    cb(null, tmpDir);
  },
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const base = file.fieldname;
    cb(null, `${base}${ext}`);
  },
});
// Capa 1 — rechazo rápido por fieldname o extensión antes de escribir en disco
const _multerFileFilter = (req, file, cb) => {
  const allowed = TIPOS_DOC_PERMITIDOS.has(file.fieldname) ||
                  /^DOC_ID_RL_\d+$/.test(file.fieldname);
  if (!allowed) {
    return cb(Object.assign(new Error(`Campo no permitido: "${file.fieldname}"`), { status: 400 }));
  }
  const ext = path.extname(file.originalname).replace('.', '').toLowerCase();
  if (!_EXTENSIONES_PERMITIDAS.has(ext)) {
    return cb(Object.assign(new Error(`Tipo de archivo no permitido: .${ext}. Solo se aceptan archivos PDF.`), { status: 400 }));
  }
  cb(null, true);
};

const upload = multer({
  storage:    _multerStorage,
  limits:     { fileSize: 10 * 1024 * 1024 }, // 10 MB por archivo
  fileFilter: _multerFileFilter,
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

// CORS: solo orígenes explícitamente permitidos en .env (CORS_ORIGINS=http://...,http://...)
// En desarrollo acepta localhost:3000 por defecto.
app.use(cors({
  origin: (origin, cb) => {
    const lista = (process.env.CORS_ORIGINS || `http://localhost:${PORT}`)
      .split(',').map(s => s.trim());
    if (!origin || lista.includes(origin)) return cb(null, true);
    cb(Object.assign(new Error('Origen no permitido por CORS'), { status: 403 }));
  },
  credentials: true,
}));

// Cabeceras de seguridad HTTP
app.use((req, res, next) => {
  // Bloquear embedding en iframes (clickjacking)
  res.setHeader('X-Frame-Options', 'DENY');
  // Impedir sniffing de tipo MIME
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Limitar referrer para no filtrar URLs internas
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // CSP: solo recursos del mismo origen.
  // 'unsafe-inline' requerido por los atributos onchange/onclick del HTML actual.
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join('; '));
  // HSTS: solo en producción (requiere HTTPS)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// Sesión de admin — secreto aleatorio si no está en .env (no persiste entre reinicios)
const _sessionSecret = process.env.SESSION_SECRET
  || (() => {
    const s = crypto.randomBytes(32).toString('hex');
    console.warn('⚠️  SESSION_SECRET no definido — usando valor aleatorio. Las sesiones no sobrevivirán reinicios.');
    return s;
  })();

app.use(session({
  secret:            _sessionSecret,
  resave:            false,
  saveUninitialized: false,
  name:              'sarlaft.sid',   // evitar el identificador por defecto 'connect.sid'
  cookie: {
    httpOnly: true,                                         // inaccesible desde JS del cliente
    secure:   process.env.NODE_ENV === 'production',        // solo HTTPS en producción
    sameSite: 'strict',                                     // bloquea CSRF cross-origin
    maxAge:   8 * 60 * 60 * 1000,                          // 8 horas
  },
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));   // sirve index.html

// ─── Nodemailer — transporte de correo ───────────────────────────────────────
// Si no está configurado SMTP en .env, los correos se registran solo en consola.
const APP_URL        = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || '';

let _mailerTransport = null;
(function _setupMailer() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    _mailerTransport = nodemailer.createTransport({
      host:   SMTP_HOST,
      port:   Number(SMTP_PORT) || 587,
      secure: Number(SMTP_PORT) === 465,
      auth:   { user: SMTP_USER, pass: SMTP_PASS },
    });
    console.log(`📧  Nodemailer configurado — ${SMTP_HOST}:${SMTP_PORT || 587}`);
  } else {
    console.warn('⚠️  SMTP no configurado en .env — los correos se registrarán solo en consola.');
  }
})();

async function _enviarCorreo(to, subject, html) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@minedax.local';
  if (_mailerTransport) {
    try {
      await _mailerTransport.sendMail({ from, to, subject, html });
      console.log(`📧  Correo enviado a ${to} — "${subject}"`);
    } catch (e) {
      console.error(`📧  Error enviando correo a ${to}: ${e.message}`);
    }
  } else {
    console.log(`📧  [SIN SMTP] Para: ${to} | Asunto: ${subject}\n${html.replace(/<[^>]+>/g,' ')}`);
  }
}

// ─── Pool de conexiones global ────────────────────────────────────────────────
let pool;
let _dbInitialized = false;

async function getPool() {
  if (!pool) {
    pool = await sql.connect(dbConfig);
    pool.on('error', err => {
      console.error(`[Pool] Conexión perdida — se reconectará en el próximo request: ${err.message}`);
      pool = null;
      _dbInitialized = false;
    });
    console.log('✅  Conectado a SQL Server — MineDax');
    if (!_dbInitialized) {
      _dbInitialized = true;
      _initDB().catch(err => console.error('⚠️  _initDB():', err.message));
    }
  }
  return pool;
}

// ─── Migración automática de schema ──────────────────────────────────────────
// Añade columna COD_EDIT en GN_TERCE y crea tabla GN_BORRADOR si no existen.
async function _initDB() {
  const p = await getPool();
  await p.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
                   WHERE TABLE_NAME='GN_TERCE' AND COLUMN_NAME='COD_EDIT')
      ALTER TABLE GN_TERCE ADD COD_EDIT CHAR(64) NULL
  `);
  await p.request().query(`
    IF OBJECT_ID('GN_BORRADOR','U') IS NULL
    BEGIN
      CREATE TABLE GN_BORRADOR (
        TOKEN_DRAFT  UNIQUEIDENTIFIER NOT NULL,
        COD_EMPR     SMALLINT         NOT NULL,
        TIP_TERC     CHAR(1)          NOT NULL,
        NUM_IDEN_TXT VARCHAR(20)       NULL,
        DATOS_JSON   NVARCHAR(MAX)    NOT NULL,
        FEC_GUAR     DATETIME         NOT NULL DEFAULT GETDATE(),
        FEC_VENC     DATETIME         NOT NULL,
        CONSTRAINT PK_GN_BORRADOR PRIMARY KEY (TOKEN_DRAFT)
      )
    END
  `);
  await p.request().query(`
    IF OBJECT_ID('GN_ADMIN_USR','U') IS NULL
    BEGIN
      CREATE TABLE GN_ADMIN_USR (
        ID_ADMIN    UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        USR_ADMIN   VARCHAR(50)      NOT NULL,
        NOM_REAL    VARCHAR(100)     NOT NULL,
        EMAIL       VARCHAR(150)     NOT NULL,
        PWD_HASH    CHAR(64)         NULL,
        ESTADO      CHAR(1)          NOT NULL DEFAULT 'P',
        TOK_APROB   CHAR(64)         NULL,
        TOK_RESET   CHAR(64)         NULL,
        TOK_VENC    DATETIME         NULL,
        FEC_CREA    DATETIME         NOT NULL DEFAULT GETDATE(),
        FEC_APROB   DATETIME         NULL,
        CONSTRAINT PK_GN_ADMIN_USR  PRIMARY KEY (ID_ADMIN),
        CONSTRAINT UQ_USR_ADMIN     UNIQUE      (USR_ADMIN)
      )
    END
  `);
  console.log('✅  DB schema verificado (COD_EDIT, GN_BORRADOR, GN_ADMIN_USR)');
}

// ─── Helpers de código de edición ────────────────────────────────────────────
// Genera un código alfanumérico legible tipo "ABCD-EFGH" y su hash SHA-256.
function _generarCodigoEdicion() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin I,O,0,1
  const buf   = crypto.randomBytes(8);
  let code = '';
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += '-';
    code += chars[buf[i] % chars.length];
  }
  return code;
}

function _hashCodigo(codigo) {
  return crypto.createHash('sha256').update(String(codigo).toUpperCase()).digest('hex');
}

// ─── Validadores server-side ──────────────────────────────────────────────────

/**
 * Valida que una fecha sea parseable y razonable.
 * @param {string} valor  - Valor del campo (ISO string o similar)
 * @param {string} label  - Nombre legible del campo para el mensaje de error
 * @param {object} opts
 *   noFutura {boolean} - Si true, rechaza fechas posteriores a hoy (default: true)
 *   noPasada {boolean} - Si true, rechaza fechas anteriores a hoy (default: false)
 * @returns {string|null} Mensaje de error o null si es válida
 */
function _validarFecha(valor, label, { noFutura = true, noPasada = false } = {}) {
  if (!valor || valor === '') return null;
  const d = new Date(valor);
  if (isNaN(d.getTime()))          return `${label}: formato de fecha inválido`;
  if (d.getFullYear() < 1900)      return `${label}: año fuera de rango (mínimo 1900)`;
  if (d.getFullYear() > 2100)      return `${label}: año fuera de rango (máximo 2100)`;
  const hoy = new Date(); hoy.setHours(23, 59, 59, 999);
  if (noFutura  && d > hoy)        return `${label}: no puede ser una fecha futura`;
  if (noPasada  && d < new Date()) return `${label}: debe ser una fecha futura`;
  return null;
}

/**
 * Valida que un campo de texto no supere la longitud máxima.
 * @param {*}      valor - Valor del campo
 * @param {string} label - Nombre legible del campo
 * @param {number} max   - Máximo de caracteres (default 500)
 * @returns {string|null}
 */
function _validarTexto(valor, label, max = 500) {
  if (valor != null && String(valor).length > max)
    return `${label}: supera el máximo de ${max} caracteres`;
  return null;
}

/**
 * Ejecuta un array de funciones de validación y acumula los errores.
 * @param {Array<Function>} reglas - Cada función retorna string|null
 * @returns {string[]} Array de mensajes de error (vacío si todo es válido)
 */
function _validarCampos(reglas) {
  return reglas.map(fn => fn()).filter(Boolean);
}

// ─── Bloqueo de envíos duplicados concurrentes ────────────────────────────────
// Evita que dos peticiones simultáneas con el mismo NUM_IDEN abran
// transacciones en paralelo y generen violaciones de clave primaria.
// El Map guarda el timestamp de inicio para auto-liberar bloqueos colgados (+30 s).
const _enviosEnProceso = new Map();
const _ENVIO_TIMEOUT_MS = 30_000;

function _bloquearEnvio(numIden) {
  const ahora = Date.now();
  if (_enviosEnProceso.has(numIden)) {
    const inicio = _enviosEnProceso.get(numIden);
    if (ahora - inicio < _ENVIO_TIMEOUT_MS) return false; // bloqueado activamente
    console.warn(`[DUPLICADO] Liberando bloqueo caducado para NUM_IDEN=${numIden}`);
  }
  _enviosEnProceso.set(numIden, ahora);
  return true;
}

function _liberarEnvio(numIden) {
  _enviosEnProceso.delete(numIden);
}

// ─── Autenticación de administrador ──────────────────────────────────────────
// Variables de entorno requeridas: ADMIN_USUARIO, ADMIN_CLAVE
// Opcional:                        SESSION_SECRET (cadena aleatoria larga)
//
// Rutas públicas:  POST /api/admin/login
//                  POST /api/admin/logout
//                  GET  /api/admin/me  (verificar sesión activa)
// Rutas protegidas (requireAuth): descargas, consolidados, purga

function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.status(401).json({ error: 'Acceso no autorizado. Inicie sesión en /admin.' });
}

app.post('/api/admin/login', async (req, res) => {
  const { usuario, clave } = req.body || {};
  if (!usuario || !clave) return res.status(400).json({ error: 'Campos requeridos.' });

  // 1) Credenciales de entorno (super-admin hardcoded)
  const envUsuario = process.env.ADMIN_USUARIO;
  const envClave   = process.env.ADMIN_CLAVE;
  if (envUsuario && envClave && usuario === envUsuario && clave === envClave) {
    req.session.isAdmin   = true;
    req.session.loginAt   = new Date().toISOString();
    req.session.usuario   = usuario;
    req.session.esSuperAdmin = true;
    console.log(`[AUTH] Login super-admin env — ${usuario} — ${req.session.loginAt}`);
    return res.json({ success: true, esSuperAdmin: true });
  }

  // 2) Usuarios en DB (ESTADO='A')
  try {
    const p = await getPool();
    const result = await p.request()
      .input('USR', sql.VarChar(50), String(usuario))
      .query(`SELECT PWD_HASH, NOM_REAL FROM GN_ADMIN_USR WHERE USR_ADMIN=@USR AND ESTADO='A'`);
    if (result.recordset.length > 0) {
      const { PWD_HASH, NOM_REAL } = result.recordset[0];
      const hashIngresado = _hashCodigo(clave);
      if (PWD_HASH && PWD_HASH.trim() === hashIngresado) {
        req.session.isAdmin  = true;
        req.session.loginAt  = new Date().toISOString();
        req.session.usuario  = usuario;
        console.log(`[AUTH] Login DB — ${usuario} (${NOM_REAL}) — ${req.session.loginAt}`);
        return res.json({ success: true });
      }
    }
  } catch (e) {
    console.error('[AUTH] Error consultando GN_ADMIN_USR:', e.message);
  }

  console.warn(`[AUTH] Intento fallido — "${usuario}" — ${new Date().toISOString()}`);
  return res.status(401).json({ error: 'Credenciales incorrectas' });
});

app.post('/api/admin/logout', (req, res) => {
  const usuario = req.session.usuario || '—';
  req.session.destroy(() => {
    console.log(`[AUTH] Logout — usuario: ${usuario} — ${new Date().toISOString()}`);
    res.clearCookie('sarlaft.sid');
    res.json({ success: true });
  });
});

app.get('/api/admin/me', (req, res) => {
  if (req.session && req.session.isAdmin) {
    return res.json({ autenticado: true, usuario: req.session.usuario, loginAt: req.session.loginAt });
  }
  res.json({ autenticado: false });
});

// Panel de administración (página protegida por login)
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Página de restablecimiento de contraseña
app.get('/admin/restablecer', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-restablecer.html'));
});

// ─── Cuentas de administrador ─────────────────────────────────────────────────

/**
 * POST /api/admin/registrar
 * Crea una solicitud de cuenta pendiente y envía email al super-admin para aprobar/rechazar.
 */
app.post('/api/admin/registrar', async (req, res) => {
  const { usuario, nomReal, email, clave, clave2 } = req.body || {};
  if (!usuario || !nomReal || !email || !clave || !clave2)
    return res.status(400).json({ error: 'Todos los campos son requeridos.' });
  if (clave !== clave2)
    return res.status(400).json({ error: 'Las contraseñas no coinciden.' });
  if (clave.length < 8)
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
  if (!/^[a-zA-Z0-9._-]+$/.test(usuario))
    return res.status(400).json({ error: 'El usuario solo puede contener letras, números, . _ -' });

  try {
    const p = await getPool();
    // Verificar que el usuario no exista ya
    const dup = await p.request()
      .input('USR', sql.VarChar(50), usuario)
      .query(`SELECT 1 FROM GN_ADMIN_USR WHERE USR_ADMIN=@USR`);
    if (dup.recordset.length > 0)
      return res.status(409).json({ error: 'El nombre de usuario ya está en uso.' });

    // Generar token de aprobación (raw) y su hash
    const tokenRaw  = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(tokenRaw).digest('hex');
    const pwdHash   = _hashCodigo(clave);

    await p.request()
      .input('USR',        sql.VarChar(50),   usuario)
      .input('NOM',        sql.VarChar(100),  nomReal)
      .input('EMAIL',      sql.VarChar(150),  email)
      .input('PWD_HASH',   sql.Char(64),      pwdHash)
      .input('TOK_APROB',  sql.Char(64),      tokenHash)
      .query(`INSERT INTO GN_ADMIN_USR (USR_ADMIN,NOM_REAL,EMAIL,PWD_HASH,ESTADO,TOK_APROB)
              VALUES (@USR,@NOM,@EMAIL,@PWD_HASH,'P',@TOK_APROB)`);

    const urlAprobar  = `${APP_URL}/api/admin/aprobar/${tokenRaw}`;
    const urlRechazar = `${APP_URL}/api/admin/rechazar/${tokenRaw}`;

    if (SUPER_ADMIN_EMAIL) {
      await _enviarCorreo(
        SUPER_ADMIN_EMAIL,
        'SAGRILAFT — Solicitud de nueva cuenta admin',
        `<p>El usuario <strong>${usuario}</strong> (${nomReal} &lt;${email}&gt;) solicita acceso al panel de administración.</p>
         <p><a href="${urlAprobar}" style="color:green;font-weight:bold">✔ Aprobar solicitud</a></p>
         <p><a href="${urlRechazar}" style="color:red;font-weight:bold">✘ Rechazar solicitud</a></p>
         <p style="font-size:.85em;color:#666">Si no reconoce esta solicitud, puede ignorar este correo.</p>`
      );
    } else {
      console.log(`[ADMIN-REG] SUPER_ADMIN_EMAIL no configurado.`);
      console.log(`[ADMIN-REG] Aprobar:  ${urlAprobar}`);
      console.log(`[ADMIN-REG] Rechazar: ${urlRechazar}`);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('POST /api/admin/registrar:', err.message);
    _responderError(res, err, req);
  }
});

/**
 * GET /api/admin/aprobar/:token
 * Activa la cuenta y notifica al usuario.
 */
app.get('/api/admin/aprobar/:token', async (req, res) => {
  const tokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex');
  try {
    const p = await getPool();
    const r = await p.request()
      .input('TOK', sql.Char(64), tokenHash)
      .query(`SELECT ID_ADMIN, USR_ADMIN, NOM_REAL, EMAIL, ESTADO FROM GN_ADMIN_USR WHERE TOK_APROB=@TOK`);
    if (!r.recordset.length)
      return res.status(404).send('<h2>Token inválido o ya procesado.</h2>');
    const { ESTADO, USR_ADMIN, NOM_REAL, EMAIL } = r.recordset[0];
    if (ESTADO !== 'P')
      return res.send(`<h2>Esta solicitud ya fue procesada (estado: ${ESTADO}).</h2>`);

    await p.request()
      .input('TOK', sql.Char(64), tokenHash)
      .query(`UPDATE GN_ADMIN_USR SET ESTADO='A', TOK_APROB=NULL, FEC_APROB=GETDATE() WHERE TOK_APROB=@TOK`);

    await _enviarCorreo(
      EMAIL,
      'SAGRILAFT — Acceso aprobado',
      `<p>Hola <strong>${NOM_REAL}</strong>, su solicitud de acceso al panel de administración SAGRILAFT ha sido <strong style="color:green">aprobada</strong>.</p>
       <p>Puede iniciar sesión en: <a href="${APP_URL}/admin">${APP_URL}/admin</a></p>
       <p>Usuario: <strong>${USR_ADMIN}</strong></p>`
    );

    res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Cuenta aprobada</title></head>
      <body style="font-family:sans-serif;padding:40px;max-width:500px;margin:auto">
        <h2 style="color:#2e7d32">✔ Cuenta aprobada</h2>
        <p>El usuario <strong>${USR_ADMIN}</strong> (${NOM_REAL}) ahora puede acceder al panel de administración.</p>
        <p>Se le envió un correo de confirmación a ${EMAIL}.</p>
        <a href="${APP_URL}/admin">Ir al panel admin</a>
      </body></html>`);
  } catch (err) {
    console.error('GET /api/admin/aprobar:', err.message);
    res.status(500).send('<h2>Error interno del servidor.</h2>');
  }
});

/**
 * GET /api/admin/rechazar/:token
 * Marca la cuenta como rechazada y notifica al usuario.
 */
app.get('/api/admin/rechazar/:token', async (req, res) => {
  const tokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex');
  try {
    const p = await getPool();
    const r = await p.request()
      .input('TOK', sql.Char(64), tokenHash)
      .query(`SELECT USR_ADMIN, NOM_REAL, EMAIL, ESTADO FROM GN_ADMIN_USR WHERE TOK_APROB=@TOK`);
    if (!r.recordset.length)
      return res.status(404).send('<h2>Token inválido o ya procesado.</h2>');
    const { ESTADO, USR_ADMIN, NOM_REAL, EMAIL } = r.recordset[0];
    if (ESTADO !== 'P')
      return res.send(`<h2>Esta solicitud ya fue procesada (estado: ${ESTADO}).</h2>`);

    await p.request()
      .input('TOK', sql.Char(64), tokenHash)
      .query(`UPDATE GN_ADMIN_USR SET ESTADO='R', TOK_APROB=NULL WHERE TOK_APROB=@TOK`);

    await _enviarCorreo(
      EMAIL,
      'SAGRILAFT — Solicitud de acceso rechazada',
      `<p>Hola <strong>${NOM_REAL}</strong>, su solicitud de acceso al panel de administración SAGRILAFT ha sido <strong style="color:red">rechazada</strong>.</p>
       <p>Si cree que esto es un error, comuníquese con el administrador del sistema.</p>`
    );

    res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Solicitud rechazada</title></head>
      <body style="font-family:sans-serif;padding:40px;max-width:500px;margin:auto">
        <h2 style="color:#c62828">✘ Solicitud rechazada</h2>
        <p>La solicitud del usuario <strong>${USR_ADMIN}</strong> (${NOM_REAL}) ha sido rechazada.</p>
        <p>Se notificó al usuario por correo.</p>
      </body></html>`);
  } catch (err) {
    console.error('GET /api/admin/rechazar:', err.message);
    res.status(500).send('<h2>Error interno del servidor.</h2>');
  }
});

/**
 * POST /api/admin/recuperar
 * Envía link de restablecimiento de contraseña al correo registrado.
 */
app.post('/api/admin/recuperar', async (req, res) => {
  const { usuario } = req.body || {};
  if (!usuario) return res.status(400).json({ error: 'Usuario requerido.' });
  try {
    const p = await getPool();
    const r = await p.request()
      .input('USR', sql.VarChar(50), String(usuario))
      .query(`SELECT NOM_REAL, EMAIL FROM GN_ADMIN_USR WHERE USR_ADMIN=@USR AND ESTADO='A'`);

    // Siempre responder OK para no revelar si el usuario existe
    if (r.recordset.length > 0) {
      const { NOM_REAL, EMAIL } = r.recordset[0];
      const tokenRaw  = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(tokenRaw).digest('hex');
      const vencimiento = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 horas

      await p.request()
        .input('USR',  sql.VarChar(50), String(usuario))
        .input('TOK',  sql.Char(64),    tokenHash)
        .input('VENC', sql.DateTime,    vencimiento)
        .query(`UPDATE GN_ADMIN_USR SET TOK_RESET=@TOK, TOK_VENC=@VENC WHERE USR_ADMIN=@USR AND ESTADO='A'`);

      const urlReset = `${APP_URL}/admin/restablecer?token=${tokenRaw}`;
      await _enviarCorreo(
        EMAIL,
        'SAGRILAFT — Restablecer contraseña',
        `<p>Hola <strong>${NOM_REAL}</strong>, solicitó restablecer su contraseña del panel SAGRILAFT.</p>
         <p><a href="${urlReset}" style="font-weight:bold">Haga clic aquí para restablecer su contraseña</a></p>
         <p>Este enlace expira en 2 horas. Si no solicitó este cambio, ignore este correo.</p>`
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error('POST /api/admin/recuperar:', err.message);
    _responderError(res, err, req);
  }
});

/**
 * POST /api/admin/restablecer
 * Guarda la nueva contraseña usando el token de reset.
 */
app.post('/api/admin/restablecer', async (req, res) => {
  const { token, clave, clave2 } = req.body || {};
  if (!token || !clave || !clave2)
    return res.status(400).json({ error: 'Campos requeridos.' });
  if (clave !== clave2)
    return res.status(400).json({ error: 'Las contraseñas no coinciden.' });
  if (clave.length < 8)
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  try {
    const p = await getPool();
    const r = await p.request()
      .input('TOK', sql.Char(64), tokenHash)
      .query(`SELECT USR_ADMIN FROM GN_ADMIN_USR WHERE TOK_RESET=@TOK AND TOK_VENC > GETDATE() AND ESTADO='A'`);
    if (!r.recordset.length)
      return res.status(400).json({ error: 'El enlace es inválido o ha expirado.' });

    const pwdHash = _hashCodigo(clave);
    await p.request()
      .input('TOK', sql.Char(64), tokenHash)
      .input('PWD', sql.Char(64), pwdHash)
      .query(`UPDATE GN_ADMIN_USR SET PWD_HASH=@PWD, TOK_RESET=NULL, TOK_VENC=NULL WHERE TOK_RESET=@TOK`);

    res.json({ success: true });
  } catch (err) {
    console.error('POST /api/admin/restablecer:', err.message);
    _responderError(res, err, req);
  }
});

// ─── Verificar código de edición ──────────────────────────────────────────────
// Comprueba si el código ingresado coincide con el hash almacenado en GN_TERCE.
// Registros legacy (COD_EDIT NULL) requieren sesión de admin.
app.post('/api/verificar-codigo-edicion', async (req, res) => {
  const { numIden, codigoEdicion } = req.body || {};
  if (!numIden) return res.status(400).json({ error: 'numIden requerido.' });
  try {
    const p = await getPool();
    const result = await p.request()
      .input('COD_EMPR', sql.SmallInt,    COD_EMPR)
      .input('NUM_IDEN', sql.VarChar(20), String(numIden))
      .query(`SELECT COD_EDIT FROM GN_TERCE WHERE COD_EMPR=@COD_EMPR AND NUM_IDEN=@NUM_IDEN`);
    if (!result.recordset.length)
      return res.json({ valido: false, razon: 'noEncontrado' });
    const codEdit = (result.recordset[0].COD_EDIT || '').trim();
    if (!codEdit) {
      // Registro legacy — solo el admin puede editar
      if (req.session && req.session.isAdmin)
        return res.json({ valido: true, legacy: true });
      return res.json({ valido: false, razon: 'requiereAdmin' });
    }
    if (!codigoEdicion)
      return res.json({ valido: false, razon: 'codigoAusente' });
    const valido = _hashCodigo(codigoEdicion.trim()) === codEdit;
    res.json({ valido });
  } catch (err) {
    _responderError(res, err, req);
  }
});

// ─── Manejo centralizado de errores internos ──────────────────────────────────
// Registra el error real en consola y devuelve un mensaje genérico al cliente.
// Nunca exponer err.message ni stack traces a la red.
function _responderError(res, err, req, contexto) {
  const ts   = new Date().toISOString();
  const ruta = req ? `${req.method} ${req.path}` : '—';
  console.error(`[${ts}] ERROR ${ruta} [${contexto || 'servidor'}]: ${err.message}`);
  if (err.stack) console.error(err.stack);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Error interno del servidor. Intente nuevamente.' });
  }
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
const ACT_USUA_GLOBAL = (process.env.APP_USER || 'SAGRILAFT').padEnd(8, ' ').slice(0, 8);

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
      `SELECT COD_TPDOC, NOM_TPDOC, COD_ABREV, NOM_EN
         FROM MAE_TPDOC
        ${soloNit ? 'WHERE COD_TPDOC = 8' : 'WHERE COD_TPDOC > 0'}
        ORDER BY NOM_TPDOC`
    );
    res.json(rows);
  } catch (err) {
    console.error('tipos-documento:', err);
    _responderError(res, err, req);
  }
});

/**
 * GET /api/catalogo/paises
 * Colombia (IND_PRINCI = 'S') va primero, luego el resto alfabéticamente.
 */
app.get('/api/catalogo/paises', async (req, res) => {
  try {
    const rows = await query(
      `SELECT COD_PAIS, NOM_PAIS, IND_PRINCI, NOM_EN
         FROM MAE_PAIS
        WHERE COD_PAIS > 0
          AND NOM_PAIS NOT LIKE 'Otro%'
        ORDER BY CASE WHEN IND_PRINCI = 'S' THEN 0 ELSE 1 END, NOM_PAIS`
    );
    res.json(rows);
  } catch (err) {
    console.error('paises:', err);
    _responderError(res, err, req);
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
        ORDER BY CASE COD_DEPT WHEN 2 THEN 0 WHEN 8 THEN 1 ELSE 2 END, NOM_DEPT`,
      { cod_pais: { type: sql.VarChar(10), value: cod_pais } }
    );
    res.json(rows);
  } catch (err) {
    console.error('departamentos:', err);
    _responderError(res, err, req);
  }
});

/**
 * GET /api/catalogo/ciudades?cod_dept=XX&cod_pais=XX
 * Cuando cod_dept no viene (país extranjero), filtra solo por cod_pais.
 */
app.get('/api/catalogo/ciudades', async (req, res) => {
  const { cod_dept, cod_pais } = req.query;
  if (!cod_pais) return res.status(400).json({ error: 'Se requiere cod_pais' });
  if (cod_pais === 'OTRO' || Number(cod_pais) === 52) return res.json([]);
  if (cod_dept === 'NA') return res.json([]);
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
    _responderError(res, err, req);
  }
});

/**
 * GET /api/catalogo/vinculaciones
 * Lee MAE_VINC completo desde la BD (incluye NOM_EN tras migración db_bilinguismo.sql).
 */
app.get('/api/catalogo/vinculaciones', async (req, res) => {
  try {
    const rows = await query(
      `SELECT COD_VINC, NOM_VINC, COD_ABREV, NOM_EN
         FROM MAE_VINC
        WHERE COD_VINC IN (3, 4, 9, 10, 11)
        ORDER BY COD_VINC`
    );
    res.json(rows);
  } catch (err) {
    console.error('vinculaciones:', err);
    _responderError(res, err, req);
  }
});

/**
 * GET /api/catalogo/ciiu
 * Retorna código + nombre para el buscador del campo CIIU.
 */
app.get('/api/catalogo/ciiu', async (req, res) => {
  try {
    const soloJuridica = req.query.tipo === 'J';
    const rows = await query(
      `SELECT COD_CIIU,
              COD_CIIU + ' - ' + NOM_CIIU AS NOM_CIIU,
              CASE WHEN NOM_EN IS NOT NULL AND NOM_EN <> ''
                   THEN COD_CIIU + ' - ' + NOM_EN ELSE NULL END AS NOM_EN
       FROM MAE_CIIU
      ${soloJuridica ? "WHERE COD_CIIU NOT LIKE '00%'" : ''}
       ORDER BY COD_CIIU`
    );
    res.json(rows);
  } catch (err) {
    console.error('ciiu:', err);
    _responderError(res, err, req);
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
      `SELECT COD_SOCIE, NOM_SOCIE, UBIC_SOCIE, NOM_EN
         FROM MAE_TIP_SOCIE
        ${where}
        ORDER BY COD_SOCIE`
    );
    res.json(rows);
  } catch (err) {
    console.error('tipos-sociedad:', err);
    _responderError(res, err, req);
  }
});

/**
 * GET /api/catalogo/sistemas-prevencion
 * Devuelve los sistemas de prevención LA/FT registrados en MAE_SIST_PREV.
 * NOM_EN disponible desde migración db_bilinguismo.sql.
 */
app.get('/api/catalogo/sistemas-prevencion', async (req, res) => {
  try {
    const rows = await query(
      `SELECT COD_SIST, NOM_SIST, COD_ABREV, NOM_EN
         FROM MAE_SIST_PREV
        ORDER BY COD_SIST`
    );
    res.json(rows);
  } catch (err) {
    console.error('sistemas-prevencion:', err);
    _responderError(res, err, req);
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
    _responderError(res, err, req);
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
    _responderError(res, err, req);
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
    _responderError(res, err, req);
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
    r0.input('SIS_PREVE', sql.VarChar(255),       TIE_JUNTA === 'S' ? (SIS_PREVE || null) : null);

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
    _responderError(res, err, req);
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
    _responderError(res, err, req);
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
    r.input('REVI_FIRMA',    sql.Char(1),          d.REVI_FIRMA   || 'N');
    r.input('RAZ_FIRMA',     sql.VarChar(255),     d.RAZ_FIRMA    || null);
    r.input('TIP_DOCU_FIR',  sql.Int,               d.TIP_DOCU_FIR === 'OTR_TPDOC' ? null : (d.TIP_DOCU_FIR ? Number(d.TIP_DOCU_FIR) : null));
    r.input('OTR_TPDOC_FIR', sql.VarChar(100),     d.OTR_TPDOC_FIR || null);
    r.input('NUM_DOCU_FIR',  sql.VarChar(20),      d.NUM_DOCU_FIR || null);
    r.input('OBS_REVI',      sql.VarChar(sql.MAX), d.OBS_REVI  || null);
    await r.query(`
      INSERT INTO GN_JURID_RF
        (NUM_IDEN,TIP_REPR,TIE_REVIS,NOM_REVI,APE_REVI,RAZ_REVI,TIP_DOCU,NUM_DOCU,
         FEC_EXPE,COD_PAIS,COD_DEPT,COD_MPIO,DIR_REVI,CEL_REVI,TEL_REVI,MAIL_REVI,
         REVI_FIRMA,RAZ_FIRMA,TIP_DOCU_FIR,OTR_TPDOC_FIR,NUM_DOCU_FIR,OBS_REVI)
      VALUES
        (@NUM_IDEN,@TIP_REPR,@TIE_REVIS,@NOM_REVI,@APE_REVI,@RAZ_REVI,@TIP_DOCU,@NUM_DOCU,
         @FEC_EXPE,@COD_PAIS,@COD_DEPT,@COD_MPIO,@DIR_REVI,@CEL_REVI,@TEL_REVI,@MAIL_REVI,
         @REVI_FIRMA,@RAZ_FIRMA,@TIP_DOCU_FIR,@OTR_TPDOC_FIR,@NUM_DOCU_FIR,@OBS_REVI)`);
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
    _responderError(res, err, req);
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
    _responderError(res, err, req);
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
    _responderError(res, err, req);
  }
});

/**
 * GET /api/catalogo/tipos-cuenta
 * Lista de tipos de cuenta desde MAE_TPCTA.
 */
app.get('/api/catalogo/tipos-cuenta', async (req, res) => {
  try {
    const rows = await query(
      `SELECT COD_TPCTA, NOM_TPCTA, NOM_EN FROM MAE_TPCTA WHERE NOM_TPCTA NOT LIKE '%N%mina%' AND NOM_TPCTA NOT LIKE '%lectrónica%' AND NOM_TPCTA NOT LIKE '%lectronica%' ORDER BY COD_TPCTA`
    );
    res.json(rows);
  } catch (err) {
    console.error('tipos-cuenta:', err);
    _responderError(res, err, req);
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
    const pool = await getPool();
    const r    = pool.request();
    r.input('NUM_IDEN', sql.VarChar(20), numIden);
    r.input('COD_EMPR', sql.SmallInt, COD_EMPR);

    const result = await r.query(`
      SELECT TOP 1
        t.COD_TERC,
        t.NUM_IDEN,
        t.NOM_COMP,
        t.TIP_TERC,
        td.NOM_TPDOC AS TIP_TPDOC,
        CASE WHEN t.COD_EDIT IS NOT NULL THEN 1 ELSE 0 END AS TIENE_COD_EDIT
      FROM GN_TERCE t
      LEFT JOIN MAE_TPDOC td
        ON td.COD_TPDOC = t.COD_TPDOC
      WHERE t.COD_EMPR = @COD_EMPR
        AND t.NUM_IDEN  = @NUM_IDEN
    `);

    if (result.recordset.length > 0) {
      const row = result.recordset[0];
      res.json({ existe: true, ...row, tieneCodEdit: row.TIENE_COD_EDIT === 1 });
    } else {
      res.json({ existe: false });
    }
  } catch (err) {
    console.error('GET /api/verificar-identidad:', err);
    _responderError(res, err, req);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  EXPORTACIÓN — Generar Excel con los datos de un tercero
// ═══════════════════════════════════════════════════════════════════════════════


/**
 * GET /api/exportar-excel/:codTerc
 *
 * Genera un Excel con todos los campos del formulario, etiquetas bilingüeS
 * (es/en) y códigos resueltos mediante JOINs a los catálogos.
 * Acepta ?lang=es|en  (por defecto español).
 * Guarda una copia en UPLOAD_DIR/exports/{codTerc}/ antes de enviar.
 */
app.get('/api/exportar-excel/:codTerc', async (req, res) => {
  const codTerc = parseInt(req.params.codTerc, 10);
  if (!codTerc) return res.status(400).json({ error: 'codTerc inválido' });

  const lang = req.query.lang === 'en' ? 'en' : 'es';
  const L = (es, en) => lang === 'en' ? en : es;

  // Helpers para columnas bilingüeS de catálogos
  const nomPais  = (a) => lang === 'en' ? `ISNULL(${a}.NOM_EN, ${a}.NOM_PAIS)`  : `${a}.NOM_PAIS`;
  const nomTpdoc = (a) => lang === 'en' ? `ISNULL(${a}.NOM_EN, ${a}.NOM_TPDOC)` : `${a}.NOM_TPDOC`;
  const nomVinc  = (a) => lang === 'en' ? `ISNULL(${a}.NOM_EN, ${a}.NOM_VINC)`  : `${a}.NOM_VINC`;
  const nomCiiu  = (a) => lang === 'en' ? `ISNULL(${a}.NOM_EN, ${a}.NOM_CIIU)`  : `${a}.NOM_CIIU`;
  const nomSocie = (a) => lang === 'en' ? `ISNULL(${a}.NOM_EN, ${a}.NOM_SOCIE)` : `${a}.NOM_SOCIE`;
  const nomTpcta = (a) => lang === 'en' ? `ISNULL(${a}.NOM_EN, ${a}.NOM_TPCTA)` : `${a}.NOM_TPCTA`;
  const nomSist  = (a) => lang === 'en' ? `ISNULL(${a}.NOM_EN, ${a}.NOM_SIST)`  : `${a}.NOM_SIST`;

  try {
    const pool = await getPool();
    const q = async (query) => {
      const rq = pool.request();
      rq.input('COD_EMPR', sql.SmallInt, COD_EMPR);
      rq.input('COD_TERC', sql.BigInt,   codTerc);
      return (await rq.query(query)).recordset;
    };

    const [empresa, financiera, bancaria, pep, act, rl, jd, rf, ac, bf, cump, paises, firma, documentos] = await Promise.all([

      // ── Datos de la empresa (GN_TERCE + GN_JURID) ────────────────────────
      q(`SELECT
          ${nomTpdoc('td')}                             AS [${L('Tipo de documento','Document type')}],
          t.NUM_IDEN                                    AS [${L('Número de identificación / NIT','Identification number / NIT')}],
          t.DIG_VERI                                    AS [${L('Dígito de verificación','Check digit')}],
          LTRIM(RTRIM(ISNULL(t.NOM_COMP,'')))           AS [${L('Razón social','Company name')}],
          LTRIM(RTRIM(ISNULL(t.DIR_TERC,'')))           AS [${L('Dirección','Address')}],
          LTRIM(RTRIM(ISNULL(t.TEL_TERC,'')))           AS [${L('Teléfono','Phone')}],
          LTRIM(RTRIM(ISNULL(t.TEL_TERC2,'')))          AS [${L('Teléfono 2','Phone 2')}],
          t.DIR_MAIL                                    AS [${L('Email corporativo','Corporate email')}],
          ISNULL(${nomVinc('v')}, j.TIP_VINC)           AS [${L('Tipo de vinculación','Relationship type')}],
          ISNULL(j.OTR_VINC,'')                         AS [${L('Otra vinculación','Other relationship type')}],
          j.MAIL_SARL                                   AS [${L('Email SAGRILAFT','SAGRILAFT email')}],
          j.URL_WEB                                     AS [${L('Sitio web','Website')}],
          j.COD_CIIU + CASE WHEN ${nomCiiu('ci')} IS NOT NULL THEN ' — ' + ${nomCiiu('ci')} ELSE '' END
                                                        AS [${L('Actividad CIIU','CIIU activity')}],
          ISNULL(j.OTR_CIIU,'')                         AS [${L('Otra actividad CIIU','Other CIIU activity')}],
          ISNULL(${nomSocie('ts')}, j.TIP_SOCIE)        AS [${L('Tipo de sociedad','Company type')}],
          ISNULL(j.OTR_SOCIE,'')                        AS [${L('Otro tipo de sociedad','Other company type')}],
          CASE j.UBIC_SOC WHEN 'N' THEN '${L('Nacional','National')}' WHEN 'E' THEN '${L('Extranjera','Foreign')}' WHEN 'SC' THEN '${L('Sucursal en Colombia','Branch in Colombia')}' ELSE ISNULL(j.UBIC_SOC,'') END
                                                        AS [${L('Ubicación de la sociedad','Company location')}],
          ISNULL(${nomPais('ps')},'')                   AS [${L('País de constitución','Country of incorporation')}],
          ISNULL(j.OTR_PAIS_SOC,'')                     AS [${L('Otro país de constitución','Other country of incorporation')}],
          CASE j.TIP_EMPR WHEN 'PUBLICA' THEN '${L('Pública','Public')}' WHEN 'PRIVADA' THEN '${L('Privada','Private')}' WHEN 'MIXTA' THEN '${L('Mixta','Mixed')}' ELSE ISNULL(j.TIP_EMPR,'') END
                                                        AS [${L('Tipo de empresa','Company category')}],
          CASE j.GRUP_EMPR WHEN 'S' THEN '${L('Sí','Yes')}' ELSE 'No' END
                                                        AS [${L('Pertenece a grupo empresarial','Belongs to business group')}],
          CASE j.CTRL_DECLA WHEN 'S' THEN '${L('Sí','Yes')}' WHEN 'N' THEN 'No' ELSE '' END
                                                        AS [${L('Situaciones declaradas en CERL','Situations declared in CERL')}],
          CASE j.CAL_GRUPO WHEN 'MATRIZ' THEN '${L('Matriz','Parent company')}' WHEN 'FILIAL' THEN '${L('Filial','Subsidiary')}' WHEN 'SUBSIDIARIA' THEN '${L('Subsidiaria','Affiliated')}' ELSE ISNULL(j.CAL_GRUPO,'') END
                                                        AS [${L('Calidad en el grupo','Group role')}],
          ISNULL(j.DESC_GRUPO,'')                       AS [${L('Descripción del grupo empresarial','Business group description')}],
          ISNULL(${nomPais('pe')},'')                   AS [${L('País de expedición del documento','Country of document issuance')}],
          ISNULL(dp.NOM_DEPT,'')                        AS [${L('Departamento de expedición','State/Dept. of issuance')}],
          ISNULL(mn.NOM_MUNI,'')                        AS [${L('Ciudad de expedición','City of issuance')}]
        FROM GN_TERCE t
          JOIN GN_JURID j         ON j.COD_EMPR  = t.COD_EMPR AND j.COD_TERC = t.COD_TERC
          LEFT JOIN MAE_TPDOC   td ON td.COD_TPDOC = t.COD_TPDOC
          LEFT JOIN MAE_VINC     v ON CAST(v.COD_VINC AS VARCHAR) = j.TIP_VINC
          LEFT JOIN MAE_CIIU    ci ON ci.COD_CIIU  = j.COD_CIIU
          LEFT JOIN MAE_TIP_SOCIE ts ON CAST(ts.COD_SOCIE AS VARCHAR) = j.TIP_SOCIE
          LEFT JOIN MAE_PAIS    ps ON ps.COD_PAIS  = j.COD_PAIS_SOC
          LEFT JOIN MAE_PAIS    pe ON pe.COD_PAIS  = j.COD_PAIS_EXP
          LEFT JOIN MAE_DEPT    dp ON dp.COD_DEPT  = j.COD_DEPT_EXP
          LEFT JOIN MAE_MUNI    mn ON mn.COD_MUNI  = j.COD_MPIO_EXP
        WHERE t.COD_EMPR = @COD_EMPR AND t.COD_TERC = @COD_TERC
          AND t.TIP_TERC = 'E'`),

      // ── Información financiera ────────────────────────────────────────────
      q(`SELECT
          ACT_TOTAL  AS [${L('Activos totales ($)','Total assets ($)')}],
          ING_MENS   AS [${L('Ingresos mensuales ($)','Monthly income ($)')}],
          PAS_TOTAL  AS [${L('Pasivos totales ($)','Total liabilities ($)')}],
          EGR_MENS   AS [${L('Egresos mensuales ($)','Monthly expenses ($)')}],
          PATRIMONIO AS [${L('Patrimonio ($)','Net worth ($)')}],
          OTR_ING    AS [${L('Otros ingresos ($)','Other income ($)')}]
        FROM GN_JURID_FIN
        WHERE COD_EMPR = @COD_EMPR AND COD_TERC = @COD_TERC`),

      // ── Cuentas bancarias ─────────────────────────────────────────────────
      q(`SELECT
          mb.NOM_BANCO                                  AS [${L('Entidad bancaria','Bank')}],
          ISNULL(${nomTpcta('tc')},'')                  AS [${L('Tipo de cuenta','Account type')}],
          b.NUM_CUEN                                    AS [${L('Número de cuenta','Account number')}],
          CASE b.CUEN_EXTR WHEN 'S' THEN '${L('Sí','Yes')}' ELSE 'No' END
                                                        AS [${L('¿Cuenta extranjera?','Foreign account?')}],
          ISNULL(b.NOM_ENT_EXT,'')                      AS [${L('Nombre entidad extranjera','Foreign entity name')}],
          ISNULL(b.TIP_CUE_EXT,'')                      AS [${L('Tipo cuenta extranjera','Foreign account type')}],
          ISNULL(${nomPais('px')},'')                   AS [${L('País cuenta extranjera','Foreign account country')}],
          ISNULL(b.OTR_PAIS_EXT,'')                     AS [${L('Otro país cuenta extranjera','Other foreign account country')}]
        FROM GN_TERCE_BANCO b
          LEFT JOIN MAE_BANCO mb ON mb.COD_BANCO = b.COD_BANCO
          LEFT JOIN MAE_TPCTA tc ON tc.COD_TPCTA = b.TIP_CUEN
          LEFT JOIN MAE_PAIS  px ON px.COD_PAIS  = b.COD_PAIS_EXT
        WHERE b.COD_EMPR = @COD_EMPR AND b.COD_TERC = @COD_TERC`),

      // ── Exposición política (PEP) ─────────────────────────────────────────
      q(`SELECT
          CASE MAN_RPUB WHEN 'S' THEN '${L('Sí','Yes')}' ELSE 'No' END AS [${L('¿Maneja recursos públicos?','Handles public resources?')}],
          CASE CAR_PUBL WHEN 'S' THEN '${L('Sí','Yes')}' ELSE 'No' END AS [${L('¿Ejerció cargo público?','Held public office?')}]
        FROM GN_JURID_PEP
        WHERE COD_EMPR = @COD_EMPR AND COD_TERC = @COD_TERC`),

      // ── Actividades con activos virtuales ─────────────────────────────────
      q(`SELECT
          CASE ACT_VA_FIAT  WHEN 'S' THEN '${L('Sí','Yes')}' ELSE 'No' END AS [${L('Compra/venta activos virtuales (fiat)','Purchase/sale of virtual assets (fiat)')}],
          CASE ACT_VA_VA    WHEN 'S' THEN '${L('Sí','Yes')}' ELSE 'No' END AS [${L('Compra/venta activos virtuales (VA x VA)','Purchase/sale of virtual assets (VA x VA)')}],
          CASE ACT_TRANS    WHEN 'S' THEN '${L('Sí','Yes')}' ELSE 'No' END AS [${L('Transferencia y canje de activos virtuales','Transfer and exchange of virtual assets')}],
          CASE ACT_CUSTO    WHEN 'S' THEN '${L('Sí','Yes')}' ELSE 'No' END AS [${L('Custodia de activos virtuales','Custody of virtual assets')}],
          CASE ACT_SERV_FIN WHEN 'S' THEN '${L('Sí','Yes')}' ELSE 'No' END AS [${L('Servicios financieros para PSAV','Financial services for VASPs')}],
          CASE ACT_SERV_VAP WHEN 'S' THEN '${L('Sí','Yes')}' ELSE 'No' END AS [${L('Servicios de participación VAP','VAP participation services')}],
          CASE CERT_INFO    WHEN 'S' THEN '${L('Sí','Yes')}' ELSE 'No' END AS [${L('Certifica veracidad de la información','Certifies accuracy of information')}]
        FROM GN_JURID_ACT
        WHERE COD_EMPR = @COD_EMPR AND COD_TERC = @COD_TERC`),

      // ── Representantes legales ────────────────────────────────────────────
      q(`SELECT
          CASE r.TIP_REPR WHEN 'P' THEN '${L('Principal','Principal')}' WHEN 'S' THEN '${L('Suplente','Alternate')}' ELSE r.TIP_REPR END
                                                        AS [${L('Rol','Role')}],
          r.NOM_REPR                                    AS [${L('Primer nombre','First name')}],
          r.APE_REPR                                    AS [${L('Primer apellido','Last name')}],
          ${nomTpdoc('td')}                             AS [${L('Tipo de documento','Document type')}],
          ISNULL(r.OTR_TPDOC,'')                        AS [${L('Otro tipo de documento','Other document type')}],
          r.NUM_DOCU                                    AS [${L('Número de documento','Document number')}],
          CONVERT(varchar, r.FEC_EXPE, 103)             AS [${L('Fecha de expedición','Issuance date')}],
          ISNULL(${nomPais('p')},'')                    AS [${L('País de expedición','Country of issuance')}],
          ISNULL(d.NOM_DEPT,'')                         AS [${L('Departamento de expedición','State/Dept. of issuance')}],
          ISNULL(m.NOM_MUNI,'')                         AS [${L('Ciudad de expedición','City of issuance')}],
          r.DIR_REPR                                    AS [${L('Dirección','Address')}],
          r.CEL_REPR                                    AS [${L('Celular','Mobile')}],
          r.TEL_REPR                                    AS [${L('Teléfono','Phone')}],
          r.MAIL_REPR                                   AS [${L('Email','Email')}]
        FROM GN_JURID_RL r
          LEFT JOIN MAE_TPDOC td ON td.COD_TPDOC = r.TIP_DOCU
          LEFT JOIN MAE_PAIS   p ON p.COD_PAIS   = r.COD_PAIS
          LEFT JOIN MAE_DEPT   d ON d.COD_DEPT   = r.COD_DEPT
          LEFT JOIN MAE_MUNI   m ON m.COD_MUNI   = r.COD_MPIO
        WHERE r.COD_EMPR = @COD_EMPR AND r.COD_TERC = @COD_TERC`),

      // ── Junta directiva ───────────────────────────────────────────────────
      q(`SELECT
          CASE jd.TIP_REPR WHEN 'P' THEN '${L('Principal','Principal')}' WHEN 'S' THEN '${L('Suplente','Alternate')}' ELSE jd.TIP_REPR END
                                                        AS [${L('Rol','Role')}],
          jd.TIP_MIEM                                   AS [${L('Tipo de miembro','Member type')}],
          jd.NOM_MIEM                                   AS [${L('Nombre','First name')}],
          jd.APE_MIEM                                   AS [${L('Apellido','Last name')}],
          jd.RAZ_MIEM                                   AS [${L('Razón social','Company name')}],
          ${nomTpdoc('td')}                             AS [${L('Tipo de documento','Document type')}],
          ISNULL(jd.OTR_TPDOC,'')                       AS [${L('Otro tipo de documento','Other document type')}],
          jd.NUM_DOCU                                   AS [${L('Número de documento','Document number')}],
          CONVERT(varchar, jd.FEC_EXPE, 103)            AS [${L('Fecha de expedición','Issuance date')}],
          ISNULL(${nomPais('p')},'')                    AS [${L('País','Country')}],
          ISNULL(d.NOM_DEPT,'')                         AS [${L('Departamento','State/Dept.')}],
          ISNULL(m.NOM_MUNI,'')                         AS [${L('Ciudad','City')}],
          jd.DIR_MIEM                                   AS [${L('Dirección','Address')}],
          jd.CEL_MIEM                                   AS [${L('Celular','Mobile')}],
          jd.TEL_MIEM                                   AS [${L('Teléfono','Phone')}],
          jd.MAIL_MIEM                                  AS [${L('Email','Email')}]
        FROM GN_JURID_JD jd
          LEFT JOIN MAE_TPDOC td ON td.COD_TPDOC = jd.TIP_DOCU
          LEFT JOIN MAE_PAIS   p ON p.COD_PAIS   = jd.COD_PAIS
          LEFT JOIN MAE_DEPT   d ON d.COD_DEPT   = jd.COD_DEPT
          LEFT JOIN MAE_MUNI   m ON m.COD_MUNI   = jd.COD_MPIO
        WHERE jd.COD_EMPR = @COD_EMPR AND jd.COD_TERC = @COD_TERC`),

      // ── Revisores fiscales ────────────────────────────────────────────────
      q(`SELECT
          CASE rf.TIP_REPR WHEN 'P' THEN '${L('Principal','Principal')}' WHEN 'S' THEN '${L('Suplente','Alternate')}' ELSE rf.TIP_REPR END
                                                        AS [${L('Rol','Role')}],
          CASE ISNULL(rf.TIP_PERS,'N') WHEN 'J' THEN '${L('Jurídica','Legal entity')}' ELSE '${L('Natural','Natural person')}' END
                                                        AS [${L('Tipo de persona','Person type')}],
          CASE rf.TIE_REVIS WHEN 'S' THEN '${L('Sí','Yes')}' ELSE 'No' END
                                                        AS [${L('¿Tiene revisor fiscal?','Has statutory auditor?')}],
          rf.NOM_REVI                                   AS [${L('Nombre','First name')}],
          rf.APE_REVI                                   AS [${L('Apellido','Last name')}],
          rf.RAZ_REVI                                   AS [${L('Razón social','Company name')}],
          ${nomTpdoc('td')}                             AS [${L('Tipo de documento','Document type')}],
          ISNULL(rf.OTR_TPDOC,'')                       AS [${L('Otro tipo de documento','Other document type')}],
          rf.NUM_DOCU                                   AS [${L('Número de documento','Document number')}],
          CONVERT(varchar, rf.FEC_EXPE, 103)            AS [${L('Fecha de expedición','Issuance date')}],
          rf.DIR_REVI                                   AS [${L('Dirección','Address')}],
          rf.CEL_REVI                                   AS [${L('Celular','Mobile')}],
          rf.TEL_REVI                                   AS [${L('Teléfono','Phone')}],
          rf.MAIL_REVI                                  AS [${L('Email','Email')}],
          ISNULL(rf.OBS_REVI,'')                        AS [${L('Observaciones del revisor','Auditor remarks')}],
          CASE rf.REVI_FIRMA WHEN 'S' THEN '${L('Sí','Yes')}' ELSE 'No' END
                                                        AS [${L('¿Firmó declaración?','Signed declaration?')}],
          ISNULL(rf.RAZ_FIRMA,'')                       AS [${L('Razón de no firma','Reason for not signing')}],
          ISNULL(${nomTpdoc('tdf')},'')                 AS [${L('Tipo doc. firmante','Signer document type')}],
          ISNULL(rf.NUM_DOCU_FIR,'')                    AS [${L('N° doc. firmante','Signer document number')}]
        FROM GN_JURID_RF rf
          LEFT JOIN MAE_TPDOC td  ON td.COD_TPDOC  = rf.TIP_DOCU
          LEFT JOIN MAE_TPDOC tdf ON tdf.COD_TPDOC = rf.TIP_DOCU_FIR
        WHERE rf.COD_EMPR = @COD_EMPR AND rf.COD_TERC = @COD_TERC`),

      // ── Accionistas ───────────────────────────────────────────────────────
      q(`SELECT
          CASE ISNULL(ac.TIP_PERS,'N') WHEN 'J' THEN '${L('Jurídica','Legal entity')}' ELSE '${L('Natural','Natural person')}' END
                                                        AS [${L('Tipo de persona','Person type')}],
          ac.NOM_ACCI                                   AS [${L('Nombre','First name')}],
          ac.APE_ACCI                                   AS [${L('Apellido','Last name')}],
          ac.RAZ_ACCI                                   AS [${L('Razón social','Company name')}],
          ${nomTpdoc('td')}                             AS [${L('Tipo de documento','Document type')}],
          ISNULL(ac.OTR_TPDOC,'')                       AS [${L('Otro tipo de documento','Other document type')}],
          ac.NUM_DOCU                                   AS [${L('Número de documento','Document number')}],
          CONVERT(varchar, ac.FEC_EXPE, 103)            AS [${L('Fecha de expedición','Issuance date')}],
          ISNULL(${nomPais('p')},'')                    AS [${L('País','Country')}],
          ISNULL(d.NOM_DEPT,'')                         AS [${L('Departamento','State/Dept.')}],
          ISNULL(m.NOM_MUNI,'')                         AS [${L('Ciudad','City')}],
          ac.DIR_ACCI                                   AS [${L('Dirección','Address')}],
          ac.CEL_ACCI                                   AS [${L('Celular','Mobile')}],
          ac.TEL_ACCI                                   AS [${L('Teléfono','Phone')}],
          ac.MAIL_ACCI                                  AS [${L('Email','Email')}],
          ac.PCT_PART                                   AS [${L('Porcentaje de participación (%)','Ownership percentage (%)')}]
        FROM GN_JURID_AC ac
          LEFT JOIN MAE_TPDOC td ON td.COD_TPDOC = ac.TIP_DOCU
          LEFT JOIN MAE_PAIS   p ON p.COD_PAIS   = ac.COD_PAIS
          LEFT JOIN MAE_DEPT   d ON d.COD_DEPT   = ac.COD_DEPT
          LEFT JOIN MAE_MUNI   m ON m.COD_MUNI   = ac.COD_MPIO
        WHERE ac.COD_EMPR = @COD_EMPR AND ac.COD_TERC = @COD_TERC`),

      // ── Beneficiarios finales ─────────────────────────────────────────────
      q(`SELECT
          CASE bf.TIP_BENE WHEN 'N' THEN '${L('Natural','Natural person')}' WHEN 'J' THEN '${L('Jurídica','Legal entity')}' ELSE bf.TIP_BENE END
                                                        AS [${L('Tipo','Type')}],
          bf.NOM_BENE                                   AS [${L('Nombre','First name')}],
          bf.APE_BENE                                   AS [${L('Apellido','Last name')}],
          bf.RAZ_BENE                                   AS [${L('Razón social','Company name')}],
          ${nomTpdoc('td')}                             AS [${L('Tipo de documento','Document type')}],
          ISNULL(bf.OTR_TPDOC,'')                       AS [${L('Otro tipo de documento','Other document type')}],
          bf.NUM_DOCU                                   AS [${L('Número de documento','Document number')}],
          CONVERT(varchar, bf.FEC_EXPE, 103)            AS [${L('Fecha de expedición','Issuance date')}],
          ISNULL(${nomPais('p')},'')                    AS [${L('País','Country')}],
          ISNULL(d.NOM_DEPT,'')                         AS [${L('Departamento','State/Dept.')}],
          ISNULL(m.NOM_MUNI,'')                         AS [${L('Ciudad','City')}],
          bf.DIR_BENE                                   AS [${L('Dirección','Address')}],
          bf.TEL_BENE                                   AS [${L('Teléfono','Phone')}],
          bf.MAIL_BENE                                  AS [${L('Email','Email')}]
        FROM GN_JURID_BF bf
          LEFT JOIN MAE_TPDOC td ON td.COD_TPDOC = bf.TIP_DOCU
          LEFT JOIN MAE_PAIS   p ON p.COD_PAIS   = bf.COD_PAIS
          LEFT JOIN MAE_DEPT   d ON d.COD_DEPT   = bf.COD_DEPT
          LEFT JOIN MAE_MUNI   m ON m.COD_MUNI   = bf.COD_MPIO
        WHERE bf.COD_EMPR = @COD_EMPR AND bf.COD_TERC = @COD_TERC`),

      // ── Cumplimiento LAFT ─────────────────────────────────────────────────
      q(`SELECT
          CASE c.TIE_NORM WHEN 'S' THEN '${L('Sí','Yes')}' ELSE 'No' END
                                                        AS [${L('¿Sujeta a normatividad LA/FT?','Subject to AML/CTF regulations?')}],
          ISNULL(c.NORM_LAFT,'')                        AS [${L('Normativa LA/FT aplicable','Applicable AML/CTF regulation')}],
          ISNULL(c.DESC_NORM,'')                        AS [${L('Descripción de la normativa','Regulation description')}],
          CASE c.TIE_JUNTA WHEN 'S' THEN '${L('Sí','Yes')}' ELSE 'No' END
                                                        AS [${L('¿Tiene sistema implementado?','Has implemented system?')}],
          ISNULL(${nomSist('sp')}, ISNULL(c.SIS_PREVE,''))
                                                        AS [${L('Sistema de prevención','Prevention system')}],
          ISNULL(c.OTR_PREVE,'')                        AS [${L('Otro sistema de prevención','Other prevention system')}],
          CASE c.TIP_REPR WHEN 'P' THEN '${L('Principal','Principal')}' WHEN 'S' THEN '${L('Suplente','Alternate')}' ELSE '' END
                                                        AS [${L('Rol del oficial','Official role')}],
          ISNULL(c.NOM_RESP,'')                         AS [${L('Nombre del oficial','Official first name')}],
          ISNULL(c.APE_RESP,'')                         AS [${L('Apellido del oficial','Official last name')}],
          ISNULL(${nomTpdoc('td')},'')                  AS [${L('Tipo de documento','Document type')}],
          ISNULL(c.OTR_TPDOC,'')                        AS [${L('Otro tipo de documento','Other document type')}],
          ISNULL(c.NUM_DOCU,'')                         AS [${L('Número de documento','Document number')}],
          ISNULL(${nomPais('p')},'')                    AS [${L('País del oficial','Official country')}],
          ISNULL(c.DIR_RESP,'')                         AS [${L('Dirección','Address')}],
          ISNULL(c.CEL_RESP,'')                         AS [${L('Celular','Mobile')}],
          ISNULL(c.TEL_RESP,'')                         AS [${L('Teléfono','Phone')}],
          ISNULL(c.MAIL_RESP,'')                        AS [${L('Email','Email')}]
        FROM GN_JURID_CUMP c
          LEFT JOIN MAE_TPDOC     td ON td.COD_TPDOC = c.TIP_DOCU
          LEFT JOIN MAE_SIST_PREV sp ON CAST(sp.COD_SIST AS VARCHAR) = c.SIS_PREVE
          LEFT JOIN MAE_PAIS       p ON p.COD_PAIS   = c.COD_PAIS
        WHERE c.COD_EMPR = @COD_EMPR AND c.COD_TERC = @COD_TERC`),

      // ── Países de operación ───────────────────────────────────────────────
      q(`SELECT
          ISNULL(${nomPais('p')},'') AS [${L('País','Country')}]
        FROM GN_JURID_PAIS gp
          LEFT JOIN MAE_PAIS p ON p.COD_PAIS = gp.COD_PAIS
        WHERE gp.COD_EMPR = @COD_EMPR AND gp.COD_TERC = @COD_TERC`),

      // ── Firma del representante legal ─────────────────────────────────────
      q(`SELECT
          ISNULL(f.NOM_FIRM,'')                         AS [${L('Nombre del firmante','Signer first name')}],
          ISNULL(f.APE_FIRM,'')                         AS [${L('Apellido del firmante','Signer last name')}],
          ISNULL(${nomTpdoc('td')},'')                  AS [${L('Tipo de documento','Document type')}],
          ISNULL(f.NUM_DOCU,'')                         AS [${L('Número de documento','Document number')}],
          CONVERT(varchar, f.FEC_FIRMA, 103)            AS [${L('Fecha de firma','Signature date')}]
        FROM GN_JURID_FIRMA f
          LEFT JOIN MAE_TPDOC td ON td.COD_TPDOC = f.TIP_DOCU
        WHERE f.COD_EMPR = @COD_EMPR AND f.COD_TERC = @COD_TERC`),

      // ── Documentos adjuntos ───────────────────────────────────────────────
      q(`SELECT
          d.TIP_DOC                                     AS [${L('Tipo de documento','Document type')}],
          ISNULL(d.NOM_DOC,'')                          AS [${L('Nombre del documento','Document name')}],
          ISNULL(d.NOM_ARCH,'')                         AS [${L('Nombre del archivo','File name')}],
          CONVERT(varchar, d.FEC_CARG, 103)             AS [${L('Fecha de carga','Upload date')}],
          '/api/documentos/' + CAST(t.NUM_IDEN AS VARCHAR) + '/' + d.TIP_DOC
                                                        AS [URL de descarga]
        FROM GN_TERCE_DOC d
          JOIN GN_TERCE t ON t.COD_EMPR = d.COD_EMPR AND t.COD_TERC = d.COD_TERC
        WHERE d.COD_EMPR = @COD_EMPR AND d.COD_TERC = @COD_TERC`),
    ]);

    // ── Construir libro Excel ─────────────────────────────────────────────────
    const wb    = new ExcelJS.Workbook();
    wb.creator  = 'SAGRILAFT Sistema';
    wb.created  = new Date();

    const PRIMARY      = '0C6B8C';
    const HEADER_BG    = 'E5F5FA';
    const ACCENT       = '20A7C9';
    const CURRENCY_FMT = '#,##0.00';
    const NO_DATA_MSG  = L('No se registraron datos para esta sección.', 'No data recorded for this section.');

    const _hasVal = v => v !== null && v !== undefined && String(v).trim() !== '';

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
        const nr = ws.addRow([NO_DATA_MSG]);
        nr.getCell(1).font = { italic: true, color: { argb: 'FF888888' } };
        return;
      }
      const allCols = Object.keys(rows[0]);

      if (rows.length === 1) {
        // Single-record: key-value layout — skip rows whose value is empty
        const filledCols = allCols.filter(c => _hasVal(rows[0][c]));
        if (filledCols.length === 0) {
          ws.getColumn(1).width = 40;
          ws.mergeCells('A1:B1');
          const tc = ws.getCell('A1');
          tc.value = name;
          tc.font  = { bold: true, size: 13, color: { argb: 'FF' + PRIMARY } };
          tc.alignment = { horizontal: 'center' };
          tc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + HEADER_BG } };
          ws.addRow([NO_DATA_MSG]).getCell(1).font = { italic: true, color: { argb: 'FF888888' } };
          return;
        }
        ws.getColumn(1).width = 38;
        ws.getColumn(2).width = 42;
        ws.mergeCells('A1:B1');
        const tc = ws.getCell('A1');
        tc.value = name;
        tc.font  = { bold: true, size: 13, color: { argb: 'FF' + PRIMARY } };
        tc.alignment = { horizontal: 'center' };
        tc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + HEADER_BG } };

        const hRow = ws.addRow([L('Campo', 'Field'), L('Valor', 'Value')]);
        hRow.eachCell(cell => {
          cell.font  = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + ACCENT } };
          cell.alignment = { horizontal: 'center' };
        });

        filledCols.forEach((col, i) => {
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
        // Multi-record: table layout — keep only columns with at least one non-empty value
        const cols = allCols.filter(c => rows.some(r => _hasVal(r[c])));
        if (cols.length === 0) {
          ws.getColumn(1).width = 40;
          ws.mergeCells('A1:B1');
          const tc = ws.getCell('A1');
          tc.value = name;
          tc.font  = { bold: true, size: 13, color: { argb: 'FF' + PRIMARY } };
          tc.alignment = { horizontal: 'center' };
          tc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + HEADER_BG } };
          ws.addRow([NO_DATA_MSG]).getCell(1).font = { italic: true, color: { argb: 'FF888888' } };
          return;
        }
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

    const CURRENCY_COLS = [
      L('Activos totales ($)','Total assets ($)'),
      L('Ingresos mensuales ($)','Monthly income ($)'),
      L('Pasivos totales ($)','Total liabilities ($)'),
      L('Egresos mensuales ($)','Monthly expenses ($)'),
      L('Patrimonio ($)','Net worth ($)'),
      L('Otros ingresos ($)','Other income ($)'),
    ];

    addSheetJ(L('Datos de la Empresa','Company Information'),             empresa);
    addSheetJ(L('Información Financiera','Financial Information'),        financiera, CURRENCY_COLS);
    addSheetJ(L('Cuentas Bancarias','Bank Accounts'),                     bancaria);
    addSheetJ(L('PEP','PEP'),                                             pep);
    addSheetJ(L('Act. Activos Virtuales','Virtual Asset Activities'), act);
    addSheetJ(L('Representantes Legales','Legal Representatives'),        rl);
    addSheetJ(L('Junta Directiva','Board of Directors'),                  jd);
    addSheetJ(L('Revisores Fiscales','Statutory Auditors'),               rf);
    addSheetJ(L('Accionistas','Shareholders'),                            ac);
    addSheetJ(L('Beneficiarios Finales','Ultimate Beneficial Owners'),    bf);
    addSheetJ(L('Cumplimiento LAFT','AML/CTF Compliance'),                cump);
    addSheetJ(L('Países de Operación','Countries of Operation'),          paises);
    addSheetJ(L('Firma del Representante','Representative Signature'),    firma);

    // ── Hoja de documentos con hipervínculo ───────────────────────────────────
    const URL_COL      = 'URL de descarga';
    const FILE_COL     = L('Nombre del archivo', 'File name');
    const DOC_SHEET    = L('Documentos Adjuntos', 'Attached Documents');
    const LINK_HEADER  = L('Acceder al archivo', 'Open file');

    if (documentos.length > 0) {
      const wsDoc  = wb.addWorksheet(DOC_SHEET);
      const dCols  = Object.keys(documentos[0]).filter(c => c !== URL_COL);
      const allCols = [...dCols, LINK_HEADER];

      wsDoc.mergeCells(1, 1, 1, allCols.length);
      const tCell = wsDoc.getCell(1, 1);
      tCell.value = DOC_SHEET;
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
        values.push(doc[FILE_COL] || '');
        const dRow = wsDoc.addRow(values);
        if (ri % 2 === 0) {
          dRow.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + HEADER_BG } };
          });
        }
        const urlRel = doc[URL_COL] || '';
        if (urlRel && doc[FILE_COL]) {
          const linkCell = dRow.getCell(allCols.length);
          linkCell.value = { text: doc[FILE_COL], hyperlink: baseUrl + urlRel };
          linkCell.font  = { color: { argb: 'FF0563C1' }, underline: true };
        }
      });

      allCols.forEach((col, ci) => {
        wsDoc.getColumn(ci + 1).width = Math.min(Math.max(col.length + 4, 16), 45);
      });
    } else {
      const wsDoc = wb.addWorksheet(DOC_SHEET);
      wsDoc.addRow([L('Sin documentos adjuntos registrados.', 'No attached documents registered.')]);
    }

    // ── Guardar copia en disco y enviar ───────────────────────────────────────
    const RAZON_KEY = L('Razón social', 'Company name');
    const nomComp = (empresa[0]?.[RAZON_KEY] || `TERC_${codTerc}`)
      .replace(/[^a-zA-Z0-9_\-\s]/g, '').trim().replace(/\s+/g, '_');
    const filename = `SAGRILAFT_Juridica_${nomComp}_${new Date().toISOString().slice(0,10)}.xlsx`;

    const buf = await wb.xlsx.writeBuffer();
    try {
      const expDir = path.join(UPLOAD_DIR, 'exports', String(codTerc));
      fs.mkdirSync(expDir, { recursive: true });
      fs.writeFileSync(path.join(expDir, filename), buf);
    } catch (saveErr) {
      console.warn('[exportar-excel] No se pudo guardar copia local:', saveErr.message);
    }

    res.setHeader('Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buf);

  } catch (err) {
    console.error('GET /api/exportar-excel:', err);
    _responderError(res, err, req, 'exportar-excel');
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
  // Código de edición: viene en cabecera X-Codigo-Edicion (no en URL para evitar logs)
  const codigoEdicion = req.headers['x-codigo-edicion'] || '';
  try {
    const pool = await getPool();

    // ── Verificar acceso: código de edición o sesión admin ───────────────────
    const editRow = await pool.request()
      .input('COD_EMPR', sql.SmallInt,    COD_EMPR)
      .input('NUM_IDEN', sql.VarChar(20), numIden)
      .query(`SELECT COD_EDIT FROM GN_TERCE WHERE COD_EMPR=@COD_EMPR AND NUM_IDEN=@NUM_IDEN`);
    if (editRow.recordset.length) {
      const codEdit = (editRow.recordset[0].COD_EDIT || '').trim();
      if (codEdit) {
        if (!codigoEdicion)
          return res.status(401).json({ error: 'codigoRequerido', mensaje: 'Código de edición requerido.' });
        if (_hashCodigo(codigoEdicion.trim()) !== codEdit)
          return res.status(403).json({ error: 'codigoInvalido', mensaje: 'Código de edición incorrecto.' });
      } else {
        if (!req.session || !req.session.isAdmin)
          return res.status(401).json({ error: 'adminRequerido', mensaje: 'Este registro requiere sesión de administrador para editar.' });
      }
    }
    // ── Fin verificación ─────────────────────────────────────────────────────

    const r    = () => pool.request()
      .input('COD_EMPR', sql.SmallInt, COD_EMPR)
      .input('NUM_IDEN',  sql.VarChar(20), numIden);

    const basica = await r().query(`
      SELECT t.COD_TERC, t.TIP_TERC, t.COD_TPDOC, t.OTR_TPDOC, t.NUM_IDEN, t.DIG_VERI,
             t.NOM_COMP, t.NOM_TERC, t.SEG_NOMB, t.APE_TERC, t.SEG_APEL,
             t.DIR_TERC, t.TEL_TERC, t.TEL_TERC2, t.DIR_MAIL,
             j.TIP_VINC AS COD_VINC, j.OTR_VINC, j.MAIL_SARL,
             j.COD_CIIU, j.OTR_CIIU, j.URL_WEB,
             j.UBIC_SOC, j.COD_PAIS_SOC, j.OTR_PAIS_SOC, j.COD_PAIS_ORI, j.TIP_EMPR, j.GRUP_EMPR,
             j.TIP_SOCIE, j.OTR_SOCIE,
             j.COD_PAIS_EXP, j.OTR_PAIS_EXP, j.COD_DEPT_EXP, j.COD_MPIO_EXP
      FROM GN_TERCE t
      LEFT JOIN GN_JURID j ON j.COD_EMPR=t.COD_EMPR AND j.COD_TERC=t.COD_TERC
      WHERE t.COD_EMPR=@COD_EMPR AND t.NUM_IDEN=@NUM_IDEN`);

    if (!basica.recordset.length) return res.status(404).json({ error: 'Registro no encontrado.' });
    const row      = basica.recordset[0];
    const COD_TERC = row.COD_TERC;
    const rC       = () => pool.request()
      .input('COD_EMPR', sql.SmallInt, COD_EMPR)
      .input('COD_TERC', sql.BigInt, COD_TERC);

    // ── Rama Persona Natural — tablas GN_NATUR y relacionadas ────────────────
    if (row.TIP_TERC === 'N') {
      const [naturRes, naturFinRes, banRes, pepRes, actRes] = await Promise.all([
        rC().query(`SELECT TIP_VINC AS COD_VINC, MAIL_SARL, COD_NACIO, OTR_NACIO, ACT_PRINC,
                          COD_CIIU, OTR_CIIU, CONVERT(varchar(10),FEC_EXPE,23) AS FEC_EXPE,
                          COD_PAIS_EXP, OTR_PAIS_EXP, COD_DEPT_EXP, COD_MPIO_EXP,
                          PART_SOC, RAZ_SOC, TIP_DOC_SOC, NUM_DOC_SOC
                   FROM GN_NATUR WHERE COD_EMPR=@COD_EMPR AND COD_TERC=@COD_TERC`),
        rC().query(`SELECT ACT_TOTAL, ING_MENS, PAS_TOTAL, EGR_MENS, PATRIMONIO, OTR_ING
                   FROM GN_NATUR_FIN WHERE COD_EMPR=@COD_EMPR AND COD_TERC=@COD_TERC`),
        rC().query(`SELECT COD_BANCO, OTR_BANCO, TIP_CUEN, OTR_CUEN, NUM_CUEN, CUEN_EXTR,
                          NOM_ENT_EXT, TIP_CUE_EXT, COD_PAIS_EXT, OTR_PAIS_EXT, CUENTAS_EXT
                   FROM GN_TERCE_BANCO WHERE COD_EMPR=@COD_EMPR AND COD_TERC=@COD_TERC`),
        rC().query(`SELECT MAN_RPUB, CAR_PUBL
                   FROM GN_NATUR_PEP WHERE COD_EMPR=@COD_EMPR AND COD_TERC=@COD_TERC`),
        rC().query(`SELECT OPER_VA, ACT_VA_FIAT, ACT_VA_VA, ACT_TRANS, ACT_CUSTO,
                          ACT_SERV_FIN, ACT_SERV_VAP, CERT_INFO
                   FROM GN_NATUR_ACT WHERE COD_EMPR=@COD_EMPR AND COD_TERC=@COD_TERC`),
      ]);

      const nRow = naturRes.recordset[0] || {};
      return res.json({
        TIP_TERC: 'N',
        COD_TERC,
        basica: {
          COD_TPDOC: row.COD_TPDOC, OTR_TPDOC: row.OTR_TPDOC,
          NUM_IDEN: row.NUM_IDEN,
          DIR_TERC: row.DIR_TERC,   TEL_TERC: row.TEL_TERC,
          TEL_TERC2: row.TEL_TERC2, DIR_MAIL: row.DIR_MAIL,
          COD_VINC: nRow.COD_VINC,  // se lee desde GN_NATUR
        },
        naturBasica: {
          NOM_TERC:    row.NOM_TERC,     SEG_NOMB:    row.SEG_NOMB,
          APE_TERC:    row.APE_TERC,     SEG_APEL:    row.SEG_APEL,
          MAIL_SARL:   nRow.MAIL_SARL,   COD_NACIO:   nRow.COD_NACIO,   OTR_NACIO: nRow.OTR_NACIO,
          ACT_PRINC:   nRow.ACT_PRINC,   COD_CIIU:    nRow.COD_CIIU,    OTR_CIIU:  nRow.OTR_CIIU,
          FEC_EXPE:    nRow.FEC_EXPE,    COD_PAIS_EXP: nRow.COD_PAIS_EXP,
          OTR_PAIS_EXP: nRow.OTR_PAIS_EXP,
          COD_DEPT_EXP: nRow.COD_DEPT_EXP, COD_MPIO_EXP: nRow.COD_MPIO_EXP,
        },
        financiera:  naturFinRes.recordset[0] || {},
        bancaria:    banRes.recordset.map(b => ({ ...b, cuentasExt: b.CUENTAS_EXT ? (() => { try { return JSON.parse(b.CUENTAS_EXT); } catch(e) { return []; } })() : [] })),
        pep:         pepRes.recordset[0]  || { MAN_RPUB: null, CAR_PUBL: null },
        actividades: actRes.recordset[0]  || {},
        beneficiariosN: {
          PART_SOC:    nRow.PART_SOC    || 'N',
          RAZ_SOC:     nRow.RAZ_SOC     || null,
          TIP_DOC_SOC: nRow.TIP_DOC_SOC || null,
          NUM_DOC_SOC: nRow.NUM_DOC_SOC || null,
        },
      });
    }
    // ── Rama Persona Jurídica (comportamiento existente) ─────────────────────

    const rlRes  = await rC().query(`
      SELECT TIP_REPR, NOM_REPR, APE_REPR, TIP_DOCU, OTR_TPDOC, NUM_DOCU,
             CONVERT(varchar(10),FEC_EXPE,23) AS FEC_EXPE,
             COD_PAIS, OTR_PAIS, COD_DEPT, COD_MPIO, DIR_REPR, CEL_REPR, TEL_REPR, MAIL_REPR
      FROM GN_JURID_RL WHERE COD_EMPR=@COD_EMPR AND COD_TERC=@COD_TERC ORDER BY TIP_REPR`);

    const paisesRes = await rC().query(
      `SELECT COD_PAIS, OTR_PAIS FROM GN_JURID_PAIS WHERE COD_EMPR=@COD_EMPR AND COD_TERC=@COD_TERC`);

    const cumpRes = await rC().query(`
      SELECT REL_GRUPO, NORM_LAFT, SIS_PREVE, DESC_NORM, TIE_JUNTA,
             TIP_REPR, TIP_DOCU, NUM_DOCU,
             CONVERT(varchar(10),FEC_EXPE,23) AS FEC_EXPE,
             NOM_RESP, APE_RESP, RAZ_RESP, COD_PAIS, OTR_PAIS, COD_DEPT, COD_MPIO,
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
             COD_PAIS, OTR_PAIS, COD_DEPT, COD_MPIO, DIR_REVI, CEL_REVI, TEL_REVI, MAIL_REVI,
             OBS_REVI, TIP_PERS, OTR_TPDOC,
             REVI_FIRMA, RAZ_FIRMA, TIP_DOCU_FIR, OTR_TPDOC_FIR, NUM_DOCU_FIR
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
      SELECT COD_BANCO, OTR_BANCO, TIP_CUEN, OTR_CUEN, NUM_CUEN, CUEN_EXTR,
             NOM_ENT_EXT, TIP_CUE_EXT, COD_PAIS_EXT, OTR_PAIS_EXT, CUENTAS_EXT
      FROM GN_TERCE_BANCO WHERE COD_EMPR=@COD_EMPR AND COD_TERC=@COD_TERC`);

    const pepRes = await rC().query(`
      SELECT MAN_RPUB, CAR_PUBL FROM GN_JURID_PEP
      WHERE COD_EMPR=@COD_EMPR AND COD_TERC=@COD_TERC`);

    const actRes = await rC().query(`
      SELECT OPER_VA, ACT_VA_FIAT, ACT_VA_VA, ACT_TRANS, ACT_CUSTO, ACT_SERV_FIN, ACT_SERV_VAP, CERT_INFO
      FROM GN_JURID_ACT WHERE COD_EMPR=@COD_EMPR AND COD_TERC=@COD_TERC`);

    const bfRes  = await rC().query(`
      SELECT TIP_BENE, NOM_BENE, APE_BENE, RAZ_BENE, TIP_DOCU, NUM_DOCU,
             CONVERT(varchar(10),FEC_EXPE,23) AS FEC_EXPE,
             COD_PAIS, OTR_PAIS, COD_DEPT, COD_MPIO, DIR_BENE, TEL_BENE, MAIL_BENE
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
      TIP_TERC: row.TIP_TERC || 'J',
      COD_TERC,
      basica: {
        COD_TPDOC: row.COD_TPDOC, NUM_IDEN: row.NUM_IDEN,    DIG_VERI: row.DIG_VERI,
        NOM_COMP:  row.NOM_COMP,  DIR_TERC:  row.DIR_TERC,   TEL_TERC:  row.TEL_TERC,
        TEL_TERC2: row.TEL_TERC2, DIR_MAIL:  row.DIR_MAIL,   COD_VINC:  row.COD_VINC,
        OTR_VINC:  row.OTR_VINC,  MAIL_SARL: row.MAIL_SARL,
        COD_CIIU:  row.COD_CIIU,  OTR_CIIU:  row.OTR_CIIU,   URL_WEB:  row.URL_WEB,
        COD_PAIS_EXP: row.COD_PAIS_EXP, OTR_PAIS_EXP: row.OTR_PAIS_EXP,
        COD_DEPT_EXP: row.COD_DEPT_EXP, COD_MPIO_EXP: row.COD_MPIO_EXP,
      },
      sociedad: {
        UBIC_SOC:          row.UBIC_SOC,
        COD_PAIS_SOC:      row.COD_PAIS_SOC,
        OTR_PAIS_SOC:      row.UBIC_SOC === 'E' ? (row.OTR_PAIS_SOC || '') : '',
        COD_PAIS_ORIG_SOC: row.UBIC_SOC === 'SC' ? (row.COD_PAIS_ORI ? String(row.COD_PAIS_ORI) : null) : null,
        OTR_PAIS_ORIG_SOC: row.UBIC_SOC === 'SC' ? (row.OTR_PAIS_SOC || '') : '',
        TIP_EMPR: row.TIP_EMPR, GRUP_EMPR: row.GRUP_EMPR,
        TIP_SOCIE: row.TIP_SOCIE, OTR_SOCIE: row.OTR_SOCIE,
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
      bancaria:       banRes.recordset.map(b => ({ ...b, cuentasExt: b.CUENTAS_EXT ? (() => { try { return JSON.parse(b.CUENTAS_EXT); } catch(e) { return []; } })() : [] })),
      pep:            pepRes.recordset[0] || { MAN_RPUB: 'N', CAR_PUBL: 'N' },
      actividades:    actRes.recordset[0] || {},
      beneficiarios:  bfRes.recordset,
      firma:          firmaRes.recordset[0] || {},
    });

  } catch (err) {
    console.error('GET /api/cargar-completo:', err);
    _responderError(res, err, req);
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
  const codigoEdicion = req.headers['x-codigo-edicion'] || '';
  if (!d.NUM_IDEN || !d.NOM_COMP) {
    return res.status(400).json({ error: 'Campos obligatorios faltantes: NUM_IDEN, NOM_COMP' });
  }

  // Validación server-side (idéntica al POST de creación)
  const errVal = _validarCampos([
    () => _validarTexto(d.NUM_IDEN,   'Número de identificación', 20),
    () => _validarTexto(d.NOM_COMP,   'Razón social',            240),
    () => _validarTexto(d.DIR_TERC,   'Dirección',               120),
    () => _validarTexto(d.DIR_MAIL,   'Email corporativo',       150),
    () => _validarTexto(d.MAIL_SARL,  'Email SAGRILAFT',           150),
    () => _validarTexto(d.URL_WEB,    'Sitio web',               200),
    () => d.firma?.FEC_FIRMA ? _validarFecha(d.firma.FEC_FIRMA, 'Fecha de firma') : null,
  ]);
  if (errVal.length)
    return res.status(400).json({ error: 'Errores de validación', detalles: errVal });

  const toInt  = v => { if (v === null || v === undefined || v === '' || v === 'NA') return null; const n = parseInt(v, 10); return isNaN(n) ? null : n; };
  const toDec  = v => (v !== null && v !== undefined && v !== '') ? parseFloat(v) : null;
  const toDate = v => v ? new Date(v) : null;
  const toChar = v => v || null;

  let pool, transaction;
  try {
    // ── Verificar código de edición antes de la transacción ──────────────────
    pool = await getPool();
    const editRow = await pool.request()
      .input('COD_EMPR', sql.SmallInt,    COD_EMPR)
      .input('NUM_IDEN', sql.VarChar(20), d.NUM_IDEN)
      .query(`SELECT COD_EDIT FROM GN_TERCE WHERE COD_EMPR=@COD_EMPR AND NUM_IDEN=@NUM_IDEN`);
    if (editRow.recordset.length) {
      const codEdit = (editRow.recordset[0].COD_EDIT || '').trim();
      if (codEdit) {
        if (!codigoEdicion)
          return res.status(401).json({ error: 'codigoRequerido', mensaje: 'Código de edición requerido.' });
        if (_hashCodigo(codigoEdicion.trim()) !== codEdit)
          return res.status(403).json({ error: 'codigoInvalido', mensaje: 'Código de edición incorrecto.' });
      } else {
        if (!req.session || !req.session.isAdmin)
          return res.status(401).json({ error: 'adminRequerido', mensaje: 'Este registro requiere sesión de administrador para editar.' });
      }
    }
    // ── Fin verificación ─────────────────────────────────────────────────────
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
      .input('TIP_VINC',    sql.VarChar(40),  toChar(d.COD_VINC))
      .input('OTR_VINC',    sql.VarChar(255), toChar(d.OTR_VINC))
      .input('MAIL_SARL',   sql.VarChar(150), toChar(d.MAIL_SARL))
      .input('COD_CIIU',    sql.VarChar(10),  toChar(d.COD_CIIU))
      .input('OTR_CIIU',    sql.VarChar(255), toChar(d.OTR_CIIU))
      .input('URL_WEB',     sql.VarChar(200), toChar(d.URL_WEB))
      .input('TIP_SOCIE',   sql.VarChar(10),  toChar(d.TIP_SOCIE))
      .input('OTR_SOCIE',   sql.VarChar(255), toChar(d.OTR_SOCIE))
      .input('COD_PAIS_ORI',sql.Int,          toInt(d.COD_PAIS_ORIG_SOC === 'OTRO' ? null : d.COD_PAIS_ORIG_SOC))
      .input('UBIC_SOC',    sql.Char(1),      toChar(d.UBIC_SOC))
      .input('COD_PAIS_SOC',  sql.Int,          toInt(d.COD_PAIS_SOC))
      .input('OTR_PAIS_SOC',  sql.VarChar(100), toChar(d.UBIC_SOC === 'SC' ? d.OTR_PAIS_ORIG_SOC : d.OTR_PAIS_SOC))
      .input('TIP_EMPR',      sql.VarChar(10),  toChar(d.TIP_EMPR))
      .input('GRUP_EMPR',     sql.Char(1),      toChar(d.GRUP_EMPR))
      .input('CTRL_DECLA',    sql.Char(1),      toChar(d.CTRL_DECLA))
      .input('CAL_GRUPO',     sql.VarChar(20),  toChar(d.CAL_GRUPO))
      .input('DESC_GRUPO',    sql.VarChar(sql.MAX), toChar(d.DESC_GRUPO))
      .input('COD_PAIS_EXP',  sql.Int,          toInt(d.COD_PAIS_EXP))
      .input('OTR_PAIS_EXP',  sql.VarChar(100), toChar(d.OTR_PAIS_EXP))
      .input('COD_DEPT_EXP',  sql.Int,          toInt(d.COD_DEPT_EXP))
      .input('COD_MPIO_EXP',  sql.Int,          toInt(d.COD_MPIO_EXP))
      .query(`UPDATE GN_JURID SET TIP_VINC=@TIP_VINC,OTR_VINC=@OTR_VINC,
              MAIL_SARL=@MAIL_SARL,COD_CIIU=@COD_CIIU,OTR_CIIU=@OTR_CIIU,
              URL_WEB=@URL_WEB,TIP_SOCIE=@TIP_SOCIE,OTR_SOCIE=@OTR_SOCIE,
              COD_PAIS_ORI=@COD_PAIS_ORI,UBIC_SOC=@UBIC_SOC,
              COD_PAIS_SOC=@COD_PAIS_SOC,OTR_PAIS_SOC=@OTR_PAIS_SOC,
              TIP_EMPR=@TIP_EMPR,GRUP_EMPR=@GRUP_EMPR,
              CTRL_DECLA=@CTRL_DECLA,CAL_GRUPO=@CAL_GRUPO,DESC_GRUPO=@DESC_GRUPO,
              COD_PAIS_EXP=@COD_PAIS_EXP,OTR_PAIS_EXP=@OTR_PAIS_EXP,
              COD_DEPT_EXP=@COD_DEPT_EXP,COD_MPIO_EXP=@COD_MPIO_EXP
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
          .input('COD_PAIS', sql.Int,          toInt(p.COD_PAIS))
          .input('OTR_PAIS', sql.VarChar(100), toChar(p.OTR_PAIS))
          .input('COD_DEPT', sql.Int,          toInt(p.COD_DEPT))
          .input('COD_MPIO', sql.Int,          toInt(p.COD_MPIO))
          .input('DIR_REPR', sql.VarChar(120), toChar(p.DIR_REPR))
          .input('CEL_REPR', sql.VarChar(30),  toChar(p.CEL_REPR))
          .input('TEL_REPR', sql.VarChar(30),  toChar(p.TEL_REPR))
          .input('MAIL_REPR',sql.VarChar(100), toChar(p.MAIL_REPR))
          .input('OTR_TPDOC',sql.VarChar(100), toChar(p.OTR_TPDOC))
          .query(`INSERT INTO GN_JURID_RL(COD_EMPR,COD_TERC,TIP_REPR,NOM_REPR,APE_REPR,TIP_DOCU,OTR_TPDOC,
                  NUM_DOCU,FEC_EXPE,COD_PAIS,OTR_PAIS,COD_DEPT,COD_MPIO,DIR_REPR,CEL_REPR,TEL_REPR,MAIL_REPR)
                  VALUES(@COD_EMPR,@COD_TERC,@TIP_REPR,@NOM_REPR,@APE_REPR,@TIP_DOCU,@OTR_TPDOC,
                  @NUM_DOCU,@FEC_EXPE,@COD_PAIS,@OTR_PAIS,@COD_DEPT,@COD_MPIO,@DIR_REPR,@CEL_REPR,@TEL_REPR,@MAIL_REPR)`);
      }
    }

    // 4. GN_JURID_PAIS
    await del('GN_JURID_PAIS');
    for (const p of (Array.isArray(d.paises)?d.paises:[])) {
      if (!p.COD_PAIS && !p.OTR_PAIS) continue;
      await r().input('COD_EMPR',sql.SmallInt,COD_EMPR).input('COD_TERC',sql.BigInt,COD_TERC)
               .input('COD_PAIS',sql.Int,p.COD_PAIS === 'OTRO' ? null : toInt(p.COD_PAIS))
               .input('OTR_PAIS',sql.VarChar(100),toChar(p.OTR_PAIS))
               .query(`INSERT INTO GN_JURID_PAIS(COD_EMPR,COD_TERC,COD_PAIS,OTR_PAIS)VALUES(@COD_EMPR,@COD_TERC,@COD_PAIS,@OTR_PAIS)`);
    }

    // 5. GN_JURID_CUMP
    await del('GN_JURID_CUMP');
    const tieCump = d.cump_TIE_JUNTA || 'N';
    await r()
      .input('COD_EMPR', sql.SmallInt,    COD_EMPR).input('COD_TERC',sql.BigInt,COD_TERC)
      .input('TIE_NORM', sql.Char(1),     toChar(d.TIE_NORM) || 'N')
      .input('NORM_LAFT',sql.VarChar(200),toChar(d.NORM_LAFT))
      .input('SIS_PREVE',sql.VarChar(200),toChar(d.SIS_PREVE))
      .input('OTR_PREVE',sql.VarChar(255),toChar(d.OTR_PREVE))
      .input('DESC_NORM',sql.VarChar(500),toChar(d.DESC_NORM))
      .input('TIE_JUNTA',sql.Char(1),    tieCump)
      .query(`INSERT INTO GN_JURID_CUMP(COD_EMPR,COD_TERC,TIE_NORM,NORM_LAFT,SIS_PREVE,OTR_PREVE,DESC_NORM,TIE_JUNTA)
              VALUES(@COD_EMPR,@COD_TERC,@TIE_NORM,@NORM_LAFT,@SIS_PREVE,@OTR_PREVE,@DESC_NORM,@TIE_JUNTA)`);
    for (const p of (Array.isArray(d.oficiales)?d.oficiales:[])) {
      if (!p.NOM_RESP) continue;
      await r()
          .input('COD_EMPR', sql.SmallInt,    COD_EMPR).input('COD_TERC',sql.BigInt,COD_TERC)
          .input('TIP_REPR', sql.Char(1),     p.TIP_REPR || 'P')
          .input('TIP_SIST', sql.VarChar(10), toChar(p.TIP_SIST))
          .input('TIP_DOCU', sql.Int,         toInt(p.TIP_DOCU))
          .input('NUM_DOCU', sql.VarChar(20), toChar(p.NUM_DOCU))
          .input('FEC_EXPE', sql.Date,        toDate(p.FEC_EXPE))
          .input('NOM_RESP', sql.VarChar(60), toChar(p.NOM_RESP))
          .input('APE_RESP', sql.VarChar(60), toChar(p.APE_RESP))
          .input('CEL_RESP', sql.VarChar(30),  toChar(p.CEL_RESP))
          .input('COD_PAIS', sql.Int,          toInt(p.COD_PAIS))
          .input('OTR_PAIS', sql.VarChar(100), toChar(p.OTR_PAIS))
          .input('COD_DEPT', sql.Int,          toInt(p.COD_DEPT))
          .input('COD_MPIO', sql.Int,          toInt(p.COD_MPIO))
          .input('DIR_RESP', sql.VarChar(120), toChar(p.DIR_RESP))
          .input('TEL_RESP', sql.VarChar(30),  toChar(p.TEL_RESP))
          .input('MAIL_RESP',sql.VarChar(100), toChar(p.MAIL_RESP))
          .input('OTR_TPDOC',sql.VarChar(100), toChar(p.OTR_TPDOC))
          .query(`INSERT INTO GN_JURID_CUMP(COD_EMPR,COD_TERC,TIP_REPR,TIP_SIST,TIP_DOCU,NUM_DOCU,FEC_EXPE,
                  NOM_RESP,APE_RESP,CEL_RESP,COD_PAIS,OTR_PAIS,COD_DEPT,COD_MPIO,DIR_RESP,TEL_RESP,MAIL_RESP,OTR_TPDOC)
                  VALUES(@COD_EMPR,@COD_TERC,@TIP_REPR,@TIP_SIST,@TIP_DOCU,@NUM_DOCU,@FEC_EXPE,
                  @NOM_RESP,@APE_RESP,@CEL_RESP,@COD_PAIS,@OTR_PAIS,@COD_DEPT,@COD_MPIO,@DIR_RESP,@TEL_RESP,@MAIL_RESP,@OTR_TPDOC)`);
    }

    // 6. GN_JURID_JD
    await del('GN_JURID_JD');
    for (const m of (Array.isArray(d.juntaDirectiva)?d.juntaDirectiva:[])) {
      if (!m.NOM_MIEM) continue;
      await r()
          .input('COD_EMPR', sql.SmallInt,    COD_EMPR).input('COD_TERC',sql.BigInt,COD_TERC)
          .input('TIP_REPR', sql.Char(1),     m.TIP_REPR || 'P')
          .input('TIP_MIEM', sql.VarChar(10), toChar(m.TIP_MIEM))
          .input('NOM_MIEM', sql.VarChar(60), toChar(m.NOM_MIEM))
          .input('APE_MIEM', sql.VarChar(60), toChar(m.APE_MIEM))
          .input('TIP_DOCU', sql.Int,         toInt(m.TIP_DOCU))
          .input('NUM_DOCU', sql.VarChar(20), toChar(m.NUM_DOCU))
          .input('FEC_EXPE', sql.Date,        toDate(m.FEC_EXPE))
          .input('COD_PAIS', sql.Int,          toInt(m.COD_PAIS))
          .input('OTR_PAIS', sql.VarChar(100), toChar(m.OTR_PAIS))
          .input('COD_DEPT', sql.Int,          toInt(m.COD_DEPT))
          .input('COD_MPIO', sql.Int,          toInt(m.COD_MPIO))
          .input('DIR_MIEM', sql.VarChar(120), toChar(m.DIR_MIEM))
          .input('CEL_MIEM', sql.VarChar(30),  toChar(m.CEL_MIEM))
          .input('TEL_MIEM', sql.VarChar(30),  toChar(m.TEL_MIEM))
          .input('MAIL_MIEM',sql.VarChar(100), toChar(m.MAIL_MIEM))
          .input('OTR_TPDOC',sql.VarChar(100), toChar(m.OTR_TPDOC))
          .query(`INSERT INTO GN_JURID_JD(COD_EMPR,COD_TERC,TIP_REPR,TIP_MIEM,NOM_MIEM,APE_MIEM,
                  TIP_DOCU,NUM_DOCU,FEC_EXPE,COD_PAIS,OTR_PAIS,COD_DEPT,COD_MPIO,DIR_MIEM,CEL_MIEM,TEL_MIEM,MAIL_MIEM,OTR_TPDOC)
                  VALUES(@COD_EMPR,@COD_TERC,@TIP_REPR,@TIP_MIEM,@NOM_MIEM,@APE_MIEM,
                  @TIP_DOCU,@NUM_DOCU,@FEC_EXPE,@COD_PAIS,@OTR_PAIS,@COD_DEPT,@COD_MPIO,@DIR_MIEM,@CEL_MIEM,@TEL_MIEM,@MAIL_MIEM,@OTR_TPDOC)`);
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
          .input('TIP_PERS',    sql.Char(1),     toChar(rv.TIP_PERS) || 'N')
          .input('TIE_REVIS',   sql.Char(1),     tieRevis)
          .input('NOM_REVI',    sql.VarChar(60), toChar(rv.NOM_REVI))
          .input('APE_REVI',    sql.VarChar(60), toChar(rv.APE_REVI))
          .input('RAZ_REVI',    sql.VarChar(120),toChar(rv.RAZ_REVI))
          .input('TIP_DOCU',    sql.Int,         toInt(rv.TIP_DOCU))
          .input('NUM_DOCU',    sql.VarChar(20), toChar(rv.NUM_DOCU))
          .input('FEC_EXPE',    sql.Date,        toDate(rv.FEC_EXPE))
          .input('COD_PAIS',    sql.Int,          toInt(rv.COD_PAIS))
          .input('OTR_PAIS',    sql.VarChar(100), toChar(rv.OTR_PAIS))
          .input('COD_DEPT',    sql.Int,          toInt(rv.COD_DEPT))
          .input('COD_MPIO',    sql.Int,          toInt(rv.COD_MPIO))
          .input('DIR_REVI',    sql.VarChar(120), toChar(rv.DIR_REVI))
          .input('CEL_REVI',    sql.VarChar(30),  toChar(rv.CEL_REVI))
          .input('TEL_REVI',    sql.VarChar(30),  toChar(rv.TEL_REVI))
          .input('MAIL_REVI',   sql.VarChar(100), toChar(rv.MAIL_REVI))
          .input('REVI_FIRMA',   sql.Char(1),      toChar(rv.REVI_FIRMA)||'N')
          .input('RAZ_FIRMA',    sql.VarChar(120), toChar(rv.RAZ_FIRMA))
          .input('TIP_DOCU_FIR', sql.Int,          rv.TIP_DOCU_FIR === 'OTR_TPDOC' ? null : toInt(rv.TIP_DOCU_FIR))
          .input('OTR_TPDOC_FIR',sql.VarChar(100), toChar(rv.OTR_TPDOC_FIR))
          .input('NUM_DOCU_FIR', sql.VarChar(20),  toChar(rv.NUM_DOCU_FIR))
          .input('OTR_TPDOC',    sql.VarChar(100), toChar(rv.OTR_TPDOC))
          .query(`INSERT INTO GN_JURID_RF(COD_EMPR,COD_TERC,TIP_REPR,TIP_PERS,TIE_REVIS,NOM_REVI,APE_REVI,RAZ_REVI,
                  TIP_DOCU,NUM_DOCU,FEC_EXPE,COD_PAIS,OTR_PAIS,COD_DEPT,COD_MPIO,DIR_REVI,CEL_REVI,TEL_REVI,MAIL_REVI,
                  REVI_FIRMA,RAZ_FIRMA,TIP_DOCU_FIR,OTR_TPDOC_FIR,NUM_DOCU_FIR,OTR_TPDOC)
                  VALUES(@COD_EMPR,@COD_TERC,@TIP_REPR,@TIP_PERS,@TIE_REVIS,@NOM_REVI,@APE_REVI,@RAZ_REVI,
                  @TIP_DOCU,@NUM_DOCU,@FEC_EXPE,@COD_PAIS,@OTR_PAIS,@COD_DEPT,@COD_MPIO,@DIR_REVI,@CEL_REVI,@TEL_REVI,@MAIL_REVI,
                  @REVI_FIRMA,@RAZ_FIRMA,@TIP_DOCU_FIR,@OTR_TPDOC_FIR,@NUM_DOCU_FIR,@OTR_TPDOC)`);
    }

    // 8. GN_JURID_AC
    await del('GN_JURID_AC');
    for (const ac of (Array.isArray(d.accionistas)?d.accionistas:[])) {
      if (!ac.NOM_ACCI && !ac.RAZ_ACCI) continue;
      await r()
        .input('COD_EMPR', sql.SmallInt,    COD_EMPR).input('COD_TERC',sql.BigInt,COD_TERC)
        .input('TIP_PERS', sql.Char(1),     toChar(ac.TIP_PERS) || 'N')
        .input('NOM_ACCI', sql.VarChar(60), toChar(ac.NOM_ACCI))
        .input('APE_ACCI', sql.VarChar(60), toChar(ac.APE_ACCI))
        .input('RAZ_ACCI', sql.VarChar(120),toChar(ac.RAZ_ACCI))
        .input('TIP_DOCU', sql.Int,         toInt(ac.TIP_DOCU))
        .input('NUM_DOCU', sql.VarChar(20), toChar(ac.NUM_DOCU))
        .input('FEC_EXPE', sql.Date,        toDate(ac.FEC_EXPE))
        .input('COD_PAIS', sql.Int,          toInt(ac.COD_PAIS))
        .input('OTR_PAIS', sql.VarChar(100), toChar(ac.OTR_PAIS))
        .input('COD_DEPT', sql.Int,          toInt(ac.COD_DEPT))
        .input('COD_MPIO', sql.Int,          toInt(ac.COD_MPIO))
        .input('DIR_ACCI', sql.VarChar(120), toChar(ac.DIR_ACCI))
        .input('CEL_ACCI', sql.VarChar(30),  toChar(ac.CEL_ACCI))
        .input('TEL_ACCI', sql.VarChar(30),  toChar(ac.TEL_ACCI))
        .input('MAIL_ACCI',sql.VarChar(100), toChar(ac.MAIL_ACCI))
        .input('PCT_PART', sql.Decimal(5,2), toDec(ac.PCT_PART))
        .input('OTR_TPDOC',sql.VarChar(100), toChar(ac.OTR_TPDOC))
        .query(`INSERT INTO GN_JURID_AC(COD_EMPR,COD_TERC,TIP_PERS,NOM_ACCI,APE_ACCI,RAZ_ACCI,TIP_DOCU,NUM_DOCU,
                FEC_EXPE,COD_PAIS,OTR_PAIS,COD_DEPT,COD_MPIO,DIR_ACCI,CEL_ACCI,TEL_ACCI,MAIL_ACCI,PCT_PART,OTR_TPDOC)
                VALUES(@COD_EMPR,@COD_TERC,@TIP_PERS,@NOM_ACCI,@APE_ACCI,@RAZ_ACCI,@TIP_DOCU,@NUM_DOCU,
                @FEC_EXPE,@COD_PAIS,@OTR_PAIS,@COD_DEPT,@COD_MPIO,@DIR_ACCI,@CEL_ACCI,@TEL_ACCI,@MAIL_ACCI,@PCT_PART,@OTR_TPDOC)`);
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
        .input('COD_BANCO',   sql.Int,          toInt(b.COD_BANCO))
        .input('OTR_BANCO',   sql.VarChar(255), toChar(b.OTR_BANCO))
        .input('TIP_CUEN',    sql.Int,          toInt(b.TIP_CUEN))
        .input('OTR_CUEN',    sql.VarChar(255), toChar(b.OTR_CUEN))
        .input('NUM_CUEN',    sql.VarChar(30),  toChar(b.NUM_CUEN))
        .input('CUEN_EXTR',   sql.Char(1),       toChar(b.CUEN_EXTR)||'N')
        .input('CUENTAS_EXT', sql.NVarChar(sql.MAX), Array.isArray(b.cuentasExt) && b.cuentasExt.length > 0 ? JSON.stringify(b.cuentasExt) : null)
        .query(`INSERT INTO GN_TERCE_BANCO(COD_EMPR,COD_TERC,COD_BANCO,OTR_BANCO,TIP_CUEN,OTR_CUEN,NUM_CUEN,CUEN_EXTR,CUENTAS_EXT)
                VALUES(@COD_EMPR,@COD_TERC,@COD_BANCO,@OTR_BANCO,@TIP_CUEN,@OTR_CUEN,@NUM_CUEN,@CUEN_EXTR,@CUENTAS_EXT)`);
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
      .input('OPER_VA',     sql.Char(1), act.OPER_VA     ||'N')
      .input('ACT_VA_FIAT', sql.Char(1), act.ACT_VA_FIAT ||'N')
      .input('ACT_VA_VA',   sql.Char(1), act.ACT_VA_VA   ||'N')
      .input('ACT_TRANS',   sql.Char(1), act.ACT_TRANS   ||'N')
      .input('ACT_CUSTO',   sql.Char(1), act.ACT_CUSTO   ||'N')
      .input('ACT_SERV_FIN',sql.Char(1), act.ACT_SERV_FIN||'N')
      .input('ACT_SERV_VAP',sql.Char(1), act.ACT_SERV_VAP||'N')
      .input('CERT_INFO',   sql.Char(1), act.CERT_INFO   ||'N')
      .query(`INSERT INTO GN_JURID_ACT(COD_EMPR,COD_TERC,OPER_VA,ACT_VA_FIAT,ACT_VA_VA,ACT_TRANS,ACT_CUSTO,ACT_SERV_FIN,ACT_SERV_VAP,CERT_INFO)
              VALUES(@COD_EMPR,@COD_TERC,@OPER_VA,@ACT_VA_FIAT,@ACT_VA_VA,@ACT_TRANS,@ACT_CUSTO,@ACT_SERV_FIN,@ACT_SERV_VAP,@CERT_INFO)`);

    // 13. GN_JURID_BF
    await del('GN_JURID_BF');
    for (const bf of (Array.isArray(d.beneficiarios)?d.beneficiarios:[])) {
      if (!bf.NOM_BENE && !bf.RAZ_BENE) continue;
      await r()
        .input('COD_EMPR', sql.SmallInt,    COD_EMPR).input('COD_TERC',sql.BigInt,COD_TERC)
        .input('TIP_BENE', sql.Char(1),     (['N','J'].includes(bf.TIP_BENE) ? bf.TIP_BENE : 'N'))
        .input('NOM_BENE', sql.VarChar(60), toChar(bf.NOM_BENE))
        .input('APE_BENE', sql.VarChar(60), toChar(bf.APE_BENE))
        .input('RAZ_BENE', sql.VarChar(120),toChar(bf.RAZ_BENE))
        .input('TIP_DOCU', sql.Int,         toInt(bf.TIP_DOCU))
        .input('NUM_DOCU', sql.VarChar(20), toChar(bf.NUM_DOCU))
        .input('FEC_EXPE', sql.Date,        toDate(bf.FEC_EXPE))
        .input('COD_PAIS', sql.Int,          toInt(bf.COD_PAIS))
        .input('OTR_PAIS', sql.VarChar(100), toChar(bf.OTR_PAIS))
        .input('COD_DEPT', sql.Int,          toInt(bf.COD_DEPT))
        .input('COD_MPIO', sql.Int,          toInt(bf.COD_MPIO))
        .input('DIR_BENE', sql.VarChar(120), toChar(bf.DIR_BENE))
        .input('TEL_BENE', sql.VarChar(30),  toChar(bf.TEL_BENE))
        .input('MAIL_BENE',sql.VarChar(100), toChar(bf.MAIL_BENE))
        .input('OTR_TPDOC',sql.VarChar(100), toChar(bf.OTR_TPDOC))
        .query(`INSERT INTO GN_JURID_BF(COD_EMPR,COD_TERC,TIP_BENE,NOM_BENE,APE_BENE,RAZ_BENE,TIP_DOCU,NUM_DOCU,
                FEC_EXPE,COD_PAIS,OTR_PAIS,COD_DEPT,COD_MPIO,DIR_BENE,TEL_BENE,MAIL_BENE,OTR_TPDOC)
                VALUES(@COD_EMPR,@COD_TERC,@TIP_BENE,@NOM_BENE,@APE_BENE,@RAZ_BENE,@TIP_DOCU,@NUM_DOCU,
                @FEC_EXPE,@COD_PAIS,@OTR_PAIS,@COD_DEPT,@COD_MPIO,@DIR_BENE,@TEL_BENE,@MAIL_BENE,@OTR_TPDOC)`);
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
    _responderError(res, err, req);
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
 *   12. GN_JURID_ACT      — actividades de riesgo SAGRILAFT
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

  // ── Validación server-side de longitudes y fechas ─────────────────────────
  const errVal = _validarCampos([
    () => _validarTexto(d.NUM_IDEN,   'Número de identificación', 20),
    () => _validarTexto(d.NOM_COMP,   'Razón social',            240),
    () => _validarTexto(d.DIR_TERC,   'Dirección',               120),
    () => _validarTexto(d.DIR_MAIL,   'Email corporativo',       150),
    () => _validarTexto(d.MAIL_SARL,  'Email SAGRILAFT',           150),
    () => _validarTexto(d.URL_WEB,    'Sitio web',               200),
    () => d.firma?.FEC_FIRMA ? _validarFecha(d.firma.FEC_FIRMA, 'Fecha de firma') : null,
  ]);
  if (errVal.length)
    return res.status(400).json({ error: 'Errores de validación', detalles: errVal });

  // ── Bloqueo de envíos concurrentes ────────────────────────────────────────
  if (!_bloquearEnvio(d.NUM_IDEN)) {
    return res.status(409).json({
      error: `Ya hay un envío en proceso para el documento ${d.NUM_IDEN}. Espere unos segundos e intente nuevamente.`,
    });
  }

  const toInt  = v => { if (v === null || v === undefined || v === '' || v === 'NA') return null; const n = parseInt(v, 10); return isNaN(n) ? null : n; };
  const toDec  = v => (v !== null && v !== undefined && v !== '') ? parseFloat(v) : null;
  const toDate = v => v ? new Date(v) : null;
  const toChar = v => v || null;

  let pool, transaction;
  try {
    pool        = await getPool();

    // ── Verificar duplicado en BD (antes de abrir transacción) ───────────────
    const dupCheck = await pool.request()
      .input('COD_EMPR', sql.SmallInt,    COD_EMPR)
      .input('NUM_IDEN', sql.VarChar(20), d.NUM_IDEN)
      .query(`SELECT 1 FROM GN_TERCE WHERE COD_EMPR=@COD_EMPR AND NUM_IDEN=@NUM_IDEN`);
    if (dupCheck.recordset.length) {
      _liberarEnvio(d.NUM_IDEN);
      return res.status(409).json({ error: `El documento ${d.NUM_IDEN} ya está registrado. Use la opción de actualización.` });
    }
    // Generar código de edición ANTES de la transacción
    const codigoEdicion = _generarCodigoEdicion();
    const hashEdicion   = _hashCodigo(codigoEdicion);

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
      .input('COD_EDIT',   sql.Char(64),    hashEdicion)
      .query(`
        INSERT INTO GN_TERCE
          (COD_EMPR, TIP_TERC, COD_TPDOC, NUM_IDEN, DIG_VERI, NOM_COMP,
           DIR_TERC, TEL_TERC, TEL_TERC2, DIR_MAIL, COD_EDIT)
        OUTPUT INSERTED.COD_TERC
        VALUES
          (@COD_EMPR, @TIP_TERC, @COD_TPDOC, @NUM_IDEN, @DIG_VERI, @NOM_COMP,
           @DIR_TERC, @TEL_TERC, @TEL_TERC2, @DIR_MAIL, @COD_EDIT)
      `);

    const COD_TERC = resTerce.recordset[0].COD_TERC;

    // ── 2. GN_JURID ──────────────────────────────────────────────────────────
    await r()
      .input('COD_EMPR',    sql.SmallInt,    COD_EMPR)
      .input('COD_TERC',    sql.BigInt,      COD_TERC)
      .input('TIP_VINC',    sql.VarChar(40),  toChar(d.COD_VINC))
      .input('OTR_VINC',    sql.VarChar(255), toChar(d.OTR_VINC))
      .input('MAIL_SARL',   sql.VarChar(150), toChar(d.MAIL_SARL))
      .input('COD_CIIU',    sql.VarChar(10),  toChar(d.COD_CIIU))
      .input('OTR_CIIU',    sql.VarChar(255), toChar(d.OTR_CIIU))
      .input('URL_WEB',     sql.VarChar(200), toChar(d.URL_WEB))
      .input('TIP_SOCIE',   sql.VarChar(10),  toChar(d.TIP_SOCIE))
      .input('OTR_SOCIE',   sql.VarChar(255), toChar(d.OTR_SOCIE))
      .input('COD_PAIS_ORI',sql.Int,          toInt(d.COD_PAIS_ORIG_SOC === 'OTRO' ? null : d.COD_PAIS_ORIG_SOC))
      .input('UBIC_SOC',    sql.Char(1),      toChar(d.UBIC_SOC))
      .input('COD_PAIS_SOC',  sql.Int,          toInt(d.COD_PAIS_SOC))
      .input('OTR_PAIS_SOC',  sql.VarChar(100), toChar(d.UBIC_SOC === 'SC' ? d.OTR_PAIS_ORIG_SOC : d.OTR_PAIS_SOC))
      .input('TIP_EMPR',      sql.VarChar(10),  toChar(d.TIP_EMPR))
      .input('GRUP_EMPR',     sql.Char(1),      toChar(d.GRUP_EMPR))
      .input('CTRL_DECLA',    sql.Char(1),      toChar(d.CTRL_DECLA))
      .input('CAL_GRUPO',     sql.VarChar(20),  toChar(d.CAL_GRUPO))
      .input('DESC_GRUPO',    sql.VarChar(sql.MAX), toChar(d.DESC_GRUPO))
      .input('COD_PAIS_EXP',  sql.Int,          toInt(d.COD_PAIS_EXP))
      .input('OTR_PAIS_EXP',  sql.VarChar(100), toChar(d.OTR_PAIS_EXP))
      .input('COD_DEPT_EXP',  sql.Int,          toInt(d.COD_DEPT_EXP))
      .input('COD_MPIO_EXP',  sql.Int,          toInt(d.COD_MPIO_EXP))
      .query(`
        INSERT INTO GN_JURID
          (COD_EMPR, COD_TERC, TIP_VINC, OTR_VINC, MAIL_SARL, COD_CIIU, OTR_CIIU,
           URL_WEB, TIP_SOCIE, OTR_SOCIE, COD_PAIS_ORI, UBIC_SOC,
           COD_PAIS_SOC, OTR_PAIS_SOC, TIP_EMPR, GRUP_EMPR,
           CTRL_DECLA, CAL_GRUPO, DESC_GRUPO,
           COD_PAIS_EXP, OTR_PAIS_EXP, COD_DEPT_EXP, COD_MPIO_EXP)
        VALUES
          (@COD_EMPR, @COD_TERC, @TIP_VINC, @OTR_VINC, @MAIL_SARL, @COD_CIIU, @OTR_CIIU,
           @URL_WEB, @TIP_SOCIE, @OTR_SOCIE, @COD_PAIS_ORI, @UBIC_SOC,
           @COD_PAIS_SOC, @OTR_PAIS_SOC, @TIP_EMPR, @GRUP_EMPR,
           @CTRL_DECLA, @CAL_GRUPO, @DESC_GRUPO,
           @COD_PAIS_EXP, @OTR_PAIS_EXP, @COD_DEPT_EXP, @COD_MPIO_EXP)
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
          .input('COD_PAIS',  sql.Int,          toInt(p.COD_PAIS))
          .input('OTR_PAIS',  sql.VarChar(100), toChar(p.OTR_PAIS))
          .input('COD_DEPT',  sql.Int,          toInt(p.COD_DEPT))
          .input('COD_MPIO',  sql.Int,          toInt(p.COD_MPIO))
          .input('DIR_REPR',  sql.VarChar(120), toChar(p.DIR_REPR))
          .input('CEL_REPR',  sql.VarChar(30),  toChar(p.CEL_REPR))
          .input('TEL_REPR',  sql.VarChar(30),  toChar(p.TEL_REPR))
          .input('MAIL_REPR', sql.VarChar(100), toChar(p.MAIL_REPR))
          .input('OTR_TPDOC', sql.VarChar(100), toChar(p.OTR_TPDOC))
          .query(`
            INSERT INTO GN_JURID_RL
              (COD_EMPR, COD_TERC, TIP_REPR, NOM_REPR, APE_REPR,
               TIP_DOCU, OTR_TPDOC, NUM_DOCU, FEC_EXPE,
               COD_PAIS, OTR_PAIS, COD_DEPT, COD_MPIO,
               DIR_REPR, CEL_REPR, TEL_REPR, MAIL_REPR)
            VALUES
              (@COD_EMPR, @COD_TERC, @TIP_REPR, @NOM_REPR, @APE_REPR,
               @TIP_DOCU, @OTR_TPDOC, @NUM_DOCU, @FEC_EXPE,
               @COD_PAIS, @OTR_PAIS, @COD_DEPT, @COD_MPIO,
               @DIR_REPR, @CEL_REPR, @TEL_REPR, @MAIL_REPR)
          `);
      }
    }

    // ── 4. GN_JURID_PAIS — Países de operación ────────────────────────────────
    const paises = Array.isArray(d.paises) ? d.paises : [];
    for (const p of paises) {
      if (!p.COD_PAIS && !p.OTR_PAIS) continue;
      await r()
        .input('COD_EMPR', sql.SmallInt,    COD_EMPR)
        .input('COD_TERC', sql.BigInt,      COD_TERC)
        .input('COD_PAIS', sql.Int,         p.COD_PAIS === 'OTRO' ? null : toInt(p.COD_PAIS))
        .input('OTR_PAIS', sql.VarChar(100),toChar(p.OTR_PAIS))
        .query(`INSERT INTO GN_JURID_PAIS (COD_EMPR, COD_TERC, COD_PAIS, OTR_PAIS)
                VALUES (@COD_EMPR, @COD_TERC, @COD_PAIS, @OTR_PAIS)`);
    }

    // ── 5. GN_JURID_CUMP — Cumplimiento LAFT ─────────────────────────────────
    const tieCump = d.cump_TIE_JUNTA || 'N';
    await r()
      .input('COD_EMPR',   sql.SmallInt,    COD_EMPR)
      .input('COD_TERC',   sql.BigInt,      COD_TERC)
      .input('TIE_NORM',   sql.Char(1),     toChar(d.TIE_NORM) || 'N')
      .input('NORM_LAFT',  sql.VarChar(200),toChar(d.NORM_LAFT))
      .input('SIS_PREVE',  sql.VarChar(200),toChar(d.SIS_PREVE))
      .input('OTR_PREVE',  sql.VarChar(255),toChar(d.OTR_PREVE))
      .input('DESC_NORM',  sql.VarChar(500),toChar(d.DESC_NORM))
      .input('TIE_JUNTA',  sql.Char(1),     tieCump)
      .query(`
        INSERT INTO GN_JURID_CUMP (COD_EMPR, COD_TERC, TIE_NORM, NORM_LAFT, SIS_PREVE, OTR_PREVE, DESC_NORM, TIE_JUNTA)
        VALUES (@COD_EMPR, @COD_TERC, @TIE_NORM, @NORM_LAFT, @SIS_PREVE, @OTR_PREVE, @DESC_NORM, @TIE_JUNTA)
      `);

    // Oficiales de cumplimiento (flat format: TIP_REPR is directly on the object)
    const oficiales = Array.isArray(d.oficiales) ? d.oficiales : [];
    for (const p of oficiales) {
      if (!p.NOM_RESP) continue;
      await r()
        .input('COD_EMPR',  sql.SmallInt,    COD_EMPR)
        .input('COD_TERC',  sql.BigInt,      COD_TERC)
        .input('TIP_REPR',  sql.Char(1),     p.TIP_REPR || 'P')
        .input('TIP_SIST',  sql.VarChar(10), toChar(p.TIP_SIST))
        .input('TIP_DOCU',  sql.Int,         toInt(p.TIP_DOCU))
        .input('NUM_DOCU',  sql.VarChar(20), toChar(p.NUM_DOCU))
        .input('FEC_EXPE',  sql.Date,        toDate(p.FEC_EXPE))
        .input('NOM_RESP',  sql.VarChar(60), toChar(p.NOM_RESP))
        .input('APE_RESP',  sql.VarChar(60), toChar(p.APE_RESP))
        .input('CEL_RESP',  sql.VarChar(30),  toChar(p.CEL_RESP))
        .input('COD_PAIS',  sql.Int,          toInt(p.COD_PAIS))
        .input('OTR_PAIS',  sql.VarChar(100), toChar(p.OTR_PAIS))
        .input('COD_DEPT',  sql.Int,          toInt(p.COD_DEPT))
        .input('COD_MPIO',  sql.Int,          toInt(p.COD_MPIO))
        .input('DIR_RESP',  sql.VarChar(120), toChar(p.DIR_RESP))
        .input('TEL_RESP',  sql.VarChar(30),  toChar(p.TEL_RESP))
        .input('MAIL_RESP', sql.VarChar(100), toChar(p.MAIL_RESP))
        .input('OTR_TPDOC', sql.VarChar(100), toChar(p.OTR_TPDOC))
        .query(`
          INSERT INTO GN_JURID_CUMP
            (COD_EMPR, COD_TERC, TIP_REPR, TIP_SIST, TIP_DOCU, NUM_DOCU, FEC_EXPE,
             NOM_RESP, APE_RESP, CEL_RESP, COD_PAIS, OTR_PAIS, COD_DEPT, COD_MPIO,
             DIR_RESP, TEL_RESP, MAIL_RESP, OTR_TPDOC)
          VALUES
            (@COD_EMPR, @COD_TERC, @TIP_REPR, @TIP_SIST, @TIP_DOCU, @NUM_DOCU, @FEC_EXPE,
             @NOM_RESP, @APE_RESP, @CEL_RESP, @COD_PAIS, @OTR_PAIS, @COD_DEPT, @COD_MPIO,
             @DIR_RESP, @TEL_RESP, @MAIL_RESP, @OTR_TPDOC)
        `);
    }

    // ── 6. GN_JURID_JD — Junta directiva ─────────────────────────────────────
    const jdMiembros = Array.isArray(d.juntaDirectiva) ? d.juntaDirectiva : [];
    for (const m of jdMiembros) {
      // Flat format: TIP_REPR is directly on the object
      if (!m.NOM_MIEM) continue;
      await r()
        .input('COD_EMPR',  sql.SmallInt,    COD_EMPR)
        .input('COD_TERC',  sql.BigInt,      COD_TERC)
        .input('TIP_REPR',  sql.Char(1),     m.TIP_REPR || 'P')
        .input('TIP_MIEM',  sql.VarChar(10), toChar(m.TIP_MIEM))
        .input('NOM_MIEM',  sql.VarChar(60), toChar(m.NOM_MIEM))
        .input('APE_MIEM',  sql.VarChar(60), toChar(m.APE_MIEM))
        .input('TIP_DOCU',  sql.Int,         toInt(m.TIP_DOCU))
        .input('NUM_DOCU',  sql.VarChar(20), toChar(m.NUM_DOCU))
        .input('FEC_EXPE',  sql.Date,        toDate(m.FEC_EXPE))
        .input('COD_PAIS',  sql.Int,          toInt(m.COD_PAIS))
        .input('OTR_PAIS',  sql.VarChar(100), toChar(m.OTR_PAIS))
        .input('COD_DEPT',  sql.Int,          toInt(m.COD_DEPT))
        .input('COD_MPIO',  sql.Int,          toInt(m.COD_MPIO))
        .input('DIR_MIEM',  sql.VarChar(120), toChar(m.DIR_MIEM))
        .input('CEL_MIEM',  sql.VarChar(30),  toChar(m.CEL_MIEM))
        .input('TEL_MIEM',  sql.VarChar(30),  toChar(m.TEL_MIEM))
        .input('MAIL_MIEM', sql.VarChar(100), toChar(m.MAIL_MIEM))
        .input('OTR_TPDOC', sql.VarChar(100), toChar(m.OTR_TPDOC))
        .query(`
          INSERT INTO GN_JURID_JD
            (COD_EMPR, COD_TERC, TIP_REPR, TIP_MIEM, NOM_MIEM, APE_MIEM,
             TIP_DOCU, NUM_DOCU, FEC_EXPE, COD_PAIS, OTR_PAIS, COD_DEPT, COD_MPIO,
             DIR_MIEM, CEL_MIEM, TEL_MIEM, MAIL_MIEM, OTR_TPDOC)
          VALUES
            (@COD_EMPR, @COD_TERC, @TIP_REPR, @TIP_MIEM, @NOM_MIEM, @APE_MIEM,
             @TIP_DOCU, @NUM_DOCU, @FEC_EXPE, @COD_PAIS, @OTR_PAIS, @COD_DEPT, @COD_MPIO,
             @DIR_MIEM, @CEL_MIEM, @TEL_MIEM, @MAIL_MIEM, @OTR_TPDOC)
        `);
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
          .input('TIP_PERS',      sql.Char(1),     toChar(rv.TIP_PERS) || 'N')
          .input('TIE_REVIS',     sql.Char(1),     tieRevis)
          .input('NOM_REVI',      sql.VarChar(60), toChar(rv.NOM_REVI))
          .input('APE_REVI',      sql.VarChar(60), toChar(rv.APE_REVI))
          .input('RAZ_REVI',      sql.VarChar(120),toChar(rv.RAZ_REVI))
          .input('TIP_DOCU',      sql.Int,         toInt(rv.TIP_DOCU))
          .input('NUM_DOCU',      sql.VarChar(20), toChar(rv.NUM_DOCU))
          .input('FEC_EXPE',      sql.Date,        toDate(rv.FEC_EXPE))
          .input('COD_PAIS',      sql.Int,          toInt(rv.COD_PAIS))
          .input('OTR_PAIS',      sql.VarChar(100), toChar(rv.OTR_PAIS))
          .input('COD_DEPT',      sql.Int,          toInt(rv.COD_DEPT))
          .input('COD_MPIO',      sql.Int,          toInt(rv.COD_MPIO))
          .input('DIR_REVI',      sql.VarChar(120), toChar(rv.DIR_REVI))
          .input('CEL_REVI',      sql.VarChar(30),  toChar(rv.CEL_REVI))
          .input('TEL_REVI',      sql.VarChar(30),  toChar(rv.TEL_REVI))
          .input('MAIL_REVI',     sql.VarChar(100), toChar(rv.MAIL_REVI))
          .input('REVI_FIRMA',    sql.Char(1),       toChar(rf.REVI_FIRMA) || 'N')
          .input('RAZ_FIRMA',     sql.VarChar(120),  toChar(rf.RAZ_FIRMA))
          .input('TIP_DOCU_FIR',  sql.Int,           rf.TIP_DOCU_FIR === 'OTR_TPDOC' ? null : toInt(rf.TIP_DOCU_FIR))
          .input('OTR_TPDOC_FIR', sql.VarChar(100),  toChar(rf.OTR_TPDOC_FIR))
          .input('NUM_DOCU_FIR',  sql.VarChar(20),   toChar(rf.NUM_DOCU_FIR))
          .input('OTR_TPDOC',     sql.VarChar(100),  toChar(rv.OTR_TPDOC))
          .query(`
            INSERT INTO GN_JURID_RF
              (COD_EMPR, COD_TERC, TIP_REPR, TIP_PERS, TIE_REVIS,
               NOM_REVI, APE_REVI, RAZ_REVI,
               TIP_DOCU, NUM_DOCU, FEC_EXPE, COD_PAIS, OTR_PAIS, COD_DEPT, COD_MPIO,
               DIR_REVI, CEL_REVI, TEL_REVI, MAIL_REVI,
               REVI_FIRMA, RAZ_FIRMA, TIP_DOCU_FIR, OTR_TPDOC_FIR, NUM_DOCU_FIR, OTR_TPDOC)
            VALUES
              (@COD_EMPR, @COD_TERC, @TIP_REPR, @TIP_PERS, @TIE_REVIS,
               @NOM_REVI, @APE_REVI, @RAZ_REVI,
               @TIP_DOCU, @NUM_DOCU, @FEC_EXPE, @COD_PAIS, @OTR_PAIS, @COD_DEPT, @COD_MPIO,
               @DIR_REVI, @CEL_REVI, @TEL_REVI, @MAIL_REVI,
               @REVI_FIRMA, @RAZ_FIRMA, @TIP_DOCU_FIR, @OTR_TPDOC_FIR, @NUM_DOCU_FIR, @OTR_TPDOC)
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
        .input('TIP_PERS',  sql.Char(1),       toChar(ac.TIP_PERS) || 'N')
        .input('NOM_ACCI',  sql.VarChar(60),   toChar(ac.NOM_ACCI))
        .input('APE_ACCI',  sql.VarChar(60),   toChar(ac.APE_ACCI))
        .input('RAZ_ACCI',  sql.VarChar(120),  toChar(ac.RAZ_ACCI))
        .input('TIP_DOCU',  sql.Int,           toInt(ac.TIP_DOCU))
        .input('NUM_DOCU',  sql.VarChar(20),   toChar(ac.NUM_DOCU))
        .input('FEC_EXPE',  sql.Date,          toDate(ac.FEC_EXPE))
        .input('COD_PAIS',  sql.Int,           toInt(ac.COD_PAIS))
        .input('OTR_PAIS',  sql.VarChar(100),  toChar(ac.OTR_PAIS))
        .input('COD_DEPT',  sql.Int,           toInt(ac.COD_DEPT))
        .input('COD_MPIO',  sql.Int,           toInt(ac.COD_MPIO))
        .input('DIR_ACCI',  sql.VarChar(120),  toChar(ac.DIR_ACCI))
        .input('CEL_ACCI',  sql.VarChar(30),   toChar(ac.CEL_ACCI))
        .input('TEL_ACCI',  sql.VarChar(30),   toChar(ac.TEL_ACCI))
        .input('MAIL_ACCI', sql.VarChar(100),  toChar(ac.MAIL_ACCI))
        .input('PCT_PART',  sql.Decimal(5,2),  toDec(ac.PCT_PART))
        .input('OTR_TPDOC', sql.VarChar(100),  toChar(ac.OTR_TPDOC))
        .query(`
          INSERT INTO GN_JURID_AC
            (COD_EMPR, COD_TERC, TIP_PERS, NOM_ACCI, APE_ACCI, RAZ_ACCI,
             TIP_DOCU, NUM_DOCU, FEC_EXPE, COD_PAIS, OTR_PAIS, COD_DEPT, COD_MPIO,
             DIR_ACCI, CEL_ACCI, TEL_ACCI, MAIL_ACCI, PCT_PART, OTR_TPDOC)
          VALUES
            (@COD_EMPR, @COD_TERC, @TIP_PERS, @NOM_ACCI, @APE_ACCI, @RAZ_ACCI,
             @TIP_DOCU, @NUM_DOCU, @FEC_EXPE, @COD_PAIS, @OTR_PAIS, @COD_DEPT, @COD_MPIO,
             @DIR_ACCI, @CEL_ACCI, @TEL_ACCI, @MAIL_ACCI, @PCT_PART, @OTR_TPDOC)
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
        .input('COD_BANCO',   sql.Int,          toInt(b.COD_BANCO))
        .input('OTR_BANCO',   sql.VarChar(255), toChar(b.OTR_BANCO))
        .input('TIP_CUEN',    sql.Int,          toInt(b.TIP_CUEN))
        .input('OTR_CUEN',    sql.VarChar(255), toChar(b.OTR_CUEN))
        .input('NUM_CUEN',    sql.VarChar(30),  toChar(b.NUM_CUEN))
        .input('CUEN_EXTR',   sql.Char(1),           toChar(b.CUEN_EXTR) || 'N')
        .input('CUENTAS_EXT', sql.NVarChar(sql.MAX),  Array.isArray(b.cuentasExt) && b.cuentasExt.length > 0 ? JSON.stringify(b.cuentasExt) : null)
        .query(`
          INSERT INTO GN_TERCE_BANCO
            (COD_EMPR, COD_TERC, COD_BANCO, OTR_BANCO, TIP_CUEN, OTR_CUEN,
             NUM_CUEN, CUEN_EXTR, CUENTAS_EXT)
          VALUES
            (@COD_EMPR, @COD_TERC, @COD_BANCO, @OTR_BANCO, @TIP_CUEN, @OTR_CUEN,
             @NUM_CUEN, @CUEN_EXTR, @CUENTAS_EXT)
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
      .input('OPER_VA',      sql.Char(1),  act.OPER_VA      || 'N')
      .input('ACT_VA_FIAT',  sql.Char(1),  act.ACT_VA_FIAT  || 'N')
      .input('ACT_VA_VA',    sql.Char(1),  act.ACT_VA_VA    || 'N')
      .input('ACT_TRANS',    sql.Char(1),  act.ACT_TRANS    || 'N')
      .input('ACT_CUSTO',    sql.Char(1),  act.ACT_CUSTO    || 'N')
      .input('ACT_SERV_FIN', sql.Char(1),  act.ACT_SERV_FIN || 'N')
      .input('ACT_SERV_VAP', sql.Char(1),  act.ACT_SERV_VAP || 'N')
      .input('CERT_INFO',    sql.Char(1),  act.CERT_INFO    || 'N')
      .query(`
        INSERT INTO GN_JURID_ACT
          (COD_EMPR, COD_TERC, OPER_VA, ACT_VA_FIAT, ACT_VA_VA, ACT_TRANS, ACT_CUSTO,
           ACT_SERV_FIN, ACT_SERV_VAP, CERT_INFO)
        VALUES
          (@COD_EMPR, @COD_TERC, @OPER_VA, @ACT_VA_FIAT, @ACT_VA_VA, @ACT_TRANS, @ACT_CUSTO,
           @ACT_SERV_FIN, @ACT_SERV_VAP, @CERT_INFO)
      `);

    // ── 13. GN_JURID_BF — Beneficiarios finales ───────────────────────────────
    const beneficiarios = Array.isArray(d.beneficiarios) ? d.beneficiarios : [];
    for (const bf of beneficiarios) {
      if (!bf.NOM_BENE && !bf.RAZ_BENE) continue;
      await r()
        .input('COD_EMPR',  sql.SmallInt,    COD_EMPR)
        .input('COD_TERC',  sql.BigInt,      COD_TERC)
        .input('TIP_BENE',  sql.Char(1),     (['N','J'].includes(bf.TIP_BENE) ? bf.TIP_BENE : 'N'))
        .input('NOM_BENE',  sql.VarChar(60), toChar(bf.NOM_BENE))
        .input('APE_BENE',  sql.VarChar(60), toChar(bf.APE_BENE))
        .input('RAZ_BENE',  sql.VarChar(120),toChar(bf.RAZ_BENE))
        .input('TIP_DOCU',  sql.Int,         toInt(bf.TIP_DOCU))
        .input('NUM_DOCU',  sql.VarChar(20), toChar(bf.NUM_DOCU))
        .input('FEC_EXPE',  sql.Date,        toDate(bf.FEC_EXPE))
        .input('COD_PAIS',  sql.Int,          toInt(bf.COD_PAIS))
        .input('OTR_PAIS',  sql.VarChar(100), toChar(bf.OTR_PAIS))
        .input('COD_DEPT',  sql.Int,          toInt(bf.COD_DEPT))
        .input('COD_MPIO',  sql.Int,          toInt(bf.COD_MPIO))
        .input('DIR_BENE',  sql.VarChar(120), toChar(bf.DIR_BENE))
        .input('TEL_BENE',  sql.VarChar(30),  toChar(bf.TEL_BENE))
        .input('MAIL_BENE', sql.VarChar(100), toChar(bf.MAIL_BENE))
        .input('OTR_TPDOC', sql.VarChar(100), toChar(bf.OTR_TPDOC))
        .query(`
          INSERT INTO GN_JURID_BF
            (COD_EMPR, COD_TERC, TIP_BENE, NOM_BENE, APE_BENE, RAZ_BENE,
             TIP_DOCU, NUM_DOCU, FEC_EXPE, COD_PAIS, OTR_PAIS, COD_DEPT, COD_MPIO,
             DIR_BENE, TEL_BENE, MAIL_BENE, OTR_TPDOC)
          VALUES
            (@COD_EMPR, @COD_TERC, @TIP_BENE, @NOM_BENE, @APE_BENE, @RAZ_BENE,
             @TIP_DOCU, @NUM_DOCU, @FEC_EXPE, @COD_PAIS, @OTR_PAIS, @COD_DEPT, @COD_MPIO,
             @DIR_BENE, @TEL_BENE, @MAIL_BENE, @OTR_TPDOC)
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
    res.json({ success: true, NUM_IDEN: d.NUM_IDEN, COD_TERC, codigoEdicion });

  } catch (err) {
    try { await transaction.rollback(); } catch (_) {}
    console.error('POST /api/guardar-completo:', err);
    _responderError(res, err, req);
  } finally {
    _liberarEnvio(d.NUM_IDEN); // liberar bloqueo siempre, con éxito o error
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
 *   6. GN_NATUR_ACT   — actividades de riesgo SAGRILAFT
 *   7. GN_TERCE_DOC   — documentos adjuntos (0..n)
 *
 * Devuelve { success, NUM_IDEN, COD_TERC }.
 */
app.post('/api/guardar-completo-natural', async (req, res) => {
  const b = req.body;

  if (!b.NUM_IDEN || !b.NOM_TERC || !b.APE_TERC) {
    return res.status(400).json({ error: 'Faltan campos obligatorios (NUM_IDEN, NOM_TERC, APE_TERC).' });
  }

  // ── Validación server-side de longitudes y fechas ─────────────────────────
  const errVal = _validarCampos([
    () => _validarTexto(b.NUM_IDEN,  'Número de identificación', 20),
    () => _validarTexto(b.NOM_TERC,  'Primer nombre',            40),
    () => _validarTexto(b.APE_TERC,  'Primer apellido',          40),
    () => _validarTexto(b.DIR_TERC,  'Dirección',               120),
    () => _validarTexto(b.DIR_MAIL,  'Email corporativo',       150),
    () => _validarTexto(b.MAIL_SARL, 'Email SAGRILAFT',           150),
    () => b.FEC_EXPE ? _validarFecha(b.FEC_EXPE, 'Fecha de expedición del documento') : null,
    () => b.FEC_NACI ? _validarFecha(b.FEC_NACI, 'Fecha de nacimiento') : null,
  ]);
  if (errVal.length)
    return res.status(400).json({ error: 'Errores de validación', detalles: errVal });

  // ── Bloqueo de envíos concurrentes ────────────────────────────────────────
  if (!_bloquearEnvio(b.NUM_IDEN)) {
    return res.status(409).json({
      error: `Ya hay un envío en proceso para el documento ${b.NUM_IDEN}. Espere unos segundos e intente nuevamente.`,
    });
  }

  // Helpers de conversión
  const toInt  = v => { if (v === null || v === undefined || v === '' || v === 'NA') return null; const n = parseInt(v, 10); return isNaN(n) ? null : n; };
  const toChar = v => v || null;

  let pool, transaction;
  try {
    pool = await getPool();

    // ── Verificar duplicado en BD ─────────────────────────────────────────────
    const dupCheck = await pool.request()
      .input('COD_EMPR', sql.SmallInt,    COD_EMPR)
      .input('NUM_IDEN', sql.VarChar(20), b.NUM_IDEN)
      .query(`SELECT 1 FROM GN_TERCE WHERE COD_EMPR=@COD_EMPR AND NUM_IDEN=@NUM_IDEN`);
    if (dupCheck.recordset.length) {
      _liberarEnvio(b.NUM_IDEN);
      return res.status(409).json({ error: `El documento ${b.NUM_IDEN} ya está registrado. Use la opción de actualización.` });
    }
    // Generar código de edición ANTES de la transacción
    const codigoEdicion = _generarCodigoEdicion();
    const hashEdicion   = _hashCodigo(codigoEdicion);

    transaction = new sql.Transaction(pool);
    await transaction.begin();
    const r = () => new sql.Request(transaction);

    // ── 1. GN_TERCE ──────────────────────────────────────────────────────────
    const nomComp = [b.NOM_TERC, b.SEG_NOMB, b.APE_TERC, b.SEG_APEL]
      .filter(Boolean).join(' ');

    const resTerce = await r()
      .input('COD_EMPR',  sql.SmallInt,    COD_EMPR)
      .input('TIP_TERC',  sql.Char(1),     TIP_TERC_NATUR)
      .input('COD_TPDOC', sql.Int,         toInt(b.COD_TPDOC) || 8)
      .input('OTR_TPDOC', sql.VarChar(100),b.OTR_TPDOC || null)
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
      .input('COD_EDIT',  sql.Char(64),    hashEdicion)
      .query(`
        INSERT INTO GN_TERCE
          (COD_EMPR, TIP_TERC, COD_TPDOC, OTR_TPDOC, NUM_IDEN,
           NOM_TERC, SEG_NOMB, APE_TERC, SEG_APEL, NOM_COMP,
           DIR_TERC, TEL_TERC, TEL_TERC2, DIR_MAIL, COD_EDIT)
        OUTPUT INSERTED.COD_TERC
        VALUES
          (@COD_EMPR, @TIP_TERC, @COD_TPDOC, @OTR_TPDOC, @NUM_IDEN,
           @NOM_TERC, @SEG_NOMB, @APE_TERC, @SEG_APEL, @NOM_COMP,
           @DIR_TERC, @TEL_TERC, @TEL_TERC2, @DIR_MAIL, @COD_EDIT)
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
      .input('OTR_NACIO',   sql.VarChar(100),toChar(b.OTR_NACIO))
      .input('ACT_PRINC',   sql.VarChar(100),b.ACT_PRINC   || null)
      .input('COD_CIIU',    sql.VarChar(10), b.COD_CIIU    || null)
      .input('OTR_CIIU',    sql.VarChar(255),toChar(b.OTR_CIIU))
      .input('FEC_EXPE',    sql.Date,        b.FEC_EXPE ? new Date(b.FEC_EXPE) : null)
      .input('COD_PAIS_EXP', sql.Int,          toInt(b.COD_PAIS_EXP))
      .input('OTR_PAIS_EXP', sql.VarChar(100), toChar(b.OTR_PAIS_EXP))
      .input('COD_DEPT_EXP', sql.Int,          toInt(b.COD_DEPT_EXP))
      .input('COD_MPIO_EXP', sql.Int,          toInt(b.COD_MPIO_EXP))
      .input('PART_SOC',    sql.Char(1),       b.PART_SOC    || 'N')
      .input('RAZ_SOC',     sql.NVarChar(200), b.PART_SOC === 'S' ? (b.RAZ_SOC     || null) : null)
      .input('TIP_DOC_SOC', sql.Int,           b.PART_SOC === 'S' ? (toInt(b.TIP_DOC_SOC)) : null)
      .input('NUM_DOC_SOC', sql.VarChar(20),   b.PART_SOC === 'S' ? (b.NUM_DOC_SOC  || null) : null)
      .query(`
        INSERT INTO GN_NATUR
          (COD_EMPR, COD_TERC, TIP_VINC, MAIL_SARL, COD_NACIO, OTR_NACIO,
           ACT_PRINC, COD_CIIU, OTR_CIIU, FEC_EXPE,
           COD_PAIS_EXP, OTR_PAIS_EXP, COD_DEPT_EXP, COD_MPIO_EXP,
           PART_SOC, RAZ_SOC, TIP_DOC_SOC, NUM_DOC_SOC)
        VALUES
          (@COD_EMPR, @COD_TERC, @TIP_VINC, @MAIL_SARL, @COD_NACIO, @OTR_NACIO,
           @ACT_PRINC, @COD_CIIU, @OTR_CIIU, @FEC_EXPE,
           @COD_PAIS_EXP, @OTR_PAIS_EXP, @COD_DEPT_EXP, @COD_MPIO_EXP,
           @PART_SOC, @RAZ_SOC, @TIP_DOC_SOC, @NUM_DOC_SOC)
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
        .input('CUEN_EXTR',   sql.Char(1),           cuenta.CUEN_EXTR || 'N')
        .input('CUENTAS_EXT', sql.NVarChar(sql.MAX),  Array.isArray(cuenta.cuentasExt) && cuenta.cuentasExt.length > 0 ? JSON.stringify(cuenta.cuentasExt) : null)
        .query(`
          INSERT INTO GN_TERCE_BANCO
            (COD_EMPR, COD_TERC, COD_BANCO, TIP_CUEN, NUM_CUEN,
             CUEN_EXTR, CUENTAS_EXT)
          VALUES
            (@COD_EMPR, @COD_TERC, @COD_BANCO, @TIP_CUEN, @NUM_CUEN,
             @CUEN_EXTR, @CUENTAS_EXT)
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
      .input('OPER_VA',      sql.Char(1),  act.OPER_VA      || 'N')
      .input('ACT_VA_FIAT',  sql.Char(1),  act.ACT_VA_FIAT  || 'N')
      .input('ACT_VA_VA',    sql.Char(1),  act.ACT_VA_VA    || 'N')
      .input('ACT_TRANS',    sql.Char(1),  act.ACT_TRANS    || 'N')
      .input('ACT_CUSTO',    sql.Char(1),  act.ACT_CUSTO    || 'N')
      .input('ACT_SERV_FIN', sql.Char(1),  act.ACT_SERV_FIN || 'N')
      .input('ACT_SERV_VAP', sql.Char(1),  act.ACT_SERV_VAP || 'N')
      .input('CERT_INFO',    sql.Char(1),  act.CERT_INFO    || 'N')
      .query(`
        INSERT INTO GN_NATUR_ACT
          (COD_EMPR, COD_TERC, OPER_VA,
           ACT_VA_FIAT, ACT_VA_VA, ACT_TRANS, ACT_CUSTO,
           ACT_SERV_FIN, ACT_SERV_VAP, CERT_INFO)
        VALUES
          (@COD_EMPR, @COD_TERC, @OPER_VA,
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
    res.json({ success: true, NUM_IDEN: b.NUM_IDEN, COD_TERC, codigoEdicion });

  } catch (err) {
    try { await transaction.rollback(); } catch (_) {}
    console.error('POST /api/guardar-completo-natural:', err);
    _responderError(res, err, req);
  } finally {
    _liberarEnvio(b.NUM_IDEN); // liberar bloqueo siempre, con éxito o error
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  PERSONA NATURAL — Exportar Excel
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/exportar-excel-natural/:codTerc
 *
 * Genera un Excel con todos los campos del formulario de Persona Natural,
 * etiquetas bilingüeS (es/en) y códigos resueltos mediante JOINs.
 * Acepta ?lang=es|en  (por defecto español).
 * Guarda una copia en UPLOAD_DIR/exports/{codTerc}/ antes de enviar.
 */
app.get('/api/exportar-excel-natural/:codTerc', async (req, res) => {
  const codTerc = parseInt(req.params.codTerc, 10);
  if (!codTerc) return res.status(400).json({ error: 'codTerc inválido' });

  const lang = req.query.lang === 'en' ? 'en' : 'es';
  const L = (es, en) => lang === 'en' ? en : es;

  const nomPais  = (a) => lang === 'en' ? `ISNULL(${a}.NOM_EN, ${a}.NOM_PAIS)`  : `${a}.NOM_PAIS`;
  const nomTpdoc = (a) => lang === 'en' ? `ISNULL(${a}.NOM_EN, ${a}.NOM_TPDOC)` : `${a}.NOM_TPDOC`;
  const nomVinc  = (a) => lang === 'en' ? `ISNULL(${a}.NOM_EN, ${a}.NOM_VINC)`  : `${a}.NOM_VINC`;
  const nomCiiu  = (a) => lang === 'en' ? `ISNULL(${a}.NOM_EN, ${a}.NOM_CIIU)`  : `${a}.NOM_CIIU`;
  const nomTpcta = (a) => lang === 'en' ? `ISNULL(${a}.NOM_EN, ${a}.NOM_TPCTA)` : `${a}.NOM_TPCTA`;

  try {
    const pool = await getPool();
    const q = async (query) => {
      const rq = pool.request();
      rq.input('COD_EMPR', sql.SmallInt, COD_EMPR);
      rq.input('COD_TERC', sql.BigInt,   codTerc);
      return (await rq.query(query)).recordset;
    };

    const [personales, financiera, bancaria, pepAct, documentos, participacion] = await Promise.all([

      // ── Datos personales (GN_TERCE + GN_NATUR) ───────────────────────────
      q(`SELECT
          ${nomTpdoc('td')}                             AS [${L('Tipo de documento','Document type')}],
          t.NUM_IDEN                                    AS [${L('Número de identificación','Identification number')}],
          LTRIM(RTRIM(ISNULL(t.NOM_TERC,'')))           AS [${L('Primer nombre','First name')}],
          LTRIM(RTRIM(ISNULL(t.SEG_NOMB,'')))           AS [${L('Segundo nombre','Second name')}],
          LTRIM(RTRIM(ISNULL(t.APE_TERC,'')))           AS [${L('Primer apellido','Last name')}],
          LTRIM(RTRIM(ISNULL(t.SEG_APEL,'')))           AS [${L('Segundo apellido','Second last name')}],
          LTRIM(RTRIM(ISNULL(t.DIR_TERC,'')))           AS [${L('Dirección','Address')}],
          LTRIM(RTRIM(ISNULL(t.TEL_TERC,'')))           AS [${L('Teléfono celular','Mobile')}],
          LTRIM(RTRIM(ISNULL(t.TEL_TERC2,'')))          AS [${L('Teléfono fijo','Phone')}],
          t.DIR_MAIL                                    AS [${L('Email','Email')}],
          ISNULL(${nomVinc('v')}, n.TIP_VINC)           AS [${L('Tipo de vinculación','Relationship type')}],
          n.MAIL_SARL                                   AS [${L('Email SAGRILAFT','SAGRILAFT email')}],
          ISNULL(${nomPais('pn')},'')                   AS [${L('Nacionalidad','Nationality')}],
          ISNULL(n.OTR_NACIO,'')                        AS [${L('Otra nacionalidad','Other nationality')}],
          ISNULL(n.ACT_PRINC,'')                        AS [${L('Actividad principal','Main activity')}],
          ISNULL(n.COD_CIIU,'') + CASE WHEN ${nomCiiu('ci')} IS NOT NULL THEN ' — ' + ${nomCiiu('ci')} ELSE '' END
                                                        AS [${L('Actividad CIIU','CIIU activity')}],
          ISNULL(n.OTR_CIIU,'')                         AS [${L('Otra actividad CIIU','Other CIIU activity')}],
          CONVERT(varchar, n.FEC_EXPE, 103)             AS [${L('Fecha de expedición del documento','Document issuance date')}],
          ISNULL(${nomPais('pp')},'')                   AS [${L('País de expedición','Country of issuance')}],
          ISNULL(n.OTR_PAIS_EXP,'')                     AS [${L('Otro país de expedición','Other country of issuance')}],
          ISNULL(dp.NOM_DEPT,'')                        AS [${L('Departamento de expedición','State/Dept. of issuance')}],
          ISNULL(mn.NOM_MUNI,'')                        AS [${L('Ciudad de expedición','City of issuance')}]
        FROM GN_TERCE t
          JOIN GN_NATUR n  ON n.COD_EMPR = t.COD_EMPR AND n.COD_TERC = t.COD_TERC
          LEFT JOIN MAE_TPDOC td ON td.COD_TPDOC = t.COD_TPDOC
          LEFT JOIN MAE_VINC   v ON CAST(v.COD_VINC AS VARCHAR) = n.TIP_VINC
          LEFT JOIN MAE_PAIS  pn ON pn.COD_PAIS = n.COD_NACIO
          LEFT JOIN MAE_CIIU  ci ON ci.COD_CIIU  = n.COD_CIIU
          LEFT JOIN MAE_PAIS  pp ON pp.COD_PAIS  = n.COD_PAIS_EXP
          LEFT JOIN MAE_DEPT  dp ON dp.COD_DEPT  = n.COD_DEPT_EXP
          LEFT JOIN MAE_MUNI  mn ON mn.COD_MUNI  = n.COD_MPIO_EXP
        WHERE t.COD_EMPR = @COD_EMPR AND t.COD_TERC = @COD_TERC
          AND t.TIP_TERC = 'N'`),

      // ── Información financiera ────────────────────────────────────────────
      q(`SELECT
          ACT_TOTAL  AS [${L('Activos totales ($)','Total assets ($)')}],
          ING_MENS   AS [${L('Ingresos mensuales ($)','Monthly income ($)')}],
          PAS_TOTAL  AS [${L('Pasivos totales ($)','Total liabilities ($)')}],
          EGR_MENS   AS [${L('Egresos mensuales ($)','Monthly expenses ($)')}],
          PATRIMONIO AS [${L('Patrimonio ($)','Net worth ($)')}],
          OTR_ING    AS [${L('Otros ingresos ($)','Other income ($)')}]
        FROM GN_NATUR_FIN
        WHERE COD_EMPR = @COD_EMPR AND COD_TERC = @COD_TERC`),

      // ── Cuentas bancarias ─────────────────────────────────────────────────
      q(`SELECT
          mb.NOM_BANCO                                  AS [${L('Entidad bancaria','Bank')}],
          ISNULL(${nomTpcta('tc')},'')                  AS [${L('Tipo de cuenta','Account type')}],
          b.NUM_CUEN                                    AS [${L('Número de cuenta','Account number')}],
          CASE b.CUEN_EXTR WHEN 'S' THEN '${L('Sí','Yes')}' ELSE 'No' END
                                                        AS [${L('¿Cuenta extranjera?','Foreign account?')}],
          ISNULL(b.NOM_ENT_EXT,'')                      AS [${L('Nombre entidad extranjera','Foreign entity name')}],
          ISNULL(b.TIP_CUE_EXT,'')                      AS [${L('Tipo cuenta extranjera','Foreign account type')}],
          ISNULL(${nomPais('px')},'')                   AS [${L('País cuenta extranjera','Foreign account country')}],
          ISNULL(b.OTR_PAIS_EXT,'')                     AS [${L('Otro país cuenta extranjera','Other foreign account country')}]
        FROM GN_TERCE_BANCO b
          LEFT JOIN MAE_BANCO mb ON mb.COD_BANCO = b.COD_BANCO
          LEFT JOIN MAE_TPCTA tc ON tc.COD_TPCTA = b.TIP_CUEN
          LEFT JOIN MAE_PAIS  px ON px.COD_PAIS  = b.COD_PAIS_EXT
        WHERE b.COD_EMPR = @COD_EMPR AND b.COD_TERC = @COD_TERC`),

      // ── PEP y Actividades con activos virtuales ───────────────────────────
      q(`SELECT
          CASE p.MAN_RPUB WHEN 'S' THEN '${L('Sí','Yes')}' ELSE 'No' END AS [${L('¿Maneja recursos públicos?','Handles public resources?')}],
          CASE p.CAR_PUBL WHEN 'S' THEN '${L('Sí','Yes')}' ELSE 'No' END AS [${L('¿Ejerció cargo público?','Held public office?')}],
          CASE a.ACT_VA_FIAT  WHEN 'S' THEN '${L('Sí','Yes')}' ELSE 'No' END AS [${L('Compra/venta activos virtuales (fiat)','Purchase/sale of virtual assets (fiat)')}],
          CASE a.ACT_VA_VA    WHEN 'S' THEN '${L('Sí','Yes')}' ELSE 'No' END AS [${L('Compra/venta activos virtuales (VA x VA)','Purchase/sale of virtual assets (VA x VA)')}],
          CASE a.ACT_TRANS    WHEN 'S' THEN '${L('Sí','Yes')}' ELSE 'No' END AS [${L('Transferencia y canje de activos virtuales','Transfer and exchange of virtual assets')}],
          CASE a.ACT_CUSTO    WHEN 'S' THEN '${L('Sí','Yes')}' ELSE 'No' END AS [${L('Custodia de activos virtuales','Custody of virtual assets')}],
          CASE a.ACT_SERV_FIN WHEN 'S' THEN '${L('Sí','Yes')}' ELSE 'No' END AS [${L('Servicios financieros para PSAV','Financial services for VASPs')}],
          CASE a.ACT_SERV_VAP WHEN 'S' THEN '${L('Sí','Yes')}' ELSE 'No' END AS [${L('Servicios de participación VAP','VAP participation services')}],
          CASE a.CERT_INFO    WHEN 'S' THEN '${L('Sí','Yes')}' ELSE 'No' END AS [${L('Certifica veracidad de la información','Certifies accuracy of information')}]
        FROM GN_NATUR_PEP p
          LEFT JOIN GN_NATUR_ACT a ON a.COD_EMPR = p.COD_EMPR AND a.COD_TERC = p.COD_TERC
        WHERE p.COD_EMPR = @COD_EMPR AND p.COD_TERC = @COD_TERC`),

      // ── Documentos adjuntos ───────────────────────────────────────────────
      q(`SELECT
          d.TIP_DOC                                     AS [${L('Tipo de documento','Document type')}],
          ISNULL(d.NOM_DOC,'')                          AS [${L('Nombre del documento','Document name')}],
          ISNULL(d.NOM_ARCH,'')                         AS [${L('Nombre del archivo','File name')}],
          CONVERT(varchar, d.FEC_CARG, 103)             AS [${L('Fecha de carga','Upload date')}],
          '/api/documentos/' + t.NUM_IDEN + '/' + d.TIP_DOC
                                                        AS [URL de descarga]
        FROM GN_TERCE_DOC d
          JOIN GN_TERCE t ON t.COD_EMPR = d.COD_EMPR AND t.COD_TERC = d.COD_TERC
        WHERE d.COD_EMPR = @COD_EMPR AND d.COD_TERC = @COD_TERC`),

      // ── Participación en sociedades ───────────────────────────────────────
      q(`SELECT
          CASE n.PART_SOC WHEN 'S' THEN '${L('Sí','Yes')}' ELSE 'No' END
                                              AS [${L('¿Tiene participación en alguna sociedad?','Holds participation in a company?')}],
          ISNULL(n.RAZ_SOC,'')               AS [${L('Razón social de la sociedad','Company name')}],
          ISNULL(${nomTpdoc('td')}, '')       AS [${L('Tipo de documento (NIT o equiv.)','Document type (NIT or equiv.)')}],
          ISNULL(n.NUM_DOC_SOC,'')           AS [${L('Número de documento','Document number')}]
        FROM GN_NATUR n
          LEFT JOIN MAE_TPDOC td ON td.COD_TPDOC = n.TIP_DOC_SOC
        WHERE n.COD_EMPR = @COD_EMPR AND n.COD_TERC = @COD_TERC`),
    ]);

    // ── Construir libro Excel ─────────────────────────────────────────────────
    const wb    = new ExcelJS.Workbook();
    wb.creator  = 'SAGRILAFT Sistema';
    wb.created  = new Date();

    const PRIMARY      = '0C6B8C';
    const HEADER_BG    = 'E5F5FA';
    const ACCENT       = '20A7C9';
    const CURRENCY_FMT = '#,##0.00';
    const NO_DATA_MSG  = L('No se registraron datos para esta sección.', 'No data recorded for this section.');
    const _hasVal = v => v !== null && v !== undefined && String(v).trim() !== '';

    function addSheetN(name, rows, currencyColumns = []) {
      const ws = wb.addWorksheet(name);
      if (!rows || rows.length === 0) {
        ws.getColumn(1).width = 40;
        ws.mergeCells('A1:B1');
        const tc = ws.getCell('A1');
        tc.value = name;
        tc.font  = { bold: true, size: 13, color: { argb: 'FF' + PRIMARY } };
        tc.alignment = { horizontal: 'center' };
        tc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + HEADER_BG } };
        const nr = ws.addRow([NO_DATA_MSG]);
        nr.getCell(1).font = { italic: true, color: { argb: 'FF888888' } };
        return;
      }
      const allCols = Object.keys(rows[0]);

      if (rows.length === 1) {
        // Single-record: key-value layout — skip rows whose value is empty
        const filledCols = allCols.filter(c => _hasVal(rows[0][c]));
        if (filledCols.length === 0) {
          ws.getColumn(1).width = 40;
          ws.mergeCells('A1:B1');
          const tc = ws.getCell('A1');
          tc.value = name;
          tc.font  = { bold: true, size: 13, color: { argb: 'FF' + PRIMARY } };
          tc.alignment = { horizontal: 'center' };
          tc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + HEADER_BG } };
          ws.addRow([NO_DATA_MSG]).getCell(1).font = { italic: true, color: { argb: 'FF888888' } };
          return;
        }
        ws.getColumn(1).width = 38;
        ws.getColumn(2).width = 42;
        ws.mergeCells('A1:B1');
        const tc = ws.getCell('A1');
        tc.value = name;
        tc.font  = { bold: true, size: 13, color: { argb: 'FF' + PRIMARY } };
        tc.alignment = { horizontal: 'center' };
        tc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + HEADER_BG } };

        const hRow = ws.addRow([L('Campo', 'Field'), L('Valor', 'Value')]);
        hRow.eachCell(cell => {
          cell.font  = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + ACCENT } };
          cell.alignment = { horizontal: 'center' };
        });

        filledCols.forEach((col, i) => {
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
        // Multi-record: table layout — keep only columns with at least one non-empty value
        const cols = allCols.filter(c => rows.some(r => _hasVal(r[c])));
        if (cols.length === 0) {
          ws.getColumn(1).width = 40;
          ws.mergeCells('A1:B1');
          const tc = ws.getCell('A1');
          tc.value = name;
          tc.font  = { bold: true, size: 13, color: { argb: 'FF' + PRIMARY } };
          tc.alignment = { horizontal: 'center' };
          tc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + HEADER_BG } };
          ws.addRow([NO_DATA_MSG]).getCell(1).font = { italic: true, color: { argb: 'FF888888' } };
          return;
        }
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

    const CURRENCY_COLS = [
      L('Activos totales ($)','Total assets ($)'),
      L('Ingresos mensuales ($)','Monthly income ($)'),
      L('Pasivos totales ($)','Total liabilities ($)'),
      L('Egresos mensuales ($)','Monthly expenses ($)'),
      L('Patrimonio ($)','Net worth ($)'),
      L('Otros ingresos ($)','Other income ($)'),
    ];

    addSheetN(L('Datos Personales','Personal Information'),           personales);
    addSheetN(L('Información Financiera','Financial Information'),    financiera, CURRENCY_COLS);
    addSheetN(L('Cuentas Bancarias','Bank Accounts'),                 bancaria);
    addSheetN(L('PEP y Actividades','PEP and Activities'),            pepAct);
    addSheetN(L('Participación en Sociedades','Company Participation'), participacion);

    // ── Hoja de documentos con hipervínculo ───────────────────────────────────
    const URL_COL     = 'URL de descarga';
    const FILE_COL    = L('Nombre del archivo', 'File name');
    const DOC_SHEET   = L('Documentos Adjuntos', 'Attached Documents');
    const LINK_HEADER = L('Acceder al archivo', 'Open file');

    if (documentos.length > 0) {
      const wsDoc = wb.addWorksheet(DOC_SHEET);
      const dCols = Object.keys(documentos[0]).filter(c => c !== URL_COL);
      const allCols = [...dCols, LINK_HEADER];

      wsDoc.mergeCells(1, 1, 1, allCols.length);
      const tCell = wsDoc.getCell(1, 1);
      tCell.value = DOC_SHEET;
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
        values.push(doc[FILE_COL] || '');
        const dRow = wsDoc.addRow(values);
        if (ri % 2 === 0) {
          dRow.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + HEADER_BG } };
          });
        }
        const urlRel = doc[URL_COL] || '';
        if (urlRel && doc[FILE_COL]) {
          const linkCell = dRow.getCell(allCols.length);
          linkCell.value = { text: doc[FILE_COL], hyperlink: baseUrl + urlRel };
          linkCell.font  = { color: { argb: 'FF0563C1' }, underline: true };
        }
      });

      allCols.forEach((col, colIdx) => {
        wsDoc.getColumn(colIdx + 1).width = Math.min(Math.max(col.length + 4, 16), 45);
      });
    } else {
      const wsDoc = wb.addWorksheet(DOC_SHEET);
      wsDoc.addRow([L('Sin documentos adjuntos registrados.', 'No attached documents registered.')]);
    }

    // ── Guardar copia en disco y enviar ───────────────────────────────────────
    const FNAME_KEY = L('Primer nombre', 'First name');
    const LNAME_KEY = L('Primer apellido', 'Last name');
    const nomComp = ((personales[0]?.[FNAME_KEY] || '') + ' ' + (personales[0]?.[LNAME_KEY] || '') || `TERC_${codTerc}`)
      .replace(/[^a-zA-Z0-9_\-\s]/g, '').trim().replace(/\s+/g, '_');
    const filename = `SAGRILAFT_Natural_${nomComp}_${new Date().toISOString().slice(0,10)}.xlsx`;

    const buf = await wb.xlsx.writeBuffer();
    try {
      const expDir = path.join(UPLOAD_DIR, 'exports', String(codTerc));
      fs.mkdirSync(expDir, { recursive: true });
      fs.writeFileSync(path.join(expDir, filename), buf);
    } catch (saveErr) {
      console.warn('[exportar-excel-natural] No se pudo guardar copia local:', saveErr.message);
    }

    res.setHeader('Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buf);

  } catch (err) {
    console.error('GET /api/exportar-excel-natural:', err);
    _responderError(res, err, req, 'exportar-excel');
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
  upload.any(),      // Capa 1: multer (tamaño + fieldname + extensión)
  _mwValidarMime,    // Capa 2: magic bytes — verifica contenido real del archivo
  async (req, res) => {
    const numIden = req.params.numIden;

    if (!numIden) return res.status(400).json({ error: 'numIden requerido' });
    if (!req.files || req.files.length === 0)
      return res.status(400).json({ error: 'No se recibieron archivos' });

    try {
      const pool = await getPool();

      // Buscar el COD_TERC correspondiente al NUM_IDEN
      const tercResult = await pool.request()
        .input('COD_EMPR', sql.SmallInt,    COD_EMPR)
        .input('NUM_IDEN', sql.VarChar(20), numIden)
        .query(`SELECT TOP 1 COD_TERC FROM GN_TERCE
                WHERE COD_EMPR = @COD_EMPR AND NUM_IDEN = @NUM_IDEN`);

      if (!tercResult.recordset.length)
        return res.status(404).json({ error: `No se encontró el tercero ${numIden}` });

      const COD_TERC = tercResult.recordset[0].COD_TERC;

      // Mapas para nombres legibles en BD
      const _nomDocLegible = {
        'DOC_ID_RL':   'Doc. identidad Representante Legal Principal',
        'DOC_ID_RL_1': 'Doc. identidad Representante Legal Suplente 1',
        'DOC_ID_RL_2': 'Doc. identidad Representante Legal Suplente 2',
        'DOC_ID_RL_3': 'Doc. identidad Representante Legal Suplente 3',
        'EST_FIN_1':   'Estados financieros — Penúltimo año fiscal',
        'EST_FIN_2':   'Estados financieros — Último año fiscal',
        'RUT':         'RUT — Registro Único Tributario',
        'CERT_BANC':   'Certificación bancaria',
        'CERT_EXIS':   'Certificado de existencia y representación',
        'CERT_ACCI':   'Certificado de composición accionaria',
        'CART_ACEP':   'Carta de aceptación y autorización',
        'ARCH_FIRMA':  'Firma del representante legal',
        'DOC_ID_RL':   'Doc. identidad del Representante Legal',
        'EST_FIN':     'Estados financieros',
      };

      // Insertar o actualizar cada archivo en GN_TERCE_DOC
      const guardados = [];
      for (const file of req.files) {
        // DOC_ID_RL_0 es el RL principal — se almacena con la clave canónica DOC_ID_RL
        const tipDoc  = file.fieldname === 'DOC_ID_RL_0' ? 'DOC_ID_RL' : file.fieldname;
        const nomArch = file.originalname;
        const extArch = path.extname(nomArch).replace('.', '').toLowerCase();
        const anio    = new Date().getFullYear();

        // Clave canónica — usada como ruta relativa local y como key en R2
        const clave   = `${anio}/${numIden}/${tipDoc}.pdf`;
        const dirDst  = path.join(UPLOAD_DIR, String(anio), String(numIden));
        const pathDst = path.join(dirDst, `${tipDoc}.pdf`);

        // 1. Almacenamiento local principal (organizado por año para purga anual)
        if (!fs.existsSync(dirDst)) fs.mkdirSync(dirDst, { recursive: true });
        try {
          fs.renameSync(file.path, pathDst);           // atómico si mismo disco
        } catch {
          fs.copyFileSync(file.path, pathDst);
          try { fs.unlinkSync(file.path); } catch (_) {}
        }

        // 2. Backup en R2 (opcional — fallo no bloquea el guardado)
        if (_r2Client) {
          _r2Subir(pathDst, clave).catch(r2Err =>
            console.warn(`⚠️ R2 backup falló para ${clave}:`, r2Err.message)
          );
        }

        const rutDoc = clave; // clave relativa guardada en BD

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
            .input('NOM_DOC',  sql.VarChar(120),_nomDocLegible[tipDoc] || tipDoc)
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
      _responderError(res, err, req, 'documentos');
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
    const pool = await getPool();

    const result = await pool.request()
      .input('COD_EMPR', sql.SmallInt,    COD_EMPR)
      .input('NUM_IDEN', sql.VarChar(20), numIden)
      .input('TIP_DOC',  sql.VarChar(20), tipDoc)
      .query(`SELECT d.RUT_DOC, d.NOM_ARCH, d.EXT_ARCH, d.FEC_CARG
              FROM GN_TERCE_DOC d
                JOIN GN_TERCE t ON t.COD_EMPR = d.COD_EMPR AND t.COD_TERC = d.COD_TERC
              WHERE t.COD_EMPR = @COD_EMPR
                AND t.NUM_IDEN = @NUM_IDEN
                AND d.TIP_DOC  = @TIP_DOC`);

    if (!result.recordset.length)
      return res.status(404).json({ error: 'Documento no encontrado' });

    const { RUT_DOC, NOM_ARCH, FEC_CARG } = result.recordset[0];

    // ── Registros legacy con ruta absoluta (anteriores al sistema de claves) ──
    if (_esRutaLocal(RUT_DOC)) {
      if (!fs.existsSync(RUT_DOC))
        return res.status(404).json({ error: 'Archivo no encontrado en el servidor' });
      res.setHeader('Content-Disposition', `inline; filename="${NOM_ARCH}"`);
      return res.sendFile(RUT_DOC);
    }

    // ── Nuevos registros: clave relativa ({AÑO}/{numIden}/{TIPODOC}.pdf) ──────
    // 1. Intentar local primero (fuente de verdad)
    const localPath = path.join(UPLOAD_DIR, RUT_DOC);
    if (fs.existsSync(localPath)) {
      res.setHeader('Content-Disposition', `inline; filename="${NOM_ARCH}"`);
      return res.sendFile(localPath);
    }

    // 2. Fallback a R2 si está configurado (archivo purgado localmente pero backup disponible)
    if (_r2Client) {
      try {
        const url = await _r2UrlFirmada(RUT_DOC, NOM_ARCH);
        return res.redirect(302, url);
      } catch (r2Err) {
        console.warn(`R2 fallback falló para ${RUT_DOC}:`, r2Err.message);
      }
    }

    // 3. Archivo no disponible en ningún almacenamiento (fue purgado)
    const fecStr = FEC_CARG ? new Date(FEC_CARG).toLocaleDateString('es-CO') : 'fecha desconocida';
    return res.status(410).json({
      error: 'Archivo eliminado del almacenamiento provisional',
      detalle: `El documento fue cargado el ${fecStr} y ya no está disponible. El registro en base de datos se conserva.`,
    });

  } catch (err) {
    console.error('GET /api/documentos:', err);
    _responderError(res, err, req);
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
app.get('/api/exportar-consolidado-natural', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
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
          n.MAIL_SARL                                   AS [Email SAGRILAFT],
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
    wb.creator = 'SAGRILAFT'; wb.created = new Date();

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
    _responderError(res, err, req);
  }
});

/**
 * GET /api/exportar-consolidado-juridica
 * Genera un Excel con TODOS los registros de Persona Jurídica (TIP_TERC='E').
 */
app.get('/api/exportar-consolidado-juridica', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();

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
            j.MAIL_SARL                                   AS [Email SAGRILAFT],
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
    wb.creator = 'SAGRILAFT'; wb.created = new Date();

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
    _responderError(res, err, req);
  }
});

// ─── Purga anual de archivos ──────────────────────────────────────────────────
/**
 * DELETE /api/admin/purgar-archivos/:anio
 *
 * Elimina los archivos físicos del año indicado (disco local y R2 si aplica).
 * Los registros en GN_TERCE_DOC se mantienen intactos — solo se borran binarios.
 * Requiere la cabecera: x-admin-token: <ADMIN_TOKEN del .env>
 *
 * Ejemplo: DELETE /api/admin/purgar-archivos/2024
 */
app.delete('/api/admin/purgar-archivos/:anio', async (req, res) => {
  const token = req.headers['x-admin-token'];
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN)
    return res.status(401).json({ error: 'Token de administración inválido o no configurado' });

  const anio = parseInt(req.params.anio, 10);
  if (isNaN(anio) || anio < 2020 || anio > 2100)
    return res.status(400).json({ error: 'Año fuera de rango válido (2020–2100)' });

  const resultado = { anio, disco: null, r2: null, errores: [] };

  // 1. Eliminar carpeta local del año
  const dirAnio = path.join(UPLOAD_DIR, String(anio));
  if (fs.existsSync(dirAnio)) {
    try {
      fs.rmSync(dirAnio, { recursive: true, force: true });
      resultado.disco = `Carpeta ${dirAnio} eliminada`;
      console.log(`🗑️ Purga anual — carpeta local eliminada: ${dirAnio}`);
    } catch (err) {
      resultado.errores.push(`Disco: ${err.message}`);
    }
  } else {
    resultado.disco = 'Sin archivos locales para ese año';
  }

  // 2. Eliminar objetos del año en R2 (si está configurado)
  if (_r2Client) {
    let totalPurgados = 0;
    try {
      let ContinuationToken;
      do {
        const listRes = await _r2Client.send(new ListObjectsV2Command({
          Bucket: _R2_BUCKET, Prefix: `${anio}/`, ContinuationToken,
        }));
        if (listRes.Contents && listRes.Contents.length > 0) {
          await _r2Client.send(new DeleteObjectsCommand({
            Bucket: _R2_BUCKET,
            Delete: { Objects: listRes.Contents.map(o => ({ Key: o.Key })) },
          }));
          totalPurgados += listRes.Contents.length;
        }
        ContinuationToken = listRes.NextContinuationToken;
      } while (ContinuationToken);
      resultado.r2 = `${totalPurgados} objeto(s) eliminado(s) de R2`;
    } catch (r2Err) {
      resultado.errores.push(`R2: ${r2Err.message}`);
    }
  } else {
    resultado.r2 = 'R2 no configurado';
  }

  resultado.nota = 'Los registros en GN_TERCE_DOC no fueron modificados.';
  res.json({ success: resultado.errores.length === 0, ...resultado });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  PERSONA NATURAL — Actualizar registro existente
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * PUT /api/actualizar-completo-natural
 * Actualiza GN_TERCE, GN_NATUR y re-inserta las tablas hijas de persona natural.
 * Acepta el mismo payload que POST /api/guardar-completo-natural.
 */
app.put('/api/actualizar-completo-natural', async (req, res) => {
  const b = req.body;
  const codigoEdicion = req.headers['x-codigo-edicion'] || '';
  if (!b.NUM_IDEN || !b.NOM_TERC || !b.APE_TERC)
    return res.status(400).json({ error: 'Faltan campos obligatorios (NUM_IDEN, NOM_TERC, APE_TERC).' });

  const errVal = _validarCampos([
    () => _validarTexto(b.NUM_IDEN,  'Número de identificación', 20),
    () => _validarTexto(b.NOM_TERC,  'Primer nombre',            40),
    () => _validarTexto(b.APE_TERC,  'Primer apellido',          40),
    () => _validarTexto(b.DIR_TERC,  'Dirección',               120),
    () => _validarTexto(b.DIR_MAIL,  'Email corporativo',       150),
    () => _validarTexto(b.MAIL_SARL, 'Email SAGRILAFT',           150),
    () => b.FEC_EXPE ? _validarFecha(b.FEC_EXPE, 'Fecha de expedición') : null,
    () => b.FEC_NACI ? _validarFecha(b.FEC_NACI, 'Fecha de nacimiento') : null,
  ]);
  if (errVal.length)
    return res.status(400).json({ error: 'Errores de validación', detalles: errVal });

  const toInt  = v => { if (v === null || v === undefined || v === '' || v === 'NA') return null; const n = parseInt(v, 10); return isNaN(n) ? null : n; };
  const toDec  = v => (v !== null && v !== undefined && v !== '')               ? parseFloat(v)   : null;
  const toChar = v => v || null;
  const fin    = b.financiera || {};
  const pep    = b.pep        || {};
  const act    = b.actividades || {};

  let pool, transaction;
  try {
    pool = await getPool();

    // ── Verificar código de edición ──────────────────────────────────────────
    const editRow = await pool.request()
      .input('COD_EMPR', sql.SmallInt,    COD_EMPR)
      .input('NUM_IDEN', sql.VarChar(20), b.NUM_IDEN)
      .query(`SELECT COD_EDIT FROM GN_TERCE WHERE COD_EMPR=@COD_EMPR AND NUM_IDEN=@NUM_IDEN`);
    if (editRow.recordset.length) {
      const codEdit = (editRow.recordset[0].COD_EDIT || '').trim();
      if (codEdit) {
        if (!codigoEdicion)
          return res.status(401).json({ error: 'codigoRequerido', mensaje: 'Código de edición requerido.' });
        if (_hashCodigo(codigoEdicion.trim()) !== codEdit)
          return res.status(403).json({ error: 'codigoInvalido', mensaje: 'Código de edición incorrecto.' });
      } else {
        if (!req.session || !req.session.isAdmin)
          return res.status(401).json({ error: 'adminRequerido', mensaje: 'Este registro requiere sesión de administrador para editar.' });
      }
    }
    // ── Fin verificación ─────────────────────────────────────────────────────

    const lookup = await pool.request()
      .input('COD_EMPR', sql.SmallInt,    COD_EMPR)
      .input('NUM_IDEN', sql.VarChar(20), b.NUM_IDEN)
      .query(`SELECT COD_TERC FROM GN_TERCE WHERE COD_EMPR=@COD_EMPR AND NUM_IDEN=@NUM_IDEN AND TIP_TERC='N'`);
    if (!lookup.recordset.length)
      return res.status(404).json({ error: `No se encontró persona natural con documento ${b.NUM_IDEN}` });
    const COD_TERC = lookup.recordset[0].COD_TERC;

    transaction = new sql.Transaction(pool);
    await transaction.begin();
    const r = () => new sql.Request(transaction);

    // 1. UPDATE GN_TERCE
    const nomComp = [b.NOM_TERC, b.SEG_NOMB, b.APE_TERC, b.SEG_APEL].filter(Boolean).join(' ');
    await r()
      .input('COD_EMPR',   sql.SmallInt,    COD_EMPR)
      .input('COD_TERC',   sql.BigInt,      COD_TERC)
      .input('COD_TPDOC',  sql.Int,         toInt(b.COD_TPDOC) || 8)
      .input('NOM_TERC',   sql.Char(40),    (b.NOM_TERC || '').substring(0, 40))
      .input('SEG_NOMB',   sql.VarChar(40), b.SEG_NOMB || null)
      .input('APE_TERC',   sql.Char(40),    (b.APE_TERC || '').substring(0, 40))
      .input('SEG_APEL',   sql.VarChar(40), b.SEG_APEL || null)
      .input('NOM_COMP',   sql.VarChar(240),nomComp.substring(0, 240))
      .input('DIR_TERC',   sql.Char(120),   b.DIR_TERC  || null)
      .input('TEL_TERC',   sql.Char(30),    b.TEL_TERC  || null)
      .input('TEL_TERC2',  sql.Char(40),    b.TEL_TERC2 || null)
      .input('DIR_MAIL',   sql.VarChar(150),b.DIR_MAIL  || null)
      .query(`UPDATE GN_TERCE
              SET COD_TPDOC=@COD_TPDOC, NOM_TERC=@NOM_TERC, SEG_NOMB=@SEG_NOMB,
                  APE_TERC=@APE_TERC, SEG_APEL=@SEG_APEL, NOM_COMP=@NOM_COMP,
                  DIR_TERC=@DIR_TERC, TEL_TERC=@TEL_TERC, TEL_TERC2=@TEL_TERC2, DIR_MAIL=@DIR_MAIL
              WHERE COD_EMPR=@COD_EMPR AND COD_TERC=@COD_TERC`);

    // 2. UPDATE GN_NATUR
    await r()
      .input('COD_EMPR',    sql.SmallInt,    COD_EMPR)
      .input('COD_TERC',    sql.BigInt,      COD_TERC)
      .input('TIP_VINC',    sql.VarChar(40), toChar(b.COD_VINC))
      .input('MAIL_SARL',   sql.VarChar(150),b.MAIL_SARL   || null)
      .input('COD_NACIO',   sql.Int,         toInt(b.COD_NACIO))
      .input('OTR_NACIO',   sql.VarChar(100),toChar(b.OTR_NACIO))
      .input('ACT_PRINC',   sql.VarChar(100),b.ACT_PRINC   || null)
      .input('COD_CIIU',    sql.VarChar(10), b.COD_CIIU    || null)
      .input('OTR_CIIU',    sql.VarChar(255),toChar(b.OTR_CIIU))
      .input('FEC_EXPE',    sql.Date,        b.FEC_EXPE ? new Date(b.FEC_EXPE) : null)
      .input('COD_PAIS_EXP', sql.Int,          toInt(b.COD_PAIS_EXP))
      .input('OTR_PAIS_EXP', sql.VarChar(100), toChar(b.OTR_PAIS_EXP))
      .input('COD_DEPT_EXP', sql.Int,          toInt(b.COD_DEPT_EXP))
      .input('COD_MPIO_EXP', sql.Int,          toInt(b.COD_MPIO_EXP))
      .input('PART_SOC',    sql.Char(1),       b.PART_SOC    || 'N')
      .input('RAZ_SOC',     sql.NVarChar(200), b.PART_SOC === 'S' ? (b.RAZ_SOC     || null) : null)
      .input('TIP_DOC_SOC', sql.Int,           b.PART_SOC === 'S' ? (toInt(b.TIP_DOC_SOC)) : null)
      .input('NUM_DOC_SOC', sql.VarChar(20),   b.PART_SOC === 'S' ? (b.NUM_DOC_SOC  || null) : null)
      .query(`UPDATE GN_NATUR
              SET TIP_VINC=@TIP_VINC, MAIL_SARL=@MAIL_SARL, COD_NACIO=@COD_NACIO, OTR_NACIO=@OTR_NACIO,
                  ACT_PRINC=@ACT_PRINC, COD_CIIU=@COD_CIIU, OTR_CIIU=@OTR_CIIU, FEC_EXPE=@FEC_EXPE,
                  COD_PAIS_EXP=@COD_PAIS_EXP, OTR_PAIS_EXP=@OTR_PAIS_EXP,
                  COD_DEPT_EXP=@COD_DEPT_EXP, COD_MPIO_EXP=@COD_MPIO_EXP,
                  PART_SOC=@PART_SOC, RAZ_SOC=@RAZ_SOC, TIP_DOC_SOC=@TIP_DOC_SOC, NUM_DOC_SOC=@NUM_DOC_SOC
              WHERE COD_EMPR=@COD_EMPR AND COD_TERC=@COD_TERC`);

    const del = async tabla => r()
      .input('COD_EMPR', sql.SmallInt, COD_EMPR).input('COD_TERC', sql.BigInt, COD_TERC)
      .query(`DELETE FROM ${tabla} WHERE COD_EMPR=@COD_EMPR AND COD_TERC=@COD_TERC`);

    // 3. GN_NATUR_FIN — reemplazar
    await del('GN_NATUR_FIN');
    await r()
      .input('COD_EMPR',   sql.SmallInt,       COD_EMPR)
      .input('COD_TERC',   sql.BigInt,          COD_TERC)
      .input('ACT_TOTAL',  sql.Decimal(18,2),   fin.ACT_TOTAL  ?? null)
      .input('ING_MENS',   sql.Decimal(18,2),   fin.ING_MENS   ?? null)
      .input('PAS_TOTAL',  sql.Decimal(18,2),   fin.PAS_TOTAL  ?? null)
      .input('EGR_MENS',   sql.Decimal(18,2),   fin.EGR_MENS   ?? null)
      .input('PATRIMONIO', sql.Decimal(18,2),   fin.PATRIMONIO ?? null)
      .input('OTR_ING',    sql.Decimal(18,2),   fin.OTR_ING    ?? null)
      .query(`INSERT INTO GN_NATUR_FIN (COD_EMPR,COD_TERC,ACT_TOTAL,ING_MENS,
              PAS_TOTAL,EGR_MENS,PATRIMONIO,OTR_ING)
              VALUES (@COD_EMPR,@COD_TERC,@ACT_TOTAL,@ING_MENS,
              @PAS_TOTAL,@EGR_MENS,@PATRIMONIO,@OTR_ING)`);

    // 4. GN_TERCE_BANCO — reemplazar
    await del('GN_TERCE_BANCO');
    for (const ban of (Array.isArray(b.bancaria) ? b.bancaria : [])) {
      if (!ban.COD_BANCO) continue;
      await r()
        .input('COD_EMPR',    sql.SmallInt,   COD_EMPR)
        .input('COD_TERC',    sql.BigInt,     COD_TERC)
        .input('COD_BANCO',   sql.Int,        toInt(ban.COD_BANCO))
        .input('TIP_CUEN',    sql.VarChar(20),toChar(ban.TIP_CUEN))
        .input('NUM_CUEN',    sql.VarChar(30),toChar(ban.NUM_CUEN))
        .input('CUEN_EXTR',   sql.Char(1),          ban.CUEN_EXTR || 'N')
        .input('CUENTAS_EXT', sql.NVarChar(sql.MAX), Array.isArray(ban.cuentasExt) && ban.cuentasExt.length > 0 ? JSON.stringify(ban.cuentasExt) : null)
        .query(`INSERT INTO GN_TERCE_BANCO (COD_EMPR,COD_TERC,COD_BANCO,TIP_CUEN,
                NUM_CUEN,CUEN_EXTR,CUENTAS_EXT)
                VALUES (@COD_EMPR,@COD_TERC,@COD_BANCO,@TIP_CUEN,
                @NUM_CUEN,@CUEN_EXTR,@CUENTAS_EXT)`);
    }

    // 5. GN_NATUR_PEP — reemplazar
    await del('GN_NATUR_PEP');
    if (pep.MAN_RPUB || pep.CAR_PUBL) {
      await r()
        .input('COD_EMPR',  sql.SmallInt, COD_EMPR)
        .input('COD_TERC',  sql.BigInt,   COD_TERC)
        .input('MAN_RPUB',  sql.Char(1),  toChar(pep.MAN_RPUB))
        .input('CAR_PUBL',  sql.Char(1),  toChar(pep.CAR_PUBL))
        .query(`INSERT INTO GN_NATUR_PEP (COD_EMPR,COD_TERC,MAN_RPUB,CAR_PUBL)
                VALUES (@COD_EMPR,@COD_TERC,@MAN_RPUB,@CAR_PUBL)`);
    }

    // 6. GN_NATUR_ACT — reemplazar
    await del('GN_NATUR_ACT');
    await r()
      .input('COD_EMPR',     sql.SmallInt, COD_EMPR)
      .input('COD_TERC',     sql.BigInt,   COD_TERC)
      .input('OPER_VA',      sql.Char(1),  act.OPER_VA      || 'N')
      .input('ACT_VA_FIAT',  sql.Char(1),  act.ACT_VA_FIAT  || 'N')
      .input('ACT_VA_VA',    sql.Char(1),  act.ACT_VA_VA    || 'N')
      .input('ACT_TRANS',    sql.Char(1),  act.ACT_TRANS    || 'N')
      .input('ACT_CUSTO',    sql.Char(1),  act.ACT_CUSTO    || 'N')
      .input('ACT_SERV_FIN', sql.Char(1),  act.ACT_SERV_FIN || 'N')
      .input('ACT_SERV_VAP', sql.Char(1),  act.ACT_SERV_VAP || 'N')
      .input('CERT_INFO',    sql.Char(1),  act.CERT_INFO    || 'N')
      .query(`INSERT INTO GN_NATUR_ACT (COD_EMPR,COD_TERC,OPER_VA,ACT_VA_FIAT,ACT_VA_VA,
              ACT_TRANS,ACT_CUSTO,ACT_SERV_FIN,ACT_SERV_VAP,CERT_INFO)
              VALUES (@COD_EMPR,@COD_TERC,@OPER_VA,@ACT_VA_FIAT,@ACT_VA_VA,
              @ACT_TRANS,@ACT_CUSTO,@ACT_SERV_FIN,@ACT_SERV_VAP,@CERT_INFO)`);

    await transaction.commit();
    console.log(`✅ Natural actualizado. COD_TERC=${COD_TERC}, NUM_IDEN=${b.NUM_IDEN}`);
    res.json({ success: true, NUM_IDEN: b.NUM_IDEN, COD_TERC });

  } catch (err) {
    try { await transaction.rollback(); } catch (_) {}
    console.error('PUT /api/actualizar-completo-natural:', err);
    _responderError(res, err, req);
  } finally {
    _liberarEnvio(b.NUM_IDEN);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  BORRADORES — Guardado parcial del formulario en servidor
// ═══════════════════════════════════════════════════════════════════════════════

const BORRADOR_TTL_MS = 72 * 60 * 60 * 1000; // 72 horas

app.post('/api/borrador', async (req, res) => {
  const { tokenDraft, tipTerc, numIdenTxt, datosJson } = req.body || {};
  if (!tipTerc || !datosJson)
    return res.status(400).json({ error: 'tipTerc y datosJson son requeridos.' });
  try {
    const p        = await getPool();
    const fecVenc  = new Date(Date.now() + BORRADOR_TTL_MS);
    const ahora    = new Date();
    if (tokenDraft) {
      const upd = await p.request()
        .input('TOKEN',    sql.UniqueIdentifier, tokenDraft)
        .input('COD_EMPR', sql.SmallInt,         COD_EMPR)
        .input('NUM_IDEN', sql.VarChar(20),       numIdenTxt || null)
        .input('DATOS',    sql.NVarChar(sql.MAX), datosJson)
        .input('FEC_GUAR', sql.DateTime,          ahora)
        .input('FEC_VENC', sql.DateTime,          fecVenc)
        .query(`UPDATE GN_BORRADOR SET NUM_IDEN_TXT=@NUM_IDEN, DATOS_JSON=@DATOS,
                FEC_GUAR=@FEC_GUAR, FEC_VENC=@FEC_VENC
                WHERE TOKEN_DRAFT=@TOKEN AND COD_EMPR=@COD_EMPR`);
      if (upd.rowsAffected[0] > 0)
        return res.json({ success: true, tokenDraft, fechaGuardado: ahora.toISOString() });
    }
    const newToken = crypto.randomUUID();
    await p.request()
      .input('TOKEN',    sql.UniqueIdentifier, newToken)
      .input('COD_EMPR', sql.SmallInt,         COD_EMPR)
      .input('TIP_TERC', sql.Char(1),           tipTerc)
      .input('NUM_IDEN', sql.VarChar(20),       numIdenTxt || null)
      .input('DATOS',    sql.NVarChar(sql.MAX), datosJson)
      .input('FEC_GUAR', sql.DateTime,          ahora)
      .input('FEC_VENC', sql.DateTime,          fecVenc)
      .query(`INSERT INTO GN_BORRADOR
              (TOKEN_DRAFT,COD_EMPR,TIP_TERC,NUM_IDEN_TXT,DATOS_JSON,FEC_GUAR,FEC_VENC)
              VALUES (@TOKEN,@COD_EMPR,@TIP_TERC,@NUM_IDEN,@DATOS,@FEC_GUAR,@FEC_VENC)`);
    res.json({ success: true, tokenDraft: newToken, fechaGuardado: ahora.toISOString() });
  } catch (err) {
    _responderError(res, err, req);
  }
});

app.get('/api/borrador', async (req, res) => {
  const { token, numIden } = req.query;
  if (!token && !numIden)
    return res.status(400).json({ error: 'Proporcione token o numIden.' });
  try {
    const p = await getPool();
    let result;
    if (token) {
      result = await p.request()
        .input('TOKEN',    sql.UniqueIdentifier, token)
        .input('COD_EMPR', sql.SmallInt,         COD_EMPR)
        .query(`SELECT TOKEN_DRAFT, TIP_TERC, NUM_IDEN_TXT, DATOS_JSON, FEC_GUAR
                FROM GN_BORRADOR
                WHERE TOKEN_DRAFT=@TOKEN AND COD_EMPR=@COD_EMPR AND FEC_VENC > GETDATE()`);
    } else {
      result = await p.request()
        .input('NUM_IDEN', sql.VarChar(20), numIden)
        .input('COD_EMPR', sql.SmallInt,    COD_EMPR)
        .query(`SELECT TOP 1 TOKEN_DRAFT, TIP_TERC, NUM_IDEN_TXT, DATOS_JSON, FEC_GUAR
                FROM GN_BORRADOR
                WHERE NUM_IDEN_TXT=@NUM_IDEN AND COD_EMPR=@COD_EMPR AND FEC_VENC > GETDATE()
                ORDER BY FEC_GUAR DESC`);
    }
    if (!result.recordset.length)
      return res.json({ encontrado: false });
    const row = result.recordset[0];
    res.json({
      encontrado:    true,
      tokenDraft:    row.TOKEN_DRAFT,
      tipTerc:       row.TIP_TERC,
      datosJson:     row.DATOS_JSON,
      fechaGuardado: row.FEC_GUAR,
    });
  } catch (err) {
    _responderError(res, err, req);
  }
});

app.delete('/api/borrador', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token requerido.' });
  try {
    const p = await getPool();
    await p.request()
      .input('TOKEN',    sql.UniqueIdentifier, token)
      .input('COD_EMPR', sql.SmallInt,         COD_EMPR)
      .query(`DELETE FROM GN_BORRADOR WHERE TOKEN_DRAFT=@TOKEN AND COD_EMPR=@COD_EMPR`);
    res.json({ success: true });
  } catch (err) {
    _responderError(res, err, req);
  }
});

/* ── Manejador de errores global ─────────────────────────────────────────────── */
// Captura errores de multer (tamaño, fileFilter) y cualquier otro error no manejado.
// Los errores de negocio con status 400 se reenvían al cliente tal cual.
// Los errores internos se enmascaran: el mensaje real solo va a los logs.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err && (err.code === 'LIMIT_FILE_SIZE' || err.name === 'MulterError' || err.status === 400)) {
    // Estos mensajes son seguros: vienen de validaciones propias, no del stack interno
    return res.status(400).json({ error: err.message });
  }
  if (err && err.status === 403) {
    return res.status(403).json({ error: err.message });
  }
  // Cualquier otro error: log real, respuesta genérica
  _responderError(res, err, req, 'global');
});

/* ── Puerto ──────────────────────────────────────────────────────────────────── */
app.listen(PORT, async () => {
  console.log(`\n  🚀  Servidor SAGRILAFT corriendo en http://localhost:${PORT}`);
  console.log(`  🔒  Panel admin: http://localhost:${PORT}/admin\n`);
  // Mostrar solicitudes de cuenta pendientes al desarrollador
  try {
    const p = await getPool();
    const r = await p.request()
      .query(`SELECT COUNT(*) AS N FROM GN_ADMIN_USR WHERE ESTADO='P'`);
    const pendientes = r.recordset[0]?.N || 0;
    if (pendientes > 0) {
      console.log(`  ⚠️  Hay ${pendientes} solicitud(es) de cuenta admin pendiente(s) de aprobación.`);
      console.log(`      Revise el correo de ${SUPER_ADMIN_EMAIL || '(SUPER_ADMIN_EMAIL no configurado)'}\n`);
    }
  } catch (_) {}
});

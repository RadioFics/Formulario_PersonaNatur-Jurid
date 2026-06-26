/**
 * generar-static-data.js — Genera public/js/static-data.js
 *
 * "Congela" todos los catálogos de la BD en un archivo JS estático para que el
 * formulario funcione SIN servidor ni base de datos (demo en hosting estático).
 *
 * Reutiliza la misma configuración de conexión que server.js (vía .env).
 * Ejecutar:  node scripts/generar-static-data.js
 *
 * El interceptor public/js/static-mode.js consume window.STATIC_CATALOGOS.
 */
'use strict';

require('dotenv').config();
const sql  = require('mssql');
const fs   = require('fs');
const path = require('path');

const dbConfig = {
  server:   process.env.DB_SERVER   || 'localhost',
  database: process.env.DB_NAME     || 'MineDax',
  user:     process.env.DB_USER     || 'sa',
  password: process.env.DB_PASSWORD || 'LetItHappen35*',
  options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true },
  pool:    { max: 10, min: 0, idleTimeoutMillis: 30000 },
};

// Cada entrada replica EXACTAMENTE el SELECT del endpoint correspondiente en server.js.
const CONSULTAS = {
  // tipos-documento?todos=1  (todos los tipos)
  tiposDocumentoTodos:
    `SELECT COD_TPDOC, NOM_TPDOC, COD_ABREV, NOM_EN
       FROM MAE_TPDOC WHERE COD_TPDOC > 0 ORDER BY NOM_TPDOC`,
  // tipos-documento  (solo NIT)
  tiposDocumentoNit:
    `SELECT COD_TPDOC, NOM_TPDOC, COD_ABREV, NOM_EN
       FROM MAE_TPDOC WHERE COD_TPDOC = 8 ORDER BY NOM_TPDOC`,
  paises:
    `SELECT COD_PAIS, NOM_PAIS, IND_PRINCI, NOM_EN
       FROM MAE_PAIS WHERE COD_PAIS > 0 AND NOM_PAIS NOT LIKE 'Otro%'
      ORDER BY CASE WHEN IND_PRINCI = 'S' THEN 0 ELSE 1 END, NOM_PAIS`,
  // departamentos: tabla completa; el interceptor filtra por cod_pais
  departamentos:
    `SELECT COD_DEPT, NOM_DEPT, COD_PAIS FROM MAE_DEPT ORDER BY COD_PAIS, NOM_DEPT`,
  // ciudades: tabla completa; el interceptor filtra por cod_dept / cod_pais
  ciudades:
    `SELECT COD_MUNI, NOM_MUNI, COD_DEPT, COD_PAIS FROM MAE_MUNI ORDER BY COD_PAIS, NOM_MUNI`,
  vinculaciones:
    `SELECT COD_VINC, NOM_VINC, COD_ABREV, NOM_EN
       FROM MAE_VINC WHERE COD_VINC IN (3, 4, 9, 10, 11) ORDER BY COD_VINC`,
  ciiu:
    `SELECT COD_CIIU,
            COD_CIIU + ' - ' + NOM_CIIU AS NOM_CIIU,
            CASE WHEN NOM_EN IS NOT NULL AND NOM_EN <> ''
                 THEN COD_CIIU + ' - ' + NOM_EN ELSE NULL END AS NOM_EN
       FROM MAE_CIIU ORDER BY COD_CIIU`,
  // tipos-sociedad: tabla completa; el interceptor filtra por ubicacion (N/E)
  tiposSociedad:
    `SELECT COD_SOCIE, NOM_SOCIE, UBIC_SOCIE, NOM_EN FROM MAE_TIP_SOCIE ORDER BY COD_SOCIE`,
  sistemasPrevencion:
    `SELECT COD_SIST, NOM_SIST, COD_ABREV, NOM_EN FROM MAE_SIST_PREV ORDER BY COD_SIST`,
  bancos:
    `SELECT COD_BANCO, NOM_BANCO FROM MAE_BANCO WHERE ACT_ESTA = 'A' ORDER BY NOM_BANCO`,
  tiposCuenta:
    `SELECT COD_TPCTA, NOM_TPCTA, NOM_EN FROM MAE_TPCTA
      WHERE NOM_TPCTA NOT LIKE '%N%mina%'
        AND NOM_TPCTA NOT LIKE '%lectrónica%'
        AND NOM_TPCTA NOT LIKE '%lectronica%'
      ORDER BY COD_TPCTA`,
  monedas:
    `SELECT COD_MONE, NOM_MONE, INI_MONE, NUM_DECI FROM MAE_MONED
      ORDER BY CASE WHEN COD_MONE = 20 THEN 0 ELSE 1 END, NOM_MONE`,
};

(async () => {
  let pool;
  try {
    console.log(`Conectando a ${dbConfig.server} / ${dbConfig.database}…`);
    pool = await sql.connect(dbConfig);

    const data = {};
    for (const [clave, q] of Object.entries(CONSULTAS)) {
      const r = await pool.request().query(q);
      data[clave] = r.recordset;
      console.log(`  ✓ ${clave}: ${r.recordset.length} filas`);
    }

    const salida = path.join(__dirname, '..', 'public', 'js', 'static-data.js');
    const header =
`/**
 * static-data.js — CATÁLOGOS CONGELADOS (generado automáticamente)
 *
 * Generado por scripts/generar-static-data.js el ${new Date().toISOString()}
 * NO editar a mano. Permite que el formulario funcione sin servidor ni BD.
 * Consumido por public/js/static-mode.js.
 */
'use strict';
window.STATIC_CATALOGOS = `;

    fs.writeFileSync(salida, header + JSON.stringify(data) + ';\n', 'utf8');
    const kb = (fs.statSync(salida).size / 1024).toFixed(1);
    console.log(`\n✅ Escrito ${salida} (${kb} KB)`);
  } catch (err) {
    console.error('❌ Error generando static-data.js:', err.message);
    process.exitCode = 1;
  } finally {
    if (pool) await pool.close();
  }
})();

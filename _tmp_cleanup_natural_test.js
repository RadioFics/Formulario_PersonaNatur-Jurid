require('dotenv').config();
const sql = require('mssql');
const dbConfig = {
  server: process.env.DB_SERVER || 'localhost', database: process.env.DB_NAME || 'MineDax',
  user: process.env.DB_USER || 'sa', password: process.env.DB_PASSWORD || 'LetItHappen35*',
  options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true },
};
async function main() {
  const pool = await sql.connect(dbConfig);
  const COD_EMPR = 1, COD_TERC = 30011;
  for (const tbl of ['GN_NATUR_ACT','GN_NATUR_FIN','GN_NATUR']) {
    try {
      const r = await pool.request().input('C', sql.BigInt, COD_TERC).input('E', sql.SmallInt, COD_EMPR)
        .query(`DELETE FROM ${tbl} WHERE COD_EMPR=@E AND COD_TERC=@C`);
      console.log(tbl, '->', r.rowsAffected[0]);
    } catch (e) { console.log(tbl, '-> skip:', e.message); }
  }
  const r2 = await pool.request().input('C', sql.BigInt, COD_TERC).input('E', sql.SmallInt, COD_EMPR)
    .query(`DELETE FROM GN_TERCE WHERE COD_EMPR=@E AND COD_TERC=@C`);
  console.log('GN_TERCE ->', r2.rowsAffected[0]);
  await pool.close();
}
main().catch(e => { console.error(e.message); process.exit(1); });

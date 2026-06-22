#!/usr/bin/env python3
"""
MineDax Migration Script: SQL Server → PostgreSQL
Generado: 2026-06-22

INSTALACIÓN DE DEPENDENCIAS (en máquina con internet, copiar .whl al servidor):
  pip install pyodbc psycopg2-binary --break-system-packages

USO:
  1. Ajustar las cadenas de conexión abajo.
  2. dry_run = True  → solo cuenta filas, NO inserta.
  3. dry_run = False → migración real.
  4. python minedax_migration_script.py
"""

import pyodbc
import psycopg2
import psycopg2.extras
import sys
import traceback
from datetime import datetime

# ─────────────────────────────────────────────────────────────
# CONFIGURACIÓN DE CONEXIONES — ajustar antes de ejecutar
# ─────────────────────────────────────────────────────────────

# SQL Server (origen)
MSSQL_CONN = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=CM-ITD-P-05\\SQLEXPRESS;"
    "DATABASE=MineDax;"
    "Trusted_Connection=yes;"         # Windows Auth
    # "UID=usuario;PWD=clave;"         # SQL Auth (descomentar si aplica)
)

# PostgreSQL (destino) — ajustar host, puerto, usuario y contraseña
PG_CONN = dict(
    host="localhost",          # o IP del servidor intranet
    port=5432,
    dbname="minedax",          # crear previamente: CREATE DATABASE minedax;
    user="postgres",
    password="CAMBIAR_ESTA_CLAVE",
)

# ─────────────────────────────────────────────────────────────
# PARÁMETROS DE EJECUCIÓN
# ─────────────────────────────────────────────────────────────
dry_run    = True   # True = solo contar, False = migrar datos reales
BATCH_SIZE = 500    # filas por INSERT batch

# ─────────────────────────────────────────────────────────────
# ORDEN DE MIGRACIÓN (maestras primero para respetar FKs)
# ─────────────────────────────────────────────────────────────
TABLES = [('dbo', 'MAE_AFP'), ('dbo', 'MAE_ARL'), ('dbo', 'MAE_BANCO'), ('dbo', 'MAE_CARGO'), ('dbo', 'MAE_CCF'), ('dbo', 'MAE_CCOST'), ('dbo', 'MAE_CEST'), ('dbo', 'MAE_CIIU'), ('dbo', 'MAE_DEPT'), ('dbo', 'MAE_EMPR'), ('dbo', 'MAE_EPS'), ('dbo', 'MAE_ESTA'), ('dbo', 'MAE_ESTCIV'), ('dbo', 'MAE_FCE'), ('dbo', 'MAE_GRSAN'), ('dbo', 'MAE_MONED'), ('dbo', 'MAE_MUNI'), ('dbo', 'MAE_PAIS'), ('dbo', 'MAE_REGLA'), ('dbo', 'MAE_RIESG'), ('dbo', 'MAE_SIST_PREV'), ('dbo', 'MAE_TERC'), ('dbo', 'MAE_TERC_BACKUP'), ('dbo', 'MAE_TIP_SOCIE'), ('dbo', 'MAE_TPCNT'), ('dbo', 'MAE_TPCTA'), ('dbo', 'MAE_TPDOC'), ('dbo', 'MAE_TPLIQ'), ('dbo', 'MAE_VINC'), ('SEC', 'MAE_ROL'), ('dbo', 'GN_ADMIN_USR'), ('dbo', 'GN_BORRADOR'), ('dbo', 'GN_FECHA'), ('dbo', 'GN_FUNCI'), ('dbo', 'GN_GPROV'), ('dbo', 'GN_GUSUA'), ('dbo', 'GN_JURID'), ('dbo', 'GN_JURID_AC'), ('dbo', 'GN_JURID_ACT'), ('dbo', 'GN_JURID_BF'), ('dbo', 'GN_JURID_CUMP'), ('dbo', 'GN_JURID_FIN'), ('dbo', 'GN_JURID_FIRMA'), ('dbo', 'GN_JURID_JD'), ('dbo', 'GN_JURID_OC'), ('dbo', 'GN_JURID_PAIS'), ('dbo', 'GN_JURID_PEP'), ('dbo', 'GN_JURID_RF'), ('dbo', 'GN_JURID_RL'), ('dbo', 'GN_LOG_ACCE'), ('dbo', 'GN_NATUR'), ('dbo', 'GN_NATUR_ACT'), ('dbo', 'GN_NATUR_FIN'), ('dbo', 'GN_NATUR_PEP'), ('dbo', 'GN_PERMI'), ('dbo', 'GN_PROVE'), ('dbo', 'GN_SESION'), ('dbo', 'GN_TERCE'), ('dbo', 'GN_TERCE_BANCO'), ('dbo', 'GN_TERCE_DOC'), ('dbo', 'GN_USUAR'), ('dbo', 'NO_CONCE'), ('dbo', 'NO_NOVED'), ('dbo', 'NO_PERIOD'), ('SEC', 'AUDIT_LOG'), ('SEC', 'BLOQUEO'), ('SEC', 'HIST_NOMINA'), ('SEC', 'MAE_ROL'), ('SEC', 'PERMISOS')]

# ─────────────────────────────────────────────────────────────
# UTILIDADES
# ─────────────────────────────────────────────────────────────
def pg_schema(ss):
    return "public" if ss == "dbo" else ss.lower()

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def get_columns(mssql_cur, schema, table):
    mssql_cur.execute("""
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION
    """, schema, table)
    return [r[0] for r in mssql_cur.fetchall()]

def migrate_table(mssql_conn, pg_conn, ss, tname):
    src_schema = ss
    dst_schema = pg_schema(ss)
    full_src   = f"[{src_schema}].[{tname}]"
    full_dst   = f"{dst_schema}.\"{tname}\""

    mssql_cur = mssql_conn.cursor()
    pg_cur    = pg_conn.cursor()

    # Obtener columnas
    cols = get_columns(mssql_cur, src_schema, tname)
    cols_quoted = ", ".join(f"[{c}]" for c in cols)
    pg_cols     = ", ".join(f"\"{c}\"" for c in cols)
    placeholders = ", ".join(["%s"] * len(cols))

    # Contar filas
    mssql_cur.execute(f"SELECT COUNT(*) FROM {full_src}")
    total = mssql_cur.fetchone()[0]
    log(f"  {tname}: {total:,} filas")

    if dry_run or total == 0:
        return total, 0  # (total, migrated)

    # Truncar destino antes de insertar
    pg_cur.execute(f"TRUNCATE TABLE {full_dst} RESTART IDENTITY CASCADE")

    # Leer e insertar en batches
    mssql_cur.execute(f"SELECT {cols_quoted} FROM {full_src}")
    migrated = 0
    while True:
        batch = mssql_cur.fetchmany(BATCH_SIZE)
        if not batch:
            break
        # Convertir filas a lista de tuplas
        rows = [tuple(r) for r in batch]
        insert_sql = f"INSERT INTO {full_dst} ({pg_cols}) VALUES ({placeholders})"
        pg_cur.executemany(insert_sql, rows)
        pg_conn.commit()
        migrated += len(rows)
        print(f"    → {migrated:,} / {total:,} insertadas", end="\r")

    print()  # nueva línea tras el progreso
    pg_cur.close()
    mssql_cur.close()
    return total, migrated

# ─────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────
def main():
    log("=" * 60)
    log(f"MineDax Migration — modo: {'DRY RUN' if dry_run else 'REAL'}")
    log("=" * 60)

    try:
        mssql_conn = pyodbc.connect(MSSQL_CONN)
        log("✓ Conexión SQL Server establecida")
    except Exception as e:
        log(f"✗ Error SQL Server: {e}")
        sys.exit(1)

    try:
        pg_conn = psycopg2.connect(**PG_CONN)
        pg_conn.autocommit = False
        log("✓ Conexión PostgreSQL establecida")
    except Exception as e:
        log(f"✗ Error PostgreSQL: {e}")
        sys.exit(1)

    results = []
    for (ss, tname) in TABLES:
        log(f"Migrando {ss}.{tname}...")
        try:
            total, migrated = migrate_table(mssql_conn, pg_conn, ss, tname)
            results.append((tname, total, migrated, None))
        except Exception as e:
            pg_conn.rollback()
            log(f"  ✗ ERROR en {tname}: {e}")
            results.append((tname, 0, 0, str(e)))

    mssql_conn.close()
    pg_conn.close()

    log("")
    log("=" * 60)
    log("RESUMEN FINAL")
    log("=" * 60)
    ok  = [(t,tot,mig) for (t,tot,mig,e) in results if e is None]
    err = [(t,e)       for (t,tot,mig,e) in results if e is not None]
    log(f"Tablas exitosas : {len(ok)}")
    log(f"Tablas con error: {len(err)}")
    total_rows = sum(tot for (_,tot,_) in ok)
    migr_rows  = sum(mig for (_,_,mig) in ok)
    log(f"Filas origen    : {total_rows:,}")
    if not dry_run:
        log(f"Filas migradas  : {migr_rows:,}")
    if err:
        log("Errores:")
        for (t, e) in err:
            log(f"  {t}: {e}")

if __name__ == "__main__":
    main()

"""
MCP Server para SQL Server - Base de datos MineDax
Conecta Claude Desktop con SSMS via Model Context Protocol
"""

from mcp.server.fastmcp import FastMCP
import pyodbc

mcp = FastMCP("MineDax SQL Server")

# Cadena de conexión - SQL Server Authentication
CONNECTION_STRING = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=DESKTOP-VEABB8R\\SQLEXPRESS;"
    "DATABASE=MineDax;"
    "UID=sa;"
    "PWD=LetItHappen35*;"
    "TrustServerCertificate=yes;"
)

def get_connection():
    return pyodbc.connect(CONNECTION_STRING)


# ─── HERRAMIENTAS ─────────────────────────────────────────────────────────────

@mcp.tool()
def list_tables() -> str:
    """Lista todas las tablas de la base de datos MineDax."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT TABLE_SCHEMA, TABLE_NAME
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_TYPE = 'BASE TABLE'
        ORDER BY TABLE_SCHEMA, TABLE_NAME
    """)
    rows = cursor.fetchall()
    conn.close()
    return "\n".join(f"{row[0]}.{row[1]}" for row in rows)


@mcp.tool()
def describe_table(table_name: str) -> str:
    """
    Devuelve el esquema completo de una tabla: columnas, tipos, nulabilidad y claves primarias.
    Parámetro: nombre de la tabla (sin esquema, o con esquema como 'dbo.MiTabla').
    """
    parts = table_name.split(".")
    schema = parts[0] if len(parts) > 1 else "dbo"
    table  = parts[-1]

    conn = get_connection()
    cursor = conn.cursor()

    # Columnas
    cursor.execute("""
        SELECT
            c.COLUMN_NAME,
            c.DATA_TYPE,
            c.CHARACTER_MAXIMUM_LENGTH,
            c.IS_NULLABLE,
            CASE WHEN kcu.COLUMN_NAME IS NOT NULL THEN 'PK' ELSE '' END AS KEY_TYPE
        FROM INFORMATION_SCHEMA.COLUMNS c
        LEFT JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
            ON  kcu.TABLE_SCHEMA = c.TABLE_SCHEMA
            AND kcu.TABLE_NAME   = c.TABLE_NAME
            AND kcu.COLUMN_NAME  = c.COLUMN_NAME
            AND OBJECTPROPERTY(OBJECT_ID(CONSTRAINT_SCHEMA + '.' + CONSTRAINT_NAME), 'IsPrimaryKey') = 1
        WHERE c.TABLE_SCHEMA = ? AND c.TABLE_NAME = ?
        ORDER BY c.ORDINAL_POSITION
    """, (schema, table))
    cols = cursor.fetchall()
    conn.close()

    if not cols:
        return f"Tabla '{table_name}' no encontrada."

    lines = [f"Esquema de [{schema}].[{table}]:", ""]
    for col in cols:
        name, dtype, max_len, nullable, key = col
        length = f"({max_len})" if max_len else ""
        pk     = " [PK]" if key == "PK" else ""
        null   = "NULL" if nullable == "YES" else "NOT NULL"
        lines.append(f"  {name:<30} {dtype}{length:<15} {null}{pk}")
    return "\n".join(lines)


@mcp.tool()
def list_foreign_keys(table_name: str) -> str:
    """
    Muestra las claves foráneas (FK) de una tabla: columna origen → tabla/columna destino.
    """
    parts = table_name.split(".")
    schema = parts[0] if len(parts) > 1 else "dbo"
    table  = parts[-1]

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT
            fk.name AS FK_Name,
            cp.name AS From_Column,
            OBJECT_NAME(fk.referenced_object_id) AS To_Table,
            cr.name AS To_Column
        FROM sys.foreign_keys fk
        JOIN sys.foreign_key_columns fkc
            ON fk.object_id = fkc.constraint_object_id
        JOIN sys.columns cp
            ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
        JOIN sys.columns cr
            ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
        WHERE OBJECT_NAME(fk.parent_object_id) = ?
          AND SCHEMA_NAME(fk.schema_id) = ?
    """, (table, schema))
    rows = cursor.fetchall()
    conn.close()

    if not rows:
        return f"No se encontraron FK en '{table_name}'."
    return "\n".join(f"  {r[0]}: {r[1]} → {r[2]}.{r[3]}" for r in rows)


@mcp.tool()
def list_stored_procedures() -> str:
    """Lista todos los stored procedures de la base de datos MineDax."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT ROUTINE_SCHEMA, ROUTINE_NAME
        FROM INFORMATION_SCHEMA.ROUTINES
        WHERE ROUTINE_TYPE = 'PROCEDURE'
        ORDER BY ROUTINE_SCHEMA, ROUTINE_NAME
    """)
    rows = cursor.fetchall()
    conn.close()
    if not rows:
        return "No hay stored procedures."
    return "\n".join(f"{r[0]}.{r[1]}" for r in rows)


@mcp.tool()
def get_procedure_definition(procedure_name: str) -> str:
    """Devuelve el código fuente de un stored procedure."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT OBJECT_DEFINITION(OBJECT_ID(?))", (procedure_name,))
    row = cursor.fetchone()
    conn.close()
    if not row or not row[0]:
        return f"Stored procedure '{procedure_name}' no encontrado."
    return row[0]


@mcp.tool()
def execute_query(sql: str) -> str:
    """
    Ejecuta una consulta SQL de solo lectura (SELECT) y devuelve los resultados.
    Máximo 200 filas para no sobrecargar el contexto.
    """
    sql_upper = sql.strip().upper()
    if not sql_upper.startswith("SELECT") and not sql_upper.startswith("WITH"):
        return "Solo se permiten consultas SELECT o WITH (CTEs). No se ejecutan INSERT, UPDATE, DELETE, DROP, etc."

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(sql)
    cols = [desc[0] for desc in cursor.description]
    rows = cursor.fetchmany(200)
    conn.close()

    if not rows:
        return "La consulta no devolvió resultados."

    # Formatear como tabla de texto
    col_widths = [max(len(str(c)), max((len(str(r[i])) for r in rows), default=0)) for i, c in enumerate(cols)]
    sep  = "+" + "+".join("-" * (w + 2) for w in col_widths) + "+"
    header = "|" + "|".join(f" {cols[i]:<{col_widths[i]}} " for i in range(len(cols))) + "|"
    lines = [sep, header, sep]
    for row in rows:
        lines.append("|" + "|".join(f" {str(row[i]):<{col_widths[i]}} " for i in range(len(cols))) + "|")
    lines.append(sep)
    lines.append(f"({len(rows)} fila(s) devueltas)")
    return "\n".join(lines)


@mcp.tool()
def get_database_overview() -> str:
    """
    Resumen general de la base de datos: cantidad de tablas, vistas,
    stored procedures e índices.
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT
            (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES  WHERE TABLE_TYPE = 'BASE TABLE') AS Tablas,
            (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES  WHERE TABLE_TYPE = 'VIEW')       AS Vistas,
            (SELECT COUNT(*) FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_TYPE = 'PROCEDURE') AS StoredProcs,
            (SELECT COUNT(*) FROM sys.indexes WHERE type > 0)                                  AS Indices
    """)
    row = cursor.fetchone()
    conn.close()
    return (
        f"Base de datos: MineDax\n"
        f"  Tablas:            {row[0]}\n"
        f"  Vistas:            {row[1]}\n"
        f"  Stored Procedures: {row[2]}\n"
        f"  Índices:           {row[3]}"
    )


if __name__ == "__main__":
    mcp.run()

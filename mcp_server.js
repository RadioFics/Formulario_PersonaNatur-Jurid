#!/usr/bin/env node
/**
 * MCP Server para SQL Server - Base de datos MineDax
 * Conecta Claude Desktop con SSMS via Model Context Protocol
 * Requiere: npm install @modelcontextprotocol/sdk
 * mssql ya está instalado en este proyecto.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import sql from "mssql";

// ─── Configuración de conexión ────────────────────────────────────────────────
const DB_CONFIG = {
  server: "DESKTOP-VEABB8R\\SQLEXPRESS",
  database: "MineDax",
  user: "sa",
  password: "LetItHappen35*",
  options: {
    trustServerCertificate: true,
    encrypt: false,
  },
};

async function getPool() {
  return sql.connect(DB_CONFIG);
}

// ─── Servidor MCP ─────────────────────────────────────────────────────────────
const server = new McpServer({
  name: "MineDax SQL Server",
  version: "1.0.0",
});

// 1. Resumen general de la base de datos
server.tool(
  "get_database_overview",
  "Resumen general de MineDax: cantidad de tablas, vistas, stored procedures e índices.",
  {},
  async () => {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES  WHERE TABLE_TYPE = 'BASE TABLE') AS Tablas,
        (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES  WHERE TABLE_TYPE = 'VIEW')       AS Vistas,
        (SELECT COUNT(*) FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_TYPE = 'PROCEDURE') AS StoredProcs,
        (SELECT COUNT(*) FROM sys.indexes WHERE type > 0) AS Indices
    `);
    const r = result.recordset[0];
    return {
      content: [{
        type: "text",
        text: `Base de datos: MineDax\n  Tablas:            ${r.Tablas}\n  Vistas:            ${r.Vistas}\n  Stored Procedures: ${r.StoredProcs}\n  Índices:           ${r.Indices}`,
      }],
    };
  }
);

// 2. Listar tablas
server.tool(
  "list_tables",
  "Lista todas las tablas de la base de datos MineDax.",
  {},
  async () => {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT TABLE_SCHEMA, TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `);
    const text = result.recordset.map(r => `${r.TABLE_SCHEMA}.${r.TABLE_NAME}`).join("\n");
    return { content: [{ type: "text", text }] };
  }
);

// 3. Describir tabla
server.tool(
  "describe_table",
  "Devuelve el esquema de una tabla: columnas, tipos, nulabilidad y claves primarias. Ejemplo: 'dbo.MiTabla' o solo 'MiTabla'.",
  { table_name: z.string().describe("Nombre de la tabla, con o sin esquema (ej: 'Clientes' o 'dbo.Clientes')") },
  async ({ table_name }) => {
    const parts = table_name.split(".");
    const schema = parts.length > 1 ? parts[0] : "dbo";
    const table  = parts[parts.length - 1];

    const pool = await getPool();
    const result = await pool.request()
      .input("schema", sql.NVarChar, schema)
      .input("table", sql.NVarChar, table)
      .query(`
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
          AND OBJECTPROPERTY(OBJECT_ID(kcu.CONSTRAINT_SCHEMA + '.' + kcu.CONSTRAINT_NAME), 'IsPrimaryKey') = 1
        WHERE c.TABLE_SCHEMA = @schema AND c.TABLE_NAME = @table
        ORDER BY c.ORDINAL_POSITION
      `);

    if (!result.recordset.length) {
      return { content: [{ type: "text", text: `Tabla '${table_name}' no encontrada.` }] };
    }

    const lines = [`Esquema de [${schema}].[${table}]:`, ""];
    for (const col of result.recordset) {
      const len  = col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : "";
      const pk   = col.KEY_TYPE === "PK" ? " [PK]" : "";
      const null_ = col.IS_NULLABLE === "YES" ? "NULL" : "NOT NULL";
      lines.push(`  ${col.COLUMN_NAME.padEnd(30)} ${(col.DATA_TYPE + len).padEnd(20)} ${null_}${pk}`);
    }
    return { content: [{ type: "text", text: lines.join("\n") }] };
  }
);

// 4. Claves foráneas
server.tool(
  "list_foreign_keys",
  "Muestra las claves foráneas (FK) de una tabla: columna origen → tabla/columna destino.",
  { table_name: z.string().describe("Nombre de la tabla") },
  async ({ table_name }) => {
    const parts = table_name.split(".");
    const schema = parts.length > 1 ? parts[0] : "dbo";
    const table  = parts[parts.length - 1];

    const pool = await getPool();
    const result = await pool.request()
      .input("table", sql.NVarChar, table)
      .input("schema", sql.NVarChar, schema)
      .query(`
        SELECT
          fk.name AS FK_Name,
          cp.name AS From_Column,
          OBJECT_NAME(fk.referenced_object_id) AS To_Table,
          cr.name AS To_Column
        FROM sys.foreign_keys fk
        JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
        JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
        JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
        WHERE OBJECT_NAME(fk.parent_object_id) = @table
          AND SCHEMA_NAME(fk.schema_id) = @schema
      `);

    if (!result.recordset.length) {
      return { content: [{ type: "text", text: `No se encontraron FK en '${table_name}'.` }] };
    }
    const text = result.recordset.map(r => `  ${r.FK_Name}: ${r.From_Column} → ${r.To_Table}.${r.To_Column}`).join("\n");
    return { content: [{ type: "text", text }] };
  }
);

// 5. Listar stored procedures
server.tool(
  "list_stored_procedures",
  "Lista todos los stored procedures de la base de datos MineDax.",
  {},
  async () => {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT ROUTINE_SCHEMA, ROUTINE_NAME
      FROM INFORMATION_SCHEMA.ROUTINES
      WHERE ROUTINE_TYPE = 'PROCEDURE'
      ORDER BY ROUTINE_SCHEMA, ROUTINE_NAME
    `);
    if (!result.recordset.length) {
      return { content: [{ type: "text", text: "No hay stored procedures." }] };
    }
    const text = result.recordset.map(r => `${r.ROUTINE_SCHEMA}.${r.ROUTINE_NAME}`).join("\n");
    return { content: [{ type: "text", text }] };
  }
);

// 6. Código fuente de un SP
server.tool(
  "get_procedure_definition",
  "Devuelve el código fuente de un stored procedure.",
  { procedure_name: z.string().describe("Nombre del stored procedure") },
  async ({ procedure_name }) => {
    const pool = await getPool();
    const result = await pool.request()
      .input("name", sql.NVarChar, procedure_name)
      .query("SELECT OBJECT_DEFINITION(OBJECT_ID(@name)) AS definition");
    const def = result.recordset[0]?.definition;
    if (!def) {
      return { content: [{ type: "text", text: `Stored procedure '${procedure_name}' no encontrado.` }] };
    }
    return { content: [{ type: "text", text: def }] };
  }
);

// 7. Ejecutar SELECT
server.tool(
  "execute_query",
  "Ejecuta una consulta SQL de solo lectura (SELECT o WITH/CTE) y devuelve los resultados. Máximo 200 filas.",
  { sql_query: z.string().describe("Consulta SQL SELECT a ejecutar") },
  async ({ sql_query }) => {
    const upper = sql_query.trim().toUpperCase();
    if (!upper.startsWith("SELECT") && !upper.startsWith("WITH")) {
      return { content: [{ type: "text", text: "Solo se permiten SELECT o WITH (CTEs). No se ejecutan INSERT, UPDATE, DELETE, DROP, etc." }] };
    }

    const pool = await getPool();
    const result = await pool.request().query(sql_query);
    const rows = result.recordset.slice(0, 200);

    if (!rows.length) {
      return { content: [{ type: "text", text: "La consulta no devolvió resultados." }] };
    }

    const cols = Object.keys(rows[0]);
    const widths = cols.map(c => Math.max(c.length, ...rows.map(r => String(r[c] ?? "").length)));
    const sep    = "+" + widths.map(w => "-".repeat(w + 2)).join("+") + "+";
    const header = "|" + cols.map((c, i) => ` ${c.padEnd(widths[i])} `).join("|") + "|";
    const lines  = [sep, header, sep];
    for (const row of rows) {
      lines.push("|" + cols.map((c, i) => ` ${String(row[c] ?? "").padEnd(widths[i])} `).join("|") + "|");
    }
    lines.push(sep);
    lines.push(`(${rows.length} fila(s) devueltas)`);
    return { content: [{ type: "text", text: lines.join("\n") }] };
  }
);

// ─── Iniciar servidor ─────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);

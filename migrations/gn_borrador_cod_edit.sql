-- ============================================================
-- Migración: Código de edición para borradores en progreso
-- Base de datos: MineDax
-- Tabla: GN_BORRADOR
-- Descripción: Agrega COD_EDIT (hash del código de edición) a
--              GN_BORRADOR, con el mismo patrón ya usado en
--              GN_TERCE.COD_EDIT, para permitir reanudar un
--              borrador no finalizado desde "Actualizar registro"
--              usando número de documento + código de edición.
-- ============================================================

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_NAME = 'GN_BORRADOR' AND COLUMN_NAME = 'COD_EDIT'
)
    ALTER TABLE GN_BORRADOR ADD COD_EDIT CHAR(64) NULL;
GO

-- Verificación final
SELECT COUNT(*) AS filas_gn_borrador,
       SUM(CASE WHEN COD_EDIT IS NOT NULL THEN 1 ELSE 0 END) AS con_codigo
FROM GN_BORRADOR;

-- ============================================================
-- Migración: Ampliar GN_JURID_CUMP.SIS_PREVE para multiselect
-- Descripción: El campo SIS_PREVE almacena ahora una lista de
--              sistemas separados por coma (ej: "SAGRILAFT,SIPLAFT").
--              Se amplía de varchar(60) a varchar(255).
-- Fecha: 2026-06-16
-- ============================================================

ALTER TABLE dbo.GN_JURID_CUMP
  ALTER COLUMN SIS_PREVE varchar(255) NULL;
GO

-- Verificación
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'GN_JURID_CUMP' AND COLUMN_NAME = 'SIS_PREVE';
GO

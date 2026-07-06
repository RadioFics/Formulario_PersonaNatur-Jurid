-- ============================================================
-- Migración: % de participación para beneficiarios finales
-- Base de datos: MineDax
-- Tabla: GN_JURID_BF
-- Descripción: Agrega PCT_PART a los beneficiarios finales
--              (Sección 9), mismo tipo/nombre que GN_JURID_AC.PCT_PART
--              (accionistas, Sección 8).
-- ============================================================

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_NAME = 'GN_JURID_BF' AND COLUMN_NAME = 'PCT_PART'
)
    ALTER TABLE GN_JURID_BF ADD PCT_PART DECIMAL(5,2) NULL;
GO

-- Verificación final
SELECT COUNT(*) AS filas_gn_jurid_bf,
       SUM(CASE WHEN PCT_PART IS NOT NULL THEN 1 ELSE 0 END) AS con_pct_part
FROM GN_JURID_BF;

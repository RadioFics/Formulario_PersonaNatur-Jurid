-- ============================================================
-- Migración: % de participación para empresas de tipo Mixta
-- Base de datos: MineDax
-- Tabla: GN_JURID
-- Descripción: Agrega PCT_PART_MIXTA, habilitado en el formulario
--              solo cuando "Tipo de empresa" = Mixta (Sección 3).
--              Mismo tipo que GN_JURID_AC.PCT_PART (accionistas).
-- ============================================================

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_NAME = 'GN_JURID' AND COLUMN_NAME = 'PCT_PART_MIXTA'
)
    ALTER TABLE GN_JURID ADD PCT_PART_MIXTA DECIMAL(5,2) NULL;
GO

-- Verificación final
SELECT COUNT(*) AS filas_gn_jurid,
       SUM(CASE WHEN PCT_PART_MIXTA IS NOT NULL THEN 1 ELSE 0 END) AS con_pct_part_mixta
FROM GN_JURID;

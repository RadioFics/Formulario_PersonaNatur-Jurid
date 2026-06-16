-- ============================================================
--  MIGRACIÓN: Bilingüismo en tablas catálogo (Formulario BD)
--  Fecha : 2026-06-16
--  Autor : Generado por Claude (Cowork)
--  Scope : Añadir columna NOM_EN a tablas que no la tienen y
--          corregir valores NULL en tablas que ya la tienen.
--          MAE_CIIU excluido deliberadamente (se mantiene en ES).
--
--  NOTA: El separador GO divide el script en batches independientes.
--        SQL Server compila cada batch por separado, por lo que el
--        ALTER TABLE de un batch anterior ya es visible en el siguiente.
--        Ejecutar completo en SSMS (F5) o con sqlcmd.
-- ============================================================


-- ============================================================
-- 1. MAE_TPDOC — Parche NOM_EN NULL en "Sin asignar" (COD_TPDOC = 0)
--    La columna NOM_EN ya existe en esta tabla; solo falta este valor.
-- ============================================================
UPDATE MAE_TPDOC
SET    NOM_EN = 'Not Assigned'
WHERE  COD_TPDOC = 0
  AND  (NOM_EN IS NULL OR NOM_EN = '');
-- Filas esperadas: 1
GO


-- ============================================================
-- 2a. MAE_VINC — Añadir columna NOM_EN
-- ============================================================
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE  TABLE_NAME  = 'MAE_VINC'
      AND  COLUMN_NAME = 'NOM_EN'
)
BEGIN
    ALTER TABLE MAE_VINC
    ADD NOM_EN NVARCHAR(120) NULL;
END;
GO

-- 2b. MAE_VINC — Poblar los 11 registros
--     (GO anterior garantiza que NOM_EN ya existe antes de este batch)
UPDATE MAE_VINC
SET NOM_EN = CASE COD_VINC
    WHEN 1  THEN 'Shareholder'
    WHEN 2  THEN 'Supplier'
    WHEN 3  THEN 'Client'
    WHEN 4  THEN 'Contractor / Supplier'
    WHEN 5  THEN 'Strategic Partner'
    WHEN 6  THEN 'Financial Institution'
    WHEN 7  THEN 'Public Entity'
    WHEN 8  THEN 'Legal Representative'
    WHEN 9  THEN 'Other'
    WHEN 10 THEN 'Employment Relationship'
    WHEN 11 THEN 'Institutional and Community Partners'
    ELSE NOM_EN
END
WHERE NOM_EN IS NULL OR NOM_EN = '';
-- Filas esperadas: 11
GO


-- ============================================================
-- 3a. MAE_ESTCIV — Añadir columna NOM_EN
-- ============================================================
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE  TABLE_NAME  = 'MAE_ESTCIV'
      AND  COLUMN_NAME = 'NOM_EN'
)
BEGIN
    ALTER TABLE MAE_ESTCIV
    ADD NOM_EN NVARCHAR(80) NULL;
END;
GO

-- 3b. MAE_ESTCIV — Poblar los 7 registros
UPDATE MAE_ESTCIV
SET NOM_EN = CASE COD_ESTCIV
    WHEN 0 THEN 'Not Assigned'
    WHEN 1 THEN 'Single'
    WHEN 2 THEN 'Married'
    WHEN 3 THEN 'Common-Law Partnership'
    WHEN 4 THEN 'Divorced'
    WHEN 5 THEN 'Separated'
    WHEN 6 THEN 'Widowed'
    ELSE NOM_EN
END
WHERE NOM_EN IS NULL OR NOM_EN = '';
-- Filas esperadas: 7
GO


-- ============================================================
-- 4. VERIFICACIÓN FINAL — debe mostrar NOM_EN completo en todas las tablas
-- ============================================================
SELECT 'MAE_TPDOC'    AS tabla, CAST(COD_TPDOC  AS VARCHAR) AS codigo, NOM_TPDOC    AS nombre_es, NOM_EN AS nombre_en FROM MAE_TPDOC
UNION ALL
SELECT 'MAE_TPCTA',            CAST(COD_TPCTA  AS VARCHAR),            NOM_TPCTA,                 NOM_EN FROM MAE_TPCTA
UNION ALL
SELECT 'MAE_TIP_SOCIE',        CAST(COD_SOCIE  AS VARCHAR),            NOM_SOCIE,                 NOM_EN FROM MAE_TIP_SOCIE
UNION ALL
SELECT 'MAE_SIST_PREV',        CAST(COD_SIST   AS VARCHAR),            NOM_SIST,                  NOM_EN FROM MAE_SIST_PREV
UNION ALL
SELECT 'MAE_VINC',             CAST(COD_VINC   AS VARCHAR),            NOM_VINC,                  NOM_EN FROM MAE_VINC
UNION ALL
SELECT 'MAE_ESTCIV',           CAST(COD_ESTCIV AS VARCHAR),            NOM_ESTCIV,                NOM_EN FROM MAE_ESTCIV
ORDER BY tabla, codigo;
GO

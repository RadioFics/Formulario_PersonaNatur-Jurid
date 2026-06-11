-- ============================================================
-- Migración: Actualizar catálogo MAE_VINC de vinculaciones
-- Base de datos: MineDax
-- Descripción: Ajusta las opciones de tipo de vinculación para
--              mostrar únicamente las requeridas en el formulario.
-- ============================================================

-- 1. Renombrar 'Contratista' a 'Contratista/Proveedor' (COD_VINC = 4)
UPDATE MAE_VINC
SET NOM_VINC = 'Contratista/Proveedor'
WHERE COD_VINC = 4;

-- 2. Agregar 'Vinculación laboral' (COD_VINC = 10)
IF NOT EXISTS (SELECT 1 FROM MAE_VINC WHERE COD_VINC = 10)
    INSERT INTO MAE_VINC (COD_VINC, NOM_VINC) VALUES (10, 'Vinculación laboral');

-- 3. Agregar 'Aliados institucionales y comunitarios' (COD_VINC = 11)
IF NOT EXISTS (SELECT 1 FROM MAE_VINC WHERE COD_VINC = 11)
    INSERT INTO MAE_VINC (COD_VINC, NOM_VINC) VALUES (11, 'Aliados institucionales y comunitarios');

-- Verificación final
SELECT COD_VINC, NOM_VINC FROM MAE_VINC ORDER BY COD_VINC;

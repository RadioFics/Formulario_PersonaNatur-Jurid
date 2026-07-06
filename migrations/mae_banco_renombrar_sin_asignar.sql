-- ============================================================
-- Migración: Renombrar "Sin asignar" a "Otro" en MAE_BANCO
-- Base de datos: MineDax
-- Tabla: MAE_BANCO
-- Descripción: Solo cambia la etiqueta mostrada en el selector de
--              "Entidad bancaria" (Sección 11). El código detecta
--              la opción "otro" por texto que empieza con "otro"
--              o "sin " (seccion-bancaria.js:_bancoOtrosChange),
--              así que el comportamiento (mostrar el campo
--              "Especifique la entidad bancaria") no cambia.
-- ============================================================

UPDATE MAE_BANCO SET NOM_BANCO = 'Otro' WHERE COD_BANCO = 0 AND NOM_BANCO = 'Sin asignar';

-- Verificación final
SELECT COD_BANCO, NOM_BANCO FROM MAE_BANCO WHERE COD_BANCO = 0;

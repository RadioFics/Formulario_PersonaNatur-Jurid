-- ============================================================
-- Migración: Agregar códigos CIIU para Persona Natural
-- Base de datos: MineDax
-- Tabla: MAE_CIIU
-- Descripción: Inserta los códigos CIIU especiales para personas
--              naturales que no corresponden a actividades económicas
--              formales del CIIU estándar.
-- ============================================================

-- Insertar solo si no existen (idempotente)
IF NOT EXISTS (SELECT 1 FROM MAE_CIIU WHERE COD_CIIU = '0010')
    INSERT INTO MAE_CIIU (COD_CIIU, NOM_CIIU, SEC_CIIU, DIV_CIIU, ACT_USUA, ACT_HORA, ACT_ESTA)
    VALUES ('0010', 'Personas naturales con ingresos de relación laboral', NULL, NULL, 'SAGRILAF', GETDATE(), 'A');

IF NOT EXISTS (SELECT 1 FROM MAE_CIIU WHERE COD_CIIU = '0020')
    INSERT INTO MAE_CIIU (COD_CIIU, NOM_CIIU, SEC_CIIU, DIV_CIIU, ACT_USUA, ACT_HORA, ACT_ESTA)
    VALUES ('0020', 'Personas naturales con ingresos de pensiones', NULL, NULL, 'SAGRILAF', GETDATE(), 'A');

IF NOT EXISTS (SELECT 1 FROM MAE_CIIU WHERE COD_CIIU = '0081')
    INSERT INTO MAE_CIIU (COD_CIIU, NOM_CIIU, SEC_CIIU, DIV_CIIU, ACT_USUA, ACT_HORA, ACT_ESTA)
    VALUES ('0081', 'Personas naturales sin actividad económica', NULL, NULL, 'SAGRILAF', GETDATE(), 'A');

IF NOT EXISTS (SELECT 1 FROM MAE_CIIU WHERE COD_CIIU = '0082')
    INSERT INTO MAE_CIIU (COD_CIIU, NOM_CIIU, SEC_CIIU, DIV_CIIU, ACT_USUA, ACT_HORA, ACT_ESTA)
    VALUES ('0082', 'Personas naturales rentistas de capital', NULL, NULL, 'SAGRILAF', GETDATE(), 'A');

IF NOT EXISTS (SELECT 1 FROM MAE_CIIU WHERE COD_CIIU = '0090')
    INSERT INTO MAE_CIIU (COD_CIIU, NOM_CIIU, SEC_CIIU, DIV_CIIU, ACT_USUA, ACT_HORA, ACT_ESTA)
    VALUES ('0090', 'Personas naturales que reciben recursos de terceros', NULL, NULL, 'SAGRILAF', GETDATE(), 'A');

-- Verificación final
SELECT COD_CIIU, NOM_CIIU, ACT_ESTA
FROM MAE_CIIU
WHERE COD_CIIU IN ('0010','0020','0081','0082','0090')
ORDER BY COD_CIIU;

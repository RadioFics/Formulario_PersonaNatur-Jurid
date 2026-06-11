-- session4_otr_columns.sql
-- Columnas OTR_ pendientes de agregar
-- Ejecutar en MineDax (CM-ITD-P-05\SQLEXPRESS)

-- 1. OTR_PAIS_SOC en GN_JURID
--    Texto libre del país cuando sección 3 "Ubicación = Extranjera" y país = OTRO
ALTER TABLE dbo.GN_JURID
  ADD OTR_PAIS_SOC VARCHAR(100) NULL;

-- 2. OTR_TPDOC en GN_TERCE
--    Texto libre del tipo de documento cuando MAE_TPDOC = "Sin asignar"
ALTER TABLE dbo.GN_TERCE
  ADD OTR_TPDOC VARCHAR(100) NULL;

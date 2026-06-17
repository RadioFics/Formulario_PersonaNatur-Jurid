-- ============================================================
-- Script: sist_prev_abreviatura.sql
-- Descripción: Agrega la abreviatura entre paréntesis al nombre
--              completo de cada sistema de prevención en MAE_SIST_PREV
--              y completa los nombres de PTEP y SIPLAFT (antes solo siglas).
-- Base:   MineDax
-- Fecha:  2026-06-17
-- ============================================================

USE MineDax;
GO

-- SAGRILAFT (COD_SIST = 1)
UPDATE MAE_SIST_PREV
SET NOM_SIST = 'Sistema de Autocontrol y Gestión del Riesgo LA/FT/FPADM (SAGRILAFT)',
    NOM_EN   = 'Self-Control and ML/TF/FPWMD Risk Management System (SAGRILAFT)'
WHERE COD_SIST = 1;

-- SARLAFT (COD_SIST = 2)
UPDATE MAE_SIST_PREV
SET NOM_SIST = 'Sistema de Administración del Riesgo LA/FT (SARLAFT)',
    NOM_EN   = 'ML/TF Risk Administration System (SARLAFT)'
WHERE COD_SIST = 2;

-- SIPLA (COD_SIST = 3)
UPDATE MAE_SIST_PREV
SET NOM_SIST = 'Sistema Integral de Prevención LA/FT (SIPLA)',
    NOM_EN   = 'Comprehensive ML/TF Prevention System (SIPLA)'
WHERE COD_SIST = 3;

-- PTEE (COD_SIST = 4)
UPDATE MAE_SIST_PREV
SET NOM_SIST = 'Programa de Transparencia y Ética Empresarial (PTEE)',
    NOM_EN   = 'Transparency and Business Ethics Program (PTEE)'
WHERE COD_SIST = 4;

-- PTEP (COD_SIST = 1002) — nombre completo era solo la sigla
UPDATE MAE_SIST_PREV
SET NOM_SIST = 'Programa de Transparencia y Ética Pública (PTEP)',
    NOM_EN   = 'Transparency and Public Ethics Program (PTEP)'
WHERE COD_SIST = 1002;

-- SIPLAFT (COD_SIST = 1003) — nombre completo era solo la sigla
UPDATE MAE_SIST_PREV
SET NOM_SIST = 'Sistema Integral de Prevención LA/FT (SIPLAFT)',
    NOM_EN   = 'Comprehensive AML/CFT Integrated Prevention System (SIPLAFT)'
WHERE COD_SIST = 1003;

-- Verificar resultado
SELECT COD_SIST, COD_ABREV, NOM_SIST, NOM_EN FROM MAE_SIST_PREV ORDER BY COD_SIST;
GO

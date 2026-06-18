-- ============================================================
-- Fix: CHK_GN_TDOC_TIP — ampliar valores permitidos en TIP_DOC
--
-- Necesario para soportar:
--   · DOC_ID_RL_1, DOC_ID_RL_2, DOC_ID_RL_3  (RLs suplentes)
--   · EST_FIN_1, EST_FIN_2                    (dos años fiscales)
--
-- Nota: DOC_ID_RL_0 se normaliza a DOC_ID_RL en el servidor
-- antes de llegar a la BD, por lo que NO se necesita aquí.
--
-- Ejecutar en SSMS con la BD MineDax seleccionada.
-- ============================================================

USE MineDax;
GO

-- 1. Eliminar la restricción existente
ALTER TABLE dbo.GN_TERCE_DOC
  DROP CONSTRAINT CHK_GN_TDOC_TIP;
GO

-- 2. Recrear con todos los valores permitidos
ALTER TABLE dbo.GN_TERCE_DOC
  ADD CONSTRAINT CHK_GN_TDOC_TIP
  CHECK (TIP_DOC IN (
    'RUT',
    'CERT_BANC',
    'CERT_EXIS',
    'DOC_ID_RL',
    'DOC_ID_RL_1',
    'DOC_ID_RL_2',
    'DOC_ID_RL_3',
    'EST_FIN',
    'EST_FIN_1',
    'EST_FIN_2',
    'CERT_ACCI',
    'CART_ACEP',
    'ARCH_FIRMA'
  ));
GO

-- Verificar
SELECT
  cc.CONSTRAINT_NAME,
  cc.CHECK_CLAUSE
FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS cc
WHERE cc.CONSTRAINT_NAME = 'CHK_GN_TDOC_TIP';
GO

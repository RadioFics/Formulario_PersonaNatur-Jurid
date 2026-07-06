-- ============================================================
-- Migración: Restringir países a Estados miembros de la ONU
-- Base de datos: MineDax
-- Tabla: MAE_PAIS
-- Descripción: Agrega el indicador IND_ONU ('S'/'N') para marcar
--              qué filas de MAE_PAIS corresponden a Estados
--              miembros de la Organización de las Naciones Unidas.
--              Los territorios, dependencias y estados observadores
--              (Palestina, Groenlandia, Hong Kong, Puerto Rico, etc.)
--              quedan marcados con 'N' y se excluyen de los
--              desplegables de país del formulario.
-- ============================================================

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_NAME = 'MAE_PAIS' AND COLUMN_NAME = 'IND_ONU'
)
    ALTER TABLE MAE_PAIS
      ADD IND_ONU CHAR(1) NOT NULL CONSTRAINT DF_MAE_PAIS_IND_ONU DEFAULT 'S';
GO

-- Territorios, dependencias y estados observadores (no miembros plenos de la ONU)
UPDATE MAE_PAIS SET IND_ONU = 'N' WHERE COD_PAIS IN (
  1073,  -- Anguila
  1104,  -- Antártida
  1075,  -- Aruba
  20,    -- Bermudas
  1077,  -- Bonaire, San Eustaquio y Saba
  1110,  -- China, RAE Hong Kong
  1111,  -- China, RAE Macao
  22,    -- Cayman (Islas)
  1079,  -- Curazao
  1145,  -- Estado de Palestina
  1100,  -- Georgia del Sur y las Islas Sandwich del Sur
  1173,  -- Gibraltar
  1102,  -- Groenlandia
  1082,  -- Guadalupe
  1193,  -- Guam
  1098,  -- Guayana Francesa
  1162,  -- Guernsey
  1096,  -- Isla Bouvet
  1184,  -- Isla Christmas
  1164,  -- Isla de Man
  1187,  -- Isla Norfolk
  1157,  -- Islas Åland
  1185,  -- Islas Cocos (Keeling)
  1202,  -- Islas Cook
  1160,  -- Islas Feroe
  1186,  -- Islas Heard y McDonald
  1097,  -- Islas Malvinas (Falkland)
  1198,  -- Islas Marianas Septentrionales
  1200,  -- Islas menores alejadas de Estados Unidos
  1168,  -- Islas Svalbard y Jan Mayen
  1092,  -- Islas Turcas y Caicos
  1078,  -- Islas Vírgenes Británicas
  1093,  -- Islas Vírgenes de los Estados Unidos
  1210,  -- Islas Wallis y Futuna
  1165,  -- Jersey
  1084,  -- Martinica
  1032,  -- Mayotte
  1085,  -- Montserrat
  1189,  -- Nueva Caledonia
  1204,  -- Niue
  1205,  -- Pitcairn
  1203,  -- Polinesia Francesa
  41,    -- Puerto Rico
  1034,  -- Reunión
  1020,  -- Sáhara Occidental
  1086,  -- San Barthélemy
  1089,  -- San Martín (parte francesa)
  1091,  -- San Martín (parte Holandesa)
  1103,  -- San Pedro y Miquelón
  1069,  -- Santa Elena
  1175,  -- Santa Sede
  1201,  -- Samoa Americana
  1021,  -- Territorio Británico del Océano Índico
  1027,  -- Territorio de las Tierras Australes Francesas
  1207   -- Tokelau
);
GO

-- Verificación final
SELECT
  SUM(CASE WHEN IND_ONU = 'S' THEN 1 ELSE 0 END) AS paises_onu,
  SUM(CASE WHEN IND_ONU = 'N' THEN 1 ELSE 0 END) AS territorios_excluidos
FROM MAE_PAIS
WHERE COD_PAIS > 0;

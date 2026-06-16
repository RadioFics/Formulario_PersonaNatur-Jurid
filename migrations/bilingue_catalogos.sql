-- ============================================================================
-- bilingue_catalogos.sql  —  Traducciones al inglés para catálogos de MineDax
-- ============================================================================
-- INSTRUCCIONES DE EJECUCIÓN EN SSMS:
--   1. Abrir este archivo en SSMS.
--   2. Ignorar cualquier línea subrayada en rojo del verificador de sintaxis;
--      ese error es un falso positivo de SSMS que ocurre porque el analizador
--      lee todo el archivo antes de ejecutarlo. Al presionar F5 (Execute),
--      SQL Server procesa cada bloque GO de forma independiente y el script
--      funciona correctamente.
--   3. Ejecutar una sola vez. Los ALTER usan IF NOT EXISTS para ser seguros
--      si se corre más de una vez.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- BLOQUE 1 — Crear columna NOM_EN en todas las tablas de catálogo
-- ────────────────────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.MAE_TPDOC')    AND name = 'NOM_EN') ALTER TABLE dbo.MAE_TPDOC    ADD NOM_EN nvarchar(80)  NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.MAE_SIST_PREV')AND name = 'NOM_EN') ALTER TABLE dbo.MAE_SIST_PREV ADD NOM_EN nvarchar(150) NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.MAE_TIP_SOCIE')AND name = 'NOM_EN') ALTER TABLE dbo.MAE_TIP_SOCIE ADD NOM_EN nvarchar(120) NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.MAE_TPCTA')    AND name = 'NOM_EN') ALTER TABLE dbo.MAE_TPCTA    ADD NOM_EN nvarchar(60)  NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.MAE_PAIS')     AND name = 'NOM_EN') ALTER TABLE dbo.MAE_PAIS     ADD NOM_EN nvarchar(80)  NULL;
GO

-- ────────────────────────────────────────────────────────────────────────────
-- BLOQUE 2 — Traducciones: MAE_TPDOC (tipos de documento)
-- sp_executesql difiere la resolución de NOM_EN al momento de ejecución,
-- eliminando el falso positivo del parser de SSMS.
-- ────────────────────────────────────────────────────────────────────────────
EXEC sp_executesql N'
UPDATE t SET t.NOM_EN = v.en
FROM dbo.MAE_TPDOC t
JOIN (VALUES
  (''CC'',  ''Citizenship Card''),
  (''CE'',  ''Foreigner ID Card''),
  (''PA'',  ''Passport''),
  (''TI'',  ''Identity Card (Minor)''),
  (''RC'',  ''Birth Certificate''),
  (''PEP'', ''Special Stay Permit (PEP)''),
  (''PPT'', ''Temporary Protection Permit''),
  (''NIT'', ''Tax ID (NIT)'')
) AS v(cod, en) ON t.COD_ABREV = v.cod';
GO

-- ────────────────────────────────────────────────────────────────────────────
-- BLOQUE 3 — Traducciones: MAE_SIST_PREV (sistemas de prevención)
-- ────────────────────────────────────────────────────────────────────────────
EXEC sp_executesql N'
UPDATE t SET t.NOM_EN = v.en
FROM dbo.MAE_SIST_PREV t
JOIN (VALUES
  (''SAGRILAFT'', ''Self-Control and Risk Mgmt. System (ML/TF/FPWMD)''),
  (''SARLAFT'',   ''ML/TF Risk Administration System''),
  (''SIPLA'',     ''Comprehensive ML/TF Prevention System''),
  (''PTEE'',      ''Transparency and Business Ethics Program''),
  (''N/A'',       ''Not Applicable''),
  (''OTR'',       ''Other''),
  (''PTEP'',      ''PTEP''),
  (''SIPLAFT'',   ''SIPLAFT'')
) AS v(cod, en) ON t.COD_ABREV = v.cod';
GO

-- ────────────────────────────────────────────────────────────────────────────
-- BLOQUE 4 — Traducciones: MAE_TIP_SOCIE (tipos de sociedad)
-- ────────────────────────────────────────────────────────────────────────────
EXEC sp_executesql N'
UPDATE t SET t.NOM_EN = v.en
FROM dbo.MAE_TIP_SOCIE t
JOIN (VALUES
  (1,  ''Simplified Joint Stock Company (S.A.S.)''),
  (2,  ''Corporation (S.A.)''),
  (3,  ''Limited Liability Company (Ltda.)''),
  (4,  ''General Partnership''),
  (5,  ''Limited Partnership (Simple)''),
  (6,  ''Limited Partnership by Shares''),
  (7,  ''Sole Proprietorship''),
  (8,  ''State Industrial and Commercial Company''),
  (9,  ''Non-Profit Organization''),
  (10, ''Cooperative''),
  (11, ''Branch of Foreign Company''),
  (12, ''Foreign Company with Local Domicile''),
  (13, ''Consortium''),
  (14, ''Temporary Joint Venture''),
  (15, ''Other'')
) AS v(cod, en) ON t.COD_SOCIE = v.cod';
GO

-- ────────────────────────────────────────────────────────────────────────────
-- BLOQUE 5 — Traducciones: MAE_TPCTA (tipos de cuenta bancaria)
-- ────────────────────────────────────────────────────────────────────────────
EXEC sp_executesql N'
UPDATE t SET t.NOM_EN = v.en
FROM dbo.MAE_TPCTA t
JOIN (VALUES
  (0, ''Not Assigned''),
  (1, ''Savings Account''),
  (2, ''Checking Account''),
  (3, ''Payroll Account''),
  (4, ''Electronic Account'')
) AS v(cod, en) ON t.COD_TPCTA = v.cod';
GO

-- ────────────────────────────────────────────────────────────────────────────
-- BLOQUE 6 — Traducciones: MAE_PAIS (todos los 248 países por COD_ISO2)
-- ────────────────────────────────────────────────────────────────────────────
EXEC sp_executesql N'
UPDATE t SET t.NOM_EN = v.en
FROM dbo.MAE_PAIS t
JOIN (VALUES
  (''AF'', ''Afghanistan''),
  (''AL'', ''Albania''),
  (''DE'', ''Germany''),
  (''AD'', ''Andorra''),
  (''AO'', ''Angola''),
  (''AI'', ''Anguilla''),
  (''AQ'', ''Antarctica''),
  (''AG'', ''Antigua and Barbuda''),
  (''SA'', ''Saudi Arabia''),
  (''AR'', ''Argentina''),
  (''AM'', ''Armenia''),
  (''AW'', ''Aruba''),
  (''AU'', ''Australia''),
  (''AT'', ''Austria''),
  (''AZ'', ''Azerbaijan''),
  (''BS'', ''Bahamas''),
  (''BH'', ''Bahrain''),
  (''BD'', ''Bangladesh''),
  (''BB'', ''Barbados''),
  (''BY'', ''Belarus''),
  (''BE'', ''Belgium''),
  (''BZ'', ''Belize''),
  (''BJ'', ''Benin''),
  (''BM'', ''Bermuda''),
  (''BT'', ''Bhutan''),
  (''BO'', ''Bolivia''),
  (''BQ'', ''Bonaire, Sint Eustatius and Saba''),
  (''BA'', ''Bosnia and Herzegovina''),
  (''BW'', ''Botswana''),
  (''BR'', ''Brazil''),
  (''BN'', ''Brunei Darussalam''),
  (''BG'', ''Bulgaria''),
  (''BF'', ''Burkina Faso''),
  (''BI'', ''Burundi''),
  (''CV'', ''Cabo Verde''),
  (''KH'', ''Cambodia''),
  (''CM'', ''Cameroon''),
  (''CA'', ''Canada''),
  (''KY'', ''Cayman Islands''),
  (''TD'', ''Chad''),
  (''CZ'', ''Czechia''),
  (''CL'', ''Chile''),
  (''CN'', ''China''),
  (''HK'', ''Hong Kong SAR, China''),
  (''MO'', ''Macao SAR, China''),
  (''CY'', ''Cyprus''),
  (''CO'', ''Colombia''),
  (''KM'', ''Comoros''),
  (''CG'', ''Congo''),
  (''CR'', ''Costa Rica''),
  (''CI'', ''Côte d''''Ivoire''),
  (''HR'', ''Croatia''),
  (''CU'', ''Cuba''),
  (''CW'', ''Curaçao''),
  (''DK'', ''Denmark''),
  (''DJ'', ''Djibouti''),
  (''DM'', ''Dominica''),
  (''EC'', ''Ecuador''),
  (''EG'', ''Egypt''),
  (''SV'', ''El Salvador''),
  (''AE'', ''United Arab Emirates''),
  (''ER'', ''Eritrea''),
  (''SK'', ''Slovakia''),
  (''SI'', ''Slovenia''),
  (''ES'', ''Spain''),
  (''PS'', ''State of Palestine''),
  (''US'', ''United States''),
  (''EE'', ''Estonia''),
  (''SZ'', ''Eswatini''),
  (''ET'', ''Ethiopia''),
  (''FJ'', ''Fiji''),
  (''PH'', ''Philippines''),
  (''FI'', ''Finland''),
  (''FR'', ''France''),
  (''GA'', ''Gabon''),
  (''GM'', ''Gambia''),
  (''GE'', ''Georgia''),
  (''GS'', ''South Georgia and the South Sandwich Islands''),
  (''GH'', ''Ghana''),
  (''GI'', ''Gibraltar''),
  (''GD'', ''Grenada''),
  (''GR'', ''Greece''),
  (''GL'', ''Greenland''),
  (''GP'', ''Guadeloupe''),
  (''GU'', ''Guam''),
  (''GT'', ''Guatemala''),
  (''GF'', ''French Guiana''),
  (''GG'', ''Guernsey''),
  (''GN'', ''Guinea''),
  (''GQ'', ''Equatorial Guinea''),
  (''GW'', ''Guinea-Bissau''),
  (''GY'', ''Guyana''),
  (''HT'', ''Haiti''),
  (''HN'', ''Honduras''),
  (''HU'', ''Hungary''),
  (''IN'', ''India''),
  (''ID'', ''Indonesia''),
  (''IR'', ''Iran (Islamic Republic of)''),
  (''IQ'', ''Iraq''),
  (''IE'', ''Ireland''),
  (''BV'', ''Bouvet Island''),
  (''CX'', ''Christmas Island''),
  (''IM'', ''Isle of Man''),
  (''NF'', ''Norfolk Island''),
  (''IS'', ''Iceland''),
  (''AX'', ''Åland Islands''),
  (''CC'', ''Cocos (Keeling) Islands''),
  (''CK'', ''Cook Islands''),
  (''FO'', ''Faroe Islands''),
  (''HM'', ''Heard Island and McDonald Islands''),
  (''FK'', ''Falkland Islands (Malvinas)''),
  (''MP'', ''Northern Mariana Islands''),
  (''MH'', ''Marshall Islands''),
  (''UM'', ''United States Minor Outlying Islands''),
  (''SB'', ''Solomon Islands''),
  (''SJ'', ''Svalbard and Jan Mayen''),
  (''TC'', ''Turks and Caicos Islands''),
  (''VG'', ''British Virgin Islands''),
  (''VI'', ''United States Virgin Islands''),
  (''WF'', ''Wallis and Futuna''),
  (''IL'', ''Israel''),
  (''IT'', ''Italy''),
  (''JM'', ''Jamaica''),
  (''JP'', ''Japan''),
  (''JE'', ''Jersey''),
  (''JO'', ''Jordan''),
  (''KZ'', ''Kazakhstan''),
  (''KE'', ''Kenya''),
  (''KG'', ''Kyrgyzstan''),
  (''KI'', ''Kiribati''),
  (''KW'', ''Kuwait''),
  (''LS'', ''Lesotho''),
  (''LV'', ''Latvia''),
  (''LB'', ''Lebanon''),
  (''LR'', ''Liberia''),
  (''LY'', ''Libya''),
  (''LI'', ''Liechtenstein''),
  (''LT'', ''Lithuania''),
  (''LU'', ''Luxembourg''),
  (''MK'', ''North Macedonia''),
  (''MG'', ''Madagascar''),
  (''MY'', ''Malaysia''),
  (''MW'', ''Malawi''),
  (''MV'', ''Maldives''),
  (''ML'', ''Mali''),
  (''MT'', ''Malta''),
  (''MA'', ''Morocco''),
  (''MQ'', ''Martinique''),
  (''MU'', ''Mauritius''),
  (''MR'', ''Mauritania''),
  (''YT'', ''Mayotte''),
  (''MX'', ''Mexico''),
  (''FM'', ''Micronesia (Federated States of)''),
  (''MC'', ''Monaco''),
  (''MN'', ''Mongolia''),
  (''ME'', ''Montenegro''),
  (''MS'', ''Montserrat''),
  (''MZ'', ''Mozambique''),
  (''MM'', ''Myanmar''),
  (''NA'', ''Namibia''),
  (''NR'', ''Nauru''),
  (''NP'', ''Nepal''),
  (''NI'', ''Nicaragua''),
  (''NE'', ''Niger''),
  (''NG'', ''Nigeria''),
  (''NU'', ''Niue''),
  (''NO'', ''Norway''),
  (''NC'', ''New Caledonia''),
  (''NZ'', ''New Zealand''),
  (''OM'', ''Oman''),
  (''OT'', ''Other''),
  (''NL'', ''Netherlands''),
  (''PK'', ''Pakistan''),
  (''PW'', ''Palau''),
  (''PA'', ''Panama''),
  (''PG'', ''Papua New Guinea''),
  (''PY'', ''Paraguay''),
  (''PE'', ''Peru''),
  (''PN'', ''Pitcairn''),
  (''PF'', ''French Polynesia''),
  (''PL'', ''Poland''),
  (''PT'', ''Portugal''),
  (''PR'', ''Puerto Rico''),
  (''QA'', ''Qatar''),
  (''GB'', ''United Kingdom''),
  (''SY'', ''Syrian Arab Republic''),
  (''CF'', ''Central African Republic''),
  (''KR'', ''Republic of Korea''),
  (''MD'', ''Republic of Moldova''),
  (''CD'', ''Democratic Republic of the Congo''),
  (''LA'', ''Lao People''''s Democratic Republic''),
  (''DO'', ''Dominican Republic''),
  (''KP'', ''Democratic People''''s Republic of Korea''),
  (''TZ'', ''United Republic of Tanzania''),
  (''RE'', ''Réunion''),
  (''RO'', ''Romania''),
  (''RU'', ''Russia''),
  (''RW'', ''Rwanda''),
  (''EH'', ''Western Sahara''),
  (''KN'', ''Saint Kitts and Nevis''),
  (''WS'', ''Samoa''),
  (''AS'', ''American Samoa''),
  (''BL'', ''Saint Barthélemy''),
  (''SM'', ''San Marino''),
  (''MF'', ''Saint Martin (French part)''),
  (''SX'', ''Sint Maarten (Dutch part)''),
  (''PM'', ''Saint Pierre and Miquelon''),
  (''VC'', ''Saint Vincent and the Grenadines''),
  (''SH'', ''Saint Helena, Ascension and Tristan da Cunha''),
  (''LC'', ''Saint Lucia''),
  (''VA'', ''Holy See''),
  (''ST'', ''Sao Tome and Principe''),
  (''SN'', ''Senegal''),
  (''RS'', ''Serbia''),
  (''SC'', ''Seychelles''),
  (''SL'', ''Sierra Leone''),
  (''SG'', ''Singapore''),
  (''SO'', ''Somalia''),
  (''LK'', ''Sri Lanka''),
  (''ZA'', ''South Africa''),
  (''SD'', ''Sudan''),
  (''SS'', ''South Sudan''),
  (''SE'', ''Sweden''),
  (''CH'', ''Switzerland''),
  (''SR'', ''Suriname''),
  (''TH'', ''Thailand''),
  (''TJ'', ''Tajikistan''),
  (''IO'', ''British Indian Ocean Territory''),
  (''TF'', ''French Southern Territories''),
  (''TL'', ''Timor-Leste''),
  (''TG'', ''Togo''),
  (''TK'', ''Tokelau''),
  (''TO'', ''Tonga''),
  (''TT'', ''Trinidad and Tobago''),
  (''TN'', ''Tunisia''),
  (''TM'', ''Turkmenistan''),
  (''TR'', ''Türkiye''),
  (''TV'', ''Tuvalu''),
  (''UA'', ''Ukraine''),
  (''UG'', ''Uganda''),
  (''UY'', ''Uruguay''),
  (''UZ'', ''Uzbekistan''),
  (''VU'', ''Vanuatu''),
  (''VE'', ''Venezuela''),
  (''VN'', ''Viet Nam''),
  (''YE'', ''Yemen''),
  (''ZM'', ''Zambia''),
  (''ZW'', ''Zimbabwe'')
) AS v(iso2, en) ON t.COD_ISO2 = v.iso2';
GO

-- ────────────────────────────────────────────────────────────────────────────
-- BLOQUE 7 — Verificación final
-- ────────────────────────────────────────────────────────────────────────────
SELECT
  'MAE_TPDOC'    AS Tabla,
  COUNT(*)        AS Total,
  SUM(CASE WHEN NOM_EN IS NULL THEN 1 ELSE 0 END) AS SinTraduccion
FROM dbo.MAE_TPDOC WHERE COD_TPDOC > 0
UNION ALL
SELECT 'MAE_SIST_PREV', COUNT(*), SUM(CASE WHEN NOM_EN IS NULL THEN 1 ELSE 0 END)
FROM dbo.MAE_SIST_PREV
UNION ALL
SELECT 'MAE_TIP_SOCIE', COUNT(*), SUM(CASE WHEN NOM_EN IS NULL THEN 1 ELSE 0 END)
FROM dbo.MAE_TIP_SOCIE
UNION ALL
SELECT 'MAE_TPCTA', COUNT(*), SUM(CASE WHEN NOM_EN IS NULL THEN 1 ELSE 0 END)
FROM dbo.MAE_TPCTA
UNION ALL
SELECT 'MAE_PAIS', COUNT(*), SUM(CASE WHEN NOM_EN IS NULL THEN 1 ELSE 0 END)
FROM dbo.MAE_PAIS WHERE COD_PAIS > 0;
GO

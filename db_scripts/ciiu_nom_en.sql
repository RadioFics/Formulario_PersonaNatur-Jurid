-- ============================================================
-- Script: ciiu_nom_en.sql
-- Descripción: Agrega columna NOM_EN a MAE_CIIU y carga las
--              descripciones en inglés para los 504 códigos
--              CIIU Rev. 4 Colombia (ISIC Rev. 4 adaptado).
-- Base:   MineDax
-- Fecha:  2026-06-17
-- ============================================================

USE MineDax;
GO

-- 1. Agregar columna (idempotente: solo si no existe)
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('MAE_CIIU') AND name = 'NOM_EN'
)
  ALTER TABLE MAE_CIIU ADD NOM_EN nvarchar(250) NULL;
GO

-- 2. Poblar NOM_EN — códigos especiales colombianos (0010-0090)
UPDATE MAE_CIIU SET NOM_EN = 'Natural persons with employment income'             WHERE COD_CIIU = '0010';
UPDATE MAE_CIIU SET NOM_EN = 'Natural persons with pension income'                WHERE COD_CIIU = '0020';
UPDATE MAE_CIIU SET NOM_EN = 'Natural persons without economic activity'           WHERE COD_CIIU = '0081';
UPDATE MAE_CIIU SET NOM_EN = 'Natural persons with capital investment income'      WHERE COD_CIIU = '0082';
UPDATE MAE_CIIU SET NOM_EN = 'Natural persons receiving funds from third parties'  WHERE COD_CIIU = '0090';

-- Sección A — Agricultura, ganadería, caza, silvicultura y pesca
UPDATE MAE_CIIU SET NOM_EN = 'Growing of cereals (except rice), leguminous crops and oil seeds' WHERE COD_CIIU = '0111';
UPDATE MAE_CIIU SET NOM_EN = 'Growing of rice'                                         WHERE COD_CIIU = '0112';
UPDATE MAE_CIIU SET NOM_EN = 'Growing of vegetables, roots and tubers'                 WHERE COD_CIIU = '0113';
UPDATE MAE_CIIU SET NOM_EN = 'Growing of tobacco'                                      WHERE COD_CIIU = '0114';
UPDATE MAE_CIIU SET NOM_EN = 'Growing of fibre crops'                                  WHERE COD_CIIU = '0115';
UPDATE MAE_CIIU SET NOM_EN = 'Growing of other non-perennial crops n.e.c.'             WHERE COD_CIIU = '0119';
UPDATE MAE_CIIU SET NOM_EN = 'Growing of tropical and subtropical fruits'               WHERE COD_CIIU = '0121';
UPDATE MAE_CIIU SET NOM_EN = 'Growing of plantains and bananas'                        WHERE COD_CIIU = '0122';
UPDATE MAE_CIIU SET NOM_EN = 'Growing of coffee'                                       WHERE COD_CIIU = '0123';
UPDATE MAE_CIIU SET NOM_EN = 'Growing of sugar cane'                                   WHERE COD_CIIU = '0124';
UPDATE MAE_CIIU SET NOM_EN = 'Growing of cut flowers'                                  WHERE COD_CIIU = '0125';
UPDATE MAE_CIIU SET NOM_EN = 'Growing of oil palm and other oleaginous fruits'         WHERE COD_CIIU = '0126';
UPDATE MAE_CIIU SET NOM_EN = 'Growing of beverage crops'                               WHERE COD_CIIU = '0127';
UPDATE MAE_CIIU SET NOM_EN = 'Growing of spices, aromatic, drug and pharmaceutical crops' WHERE COD_CIIU = '0128';
UPDATE MAE_CIIU SET NOM_EN = 'Growing of other permanent crops n.e.c.'                WHERE COD_CIIU = '0129';
UPDATE MAE_CIIU SET NOM_EN = 'Plant propagation (nurseries, except forest nurseries)'  WHERE COD_CIIU = '0130';
UPDATE MAE_CIIU SET NOM_EN = 'Raising of cattle and buffalo'                           WHERE COD_CIIU = '0141';
UPDATE MAE_CIIU SET NOM_EN = 'Raising of horses and other equines'                     WHERE COD_CIIU = '0142';
UPDATE MAE_CIIU SET NOM_EN = 'Raising of sheep and goats'                              WHERE COD_CIIU = '0143';
UPDATE MAE_CIIU SET NOM_EN = 'Raising of swine/pigs'                                  WHERE COD_CIIU = '0144';
UPDATE MAE_CIIU SET NOM_EN = 'Raising of poultry'                                     WHERE COD_CIIU = '0145';
UPDATE MAE_CIIU SET NOM_EN = 'Raising of other animals n.e.c.'                        WHERE COD_CIIU = '0149';
UPDATE MAE_CIIU SET NOM_EN = 'Mixed farming (crop and animal production)'              WHERE COD_CIIU = '0150';
UPDATE MAE_CIIU SET NOM_EN = 'Support activities for crop production'                  WHERE COD_CIIU = '0161';
UPDATE MAE_CIIU SET NOM_EN = 'Support activities for animal production'                WHERE COD_CIIU = '0162';
UPDATE MAE_CIIU SET NOM_EN = 'Post-harvest crop activities'                            WHERE COD_CIIU = '0163';
UPDATE MAE_CIIU SET NOM_EN = 'Seed processing for propagation'                         WHERE COD_CIIU = '0164';
UPDATE MAE_CIIU SET NOM_EN = 'Hunting, trapping and related service activities'        WHERE COD_CIIU = '0170';
UPDATE MAE_CIIU SET NOM_EN = 'Silviculture and other forestry activities'              WHERE COD_CIIU = '0210';
UPDATE MAE_CIIU SET NOM_EN = 'Logging'                                                 WHERE COD_CIIU = '0220';
UPDATE MAE_CIIU SET NOM_EN = 'Gathering of non-wood forest products'                   WHERE COD_CIIU = '0230';
UPDATE MAE_CIIU SET NOM_EN = 'Support services to forestry'                            WHERE COD_CIIU = '0240';
UPDATE MAE_CIIU SET NOM_EN = 'Marine fishing'                                          WHERE COD_CIIU = '0311';
UPDATE MAE_CIIU SET NOM_EN = 'Freshwater fishing'                                      WHERE COD_CIIU = '0312';
UPDATE MAE_CIIU SET NOM_EN = 'Marine aquaculture'                                      WHERE COD_CIIU = '0321';
UPDATE MAE_CIIU SET NOM_EN = 'Freshwater aquaculture'                                  WHERE COD_CIIU = '0322';

-- Sección B — Explotación de minas y canteras
UPDATE MAE_CIIU SET NOM_EN = 'Mining of hard coal'                                     WHERE COD_CIIU = '0510';
UPDATE MAE_CIIU SET NOM_EN = 'Mining of lignite'                                       WHERE COD_CIIU = '0520';
UPDATE MAE_CIIU SET NOM_EN = 'Extraction of crude petroleum'                           WHERE COD_CIIU = '0610';
UPDATE MAE_CIIU SET NOM_EN = 'Extraction of natural gas'                               WHERE COD_CIIU = '0620';
UPDATE MAE_CIIU SET NOM_EN = 'Mining of iron ores'                                     WHERE COD_CIIU = '0710';
UPDATE MAE_CIIU SET NOM_EN = 'Mining of uranium and thorium ores'                      WHERE COD_CIIU = '0721';
UPDATE MAE_CIIU SET NOM_EN = 'Mining of gold and other precious metals'                WHERE COD_CIIU = '0722';
UPDATE MAE_CIIU SET NOM_EN = 'Mining of nickel ores'                                   WHERE COD_CIIU = '0723';
UPDATE MAE_CIIU SET NOM_EN = 'Mining of other non-ferrous metal ores n.e.c.'           WHERE COD_CIIU = '0729';
UPDATE MAE_CIIU SET NOM_EN = 'Quarrying of stone, sand, clay and kaolin'               WHERE COD_CIIU = '0811';
UPDATE MAE_CIIU SET NOM_EN = 'Quarrying of industrial clay, limestone, kaolin and bentonite' WHERE COD_CIIU = '0812';
UPDATE MAE_CIIU SET NOM_EN = 'Mining of emeralds, precious and semi-precious stones'   WHERE COD_CIIU = '0820';
UPDATE MAE_CIIU SET NOM_EN = 'Mining of chemical and fertilizer minerals'               WHERE COD_CIIU = '0891';
UPDATE MAE_CIIU SET NOM_EN = 'Extraction of salt (halite)'                             WHERE COD_CIIU = '0892';
UPDATE MAE_CIIU SET NOM_EN = 'Other mining and quarrying n.e.c.'                       WHERE COD_CIIU = '0899';
UPDATE MAE_CIIU SET NOM_EN = 'Support activities for petroleum and natural gas extraction' WHERE COD_CIIU = '0910';
UPDATE MAE_CIIU SET NOM_EN = 'Support activities for other mining and quarrying'        WHERE COD_CIIU = '0990';

-- Sección C — Industrias manufactureras
UPDATE MAE_CIIU SET NOM_EN = 'Processing and preserving of meat and meat products'     WHERE COD_CIIU = '1011';
UPDATE MAE_CIIU SET NOM_EN = 'Processing and preserving of fish, crustaceans and molluscs' WHERE COD_CIIU = '1012';
UPDATE MAE_CIIU SET NOM_EN = 'Processing and preserving of fruit, vegetables and tubers' WHERE COD_CIIU = '1020';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of vegetable and animal oils and fats'       WHERE COD_CIIU = '1030';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of dairy products'                           WHERE COD_CIIU = '1040';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of grain mill products'                      WHERE COD_CIIU = '1051';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of starches and starch products'             WHERE COD_CIIU = '1052';
UPDATE MAE_CIIU SET NOM_EN = 'Coffee hulling'                                          WHERE COD_CIIU = '1061';
UPDATE MAE_CIIU SET NOM_EN = 'Coffee decaffeination, roasting and grinding'            WHERE COD_CIIU = '1062';
UPDATE MAE_CIIU SET NOM_EN = 'Other coffee derivatives'                                WHERE COD_CIIU = '1063';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture and refining of sugar'                       WHERE COD_CIIU = '1071';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of raw cane sugar (panela)'                  WHERE COD_CIIU = '1072';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of bakery products'                          WHERE COD_CIIU = '1081';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of cocoa, chocolate and sugar confectionery'  WHERE COD_CIIU = '1082';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of macaroni, noodles, couscous and similar farinaceous products' WHERE COD_CIIU = '1083';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of prepared meals and dishes'                WHERE COD_CIIU = '1084';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of other food products n.e.c.'               WHERE COD_CIIU = '1089';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of prepared animal feeds'                    WHERE COD_CIIU = '1090';
UPDATE MAE_CIIU SET NOM_EN = 'Distilling, rectifying and blending of spirits'          WHERE COD_CIIU = '1101';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of non-distilled fermented beverages'        WHERE COD_CIIU = '1102';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of malt, beer and other malt beverages'      WHERE COD_CIIU = '1103';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of soft drinks; production of mineral and bottled waters' WHERE COD_CIIU = '1104';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of tobacco products'                         WHERE COD_CIIU = '1200';
UPDATE MAE_CIIU SET NOM_EN = 'Preparation and spinning of textile fibres'              WHERE COD_CIIU = '1311';
UPDATE MAE_CIIU SET NOM_EN = 'Weaving of textiles'                                     WHERE COD_CIIU = '1312';
UPDATE MAE_CIIU SET NOM_EN = 'Finishing of textiles'                                   WHERE COD_CIIU = '1313';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of knitted and crocheted fabrics'            WHERE COD_CIIU = '1391';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of made-up textile articles, except apparel' WHERE COD_CIIU = '1392';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of carpets and rugs'                         WHERE COD_CIIU = '1393';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of cordage, rope, twine and netting'         WHERE COD_CIIU = '1394';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of other textiles n.e.c.'                    WHERE COD_CIIU = '1399';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of wearing apparel, except fur apparel'      WHERE COD_CIIU = '1410';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of articles of fur'                          WHERE COD_CIIU = '1420';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of knitted and crocheted apparel'            WHERE COD_CIIU = '1430';
UPDATE MAE_CIIU SET NOM_EN = 'Tanning and dressing of leather; dressing and dyeing of fur' WHERE COD_CIIU = '1511';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of luggage, handbags and the like (leather), saddlery and harness' WHERE COD_CIIU = '1512';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of luggage, handbags and the like (other materials), saddlery and harness' WHERE COD_CIIU = '1513';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of leather and skin footwear with any type of sole' WHERE COD_CIIU = '1521';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of other types of footwear, except leather footwear' WHERE COD_CIIU = '1522';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of parts of footwear'                        WHERE COD_CIIU = '1523';
UPDATE MAE_CIIU SET NOM_EN = 'Sawmilling and planing of wood'                          WHERE COD_CIIU = '1610';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of veneer sheets and wood-based panels'      WHERE COD_CIIU = '1620';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of builders'' carpentry and joinery'          WHERE COD_CIIU = '1630';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of wooden containers'                        WHERE COD_CIIU = '1640';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of other products of wood, cork, straw and plaiting materials' WHERE COD_CIIU = '1690';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of pulp, paper and paperboard'               WHERE COD_CIIU = '1701';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of corrugated paper and paperboard containers' WHERE COD_CIIU = '1702';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of other articles of paper and paperboard'   WHERE COD_CIIU = '1709';
UPDATE MAE_CIIU SET NOM_EN = 'Printing'                                                WHERE COD_CIIU = '1811';
UPDATE MAE_CIIU SET NOM_EN = 'Service activities related to printing'                   WHERE COD_CIIU = '1812';
UPDATE MAE_CIIU SET NOM_EN = 'Reproduction of recorded media'                          WHERE COD_CIIU = '1820';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of coke oven products'                       WHERE COD_CIIU = '1910';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of refined petroleum products'               WHERE COD_CIIU = '1921';
UPDATE MAE_CIIU SET NOM_EN = 'Fuel blending activity'                                  WHERE COD_CIIU = '1922';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of basic chemicals and chemical products'    WHERE COD_CIIU = '2011';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of fertilizers and nitrogen compounds'       WHERE COD_CIIU = '2012';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of plastics in primary forms'                WHERE COD_CIIU = '2013';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of synthetic rubber in primary forms'        WHERE COD_CIIU = '2014';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of pesticides and other agrochemical products' WHERE COD_CIIU = '2021';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of paints, varnishes, printing ink and mastics' WHERE COD_CIIU = '2022';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of soap, detergents, cleaning preparations, perfumes and toiletries' WHERE COD_CIIU = '2023';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of other chemical products n.e.c.'           WHERE COD_CIIU = '2029';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of man-made fibres'                          WHERE COD_CIIU = '2030';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of pharmaceuticals, medicinal chemicals and botanical products' WHERE COD_CIIU = '2100';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of rubber tyres and tubes'                   WHERE COD_CIIU = '2211';
UPDATE MAE_CIIU SET NOM_EN = 'Retreading of used tyres'                                WHERE COD_CIIU = '2212';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of other rubber products n.e.c.'             WHERE COD_CIIU = '2219';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of plastics articles'                        WHERE COD_CIIU = '2221';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of other plastic products n.e.c.'            WHERE COD_CIIU = '2229';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of glass and glass products'                 WHERE COD_CIIU = '2310';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of refractory products'                      WHERE COD_CIIU = '2391';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of clay building materials'                  WHERE COD_CIIU = '2392';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of other porcelain and ceramic products'     WHERE COD_CIIU = '2393';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of cement, lime and plaster'                 WHERE COD_CIIU = '2394';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of articles of concrete, cement and plaster' WHERE COD_CIIU = '2395';
UPDATE MAE_CIIU SET NOM_EN = 'Cutting, shaping and finishing of stone'                 WHERE COD_CIIU = '2396';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of other non-metallic mineral products n.e.c.' WHERE COD_CIIU = '2399';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of basic iron and steel'                     WHERE COD_CIIU = '2410';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of precious metals'                          WHERE COD_CIIU = '2421';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of other non-ferrous metals'                 WHERE COD_CIIU = '2429';
UPDATE MAE_CIIU SET NOM_EN = 'Casting of iron and steel'                               WHERE COD_CIIU = '2431';
UPDATE MAE_CIIU SET NOM_EN = 'Casting of non-ferrous metals'                           WHERE COD_CIIU = '2432';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of structural metal products'                WHERE COD_CIIU = '2511';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of tanks, reservoirs and containers of metal' WHERE COD_CIIU = '2512';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of steam generators, except central heating hot water boilers' WHERE COD_CIIU = '2513';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of weapons and ammunition'                   WHERE COD_CIIU = '2520';
UPDATE MAE_CIIU SET NOM_EN = 'Forging, pressing, stamping and roll-forming of metal; powder metallurgy' WHERE COD_CIIU = '2591';
UPDATE MAE_CIIU SET NOM_EN = 'Treatment and coating of metals; machining'              WHERE COD_CIIU = '2592';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of cutlery, hand tools and general hardware' WHERE COD_CIIU = '2593';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of other fabricated metal products n.e.c.'  WHERE COD_CIIU = '2599';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of electronic components and boards'         WHERE COD_CIIU = '2610';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of computers and peripheral equipment'       WHERE COD_CIIU = '2620';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of communication equipment'                  WHERE COD_CIIU = '2630';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of consumer electronics'                     WHERE COD_CIIU = '2640';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of measuring, testing, navigating and control equipment' WHERE COD_CIIU = '2651';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of watches and clocks'                       WHERE COD_CIIU = '2652';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of irradiation and electromedical equipment' WHERE COD_CIIU = '2660';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of optical instruments and photographic equipment' WHERE COD_CIIU = '2670';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of magnetic and optical media'               WHERE COD_CIIU = '2680';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of electric motors, generators and transformers' WHERE COD_CIIU = '2711';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of electricity distribution and control apparatus' WHERE COD_CIIU = '2712';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of batteries and accumulators'               WHERE COD_CIIU = '2720';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of fibre optic cables'                       WHERE COD_CIIU = '2731';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of wiring devices'                           WHERE COD_CIIU = '2732';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of electric lighting equipment'              WHERE COD_CIIU = '2740';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of domestic appliances'                      WHERE COD_CIIU = '2750';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of other electrical equipment n.e.c.'        WHERE COD_CIIU = '2790';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of engines and turbines, except aircraft, vehicle and cycle engines' WHERE COD_CIIU = '2811';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of fluid power equipment'                    WHERE COD_CIIU = '2812';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of other pumps, compressors, taps and valves' WHERE COD_CIIU = '2813';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of bearings, gears, gearing and driving elements' WHERE COD_CIIU = '2814';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of ovens, furnaces and furnace burners'      WHERE COD_CIIU = '2815';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of lifting and handling equipment'           WHERE COD_CIIU = '2816';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of office machinery and equipment (except computers)' WHERE COD_CIIU = '2817';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of power-driven hand tools'                  WHERE COD_CIIU = '2818';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of other general-purpose machinery n.e.c.'   WHERE COD_CIIU = '2819';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of agricultural and forestry machinery'      WHERE COD_CIIU = '2821';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of metal-forming machinery and machine tools' WHERE COD_CIIU = '2822';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of machinery for metallurgy'                 WHERE COD_CIIU = '2823';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of machinery for mining, quarrying and construction' WHERE COD_CIIU = '2824';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of machinery for food, beverage and tobacco processing' WHERE COD_CIIU = '2825';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of machinery for textile, apparel and leather production' WHERE COD_CIIU = '2826';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of other special-purpose machinery n.e.c.'   WHERE COD_CIIU = '2829';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of motor vehicles'                           WHERE COD_CIIU = '2910';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of bodies for motor vehicles; manufacture of trailers and semi-trailers' WHERE COD_CIIU = '2920';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of parts, pieces and accessories for motor vehicles' WHERE COD_CIIU = '2930';
UPDATE MAE_CIIU SET NOM_EN = 'Building of ships and floating structures'               WHERE COD_CIIU = '3011';
UPDATE MAE_CIIU SET NOM_EN = 'Building of pleasure and sporting boats'                 WHERE COD_CIIU = '3012';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of railway locomotives and rolling stock'    WHERE COD_CIIU = '3020';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of air and spacecraft and related machinery' WHERE COD_CIIU = '3030';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of military fighting vehicles'               WHERE COD_CIIU = '3040';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of motorcycles'                              WHERE COD_CIIU = '3091';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of bicycles and invalid carriages'           WHERE COD_CIIU = '3092';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of other transport equipment n.e.c.'         WHERE COD_CIIU = '3099';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of furniture'                                WHERE COD_CIIU = '3110';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of mattresses and bed bases'                 WHERE COD_CIIU = '3120';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of jewellery, bijouterie and related articles' WHERE COD_CIIU = '3210';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of musical instruments'                      WHERE COD_CIIU = '3220';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of sports goods'                             WHERE COD_CIIU = '3230';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of games and toys'                           WHERE COD_CIIU = '3240';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of medical and dental instruments and supplies' WHERE COD_CIIU = '3250';
UPDATE MAE_CIIU SET NOM_EN = 'Other manufacturing n.e.c.'                              WHERE COD_CIIU = '3290';
UPDATE MAE_CIIU SET NOM_EN = 'Repair of fabricated metal products'                     WHERE COD_CIIU = '3311';
UPDATE MAE_CIIU SET NOM_EN = 'Repair of machinery and equipment'                       WHERE COD_CIIU = '3312';
UPDATE MAE_CIIU SET NOM_EN = 'Repair of electronic and optical equipment'              WHERE COD_CIIU = '3313';
UPDATE MAE_CIIU SET NOM_EN = 'Repair of electrical equipment'                          WHERE COD_CIIU = '3314';
UPDATE MAE_CIIU SET NOM_EN = 'Repair of transport equipment, except motor vehicles, motorcycles and bicycles' WHERE COD_CIIU = '3315';
UPDATE MAE_CIIU SET NOM_EN = 'Repair of other equipment n.e.c.'                        WHERE COD_CIIU = '3319';
UPDATE MAE_CIIU SET NOM_EN = 'Installation of industrial machinery and equipment'      WHERE COD_CIIU = '3320';

-- Sección D — Suministro de electricidad, gas, vapor y aire acondicionado
UPDATE MAE_CIIU SET NOM_EN = 'Electric power generation'                               WHERE COD_CIIU = '3511';
UPDATE MAE_CIIU SET NOM_EN = 'Electric power transmission'                             WHERE COD_CIIU = '3512';
UPDATE MAE_CIIU SET NOM_EN = 'Electric power distribution'                             WHERE COD_CIIU = '3513';
UPDATE MAE_CIIU SET NOM_EN = 'Electric power trading'                                  WHERE COD_CIIU = '3514';
UPDATE MAE_CIIU SET NOM_EN = 'Manufacture of gas; distribution of gaseous fuels through mains' WHERE COD_CIIU = '3520';
UPDATE MAE_CIIU SET NOM_EN = 'Steam and air conditioning supply'                       WHERE COD_CIIU = '3530';

-- Sección E — Suministro de agua; alcantarillado, gestión de desechos
UPDATE MAE_CIIU SET NOM_EN = 'Water collection, treatment and supply'                  WHERE COD_CIIU = '3600';
UPDATE MAE_CIIU SET NOM_EN = 'Sewerage'                                                WHERE COD_CIIU = '3700';
UPDATE MAE_CIIU SET NOM_EN = 'Collection of non-hazardous waste'                       WHERE COD_CIIU = '3811';
UPDATE MAE_CIIU SET NOM_EN = 'Collection of hazardous waste'                           WHERE COD_CIIU = '3812';
UPDATE MAE_CIIU SET NOM_EN = 'Treatment and disposal of non-hazardous waste'           WHERE COD_CIIU = '3821';
UPDATE MAE_CIIU SET NOM_EN = 'Treatment and disposal of hazardous waste'               WHERE COD_CIIU = '3822';
UPDATE MAE_CIIU SET NOM_EN = 'Materials recovery'                                      WHERE COD_CIIU = '3830';
UPDATE MAE_CIIU SET NOM_EN = 'Environmental remediation and other waste management services' WHERE COD_CIIU = '3900';

-- Sección F — Construcción
UPDATE MAE_CIIU SET NOM_EN = 'Construction of residential buildings'                   WHERE COD_CIIU = '4111';
UPDATE MAE_CIIU SET NOM_EN = 'Construction of non-residential buildings'               WHERE COD_CIIU = '4112';
UPDATE MAE_CIIU SET NOM_EN = 'Construction of roads and railways'                      WHERE COD_CIIU = '4210';
UPDATE MAE_CIIU SET NOM_EN = 'Construction of utility projects'                        WHERE COD_CIIU = '4220';
UPDATE MAE_CIIU SET NOM_EN = 'Construction of other civil engineering projects'        WHERE COD_CIIU = '4290';
UPDATE MAE_CIIU SET NOM_EN = 'Demolition'                                              WHERE COD_CIIU = '4311';
UPDATE MAE_CIIU SET NOM_EN = 'Site preparation'                                        WHERE COD_CIIU = '4312';
UPDATE MAE_CIIU SET NOM_EN = 'Electrical installation'                                 WHERE COD_CIIU = '4321';
UPDATE MAE_CIIU SET NOM_EN = 'Plumbing, heating and air-conditioning installation'     WHERE COD_CIIU = '4322';
UPDATE MAE_CIIU SET NOM_EN = 'Other construction installation'                         WHERE COD_CIIU = '4329';
UPDATE MAE_CIIU SET NOM_EN = 'Building completion and finishing'                       WHERE COD_CIIU = '4330';
UPDATE MAE_CIIU SET NOM_EN = 'Other specialized construction activities'               WHERE COD_CIIU = '4390';

-- Sección G — Comercio al por mayor y al por menor
UPDATE MAE_CIIU SET NOM_EN = 'Sale of new motor vehicles'                              WHERE COD_CIIU = '4511';
UPDATE MAE_CIIU SET NOM_EN = 'Sale of used motor vehicles'                             WHERE COD_CIIU = '4512';
UPDATE MAE_CIIU SET NOM_EN = 'Maintenance and repair of motor vehicles'                WHERE COD_CIIU = '4520';
UPDATE MAE_CIIU SET NOM_EN = 'Sale of motor vehicle parts and accessories'             WHERE COD_CIIU = '4530';
UPDATE MAE_CIIU SET NOM_EN = 'Sale of motorcycles and their parts and accessories'     WHERE COD_CIIU = '4541';
UPDATE MAE_CIIU SET NOM_EN = 'Maintenance and repair of motorcycles'                   WHERE COD_CIIU = '4542';
UPDATE MAE_CIIU SET NOM_EN = 'Wholesale on a fee or contract basis'                    WHERE COD_CIIU = '4610';
UPDATE MAE_CIIU SET NOM_EN = 'Wholesale of agricultural raw materials and live animals' WHERE COD_CIIU = '4620';
UPDATE MAE_CIIU SET NOM_EN = 'Wholesale of food'                                       WHERE COD_CIIU = '4631';
UPDATE MAE_CIIU SET NOM_EN = 'Wholesale of beverages and tobacco'                      WHERE COD_CIIU = '4632';
UPDATE MAE_CIIU SET NOM_EN = 'Wholesale of textiles and textile products for domestic use' WHERE COD_CIIU = '4641';
UPDATE MAE_CIIU SET NOM_EN = 'Wholesale of clothing'                                   WHERE COD_CIIU = '4642';
UPDATE MAE_CIIU SET NOM_EN = 'Wholesale of footwear'                                   WHERE COD_CIIU = '4643';
UPDATE MAE_CIIU SET NOM_EN = 'Wholesale of household appliances and equipment'         WHERE COD_CIIU = '4644';
UPDATE MAE_CIIU SET NOM_EN = 'Wholesale of pharmaceutical, medical, cosmetic and toilet products' WHERE COD_CIIU = '4645';
UPDATE MAE_CIIU SET NOM_EN = 'Wholesale of other household goods n.e.c.'               WHERE COD_CIIU = '4649';
UPDATE MAE_CIIU SET NOM_EN = 'Wholesale of computers, peripheral equipment and software' WHERE COD_CIIU = '4651';
UPDATE MAE_CIIU SET NOM_EN = 'Wholesale of electronic and telecommunications equipment and parts' WHERE COD_CIIU = '4652';
UPDATE MAE_CIIU SET NOM_EN = 'Wholesale of agricultural machinery, equipment and supplies' WHERE COD_CIIU = '4653';
UPDATE MAE_CIIU SET NOM_EN = 'Wholesale of other machinery and equipment n.e.c.'       WHERE COD_CIIU = '4659';
UPDATE MAE_CIIU SET NOM_EN = 'Wholesale of solid, liquid and gaseous fuels and related products' WHERE COD_CIIU = '4661';
UPDATE MAE_CIIU SET NOM_EN = 'Wholesale of metals and metal ores'                      WHERE COD_CIIU = '4662';
UPDATE MAE_CIIU SET NOM_EN = 'Wholesale of construction materials, hardware, plumbing and heating equipment' WHERE COD_CIIU = '4663';
UPDATE MAE_CIIU SET NOM_EN = 'Wholesale of chemical products, rubber and plastics and agrochemicals' WHERE COD_CIIU = '4664';
UPDATE MAE_CIIU SET NOM_EN = 'Wholesale of waste and scrap'                            WHERE COD_CIIU = '4665';
UPDATE MAE_CIIU SET NOM_EN = 'Wholesale of other products n.e.c.'                     WHERE COD_CIIU = '4669';
UPDATE MAE_CIIU SET NOM_EN = 'Non-specialized wholesale trade'                         WHERE COD_CIIU = '4690';
UPDATE MAE_CIIU SET NOM_EN = 'Retail sale in non-specialized stores with food, beverages or tobacco predominating' WHERE COD_CIIU = '4711';
UPDATE MAE_CIIU SET NOM_EN = 'Other retail sale in non-specialized stores'             WHERE COD_CIIU = '4719';
UPDATE MAE_CIIU SET NOM_EN = 'Retail sale of agricultural products for consumption in specialized stores' WHERE COD_CIIU = '4721';
UPDATE MAE_CIIU SET NOM_EN = 'Retail sale of dairy products and eggs in specialized stores' WHERE COD_CIIU = '4722';
UPDATE MAE_CIIU SET NOM_EN = 'Retail sale of meat, poultry, fish and seafood in specialized stores' WHERE COD_CIIU = '4723';
UPDATE MAE_CIIU SET NOM_EN = 'Retail sale of beverages and tobacco products in specialized stores' WHERE COD_CIIU = '4724';
UPDATE MAE_CIIU SET NOM_EN = 'Other retail sale of food in specialized stores n.e.c.'  WHERE COD_CIIU = '4729';
UPDATE MAE_CIIU SET NOM_EN = 'Retail sale of automotive fuel'                          WHERE COD_CIIU = '4731';
UPDATE MAE_CIIU SET NOM_EN = 'Retail sale of lubricants, additives and automotive cleaning products' WHERE COD_CIIU = '4732';
UPDATE MAE_CIIU SET NOM_EN = 'Retail sale of computers, peripheral equipment and software in specialized stores' WHERE COD_CIIU = '4741';
UPDATE MAE_CIIU SET NOM_EN = 'Retail sale of audio and video equipment in specialized stores' WHERE COD_CIIU = '4742';
UPDATE MAE_CIIU SET NOM_EN = 'Retail sale of textiles in specialized stores'           WHERE COD_CIIU = '4751';
UPDATE MAE_CIIU SET NOM_EN = 'Retail sale of hardware, paints and glass in specialized stores' WHERE COD_CIIU = '4752';
UPDATE MAE_CIIU SET NOM_EN = 'Retail sale of carpets, rugs, wall and floor coverings in specialized stores' WHERE COD_CIIU = '4753';
UPDATE MAE_CIIU SET NOM_EN = 'Retail sale of household electrical appliances, furniture and lighting equipment' WHERE COD_CIIU = '4754';
UPDATE MAE_CIIU SET NOM_EN = 'Retail sale of household articles and utensils'         WHERE COD_CIIU = '4755';
UPDATE MAE_CIIU SET NOM_EN = 'Retail sale of other household articles in specialized stores' WHERE COD_CIIU = '4759';
UPDATE MAE_CIIU SET NOM_EN = 'Retail sale of books, newspapers, stationery and office supplies in specialized stores' WHERE COD_CIIU = '4761';
UPDATE MAE_CIIU SET NOM_EN = 'Retail sale of sporting goods in specialized stores'     WHERE COD_CIIU = '4762';
UPDATE MAE_CIIU SET NOM_EN = 'Retail sale of other cultural and entertainment articles in specialized stores n.e.c.' WHERE COD_CIIU = '4769';
UPDATE MAE_CIIU SET NOM_EN = 'Retail sale of clothing and accessories in specialized stores' WHERE COD_CIIU = '4771';
UPDATE MAE_CIIU SET NOM_EN = 'Retail sale of footwear and leather articles in specialized stores' WHERE COD_CIIU = '4772';
UPDATE MAE_CIIU SET NOM_EN = 'Retail sale of pharmaceutical goods, cosmetics and toiletries in specialized stores' WHERE COD_CIIU = '4773';
UPDATE MAE_CIIU SET NOM_EN = 'Retail sale of other new goods in specialized stores'    WHERE COD_CIIU = '4774';
UPDATE MAE_CIIU SET NOM_EN = 'Retail sale of second-hand goods'                        WHERE COD_CIIU = '4775';
UPDATE MAE_CIIU SET NOM_EN = 'Retail sale of food, beverages and tobacco at market stalls and fairs' WHERE COD_CIIU = '4781';
UPDATE MAE_CIIU SET NOM_EN = 'Retail sale of textiles, clothing and footwear at market stalls and fairs' WHERE COD_CIIU = '4782';
UPDATE MAE_CIIU SET NOM_EN = 'Other retail sale at market stalls and fairs'            WHERE COD_CIIU = '4789';
UPDATE MAE_CIIU SET NOM_EN = 'Retail sale via Internet'                                WHERE COD_CIIU = '4791';
UPDATE MAE_CIIU SET NOM_EN = 'Retail sale via mail order houses'                       WHERE COD_CIIU = '4792';
UPDATE MAE_CIIU SET NOM_EN = 'Other retail sale not in stores, stalls or markets'      WHERE COD_CIIU = '4799';

-- Sección H — Transporte y almacenamiento
UPDATE MAE_CIIU SET NOM_EN = 'Passenger rail transport'                                WHERE COD_CIIU = '4911';
UPDATE MAE_CIIU SET NOM_EN = 'Freight rail transport'                                  WHERE COD_CIIU = '4912';
UPDATE MAE_CIIU SET NOM_EN = 'Passenger transport'                                     WHERE COD_CIIU = '4921';
UPDATE MAE_CIIU SET NOM_EN = 'Mixed transport (passengers and freight)'                WHERE COD_CIIU = '4922';
UPDATE MAE_CIIU SET NOM_EN = 'Freight transport by road'                               WHERE COD_CIIU = '4923';
UPDATE MAE_CIIU SET NOM_EN = 'Transport via pipeline'                                  WHERE COD_CIIU = '4930';
UPDATE MAE_CIIU SET NOM_EN = 'Sea and coastal passenger water transport'               WHERE COD_CIIU = '5011';
UPDATE MAE_CIIU SET NOM_EN = 'Sea and coastal freight water transport'                 WHERE COD_CIIU = '5012';
UPDATE MAE_CIIU SET NOM_EN = 'Inland passenger water transport'                        WHERE COD_CIIU = '5021';
UPDATE MAE_CIIU SET NOM_EN = 'Inland freight water transport'                          WHERE COD_CIIU = '5022';
UPDATE MAE_CIIU SET NOM_EN = 'Domestic air transport of passengers'                    WHERE COD_CIIU = '5111';
UPDATE MAE_CIIU SET NOM_EN = 'International air transport of passengers'               WHERE COD_CIIU = '5112';
UPDATE MAE_CIIU SET NOM_EN = 'Domestic air transport of cargo'                         WHERE COD_CIIU = '5121';
UPDATE MAE_CIIU SET NOM_EN = 'International air transport of cargo'                    WHERE COD_CIIU = '5122';
UPDATE MAE_CIIU SET NOM_EN = 'Warehousing and storage'                                 WHERE COD_CIIU = '5210';
UPDATE MAE_CIIU SET NOM_EN = 'Service activities incidental to land transportation'    WHERE COD_CIIU = '5221';
UPDATE MAE_CIIU SET NOM_EN = 'Service activities incidental to water transportation'   WHERE COD_CIIU = '5222';
UPDATE MAE_CIIU SET NOM_EN = 'Service activities incidental to air transportation'     WHERE COD_CIIU = '5223';
UPDATE MAE_CIIU SET NOM_EN = 'Cargo handling'                                          WHERE COD_CIIU = '5224';
UPDATE MAE_CIIU SET NOM_EN = 'Other transportation support activities'                 WHERE COD_CIIU = '5229';
UPDATE MAE_CIIU SET NOM_EN = 'National postal activities'                              WHERE COD_CIIU = '5310';
UPDATE MAE_CIIU SET NOM_EN = 'Courier activities'                                      WHERE COD_CIIU = '5320';

-- Sección I — Alojamiento y servicios de comida
UPDATE MAE_CIIU SET NOM_EN = 'Hotels'                                                  WHERE COD_CIIU = '5511';
UPDATE MAE_CIIU SET NOM_EN = 'Apart-hotels'                                            WHERE COD_CIIU = '5512';
UPDATE MAE_CIIU SET NOM_EN = 'Vacation resorts'                                        WHERE COD_CIIU = '5513';
UPDATE MAE_CIIU SET NOM_EN = 'Rural accommodation'                                     WHERE COD_CIIU = '5514';
UPDATE MAE_CIIU SET NOM_EN = 'Other accommodation for visitors'                        WHERE COD_CIIU = '5519';
UPDATE MAE_CIIU SET NOM_EN = 'Camping grounds, recreational vehicle parks and trailer parks' WHERE COD_CIIU = '5520';
UPDATE MAE_CIIU SET NOM_EN = 'Hourly rental accommodation'                             WHERE COD_CIIU = '5530';
UPDATE MAE_CIIU SET NOM_EN = 'Other accommodation n.e.c.'                              WHERE COD_CIIU = '5590';
UPDATE MAE_CIIU SET NOM_EN = 'Table service of prepared food'                          WHERE COD_CIIU = '5611';
UPDATE MAE_CIIU SET NOM_EN = 'Self-service of prepared food'                           WHERE COD_CIIU = '5612';
UPDATE MAE_CIIU SET NOM_EN = 'Cafeteria service of prepared food'                      WHERE COD_CIIU = '5613';
UPDATE MAE_CIIU SET NOM_EN = 'Other food service activities n.e.c.'                    WHERE COD_CIIU = '5619';
UPDATE MAE_CIIU SET NOM_EN = 'Event catering'                                          WHERE COD_CIIU = '5621';
UPDATE MAE_CIIU SET NOM_EN = 'Other food service activities'                           WHERE COD_CIIU = '5629';
UPDATE MAE_CIIU SET NOM_EN = 'Retail sale of alcoholic beverages for on-premises consumption' WHERE COD_CIIU = '5630';

-- Sección J — Información y comunicaciones
UPDATE MAE_CIIU SET NOM_EN = 'Book publishing'                                         WHERE COD_CIIU = '5811';
UPDATE MAE_CIIU SET NOM_EN = 'Publishing of directories and mailing lists'             WHERE COD_CIIU = '5812';
UPDATE MAE_CIIU SET NOM_EN = 'Publishing of newspapers, journals and periodicals'      WHERE COD_CIIU = '5813';
UPDATE MAE_CIIU SET NOM_EN = 'Other publishing activities'                             WHERE COD_CIIU = '5819';
UPDATE MAE_CIIU SET NOM_EN = 'Software publishing'                                     WHERE COD_CIIU = '5820';
UPDATE MAE_CIIU SET NOM_EN = 'Motion picture, video and television programme production activities' WHERE COD_CIIU = '5911';
UPDATE MAE_CIIU SET NOM_EN = 'Motion picture, video and television programme post-production activities' WHERE COD_CIIU = '5912';
UPDATE MAE_CIIU SET NOM_EN = 'Motion picture, video and television programme distribution activities' WHERE COD_CIIU = '5913';
UPDATE MAE_CIIU SET NOM_EN = 'Motion picture projection activities'                    WHERE COD_CIIU = '5914';
UPDATE MAE_CIIU SET NOM_EN = 'Sound recording and music publishing activities'         WHERE COD_CIIU = '5920';
UPDATE MAE_CIIU SET NOM_EN = 'Radio broadcasting programming and transmission activities' WHERE COD_CIIU = '6010';
UPDATE MAE_CIIU SET NOM_EN = 'Television programming and broadcasting activities'      WHERE COD_CIIU = '6020';
UPDATE MAE_CIIU SET NOM_EN = 'Wired telecommunications activities'                     WHERE COD_CIIU = '6110';
UPDATE MAE_CIIU SET NOM_EN = 'Wireless telecommunications activities'                  WHERE COD_CIIU = '6120';
UPDATE MAE_CIIU SET NOM_EN = 'Satellite telecommunications activities'                 WHERE COD_CIIU = '6130';
UPDATE MAE_CIIU SET NOM_EN = 'Other telecommunications activities'                     WHERE COD_CIIU = '6190';
UPDATE MAE_CIIU SET NOM_EN = 'Computer programming, consultancy and related activities' WHERE COD_CIIU = '6201';
UPDATE MAE_CIIU SET NOM_EN = 'Computer consultancy and computer facilities management activities' WHERE COD_CIIU = '6202';
UPDATE MAE_CIIU SET NOM_EN = 'Other information technology and computer service activities' WHERE COD_CIIU = '6209';
UPDATE MAE_CIIU SET NOM_EN = 'Data processing, hosting and related activities'         WHERE COD_CIIU = '6311';
UPDATE MAE_CIIU SET NOM_EN = 'Web portals'                                             WHERE COD_CIIU = '6312';
UPDATE MAE_CIIU SET NOM_EN = 'News agency activities'                                  WHERE COD_CIIU = '6391';
UPDATE MAE_CIIU SET NOM_EN = 'Other information service activities n.e.c.'             WHERE COD_CIIU = '6399';

-- Sección K — Actividades financieras y de seguros
UPDATE MAE_CIIU SET NOM_EN = 'Central banking'                                         WHERE COD_CIIU = '6411';
UPDATE MAE_CIIU SET NOM_EN = 'Commercial banking'                                      WHERE COD_CIIU = '6412';
UPDATE MAE_CIIU SET NOM_EN = 'Activities of holding companies'                         WHERE COD_CIIU = '6420';
UPDATE MAE_CIIU SET NOM_EN = 'Activities of finance companies (corporaciones financieras)' WHERE COD_CIIU = '6421';
UPDATE MAE_CIIU SET NOM_EN = 'Activities of financing companies (compañias de financiamiento)' WHERE COD_CIIU = '6422';
UPDATE MAE_CIIU SET NOM_EN = 'Second-tier banking activities'                          WHERE COD_CIIU = '6423';
UPDATE MAE_CIIU SET NOM_EN = 'Activities of financial cooperatives'                    WHERE COD_CIIU = '6424';
UPDATE MAE_CIIU SET NOM_EN = 'Collective investment funds and vehicles'                WHERE COD_CIIU = '6430';
UPDATE MAE_CIIU SET NOM_EN = 'Trusts, funds and similar financial entities'            WHERE COD_CIIU = '6431';
UPDATE MAE_CIIU SET NOM_EN = 'Severance funds (fondos de cesantias)'                   WHERE COD_CIIU = '6432';
UPDATE MAE_CIIU SET NOM_EN = 'Financial leasing'                                       WHERE COD_CIIU = '6491';
UPDATE MAE_CIIU SET NOM_EN = 'Financial activities of employee funds and solidarity sector' WHERE COD_CIIU = '6492';
UPDATE MAE_CIIU SET NOM_EN = 'Accounts receivable purchasing or factoring'             WHERE COD_CIIU = '6493';
UPDATE MAE_CIIU SET NOM_EN = 'Other fund distribution activities'                      WHERE COD_CIIU = '6494';
UPDATE MAE_CIIU SET NOM_EN = 'Special official financial institutions'                 WHERE COD_CIIU = '6495';
UPDATE MAE_CIIU SET NOM_EN = 'Other financial service activities n.e.c.'               WHERE COD_CIIU = '6499';
UPDATE MAE_CIIU SET NOM_EN = 'General insurance'                                       WHERE COD_CIIU = '6511';
UPDATE MAE_CIIU SET NOM_EN = 'Life insurance'                                          WHERE COD_CIIU = '6512';
UPDATE MAE_CIIU SET NOM_EN = 'Reinsurance'                                             WHERE COD_CIIU = '6513';
UPDATE MAE_CIIU SET NOM_EN = 'Capitalization'                                          WHERE COD_CIIU = '6514';
UPDATE MAE_CIIU SET NOM_EN = 'Social health insurance services'                        WHERE COD_CIIU = '6521';
UPDATE MAE_CIIU SET NOM_EN = 'Occupational risk insurance services'                    WHERE COD_CIIU = '6522';
UPDATE MAE_CIIU SET NOM_EN = 'Defined benefit pension scheme (RPM)'                    WHERE COD_CIIU = '6531';
UPDATE MAE_CIIU SET NOM_EN = 'Individual savings pension scheme (RAI)'                 WHERE COD_CIIU = '6532';
UPDATE MAE_CIIU SET NOM_EN = 'Administration of financial markets'                     WHERE COD_CIIU = '6611';
UPDATE MAE_CIIU SET NOM_EN = 'Securities and commodity brokerage'                      WHERE COD_CIIU = '6612';
UPDATE MAE_CIIU SET NOM_EN = 'Other activities related to the securities market'       WHERE COD_CIIU = '6613';
UPDATE MAE_CIIU SET NOM_EN = 'Foreign exchange offices'                                WHERE COD_CIIU = '6614';
UPDATE MAE_CIIU SET NOM_EN = 'Activities of foreign exchange professionals'            WHERE COD_CIIU = '6615';
UPDATE MAE_CIIU SET NOM_EN = 'Other auxiliary financial service activities n.e.c.'     WHERE COD_CIIU = '6619';
UPDATE MAE_CIIU SET NOM_EN = 'Insurance agents and brokers activities'                 WHERE COD_CIIU = '6621';
UPDATE MAE_CIIU SET NOM_EN = 'Risk and damage assessment and other auxiliary insurance activities' WHERE COD_CIIU = '6629';
UPDATE MAE_CIIU SET NOM_EN = 'Fund management activities'                              WHERE COD_CIIU = '6630';

-- Sección L — Actividades inmobiliarias
UPDATE MAE_CIIU SET NOM_EN = 'Real estate activities with own or leased property'      WHERE COD_CIIU = '6810';
UPDATE MAE_CIIU SET NOM_EN = 'Real estate activities on a fee or contract basis'       WHERE COD_CIIU = '6820';

-- Sección M — Actividades profesionales, científicas y técnicas
UPDATE MAE_CIIU SET NOM_EN = 'Legal activities'                                        WHERE COD_CIIU = '6910';
UPDATE MAE_CIIU SET NOM_EN = 'Accounting, bookkeeping, auditing and tax consultancy'   WHERE COD_CIIU = '6920';
UPDATE MAE_CIIU SET NOM_EN = 'Business management activities'                          WHERE COD_CIIU = '7010';
UPDATE MAE_CIIU SET NOM_EN = 'Business management consultancy activities'              WHERE COD_CIIU = '7020';
UPDATE MAE_CIIU SET NOM_EN = 'Architectural and engineering activities'                WHERE COD_CIIU = '7110';
UPDATE MAE_CIIU SET NOM_EN = 'Technical testing and analysis'                          WHERE COD_CIIU = '7120';
UPDATE MAE_CIIU SET NOM_EN = 'Research and experimental development in natural sciences and engineering' WHERE COD_CIIU = '7210';
UPDATE MAE_CIIU SET NOM_EN = 'Research and experimental development in social sciences and humanities' WHERE COD_CIIU = '7220';
UPDATE MAE_CIIU SET NOM_EN = 'Advertising'                                             WHERE COD_CIIU = '7310';
UPDATE MAE_CIIU SET NOM_EN = 'Market research and public opinion polling'              WHERE COD_CIIU = '7320';
UPDATE MAE_CIIU SET NOM_EN = 'Specialized design activities'                           WHERE COD_CIIU = '7410';
UPDATE MAE_CIIU SET NOM_EN = 'Photographic activities'                                 WHERE COD_CIIU = '7420';
UPDATE MAE_CIIU SET NOM_EN = 'Other professional, scientific and technical activities' WHERE COD_CIIU = '7490';
UPDATE MAE_CIIU SET NOM_EN = 'Veterinary activities'                                   WHERE COD_CIIU = '7500';

-- Sección N — Actividades de servicios administrativos y de apoyo
UPDATE MAE_CIIU SET NOM_EN = 'Renting and leasing of motor vehicles'                   WHERE COD_CIIU = '7710';
UPDATE MAE_CIIU SET NOM_EN = 'Renting and leasing of mining machinery and equipment'   WHERE COD_CIIU = '7712';
UPDATE MAE_CIIU SET NOM_EN = 'Renting and leasing of recreational and sports goods'    WHERE COD_CIIU = '7721';
UPDATE MAE_CIIU SET NOM_EN = 'Renting of video tapes and disks'                        WHERE COD_CIIU = '7722';
UPDATE MAE_CIIU SET NOM_EN = 'Renting and leasing of other personal and household goods n.e.c.' WHERE COD_CIIU = '7729';
UPDATE MAE_CIIU SET NOM_EN = 'Renting and leasing of other machinery, equipment and tangible goods n.e.c.' WHERE COD_CIIU = '7730';
UPDATE MAE_CIIU SET NOM_EN = 'Leasing of intellectual property and similar products, except copyrighted works' WHERE COD_CIIU = '7740';
UPDATE MAE_CIIU SET NOM_EN = 'Activities of employment placement agencies'             WHERE COD_CIIU = '7810';
UPDATE MAE_CIIU SET NOM_EN = 'Temporary employment agency activities'                  WHERE COD_CIIU = '7820';
UPDATE MAE_CIIU SET NOM_EN = 'Other human resources provision activities'              WHERE COD_CIIU = '7830';
UPDATE MAE_CIIU SET NOM_EN = 'Travel agency activities'                                WHERE COD_CIIU = '7911';
UPDATE MAE_CIIU SET NOM_EN = 'Tour operator activities'                                WHERE COD_CIIU = '7912';
UPDATE MAE_CIIU SET NOM_EN = 'Other reservation service and related activities'        WHERE COD_CIIU = '7990';
UPDATE MAE_CIIU SET NOM_EN = 'Private security activities'                             WHERE COD_CIIU = '8010';
UPDATE MAE_CIIU SET NOM_EN = 'Security systems service activities'                     WHERE COD_CIIU = '8020';
UPDATE MAE_CIIU SET NOM_EN = 'Investigation activities'                                WHERE COD_CIIU = '8030';
UPDATE MAE_CIIU SET NOM_EN = 'Combined facilities support activities'                  WHERE COD_CIIU = '8110';
UPDATE MAE_CIIU SET NOM_EN = 'General cleaning of buildings'                           WHERE COD_CIIU = '8121';
UPDATE MAE_CIIU SET NOM_EN = 'Other building and industrial cleaning activities'       WHERE COD_CIIU = '8129';
UPDATE MAE_CIIU SET NOM_EN = 'Landscape care and maintenance service activities'       WHERE COD_CIIU = '8130';
UPDATE MAE_CIIU SET NOM_EN = 'Combined office administrative service activities'       WHERE COD_CIIU = '8211';
UPDATE MAE_CIIU SET NOM_EN = 'Photocopying, document preparation and other specialized office support activities' WHERE COD_CIIU = '8219';
UPDATE MAE_CIIU SET NOM_EN = 'Call center activities'                                  WHERE COD_CIIU = '8220';
UPDATE MAE_CIIU SET NOM_EN = 'Organization of conventions and trade shows'             WHERE COD_CIIU = '8230';
UPDATE MAE_CIIU SET NOM_EN = 'Activities of collection agencies and credit bureaus'    WHERE COD_CIIU = '8291';
UPDATE MAE_CIIU SET NOM_EN = 'Packaging activities'                                    WHERE COD_CIIU = '8292';
UPDATE MAE_CIIU SET NOM_EN = 'Other business support service activities n.e.c.'        WHERE COD_CIIU = '8299';

-- Sección O — Administración pública
UPDATE MAE_CIIU SET NOM_EN = 'Legislative public administration activities'            WHERE COD_CIIU = '8411';
UPDATE MAE_CIIU SET NOM_EN = 'Executive public administration activities'              WHERE COD_CIIU = '8412';
UPDATE MAE_CIIU SET NOM_EN = 'Regulation of health care, education, cultural and other social services' WHERE COD_CIIU = '8413';
UPDATE MAE_CIIU SET NOM_EN = 'Regulation of and contribution to more efficient operation of businesses' WHERE COD_CIIU = '8414';
UPDATE MAE_CIIU SET NOM_EN = 'Activities of other oversight bodies'                    WHERE COD_CIIU = '8415';
UPDATE MAE_CIIU SET NOM_EN = 'Foreign affairs'                                         WHERE COD_CIIU = '8421';
UPDATE MAE_CIIU SET NOM_EN = 'Defence activities'                                      WHERE COD_CIIU = '8422';
UPDATE MAE_CIIU SET NOM_EN = 'Public order and safety activities'                      WHERE COD_CIIU = '8423';
UPDATE MAE_CIIU SET NOM_EN = 'Administration of justice'                               WHERE COD_CIIU = '8424';
UPDATE MAE_CIIU SET NOM_EN = 'Compulsory social security activities'                   WHERE COD_CIIU = '8430';

-- Sección P — Educación
UPDATE MAE_CIIU SET NOM_EN = 'Early childhood education'                               WHERE COD_CIIU = '8511';
UPDATE MAE_CIIU SET NOM_EN = 'Pre-school education'                                    WHERE COD_CIIU = '8512';
UPDATE MAE_CIIU SET NOM_EN = 'Primary education'                                       WHERE COD_CIIU = '8513';
UPDATE MAE_CIIU SET NOM_EN = 'Lower-secondary education'                               WHERE COD_CIIU = '8521';
UPDATE MAE_CIIU SET NOM_EN = 'Upper-secondary academic education'                      WHERE COD_CIIU = '8522';
UPDATE MAE_CIIU SET NOM_EN = 'Upper-secondary technical and vocational education'      WHERE COD_CIIU = '8523';
UPDATE MAE_CIIU SET NOM_EN = 'Establishments combining different levels of education'  WHERE COD_CIIU = '8530';
UPDATE MAE_CIIU SET NOM_EN = 'Technical professional education'                        WHERE COD_CIIU = '8541';
UPDATE MAE_CIIU SET NOM_EN = 'Technological education'                                 WHERE COD_CIIU = '8542';
UPDATE MAE_CIIU SET NOM_EN = 'Education of university institutions or technological schools' WHERE COD_CIIU = '8543';
UPDATE MAE_CIIU SET NOM_EN = 'University education'                                    WHERE COD_CIIU = '8544';
UPDATE MAE_CIIU SET NOM_EN = 'Non-formal academic education'                           WHERE COD_CIIU = '8551';
UPDATE MAE_CIIU SET NOM_EN = 'Sports and recreational education'                       WHERE COD_CIIU = '8552';
UPDATE MAE_CIIU SET NOM_EN = 'Cultural education'                                      WHERE COD_CIIU = '8553';
UPDATE MAE_CIIU SET NOM_EN = 'Other education n.e.c.'                                  WHERE COD_CIIU = '8559';
UPDATE MAE_CIIU SET NOM_EN = 'Educational support activities'                          WHERE COD_CIIU = '8560';

-- Sección Q — Actividades de atención de la salud humana y de asistencia social
UPDATE MAE_CIIU SET NOM_EN = 'Hospital and clinic activities, with admission'          WHERE COD_CIIU = '8610';
UPDATE MAE_CIIU SET NOM_EN = 'Medical practice activities, without hospitalization'    WHERE COD_CIIU = '8621';
UPDATE MAE_CIIU SET NOM_EN = 'Dental practice activities'                              WHERE COD_CIIU = '8622';
UPDATE MAE_CIIU SET NOM_EN = 'Diagnostic support activities'                           WHERE COD_CIIU = '8691';
UPDATE MAE_CIIU SET NOM_EN = 'Therapeutic support activities'                          WHERE COD_CIIU = '8692';
UPDATE MAE_CIIU SET NOM_EN = 'Other human health activities n.e.c.'                    WHERE COD_CIIU = '8699';
UPDATE MAE_CIIU SET NOM_EN = 'Residential nursing care activities'                     WHERE COD_CIIU = '8710';
UPDATE MAE_CIIU SET NOM_EN = 'Residential care for mental retardation, mental health and substance abuse' WHERE COD_CIIU = '8720';
UPDATE MAE_CIIU SET NOM_EN = 'Residential care for the elderly or disabled'            WHERE COD_CIIU = '8730';
UPDATE MAE_CIIU SET NOM_EN = 'Other residential care activities'                       WHERE COD_CIIU = '8790';
UPDATE MAE_CIIU SET NOM_EN = 'Social work for the elderly and disabled without accommodation' WHERE COD_CIIU = '8810';
UPDATE MAE_CIIU SET NOM_EN = 'Care activities for the elderly'                         WHERE COD_CIIU = '8862';
UPDATE MAE_CIIU SET NOM_EN = 'Other social work activities without accommodation'      WHERE COD_CIIU = '8890';

-- Sección R — Actividades artísticas, de entretenimiento y recreación
UPDATE MAE_CIIU SET NOM_EN = 'Literary creation'                                       WHERE COD_CIIU = '9001';
UPDATE MAE_CIIU SET NOM_EN = 'Musical composition and creation'                        WHERE COD_CIIU = '9002';
UPDATE MAE_CIIU SET NOM_EN = 'Theatrical creation'                                     WHERE COD_CIIU = '9003';
UPDATE MAE_CIIU SET NOM_EN = 'Audiovisual creation'                                    WHERE COD_CIIU = '9004';
UPDATE MAE_CIIU SET NOM_EN = 'Visual arts'                                             WHERE COD_CIIU = '9005';
UPDATE MAE_CIIU SET NOM_EN = 'Theatre activities'                                      WHERE COD_CIIU = '9006';
UPDATE MAE_CIIU SET NOM_EN = 'Live music entertainment activities'                     WHERE COD_CIIU = '9007';
UPDATE MAE_CIIU SET NOM_EN = 'Other live entertainment activities'                     WHERE COD_CIIU = '9008';
UPDATE MAE_CIIU SET NOM_EN = 'Library and archive activities'                          WHERE COD_CIIU = '9101';
UPDATE MAE_CIIU SET NOM_EN = 'Museums, conservation of historical buildings and sites' WHERE COD_CIIU = '9102';
UPDATE MAE_CIIU SET NOM_EN = 'Botanical and zoological gardens and nature reserves'    WHERE COD_CIIU = '9103';
UPDATE MAE_CIIU SET NOM_EN = 'Gambling and betting activities'                         WHERE COD_CIIU = '9200';
UPDATE MAE_CIIU SET NOM_EN = 'Operation of sports facilities'                          WHERE COD_CIIU = '9311';
UPDATE MAE_CIIU SET NOM_EN = 'Activities of sports clubs'                              WHERE COD_CIIU = '9312';
UPDATE MAE_CIIU SET NOM_EN = 'Other sports activities'                                 WHERE COD_CIIU = '9319';
UPDATE MAE_CIIU SET NOM_EN = 'Activities of amusement parks and theme parks'           WHERE COD_CIIU = '9321';
UPDATE MAE_CIIU SET NOM_EN = 'Other amusement and recreation activities n.e.c.'        WHERE COD_CIIU = '9329';

-- Sección S — Otras actividades de servicios
UPDATE MAE_CIIU SET NOM_EN = 'Activities of business and employers membership organizations' WHERE COD_CIIU = '9411';
UPDATE MAE_CIIU SET NOM_EN = 'Activities of professional membership organizations'    WHERE COD_CIIU = '9412';
UPDATE MAE_CIIU SET NOM_EN = 'Activities of trade unions'                              WHERE COD_CIIU = '9420';
UPDATE MAE_CIIU SET NOM_EN = 'Activities of religious organizations'                   WHERE COD_CIIU = '9491';
UPDATE MAE_CIIU SET NOM_EN = 'Activities of political organizations'                   WHERE COD_CIIU = '9492';
UPDATE MAE_CIIU SET NOM_EN = 'Activities of other membership organizations n.e.c.'    WHERE COD_CIIU = '9499';
UPDATE MAE_CIIU SET NOM_EN = 'Repair of computers and peripheral equipment'            WHERE COD_CIIU = '9511';
UPDATE MAE_CIIU SET NOM_EN = 'Repair of communication equipment'                       WHERE COD_CIIU = '9512';
UPDATE MAE_CIIU SET NOM_EN = 'Repair of consumer electronics'                          WHERE COD_CIIU = '9521';
UPDATE MAE_CIIU SET NOM_EN = 'Repair of household appliances and home and garden equipment' WHERE COD_CIIU = '9522';
UPDATE MAE_CIIU SET NOM_EN = 'Repair of footwear and leather goods'                    WHERE COD_CIIU = '9523';
UPDATE MAE_CIIU SET NOM_EN = 'Repair of furniture and home furnishings'                WHERE COD_CIIU = '9524';
UPDATE MAE_CIIU SET NOM_EN = 'Repair of other personal and household goods'            WHERE COD_CIIU = '9529';
UPDATE MAE_CIIU SET NOM_EN = 'Washing and dry-cleaning of textile and fur products'    WHERE COD_CIIU = '9601';
UPDATE MAE_CIIU SET NOM_EN = 'Hairdressing and other beauty treatment'                 WHERE COD_CIIU = '9602';
UPDATE MAE_CIIU SET NOM_EN = 'Funeral and related activities'                          WHERE COD_CIIU = '9603';
UPDATE MAE_CIIU SET NOM_EN = 'Other personal service activities n.e.c.'               WHERE COD_CIIU = '9609';

-- Sección T — Actividades de los hogares individuales
UPDATE MAE_CIIU SET NOM_EN = 'Activities of households as employers of domestic personnel' WHERE COD_CIIU = '9700';
UPDATE MAE_CIIU SET NOM_EN = 'Undifferentiated goods-producing activities of households for own use' WHERE COD_CIIU = '9810';
UPDATE MAE_CIIU SET NOM_EN = 'Undifferentiated service-producing activities of households for own use' WHERE COD_CIIU = '9820';

-- Sección U — Actividades de organizaciones y entidades extraterritoriales
UPDATE MAE_CIIU SET NOM_EN = 'Activities of extraterritorial organizations and bodies' WHERE COD_CIIU = '9900';

-- 3. Verificar que todos los registros activos tienen traducción
SELECT COUNT(*) AS SIN_TRADUCCION
FROM MAE_CIIU
WHERE ACT_ESTA = 'A' AND (NOM_EN IS NULL OR NOM_EN = '');
GO

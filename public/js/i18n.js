/**
 * i18n.js — Sistema de internacionalización ES / EN
 *
 * Uso:
 *   t('key')          → string en el idioma activo
 *   setLang('en')     → cambia idioma, aplica al DOM y persiste en localStorage
 *   applyLang()       → re-aplica el idioma activo a todos los elementos marcados
 *
 * Marcado en HTML:
 *   data-i18n="key"           → reemplaza textContent del elemento
 *   data-i18n-html="key"      → reemplaza innerHTML (cuando hay etiquetas internas)
 *   data-i18n-ph="key"        → reemplaza atributo placeholder
 *   data-i18n-tip="key"       → reemplaza atributo data-tip
 *   data-i18n-title="key"     → reemplaza atributo title
 *
 * Regla de clave: si el idioma activo es 'es', se devuelve la clave ES del
 * diccionario (el texto original ya está en el HTML). Si es 'en', se devuelve
 * la traducción inglesa.  El español actúa como valor de respaldo.
 */
'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
   DICCIONARIO
   ═══════════════════════════════════════════════════════════════════════════ */
const I18N_DICT = {

  /* ── Página / encabezado ─────────────────────────────────────────────── */
  page_title_juridica:   { es: 'Registro SAGRILAFT — Persona Jurídica',    en: 'SAGRILAFT Registration — Legal Entity' },
  page_title_natural:    { es: 'Registro SAGRILAFT — Persona Natural',     en: 'SAGRILAFT Registration — Natural Person' },
  page_subtitle:         { es: 'Complete todos los campos obligatorios marcados con', en: 'Complete all required fields marked with' },
  page_subtitle2:        { es: 'Los datos se guardarán al finalizar el formulario completo.', en: 'Data will be saved upon completing the full form.' },

  /* ── Strings comunes ─────────────────────────────────────────────────── */
  required_field:        { es: 'Campo requerido',        en: 'Required field' },
  required_field_num:    { es: 'Campo requerido y solo numérico', en: 'Required field — numbers only' },
  required_option:       { es: 'Seleccione al menos una opción', en: 'Select at least one option' },
  invalid_email:         { es: 'Email inválido o vacío', en: 'Invalid or empty email' },
  select_placeholder:    { es: '— Seleccione —',                      en: '— Select —' },
  select_ph_pais:        { es: '— Seleccione país —',                 en: '— Select country —' },
  select_ph_vinc:        { es: '— Seleccione tipo de vinculación —',  en: '— Select relationship type —' },
  select_ph_act:         { es: '— Seleccione actividad —',            en: '— Select activity —' },
  select_ph_dept:        { es: '— Seleccione departamento —',         en: '— Select department —' },
  select_ph_ciudad:      { es: '— Seleccione ciudad —',               en: '— Select city —' },
  select_ph_entidad:     { es: '— Seleccione entidad —',              en: '— Select entity —' },
  select_ph_tipo:        { es: '— Seleccione tipo —',                 en: '— Select type —' },
  select_loading:        { es: 'Cargando…',                           en: 'Loading…' },
  select_first_country:  { es: '— Seleccione país primero —', en: '— Select a country first —' },
  select_first_dept:     { es: '— Seleccione departamento primero —', en: '— Select a department first —' },
  loading_cities:        { es: 'Cargando ciudades…',     en: 'Loading cities…' },
  yes:                   { es: 'Sí',                     en: 'Yes' },
  no:                    { es: 'No',                     en: 'No' },
  btn_clear:             { es: 'Limpiar sección',        en: 'Clear section' },
  btn_continuar:         { es: 'Continuar',               en: 'Continue' },
  btn_add:               { es: '＋ Agregar',             en: '＋ Add' },
  btn_delete:            { es: '✕',                     en: '✕' },
  btn_submit:            { es: 'Enviar formulario',      en: 'Submit form' },
  lang_toggle_en:        { es: 'English',                en: 'English' },
  lang_toggle_es:        { es: 'Español',                en: 'Español' },
  otro:                  { es: 'Otro',                   en: 'Other' },
  na:                    { es: 'N/A',                    en: 'N/A' },
  specify_country:       { es: 'Especifique el país',    en: 'Specify the country' },
  country_name_ph:       { es: 'Nombre del país',        en: 'Country name' },

  /* ── Sección 1 ── Información básica ─────────────────────────────────── */
  sec1_title:            { es: 'Información básica de la empresa',  en: 'Basic Company Information' },
  sec1_tip_terc:         { es: 'Tipo de persona',                   en: 'Person type' },
  sec1_tip_juridica:     { es: 'Empresa, sociedad u otra entidad legalmente constituida que, de conformidad con la ley, posee personalidad jurídica propia e independiente de las personas naturales que la conforman, con capacidad para adquirir derechos, contraer obligaciones y actuar por medio de sus representantes legales. En el marco del SAGRILAFT, comprende cualquier persona jurídica que mantenga o pretenda establecer una relación comercial, contractual o de cualquier otra naturaleza con la compañía.',
                           en: 'A company, corporation, or other legally incorporated entity that, under the law, has its own legal personality independent of the natural persons who comprise it, with the capacity to acquire rights, incur obligations, and act through its legal representatives. Within the SAGRILAFT framework, this applies to any legal entity that maintains or intends to establish a commercial, contractual, or any other relationship with the company.' },
  sec1_tip_natural:      { es: 'Individuo de la especie humana que, de conformidad con la ley, tiene capacidad para adquirir derechos y contraer obligaciones, y que puede desarrollar actividades económicas a título propio. En el marco del SAGRILAFT, corresponde a cualquier persona natural que mantenga o pretenda establecer una relación comercial, contractual, laboral o de cualquier otra naturaleza con la compañía.',
                           en: 'Any individual who, in accordance with the law, has the capacity to acquire rights and incur obligations and may carry out economic activities independently. Within the SAGRILAFT framework, this applies to any natural person who maintains or intends to establish a commercial, contractual, employment, or any other type of relationship with the company.' },
  sec1_juridica:         { es: 'Persona jurídica',                  en: 'Legal entity' },
  sec1_natural:          { es: 'Persona natural',                   en: 'Natural person' },
  sec1_cod_vinc:         { es: 'Tipo de vinculación',               en: 'Relationship type' },
  sec1_cod_tpdoc:        { es: 'Tipo de documento',                 en: 'Document type' },
  sec1_num_iden:         { es: 'Número de documento',               en: 'Document number' },
  sec1_num_iden_ph:      { es: 'Ej: 900123456',                    en: 'E.g. 900123456' },
  sec1_dig_veri:         { es: 'Díg. verif.',                       en: 'Check digit' },
  sec1_dig_veri_tip:     { es: 'Ingrese el dígito de verificación correspondiente al Número de Identificación Tributaria (NIT) de la persona jurídica, tal como figura en el Registro Único Tributario (RUT) expedido por la DIAN.',
                           en: 'Enter the check digit corresponding to the Tax Identification Number (NIT) of the legal entity, as it appears in the Single Tax Registry (RUT) issued by the DIAN.' },
  sec1_nom_comp:         { es: 'Razón social',                      en: 'Company name' },
  sec1_nom_comp_ph:      { es: 'Nombre completo o razón social de la empresa', en: 'Full name or registered company name' },
  sec1_primer_nombre:    { es: 'Primer nombre',                     en: 'First name' },
  sec1_seg_nombre:       { es: 'Segundo nombre',                    en: 'Second name' },
  sec1_seg_nombre_ph:    { es: 'Segundo nombre (opcional)',         en: 'Second name (optional)' },
  sec1_primer_ape:       { es: 'Primer apellido',                   en: 'First surname' },
  sec1_seg_ape:          { es: 'Segundo apellido',                  en: 'Second surname' },
  sec1_seg_ape_ph:       { es: 'Segundo apellido (opcional)',       en: 'Second surname (optional)' },
  sec1_fec_expe:         { es: 'Fecha de expedición del documento', en: 'Document issue date' },
  sec1_otr_vinc:         { es: 'Especifique el tipo de vinculación', en: 'Specify the relationship type' },
  sec1_otr_vinc_ph:      { es: 'Describa el tipo de vinculación',   en: 'Describe the relationship type' },
  sec1_div_geo:          { es: 'Lugar de domicilio principal',      en: 'Primary domicile' },
  sec1_pais:             { es: 'País',                              en: 'Country' },
  sec1_dept:             { es: 'Departamento',                      en: 'Department / State' },
  sec1_ciudad:           { es: 'Ciudad',                            en: 'City' },
  sec1_dir:              { es: 'Dirección',                         en: 'Address' },
  sec1_div_contact:      { es: 'Datos de contacto',                 en: 'Contact information' },
  sec1_tel:              { es: 'Teléfono fijo',                     en: 'Phone number' },
  sec1_tel2:             { es: 'Teléfono alternativo',              en: 'Alternative phone' },
  sec1_mail:             { es: 'Correo electrónico',                en: 'Email address' },
  sec1_url:              { es: 'URL sitio web',                     en: 'Website URL' },
  sec1_url_ph:           { es: 'https://www.empresa.com',          en: 'https://www.company.com' },
  sec1_cel:              { es: 'Teléfono celular',                  en: 'Mobile number' },
  sec1_nacio:            { es: 'Nacionalidad',                      en: 'Nationality' },
  sec1_act_princ:        { es: 'Actividad económica principal',     en: 'Main economic activity' },
  sec1_email_tip:        { es: 'Puede ser correo corporativo o personal.',
                           en: 'Can be corporate or personal email.' },
  sec1_mail_sarl:        { es: 'Email gestión SAGRILAFT',           en: 'SAGRILAFT management email' },
  sec1_mail_sarl_ph:     { es: 'SAGRILAFT@empresa.com',            en: 'SAGRILAFT@company.com' },
  sec1_ciiu:             { es: 'Actividad económica principal (CIIU)', en: 'Main economic activity (CIIU)' },
  sec1_ciiu_tip_j:       { es: 'Indique el código CIIU correspondiente a la actividad económica principal de la persona jurídica. Este deberá coincidir con el registrado en el Registro Único Tributario (RUT), el Certificado de la Cámara de Comercio o el documento equivalente, según corresponda.',
                           en: 'Enter the CIIU code corresponding to the main economic activity of the legal entity. This must match the code registered in the Single Tax Registry (RUT), the Chamber of Commerce Certificate, or the equivalent document, as applicable.' },
  sec1_ciiu_tip_n:       { es: 'Indique el código CIIU correspondiente a la actividad económica principal. Este deberá coincidir con el registrado en el Registro Único Tributario (RUT).',
                           en: 'Enter the CIIU code corresponding to your main economic activity. This must match the code registered in the Single Tax Registry (RUT).' },
  sec1_mail_sarl_tip:    { es: 'El correo puede coincidir con el correo electrónico registrado en el punto anterior',
                           en: 'This email may match the email address registered in the previous field' },
  sec1_otr_ciiu:         { es: 'Especifique la actividad económica', en: 'Specify the economic activity' },
  sec1_btn:              { es: 'Continuar → Sección 2',            en: 'Continue → Section 2' },
  sec1_cot_bolsa:        { es: '¿Su empresa cotiza en bolsa de valores?', en: 'Does your company trade on a stock exchange?' },
  sec1_nom_bolsa:        { es: '¿En cuál bolsa de valores cotiza?',        en: 'Which stock exchange does it trade on?' },
  sec1_nom_bolsa_ph:     { es: 'Ej: NYSE, NASDAQ, BVC, LSE…',             en: 'E.g.: NYSE, NASDAQ, BVC, LSE…' },

  /* ── Sección 2 ── Representante legal ───────────────────────────────── */
  sec2_title:            { es: 'Información del representante legal', en: 'Legal Representative Information' },
  sec2_nombres:          { es: 'Nombres',                           en: 'First names' },
  sec2_apellidos:        { es: 'Apellidos',                         en: 'Surnames' },
  sec2_fec_expe:         { es: 'Fecha de expedición',              en: 'Issue date' },
  sec2_dir:              { es: 'Dirección domicilio',               en: 'Domicile address' },
  sec2_celular:          { es: 'Celular',                           en: 'Mobile number' },
  sec2_btn:              { es: 'Continuar → Sección 3',            en: 'Continue → Section 3' },
  sec2_add_rl:           { es: '＋ Agregar representante legal',   en: '＋ Add legal representative' },

  /* ── Sección 3 ── Sociedad ──────────────────────────────────────────── */
  sec3_title:            { es: 'Información de la sociedad',         en: 'Company Details' },
  sec3_ubicacion:        { es: 'Ubicación de la sociedad',           en: 'Company location' },
  sec3_nacional:         { es: 'Nacional',                          en: 'National' },
  sec3_extranjera:       { es: 'Extranjera',                        en: 'Foreign' },
  sec3_sucursal:         { es: 'Sucursal en Colombia',              en: 'Branch in Colombia' },
  sec3_tipo_empr:        { es: 'Tipo de empresa',                   en: 'Company type' },
  sec3_pct_part:         { es: '% de participación',                en: '% of participation' },
  sec3_pct_part_ph:      { es: 'Ej: 51',                             en: 'E.g.: 51' },
  sec3_publica:          { es: 'Pública',                           en: 'Public' },
  sec3_privada:          { es: 'Privada',                           en: 'Private' },
  sec3_mixta:            { es: 'Mixta',                             en: 'Mixed' },
  sec3_tip_socie:        { es: 'Tipo de sociedad',                  en: 'Type of company' },
  sec3_grupo:            { es: '¿Pertenece a un grupo empresarial?', en: 'Does it belong to a business group?' },
  sec3_ctrl_decla:       { es: 'La(s) situación(es) de control y/o grupo empresarial se encuentran declaradas en el Certificado de Existencia y Representación Legal adjunto',
                           en: 'The control and/or business group situation(s) are duly registered in the Certificate of Existence and Legal Representation attached to this form' },
  sec3_cal_grupo:        { es: 'Calidad en el grupo',               en: 'Role in the group' },
  sec3_matriz:           { es: 'Matriz',                            en: 'Parent company' },
  sec3_filial:           { es: 'Filial',                            en: 'Subsidiary' },
  sec3_subsidiaria:      { es: 'Subsidiaria',                       en: 'Subsidiary (controlled)' },
  sec3_desc_grupo:       { es: 'Descripción de la estructura del grupo', en: 'Business group structure description' },
  sec3_btn:              { es: 'Continuar → Sección 4',            en: 'Continue → Section 4' },
  sec3_ctrl_decla_tip:   { es: 'La situación de control se produce cuando una persona natural o jurídica (matriz o controlante) tiene una participación accionaria que le otorgue el control o una posición dominante sobre las decisiones de una sociedad (subordinada o controlada). De conformidad con la legislación colombiana, existe situación de control cuando, entre otros eventos: (i) posee, directa o indirectamente, más del 50 % del capital de la sociedad; (ii) tiene la mayoría de los derechos de voto o la facultad para elegir la mayoría de los miembros de la junta directiva, cuando exista; o (iii) ejerce una influencia dominante sobre las decisiones de los órganos de administración mediante actos, negocios u otros mecanismos.',
                           en: 'A control situation arises when a natural or legal person (parent or controlling entity) holds a shareholding that grants it control or a dominant position over the decisions of a company (subordinate or controlled). Under Colombian law, a control situation exists when, among other circumstances: (i) it holds, directly or indirectly, more than 50% of the company\'s capital; (ii) it holds the majority of voting rights or the power to elect the majority of the board of directors, when it exists; or (iii) it exercises dominant influence over the decisions of the management bodies through acts, transactions, or other mechanisms.' },
  sec3_cal_grupo_tip:    { es: 'Cuando el control se ejerce de forma directa, la controlada se denomina filial; cuando el control se ejerce a través de otras subordinadas, la controlada se denomina subsidiaria.',
                           en: 'When control is exercised directly, the controlled entity is called a subsidiary (filial); when control is exercised through other subordinates, the controlled entity is called a subsidiary (subsidiaria).' },

  /* ── Sección 4 ── Países de operación ──────────────────────────────── */
  sec4_title:            { es: 'Países de operación',               en: 'Operating Countries' },
  sec4_hint:             { es: 'Indique todos los países en los que la empresa desarrolla operaciones, realiza actividades comerciales o mantiene presencia empresarial. Registre un país por cada entrada.',
                           en: 'Indicate all countries where the company carries out operations, conducts commercial activities, or maintains a business presence. Register one country per entry.' },
  sec4_add_btn:          { es: '＋ Agregar país',                   en: '＋ Add country' },
  sec4_btn:              { es: 'Continuar → Sección 5',            en: 'Continue → Section 5' },

  /* ── Sección 5 ── Cumplimiento ──────────────────────────────────────── */
  sec5_title:            { es: 'Información del Sistema de cumplimiento', en: 'Compliance System Information' },
  sec5_tie_norm:         { es: '¿La sociedad está sujeta a alguna normatividad que la obligue a implementar algún control para la prevención o gestión de riesgos de Lavado de Activos, Financiación del Terrorismo y Financiación de la Proliferación de Armas de Destrucción Masiva (LA/FT/FPADM), y de Corrupción y Soborno Transnacional (C/ST)?',
                           en: 'Is the company subject to any regulation requiring it to implement controls for the prevention or management of risks related to Money Laundering, Terrorist Financing, and Financing of the Proliferation of Weapons of Mass Destruction (ML/TF/FPWMD), and Corruption and Transnational Bribery (C/TB)?' },
  sec5_desc_norm:        { es: '¿Cuál es o son estas regulaciones o normas?', en: 'What are these regulations or rules?' },
  sec5_desc_norm_ph:     { es: 'Describa la normatividad aplicable…',         en: 'Describe the applicable regulation…' },
  sec5_norm_laft:        { es: 'Referencia específica de normatividad LA/FT', en: 'Specific ML/TF regulation reference' },
  sec5_norm_laft_ph:     { es: 'Nombre o número de la norma LA/FT aplicable', en: 'Name or number of the applicable ML/TF regulation' },
  sec5_norm_laft_eg:     { es: '(ej.: Ley 526/1999, Decreto 1674/2023, SAGRILAFT…)', en: '(e.g.: Law 526/1999, Decree 1674/2023, SAGRILAFT…)' },
  sec5_tie_sist:         { es: '¿Tiene sistema de prevención de riesgos implementado?', en: 'Does it have a risk prevention system implemented?' },
  sec5_tip_sist:         { es: 'Tipo de sistema implementado',      en: 'Type of system implemented' },
  sec5_select_ph:        { es: 'Seleccione uno o varios...',         en: 'Select one or more...' },
  sec5_otr_preve:        { es: 'Especifique el sistema de prevención', en: 'Specify the prevention system' },
  sec5_otr_preve_ph:     { es: 'Describa el sistema implementado',  en: 'Describe the implemented system' },
  sec5_note:             { es: 'Esta información solo es requerida para las personas jurídicas obligadas a tener un sistema de prevención de riesgos de lavado de activos y financiación de terrorismo o similar.',
                           en: 'This information is only required for legal entities obligated to have an asset-laundering and terrorism financing risk prevention system or equivalent.' },
  sec5_oficial_sub:      { es: 'Información del oficial de cumplimiento', en: 'Compliance Officer Information' },
  sec5_add_oficial:      { es: '＋ Agregar oficial',                en: '＋ Add officer' },
  sec5_oficial_p:        { es: 'Principal',                         en: 'Primary' },
  sec5_oficial_s:        { es: 'Suplente',                          en: 'Alternate' },
  sec5_btn:              { es: 'Continuar → Sección 6',            en: 'Continue → Section 6' },

  /* ── Sección 6 ── Junta directiva ──────────────────────────────────── */
  sec6_title:            { es: 'Junta directiva / Consejo de administración', en: 'Board of Directors / Administrative Council' },
  sec6_tie_junta:        { es: '¿Tiene junta directiva o consejo de administración?', en: 'Does it have a board of directors or administrative council?' },
  sec6_add_btn:          { es: '＋ Agregar miembro',                en: '＋ Add member' },
  sec6_btn:              { es: 'Continuar → Sección 7',            en: 'Continue → Section 7' },

  /* ── Sección 7 ── Revisores fiscales ───────────────────────────────── */
  sec7_title:            { es: 'Revisores fiscales',                en: 'Statutory Auditors' },
  sec7_tie_revis:        { es: '¿Tiene revisor fiscal?',            en: 'Does it have a statutory auditor?' },
  sec7_add_btn:          { es: '＋ Agregar revisor',                en: '＋ Add auditor' },
  sec7_btn:              { es: 'Continuar → Sección 8',            en: 'Continue → Section 8' },

  /* ── Sección 8 ── Composición accionaria ───────────────────────────── */
  sec8_title:            { es: 'Composición accionaria o propietaria', en: 'Shareholder / Ownership Composition' },
  sec8_nom_acci:         { es: 'Nombre del accionista',             en: 'Shareholder name' },
  sec8_tip_doc:          { es: 'Tipo de documento',                 en: 'Document type' },
  sec8_num_doc:          { es: 'Número de documento',               en: 'Document number' },
  sec8_pct_part:         { es: 'Porcentaje de participación',       en: 'Ownership percentage' },
  sec8_tip_acci:         { es: 'Tipo de accionista',                en: 'Shareholder type' },
  sec8_add_btn:          { es: '＋ Agregar accionista',             en: '＋ Add shareholder' },
  sec8_btn:              { es: 'Continuar → Sección 9',            en: 'Continue → Section 9' },

  /* ── Sección 9 ── Beneficiarios finales ────────────────────────────── */
  sec9_title:            { es: 'Beneficiarios Finales',             en: 'Ultimate Beneficial Owners' },
  sec9_hint:             { es: 'Persona natural que, directa o indirectamente, posee, controla o se beneficia de una persona jurídica.\n\nSe considera beneficiario final quien sea titular del 5 % o más del capital, de los derechos de voto o de los beneficios económicos de la entidad; quien ejerza control por cualquier otro medio; o, cuando no sea posible identificar a una persona bajo estos criterios, el representante legal o la persona que ejerza la mayor autoridad de dirección o gestión.\n\nEn el caso de estructuras sin personería jurídica o negocios fiduciarios, corresponde a las personas naturales que ejerzan el control efectivo o tengan derecho a los activos, beneficios o utilidades de la estructura.',
                           en: 'A natural person who, directly or indirectly, owns, controls, or benefits from a legal entity.\n\nA beneficial owner is anyone who holds 5% or more of the capital, voting rights, or economic benefits of the entity; who exercises control by any other means; or, when it is not possible to identify a person under these criteria, the legal representative or the person who exercises the highest management authority.\n\nIn the case of structures without legal personality or trust arrangements, it refers to natural persons who exercise effective control or have rights to the assets, benefits, or profits of the structure.' },
  sec9_nom_benef:        { es: 'Nombre del beneficiario',           en: 'Beneficiary name' },
  sec9_pct_part:         { es: 'Porcentaje de participación',       en: 'Ownership percentage' },
  sec9_add_btn:          { es: '＋ Agregar beneficiario',           en: '＋ Add beneficiary' },
  sec9_btn:              { es: 'Continuar → Sección 10',           en: 'Continue → Section 10' },

  /* ── Sección 9N ── Participación en sociedades (solo Persona Natural) ── */
  sec9n_title:        { es: 'Participación en sociedades',         en: 'Participation in companies' },
  sec9n_part_soc:     { es: '¿Tiene participación en alguna sociedad y/o es beneficiario final de esta?', en: 'Do you hold participation in any company and/or are you a beneficial owner?' },
  sec9n_part_soc_tip: { es: 'Se entiende por participación la tenencia de acciones, cuotas sociales, participaciones en sociedades de personas o cualquier otro tipo de interés económico o de control en una entidad, entre otros.', en: 'Participation is understood as the holding of shares, social quotas, participations in partnerships, or any other type of economic interest or control in an entity, among others.' },
  sec9n_raz_soc:      { es: 'Razón social (nombre de la sociedad)',   en: 'Company name' },
  sec9n_tip_doc_soc:  { es: 'Tipo de documento',                      en: 'Document type' },
  sec9n_num_doc_soc:  { es: 'Número de documento',                      en: 'Document number' },
  sec9n_btn:          { es: 'Continuar → Sección 10',                  en: 'Continue → Section 10' },

  /* ── Sección 10 ── Financiera ───────────────────────────────────────── */
  sec10_title:           { es: 'Información financiera',            en: 'Financial Information' },
  sec10_curr:            { es: 'Moneda de reporte',                 en: 'Reporting currency' },
  sec10_curr_tip:        { es: 'Seleccione la moneda en que se expresan los valores financieros. Todos los campos de esta sección deben estar en la misma moneda.', en: 'Select the currency in which financial values are expressed. All fields in this section must be in the same currency.' },
  sec10_act_total:       { es: 'Total activos',                     en: 'Total assets' },
  sec10_ing_mens:        { es: 'Ingresos anuales',                  en: 'Annual income' },
  sec10_pas_total:       { es: 'Total pasivos',                     en: 'Total liabilities' },
  sec10_egr_mens:        { es: 'Egresos anuales',                   en: 'Annual expenses' },
  sec10_patrimonio:      { es: 'Patrimonio',                        en: 'Equity / Net worth' },
  sec10_otr_ing:         { es: 'Otros ingresos',                    en: 'Other income' },
  sec10_btn:             { es: 'Continuar → Sección 11',           en: 'Continue → Section 11' },

  /* ── Sección 11 ── Bancaria ─────────────────────────────────────────── */
  sec11_title:           { es: 'Información bancaria',              en: 'Banking Information' },
  sec11_entidad:         { es: 'Entidad bancaria',                  en: 'Bank' },
  sec11_tip_cuen:        { es: 'Tipo de cuenta',                   en: 'Account type' },
  sec11_num_cuen:        { es: 'Número de cuenta',                 en: 'Account number' },
  sec11_cuen_extr:       { es: '¿La empresa posee cuentas en el extranjero?',  en: 'Does the company hold accounts abroad?' },
  sec11_cuen_extr_n:    { es: '¿La persona posee cuentas en el extranjero?',  en: 'Does the person hold accounts abroad?' },
  sec11_add_extr:       { es: '＋ Agregar cuenta extranjera',                  en: '＋ Add foreign account' },
  sec11_pais_ext:        { es: 'País de la cuenta',                en: 'Account country' },
  sec11_nom_ext:         { es: 'Nombre de la entidad extranjera',  en: 'Foreign bank name' },
  sec11_tip_ext:         { es: 'Tipo de cuenta extranjera',        en: 'Foreign account type' },
  sec11_tip_ext_ph:      { es: 'Ej: Savings, Checking…',           en: 'E.g.: Savings, Checking…' },
  sec11_otr_banco_ph:    { es: 'Nombre de la entidad',             en: 'Bank name' },
  sec11_add_btn:         { es: '＋ Agregar cuenta bancaria',       en: '＋ Add bank account' },
  sec11_btn:             { es: 'Continuar → Sección 12',           en: 'Continue → Section 12' },
  sec11_cert_tip:        { es: 'Corresponde a la cuenta bancaria registrada por el titular, la cual será utilizada para recibir pagos y realizar las operaciones financieras derivadas de la relación comercial. La información suministrada deberá coincidir con la certificación bancaria vigente adjunta al formulario.',
                           en: 'This corresponds to the bank account registered by the holder, which will be used to receive payments and carry out the financial operations derived from the commercial relationship. The information provided must match the valid bank certification attached to the form.' },

  /* ── Sección 12 ── PEP ──────────────────────────────────────────────── */
  sec12_title:           { es: 'PEP — Exposición política',         en: 'PEP — Political Exposure' },
  sec12_tip:             { es: 'Se considera Persona Expuesta Políticamente (PEP) a la persona que desempeña o ha desempeñado funciones públicas de alta dirección, administración, manejo de recursos públicos, formulación de políticas, expedición de normas, administración de justicia o funciones sancionatorias, así como a quienes dirigen o administran recursos de partidos o movimientos políticos, de conformidad con el Decreto 830 de 2021 y demás normas que lo modifiquen o sustituyan.\n\nEntre otros, tienen la calidad de PEP: el Presidente y Vicepresidente de la República, ministros, viceministros, gobernadores, alcaldes, congresistas, diputados, concejales, magistrados, jueces, fiscales, contralores, procuradores, defensores del pueblo, superintendentes, generales de las Fuerzas Militares y de la Policía Nacional, gerentes y directivos de entidades públicas, notarios, curadores urbanos, representantes legales y directivos de partidos o movimientos políticos, así como los fideicomitentes de patrimonios autónomos o fideicomisos que administren recursos públicos.\n\nLa calidad de PEP se mantiene durante el ejercicio del cargo y por dos (2) años contados a partir de la terminación de sus funciones.',
                           en: 'A Politically Exposed Person (PEP) is any person who holds or has held high-level public functions, including administration, management of public funds, policy-making, rule-making, administration of justice, or sanctioning functions, as well as those who lead or manage resources of political parties or movements, in accordance with Decree 830 of 2021 and any regulations amending or replacing it.\n\nAmong others, the following qualify as PEPs: the President and Vice President of the Republic, ministers, deputy ministers, governors, mayors, members of Congress, deputies, council members, magistrates, judges, prosecutors, comptrollers, public defenders, superintendents, generals of the Armed Forces and National Police, managers and executives of public entities, notaries, urban curators, legal representatives and executives of political parties or movements, as well as settlors of autonomous estates or trusts that manage public resources.\n\nPEP status is maintained during the exercise of office and for two (2) years following the termination of functions.' },
  sec12_man_rpub:        { es: '¿Ha manejado o maneja recursos públicos?', en: 'Has the company managed or does it currently manage public funds?' },
  sec12_car_publ:        { es: '¿Ejerce o ha ejercido un cargo público en los últimos dos años?', en: 'Has the company held or does it currently hold a public office in the past two years?' },
  sec12_btn:             { es: 'Continuar → Sección 13',           en: 'Continue → Section 13' },

  /* ── Sección 13 ── Activos virtuales ───────────────────────────────── */
  sec13_title:           { es: 'Actividades con activos virtuales', en: 'Virtual Asset Activities' },
  sec13_tip:             { es: 'De conformidad con la Superintendencia de Sociedades, un activo virtual es una representación digital de valor que puede comercializarse o transferirse digitalmente y utilizarse para pagos o inversiones.\n\nPara efectos de este formulario, se entenderá que la empresa realiza operaciones con activos virtuales cuando compra, vende, intercambia, transfiere, custodia, administra o desarrolla cualquier otra actividad relacionada con este tipo de activos.',
                           en: 'In accordance with the Superintendency of Companies, a virtual asset is a digital representation of value that can be commercially traded or transferred digitally and used for payments or investments.\n\nFor the purposes of this form, a company is considered to engage in virtual asset operations when it buys, sells, exchanges, transfers, holds in custody, manages, or carries out any other activity related to such assets.' },
  sec13_oper_va:         { es: '¿Realiza operaciones con activos virtuales?',               en: 'Does the company perform virtual asset operations?' },
  sec13_act_fiat:        { es: 'Intercambio entre activos virtuales y monedas fiduciarias', en: 'Exchange between virtual assets and fiat currencies' },
  sec13_act_va:          { es: 'Intercambio entre una o más formas de activos virtuales', en: 'Exchange between one or more forms of virtual assets' },
  sec13_act_trans:       { es: 'Transferencia de activos virtuales',               en: 'Transfer of virtual assets' },
  sec13_act_custo:       { es: 'Custodia y/o administración de activos virtuales', en: 'Custody and/or administration of virtual assets' },
  sec13_act_serv_fin:    { es: 'Participación en servicios financieros relacionados con activos virtuales', en: 'Participation in financial services related to virtual assets' },
  sec13_act_serv_vap:    { es: 'Prestación de servicios financieros como VASP',    en: 'Provision of financial services as a VASP' },
  sec13_cert_info:       { es: 'He leído y acepto la Política de tratamiento de datos personales de Collective Mining Limited Sucursal Colombia, y autorizo el uso de mis datos personales conforme a los términos indicados.', en: 'I have read and accept the Personal Data Processing Policy of Collective Mining Limited Sucursal Colombia, and authorize the use of my personal data in accordance with the stated terms.' },
  sec13_cert_info_err:   { es: 'Debe aceptar la política de privacidad para enviar.', en: 'You must accept the privacy policy to submit.' },
  sec13_btn:             { es: 'Continuar → Sección 14',           en: 'Continue → Section 14' },

  /* ── Declaración juramento ──────────────────────────────────────── */
  decl_juramento_txt:    { es: 'Declaro, bajo la gravedad de juramento, que toda la información consignada en el presente formulario, así como los documentos aportados como soporte, son veraces, completos, exactos, vigentes y corresponden a la realidad. Asimismo, me comprometo a informar y actualizar oportunamente cualquier modificación que se presente respecto de la información suministrada.', en: 'I hereby declare under oath that all information provided in this form, as well as the supporting documents, are true, complete, accurate, current, and correspond to reality. I also commit to promptly reporting and updating any changes to the information provided.' },
  decl_juramento_err:    { es: 'Debe declarar bajo juramento que la información es verídica para enviar.', en: 'You must declare under oath that the information is truthful to submit.' },

  /* ── Modal privacidad ───────────────────────────────────────────── */
  priv_modal_title:      { es: 'Política de tratamiento de datos personales', en: 'Personal Data Processing Policy' },
  priv_modal_cancel:     { es: 'Cancelar',    en: 'Cancel' },
  priv_modal_accept:     { es: 'Acepto la política', en: 'I accept the policy' },
  priv_modal_body:       { es: 'Con el diligenciamiento y/o firma del presente formulario, autorizo de manera previa, expresa, informada e inequívoca a <strong>COLLECTIVE MINING LIMITED SUCURSAL COLOMBIA</strong> (en adelante, «la Empresa»), identificada con NIT 901.264.223-4, domiciliada en Bogotá D.C., a recopilar, almacenar, usar, circular, suprimir, procesar, compilar, intercambiar, actualizar y disponer de los datos personales suministrados en el presente formulario.', en: 'By completing and/or signing this form, I hereby authorize, in a prior, express, informed, and unequivocal manner, <strong>COLLECTIVE MINING LIMITED SUCURSAL COLOMBIA</strong> (hereinafter, «the Company»), identified with NIT 901.264.223-4, domiciled in Bogotá D.C., to collect, store, use, circulate, suppress, process, compile, exchange, update, and dispose of the personal data provided in this form.' },
  priv_modal_body2:      { es: 'Dicho tratamiento se realizará con la finalidad de dar cumplimiento al Sistema de Autocontrol y Gestión del Riesgo Integral de Lavado de Activos, Financiación del Terrorismo y Financiación de la Proliferación de Armas de Destrucción Masiva (SAGRILAFT), conforme a la Circular Externa 100-000016 de 2020 de la Superintendencia de Sociedades, y demás normas aplicables en materia de prevención y control del lavado de activos.', en: 'Such processing will be carried out for the purpose of complying with the Self-Control and Integral Risk Management System for Money Laundering, Terrorist Financing and Financing of Proliferation of Weapons of Mass Destruction (SAGRILAFT), in accordance with External Circular 100-000016 of 2020 of the Superintendencia de Sociedades, and other applicable regulations on prevention and control of money laundering.' },
  priv_modal_body3:      { es: 'Los datos serán conservados durante el tiempo que sea necesario para cumplir con los fines descritos y de acuerdo con las obligaciones legales vigentes. El titular de los datos podrá ejercer sus derechos de conocer, actualizar, rectificar y suprimir sus datos personales, así como revocar la autorización aquí otorgada, comunicándose con el oficial de cumplimiento de la Empresa.', en: 'The data will be retained for as long as necessary to fulfill the stated purposes and in accordance with applicable legal obligations. The data subject may exercise their rights to know, update, rectify, and delete their personal data, as well as revoke the authorization granted herein, by contacting the Company\'s compliance officer.' },
  priv_modal_body4:      { es: 'Al seleccionar <em>«Acepto»</em>, declara haber leído, comprendido y aceptado voluntariamente la presente política de tratamiento de datos personales.', en: 'By selecting <em>«I accept»</em>, you declare that you have read, understood, and voluntarily accepted this personal data processing policy.' },

  /* ── Sección 14 ── Documentos ──────────────────────────────────────── */
  sec14_title:           { es: 'Documentos Requeridos',             en: 'Required Documents' },
  sec14_rut:             { es: 'RUT (Registro Único Tributario)',   en: 'RUT (Tax Registry)' },
  sec14_cert_banc:       { es: 'Certificación bancaria',            en: 'Bank certification' },
  sec14_cert_exis:       { es: 'Certificado de existencia y representación legal y/o documento equivalente', en: 'Certificate of existence and legal representation and/or equivalent document' },
  sec14_doc_id_rl:       { es: 'Documento de identidad del Representante Legal', en: 'Legal Representative\'s identity document' },
  sec14_doc_id_n:        { es: 'Documento de identidad',            en: 'Identity document' },
  sec14_est_fin_1:       { es: 'Estados financieros',               en: 'Financial statements' },
  sec14_est_fin_2:       { es: 'Estados financieros año 2',         en: 'Financial statements year 2' },
  sec14_cert_acci:       { es: 'Certificado de composición accionaria', en: 'Shareholder composition certificate' },
  sec14_cart_acep:       { es: 'Carta de aceptación y autorización del Representante Legal', en: 'Acceptance and authorization letter (Legal Representative)' },
  sec14_select_file:     { es: 'Seleccionar archivo',               en: 'Select file' },
  sec14_no_file:         { es: 'Ningún archivo seleccionado',       en: 'No file selected' },
  sec14_decl_renta:      { es: 'Declaración de renta o Declaración juramentada', en: 'Tax return or Sworn declaration' },
  sec14_year1:           { es: 'Año 1',                             en: 'Year 1' },
  sec14_year2:           { es: 'Año 2',                             en: 'Year 2' },
  sec14_btn_final:       { es: 'Finalizar sección 14',              en: 'Complete section 14' },

  /* ── Campos transversales (oficiales, miembros, revisores) ──────────── */
  field_nombres:         { es: 'Nombres',                           en: 'First names' },
  field_apellidos:       { es: 'Apellidos',                         en: 'Surnames' },
  field_tip_doc:         { es: 'Tipo de documento',                 en: 'Document type' },
  field_num_doc:         { es: 'Número de documento',               en: 'Document number' },
  field_fec_expe:        { es: 'Fecha de expedición',               en: 'Issue date' },
  field_pais:            { es: 'País',                              en: 'Country' },
  field_dept:            { es: 'Departamento',                      en: 'Department / State' },
  field_ciudad:          { es: 'Ciudad',                            en: 'City' },
  field_dir:             { es: 'Dirección domicilio',               en: 'Domicile address' },
  field_celular:         { es: 'Celular',                           en: 'Mobile number' },
  field_tel:             { es: 'Teléfono fijo',                     en: 'Phone number' },
  field_mail:            { es: 'Correo electrónico',                en: 'Email address' },
  field_specify_doc:     { es: 'Especifique el tipo de documento',  en: 'Specify the document type' },
  field_specify_pais:    { es: 'Especifique el país',               en: 'Specify the country' },

  /* ── Sección 3 — opciones hardcodeadas y labels extendidos ─────────── */
  sec3_opt_nacional:      { es: 'Nacional',                              en: 'National' },
  sec3_opt_sucursal:      { es: 'Sucursal en Colombia',                  en: 'Branch in Colombia' },
  sec3_opt_extranjera:    { es: 'Extranjera',                            en: 'Foreign' },
  sec3_pais_origen:       { es: 'País de origen',                        en: 'Country of origin' },
  sec3_pais_origen_tip:   { es: 'País que establece la sucursal en Colombia', en: 'Country that establishes the branch in Colombia' },
  sec3_opt_publica:       { es: 'Pública',                               en: 'Public' },
  sec3_opt_privada:       { es: 'Privada',                               en: 'Private' },
  sec3_opt_mixta:         { es: 'Mixta',                                 en: 'Mixed' },
  sec3_opt_matriz:        { es: 'Matriz / Controlante',                  en: 'Parent / Controlling company' },
  sec3_opt_filial:        { es: 'Filial',                                en: 'Subsidiary' },
  sec3_opt_subsidiaria:   { es: 'Subsidiaria',                           en: 'Subsidiary (controlled)' },
  sec3_cal_grupo_lbl:     { es: 'Calidad de la sociedad/sucursal dentro del grupo empresarial o situación de control',
                            en: 'Role of the company/branch within the business group or control situation' },
  sec3_desc_grupo_lbl:    { es: 'Describa la estructura del grupo empresarial, indicando las sociedades que lo conforman y la posición de la sociedad/sucursal dentro de él',
                            en: 'Describe the business group structure, indicating the companies that form it and the position of the company/branch within it' },
  sec3_desc_grupo_ph:     { es: 'Describa la estructura del grupo empresarial…', en: 'Describe the business group structure…' },

  /* ── Página de inicio (index.html) ─────────────────────────────────── */
  idx_title:              { es: 'Registro — Persona Jurídica y Natural', en: 'Registration — Natural & Legal Persons' },
  idx_subtitle:           { es: 'SAGRILAFT: Sistema de Autocontrol y Gestión del Riesgo Integral de Lavado de Activos, Financiación del Terrorismo y Financiación de la Proliferación de Armas de Destrucción Masiva. PTEE: Programa de Transparencia y Ética Empresarial.',
                            en: 'SAGRILAFT: Self-Control and Comprehensive Risk Management System for Money Laundering, Terrorist Financing, and Financing of the Proliferation of Weapons of Mass Destruction. PTEE: Business Transparency and Ethics Program.' },
  idx_terms_read:         { es: 'He leído y acepto la',                  en: 'I have read and accept the' },
  idx_terms_policy_link:  { es: 'Política de tratamiento de datos personales', en: 'Personal data processing policy' },
  idx_terms_authorize:    { es: 'y autorizo el uso de mis datos conforme a los términos indicados.', en: 'and I authorize the use of my data as indicated in the terms.' },
  idx_terms_badge:        { es: '✅ Términos aceptados — puede continuar', en: '✅ Terms accepted — you may proceed' },
  idx_tc_title:           { es: 'Política de tratamiento de datos personales:', en: 'Personal Data Processing Policy:' },
  idx_tc_para1:           { es: ' Con el fin de dar cumplimiento a las disposiciones legales y regulatorias aplicables en materia de prevención del lavado de activos, la financiación del terrorismo, la financiación de la proliferación de armas de destrucción masiva (LA/FT/FPADM), la corrupción y el soborno transnacional (C/ST), COLLECTIVE MINING LIMITED SUCURSAL COLOMBIA ha desarrollado el presente formulario como instrumento para el conocimiento, identificación y debida diligencia de sus contrapartes, en el marco de su Sistema de Autocontrol y Gestión del Riesgo Integral de LA/FT/FPADM (SAGRILAFT) y su Programa de Transparencia y Ética Empresarial (PTEE).', en: ' In order to comply with the legal and regulatory provisions applicable to the prevention of money laundering, terrorist financing, the financing of the proliferation of weapons of mass destruction (ML/TF/PWMD), corruption and transnational bribery (C/TB), COLLECTIVE MINING LIMITED SUCURSAL COLOMBIA has developed this form as an instrument for the knowledge, identification and due diligence of its counterparties, within the framework of its Comprehensive Risk Self-Control and Management System for ML/TF/PWMD (SAGRILAFT) and its Business Transparency and Ethics Program (PTEE).' },
  idx_tc_para2:           { es: 'Sus datos serán tratados con estricta confidencialidad y solo serán compartidos con autoridades competentes cuando así lo exija la normativa vigente. Como titular, usted tiene derecho a conocer, actualizar, rectificar y suprimir su información personal. Para ejercer estos derechos o presentar quejas, puede comunicarse directamente con el oficial de cumplimiento de la entidad.', en: 'Your data will be treated with strict confidentiality and will only be shared with competent authorities when required by applicable regulations. As the data subject, you have the right to access, update, correct, and delete your personal information. To exercise these rights or file a complaint, please contact the entity\'s compliance officer directly.' },
  idx_card_create_title:  { es: 'Crear registro',                        en: 'Create record' },
  idx_card_create_desc:   { es: 'Diligencie el formulario completo para registrar una nueva persona natural o jurídica en el sistema.',
                            en: 'Complete the full form to register a new natural or legal person in the system.' },
  idx_card_create_btn:    { es: 'Ir al formulario',                      en: 'Go to form' },
  idx_card_update_title:  { es: 'Actualizar registro',                   en: 'Update record' },
  idx_card_update_desc:   { es: 'Busque un registro existente por número de documento para revisar o actualizar su información.',
                            en: 'Search an existing record by document number to review or update its information.' },
  idx_card_update_btn:    { es: 'Buscar registro',                       en: 'Search record' },
  idx_consol_title:       { es: '📥 Descargar consolidado de registros', en: '📥 Download records report' },
  idx_consol_nat_btn:     { es: '⬇ Consolidado Persona Natural',         en: '⬇ Natural Person Report' },
  idx_consol_jur_btn:     { es: '⬇ Consolidado Persona Jurídica',        en: '⬇ Legal Entity Report' },
  idx_footer:             { es: 'SAGRILAFT — Persona Natural y Jurídica  |  Solo para uso interno',
                            en: 'SAGRILAFT — Natural & Legal Persons  |  Internal use only' },
  idx_modal_pol_title:    { es: 'Política de tratamiento de datos',      en: 'Data processing policy' },
  idx_modal_tipo_title:   { es: '¿Qué tipo de registro va a crear?',     en: 'What type of record are you creating?' },
  idx_modal_tipo_body:    { es: 'Seleccione la naturaleza del tercero para iniciar el formulario con esa opción predeterminada. Podrá cambiarla dentro del formulario en cualquier momento.',
                            en: 'Select the type of party to start the form with that option preselected. You can change it inside the form at any time.' },
  idx_modal_pol_close:    { es: 'Cerrar',                                en: 'Close' },
  idx_modal_pol_accept:   { es: 'Acepto la política',                    en: 'I accept the policy' },
  idx_modal_upd_title:    { es: '🔍 Buscar registro existente',          en: '🔍 Search existing record' },
  idx_modal_upd_body:     { es: 'Ingrese el número de documento (cédula, NIT, etc.) del tercero que desea actualizar.',
                            en: 'Enter the document number (ID, NIT, etc.) of the person you want to update.' },
  idx_modal_upd_ph:       { es: 'Ej: 900123456',                        en: 'e.g. 900123456' },
  idx_modal_upd_search:   { es: 'Buscar',                               en: 'Search' },
  idx_modal_upd_cancel:   { es: 'Cancelar',                             en: 'Cancel' },
  idx_modal_upd_open:     { es: 'Abrir registro',                       en: 'Open record' },
  yes:                    { es: 'Sí',                                    en: 'Yes' },
  no:                     { es: 'No',                                    en: 'No' },

  nota_lbl:                { es: 'Nota:',                   en: 'Note:' },

  /* ── Roles y títulos de fichas dinámicas ────────────────────────────── */
  role_principal:          { es: 'Principal',              en: 'Primary' },
  role_suplente:           { es: 'Suplente',               en: 'Alternate' },
  card_oficial:            { es: 'Oficial',                en: 'Officer' },
  card_miembro:            { es: 'Miembro',                en: 'Member' },
  card_revisor:            { es: 'Revisor',                en: 'Auditor' },
  card_accionista:         { es: 'Accionista',             en: 'Shareholder' },
  card_beneficiario:       { es: 'Beneficiario',           en: 'Beneficiary' },
  card_representante:      { es: 'Representante adicional', en: 'Additional representative' },
  card_cuenta:             { es: 'Cuenta',                 en: 'Account' },
  card_cuenta_princ:       { es: 'Cuenta principal — Certificación bancaria', en: 'Primary account — Bank certification' },

  /* ── Labels de campos en plantillas JS ──────────────────────────────── */
  field_rol:               { es: 'Rol',                    en: 'Role' },
  field_tip_miembro:       { es: 'Tipo de miembro',        en: 'Member type' },
  field_tip_miembro_ph:    { es: 'Ej: Titular, Suplente de consejo…', en: 'E.g.: Board member, Alternate…' },
  field_fec_expe_doc:      { es: 'Fecha expedición doc.',  en: 'Doc. issue date' },
  field_obs:               { es: 'Observaciones',          en: 'Observations' },
  field_obs_ph:            { es: 'Observaciones adicionales (opcional)', en: 'Additional observations (optional)' },
  field_dir_simple:        { es: 'Dirección',              en: 'Address' },
  field_tip_persona:       { es: 'Tipo de persona',        en: 'Person type' },
  field_natural:           { es: 'Natural',                en: 'Natural' },
  field_juridica:          { es: 'Jurídica',               en: 'Legal entity' },
  field_pct_part:          { es: '% Participación',        en: '% Ownership' },
  field_razon_social:      { es: 'Razón social',           en: 'Company name' },
  field_raz_ph:            { es: 'Nombre de la empresa',   en: 'Company name' },
  field_raz_ph_aplica:     { es: 'Si aplica',              en: 'If applicable' },
  field_tel_cel:           { es: 'Teléfono / Celular',     en: 'Phone / Mobile' },
  field_especif_banco:     { es: 'Especifique la entidad bancaria', en: 'Specify the bank' },
  field_especif_tipcuen:   { es: 'Especifique el tipo de cuenta',   en: 'Specify the account type' },
  field_tipcuen_ph:        { es: 'Ej: cuenta fiduciaria, CDT…',     en: 'E.g.: trust account, CD…' },
  field_especif_doc:       { es: 'Especifique el tipo de documento', en: 'Specify document type' },
  field_pais_tip:          { es: 'País de domicilio o residencia del accionista.', en: 'Shareholder\'s country of domicile or residence.' },

  /* ── Sección 7 — firma auditora ─────────────────────────────────────── */
  rf_firm_asked:           { es: '¿El revisor está designado por una firma auditora?', en: 'Is the auditor appointed by an audit firm?' },
  rf_firm_raz:             { es: 'Razón social de la firma',    en: 'Audit firm name' },
  rf_firm_tipdoc:          { es: 'Tipo de documento de la firma',  en: 'Firm document type' },
  rf_firm_numdoc:          { es: 'Número de documento de la firma', en: 'Firm document number' },

  /* ── Sección 3 — dirección ───────────────────────────────────────────── */
  sec3_dir_oficina:        { es: 'Dirección oficina principal', en: 'Main office address' },
  sec3_dir_oficina_ph:     { es: 'Ej: Cra 7 # 45-12 Of. 301',    en: 'E.g.: 7th Ave # 45-12 Off. 301' },

  /* ── Sección 8 — Composición accionaria ─────────────────────────────── */
  sec8_tip:                { es: 'Se entiende por participación la tenencia de acciones, cuotas sociales, partes de interés o cualquier otro derecho económico o de control en una entidad. Registre todos los accionistas, socios o propietarios, indicando el porcentaje de participación de cada uno.', en: 'Participation means holding shares, equity interests, ownership stakes, or any other economic or control right in an entity. Register all shareholders, partners, or owners, indicating the ownership percentage of each one.' },
  sec8_warn_5pct:          { es: 'El porcentaje de participación es menor al 5%. Los accionistas con menos del 5% generalmente no se consideran beneficiarios finales, pero igualmente deben registrarse.', en: 'Ownership percentage is below 5%. Shareholders with less than 5% are generally not considered beneficial owners, but must still be registered.' },

  /* ── Sección 10 — Información financiera ────────────────────────────── */
  sec10_note:              { es: 'Ingresos, egresos y otros ingresos corresponden a cifras anuales expresadas en la moneda seleccionada. Activos totales, pasivos totales y patrimonio son valores de balance a la fecha de reporte.', en: 'Income, expenses and other income are annual figures expressed in the selected currency. Total assets, liabilities and equity are balance sheet values at the reporting date.' },
  sec10_hint_balance:      { es: 'Valor de balance',                  en: 'Balance sheet value' },
  sec10_hint_anual:        { es: 'Cifra anual',                       en: 'Annual figure' },
  sec10_patrimonio_hint:   { es: 'Calculado automáticamente: Activos − Pasivos', en: 'Auto-calculated: Assets − Liabilities' },

  /* ── Sección 14 — Documentos ─────────────────────────────────────────── */
  sec14_heading:           { es: 'DOCUMENTOS REQUERIDOS',         en: 'REQUIRED DOCUMENTS' },
  sec14_instruction:       { es: 'Adjunte los documentos solicitados. Los archivos se enviarán al confirmar el formulario. Formato aceptado: PDF (máx. 10 MB por archivo).', en: 'Attach the required documents. Files will be submitted when you confirm the form. Accepted format: PDF (max. 10 MB per file).' },
  sec14_vigencia:          { es: '(vigencia menor a 30 días)',     en: '(valid for less than 30 days)' },
  sec14_max30:             { es: '(máx. 30 días de expedición)',   en: '(max. 30 days from issue)' },
  sec14_penultimo:         { es: '(penúltimo y último año fiscal)', en: '(second-to-last and last fiscal year)' },
  sec14_rl_label:          { es: 'Documento de identidad del Representante Legal', en: 'Legal Representative\'s identity document' },
  sec14_rl_principal:      { es: 'Representante Legal Principal',  en: 'Primary Legal Representative' },
  sec14_rl_suplente:       { es: 'Representante Legal Suplente',   en: 'Alternate Legal Representative' },
  sec14_select_file_btn:   { es: 'Seleccionar archivo',            en: 'Select file' },
  sec14_no_file_txt:       { es: 'Ningún archivo seleccionado',    en: 'No file selected' },

  /* ── Toast / mensajes dinámicos ─────────────────────────────────────── */
  sec4_err_pais_vacia:   { es: 'Seleccione un país en cada entrada o elimine las vacías.',
                           en: 'Select a country for each entry or remove empty ones.' },
  sec4_err_pais:         { es: 'Seleccione un país',        en: 'Select a country' },
  toast_sec_ok:          { es: 'Sección completa.',                 en: 'Section complete.' },
  toast_sec_clear:       { es: 'Sección limpiada.',                 en: 'Section cleared.' },
  toast_check_fields:    { es: 'Corrija los campos marcados en rojo.', en: 'Correct the fields marked in red.' },
  toast_saving:          { es: 'Guardando…',                        en: 'Saving…' },
  toast_saved:           { es: 'Formulario enviado correctamente.',  en: 'Form submitted successfully.' },
  toast_error_gen:       { es: 'Ocurrió un error. Intente de nuevo.', en: 'An error occurred. Please try again.' },
  toast_dup:             { es: 'El número de documento ya está registrado.', en: 'This document number is already registered.' },
  toast_pdf_only:        { es: 'Solo se aceptan archivos PDF. Seleccione un archivo .pdf.', en: 'Only PDF files are accepted. Please select a .pdf file.' },

  /* ── Opciones de selects dinámicos ──────────────────────────────────────── */
  otro_pais_opt:    { es: 'Otro pa\xEDs (no listado)', en: 'Other country (not listed)' },
  otro_tipdoc_opt:  { es: 'Sin asignar / Otro tipo',   en: 'Unassigned / Other type' },
  no_aplica:        { es: 'No aplica',                  en: 'Not applicable' },
  sin_resultados:   { es: 'Sin resultados',             en: 'No results' },
  sin_opciones:     { es: '— Sin opciones —', en: '— No options —' },
  ph_nombres:       { es: 'Nombres completos',          en: 'Full first names' },
  ph_apellidos:     { es: 'Apellidos completos',        en: 'Full surnames' },
  sec5_need_oficial:{ es: 'Agregue al menos un oficial de cumplimiento.', en: 'Add at least one compliance officer.' },
  sec14_rl_id_tip:  { es: 'Copia legible de la cédula de ciudadanía o documento de identidad vigente del Representante Legal. Incluya ambas caras si la información relevante está distribuida en ellas.',
                      en: 'Legible copy of the current national ID or identity document of the Legal Representative. Include both sides if relevant information is distributed across them.' },
  toast_fields_missing: { es: 'Faltan {n} campo(s). Revise los campos en rojo.',
                          en: 'Fix {n} required field(s). Check the fields marked in red.' },
  /* ── Placeholders de campos de texto ──────────────────────────────────── */
  ph_primer_nombre:    { es: 'Primer nombre',                    en: 'First name' },
  ph_seg_nombre:       { es: 'Segundo nombre (opcional)',         en: 'Middle name (optional)' },
  ph_primer_apellido:  { es: 'Primer apellido',                   en: 'First surname' },
  ph_seg_apellido:     { es: 'Segundo apellido (opcional)',       en: 'Second surname (optional)' },
  ph_email_contact:    { es: 'contacto@empresa.com',              en: 'contact@company.com' },
  ph_describe_vinc:    { es: 'Describa el tipo de vinculación',   en: 'Describe the relationship type' },
  ph_describe_ciiu:    { es: 'Describa la actividad económica',   en: 'Describe the economic activity' },
  ph_pais_nacio:       { es: 'País o nacionalidad',               en: 'Country or nationality' },
  ph_act_princ:        { es: 'Descripción breve de la actividad', en: 'Brief description of the activity' },
  ph_dir_rl:           { es: 'Ej: Cra 7 # 45-12',               en: 'E.g.: 7th Ave # 45-12' },
  /* ── Labels / errores sin i18n ────────────────────────────────────────── */
  label_describe_ciiu: { es: 'Describa la actividad',             en: 'Describe the activity' },
  label_especif_nacio: { es: 'Especifique la nacionalidad',       en: 'Specify the nationality' },
  error_select_ciiu:   { es: 'Seleccione una actividad válida',   en: 'Select a valid activity' },

};

/* ═══════════════════════════════════════════════════════════════════════════
   ESTADO Y FUNCIONES PÚBLICAS
   ═══════════════════════════════════════════════════════════════════════════ */

let _currentLang = 'es';

/**
 * Devuelve la traducción de una clave para el idioma activo.
 * Si la clave no existe en el diccionario, devuelve la propia clave como
 * fallback visible para facilitar la detección de traducciones faltantes.
 * @param {string} key
 * @returns {string}
 */
function t(key) {
  const entry = I18N_DICT[key];
  if (!entry) return key;
  return entry[_currentLang] || entry['es'] || key;
}

/**
 * Aplica el idioma activo a todos los elementos del DOM marcados con
 * atributos data-i18n*.
 */
function applyLang() {
  // data-i18n → textContent
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = t(key);
    if (val) el.textContent = val;
  });

  // data-i18n-html → innerHTML (para etiquetas con <span> internos)
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.getAttribute('data-i18n-html');
    // Reconstruir manteniendo elementos internos no-texto (req *, ic-info, etc.)
    // Guardamos los child elements y solo reemplazamos los text nodes raíz
    const val = t(key);
    if (val) {
      // Clonar nodos no-texto existentes (spans con clase)
      const preserved = Array.from(el.childNodes).filter(
        n => n.nodeType === Node.ELEMENT_NODE
      );
      el.textContent = val + ' ';
      preserved.forEach(child => el.appendChild(child));
    }
  });

  // data-i18n-ph → placeholder
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    const key = el.getAttribute('data-i18n-ph');
    const val = t(key);
    if (val) el.placeholder = val;
  });

  // data-i18n-tip → data-tip (tooltips ic-info)
  document.querySelectorAll('[data-i18n-tip]').forEach(el => {
    const key = el.getAttribute('data-i18n-tip');
    const val = t(key);
    if (val) el.setAttribute('data-tip', val);
  });

  // data-i18n-title → title attribute
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    const val = t(key);
    if (val) el.title = val;
  });

  // Actualizar lang del documento
  document.documentElement.lang = _currentLang;

  // Actualizar texto del botón de idioma
  const btn = document.getElementById('lang-toggle-btn');
  if (btn) {
    btn.textContent = _currentLang === 'es' ? 'English' : 'Español';
    btn.title = _currentLang === 'es'
      ? 'Switch to English'
      : 'Cambiar a español';
  }

  // Recargar opciones de los <select> que vienen de catálogos de BD
  if (typeof recargarCatalogosIdioma === 'function') {
    recargarCatalogosIdioma();
  }
  // Actualizar labels del multi-select de sistemas de prevención
  if (typeof refreshSistPrevLabels === 'function') {
    refreshSistPrevLabels();
  }
}

/**
 * Cambia el idioma activo, persiste en localStorage y aplica al DOM.
 * @param {'es'|'en'} lang
 */
function setLang(lang) {
  if (lang !== 'es' && lang !== 'en') return;
  _currentLang = lang;
  try { localStorage.setItem('sagrilaft_lang', lang); } catch (_) {}
  applyLang();
}

/**
 * Alterna entre español e inglés.
 */
function toggleLang() {
  setLang(_currentLang === 'es' ? 'en' : 'es');
}

/**
 * Lee el idioma persistido en localStorage y lo aplica.
 * Llamar desde DOMContentLoaded.
 */
function initLang() {
  try {
    const saved = localStorage.getItem('sagrilaft_lang');
    if (saved === 'en' || saved === 'es') _currentLang = saved;
  } catch (_) {}
  applyLang();
}

/* Exponer al scope global para uso en HTML inline y en utils.js */
window.t            = t;
window.setLang      = setLang;
window.toggleLang   = toggleLang;
window.initLang     = initLang;
window.applyLang    = applyLang;
// _currentLang expuesto para que utils.js pueda elegir NOM_EN vs NOM_*
Object.defineProperty(window, '_currentLang', { get: () => _currentLang });

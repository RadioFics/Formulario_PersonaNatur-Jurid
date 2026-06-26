# -*- coding: utf-8 -*-
"""
forms_data.py — Modelo de datos UNICO del Formulario SAGRILAFT.
Lo consumen:
  - generar_inventario_forms.py  (Excel inventario)
  - generar_forms_import.py       (Word import-ready para Microsoft Forms)
"""
import json, os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAT = json.load(open(os.path.join(BASE, 'scripts', '_catalogos.json'), encoding='utf-8'))

def catlist(key):
    return " | ".join(x['es'] for x in CAT[key])

# Tipos de control y su equivalente en Microsoft Forms (referencia para el Excel)
FORMS = {
    'text':     'Texto (respuesta corta)',
    'textarea': 'Texto (respuesta larga / parrafo)',
    'email':    'Texto + restriccion Email',
    'tel':      'Texto + restriccion Numero',
    'number':   'Texto + restriccion Numero',
    'money':    'Texto + restriccion Numero (valor monetario)',
    'date':     'Fecha',
    'select':   'Opcion (lista desplegable)',
    'radio':    'Opcion (botones)',
    'checkbox': 'Opcion (varias respuestas)',
    'file':     'Carga de archivos (PDF)',
    'section':  'Seccion',
}

def F(es, en, t, req=False, opts='', tip='', cond='', aplica='Ambos'):
    return dict(es=es, en=en, t=t, req=req, opts=opts, tip=tip, cond=cond, aplica=aplica)

# Secciones con grupo repetible: clave de seccion -> (singular de la entidad, copias)
REPEAT = {
    '2':  ('Representante legal', 2),
    '4':  ('Pais de operacion', 5),
    '5b': ('Oficial de cumplimiento', 2),
    '6b': ('Miembro de junta', 3),
    '7b': ('Revisor fiscal', 2),
    '8':  ('Accionista', 4),
    '9':  ('Beneficiario final', 4),
    '11': ('Cuenta bancaria', 2),
}

SECCIONES = [

 ("0", "Inicio — Politica de tratamiento de datos", "Pantalla previa (gate). En Forms: pagina/seccion inicial con el texto de la politica y una pregunta de aceptacion obligatoria.", [
    F("He leido y acepto la Politica de tratamiento de datos personales y autorizo el uso de mis datos",
      "I have read and accept the Personal data processing policy and authorize the use of my data",
      'checkbox', True, 'Acepto', 'Ley 1581 de 2012 y Decreto 1074 de 2015. Sin aceptar no se accede al formulario.',
      'Bloquea el acceso al resto del formulario'),
 ]),

 ("1", "Informacion basica de la empresa", "", [
    F("Tipo de persona", "Person type", 'select', True, 'Persona juridica | Persona natural',
      '', 'Controla todo el formulario: muestra campos Juridica o Natural'),
    F("Tipo de vinculacion", "Relationship type", 'select', True, catlist('vinculaciones'),
      '', "Si elige 'Otro' -> aparece 'Especifique el tipo de vinculacion'"),
    F("Especifique el tipo de vinculacion", "Specify the relationship type", 'text', True, '',
      '', "Visible solo si Tipo de vinculacion = Otro"),
    F("Tipo de documento", "Document type", 'select', True, catlist('tiposDocumento'),
      '', "Si elige 'Otro' -> campo de texto para especificar"),
    F("Numero de documento", "Document number", 'tel', True, '', '', 'Solo numerico. Verifica duplicados'),
    F("Digito de verificacion del NIT", "Check digit", 'tel', False, '',
      'Numero despues del guion en el NIT. Ej: en 900.123.456-7 el digito es 7.', '', 'Juridica'),
    F("Fecha de expedicion del documento", "Document issue date", 'date', True, '', '', '', 'Natural'),
    F("Razon social", "Company name", 'text', True, '', '', '', 'Juridica'),
    F("Primer nombre", "First name", 'text', True, '', '', '', 'Natural'),
    F("Segundo nombre", "Second name", 'text', False, '', '', '', 'Natural'),
    F("Primer apellido", "First surname", 'text', True, '', '', '', 'Natural'),
    F("Segundo apellido", "Second surname", 'text', False, '', '', '', 'Natural'),
    F("Pais de domicilio principal", "Country", 'select', True, '[Catalogo: %d paises]' % CAT['_counts']['paises'],
      '', 'Cascada: habilita Departamento'),
    F("Departamento", "Department/State", 'select', True, '[Catalogo: depende del pais]',
      '', 'Cascada: se habilita al elegir pais; habilita Ciudad'),
    F("Ciudad", "City", 'select', True, '[Catalogo: %d ciudades, depende del depto]' % CAT['_counts']['ciudades'],
      '', 'Cascada: se habilita al elegir departamento'),
    F("Direccion oficina principal", "Main office address", 'text', True, ''),
    F("Telefono fijo", "Phone number", 'tel', False, ''),
    F("Telefono celular", "Mobile number", 'tel', True, ''),
    F("Correo electronico", "Email address", 'email', True, '', 'Puede ser correo corporativo o personal.'),
    F("Email gestion SAGRILAFT", "SAGRILAFT management email", 'email', True, '',
      'El correo puede coincidir con el correo del punto anterior.', '', 'Juridica'),
    F("Actividad principal CIIU", "Main economic activity (CIIU)", 'select', True,
      '[Catalogo: %d codigos CIIU]' % CAT['_counts']['ciiu'],
      'Debe coincidir con RUT, camara de comercio y/o documento equivalente.',
      "Si 'Otros...' -> describa la actividad", 'Juridica'),
    F("Pagina web", "Website URL", 'text', False, '', '', '', 'Juridica'),
    F("Nacionalidad", "Nationality", 'select', True, '[Catalogo: paises]', '',
      "Si 'Otro' -> especifique la nacionalidad", 'Natural'),
    F("Actividad economica CIIU", "Economic activity (CIIU)", 'select', True, '[Catalogo: CIIU]',
      'Debe coincidir con el RUT o con declaracion de renta.', "Si 'Otros...' -> describa", 'Natural'),
    F("Su empresa cotiza en bolsa de valores", "Does your company trade on a stock exchange?",
      'radio', True, 'Si | No', '', "Si = Si -> 'En cual bolsa cotiza'", 'Juridica'),
    F("En cual bolsa de valores cotiza", "Which stock exchange?", 'text', True, '',
      '', 'Visible solo si cotiza en bolsa = Si', 'Juridica'),
 ]),

 ("2", "Informacion del representante legal", "GRUPO REPETIBLE. El bloque se replica para Principal y adicionales.", [
    F("Nombres", "First names", 'text', True, ''),
    F("Apellidos", "Surnames", 'text', True, ''),
    F("Tipo de documento", "Document type", 'select', True, catlist('tiposDocumento'), '', "Si 'Otro' -> especifique"),
    F("Numero de documento", "Document number", 'tel', True, ''),
    F("Fecha de expedicion", "Issue date", 'date', True, ''),
    F("Pais", "Country", 'select', True, '[Catalogo: paises]', '', 'Cascada (+ campo Otro pais)'),
    F("Departamento", "Department/State", 'select', True, '[Catalogo]', '', 'Cascada'),
    F("Ciudad", "City", 'select', True, '[Catalogo]', '', 'Cascada'),
    F("Direccion domicilio", "Domicile address", 'text', True, ''),
    F("Celular", "Mobile number", 'tel', True, ''),
    F("Telefono fijo", "Phone number", 'tel', False, ''),
    F("Correo electronico", "Email address", 'email', True, ''),
 ], 'Juridica'),

 ("3", "Informacion de la sociedad", "", [
    F("Ubicacion de la sociedad", "Company location", 'select', True, 'Nacional | Sucursal en Colombia | Extranjera'),
    F("Pais", "Country", 'select', True, '[Catalogo: paises]', '', "Visible solo si Ubicacion = Extranjera (+Otro)"),
    F("Pais de origen", "Country of origin", 'select', True, '[Catalogo: paises]',
      'Pais que establece la sucursal en Colombia', "Visible solo si Ubicacion = Sucursal en Colombia (+Otro)"),
    F("Tipo de empresa", "Company type", 'select', True, 'Publica | Privada | Mixta'),
    F("Pertenece a un grupo empresarial", "Belongs to a business group?", 'select', True, 'Si | No'),
    F("Las situaciones de control y/o grupo empresarial estan declaradas en el Certificado de Existencia y Representacion Legal adjunto",
      "Control/business-group situations are declared in the attached Certificate of Existence",
      'radio', True, 'Si | No', '', "Visible solo si grupo empresarial = Si"),
    F("Calidad de la sociedad dentro del grupo o situacion de control",
      "Role within the business group", 'select', True, 'Matriz / Controlante | Filial | Subsidiaria',
      '', "Visible solo si la declaracion anterior = No"),
    F("Describa la estructura del grupo empresarial y la posicion de la sociedad",
      "Describe the business group structure", 'textarea', True, '', '',
      "Visible solo si la declaracion anterior = No"),
 ], 'Juridica'),

 ("4", "Paises de operacion", "GRUPO REPETIBLE. Indique todos los paises donde la empresa opera o tiene presencia comercial. Cada entrada = un pais distinto.", [
    F("Pais de operacion", "Operating country", 'select', True, '[Catalogo: paises]'),
 ]),

 ("5", "Informacion del Sistema de cumplimiento", "", [
    F("La sociedad esta sujeta a normatividad que la obligue a implementar controles de prevencion de LA/FT, Fraude, Corrupcion y/o Soborno",
      "Is the company subject to ML/TF/Fraud/Corruption/Bribery regulation?", 'radio', True, 'Si | No'),
    F("Cuales son estas regulaciones o normas", "What are these regulations?", 'textarea', True, '',
      '', 'Visible solo si lo anterior = Si'),
    F("Referencia especifica de normatividad LA/FT (ej.: Ley 526/1999, Decreto 1674/2023, SAGRILAFT)",
      "Specific ML/TF regulation reference", 'text', False, '', '', 'Visible solo si sujeta a normatividad = Si'),
    F("Tiene sistema de prevencion de riesgos implementado", "Risk prevention system implemented?",
      'radio', True, 'Si | No', '', 'Visible solo si sujeta a normatividad = Si'),
    F("Tipo de sistema implementado", "Type of system implemented", 'checkbox', True, catlist('sistemasPrevencion'),
      '', "Visible si tiene sistema = Si. Si 'Otro' -> especifique"),
 ]),
 ("5b", "Oficiales de cumplimiento", "GRUPO REPETIBLE (visible si tiene sistema = Si). El 1ro = Principal, los demas = Suplente.", [
    F("Nombres", "First names", 'text', True, ''),
    F("Apellidos", "Surnames", 'text', True, ''),
    F("Tipo de documento", "Document type", 'select', True, catlist('tiposDocumento')),
    F("Numero de documento", "Document number", 'tel', True, ''),
    F("Fecha de expedicion", "Issue date", 'date', True, ''),
    F("Pais", "Country", 'select', True, '[Catalogo]', '', 'Cascada'),
    F("Departamento", "Department/State", 'select', True, '[Catalogo]', '', 'Cascada'),
    F("Ciudad", "City", 'select', True, '[Catalogo]', '', 'Cascada'),
    F("Direccion domicilio", "Domicile address", 'text', False, ''),
    F("Celular", "Mobile number", 'tel', True, ''),
    F("Telefono fijo", "Phone number", 'tel', False, ''),
    F("Correo electronico", "Email address", 'email', True, ''),
 ], 'Juridica'),

 ("6", "Junta directiva / Consejo de administracion", "", [
    F("La empresa tiene junta directiva o consejo de administracion", "Has a board of directors?",
      'radio', True, 'Si | No'),
 ], 'Juridica'),
 ("6b", "Miembros de junta directiva", "GRUPO REPETIBLE (visible si tiene junta = Si).", [
    F("Tipo de miembro", "Member type", 'select', True, 'Principal | Suplente'),
    F("Nombres", "First names", 'text', True, ''),
    F("Apellidos", "Surnames", 'text', True, ''),
    F("Tipo de documento", "Document type", 'select', True, catlist('tiposDocumento')),
    F("Numero de documento", "Document number", 'tel', True, ''),
    F("Fecha de expedicion", "Issue date", 'date', True, ''),
    F("Pais", "Country", 'select', True, '[Catalogo]', '', 'Cascada'),
    F("Departamento", "Department/State", 'select', True, '[Catalogo]', '', 'Cascada'),
    F("Ciudad", "City", 'select', True, '[Catalogo]', '', 'Cascada'),
    F("Direccion domicilio", "Domicile address", 'text', False, ''),
    F("Celular", "Mobile number", 'tel', True, ''),
    F("Telefono fijo", "Phone number", 'tel', False, ''),
    F("Correo electronico", "Email address", 'email', True, ''),
 ], 'Juridica'),

 ("7", "Revisores fiscales", "", [
    F("La empresa tiene revisor fiscal", "Has a statutory auditor?", 'radio', True, 'Si | No'),
 ], 'Juridica'),
 ("7b", "Revisores fiscales (detalle)", "GRUPO REPETIBLE (visible si tiene revisor = Si).", [
    F("Rol", "Role", 'select', True, 'Principal | Suplente'),
    F("Nombres", "First names", 'text', True, ''),
    F("Apellidos", "Surnames", 'text', True, ''),
    F("Fecha de expedicion del documento", "Doc. issue date", 'date', True, ''),
    F("Tipo de documento", "Document type", 'select', True, catlist('tiposDocumento')),
    F("Numero de documento", "Document number", 'tel', True, ''),
    F("Celular", "Mobile number", 'tel', True, ''),
    F("Pais", "Country", 'select', True, '[Catalogo]', '', 'Cascada'),
    F("Departamento", "Department/State", 'select', True, '[Catalogo]', '', 'Cascada'),
    F("Ciudad", "City", 'select', True, '[Catalogo]', '', 'Cascada'),
    F("Direccion", "Address", 'text', False, ''),
    F("Telefono fijo", "Phone number", 'tel', False, ''),
    F("Correo electronico", "Email address", 'email', True, ''),
    F("Observaciones", "Observations", 'textarea', False, ''),
    F("El revisor esta designado por una firma auditora", "Appointed by an audit firm?", 'radio', True, 'Si | No'),
    F("Razon social de la firma auditora", "Audit firm name", 'text', True, '', '', 'Visible si designado por firma = Si'),
    F("Tipo de documento de la firma", "Firm document type", 'select', True, catlist('tiposDocumento'), '', 'Visible si designado por firma = Si'),
    F("Numero de documento de la firma", "Firm document number", 'tel', True, '', '', 'Visible si designado por firma = Si'),
 ], 'Juridica'),

 ("8", "Composicion accionaria o propietaria", "GRUPO REPETIBLE. Los accionistas con 5% o mas se consideran beneficiarios finales.", [
    F("Tipo de persona del accionista", "Person type", 'radio', True, 'Natural | Juridica',
      'Participacion = tenencia de acciones, cuotas sociales o cualquier interes economico o de control.'),
    F("Porcentaje de participacion", "% Ownership", 'number', True, '', 'Aviso si es menor al 5%'),
    F("Nombres", "First names", 'text', True, '', '', 'Visible si Tipo de persona = Natural'),
    F("Apellidos", "Surnames", 'text', True, '', '', 'Visible si Tipo de persona = Natural'),
    F("Fecha de expedicion del documento", "Doc. issue date", 'date', True, '', '', 'Visible si Tipo de persona = Natural'),
    F("Razon social", "Company name", 'text', True, '', '', 'Visible si Tipo de persona = Juridica'),
    F("Tipo de documento", "Document type", 'select', True, catlist('tiposDocumento'), '', "Si 'Otro' -> especifique"),
    F("Numero de documento", "Document number", 'tel', True, ''),
    F("Celular", "Mobile number", 'tel', False, ''),
    F("Pais", "Country", 'select', True, '[Catalogo]', 'Pais de domicilio o residencia del accionista.', 'Cascada (+Otro pais)'),
    F("Departamento", "Department/State", 'select', True, '[Catalogo]', '', 'Cascada'),
    F("Ciudad", "City", 'select', True, '[Catalogo]', '', 'Cascada'),
    F("Direccion", "Address", 'text', False, ''),
    F("Telefono fijo", "Phone number", 'tel', False, ''),
    F("Correo electronico", "Email address", 'email', False, ''),
 ], 'Juridica'),

 ("9", "Beneficiarios Finales", "GRUPO REPETIBLE. Persona natural que directa o indirectamente controla o posee el 5% o mas.", [
    F("Nombres", "First names", 'text', True, ''),
    F("Apellidos", "Surnames", 'text', True, ''),
    F("Fecha de expedicion", "Issue date", 'date', True, ''),
    F("Tipo de documento", "Document type", 'select', True, catlist('tiposDocumento')),
    F("Numero de documento", "Document number", 'tel', True, ''),
    F("Telefono / Celular", "Phone / Mobile", 'tel', False, ''),
    F("Correo electronico", "Email address", 'email', False, ''),
    F("Pais", "Country", 'select', True, '[Catalogo]', '', 'Cascada (+Otro pais)'),
    F("Departamento", "Department/State", 'select', True, '[Catalogo]', '', 'Cascada'),
    F("Ciudad", "City", 'select', True, '[Catalogo]', '', 'Cascada'),
    F("Direccion", "Address", 'text', False, ''),
 ], 'Juridica'),

 ("9N", "Participacion en sociedades", "Equivalente a la Seccion 9 para Persona Natural.", [
    F("Tiene participacion en alguna sociedad y/o es beneficiario final de esta",
      "Do you hold participation and/or are a beneficial owner?", 'radio', True, 'Si | No',
      'Participacion = tenencia de acciones, cuotas sociales o cualquier interes economico o de control.'),
    F("Razon social (nombre de la sociedad)", "Company name", 'text', True, '', '', 'Visible solo si lo anterior = Si'),
    F("Tipo de documento", "Document type", 'select', True, catlist('tiposDocumento'), '', "Visible si = Si. Si 'Otro' -> especifique"),
    F("Numero de documento", "Document number", 'tel', True, '', '', 'Visible solo si = Si'),
 ], 'Natural'),

 ("10", "Informacion financiera", "Activos, pasivos y patrimonio = valores de balance. Ingresos/egresos/otros = cifras anuales. Patrimonio se autocalcula (Activos - Pasivos).", [
    F("Moneda de reporte", "Reporting currency", 'select', True, '[Catalogo: %d monedas, ej. COP, USD, EUR]' % len(CAT['monedas']),
      'Todos los campos de esta seccion deben estar en la misma moneda.'),
    F("Total activos", "Total assets", 'money', True, '', 'Valor de balance'),
    F("Ingresos anuales", "Annual income", 'money', True, '', 'Cifra anual'),
    F("Total pasivos", "Total liabilities", 'money', True, '', 'Valor de balance'),
    F("Egresos anuales", "Annual expenses", 'money', True, '', 'Cifra anual'),
    F("Patrimonio", "Equity / Net worth", 'money', True, '', 'Calculado automaticamente: Activos - Pasivos'),
    F("Otros ingresos", "Other income", 'money', False, '', 'Cifra anual'),
 ]),

 ("11", "Informacion bancaria", "GRUPO REPETIBLE. La cuenta principal debe coincidir con la certificacion bancaria adjunta.", [
    F("Entidad bancaria", "Bank", 'select', True, '[Catalogo: %d bancos + Otro]' % len(CAT['bancos']),
      'Cuenta a la que llegaran los pagos. Debe coincidir con la certificacion bancaria adjunta.',
      "Si 'Otro' -> especifique la entidad"),
    F("Tipo de cuenta", "Account type", 'select', True, catlist('tiposCuenta'), '', "Si 'Otro' -> especifique"),
    F("Numero de cuenta", "Account number", 'text', True, ''),
    F("Posee cuentas en el extranjero", "Holds accounts abroad?", 'radio', False, 'Si | No',
      '', "Si = Si -> sub-grupo repetible de cuentas extranjeras"),
    F("Cuenta extranjera: pais de la cuenta", "Foreign account country", 'select', True, '[Catalogo: paises]',
      '', 'Visible si posee cuentas en el extranjero = Si'),
    F("Cuenta extranjera: nombre de la entidad", "Foreign bank name", 'text', True, '',
      '', 'Visible si posee cuentas en el extranjero = Si'),
    F("Cuenta extranjera: tipo de cuenta", "Foreign account type", 'text', True, '',
      '', 'Visible si posee cuentas en el extranjero = Si'),
 ]),

 ("12", "PEP — Exposicion politica", "PEP (Decreto 830 de 2021): personas que desempenan o desempenaron funciones publicas destacadas, sus familiares hasta 2do grado y asociados cercanos.", [
    F("Ha manejado o maneja recursos publicos", "Manages public funds?", 'radio', True, 'Si | No'),
    F("Ejerce o ha ejercido un cargo publico en los ultimos dos anios", "Held public office in the last 2 years?",
      'radio', True, 'Si | No'),
 ]),

 ("13", "Actividades con activos virtuales", "Activos virtuales = representaciones digitales de valor (criptomonedas, tokens). VASP = Proveedor de Servicios de Activos Virtuales.", [
    F("Realiza operaciones con activos virtuales", "Performs virtual asset operations?", 'radio', True, 'Si | No'),
    F("Actividades con activos virtuales (marque las que apliquen)", "Virtual asset activities", 'checkbox', False,
      'Intercambio entre activos virtuales y monedas fiduciarias | '
      'Intercambio entre una o mas formas de activos virtuales | '
      'Transferencia de activos virtuales | '
      'Custodia y/o administracion de activos virtuales | '
      'Participacion en servicios financieros relacionados con activos virtuales | '
      'Prestacion de servicios financieros como VASP',
      '', 'Visible solo si realiza operaciones = Si'),
    F("Certifico que la informacion suministrada es veraz, completa y corresponde a la realidad",
      "I certify the information is truthful and complete", 'checkbox', True, 'Certifico'),
 ]),

 ("14", "Documentos Requeridos", "Cargas de archivo PDF (max. 10 MB). La importacion rapida NO crea preguntas de archivo: agreguelas a mano como 'Carga de archivos'.", [
    F("RUT — Registro Unico Tributario", "RUT", 'file', True, '', 'Vigencia no mayor a 30 dias.'),
    F("Certificacion bancaria", "Bank certification", 'file', True, '', 'Firmada por la entidad, vigencia < 30 dias.'),
    F("Certificado de existencia y representacion legal (o equivalente)", "Certificate of existence", 'file', False,
      '', 'Camara de Comercio. Expedicion no mayor a 30 dias.', '', 'Juridica'),
    F("Documento de identidad del Representante Legal (uno por cada RL)", "Legal Rep. ID", 'file', False,
      '', 'Copia legible vigente. Uno por cada representante legal registrado.', '', 'Juridica'),
    F("Copia del documento de identidad", "Identity document", 'file', False,
      '', 'Copia legible vigente; debe coincidir con la Seccion 1.', '', 'Natural'),
    F("Declaracion de renta o juramentada", "Tax return / Sworn declaration", 'file', False,
      '', 'Ultimo anio fiscal o declaracion juramentada de ingresos.', '', 'Natural'),
    F("Estados financieros — Anio 1 (penultimo anio fiscal)", "Financial statements Year 1", 'file', False,
      '', 'Firmados por Representante Legal y Contador/Revisor Fiscal.', '', 'Juridica'),
    F("Estados financieros — Anio 2 (ultimo anio fiscal)", "Financial statements Year 2", 'file', False,
      '', '', '', 'Juridica'),
    F("Certificado de composicion accionaria", "Shareholder composition certificate", 'file', False,
      '', 'Estructura de capital firmada por Revisor Fiscal / Contador / Rep. Legal.', '', 'Juridica'),
    F("Carta de aceptacion y autorizacion del Representante Legal", "Acceptance/authorization letter", 'file', False,
      '', 'Autoriza tratamiento de datos y confirma veracidad.', '', 'Juridica'),
    F("Carta declaracion origen de fondos y autorizacion de tratamiento de datos", "Source-of-funds letter", 'file', False,
      '', 'Firmada por la persona natural.', '', 'Natural'),
 ]),
]

def unpack(sec):
    if len(sec) == 5:
        num, titulo, nota, campos, aplica_def = sec
    else:
        num, titulo, nota, campos = sec
        aplica_def = None
    if aplica_def:
        for c in campos:
            if c['aplica'] == 'Ambos':
                c['aplica'] = aplica_def
    return num, titulo, nota, campos

def secciones_por_modo(modo):
    """modo = 'Juridica' | 'Natural'. Devuelve [(num,titulo,nota,campos_filtrados)]."""
    out = []
    for sec in SECCIONES:
        num, titulo, nota, campos = unpack(sec)
        keep = [c for c in campos if c['aplica'] in ('Ambos', modo)]
        if keep:
            out.append((num, titulo, nota, keep))
    return out

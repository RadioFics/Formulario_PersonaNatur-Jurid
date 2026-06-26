# -*- coding: utf-8 -*-
"""
Genera documentos OPTIMIZADOS para la "Importacion rapida" de Microsoft Forms.

Formato que entiende el importador (confirmado):
  - Estilo "Titulo"        -> nombre del formulario / titulo de seccion
  - Estilo "Encabezado 1"  -> texto de la PREGUNTA  (numerada 1..N, continua)
  - Estilo "Encabezado 2"  -> cada OPCION de respuesta (con letra: A. B. C.)
  - Solo soporta opcion multiple y texto abierto.
  - Las opciones NUNCA con vinetas. Varias lineas en blanco entre preguntas.

Salida (Exportacion_MicrosoftForms/):
  - Forms_Importar_PersonaJuridica.docx
  - Forms_Importar_PersonaNatural.docx
  - Forms_Guia_Post_Importacion.docx
"""
import os
from docx import Document
from docx.shared import Pt, RGBColor
from forms_data import CAT, REPEAT, secciones_por_modo, unpack, SECCIONES

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(BASE, 'Exportacion_MicrosoftForms')
os.makedirs(OUT, exist_ok=True)

LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

def es_opcion_multiple(f):
    """True si la pregunta debe importarse como Opcion multiple (con opciones)."""
    if f['t'] in ('radio', 'checkbox'):
        return True
    if f['t'] == 'select' and f['opts'] and not f['opts'].startswith('['):
        return True
    return False

def texto_pregunta(f, prefijo=''):
    txt = "%s%s" % (prefijo, f['es'])
    if f['t'] == 'date':
        txt += " (formato DD/MM/AAAA)"
    if f['req']:
        txt += " *"
    return txt

def add_pregunta(doc, f, prefijo=''):
    """Agrega una pregunta (Encabezado 1) y, si aplica, sus opciones (Encabezado 2)."""
    if es_opcion_multiple(f):
        # Pregunta de OPCION: las opciones con letra delimitan la pregunta (se importan bien)
        doc.add_paragraph(texto_pregunta(f, prefijo), style='Heading 1')
        opts = [o.strip() for o in f['opts'].split('|') if o.strip()]
        for i, o in enumerate(opts):
            doc.add_paragraph("%s. %s" % (LETTERS[i], o), style='Heading 2')
    else:
        # Pregunta de TEXTO: se agrega una linea de respuesta en blanco para que el
        # parser la reconozca como pregunta de respuesta corta y NO la fusione con la siguiente.
        doc.add_paragraph(texto_pregunta(f, prefijo), style='Heading 1')
        doc.add_paragraph("____________________", style='Heading 2')
    # separacion amplia entre preguntas (el importador lo recomienda)
    doc.add_paragraph("")
    doc.add_paragraph("")

# ───────────────────────────────────────────────────────────────────────────
# 1) DOCUMENTOS DE IMPORTACION (uno por modo)
# ───────────────────────────────────────────────────────────────────────────
def construir_doc(modo, titulo_form):
    doc = Document()
    base = doc.styles['Normal']; base.font.name = 'Calibri'; base.font.size = Pt(11)

    # Nombre del formulario (estilo Titulo)
    doc.add_paragraph(titulo_form, style='Title')
    doc.add_paragraph("")

    num = 0
    for (sec, titulo, nota, campos) in secciones_por_modo(modo):
        # Las cargas de archivo NO se importan (el importador no las soporta)
        campos = [c for c in campos if c['t'] != 'file']
        if not campos:
            continue
        # Titulo de seccion: marcador "Seccion:" aislado con espacio (asi lo reconoce el importador)
        doc.add_paragraph("")
        doc.add_paragraph("Seccion: %s. %s" % (sec, titulo), style='Title')
        doc.add_paragraph("")

        rep = REPEAT.get(sec)
        if rep:
            singular, copias = rep
            for k in range(1, copias + 1):
                if len(campos) == 1:
                    f = campos[0]
                    num += 1
                    add_pregunta(doc, f, prefijo="%s %d: " % (singular, k))
                else:
                    for f in campos:
                        num += 1
                        add_pregunta(doc, f, prefijo="%s %d — " % (singular, k))
        else:
            for f in campos:
                num += 1
                add_pregunta(doc, f)

    path = os.path.join(OUT, "Forms_Importar_Persona%s.docx" % modo)
    doc.save(path)
    return path, num

p_j, n_j = construir_doc('Juridica', 'Registro SAGRILAFT — Persona Juridica')
p_n, n_n = construir_doc('Natural',  'Registro SAGRILAFT — Persona Natural')
print("Juridica:", p_j, "->", n_j, "preguntas")
print("Natural :", p_n, "->", n_n, "preguntas")

# ───────────────────────────────────────────────────────────────────────────
# 2) GUIA POST-IMPORTACION (lo que el importador NO puede hacer)
# ───────────────────────────────────────────────────────────────────────────
g = Document()
g.styles['Normal'].font.name = 'Calibri'; g.styles['Normal'].font.size = Pt(11)
g.add_heading('Guia de importacion a Microsoft Forms — SAGRILAFT', level=0)

def par(txt, bold=False, italic=False, color=None, size=None, style=None):
    p = g.add_paragraph(style=style)
    r = p.add_run(txt); r.bold = bold; r.italic = italic
    if color: r.font.color.rgb = RGBColor(*color)
    if size: r.font.size = Pt(size)
    return p

par('Hay DOS documentos de importacion, uno por tipo de persona. Importelos en formularios '
    'SEPARADOS para que no se mezclen los campos:', bold=True)
par('• Forms_Importar_PersonaJuridica.docx  ->  formulario "Registro SAGRILAFT — Persona Juridica"')
par('• Forms_Importar_PersonaNatural.docx   ->  formulario "Registro SAGRILAFT — Persona Natural"')

g.add_heading('Paso 1 — Importar', level=1)
par('En Microsoft Forms: Nuevo formulario  ->  Importacion rapida  ->  Cargar desde este dispositivo  '
    '->  elija el .docx  ->  importar como "Formulario". Repita con el otro archivo en un formulario nuevo.')
par('El importador detecta: Titulo (nombre/seccion), Encabezado 1 (pregunta) y Encabezado 2 (opciones). '
    'Solo crea preguntas de Opcion y de Texto; el resto se ajusta a mano en los pasos siguientes.', italic=True)

g.add_heading('Como funciona el importador (expectativa realista)', level=1)
par('El importador de Forms usa IA (por eso marca "Resultado de conversion incierto"). NO respeta de '
    'forma fiable la jerarquia de secciones de un documento grande y agrupa las preguntas a su criterio. '
    'Lo que SI hace bien: crear cada pregunta de OPCION con sus opciones. Las preguntas de TEXTO se '
    'marcaron con una linea "____" para que NO se fusionen entre si.')
par('Por eso el flujo correcto es: 1) importar para meter el TEXTO de las preguntas rapido, '
    '2) reorganizar las SECCIONES a mano (Paso 3d), 3) convertir tipos y dropdowns (Paso 3), '
    '4) configurar ramificacion (Paso 4). El importador ahorra el tecleo; la estructura se afina en Forms.', bold=True)

g.add_heading('Paso 2 — Marcar obligatorias', level=1)
par('Todas las preguntas que terminan en " *" deben marcarse como Obligatorias en Forms '
    '(el importador no transfiere esa propiedad).')

g.add_heading('Paso 3 — Convertir tipos que el importador no soporta', level=1)
par('a) FECHAS — quedaron como texto. Conviertalas a pregunta tipo "Fecha":', bold=True)
fechas = set()
for sec in SECCIONES:
    numj, tit, nota, campos = unpack(sec)
    for f in campos:
        if f['t'] == 'date':
            fechas.add(f['es'])
for x in sorted(fechas):
    par('   - ' + x)

par('b) CARGAS DE ARCHIVO (Seccion 14) — el importador NO las crea. Agreguelas a mano '
    'como preguntas tipo "Carga de archivos" (PDF, 10 MB):', bold=True)
for sec in SECCIONES:
    numj, tit, nota, campos = unpack(sec)
    if numj == '14':
        for f in campos:
            ap = '' if f['aplica'] == 'Ambos' else ('  [%s]' % f['aplica'])
            par('   - %s%s' % (f['es'], ap))

par('c) CATALOGOS GRANDES — quedaron como texto abierto. Si quiere lista desplegable, '
    'conviertalas a "Opcion" y active el formato desplegable (Mas opciones ... -> Lista desplegable):', bold=True)
par('   - Pais (247), Departamento, Ciudad (1174), CIIU (504): se recomienda dejar como texto '
    'o usar una lista corta de los mas frecuentes.')
par('   - Entidad bancaria (%d bancos) y Moneda (%d): pueden ir como Opcion (desplegable).'
    % (len(CAT['bancos']), len(CAT['monedas'])))

par('d) SECCIONES — el importador no respeta la jerarquia. Reorganicelas a mano:', bold=True)
par('   1. En el documento, cada bloque empieza con una linea "Seccion: N. Titulo" que le indica '
    'donde inicia cada seccion (aunque Forms no siempre la convierta en seccion real).')
par('   2. En Forms, use "Agregar nueva seccion" para crear las 14 secciones y arrastre las preguntas '
    'a la seccion que corresponde, siguiendo el orden del Excel y de las lineas "Seccion:" del documento.')
par('   3. Borre las preguntas-basura que el importador haya creado a partir de las lineas "Seccion:" '
    'o de las lineas "____".')

g.add_heading('Paso 4 — Ramificacion (mostrar/ocultar)', level=1)
par('Forms permite "Ramificacion" (Bifurcacion) solo sobre preguntas de Opcion. Configure estas reglas '
    'manualmente (Mas opciones de pregunta  ->  Agregar ramificacion):')
for sec in SECCIONES:
    numj, tit, nota, campos = unpack(sec)
    reglas = [f for f in campos if f['cond'] and 'Cascada' not in f['cond'] and 'Controla' not in f['cond'] and 'Bloquea' not in f['cond']]
    if reglas:
        par('Seccion %s — %s:' % (numj, tit), bold=True)
        for f in reglas:
            par('   - "%s"  ->  %s' % (f['es'], f['cond']))

g.add_heading('Paso 5 — Agregar mas registros (secciones repetibles)', level=1)
par('Forms no repite grupos automaticamente. Cada documento YA trae varios bloques numerados '
    '(p. ej. "Accionista 1", "Accionista 2"...). Para agregar MAS, duplique un bloque en Forms con el '
    'boton Copiar de cada pregunta y cambie el numero. Bloques repetibles incluidos:')
for k, (singular, copias) in REPEAT.items():
    nombre = next((unpack(s)[1] for s in SECCIONES if unpack(s)[0] == k), k)
    par('   - Seccion %s (%s): %d bloques incluidos' % (k, nombre, copias))

g.add_heading('Limitaciones que no se pueden replicar en Forms', level=1)
par('• Cascada dependiente Pais > Departamento > Ciudad (en Forms son listas independientes o texto).')
par('• Iconos de informacion (i): paselos al "Subtitulo" de cada pregunta si los necesita.')
par('• Calculo automatico del Patrimonio (Activos - Pasivos): en Forms se captura manualmente.')
par('• El detalle completo de cada campo esta en el Excel "Inventario_Formulario_SAGRILAFT.xlsx".')

gpath = os.path.join(OUT, "Forms_Guia_Post_Importacion.docx")
g.save(gpath)
print("Guia:", gpath)

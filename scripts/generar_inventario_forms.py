# -*- coding: utf-8 -*-
"""
Genera el inventario de TRABAJO (Excel) del Formulario SAGRILAFT.
Una hoja por seccion, con el detalle completo de cada campo y su equivalente en MS Forms.
Fuente de datos unica: forms_data.py
(Los documentos import-ready para Forms los genera generar_forms_import.py)
"""
import os
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from forms_data import CAT, FORMS, SECCIONES, unpack

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(BASE, 'Exportacion_MicrosoftForms')
os.makedirs(OUT, exist_ok=True)

wb = Workbook()
ACCENT = "00897B"; HEAD = "00695C"; LIGHT = "E0F2F1"
thin = Side(style='thin', color='B0BEC5')
border = Border(left=thin, right=thin, top=thin, bottom=thin)

ws0 = wb.active; ws0.title = "Guia"
ws0['A1'] = "Inventario del Formulario SAGRILAFT — Mapa para Microsoft Forms"
ws0['A1'].font = Font(size=14, bold=True, color=HEAD)
guia = [
 "", "Como usar este archivo:",
 "  - Una hoja por seccion del formulario.",
 "  - 'Tipo en MS Forms' = tipo de pregunta a crear en Microsoft Forms.",
 "  - 'Aplica a' = Ambos / Juridica / Natural (segun 'Tipo de persona' de la Seccion 1).",
 "  - 'Logica condicional' = reglas de mostrar/ocultar (Ramificacion en Forms).",
 "",
 "Para IMPORTAR a Forms use los documentos Word:",
 "  - Forms_Importar_PersonaJuridica.docx",
 "  - Forms_Importar_PersonaNatural.docx",
 "  y siga Forms_Guia_Post_Importacion.docx.",
 "",
 "Limitaciones de Microsoft Forms:",
 "  - La importacion rapida solo crea preguntas de Opcion y de Texto.",
 "  - Fechas, cargas de archivo y desplegables dependientes se ajustan a mano.",
 "  - Catalogos grandes (247 paises, 1174 ciudades, 504 CIIU): texto o lista corta.",
 "  - Grupos repetibles: se replican bloques numerados (Accionista 1, 2, 3...).",
]
for i, line in enumerate(guia, start=2):
    ws0.cell(row=i, column=1, value=line)
ws0.column_dimensions['A'].width = 95

COLS = ["#", "Campo (ES)", "Campo (EN)", "Tipo de control", "Oblig.",
        "Opciones / Catalogo", "Ayuda (icono i)", "Logica condicional / visibilidad",
        "Aplica a", "Tipo en MS Forms"]
WIDTHS = [4, 40, 32, 16, 7, 50, 45, 42, 11, 30]

for sec in SECCIONES:
    num, titulo, nota, campos = unpack(sec)
    sheet = ("S%s %s" % (num, titulo))[:31]
    for ch in '/\\?*[]:':
        sheet = sheet.replace(ch, '-')
    ws = wb.create_sheet(title=sheet)
    ws['A1'] = "SECCION %s — %s" % (num, titulo)
    ws['A1'].font = Font(size=13, bold=True, color="FFFFFF")
    ws['A1'].fill = PatternFill("solid", fgColor=HEAD)
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(COLS))
    ws.row_dimensions[1].height = 22
    r = 2
    if nota:
        ws.cell(row=r, column=1, value="Nota: " + nota)
        ws.cell(row=r, column=1).font = Font(italic=True, color="00695C", size=9)
        ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=len(COLS))
        ws.row_dimensions[r].height = 28
        ws.cell(row=r, column=1).alignment = Alignment(wrap_text=True, vertical='center')
        r += 1
    hr = r
    for c, name in enumerate(COLS, start=1):
        cell = ws.cell(row=hr, column=c, value=name)
        cell.font = Font(bold=True, color="FFFFFF", size=9)
        cell.fill = PatternFill("solid", fgColor=ACCENT)
        cell.alignment = Alignment(wrap_text=True, vertical='center', horizontal='center')
        cell.border = border
    r = hr + 1
    for i, f in enumerate(campos, start=1):
        vals = [i, f['es'], f['en'], FORMS[f['t']], "Si" if f['req'] else "No",
                f['opts'], f['tip'], f['cond'], f['aplica'], FORMS[f['t']]]
        for c, v in enumerate(vals, start=1):
            cell = ws.cell(row=r, column=c, value=v)
            cell.alignment = Alignment(wrap_text=True, vertical='top')
            cell.border = border
            cell.font = Font(size=9)
            if c == 5 and f['req']:
                cell.font = Font(size=9, bold=True, color="C62828")
        if i % 2 == 0:
            for c in range(1, len(COLS)+1):
                ws.cell(row=r, column=c).fill = PatternFill("solid", fgColor=LIGHT)
        r += 1
    for c, w in enumerate(WIDTHS, start=1):
        ws.column_dimensions[get_column_letter(c)].width = w
    ws.freeze_panes = ws.cell(row=hr+1, column=1)

xlsx_path = os.path.join(OUT, "Inventario_Formulario_SAGRILAFT.xlsx")
wb.save(xlsx_path)
print("Excel:", xlsx_path)

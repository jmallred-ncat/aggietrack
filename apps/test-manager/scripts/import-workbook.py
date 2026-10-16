"""Read a test-plan workbook into a portable seed; never execute workbook content.

Usage: python import-workbook.py /path/to/workbook.xlsx
Requires openpyxl. Runtime app does not require Python or the original workbook.
"""
import datetime
import json
import pathlib
import sys
import openpyxl

source = pathlib.Path(sys.argv[1])
workbook = openpyxl.load_workbook(source, data_only=False)
sections = []
for sheet in workbook:
    headers = [str(cell.value) for cell in sheet[4] if cell.value is not None]
    rows = []
    for index, cells in enumerate(sheet.iter_rows(min_row=5), 5):
        if cells[0].value is None:
            continue
        values = {}
        for header, cell in zip(headers, cells):
            value = cell.value
            if cell.data_type == "f":
                continue  # Coverage formulas become live application calculations.
            if isinstance(value, (datetime.datetime, datetime.date)):
                value = value.isoformat()[:10]
            values[header] = "" if value is None else str(value)
        rows.append({"id": str(cells[0].value), "sourceRow": index, "values": values})
    sections.append({"name": sheet.title, "headers": headers, "rows": rows})
output = pathlib.Path(__file__).resolve().parents[1] / "data/workbook.json"
output.write_text(json.dumps({"source": source.name, "sections": sections}, indent=2))
print({s["name"]: len(s["rows"]) for s in sections})

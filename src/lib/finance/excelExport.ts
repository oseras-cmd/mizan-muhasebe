/**
 * Excel dışa aktarma yardımcısı.
 * Bağımlılık gerektirmeden, Excel'in doğrudan açabildiği
 * SpreadsheetML 2003 XML (.xls) formatında dosya üretir.
 */

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type CellValue = string | number;

/** Satırları Excel çalışma sayfası olarak .xls indirir. */
export function downloadExcel(
  filename: string,
  sheetName: string,
  rows: CellValue[][],
): void {
  const body = rows
    .map(
      (row) =>
        `   <Row>${row
          .map((cell) =>
            typeof cell === "number" && Number.isFinite(cell)
              ? `<Cell><Data ss:Type="Number">${cell}</Data></Cell>`
              : `<Cell><Data ss:Type="String">${xmlEscape(String(cell ?? ""))}</Data></Cell>`,
          )
          .join("")}</Row>`,
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="${xmlEscape(sheetName)}">
  <Table>
${body}
  </Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob(["\uFEFF" + xml], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

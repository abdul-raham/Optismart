/**
 * Optismart Export & Report Utilities
 * Solves CSV / Excel encoding (UTF-8 BOM), formatting, formula injection, and cell alignment issues.
 */

export interface ExportColumnDef {
  header: string
  key: string
  isCurrency?: boolean
  isNumber?: boolean
  isDate?: boolean
}

export interface ExportExcelOptions {
  filename: string
  sheetTitle?: string
  reportSubHeading?: string
  data: Record<string, any>[]
  columns?: ExportColumnDef[]
}

/**
 * Clean string value for CSV / Excel to prevent formula injection and formatting errors.
 */
function sanitizeValue(val: any): string {
  if (val === null || val === undefined) return ''
  let str = String(val).trim()
  // Formula injection defense: escape leading =, +, -, @, \t, \r
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str
  }
  return str
}

/**
 * Format raw numbers cleanly for Excel table display
 */
function formatExcelCell(val: any): { display: string; align: 'left' | 'right' | 'center' } {
  if (val === null || val === undefined) {
    return { display: '—', align: 'center' }
  }
  if (typeof val === 'number') {
    return {
      display: new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(val),
      align: 'right',
    }
  }
  const str = sanitizeValue(val)
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return { display: str, align: 'center' }
  }
  return { display: str, align: 'left' }
}

/**
 * Export data as a beautifully formatted Excel File (.xls XML/HTML format).
 * Opens natively in Microsoft Excel, Apple Numbers, WPS, and Google Sheets with:
 * - Proper UTF-8 BOM encoding (Naira ₦ symbol intact)
 * - Styled header bar & table headers
 * - Gridlines enabled explicitly
 * - Zebra-striped rows & cell borders
 * - Proper right alignment for numeric/currency columns
 */
export function exportToExcel({
  filename,
  sheetTitle = 'Optismart Report',
  reportSubHeading,
  data,
}: ExportExcelOptions) {
  if (!data || data.length === 0) return

  const keys = Object.keys(data[0])
  const dateStr = new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(new Date())

  // Generate Excel XML / HTML Spreadsheet
  let html = `\uFEFF<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<!--[if gte mso 9]>
<xml>
 <x:ExcelWorkbook>
  <x:ExcelWorksheets>
   <x:ExcelWorksheet>
    <x:Name>${sheetTitle.replace(/[\/\\?*:[\]]/g, ' ')}</x:Name>
    <x:WorksheetOptions>
     <x:DisplayGridlines/>
    </x:WorksheetOptions>
   </x:ExcelWorksheet>
  </x:ExcelWorksheets>
 </x:ExcelWorkbook>
</xml>
<![endif]-->
<style>
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 13px; color: #1E293B; }
  .report-header { background-color: #0F172A; color: #FFFFFF; padding: 16px; margin-bottom: 12px; }
  .report-title { font-size: 18px; font-weight: bold; margin: 0; color: #38BDF8; }
  .report-meta { font-size: 11px; color: #94A3B8; margin-top: 4px; }
  table { border-collapse: collapse; width: 100%; margin-top: 10px; }
  th { background-color: #1E293B; color: #FFFFFF; font-weight: bold; text-align: left; padding: 10px 12px; border: 1px solid #475569; font-size: 12px; }
  td { padding: 8px 12px; border: 1px solid #CBD5E1; font-size: 12px; vertical-align: middle; }
  tr:nth-child(even) td { background-color: #F8FAFC; }
  .num { text-align: right; font-family: 'Consolas', 'Courier New', monospace; }
  .center { text-align: center; }
  .footer { margin-top: 16px; font-size: 11px; color: #64748B; font-style: italic; }
</style>
</head>
<body>
  <div class="report-header">
    <div class="report-title">OPTISMART &bull; ${sheetTitle}</div>
    <div class="report-meta">Generated: ${dateStr} ${reportSubHeading ? `| ${reportSubHeading}` : ''}</div>
  </div>
  <table>
    <thead>
      <tr>
        ${keys
          .map(
            (k) =>
              `<th style="${
                /amount|revenue|price|commission|paid|net|total|cameras|orders/i.test(k)
                  ? 'text-align: right;'
                  : ''
              }">${k}</th>`
          )
          .join('')}
      </tr>
    </thead>
    <tbody>
`

  data.forEach((row) => {
    html += '<tr>'
    keys.forEach((k) => {
      const val = row[k]
      const isNumKey = /amount|revenue|price|commission|paid|net|total|cameras|orders|quantity|qty/i.test(k)
      const { display, align } = formatExcelCell(val)
      const finalAlign = isNumKey ? 'right' : align

      html += `<td style="text-align: ${finalAlign};" ${
        typeof val === 'number' ? 'x:num' : ''
      }>${display}</td>`
    })
    html += '</tr>'
  })

  html += `
    </tbody>
  </table>
  <div class="footer">Confidential Optismart System Report &bull; Total Records: ${data.length}</div>
</body>
</html>`

  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.xls`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Export data as clean, UTF-8 BOM encoded CSV File (.csv).
 * Ensures Excel opens CSV without converting ₦ (Naira) into garbled characters.
 */
export function exportToCSV(data: Record<string, any>[], filename: string) {
  if (!data || data.length === 0) return

  const keys = Object.keys(data[0])

  const escapeCSV = (val: any) => {
    if (val === null || val === undefined) return '""'
    let str = String(val)
    // Formula injection defense
    if (/^[=+\-@\t\r]/.test(str)) {
      str = "'" + str
    }
    return `"${str.replace(/"/g, '""')}"`
  }

  const header = keys.map(escapeCSV).join(',')
  const rows = data.map((row) => keys.map((k) => escapeCSV(row[k])).join(','))

  // \uFEFF is UTF-8 Byte Order Mark (BOM)
  const csvContent = '\uFEFF' + [header, ...rows].join('\r\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Print window trigger for print-friendly report rendering
 */
export function triggerPrintReport() {
  window.print()
}

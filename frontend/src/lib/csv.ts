function escapeCell(value: string | number) {
  const s = String(value ?? '')
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** ";" separator — the delimiter Excel's pt-BR locale expects for CSV import. */
export function toCsv(rows: (string | number)[][]) {
  return rows.map((row) => row.map(escapeCell).join(';')).join('\n')
}

/** UTF-8 BOM so Excel renders acentos correctly instead of mojibake. */
export function downloadCsv(filename: string, content: string) {
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Client-side CSV generation and download utility.
 */

/**
 * Escapes a cell value for standard CSV format (RFC 4180).
 */
function formatCsvCell(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Converts an array of objects into CSV string and triggers a browser download.
 * @param {Array<Object>} data - Array of data rows
 * @param {Array<{ key: string, label: string }>} columns - Column definitions
 * @param {string} filename - Output filename (without .csv)
 */
export function exportToCsv(data = [], columns = [], filename = 'export') {
  if (!data || !data.length) {
    throw new Error('No data available to export.');
  }

  const headerRow = columns.map(c => formatCsvCell(c.label)).join(',');
  const rows = data.map(row => {
    return columns.map(col => {
      const val = typeof col.accessor === 'function' ? col.accessor(row) : row[col.key];
      return formatCsvCell(val);
    }).join(',');
  });

  const csvContent = [headerRow, ...rows].join('\r\n');
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

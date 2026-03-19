import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { COMMON_MESSAGES } from '../../messages/commonMessages';

const REPORTS_DIR = `${FileSystem.documentDirectory}reports/`;

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const ensureReportsDir = async () => {
  const info = await FileSystem.getInfoAsync(REPORTS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(REPORTS_DIR, { intermediates: true });
  }
};

const buildHtml = ({ title, subtitle, metaLines = [], totals = [], rows = [] }) => {
  const now = new Date().toLocaleString();
  const metaItems = [`Generated: ${now}`, ...metaLines]
    .map((line) => `<div class="meta-item">${escapeHtml(line)}</div>`)
    .join('');

  const totalsHtml = totals.length > 0
    ? `<div class="totals">${totals
      .map(
        (item) => `
          <div class="total-card">
            <div class="total-label">${escapeHtml(item.label)}</div>
            <div class="total-value">${escapeHtml(item.value)}</div>
          </div>
        `
      )
      .join('')}</div>`
    : '';

  const tableRows = rows.length > 0
    ? rows
      .map(
        (row, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(row.label)}</td>
            <td>${escapeHtml(row.value)}</td>
          </tr>
        `
      )
      .join('')
    : `
      <tr>
        <td colspan="3" class="empty-row">No data available.</td>
      </tr>
    `;

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            color: #1f2937;
            padding: 20px 24px;
          }
          h1 {
            margin: 0 0 6px;
            color: #4f46e5;
            font-size: 24px;
          }
          .subtitle {
            margin: 0 0 14px;
            color: #6b7280;
            font-size: 14px;
          }
          .meta {
            margin: 0 0 16px;
            color: #6b7280;
            font-size: 12px;
          }
          .meta-item {
            margin-bottom: 2px;
          }
          .totals {
            margin: 14px 0 18px;
          }
          .total-card {
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 10px 12px;
            margin-bottom: 8px;
            background: #f8fafc;
          }
          .total-label {
            color: #6b7280;
            font-size: 12px;
            margin-bottom: 4px;
          }
          .total-value {
            color: #111827;
            font-size: 16px;
            font-weight: 700;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
          }
          th, td {
            border: 1px solid #e5e7eb;
            padding: 8px;
            text-align: left;
            vertical-align: top;
          }
          th {
            background: #f3f4f6;
            color: #374151;
            font-weight: 600;
          }
          .empty-row {
            text-align: center;
            color: #6b7280;
            padding: 20px;
          }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        <p class="subtitle">${escapeHtml(subtitle)}</p>
        <div class="meta">${metaItems}</div>
        ${totalsHtml}
        <table>
          <thead>
            <tr>
              <th style="width: 52px;">#</th>
              <th>Item</th>
              <th style="width: 180px;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </body>
    </html>
  `;
};

export const exportSummaryReportPdf = async ({
  title,
  subtitle,
  metaLines = [],
  totals = [],
  rows = [],
  fileName = 'report',
}) => {
  try {
    // Avoid oversized HTML payloads on lower-memory devices.
    const safeRows = rows.slice(0, 300);
    const html = buildHtml({ title, subtitle, metaLines, totals, rows: safeRows });
    const printResult = await Print.printToFileAsync({ html });

    if (Platform.OS === 'web') {
      return { success: true, uri: printResult.uri, message: COMMON_MESSAGES.PDF_EXPORT_SUCCESS };
    }

    await ensureReportsDir();
    const safeFileName = fileName.replace(/[^a-zA-Z0-9-_]/g, '_');
    const finalUri = `${REPORTS_DIR}${safeFileName}.pdf`;
    await FileSystem.copyAsync({ from: printResult.uri, to: finalUri });

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(finalUri, {
        mimeType: 'application/pdf',
        dialogTitle: title,
        UTI: 'com.adobe.pdf',
      });
      return { success: true, uri: finalUri, message: COMMON_MESSAGES.PDF_EXPORT_SUCCESS };
    }

    // Fallback for devices where share sheet is not available.
    await Print.printAsync({ uri: finalUri });
    return {
      success: true,
      uri: finalUri,
      message: COMMON_MESSAGES.PDF_EXPORT_SUCCESS,
    };
  } catch (error) {
    const message = error?.message || 'Unknown PDF export error';
    console.error('PDF export error:', message, error);
    return { success: false, message };
  }
};

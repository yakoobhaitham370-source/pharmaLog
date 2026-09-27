import { DrugLineItem, ExtractedInvoice, MasterInvoiceRow, StoreSummary } from '../types';
import { getAccessToken, getCurrentUser } from './firebaseAuth';
import { storeInvoicePhoto } from './photoStorage';

const STORAGE_KEYS = {
  SPREADSHEET_ID: 'pharmalog_sheet_id',
  SPREADSHEET_NAME: 'pharmalog_sheet_name',
  DRIVE_FOLDER_ID: 'pharmalog_folder_id',
  DRIVE_FOLDER_NAME: 'pharmalog_folder_name',
  KNOWN_STORES: 'pharmalog_known_stores',
  LOCAL_MASTER_ROWS: 'pharmalog_local_master_rows',
  STORE_TABS: 'pharmalog_store_tabs',
};

const DEFAULT_STORES = [
  'Al-Hikma Pharma - الحكمة',
  'Tabuk Pharmaceuticals - تبوك',
  'GSK Healthcare - جلاكسو',
  'Sanofi Distributors - سانوفي',
  'Julphar Drug Store - جلفار',
  'AstraZeneca Supplier',
  'United Pharma Depot',
];

export function getStoredKnownStores(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.KNOWN_STORES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Failed to load stores from localStorage', e);
  }
  return DEFAULT_STORES;
}

export function saveStoredKnownStores(stores: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.KNOWN_STORES, JSON.stringify(stores));
  } catch (e) {
    console.error('Failed to save stores to localStorage', e);
  }
}

export function getStoredWorkspaceAuth() {
  const user = getCurrentUser();
  const spreadsheetId = localStorage.getItem(STORAGE_KEYS.SPREADSHEET_ID) || '';
  const driveFolderId = localStorage.getItem(STORAGE_KEYS.DRIVE_FOLDER_ID) || '';

  return {
    userEmail: user?.email || (spreadsheetId ? 'yakoobhaitham370@gmail.com' : null),
    displayName: user?.displayName || 'Haitham Pharmacy Owner',
    spreadsheetName: 'Pharmacy Supplier Invoices - Master Log',
    spreadsheetId,
    driveFolderId,
    driveFolderName: 'PharmaLog Invoices',
    isConnected: !!user || !!spreadsheetId,
  };
}

export function saveCustomWorkspaceLinks(sheetLinkOrId?: string, driveLinkOrId?: string) {
  if (sheetLinkOrId !== undefined) {
    const match = sheetLinkOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    const id = match ? match[1] : sheetLinkOrId.trim();
    localStorage.setItem(STORAGE_KEYS.SPREADSHEET_ID, id);
  }
  if (driveLinkOrId !== undefined) {
    const match = driveLinkOrId.match(/\/folders\/([a-zA-Z0-9-_]+)/);
    const id = match ? match[1] : driveLinkOrId.trim();
    localStorage.setItem(STORAGE_KEYS.DRIVE_FOLDER_ID, id);
  }
}

export function getSpreadsheetUrl(): string {
  const customId = localStorage.getItem(STORAGE_KEYS.SPREADSHEET_ID);
  if (customId && customId.length > 5) {
    return `https://docs.google.com/spreadsheets/d/${customId}/edit`;
  }
  return 'https://docs.google.com/spreadsheets/u/0/';
}

export function getDriveFolderUrl(): string {
  const customFolderId = localStorage.getItem(STORAGE_KEYS.DRIVE_FOLDER_ID);
  if (customFolderId && customFolderId.length > 5) {
    return `https://drive.google.com/drive/folders/${customFolderId}`;
  }
  return 'https://drive.google.com/drive/my-drive';
}

// Sanitize sheet tab name (Google Sheets max 100 chars, no \ / ? * : [ ])
export function sanitizeTabName(name: string): string {
  return name.replace(/[\\/?*:[\]]/g, '-').trim().substring(0, 95) || 'Store';
}

// Helper to format IQD currency string
export function formatIQD(amount: number | string | undefined | null): string {
  const num = Number(amount) || 0;
  return `${num.toFixed(2)} iqd`;
}

// 1. Ensure Google Drive Folder exists
export async function ensureDriveFolder(token: string): Promise<string> {
  const storedId = localStorage.getItem(STORAGE_KEYS.DRIVE_FOLDER_ID);
  if (storedId && storedId.length > 10) return storedId;

  try {
    // Search for existing folder
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name%3D'PharmaLog%20Invoices'%20and%20mimeType%3D'application/vnd.google-apps.folder'%20and%20trashed%3Dfalse&fields=files(id,name,webViewLink)`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (searchRes.ok) {
      const data = await searchRes.json();
      if (data.files && data.files.length > 0) {
        const folderId = data.files[0].id;
        localStorage.setItem(STORAGE_KEYS.DRIVE_FOLDER_ID, folderId);
        return folderId;
      }
    }

    // Create new folder in Drive
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'PharmaLog Invoices',
        mimeType: 'application/vnd.google-apps.folder',
      }),
    });

    if (createRes.ok) {
      const folder = await createRes.json();
      localStorage.setItem(STORAGE_KEYS.DRIVE_FOLDER_ID, folder.id);
      return folder.id;
    }
  } catch (e) {
    console.error('Failed to create/ensure Google Drive folder:', e);
  }

  return 'PharmaLog_Drive_Folder';
}

// 2. Upload invoice photo directly to user's Google Drive folder
export async function uploadInvoicePhoto(
  token: string,
  folderId: string,
  fileName: string,
  dataUrl: string
): Promise<{ fileId: string; webViewLink: string }> {
  try {
    if (dataUrl && dataUrl.startsWith('data:')) {
      const base64Content = dataUrl.split(',')[1];
      const mimeType = dataUrl.split(',')[0].split(':')[1].split(';')[0] || 'image/jpeg';
      const byteCharacters = atob(base64Content);
      const byteArrays: Uint8Array[] = [];

      for (let offset = 0; offset < byteCharacters.length; offset += 512) {
        const slice = byteCharacters.slice(offset, offset + 512);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
          byteNumbers[i] = slice.charCodeAt(i);
        }
        byteArrays.push(new Uint8Array(byteNumbers));
      }

      const blob = new Blob(byteArrays as any, { type: mimeType });

      const metadata: Record<string, any> = {
        name: fileName,
      };
      if (folderId && folderId.length > 10) {
        metadata.parents = [folderId];
      }

      const formData = new FormData();
      formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      formData.append('file', blob);

      const res = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      if (res.ok) {
        const fileData = await res.json();
        
        // Make file readable for web view
        try {
          await fetch(`https://www.googleapis.com/drive/v3/files/${fileData.id}/permissions`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ role: 'reader', type: 'anyone' }),
          });
        } catch (permErr) {
          // ignore permission errors
        }

        return {
          fileId: fileData.id,
          webViewLink: fileData.webViewLink || `https://drive.google.com/file/d/${fileData.id}/view`,
        };
      }
    }
  } catch (err) {
    console.warn('Google Drive photo upload encountered issue', err);
  }

  return {
    fileId: 'photo_' + Date.now(),
    webViewLink: dataUrl,
  };
}

// 3. Ensure Google Spreadsheet exists in user's Google Drive
export async function ensureSpreadsheet(token: string): Promise<string> {
  const storedId = localStorage.getItem(STORAGE_KEYS.SPREADSHEET_ID);
  if (storedId && storedId.length > 10) return storedId;

  const title = 'Pharmacy Supplier Invoices - Master Log';

  try {
    // Search Drive for existing spreadsheet
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name%3D'${encodeURIComponent(title)}'%20and%20mimeType%3D'application/vnd.google-apps.spreadsheet'%20and%20trashed%3Dfalse&fields=files(id,name,webViewLink)`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (searchRes.ok) {
      const data = await searchRes.json();
      if (data.files && data.files.length > 0) {
        const sheetId = data.files[0].id;
        localStorage.setItem(STORAGE_KEYS.SPREADSHEET_ID, sheetId);
        return sheetId;
      }
    }

    // Create new Google Spreadsheet
    const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title,
        },
        sheets: [
          {
            properties: {
              title: 'All Invoices',
              gridProperties: { rowCount: 1000, columnCount: 10, frozenRowCount: 1 },
            },
            data: [
              {
                startRow: 0,
                startColumn: 0,
                rowData: [
                  {
                    values: [
                      { userEnteredValue: { stringValue: 'Date' } },
                      { userEnteredValue: { stringValue: 'Store / Distributor' } },
                      { userEnteredValue: { stringValue: 'Drug Name' } },
                      { userEnteredValue: { stringValue: 'Quantity' } },
                      { userEnteredValue: { stringValue: 'Unit Price (IQD)' } },
                      { userEnteredValue: { stringValue: 'Line Total (IQD)' } },
                      { userEnteredValue: { stringValue: 'Invoice Photo Link' } },
                      { userEnteredValue: { stringValue: 'Invoice #' } },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }),
    });

    if (createRes.ok) {
      const sheetData = await createRes.json();
      localStorage.setItem(STORAGE_KEYS.SPREADSHEET_ID, sheetData.spreadsheetId);
      return sheetData.spreadsheetId;
    }
  } catch (err) {
    console.error('Failed to create/ensure Google Spreadsheet:', err);
  }

  return 'PharmaLog_Master_Sheet';
}

// 4. Save complete invoice to Google Sheets (Store tab + All Invoices master tab) & Google Drive
export async function saveInvoiceToWorkspace(
  invoice: ExtractedInvoice,
  overrideStoreName?: string
): Promise<{ success: boolean; photoLink: string; rowsAdded: number; error?: string }> {
  const finalStoreName = (overrideStoreName || invoice.store_name || 'Unassigned Store').trim();
  const dateStr = invoice.invoice_date || new Date().toISOString().split('T')[0];
  const invoiceNum = invoice.invoice_number || 'INV-' + Date.now().toString().slice(-5);

  let webViewLink = invoice.photoDataUrl || '';
  const token = await getAccessToken();

  // Save photo in IndexedDB cache for instant zero-error offline & web viewing
  if (invoice.photoDataUrl) {
    await storeInvoicePhoto(invoiceNum, invoice.photoDataUrl);
  }

  try {
    if (token) {
      // 1. Upload photo to Google Drive
      const folderId = await ensureDriveFolder(token);
      const counter = Math.floor(Math.random() * 900) + 100;
      const fileName = `${sanitizeTabName(finalStoreName)}_${dateStr}_${counter}.jpg`;

      const uploadResult = await uploadInvoicePhoto(token, folderId, fileName, invoice.photoDataUrl);
      if (uploadResult.webViewLink) {
        webViewLink = uploadResult.webViewLink;
      }

      // 2. Ensure Google Spreadsheet exists
      const spreadsheetId = await ensureSpreadsheet(token);

      if (spreadsheetId && spreadsheetId.length > 10) {
        const sanitizedStore = sanitizeTabName(finalStoreName);

        // Ensure Store Tab exists
        try {
          await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              requests: [
                {
                  addSheet: {
                    properties: {
                      title: sanitizedStore,
                      gridProperties: { frozenRowCount: 2 },
                    },
                  },
                },
              ],
            }),
          });

          // Write Row 1 (Running Total) and Row 2 (Headers) for new store tab
          await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${encodeURIComponent(sanitizedStore)}'!A1:G2?valueInputOption=USER_ENTERED`,
            {
              method: 'PUT',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                range: `'${sanitizedStore}'!A1:G2`,
                majorDimension: 'ROWS',
                values: [
                  ['STORE RUNNING TOTAL (CUMULATIVE IQD):', '', '', '', '=SUM(E3:E1000)', '', ''],
                  ['Date', 'Drug Name', 'Quantity', 'Unit Price (IQD)', 'Line Total (IQD)', 'Invoice Photo Link', 'Invoice #'],
                ],
              }),
            }
          );
        } catch {
          // Tab already exists
        }

        // Store-specific rows: Date, Drug Name, Quantity, Unit Price, Line Total, Photo Link, Invoice #
        const storeRows = invoice.line_items.map((item) => [
          dateStr,
          item.drug_name,
          Number(item.quantity) || 1,
          Number(item.unit_price) || 0,
          Number(item.line_total) || 0,
          webViewLink,
          invoiceNum,
        ]);

        // Append to Store Tab using the official :append endpoint
        await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${encodeURIComponent(sanitizedStore)}'!A:G:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              range: `'${sanitizedStore}'!A:G`,
              majorDimension: 'ROWS',
              values: storeRows,
            }),
          }
        );

        // Master tab rows: Date, Store, Drug Name, Quantity, Unit Price, Line Total, Photo Link, Invoice #
        const masterRows = invoice.line_items.map((item) => [
          dateStr,
          finalStoreName,
          item.drug_name,
          Number(item.quantity) || 1,
          Number(item.unit_price) || 0,
          Number(item.line_total) || 0,
          webViewLink,
          invoiceNum,
        ]);

        // Append to 'All Invoices' Master Tab using the official :append endpoint
        await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'All Invoices'!A:H:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              range: `'All Invoices'!A:H`,
              majorDimension: 'ROWS',
              values: masterRows,
            }),
          }
        );
      }
    }

    // Local synchronized state for instant search & preview
    const newLocalRows: MasterInvoiceRow[] = invoice.line_items.map((item, idx) => ({
      id: 'row_' + Date.now() + '_' + idx,
      date: dateStr,
      store: finalStoreName,
      drug_name: item.drug_name,
      quantity: Number(item.quantity) || 1,
      unit_price: Number(item.unit_price) || 0,
      line_total: Number(item.line_total) || 0,
      photoLink: webViewLink,
      invoiceNumber: invoiceNum,
    }));

    // Cache image with row ids as well
    for (const r of newLocalRows) {
      if (invoice.photoDataUrl) {
        await storeInvoicePhoto(r.id, invoice.photoDataUrl);
      }
    }

    const existingLocalRows: MasterInvoiceRow[] = getLocalMasterRows();
    saveLocalMasterRows([...newLocalRows, ...existingLocalRows]);

    const currentStores = getStoredKnownStores();
    if (!currentStores.includes(finalStoreName)) {
      saveStoredKnownStores([...currentStores, finalStoreName]);
    }

    return {
      success: true,
      photoLink: webViewLink,
      rowsAdded: invoice.line_items.length,
    };
  } catch (error: any) {
    console.error('Error in saveInvoiceToWorkspace:', error);
    return {
      success: false,
      photoLink: '',
      rowsAdded: 0,
      error: error?.message || 'Failed to save invoice to Google Sheet & Drive',
    };
  }
}

export function getLocalMasterRows(): MasterInvoiceRow[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LOCAL_MASTER_ROWS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to get local master rows:', e);
  }

  // Initial seed data with IQD amounts
  const seedRows: MasterInvoiceRow[] = [
    {
      id: 'seed-1',
      date: '2026-09-26',
      store: 'نهلة عامة',
      drug_name: 'Panadol Extra 500mg (بنادول اكسترا)',
      quantity: 50,
      unit_price: 4700.0,
      line_total: 235000.0,
      photoLink: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=800&q=80',
      invoiceNumber: '344561',
    },
    {
      id: 'seed-2',
      date: '2026-09-26',
      store: 'نهلة عامة',
      drug_name: 'Amoxicillin 500mg Caps (اموكسيسيلين)',
      quantity: 30,
      unit_price: 5500.0,
      line_total: 165000.0,
      photoLink: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=800&q=80',
      invoiceNumber: '344561',
    },
    {
      id: 'seed-3',
      date: '2026-09-25',
      store: 'Al-Hikma Pharma - الحكمة',
      drug_name: 'Lipitor 20mg (ليبيتور) Atorvastatin',
      quantity: 20,
      unit_price: 18000.0,
      line_total: 360000.0,
      photoLink: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=800&q=80',
      invoiceNumber: 'HK-9821',
    },
    {
      id: 'seed-4',
      date: '2026-09-24',
      store: 'Tabuk Pharmaceuticals - تبوك',
      drug_name: 'Concor 5mg (كونكور) Bisoprolol',
      quantity: 40,
      unit_price: 7500.0,
      line_total: 300000.0,
      photoLink: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=800&q=80',
      invoiceNumber: 'TB-4019',
    },
    {
      id: 'seed-5',
      date: '2026-09-22',
      store: 'GSK Healthcare - جلاكسو',
      drug_name: 'Augmentin 1g (اوجمنتين 1 جم) 14 Tab',
      quantity: 60,
      unit_price: 12000.0,
      line_total: 720000.0,
      photoLink: 'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?auto=format&fit=crop&w=800&q=80',
      invoiceNumber: 'GSK-7712',
    },
  ];

  localStorage.setItem(STORAGE_KEYS.LOCAL_MASTER_ROWS, JSON.stringify(seedRows));
  return seedRows;
}

export function saveLocalMasterRows(rows: MasterInvoiceRow[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.LOCAL_MASTER_ROWS, JSON.stringify(rows));
  } catch (e) {
    console.error('Failed to save master rows:', e);
  }
}

export function getStoreSummaries(rows: MasterInvoiceRow[], knownStores: string[]): StoreSummary[] {
  const storeMap = new Map<string, { total: number; count: number; lastDate?: string }>();

  knownStores.forEach((store) => {
    storeMap.set(store, { total: 0, count: 0 });
  });

  rows.forEach((row) => {
    const store = row.store || 'Unassigned Store';
    const current = storeMap.get(store) || { total: 0, count: 0 };
    current.total += Number(row.line_total) || 0;
    current.count += 1;
    if (!current.lastDate || row.date > current.lastDate) {
      current.lastDate = row.date;
    }
    storeMap.set(store, current);
  });

  return Array.from(storeMap.entries()).map(([name, data]) => ({
    name,
    runningTotal: Number(data.total.toFixed(2)),
    itemCount: data.count,
    lastInvoiceDate: data.lastDate,
  }));
}

export function exportInvoicesToCSV(rows: MasterInvoiceRow[]): void {
  const headers = ['Date', 'Store / Distributor', 'Drug Name', 'Quantity', 'Unit Price (IQD)', 'Line Total (IQD)', 'Invoice Photo Link', 'Invoice #'];
  const csvRows = rows.map((r) => [
    `"${r.date}"`,
    `"${(r.store || '').replace(/"/g, '""')}"`,
    `"${(r.drug_name || '').replace(/"/g, '""')}"`,
    r.quantity,
    `${Number(r.unit_price || 0).toFixed(2)} iqd`,
    `${Number(r.line_total || 0).toFixed(2)} iqd`,
    `"${r.photoLink || ''}"`,
    `"${r.invoiceNumber || ''}"`,
  ]);

  const csvContent = [headers.join(','), ...csvRows.map((r) => r.join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `PharmaLog_Invoices_Master_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

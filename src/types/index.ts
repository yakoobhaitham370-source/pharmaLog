export interface DrugLineItem {
  id: string;
  drug_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  batch_number?: string;
  expiry_date?: string;
}

export interface ExtractedInvoice {
  store_name: string | null;
  invoice_date: string;
  invoice_number?: string;
  currency?: string;
  line_items: DrugLineItem[];
  total_amount?: number;
  notes?: string;
  photoDataUrl: string;
  photoFileName?: string;
}

export interface StoreSummary {
  name: string;
  runningTotal: number;
  itemCount: number;
  lastInvoiceDate?: string;
}

export interface MasterInvoiceRow {
  id: string;
  date: string;
  store: string;
  drug_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  photoLink: string;
  invoiceNumber?: string;
  rowNumber?: number;
}

export interface GoogleWorkspaceState {
  accessToken: string | null;
  tokenExpiry: number | null;
  userEmail: string | null;
  spreadsheetId: string | null;
  spreadsheetName: string;
  driveFolderId: string | null;
  driveFolderName: string;
  isConnected: boolean;
}

export interface BatchInvoiceItem {
  id: string;
  file: File;
  previewUrl: string;
  status: 'pending' | 'extracting' | 'extracted' | 'error' | 'saved';
  errorMessage?: string;
  extractedData?: ExtractedInvoice;
}

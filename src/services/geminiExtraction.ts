import { DrugLineItem, ExtractedInvoice } from '../types';

export interface ExtractionResponse {
  success: boolean;
  data?: ExtractedInvoice;
  error?: string;
}

export async function extractInvoiceFromImage(
  imageBase64: string,
  mimeType: string = 'image/jpeg',
  knownStores: string[] = []
): Promise<ExtractionResponse> {
  try {
    const res = await fetch('/api/extract-invoice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageBase64,
        mimeType,
        knownStores,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Server responded with status ${res.status}`);
    }

    const json = await res.json();
    if (!json.success || !json.data) {
      throw new Error(json.error || 'Invalid response from invoice extraction service');
    }

    const raw = json.data;

    // Normalize line items with unique IDs and clean numeric values
    const normalizedItems: DrugLineItem[] = (raw.line_items || []).map((item: any, idx: number) => {
      const qty = Math.max(1, Number(item.quantity) || 1);
      const price = Number(item.unit_price) || 0;
      const computedTotal = Number((item.line_total ?? (qty * price)).toFixed(2));

      return {
        id: 'line_' + Date.now() + '_' + idx,
        drug_name: (item.drug_name || 'Item ' + (idx + 1)).trim(),
        quantity: qty,
        unit_price: price,
        line_total: computedTotal,
        batch_number: item.batch_number || undefined,
        expiry_date: item.expiry_date || undefined,
      };
    });

    const totalAmount = raw.total_amount
      ? Number(raw.total_amount)
      : normalizedItems.reduce((sum, it) => sum + it.line_total, 0);

    const extractedInvoice: ExtractedInvoice = {
      store_name: raw.store_name || null,
      invoice_date: raw.invoice_date || new Date().toISOString().split('T')[0],
      invoice_number: raw.invoice_number || 'INV-' + Math.floor(10000 + Math.random() * 90000),
      currency: raw.currency || 'USD',
      line_items: normalizedItems,
      total_amount: Number(totalAmount.toFixed(2)),
      notes: raw.notes || '',
      photoDataUrl: imageBase64,
    };

    return {
      success: true,
      data: extractedInvoice,
    };
  } catch (err: any) {
    console.error('Invoice extraction failed:', err);
    return {
      success: false,
      error: err.message || 'Failed to extract invoice data with Gemini AI.',
    };
  }
}

// Convert image File or Blob to Base64 string with optional thumbnail compression
export async function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

// Sample realistic invoice generator for instant testing
export function generateSampleInvoicePhoto(storeName: string = 'Al-Hikma Pharma - الحكمة'): {
  dataUrl: string;
  mockData: ExtractedInvoice;
} {
  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = 1400;
  const ctx = canvas.getContext('2d')!;

  // Background - realistic invoice paper texture
  ctx.fillStyle = '#fcfcfc';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Border & header background
  ctx.fillStyle = '#0f766e';
  ctx.fillRect(40, 40, canvas.width - 80, 110);

  // Header Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText('PHARMACEUTICAL SUPPLIES INVOICE / فاتورة توريد أدوية', 70, 95);

  ctx.font = '20px sans-serif';
  ctx.fillText('Official Drug Distribution & Wholesale Branch', 70, 130);

  // Distributor Info box
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(40, 170, canvas.width - 80, 140);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(`Distributor / الموزع: ${storeName}`, 60, 215);

  const today = new Date().toISOString().split('T')[0];
  const invNum = 'HK-2026-' + Math.floor(1000 + Math.random() * 9000);

  ctx.font = '20px sans-serif';
  ctx.fillStyle = '#334155';
  ctx.fillText(`Date / التاريخ: ${today}`, 60, 260);
  ctx.fillText(`Invoice No / رقم الفاتورة: ${invNum}`, 550, 260);
  ctx.fillText(`Client: Community Pharmacy Branch #1`, 60, 292);
  ctx.fillText(`Payment Term: Supplier Delivery Credit`, 550, 292);

  // Table Header
  const startY = 340;
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(40, startY, canvas.width - 80, 45);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('#', 60, startY + 30);
  ctx.fillText('Drug Name & Strength / اسم الدواء', 110, startY + 30);
  ctx.fillText('Qty', 560, startY + 30);
  ctx.fillText('Unit Price ($)', 660, startY + 30);
  ctx.fillText('Total ($)', 820, startY + 30);

  // Sample items
  const items = [
    { name: 'Panadol Extra 500mg (بنادول اكسترا)', qty: 40, price: 3.2, total: 128.0, exp: '12/2028' },
    { name: 'Amoxicillin 500mg Caps (اموكسيسيلين)', qty: 25, price: 4.5, total: 112.5, exp: '09/2027' },
    { name: 'Augmentin 1g Tabs (اوجمنتين 1 جم)', qty: 50, price: 11.5, total: 575.0, exp: '06/2028' },
    { name: 'Concor 5mg (كونكور بيسوبرولول)', qty: 30, price: 6.8, total: 204.0, exp: '11/2028' },
    { name: 'Nexium 40mg (نيكسيوم اسوميبرازول)', qty: 20, price: 16.0, total: 320.0, exp: '04/2027' },
    { name: 'Cataflam 50mg (كتافلام مسكن)', qty: 45, price: 5.0, total: 225.0, exp: '08/2028' },
    { name: 'Ventolin Inhaler 100mcg (فنتولين بخاخ)', qty: 15, price: 7.5, total: 112.5, exp: '10/2027' },
  ];

  let currentY = startY + 50;
  let grandTotal = 0;

  items.forEach((item, index) => {
    ctx.fillStyle = index % 2 === 0 ? '#ffffff' : '#f8fafc';
    ctx.fillRect(40, currentY, canvas.width - 80, 50);

    ctx.strokeStyle = '#e2e8f0';
    ctx.strokeRect(40, currentY, canvas.width - 80, 50);

    ctx.fillStyle = '#1e293b';
    ctx.font = '18px sans-serif';
    ctx.fillText(`${index + 1}`, 60, currentY + 32);
    ctx.fillText(item.name, 110, currentY + 32);
    ctx.fillText(`${item.qty}`, 570, currentY + 32);
    ctx.fillText(`$${item.price.toFixed(2)}`, 680, currentY + 32);
    ctx.fillText(`$${item.total.toFixed(2)}`, 830, currentY + 32);

    grandTotal += item.total;
    currentY += 50;
  });

  // Grand Total Box
  currentY += 30;
  ctx.fillStyle = '#0f766e';
  ctx.fillRect(520, currentY, 440, 70);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('INVOICE GRAND TOTAL:', 540, currentY + 44);
  ctx.fillText(`$${grandTotal.toFixed(2)}`, 830, currentY + 44);

  // Footer stamp & barcode
  ctx.fillStyle = '#64748b';
  ctx.font = '16px sans-serif';
  ctx.fillText('Authorized Pharmacist Receiver Signature: __________________', 60, currentY + 140);
  ctx.fillText('Drug Distributor Quality Assurance & Delivery Seal Verified', 60, currentY + 180);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

  const mockData: ExtractedInvoice = {
    store_name: storeName,
    invoice_date: today,
    invoice_number: invNum,
    currency: 'USD',
    line_items: items.map((it, idx) => ({
      id: 'gen_' + Date.now() + '_' + idx,
      drug_name: it.name,
      quantity: it.qty,
      unit_price: it.price,
      line_total: it.total,
    })),
    total_amount: grandTotal,
    notes: 'Official wholesale batch delivery',
    photoDataUrl: dataUrl,
  };

  return { dataUrl, mockData };
}

import { DrugLineItem, ExtractedInvoice } from '../types';
import { GoogleGenAI, Type } from '@google/genai';

export interface ExtractionResponse {
  success: boolean;
  data?: ExtractedInvoice;
  error?: string;
}

const CANDIDATE_MODELS = [
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-2.5-pro',
  'gemini-2.0-flash-lite',
];

async function extractClientSide(
  imageBase64: string,
  mimeType: string,
  knownStores: string[],
  apiKey: string
): Promise<any> {
  const ai = new GoogleGenAI({ apiKey });
  const base64Data = imageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');

  const storesPromptSegment = knownStores && knownStores.length > 0
    ? `Known pharmacy/store/supplier list: [${knownStores.map((s) => `"${s}"`).join(', ')}].
If the invoice header contains or clearly matches one of these known stores, select that exact store name. If it does not match with high confidence, set "store_name" to null so the user can select or add it manually. Do NOT guess or invent a fake store name.`
    : `If the distributor, pharmacy store, or supplier name is clearly visible in the header, extract it. Otherwise set "store_name" to null.`;

  const prompt = `You are a precise pharmacy invoice OCR and data extraction specialist.
Analyze this supplier/distributor pharmacy invoice photo.
The invoice is machine-printed and may contain mixed Arabic, English, numbers, and Latin drug names (e.g. "Panadol Extra 500mg - بنادول", "Augmentin 1g", "Concor 5mg", etc.).

${storesPromptSegment}

Instructions:
1. Extract the invoice date (in YYYY-MM-DD format if identifiable, or the exact date string printed on the invoice).
2. Extract the store / supplier name according to the rule above.
3. Extract every single medicine/drug line item found in the invoice table (could range from 1 to 50+ lines).
4. For each line item, extract:
   - drug_name: Complete drug/product name including dosage/strength/form (in original language/Arabic/English as printed).
   - quantity: Numeric quantity or number of units/packs delivered (e.g., 10, 5, 1). If missing or unreadable, leave 1 or null.
   - unit_price: Numeric unit price per item (e.g. 4700.00). If unreadable, leave 0.
   - line_total: Numeric total for this line (quantity * unit_price or as printed on the invoice, e.g. 235000.00).
5. If a field is unreadable in the photo, return null or empty rather than fabricating a plausible-looking value.
6. Extract the invoice number if visible.
7. Calculate the overall invoice total in IQD. Default currency is IQD.

Return strictly conforming JSON.`;

  const schemaConfig = {
    responseMimeType: 'application/json',
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        store_name: {
          type: Type.STRING,
          nullable: true,
          description: 'Exact matched store/supplier name from known list, or null if uncertain',
        },
        invoice_date: {
          type: Type.STRING,
          nullable: true,
          description: 'Invoice date string or YYYY-MM-DD',
        },
        invoice_number: {
          type: Type.STRING,
          nullable: true,
          description: 'Invoice / bill reference number if visible',
        },
        currency: {
          type: Type.STRING,
          nullable: true,
          description: 'Currency symbol or code if printed (e.g., IQD, USD)',
        },
        line_items: {
          type: Type.ARRAY,
          description: 'All drug line items found in the invoice table',
          items: {
            type: Type.OBJECT,
            properties: {
              drug_name: {
                type: Type.STRING,
                description: 'Drug name and strength/packaging (Arabic/English)',
              },
              quantity: {
                type: Type.NUMBER,
                description: 'Quantity delivered / pack count',
              },
              unit_price: {
                type: Type.NUMBER,
                description: 'Unit price per item',
              },
              line_total: {
                type: Type.NUMBER,
                description: 'Total amount for this line',
              },
              batch_number: {
                type: Type.STRING,
                nullable: true,
                description: 'Batch/Lot number if printed',
              },
              expiry_date: {
                type: Type.STRING,
                nullable: true,
                description: 'Expiry date if printed',
              },
            },
            required: ['drug_name', 'quantity', 'unit_price', 'line_total'],
          },
        },
        total_amount: {
          type: Type.NUMBER,
          nullable: true,
          description: 'Invoice grand total if printed',
        },
        notes: {
          type: Type.STRING,
          nullable: true,
          description: 'Any notable invoice remarks',
        },
      },
      required: ['line_items'],
    },
    temperature: 0.1,
  };

  let lastError: any = null;
  for (const modelName of CANDIDATE_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType: mimeType || 'image/jpeg',
                },
              },
              {
                text: prompt,
              },
            ],
          },
        ],
        config: schemaConfig,
      });

      if (response.text) {
        return JSON.parse(response.text);
      }
    } catch (err: any) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  throw lastError || new Error('No response received from Gemini AI models');
}

export async function extractInvoiceFromImage(
  imageBase64: string,
  mimeType: string = 'image/jpeg',
  knownStores: string[] = []
): Promise<ExtractionResponse> {
  try {
    const endpoints = ['/api/extract-invoice', '/.netlify/functions/extract-invoice'];
    let raw: any = null;
    let lastStatus = 0;

    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
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

        lastStatus = res.status;
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const json = await res.json();
          if (json.success && json.data) {
            raw = json.data;
            break;
          }
        }
      } catch (endpointErr) {
        console.warn(`Attempt on ${url} failed, checking alternatives...`, endpointErr);
      }
    }

    // If server endpoints return 404 (e.g. Netlify static deploy without functions), fall back to client-side SDK
    if (!raw) {
      const clientApiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || localStorage.getItem('gemini_api_key');
      if (clientApiKey) {
        raw = await extractClientSide(imageBase64, mimeType, knownStores, clientApiKey);
      } else if (lastStatus === 404) {
        // Prompt user once for Gemini API key if on static host
        const userEnteredKey = window.prompt(
          'Netlify Function endpoint was not found (404). Please enter your free Gemini API Key once to enable direct browser extraction:'
        );
        if (userEnteredKey && userEnteredKey.trim()) {
          localStorage.setItem('gemini_api_key', userEnteredKey.trim());
          raw = await extractClientSide(imageBase64, mimeType, knownStores, userEnteredKey.trim());
        } else {
          throw new Error('Server responded with 404 and no Gemini API Key was configured.');
        }
      } else {
        throw new Error(`Invoice extraction server returned status ${lastStatus || 'error'}.`);
      }
    }

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
      currency: raw.currency || 'IQD',
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

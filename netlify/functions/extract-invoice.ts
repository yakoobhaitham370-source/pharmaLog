import { GoogleGenAI, Type } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: apiKey || '' });

const CANDIDATE_MODELS = [
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-2.5-pro',
  'gemini-2.0-flash-lite',
];

export const handler = async (event: any) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { imageBase64, mimeType = 'image/jpeg', knownStores = [] } = body;

    if (!imageBase64) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'imageBase64 image data is required' }),
      };
    }

    if (!apiKey) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'GEMINI_API_KEY environment variable is not configured in Netlify' }),
      };
    }

    const base64Data = imageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');

    const storesPromptSegment = knownStores && knownStores.length > 0
      ? `Known pharmacy/store/supplier list: [${knownStores.map((s: string) => `"${s}"`).join(', ')}].
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

    let textResult: string | null = null;
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
          textResult = response.text;
          break;
        }
      } catch (err: any) {
        lastError = err;
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    if (!textResult) {
      throw lastError || new Error('No response from Gemini models');
    }

    const parsed = JSON.parse(textResult);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: parsed,
      }),
    };
  } catch (error: any) {
    console.error('Netlify function extract-invoice error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: error?.message || 'Failed to process invoice with Gemini AI',
      }),
    };
  }
};

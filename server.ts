import express, { Request, Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Initialize Gemini SDK
const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: apiKey || '' });

interface ExtractRequestBody {
  imageBase64: string;
  mimeType?: string;
  knownStores?: string[];
}

// Candidates to try in order if high demand (503/429) happens on any single model
const CANDIDATE_MODELS = [
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
];

// POST /api/extract-invoice
app.post('/api/extract-invoice', async (req: Request<{}, {}, ExtractRequestBody & { apiKey?: string }>, res: Response) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', knownStores = [], apiKey: clientApiKey } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'imageBase64 image data is required' });
    }

    const effectiveApiKey = clientApiKey || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

    if (!effectiveApiKey) {
      return res.status(400).json({
        error: 'Gemini API Key is not configured. Please provide your Gemini API Key in settings.',
        code: 'MISSING_API_KEY',
      });
    }

    const ai = new GoogleGenAI({ apiKey: effectiveApiKey });

    // Clean base64 string if it contains data prefix
    const base64Data = imageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');

    const storesPromptSegment = knownStores && knownStores.length > 0
      ? `Known pharmacy/store/supplier list: [${knownStores.map(s => `"${s}"`).join(', ')}].
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
            description: 'Currency symbol or code if printed (e.g., USD, IQD, SAR, EGP, EUR, etc.)',
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
            description: 'Any notable invoice remarks or supplier contact info',
          },
        },
        required: ['line_items'],
      },
      temperature: 0.1,
    };

    let lastError: any = null;
    let textResult: string | null = null;

    // Retry loop across fallback models if high demand (503 / 429) occurs
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
          break; // Success!
        }
      } catch (err: any) {
        lastError = err;
        const msg = err?.message || String(err);
        console.warn(`Extraction with ${modelName} failed (${msg}). Trying fallback model...`);
        // Short pause before trying next candidate
        await new Promise((r) => setTimeout(r, 600));
      }
    }

    if (!textResult) {
      throw lastError || new Error('No response received from any Gemini models');
    }

    const parsed = JSON.parse(textResult);
    return res.json({
      success: true,
      data: parsed,
    });
  } catch (error: any) {
    console.error('Error in /api/extract-invoice:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to process invoice with Gemini AI',
    });
  }
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

async function startServer() {
  const distPath = path.resolve(process.cwd(), 'dist');
  const indexHtml = path.resolve(distPath, 'index.html');
  const hasDist = fs.existsSync(indexHtml);

  if (process.env.NODE_ENV === 'production' && hasDist) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(indexHtml);
    });
  } else {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (e) {
      if (hasDist) {
        app.use(express.static(distPath));
        app.get('*', (_req, res) => {
          res.sendFile(indexHtml);
        });
      }
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PharmaLog server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});

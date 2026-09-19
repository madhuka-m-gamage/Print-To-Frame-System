import { stripEmojis } from '../utils/validation';
import { auth } from './firebase';

/**
 * ============================================================
 * Print To Frame ERP — Gemini AI Service
 * ============================================================
 * Recovered and refactored from the compiled dist bundle.
 * 
 * ARCHITECTURE FIX: All AI calls now go through the server-side
 * API proxy (/api/generate) instead of calling the Gemini API
 * directly from the browser. The API key is NEVER exposed to
 * the client.
 */

// ── API Proxy Helper ──────────────────────────────────────
async function callProxy(prompt, mimeType = null, audioData = null) {
  const payload = { prompt };
  if (mimeType && audioData) {
    payload.mimeType = mimeType;
    payload.audioData = audioData;
  }
  
  // The proxy now requires a signed-in ERP user (see api/generate.js) — attach the
  // current Firebase ID token so the server can verify the caller.
  if (!auth.currentUser) {
    throw new Error('You must be signed in to use AI features.');
  }
  const idToken = await auth.currentUser.getIdToken();

  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    if (!response.ok) {
      if (response.status === 413 || text.includes('FUNCTION_PAYLOAD_TOO_LARGE') || text.includes('Payload Too Large')) {
        throw new Error("Audio payload exceeds maximum upload limit (3.2MB). Please use a compressed format (MP3/M4A) or a shorter recording.");
      }
      throw new Error(`API Proxy error (${response.status}): ${text.substring(0, 100)}`);
    }
    throw new Error(`Invalid JSON from server. Status: ${response.status}. Body: ${text.substring(0, 100)}`);
  }

  if (!response.ok) {
    let errMsg = `AI Service error (${response.status})`;
    try {
      if (typeof data.error === 'object' && data.error?.message) {
        errMsg = data.error.message;
      } else if (typeof data.error === 'string') {
        try {
          const parsed = JSON.parse(data.error);
          if (parsed.error?.message) errMsg = parsed.error.message;
          else if (parsed.message) errMsg = parsed.message;
          else errMsg = data.error;
        } catch (e) {
          errMsg = data.error;
        }
      }
    } catch (e) {}

    // Add user-friendly context but KEEP the real error visible for debugging
    if (response.status === 413) {
      errMsg = `Audio file too large for processing. ${errMsg}`;
    } else if (response.status === 429 || errMsg.includes('RESOURCE_EXHAUSTED')) {
      errMsg = `Rate limit reached — please wait 30 seconds and retry. (${errMsg})`;
    }
    // For 400, 502, 503 — pass through the real message unmodified

    throw new Error(errMsg);
  }

  return data.text;
}

export const generateText = async (prompt) => {
  return await callProxy(prompt);
};

// ── Generate Price Quotation ──────────────────────────────
// Original: W1 in compiled bundle (line ~613)
export const generateQuotation = async (clientData, scope, deliveryAddress, pricing, currentUser) => {
  const dateStr = new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  const repName = currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : "Sales Representative";

  let pricingSection = 'No specific pricing data provided. Please leave placeholders for pricing elements.';
  if (pricing) {
    pricingSection = `Pricing Breakdown (MUST strictly use these exact values):
- Core Manufacturing: LKR ${pricing.manufAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
- Quality Assurance: LKR ${pricing.qa.toLocaleString(undefined, { maximumFractionDigits: 2 })}
- Logistics & Handling: LKR ${pricing.logistics.toLocaleString(undefined, { maximumFractionDigits: 2 })}
- Sales Commission: LKR ${pricing.costSalesAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
- Margin & Overhead: LKR ${pricing.profitAndOH.toLocaleString(undefined, { maximumFractionDigits: 2 })}
- Gross Estimate Total: LKR ${pricing.totalCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}
- Agent Discount (15%): - LKR ${pricing.discount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
- Final Net Payable: LKR ${pricing.finalAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }

  const prompt = `You are an expert sales executive for "Print To Frame Pvt Ltd", a specialist steel framing and canvas wrapping company in Sri Lanka.
Your task is to draft a highly professional quotation for a customer.

Context:
Date: ${dateStr}
Client Details: ${JSON.stringify(clientData, null, 2)}
Job Scope / Requirements: ${scope}
Delivery Location: ${deliveryAddress || 'TBD'}

Pricing & Financials:
${pricingSection}

Instructions:
1. Create a professional quotation document.
2. Start the document with the date: "Date: ${dateStr}".
3. State the "Final Net Payable" (Total Price) clearly.
4. The quotation MUST be divided into categories matching the provided pricing breakdown EXACTLY. Use sections like:
   - Core Manufacturing
   - Logistics & Handling
   - Quality Assurance
   - Sales Commission
   - Margin & Overhead
   - Gross Estimate
   - Agent Discount (if applicable)
   - Final Total
5. Itemize the specific work to be done under the relevant categories based on the Job Scope notes. DO NOT make up your own prices. The total for each category must match the provided figures.
6. IMPORTANT: Do NOT use markdown tables. Use a clean, simple text format (e.g., bullet points or numbered lists under each category heading).
7. Include standard terms: "75% advance payment required prior to commencement of work. Remaining 25% due upon final mile delivery."
8. STRICT REQUIREMENT: Do NOT include ANY emojis, informal icons, or decorative symbols anywhere in the quotation.
9. End the quotation with a professional sign-off from: ${repName}
10. Output ONLY the raw markdown text for the quotation body. Do not include introductory conversational text (like "Here is the quote:").`;

  try {
    return await callProxy(prompt);
  } catch (err) {
    console.error('Gemini AI API Error:', err);
    throw new Error('AI Error: ' + (err.message || 'Failed to communicate with AI model. Check console.'));
  }
};

// ── Generate Structured Line-Item Quotation (JSON) ────────
export const generateStructuredQuotation = async (clientData, scope, deliveryAddress, pricing, currentUser) => {
  const dateStr = new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
  const repName = currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Sales Representative';

  let pricingSection = 'No specific pricing data. Estimate reasonable values based on the job scope.';
  if (pricing) {
    pricingSection = `Use these EXACT LKR values mapped to line items:
- Core Manufacturing: LKR ${pricing.manufAmount?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || 0}
- Quality Assurance: LKR ${pricing.qa?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || 0}
- Logistics & Handling: LKR ${pricing.logistics?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || 0}
- Sales Commission: LKR ${pricing.costSalesAmount?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || 0}
- Margin & Overhead: LKR ${pricing.profitAndOH?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || 0}
- Final Net Payable: LKR ${pricing.finalAmount?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || 0}`;
  }

  const prompt = `You are a sales executive at Print To Frame Pvt Ltd, a steel framing company in Sri Lanka.
Generate structured line-item quotation data for this job.

Job Scope: ${scope}
Client: ${clientData?.name || 'Client'}${clientData?.company ? ` (${clientData.company})` : ''}
Delivery: ${deliveryAddress || 'TBD'}
Date: ${dateStr}
Sales Rep: ${repName}

${pricingSection}

OUTPUT: A valid JSON array ONLY. No markdown, no code fences, no explanation.
Each object: {"description":string,"qty":number,"unit":string,"unitPrice":number,"taxPct":0,"discountPct":0}
The sum of (qty*unitPrice) for all items must equal the Final Net Payable.
Use professional engineering terminology. No emojis. Maximum 6 line items.
Example: [{"description":"Custom Box Iron Frame Fabrication","qty":1,"unit":"job","unitPrice":180000,"taxPct":0,"discountPct":0}]`;

  try {
    const responseText = await callProxy(prompt);
    const cleaned = responseText.replace(/^```json\s*/m, '').replace(/^```\s*/m, '').replace(/```\s*$/m, '').trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) throw new Error('Response was not an array');
    return parsed;
  } catch (err) {
    console.error('Structured quotation error:', err);
    throw new Error('AI Error: ' + (err.message || 'Failed to generate structured quotation.'));
  }
};

// ── Generate 75% Advance Payment Invoice ──────────────────
// Original: gh in compiled bundle
export const generateAdvanceInvoice = async (clientData, scope, totalAmount) => {
  const dateStr = new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  const advanceAmount = totalAmount * 0.75;
  const balanceAmount = totalAmount * 0.25;

  const prompt = `Generate a professional 75% Advance Payment Invoice document for Print To Frame Pvt Ltd.

Context:
Date: ${dateStr}
Client Details: ${JSON.stringify(clientData, null, 2)}
Job Scope: ${scope}

Financials:
- Total Custom Framing Job Value: LKR ${totalAmount.toLocaleString()}
- 75% Advance Amount Due Now: LKR ${advanceAmount.toLocaleString()}
- 25% Balance on Delivery: LKR ${balanceAmount.toLocaleString()}

Instructions:
1. Output ONLY a concise, professional, 1 to 2 sentence technical description of the work to be performed based on the Job Scope.
2. The output MUST be strictly plain text. Do NOT use ANY markdown formatting (no asterisks, no bolding, no bullet points).
3. Do NOT use ANY emojis or icons.
4. Do NOT include greetings, conversational filler, or invoice headers.
5. Example output: "Custom fabrication of an 8x7 ft durable steel banner frame, including delivery and professional installation at the specified location."`;

  try {
    return await callProxy(prompt);
  } catch (err) {
    console.error('Gemini AI API Error:', err);
    throw new Error('AI Error: ' + (err.message || 'Failed to communicate with AI model. Check console.'));
  }
};

// ── Extract Project Scope from Call Recording ─────────────
// Original: Y1 in compiled bundle
export const extractCallScope = async (audioData, audioMimeType, instructions, clientInfo) => {
  const prompt = `You are an expert engineering project coordinator at "Print To Frame Pvt Ltd", a specialist precision steel framing and canvas wrapping company in Sri Lanka.

Listen carefully to this customer call recording and extract a structured technical engineering project scope document.

CRITICAL REQUIREMENT - AUDIO PROCESSING:
You must provide highly accurate Sinhala audio processing. Expect mixed English-Sinhala phrasing and colloquial terms. Ensure the extraction does not fail on these elements and accurately captures the intent in formal, professional English.

${clientInfo?.name ? `Known client info: Name: ${clientInfo.name}, Company: ${clientInfo.company || 'Unknown'}.` : 'No prior client information available.'}

Extract the following from the conversation:
1. Client name
2. Client contact (phone number)
3. Client email
4. A professional, clean engineering project scope: Frame dimensions (Length x Height in feet), steel tube/gauge specifications, canvas type, finish/coating, delivery milestones, and special technical instructions.
   STRICT REQUIREMENT: Do NOT use ANY emojis, pictographs, or casual icons. Use clean, professional technical engineering bullet points (e.g. standard dashes like '- Frame dimensions: 8x4 ft').
5. The delivery location or delivery address.
6. The numeric frame height and frame width (in FEET only). If the caller mentions inches or cm, convert them accurately to feet (e.g., 24 inches = 2 feet).

Additional user instructions for scope styling:
${instructions || ''}

IMPORTANT: You MUST format your entire response as a single, valid JSON object with the following exact keys:
{
  "clientName": "...",
  "clientContact": "...",
  "clientEmail": "...",
  "scope": "...",
  "deliveryLocation": "...",
  "frameHeight": 2.5,
  "frameWidth": 3
}
Do NOT wrap the JSON in markdown code blocks. Output ONLY the raw JSON object.`;

  try {
    const responseText = await callProxy(prompt, audioMimeType, audioData);
    try {
      // Attempt to clean the response in case the model added markdown blocks anyway
      const cleanedText = responseText.replace(/^```json/m, '').replace(/^```/m, '').trim();
      const parsed = JSON.parse(cleanedText);
      
      // Auto-strip any accidental emojis from scope
      if (parsed.scope) {
        parsed.scope = stripEmojis(parsed.scope);
      }
      return parsed;
    } catch (parseErr) {
      console.error('Failed to parse AI JSON response:', responseText);
      throw new Error('AI returned an invalid format. Please try again.');
    }
  } catch (err) {
    console.error('Gemini AI API Error:', err);
    throw new Error('AI Error: ' + (err.message || 'Failed to communicate with AI model. Check console.'));
  }
};

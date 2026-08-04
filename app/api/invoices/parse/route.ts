import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
const maxFileSize = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!supabaseUrl || !supabaseKey || !openaiKey) {
    return NextResponse.json({ error: "Automatische factuurherkenning is nog niet geconfigureerd." }, { status: 503 });
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Log opnieuw in om een factuur te verwerken." }, { status: 401 });
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Je sessie is niet geldig. Log opnieuw in." }, { status: 401 });

  const form = await request.formData();
  const invoice = form.get("invoice");
  if (!(invoice instanceof File) || !allowedTypes.has(invoice.type) || invoice.size < 1 || invoice.size > maxFileSize) {
    return NextResponse.json({ error: "Gebruik een geldige PDF-, JPG- of PNG-factuur van maximaal 10 MB." }, { status: 400 });
  }

  const base64 = Buffer.from(await invoice.arrayBuffer()).toString("base64");
  const dataUrl = `data:${invoice.type};base64,${base64}`;
  const fileInput = invoice.type === "application/pdf"
    ? { type: "input_file", filename: invoice.name.slice(0, 120), file_data: dataUrl }
    : { type: "input_image", image_url: dataUrl, detail: "high" };

  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["supplier", "invoiceNumber", "invoiceDate", "currency", "items"],
    properties: {
      supplier: { type: "string" },
      invoiceNumber: { type: "string" },
      invoiceDate: { type: "string", description: "YYYY-MM-DD, or an empty string" },
      currency: { type: "string" },
      items: {
        type: "array",
        minItems: 1,
        maxItems: 100,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["description", "sku", "quantity", "lineTotal", "unitCost"],
          properties: {
            description: { type: "string" },
            sku: { type: "string" },
            quantity: { type: "integer", minimum: 1 },
            lineTotal: { type: "number", minimum: 0 },
            unitCost: { type: "number", minimum: 0 },
          },
        },
      },
    },
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_INVOICE_MODEL || "gpt-5.6-luna",
      store: false,
      reasoning: { effort: "low" },
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: "Lees deze inkoopfactuur. Geef uitsluitend fysieke voorraadregels terug; sla verzendkosten, korting, btw en diensten over. Gebruik aantallen en regelbedragen exclusief btw. Bereken unitCost als lineTotal gedeeld door quantity. Neem SKU alleen over als die echt op de factuur staat." },
          fileInput,
        ],
      }],
      text: { format: { type: "json_schema", name: "invoice_inventory", strict: true, schema } },
    }),
  });

  if (!response.ok) {
    return NextResponse.json({ error: "De factuurherkenning is tijdelijk niet beschikbaar." }, { status: 502 });
  }
  const result = await response.json();
  const outputText = result.output
    ?.flatMap((item: { content?: Array<{ type?: string; text?: string }> }) => item.content || [])
    .find((content: { type?: string; text?: string }) => content.type === "output_text")?.text;
  if (!outputText) return NextResponse.json({ error: "Er zijn geen voorraadregels herkend." }, { status: 422 });
  const parsed = JSON.parse(outputText);
  if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
    return NextResponse.json({ error: "Er zijn geen fysieke voorraadproducten op deze factuur gevonden." }, { status: 422 });
  }
  return NextResponse.json(parsed, { headers: { "Cache-Control": "no-store" } });
}

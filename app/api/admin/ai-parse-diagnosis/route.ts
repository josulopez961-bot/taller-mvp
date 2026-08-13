import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type DiagnosisItem = {
  category: "labor" | "part" | "supply";
  priority: "urgente" | "recomendado" | "opcional" | "especial";
  description: string;
  qty: number;
  unit_price: number;
};

const VALID_CATEGORIES = ["labor", "part", "supply"] as const;
const VALID_PRIORITIES = ["urgente", "recomendado", "opcional", "especial"] as const;

function inferCategory(description: string): DiagnosisItem["category"] {
  const text = description.toLowerCase();

  if (
    /\b(limpiador|desengrasante|guaipe|aceite|liquido|aditivo|grasa|refrigerante|lubricante|silicon|spray)\b/.test(
      text
    )
  ) {
    return "supply";
  }

  if (
    /\b(filtro|bujia|pastilla|disco|banda|correa|rodamiento|terminal|rotula|amortiguador|sensor|bomba|manguera)\b/.test(
      text
    )
  ) {
    return "part";
  }

  return "labor";
}

function inferPriority(description: string): DiagnosisItem["priority"] {
  const text = description.toLowerCase();

  if (/\b(urgente|necesario|seguridad|fuga|no funciona|danado|roto)\b/.test(text)) {
    return "urgente";
  }

  if (/\b(opcional|preventivo|segun necesidad|si requiere)\b/.test(text)) {
    return "opcional";
  }

  if (/\b(especializado|alineacion|aire acondicionado|caja automatica|inyeccion electronica)\b/.test(text)) {
    return "especial";
  }

  return "recomendado";
}

function splitRawItems(rawText: string): string[] {
  return rawText
    .split(/\r?\n|[;•]+/)
    .flatMap((line) => line.split(/\.(?=\s|$)/))
    .map((item) => item.replace(/^[-*\d.)\s]+/, "").trim())
    .filter(Boolean);
}

function fallbackParse(rawText: string): DiagnosisItem[] {
  return splitRawItems(rawText).map((description) => ({
    category: inferCategory(description),
    priority: inferPriority(description),
    description,
    qty: 1,
    unit_price: 0,
  }));
}

function cleanItems(items: unknown): DiagnosisItem[] {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const rawItem = item as Record<string, unknown>;
      const description = String(rawItem.description || "").trim();
      const category = String(rawItem.category || "");
      const priority = String(rawItem.priority || "");

      return {
        category: VALID_CATEGORIES.includes(category as DiagnosisItem["category"])
          ? (category as DiagnosisItem["category"])
          : inferCategory(description),
        priority: VALID_PRIORITIES.includes(priority as DiagnosisItem["priority"])
          ? (priority as DiagnosisItem["priority"])
          : inferPriority(description),
        description,
        qty: Number(rawItem.qty) || 1,
        unit_price: Number(rawItem.unit_price) || 0,
      };
    })
    .filter((item): item is DiagnosisItem => Boolean(item && item.description.length > 0));
}

async function parseWithAi(rawText: string): Promise<DiagnosisItem[]> {
  const prompt = `Eres un asistente para un taller mecanico. Analiza este texto escrito por un mecanico y conviertelo en items estructurados de diagnostico/cotizacion.

Texto del mecanico:
${rawText.trim()}

Reglas:
- category: "labor" para mano de obra, "part" para repuesto, "supply" para insumo, aceite, liquido, limpiador, desengrasante o material consumible.
- priority: "urgente" si debe hacerse ya por seguridad, "recomendado" si conviene hacerlo pronto, "opcional" si es preventivo o segun necesidad, "especial" si requiere taller especializado.
- description: nombre limpio y profesional del trabajo o pieza.
- qty: cantidad numerica. Si no aparece, usa 1.
- unit_price: precio si lo menciona, sino 0.
- Si el texto es una lista simple, crea un item por linea o frase.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "diagnosis_quote_items",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  category: { type: "string", enum: VALID_CATEGORIES },
                  priority: { type: "string", enum: VALID_PRIORITIES },
                  description: { type: "string" },
                  qty: { type: "number" },
                  unit_price: { type: "number" },
                },
                required: ["category", "priority", "description", "qty", "unit_price"],
              },
            },
          },
          required: ["items"],
        },
      },
    },
    temperature: 0.2,
    max_tokens: 1000,
  });

  const content = completion.choices[0]?.message?.content?.trim() ?? "";

  try {
    const parsed = JSON.parse(content);
    return cleanItems(parsed.items);
  } catch {
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    return jsonMatch ? cleanItems(JSON.parse(jsonMatch[0])) : [];
  }
}

export async function POST(req: Request) {
  let rawText = "";

  try {
    const body = await req.json();
    rawText = body.rawText;

    if (!rawText || typeof rawText !== "string" || rawText.trim().length < 3) {
      return NextResponse.json({ error: "Texto vacio" }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.startsWith("sk-pon")) {
      return NextResponse.json({ items: fallbackParse(rawText) });
    }

    const items = await parseWithAi(rawText);

    return NextResponse.json({ items: items.length > 0 ? items : fallbackParse(rawText) });
  } catch (error) {
    console.error("AI_PARSE_ERROR", error);

    if (rawText) {
      return NextResponse.json({ items: fallbackParse(rawText) });
    }

    return NextResponse.json({ error: "Error al procesar con IA" }, { status: 500 });
  }
}

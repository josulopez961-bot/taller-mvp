import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const { rawText } = await req.json();

    if (!rawText || typeof rawText !== "string" || rawText.trim().length < 3) {
      return NextResponse.json({ error: "Texto vacío" }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.startsWith("sk-pon")) {
      return NextResponse.json({ error: "OPENAI_API_KEY no configurada" }, { status: 500 });
    }

    const prompt = `Eres un asistente para un taller mecánico. Analiza este texto escrito por un mecánico y conviértelo en items estructurados de diagnóstico/cotización.

Texto del mecánico: "${rawText.trim()}"

Reglas:
- category: "labor" (mano de obra), "part" (repuesto), "supply" (insumo/aceite/liquido)
- priority: "urgente" (debe hacerse ya, seguridad), "recomendado" (se puede dañar si no se hace pronto), "opcional" (recomendación de mantenimiento preventivo), "especial" (requiere taller especializado o equipos que este taller no tiene: inyección electrónica, caja automática, aire acondicionado recarga de gas, alineación, etc.)
- description: nombre limpio y profesional del trabajo o pieza
- qty: cantidad numérica (default 1)
- unit_price: precio si lo menciona, sino 0

Devuelve SOLO un array JSON válido, sin texto extra, sin markdown, sin explicaciones:
[{"category":"labor","priority":"urgente","description":"Cambio de aceite","qty":1,"unit_price":0}]`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 1000,
    });

    const content = completion.choices[0]?.message?.content?.trim() ?? "";

    // Extraer JSON del response (puede venir con backticks)
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "No se pudo interpretar el texto" }, { status: 422 });
    }

    const items = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(items)) {
      return NextResponse.json({ error: "Respuesta inválida de IA" }, { status: 422 });
    }

    const clean = items.map((item: any) => ({
      category: ["labor", "part", "supply"].includes(item.category) ? item.category : "labor",
      priority: ["urgente", "recomendado", "opcional", "especial"].includes(item.priority) ? item.priority : "recomendado",
      description: String(item.description || "").trim(),
      qty: Number(item.qty) || 1,
      unit_price: Number(item.unit_price) || 0,
    })).filter((item) => item.description.length > 0);

    return NextResponse.json({ items: clean });
  } catch (error: any) {
    console.error("AI_PARSE_ERROR", error);
    return NextResponse.json({ error: "Error al procesar con IA" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const { rawText } = await req.json();

    if (!rawText || typeof rawText !== "string" || rawText.trim().length < 3) {
      return NextResponse.json({ error: "Texto vacío" }, { status: 400 });
    }

    const prompt = `Eres un asistente para un taller mecánico. El mecánico describe servicios realizados en un vehículo. Convierte el texto en una lista limpia de servicios con su precio.

Texto: "${rawText.trim()}"

Reglas:
- description: nombre limpio y profesional del servicio o pieza
- price: precio si se menciona, sino 0
- Ordena de mayor a menor precio

Devuelve SOLO un array JSON válido, sin texto extra:
[{"description":"Cambio de aceite 10W40","price":25}]`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 600,
    });

    const content = completion.choices[0]?.message?.content?.trim() ?? "";
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "No se pudo interpretar el texto" }, { status: 422 });
    }

    const items = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(items)) {
      return NextResponse.json({ error: "Respuesta inválida" }, { status: 422 });
    }

    const clean = items
      .map((i: any) => ({ description: String(i.description || "").trim(), price: String(Number(i.price) || 0) }))
      .filter((i) => i.description.length > 0);

    return NextResponse.json({ items: clean });
  } catch (error) {
    console.error("AI_PARSE_HISTORY_ERROR", error);
    return NextResponse.json({ error: "Error al procesar con IA" }, { status: 500 });
  }
}

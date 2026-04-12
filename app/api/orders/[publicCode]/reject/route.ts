import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ publicCode: string }> }
) {
  try {
    const { publicCode } = await params;

    if (!publicCode) {
      return NextResponse.json({ error: "Código inválido" }, { status: 400 });
    }

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("orders")
      .update({
        approval_status: "rechazado",
        approved_at: null,
        rejected_at: now,
        approval_decided_at: now,
      })
      .eq("public_code", publicCode)
      .select("id, public_code, approval_status, rejected_at, approval_decided_at");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: "No se encontró la orden para rechazar" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      order: data[0],
    });
  } catch (error) {
    console.error("REJECT_ORDER_ERROR", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

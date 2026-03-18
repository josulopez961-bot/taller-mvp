import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ publicCode: string }> }
) {
  try {
    const { publicCode } = await params;

    if (!publicCode) {
      return NextResponse.json({ error: "Código inválido" }, { status: 400 });
    }

    let authorized_priorities: string | null = null;
    try {
      const body = await req.json();
      authorized_priorities = body.authorized_priorities || null;
    } catch {
      // no body, ignore
    }

    const { data, error } = await supabase
      .from("orders")
      .update({ approval_status: "aprobado", authorized_priorities })
      .eq("public_code", publicCode)
      .select("id, public_code, approval_status, authorized_priorities");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: "No se encontró la orden para aprobar" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, order: data[0] });
  } catch (error) {
    console.error("APPROVE_ORDER_ERROR", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

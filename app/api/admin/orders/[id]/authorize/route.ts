import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const VALID_PRIORITIES = new Set(["urgente", "recomendado", "opcional", "especial"]);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    if (!id) {
      return NextResponse.json({ error: "ID de orden invalido" }, { status: 400 });
    }

    const authorizedPriorities = String(body.authorized_priorities || "")
      .split(",")
      .map((priority) => priority.trim())
      .filter((priority) => VALID_PRIORITIES.has(priority));

    if (authorizedPriorities.length === 0) {
      return NextResponse.json(
        { error: "Selecciona al menos un grupo para autorizar" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("orders")
      .update({
        approval_status: "aprobado",
        authorized_priorities: authorizedPriorities.join(","),
        approved_at: now,
        rejected_at: null,
        approval_decided_at: now,
      })
      .eq("id", id)
      .select(
        "id, approval_status, authorized_priorities, approved_at, approval_decided_at"
      )
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, order: data });
  } catch (error) {
    console.error("ADMIN_AUTHORIZE_ORDER_ERROR", error);
    return NextResponse.json(
      { error: "Error interno al autorizar desde taller" },
      { status: 500 }
    );
  }
}

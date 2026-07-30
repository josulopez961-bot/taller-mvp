import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const VALID_STATUS = new Set(["scheduled", "used", "cancelled"]);

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const status = String(body.status || "").trim();

    if (!id) {
      return NextResponse.json({ error: "ID de mantenimiento invalido" }, { status: 400 });
    }

    if (!VALID_STATUS.has(status)) {
      return NextResponse.json({ error: "Estado invalido" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("maintenance_plans")
      .update({ status })
      .eq("id", id)
      .select("id, status")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, plan: data });
  } catch (error) {
    console.error("MAINTENANCE_PLAN_PATCH_ERROR", error);
    return NextResponse.json(
      { error: "Error interno al actualizar mantenimiento" },
      { status: 500 }
    );
  }
}

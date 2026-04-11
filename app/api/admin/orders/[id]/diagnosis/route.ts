import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const {
      estimated_delivery_date,
      diagnosis_detail,
      repair_detail,
      repair_cost,
      current_km,
      generate_maintenance_plan,
      service_interval_km,
      paint_scope,
      insurance_scope,
    } = body;

    if (!id) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const { error } = await supabase
      .from("orders")
      .update({
        estimated_delivery_date: estimated_delivery_date || null,
        diagnosis_detail: diagnosis_detail || null,
        repair_detail: repair_detail || null,
        paint_scope: paint_scope || null,
        insurance_scope: insurance_scope || null,
        current_km: current_km || null,
        repair_cost:
          repair_cost === "" || repair_cost === null || repair_cost === undefined
            ? null
            : Number(repair_cost),
        approval_status: "pendiente",
        generate_maintenance_plan: generate_maintenance_plan || false,
        service_interval_km: service_interval_km || 5000,
      })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PATCH_DIAGNOSIS_ERROR", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

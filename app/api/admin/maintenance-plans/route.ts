import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type MaintenanceItem = {
  category: "labor" | "part" | "supply";
  description: string;
  qty: number;
  unit_price: number;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      vehicle_id,
      customer_id,
      source_order_id,
      service_name,
      notes,
      last_service_km,
      service_interval_km,
      estimated_due_date,
      items = [],
    } = body;

    if (!vehicle_id) {
      return NextResponse.json(
        { error: "vehicle_id es requerido" },
        { status: 400 }
      );
    }

    if (!service_name || !String(service_name).trim()) {
      return NextResponse.json(
        { error: "service_name es requerido" },
        { status: 400 }
      );
    }

    if (
      typeof last_service_km !== "number" ||
      typeof service_interval_km !== "number"
    ) {
      return NextResponse.json(
        { error: "last_service_km y service_interval_km deben ser numéricos" },
        { status: 400 }
      );
    }

    const next_service_km = last_service_km + service_interval_km;
    const visible_from_km = next_service_km - 200;

    const validItems: MaintenanceItem[] = (items as MaintenanceItem[]).filter(
      (item) =>
        item &&
        ["labor", "part", "supply"].includes(item.category) &&
        item.description?.trim() &&
        Number(item.qty) > 0 &&
        Number(item.unit_price) >= 0
    );

    const { data: plan, error: planError } = await supabase
      .from("maintenance_plans")
      .upsert(
        {
          vehicle_id,
          customer_id: customer_id || null,
          source_order_id: source_order_id || null,
          service_name: String(service_name).trim(),
          notes: notes?.trim() || null,
          last_service_km,
          service_interval_km,
          next_service_km,
          visible_from_km,
          estimated_due_date: estimated_due_date || null,
          status: "scheduled",
        },
        {
          onConflict: "vehicle_id,next_service_km",
        }
      )
      .select()
      .single();

    if (planError) {
      return NextResponse.json(
        { error: planError.message },
        { status: 500 }
      );
    }

    if (validItems.length > 0) {
      // Borrar items existentes para este plan antes de insertar los nuevos (para evitar duplicados en upsert)
      await supabase
        .from("maintenance_plan_items")
        .delete()
        .eq("maintenance_plan_id", plan.id);

      const rows = validItems.map((item) => ({
        maintenance_plan_id: plan.id,
        category: item.category,
        description: item.description.trim(),
        qty: item.qty,
        unit_price: item.unit_price,
      }));

      const { error: itemsError } = await supabase
        .from("maintenance_plan_items")
        .insert(rows);

      if (itemsError) {
        return NextResponse.json(
          { error: itemsError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      plan_id: plan.id,
      next_service_km,
      visible_from_km,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}


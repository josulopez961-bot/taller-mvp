import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function generateCode(nextNumber: number) {
  return `FIN${String(nextNumber).padStart(3, "0")}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { plate, customer_name, whatsapp, make, model, year, engine, service_date, km, summary, items } = body;

    if (!plate || !customer_name || !whatsapp || !service_date) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }

    const normalizedWhatsapp = String(whatsapp).trim();
    const normalizedPlate = String(plate).trim().toUpperCase();

    // Buscar o crear cliente
    let customerId: string;
    const { data: existingCustomer } = await supabase
      .from("customers")
      .select("id")
      .eq("whatsapp", normalizedWhatsapp)
      .maybeSingle();

    if (existingCustomer) {
      customerId = existingCustomer.id;
    } else {
      const { data: newCustomer, error } = await supabase
        .from("customers")
        .insert({ full_name: customer_name, whatsapp: normalizedWhatsapp })
        .select("id")
        .single();
      if (error || !newCustomer) return NextResponse.json({ error: error?.message }, { status: 500 });
      customerId = newCustomer.id;
    }

    // Buscar o crear vehículo
    let vehicleId: string;
    const { data: existingVehicle } = await supabase
      .from("vehicles")
      .select("id")
      .eq("plate", normalizedPlate)
      .eq("customer_id", customerId)
      .maybeSingle();

    if (existingVehicle) {
      vehicleId = existingVehicle.id;
    } else {
      const { data: newVehicle, error } = await supabase
        .from("vehicles")
        .insert({ customer_id: customerId, plate: normalizedPlate, make: make || null, model: model || null, year: year || null, engine: engine || null })
        .select("id")
        .single();
      if (error || !newVehicle) return NextResponse.json({ error: error?.message }, { status: 500 });
      vehicleId = newVehicle.id;
    }

    // Generar código
    const { data: lastOrder } = await supabase
      .from("orders")
      .select("public_code")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let nextNumber = 1;
    if (lastOrder?.public_code) {
      const match = lastOrder.public_code.match(/^FIN(\d+)$/);
      if (match) nextNumber = Number(match[1]) + 1;
    }

    const totalCost = (items || []).reduce((sum: number, i: any) => sum + Number(i.price || 0), 0);

    // Crear orden directamente como entregado
    const { data: newOrder, error: orderError } = await supabase
      .from("orders")
      .insert({
        vehicle_id: vehicleId,
        public_code: generateCode(nextNumber),
        status: "entregado",
        service_date,
        current_km: km ? Number(km) : null,
        summary: summary || null,
        repair_detail: summary || null,
        repair_cost: totalCost || null,
        approval_status: "aprobado",
      })
      .select("id, public_code")
      .single();

    if (orderError || !newOrder) {
      return NextResponse.json({ error: orderError?.message }, { status: 500 });
    }

    // Insertar items del servicio
    if (items && items.length > 0) {
      const cleanItems = items
        .filter((i: any) => i.description?.trim())
        .map((i: any) => ({
          order_id: newOrder.id,
          category: "Mano de obra",
          priority: "urgente",
          description: String(i.description).trim(),
          qty: 1,
          unit_price: Number(i.price || 0),
          completed: true,
        }));
      if (cleanItems.length > 0) {
        await supabase.from("order_quote_items").insert(cleanItems);
      }
    }

    return NextResponse.json({ ok: true, public_code: newOrder.public_code });
  } catch (error) {
    console.error("HISTORY_CREATE_ERROR", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

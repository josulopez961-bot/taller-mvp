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

    const {
      plate,
      customer_name,
      whatsapp,
      make,
      model,
      year,
      summary,
      estimated_delivery_date,
      diagnosis_detail,
      repair_detail,
      repair_cost,
    } = body;

    if (!plate || !customer_name || !whatsapp) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios" },
        { status: 400 }
      );
    }

    let customerId: string;
    let vehicleId: string;

    const normalizedWhatsapp = String(whatsapp).trim();
    const normalizedPlate = String(plate).trim().toUpperCase();

    const { data: existingCustomer, error: existingCustomerError } =
      await supabase
        .from("customers")
        .select("id, full_name, whatsapp")
        .eq("whatsapp", normalizedWhatsapp)
        .maybeSingle();

    if (existingCustomerError) {
      return NextResponse.json(
        { error: existingCustomerError.message },
        { status: 500 }
      );
    }

    if (existingCustomer) {
      customerId = existingCustomer.id;
    } else {
      const { data: newCustomer, error: customerError } = await supabase
        .from("customers")
        .insert({
          full_name: customer_name,
          whatsapp: normalizedWhatsapp,
        })
        .select("id")
        .single();

      if (customerError || !newCustomer) {
        return NextResponse.json(
          { error: customerError?.message || "No se pudo crear el cliente" },
          { status: 500 }
        );
      }

      customerId = newCustomer.id;
    }

    const { data: existingVehicle, error: existingVehicleError } =
      await supabase
        .from("vehicles")
        .select("id, plate, customer_id")
        .eq("plate", normalizedPlate)
        .eq("customer_id", customerId)
        .maybeSingle();

    if (existingVehicleError) {
      return NextResponse.json(
        { error: existingVehicleError.message },
        { status: 500 }
      );
    }

    if (existingVehicle) {
      vehicleId = existingVehicle.id;
    } else {
      const { data: newVehicle, error: vehicleError } = await supabase
        .from("vehicles")
        .insert({
          customer_id: customerId,
          plate: normalizedPlate,
          make: make || null,
          model: model || null,
          year: year || null,
        })
        .select("id")
        .single();

      if (vehicleError || !newVehicle) {
        return NextResponse.json(
          { error: vehicleError?.message || "No se pudo crear el vehículo" },
          { status: 500 }
        );
      }

      vehicleId = newVehicle.id;
    }

    const { data: lastOrder, error: lastOrderError } = await supabase
      .from("orders")
      .select("public_code")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastOrderError) {
      return NextResponse.json(
        { error: lastOrderError.message },
        { status: 500 }
      );
    }

    let nextNumber = 1;

    if (lastOrder?.public_code) {
      const match = lastOrder.public_code.match(/^FIN(\d+)$/);
      if (match) {
        nextNumber = Number(match[1]) + 1;
      }
    }

    const public_code = generateCode(nextNumber);

    const { data: newOrder, error: orderError } = await supabase
      .from("orders")
      .insert({
        vehicle_id: vehicleId,
        public_code,
        status: "recibido",
        summary: summary || null,
        estimated_delivery_date: estimated_delivery_date || null,
        diagnosis_detail: diagnosis_detail || null,
        repair_detail: repair_detail || null,
        repair_cost:
          repair_cost === "" || repair_cost === null || repair_cost === undefined
            ? null
            : Number(repair_cost),
        approval_status: "pendiente",
      })
      .select("id, public_code")
      .single();

    if (orderError || !newOrder) {
      return NextResponse.json(
        { error: orderError?.message || "No se pudo crear la orden" },
        { status: 500 }
      );
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";

    const publicUrl = `${appUrl}/o/${newOrder.public_code}`;

    return NextResponse.json({
      ok: true,
      orderId: newOrder.id,
      public_code: newOrder.public_code,
      publicUrl,
    });
  } catch (error) {
    console.error("CREATE_ORDER_ERROR", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

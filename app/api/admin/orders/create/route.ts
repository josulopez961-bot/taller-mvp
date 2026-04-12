import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getOrderSummary,
  normalizeOrderWorkType,
} from "@/lib/order-work-types";

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
      engine,
      intake_km,
      work_type,
      intake_reason,
      customer_concern,
      paint_scope,
      insurance_scope,
      insurance_company,
      insurance_claim_number,
      estimated_delivery_date,
    } = body;

    const normalizedPlate = String(plate || "").trim().toUpperCase();
    const normalizedCustomerName = String(customer_name || "").trim();
    const normalizedWhatsapp = String(whatsapp || "").trim();
    const normalizedMake = String(make || "").trim();
    const normalizedModel = String(model || "").trim();
    const normalizedEngine = String(engine || "").trim();
    const normalizedIntakeReason = String(intake_reason || "").trim();
    const normalizedCustomerConcern = String(customer_concern || "").trim();
    const normalizedPaintScope = String(paint_scope || "").trim();
    const normalizedInsuranceScope = String(insurance_scope || "").trim();
    const normalizedInsuranceCompany = String(insurance_company || "").trim();
    const normalizedInsuranceClaimNumber = String(
      insurance_claim_number || ""
    ).trim();
    const normalizedYear = year ? Number(year) : null;
    const normalizedIntakeKm = intake_km ? Number(intake_km) : null;

    if (
      !normalizedPlate ||
      !normalizedCustomerName ||
      !normalizedWhatsapp ||
      !normalizedMake ||
      !normalizedModel ||
      !normalizedIntakeReason
    ) {
      return NextResponse.json(
        {
          error:
            "Placa, cliente, WhatsApp, marca, modelo y motivo de visita son obligatorios",
        },
        { status: 400 }
      );
    }

    const normalizedWorkType = normalizeOrderWorkType(work_type);
    let customerId: string;
    let vehicleId: string;

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

      if (
        existingCustomer.full_name !== normalizedCustomerName ||
        (normalizedWhatsapp && existingCustomer.whatsapp !== normalizedWhatsapp)
      ) {
        const { error: updateCustomerError } = await supabase
          .from("customers")
          .update({
            full_name: normalizedCustomerName,
            whatsapp: normalizedWhatsapp,
          })
          .eq("id", customerId);

        if (updateCustomerError) {
          return NextResponse.json(
            { error: updateCustomerError.message },
            { status: 500 }
          );
        }
      }
    } else {
      const { data: newCustomer, error: customerError } = await supabase
        .from("customers")
        .insert({
          full_name: normalizedCustomerName,
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

      const { error: updateVehicleError } = await supabase
        .from("vehicles")
        .update({
          make: normalizedMake,
          model: normalizedModel,
          year: normalizedYear,
          engine: normalizedEngine || null,
        })
        .eq("id", vehicleId);

      if (updateVehicleError) {
        return NextResponse.json(
          { error: updateVehicleError.message },
          { status: 500 }
        );
      }
    } else {
      const { data: newVehicle, error: vehicleError } = await supabase
        .from("vehicles")
        .insert({
          customer_id: customerId,
          plate: normalizedPlate,
          make: normalizedMake,
          model: normalizedModel,
          year: normalizedYear,
          engine: normalizedEngine || null,
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
        work_type: normalizedWorkType,
        summary: getOrderSummary(normalizedWorkType, normalizedIntakeReason),
        estimated_delivery_date: estimated_delivery_date || null,
        intake_reason: normalizedIntakeReason,
        customer_concern:
          normalizedWorkType === "falla_puntual" ||
          normalizedWorkType === "aseguradora"
            ? normalizedCustomerConcern || null
            : null,
        paint_scope: normalizedPaintScope || null,
        insurance_scope: normalizedInsuranceScope || null,
        insurance_company: normalizedInsuranceCompany || null,
        insurance_claim_number: normalizedInsuranceClaimNumber || null,
        current_km: normalizedIntakeKm,
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

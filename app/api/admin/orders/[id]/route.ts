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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    if (!id) {
      return NextResponse.json({ error: "ID invalido" }, { status: 400 });
    }

    const workType = normalizeOrderWorkType(body.work_type);
    const intakeReason = String(body.intake_reason || "").trim();

    if (!intakeReason) {
      return NextResponse.json(
        { error: "El motivo de ingreso es obligatorio" },
        { status: 400 }
      );
    }

    const updatePayload = {
      work_type: workType,
      intake_reason: intakeReason,
      customer_concern: String(body.customer_concern || "").trim() || null,
      paint_scope: String(body.paint_scope || "").trim() || null,
      insurance_scope: String(body.insurance_scope || "").trim() || null,
      insurance_company: String(body.insurance_company || "").trim() || null,
      insurance_claim_number:
        String(body.insurance_claim_number || "").trim() || null,
      summary: getOrderSummary(workType, intakeReason),
    };

    const { data, error } = await supabase
      .from("orders")
      .update(updatePayload)
      .eq("id", id)
      .select(
        "id, public_code, work_type, summary, intake_reason, customer_concern, paint_scope, insurance_scope, insurance_company, insurance_claim_number"
      )
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, order: data });
  } catch (error) {
    console.error("PATCH_ORDER_ERROR", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "ID invalido" }, { status: 400 });
    }

    const { data: photos, error: photosError } = await supabase
      .from("order_photos")
      .select("storage_path")
      .eq("order_id", id);

    if (photosError) {
      return NextResponse.json({ error: photosError.message }, { status: 500 });
    }

    const { data: orderFileData } = await supabase
      .from("orders")
      .select("invoice_storage_path")
      .eq("id", id)
      .single();

    const storagePaths = (photos || [])
      .map((photo) => photo.storage_path)
      .filter(Boolean);

    if (orderFileData?.invoice_storage_path) {
      storagePaths.push(orderFileData.invoice_storage_path);
    }

    if (storagePaths.length > 0) {
      await supabase.storage.from("order-photos").remove(storagePaths);
    }

    const cleanupSteps = [
      supabase.from("push_subscriptions").delete().eq("order_id", id),
      supabase.from("order_updates").delete().eq("order_id", id),
      supabase.from("order_quote_items").delete().eq("order_id", id),
      supabase.from("maintenance_plans").delete().eq("source_order_id", id),
    ];

    for (const step of cleanupSteps) {
      const { error } = await step;
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    const { error: deleteOrderError } = await supabase
      .from("orders")
      .delete()
      .eq("id", id);

    if (deleteOrderError) {
      return NextResponse.json(
        { error: deleteOrderError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE_ORDER_ERROR", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

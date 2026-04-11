import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    const storagePaths = (photos || [])
      .map((photo) => photo.storage_path)
      .filter(Boolean);

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

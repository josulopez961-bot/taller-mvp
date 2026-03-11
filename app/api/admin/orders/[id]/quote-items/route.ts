import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "ID de orden invalido" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("order_quote_items")
      .select("*")
      .eq("order_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (error) {
    console.error("QUOTE_ITEMS_GET_ERROR", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { items } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "ID de orden invalido" }, { status: 400 });
    }

    if (!Array.isArray(items)) {
      return NextResponse.json({ error: "Items invalidos" }, { status: 400 });
    }

    await supabase
      .from("order_quote_items")
      .delete()
      .eq("order_id", id);

    const cleanItems = items
      .filter(
        (item) =>
          item &&
          item.category &&
          item.description &&
          String(item.description).trim() !== ""
      )
      .map((item) => ({
        order_id: id,
        category: item.category,
        description: String(item.description).trim(),
        qty: Number(item.qty || 1),
        unit_price: Number(item.unit_price || 0),
      }));

    if (cleanItems.length === 0) {
      return NextResponse.json({ ok: true, inserted: 0 });
    }

    const { error } = await supabase
      .from("order_quote_items")
      .insert(cleanItems);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      inserted: cleanItems.length,
    });
  } catch (error) {
    console.error("QUOTE_ITEMS_SAVE_ERROR", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

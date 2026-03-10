import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request, { params }: any) {
  const { items } = await req.json()

  const orderId = params.id

  // Limpiamos los items anteriores para que si editamos y volvemos a guardar, no se dupliquen.
  await supabase
    .from("order_quote_items")
    .delete()
    .eq("order_id", orderId);

  const rows = items.map((i: any) => ({
    order_id: orderId,
    category: i.category,
    description: i.description,
    qty: i.qty,
    unit_price: i.unit_price
  }))

  const { error } = await supabase
    .from("order_quote_items")
    .insert(rows)

  if (error) {
    return NextResponse.json({ error }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

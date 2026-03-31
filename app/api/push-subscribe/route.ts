import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const { subscription, orderId } = await req.json();
  if (!subscription?.endpoint) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  // Get client_id from order
  const { data: order } = await supabase
    .from("orders")
    .select("id, vehicle:vehicles(customer:customers(id))")
    .eq("id", orderId)
    .single();

  const vehicle = Array.isArray((order as any)?.vehicle)
    ? (order as any).vehicle[0]
    : (order as any)?.vehicle;
  const customer = Array.isArray(vehicle?.customer)
    ? vehicle.customer[0]
    : vehicle?.customer;
  const clientId = customer?.id ?? null;

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      order_id: orderId,
      client_id: clientId,
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

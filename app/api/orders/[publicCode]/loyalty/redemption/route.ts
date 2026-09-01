import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ publicCode: string }> }
) {
  try {
    const { publicCode } = await params;
    const body = await req.json();
    const decision = body.decision === "keep" ? "keep" : "apply";
    const points = body.points ? Math.max(0, Math.floor(Number(body.points))) : null;

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id")
      .eq("public_code", publicCode)
      .maybeSingle();

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 500 });
    }
    if (!order) {
      return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
    }

    const { data, error } = await supabase.rpc("request_loyalty_redemption", {
      p_order_id: order.id,
      p_decision: decision,
      p_points: points,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "No se pudo registrar la decision sobre los puntos" },
      { status: 500 }
    );
  }
}

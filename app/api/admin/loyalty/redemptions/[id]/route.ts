import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if ((await cookies()).get("admin")?.value !== "1") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const action = body.action === "approve" ? "approve" : "reject";
    const now = new Date().toISOString();

    const { data: redemption, error: redemptionError } = await supabase
      .from("loyalty_redemptions")
      .select("id, customer_id, points_requested, status")
      .eq("id", id)
      .maybeSingle();

    if (redemptionError) {
      return NextResponse.json({ error: redemptionError.message }, { status: 500 });
    }
    if (!redemption || redemption.status !== "requested") {
      return NextResponse.json(
        { error: "La solicitud ya fue revisada o no existe" },
        { status: 409 }
      );
    }

    const { data: account } = await supabase
      .from("loyalty_accounts")
      .select("points_balance")
      .eq("customer_id", redemption.customer_id)
      .maybeSingle();

    const approvedPoints = Math.min(
      Number(redemption.points_requested || 0),
      Number(account?.points_balance || 0)
    );

    if (action === "approve" && approvedPoints <= 0) {
      return NextResponse.json({ error: "El cliente ya no tiene saldo disponible" }, { status: 409 });
    }

    const { data, error } = await supabase
      .from("loyalty_redemptions")
      .update({
        status: action === "approve" ? "approved" : "rejected",
        points_approved: action === "approve" ? approvedPoints : null,
        admin_note: String(body.note || "").trim() || null,
        reviewed_at: now,
        updated_at: now,
      })
      .eq("id", id)
      .eq("status", "requested")
      .select("id, status, points_approved")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabase
      .from("admin_notifications")
      .update({ read_at: now })
      .eq("metadata->>redemption_id", id)
      .is("read_at", null);

    return NextResponse.json({ ok: true, redemption: data });
  } catch {
    return NextResponse.json({ error: "No se pudo revisar el canje" }, { status: 500 });
  }
}

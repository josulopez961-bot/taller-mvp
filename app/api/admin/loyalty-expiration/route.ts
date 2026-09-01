import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import webpush from "web-push";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

type AccountRow = {
  customer_id: string;
  points_balance: number;
  last_activity_at: string;
  expiry_notice_stage: number;
  activation_order: { public_code: string | null } | { public_code: string | null }[] | null;
  customer: { full_name: string | null } | { full_name: string | null }[] | null;
};

function single<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] : value;
}

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("loyalty_accounts")
    .select(`
      customer_id, points_balance, last_activity_at, expiry_notice_stage,
      activation_order:orders!loyalty_accounts_activation_order_id_fkey(public_code),
      customer:customers(full_name)
    `)
    .gt("points_balance", 0);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const now = Date.now();
  let expired = 0;
  let warned = 0;

  for (const account of (data || []) as AccountRow[]) {
    const expiresAt = new Date(account.last_activity_at).getTime() + 365 * 86400000;
    const daysLeft = Math.ceil((expiresAt - now) / 86400000);

    if (daysLeft <= 0) {
      const points = Number(account.points_balance || 0);
      const { error: updateError } = await supabase
        .from("loyalty_accounts")
        .update({ points_balance: 0, expiry_notice_stage: 0, updated_at: new Date().toISOString() })
        .eq("customer_id", account.customer_id)
        .eq("points_balance", points);

      if (!updateError) {
        await supabase.from("loyalty_transactions").insert({
          customer_id: account.customer_id,
          transaction_type: "expired",
          points_delta: -points,
          balance_after: 0,
          description: "Puntos vencidos por 12 meses de inactividad",
        });
        expired += 1;
      }
      continue;
    }

    const stage = daysLeft <= 5 ? 5 : daysLeft <= 15 ? 15 : daysLeft <= 30 ? 30 : 0;
    if (!stage || account.expiry_notice_stage === stage) continue;

    const customer = single(account.customer);
    const activationOrder = single(account.activation_order);
    const points = Number(account.points_balance || 0);
    const message = `Tienes ${points.toLocaleString("es-EC")} puntos ($${(points / 100).toFixed(2)}) que vencen en ${daysLeft} días. Agenda mantenimiento, detailing, enderezada o pintura para conservarlos.`;

    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("client_id", account.customer_id);

    const payload = JSON.stringify({
      title: "Tus puntos FINECAR están por vencer",
      body: message,
      url: activationOrder?.public_code ? `/o/${activationOrder.public_code}` : "/",
    });

    await Promise.allSettled(
      (subscriptions || []).map((subscription) =>
        webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          payload
        )
      )
    );

    await Promise.all([
      supabase
        .from("loyalty_accounts")
        .update({ expiry_notice_stage: stage, updated_at: new Date().toISOString() })
        .eq("customer_id", account.customer_id),
      supabase.from("admin_notifications").insert({
        notification_type: "loyalty_expiring",
        title: "Puntos próximos a vencer",
        message: `${customer?.full_name || "Cliente"}: ${message}`,
        customer_id: account.customer_id,
        metadata: { points, days_left: daysLeft },
      }),
    ]);
    warned += 1;
  }

  return NextResponse.json({ ok: true, warned, expired });
}

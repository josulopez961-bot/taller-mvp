import type { SupabaseClient } from "@supabase/supabase-js";

export type LoyaltyLevel = "inicial" | "plata" | "oro" | "platino";

export type LoyaltySnapshot = {
  activated: boolean;
  balance: number;
  balanceUsd: number;
  completedVisits: number;
  level: LoyaltyLevel;
  pointsPerDollar: number;
  nextLevelVisits: number | null;
  lastActivityAt: string | null;
};

export function loyaltyLevelForVisits(visits: number): LoyaltyLevel {
  if (visits >= 4) return "platino";
  if (visits === 3) return "oro";
  if (visits === 2) return "plata";
  return "inicial";
}

export function loyaltyRateForVisits(visits: number) {
  if (visits >= 4) return 5;
  if (visits === 3) return 4;
  if (visits === 2) return 3;
  return 0;
}

export function nextLevelVisits(visits: number) {
  if (visits < 2) return 2;
  if (visits === 2) return 3;
  if (visits === 3) return 4;
  return null;
}

export async function getLoyaltySnapshot(
  supabase: SupabaseClient,
  customerId: string
): Promise<LoyaltySnapshot> {
  const since = new Date();
  since.setFullYear(since.getFullYear() - 1);

  const [{ data: account }, { data: vehicles }] = await Promise.all([
    supabase
      .from("loyalty_accounts")
      .select("points_balance, activated_at, last_activity_at")
      .eq("customer_id", customerId)
      .maybeSingle(),
    supabase.from("vehicles").select("id").eq("customer_id", customerId),
  ]);

  const vehicleIds = (vehicles || []).map((vehicle) => vehicle.id);
  let completedVisits = 0;

  if (vehicleIds.length > 0) {
    const { count } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .in("vehicle_id", vehicleIds)
      .eq("status", "entregado")
      .eq("imported_history", false)
      .gte("delivered_at", since.toISOString());
    completedVisits = count || 0;
  }

  const level = loyaltyLevelForVisits(completedVisits);
  const balance = Number(account?.points_balance || 0);

  return {
    activated: Boolean(account?.activated_at),
    balance,
    balanceUsd: balance / 100,
    completedVisits,
    level,
    pointsPerDollar: loyaltyRateForVisits(completedVisits),
    nextLevelVisits: nextLevelVisits(completedVisits),
    lastActivityAt: account?.last_activity_at || null,
  };
}

export function calculateEligibleLabor(
  items: Array<{ category?: string | null; priority?: string | null; qty?: number | null; unit_price?: number | null }>,
  authorizedPriorities?: string | null
) {
  const authorized = new Set(
    String(authorizedPriorities || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );

  return items.reduce((total, item) => {
    const priority = item.priority || "urgente";
    if (item.category !== "labor" || priority === "especial") return total;
    if (authorized.size > 0 && !authorized.has(priority)) return total;
    return total + Number(item.qty || 0) * Number(item.unit_price || 0);
  }, 0);
}

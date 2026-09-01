"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { LoyaltyLevel } from "@/lib/loyalty";

type Redemption = {
  status: string;
  points_requested: number;
  points_approved: number | null;
} | null;

const LEVEL_LABELS: Record<LoyaltyLevel, string> = {
  inicial: "Inicial",
  plata: "Plata",
  oro: "Oro",
  platino: "Platino",
};

export default function LoyaltyCard({
  publicCode,
  activated,
  balance,
  completedVisits,
  level,
  pointsPerDollar,
  nextLevelVisits,
  laborSubtotal,
  approvalStatus,
  redemption,
}: {
  publicCode: string;
  activated: boolean;
  balance: number;
  completedVisits: number;
  level: LoyaltyLevel;
  pointsPerDollar: number;
  nextLevelVisits: number | null;
  laborSubtotal: number;
  approvalStatus: string | null;
  redemption: Redemption;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const maxRedeemPoints = Math.min(balance, Math.floor(laborSubtotal * 100));
  const canUseOnThisVisit = completedVisits >= 1;

  async function activate() {
    setLoading(true);
    try {
      const response = await fetch(`/api/orders/${publicCode}/loyalty/activate`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo activar");
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "No se pudo activar");
    } finally {
      setLoading(false);
    }
  }

  async function decide(decision: "apply" | "keep") {
    setLoading(true);
    try {
      const response = await fetch(`/api/orders/${publicCode}/loyalty/redemption`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          points: decision === "apply" ? maxRedeemPoints : 0,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo guardar tu decision");
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "No se pudo guardar tu decision");
    } finally {
      setLoading(false);
    }
  }

  if (!activated) {
    return (
      <section className="rounded-2xl border border-orange-500/40 bg-gradient-to-br from-orange-950/40 to-slate-900 p-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-400">
          FINECAR Beneficios
        </p>
        <h2 className="mt-2 text-2xl font-bold">Activa tu cuenta y recibe 200 puntos</h2>
        <p className="mt-2 text-sm text-slate-300">
          Son $2 para aplicar en mano de obra desde tu próxima visita. Agrega FINECAR a la
          pantalla de inicio y mantén aquí tu nivel, visitas y saldo.
        </p>
        <button
          type="button"
          onClick={activate}
          disabled={loading}
          className="mt-4 rounded-xl bg-orange-500 px-5 py-3 font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
        >
          {loading ? "Activando..." : "Activar mis beneficios"}
        </button>
      </section>
    );
  }

  const statusText: Record<string, string> = {
    requested: "Solicitud enviada al taller",
    approved: "Canje aprobado; se aplicará al finalizar",
    rejected: "El taller no aprobó este canje",
    applied: "Puntos aplicados correctamente",
    kept: "Elegiste conservar tus puntos",
    cancelled: "Canje cancelado",
  };

  return (
    <section className="rounded-2xl border border-amber-500/30 bg-slate-900 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400">
            FINECAR Beneficios · {LEVEL_LABELS[level]}
          </p>
          <p className="mt-2 text-3xl font-bold text-white">{balance.toLocaleString("es-EC")} puntos</p>
          <p className="text-sm text-amber-300">Equivalen a ${(balance / 100).toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
          <p>{completedVisits} visita(s) completada(s) en 12 meses</p>
          <p className="mt-1">
            {pointsPerDollar > 0
              ? `Acumulas ${pointsPerDollar} puntos por cada $1 de mano de obra`
              : "En tu segunda visita alcanzas Plata y comienzas a acumular"}
          </p>
          {nextLevelVisits && (
            <p className="mt-1 text-slate-400">
              Te faltan {Math.max(0, nextLevelVisits - completedVisits)} visita(s) para el siguiente nivel.
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-slate-700 bg-slate-950/50 p-4 text-sm text-slate-300">
        <p className="font-semibold text-white">Cómo funcionan tus puntos</p>
        <p className="mt-2 leading-relaxed">
          Cada 100 puntos equivalen a $1. Puedes cubrir hasta el 100 % de la mano de obra,
          pero no repuestos, materiales, impuestos ni servicios de terceros. No se cambian
          por efectivo ni se transfieren. Se descuentan al terminar y pagar la orden; si se
          cancela, regresan a tu saldo. Vencen después de 12 meses sin actividad.
        </p>
      </div>

      {redemption ? (
        <div className="mt-4 rounded-xl border border-blue-700/50 bg-blue-950/30 p-4 text-blue-200">
          <p className="font-semibold">{statusText[redemption.status] || redemption.status}</p>
          {(redemption.points_approved || redemption.points_requested) > 0 && (
            <p className="mt-1 text-sm">
              {Number(redemption.points_approved || redemption.points_requested).toLocaleString("es-EC")} puntos ·
              ${(Number(redemption.points_approved || redemption.points_requested) / 100).toFixed(2)}
            </p>
          )}
        </div>
      ) : approvalStatus === "aprobado" && laborSubtotal > 0 ? (
        <div className="mt-5">
          <p className="text-sm text-slate-300">
            Mano de obra autorizada: <strong className="text-white">${laborSubtotal.toFixed(2)}</strong>
          </p>
          {!canUseOnThisVisit ? (
            <p className="mt-3 rounded-xl border border-slate-700 bg-slate-950/50 p-4 text-sm text-slate-400">
              Tu bono de bienvenida estará disponible desde tu segunda visita.
            </p>
          ) : (
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => decide("apply")}
                disabled={loading || maxRedeemPoints <= 0}
                className="rounded-xl bg-amber-500 px-5 py-3 font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
              >
                Aplicar {maxRedeemPoints.toLocaleString("es-EC")} puntos (${(maxRedeemPoints / 100).toFixed(2)})
              </button>
              <button
                type="button"
                onClick={() => decide("keep")}
                disabled={loading}
                className="rounded-xl border border-slate-600 px-5 py-3 font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50"
              >
                Conservar mis puntos
              </button>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

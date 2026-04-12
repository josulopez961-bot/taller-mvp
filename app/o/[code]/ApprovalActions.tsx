"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Group = {
  key: string;
  label: string;
  color: string;
  total: number;
  count: number;
};

export default function ApprovalActions({
  publicCode,
  approvalStatus,
  orderStatus,
  authorizedPriorities,
  groups,
}: {
  publicCode: string;
  approvalStatus: string | null;
  orderStatus: string | null;
  authorizedPriorities?: string | null;
  groups: Group[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string[]>(
    groups.filter((g) => g.count > 0).map((g) => g.key)
  );

  const normalizedStatus = orderStatus === "prueba" ? "pruebas" : orderStatus;
  const canApprove = normalizedStatus === "diagnostico";

  const availableGroups = groups.filter((g) => g.count > 0);
  const selectedTotal = availableGroups
    .filter((g) => selected.includes(g.key))
    .reduce((sum, g) => sum + g.total, 0);

  function toggleGroup(key: string) {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  async function handleApprove() {
    if (!canApprove || selected.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${publicCode}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorized_priorities: selected.join(",") }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "No se pudo autorizar");
        return;
      }
      router.refresh();
    } catch {
      alert("Error al autorizar");
    } finally {
      setLoading(false);
    }
  }

  async function handleReject() {
    if (!canApprove) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${publicCode}/reject`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "No se pudo rechazar");
        return;
      }
      router.refresh();
    } catch {
      alert("Error al rechazar");
    } finally {
      setLoading(false);
    }
  }

  if (!canApprove) return null;

  if (approvalStatus === "aprobado") {
    const labels: Record<string, string> = {
      urgente: "Mantenimiento necesario",
      recomendado: "Puede dañarse",
      opcional: "Recomendado",
    };
    const authorized = authorizedPriorities?.split(",") || [];
    return (
      <div className="mt-6 space-y-2 rounded-xl border border-green-700 bg-green-900/30 p-4 text-green-300">
        <p className="font-semibold">
          Proforma autorizada. El taller revisara el inicio del trabajo.
        </p>
        {authorized.length > 0 && (
          <div className="text-sm text-green-200/80">
            <p className="mb-1 font-medium">Servicios autorizados:</p>
            <ul className="list-inside list-disc space-y-0.5">
              {authorized.map((p) => (
                <li key={p}>{labels[p] || p}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  if (approvalStatus === "rechazado") {
    return (
      <div className="mt-6 rounded-xl border border-red-700 bg-red-900/30 p-4 text-red-300">
        Proforma no autorizada.
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <p className="text-sm text-slate-400">
        Revisa la proforma, selecciona que servicios deseas autorizar y
        confirma:
      </p>

      {availableGroups.length > 0 && (
        <div className="space-y-2">
          {availableGroups.map((g) => (
            <label
              key={g.key}
              className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 transition-colors ${
                selected.includes(g.key)
                  ? `border-${g.color}-600 bg-${g.color}-950/30`
                  : "border-slate-700 bg-slate-800/40 opacity-60"
              }`}
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selected.includes(g.key)}
                  onChange={() => toggleGroup(g.key)}
                  className="h-4 w-4 rounded accent-orange-500"
                />
                <span className={`text-sm font-medium text-${g.color}-400`}>
                  {g.label}
                </span>
              </div>
              <span className="text-sm font-semibold text-slate-300">
                ${g.total.toFixed(2)}
              </span>
            </label>
          ))}

          <div className="flex items-center justify-between border-t border-slate-700 pt-2">
            <span className="text-sm font-semibold text-white">
              Total de la proforma
            </span>
            <span className="text-lg font-bold text-orange-400">
              ${selectedTotal.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      <div className="flex gap-4">
        <button
          onClick={handleApprove}
          disabled={loading || selected.length === 0}
          className="rounded-xl bg-orange-500 px-6 py-3 font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
        >
          {loading ? "Procesando..." : "Autorizar proforma"}
        </button>

        <button
          onClick={handleReject}
          disabled={loading}
          className="rounded-xl border border-red-500 px-6 py-3 font-semibold text-red-400 hover:bg-red-900/30 disabled:opacity-60"
        >
          No autorizar
        </button>
      </div>
    </div>
  );
}

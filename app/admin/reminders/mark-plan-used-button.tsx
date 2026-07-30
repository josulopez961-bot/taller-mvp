"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MarkPlanUsedButton({ planId }: { planId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function markUsed() {
    const confirmed = window.confirm(
      "¿Marcar este mantenimiento como realizado? Ya no aparecerá en recordatorios ni emails."
    );

    if (!confirmed) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/maintenance-plans/${planId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "used" }),
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "No se pudo actualizar el mantenimiento.");
        return;
      }

      router.refresh();
    } catch {
      alert("Error al actualizar el mantenimiento.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={markUsed}
      disabled={loading}
      className="inline-flex items-center justify-center rounded-xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-60"
    >
      {loading ? "Marcando..." : "Realizado"}
    </button>
  );
}

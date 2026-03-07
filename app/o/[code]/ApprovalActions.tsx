"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ApprovalActions({
  publicCode,
  approvalStatus,
  orderStatus,
}: {
  publicCode: string;
  approvalStatus: string | null;
  orderStatus: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const normalizedStatus = orderStatus === "prueba" ? "pruebas" : orderStatus;
  const canApprove = normalizedStatus === "diagnostico";

  async function handleAction(action: "approve" | "reject") {
    if (!canApprove) return;

    setLoading(true);

    try {
      const res = await fetch(`/api/orders/${publicCode}/${action}`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "No se pudo actualizar la autorización");
        return;
      }

      router.refresh();
    } catch (error) {
      console.error("APPROVAL_ACTION_ERROR", error);
      alert("Error al actualizar autorización");
    } finally {
      setLoading(false);
    }
  }

  if (!canApprove) return null;

  if (approvalStatus === "aprobado") {
    return (
      <div className="mt-6 rounded-xl border border-green-700 bg-green-900/30 p-4 text-green-300">
        ✔ Presupuesto autorizado. El taller revisará el inicio de la reparación.
      </div>
    );
  }

  if (approvalStatus === "rechazado") {
    return (
      <div className="mt-6 rounded-xl border border-red-700 bg-red-900/30 p-4 text-red-300">
        ✖ Presupuesto no autorizado.
      </div>
    );
  }

  return (
    <div className="mt-6">
      <p className="mb-4 text-sm text-slate-400">
        Revisa el diagnóstico y el presupuesto antes de autorizar el trabajo.
      </p>

      <div className="flex gap-4">
        <button
          onClick={() => handleAction("approve")}
          disabled={loading}
          className="rounded-xl bg-orange-500 px-6 py-3 font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
        >
          {loading ? "Procesando..." : "Autorizar reparación"}
        </button>

        <button
          onClick={() => handleAction("reject")}
          disabled={loading}
          className="rounded-xl border border-red-500 px-6 py-3 font-semibold text-red-400 hover:bg-red-900/30 disabled:opacity-60"
        >
          No autorizar
        </button>
      </div>
    </div>
  );
}

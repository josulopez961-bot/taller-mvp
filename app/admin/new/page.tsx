"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type FormState = {
  plate: string;
  customer_name: string;
  whatsapp: string;
  make: string;
  model: string;
  year: string;
  summary: string;
  estimated_delivery_date: string;
  diagnosis_detail: string;
  repair_detail: string;
  repair_cost: string;
};

const initialForm: FormState = {
  plate: "",
  customer_name: "",
  whatsapp: "",
  make: "",
  model: "",
  year: "",
  summary: "",
  estimated_delivery_date: "",
  diagnosis_detail: "",
  repair_detail: "",
  repair_cost: "",
};

export default function AdminNewOrderPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(false);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/admin/orders/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plate: form.plate.trim().toUpperCase(),
          customer_name: form.customer_name.trim(),
          whatsapp: form.whatsapp.trim(),
          make: form.make.trim() || null,
          model: form.model.trim() || null,
          year: form.year ? Number(form.year) : null,
          summary: form.summary.trim() || null,
          estimated_delivery_date: form.estimated_delivery_date || null,
          diagnosis_detail: form.diagnosis_detail.trim() || null,
          repair_detail: form.repair_detail.trim() || null,
          repair_cost: form.repair_cost ? Number(form.repair_cost) : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "No se pudo crear la orden");
        return;
      }

      if (data.publicUrl) {
        try {
          await navigator.clipboard.writeText(data.publicUrl);
        } catch {
          console.warn("No se pudo copiar el link automáticamente");
        }
      }

      router.push("/admin/orders");
      router.refresh();
    } catch (error) {
      console.error("CREATE_ORDER_FORM_ERROR", error);
      alert("Ocurrió un error al crear la orden");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#050816] text-white p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Nueva orden</h1>
        <p className="mt-2 text-sm text-slate-400">
          Crea una orden rápida y deja listo el detalle para aprobación del
          cliente.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          name="plate"
          placeholder="Placa"
          value={form.plate}
          onChange={handleChange}
          className="w-full rounded-xl border border-slate-700 bg-slate-950 text-white placeholder:text-slate-400 p-3 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
          required
        />

        <input
          name="customer_name"
          placeholder="Nombre del cliente"
          value={form.customer_name}
          onChange={handleChange}
          className="w-full rounded-xl border border-slate-700 bg-slate-950 text-white placeholder:text-slate-400 p-3 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
          required
        />

        <input
          name="whatsapp"
          placeholder="WhatsApp"
          value={form.whatsapp}
          onChange={handleChange}
          className="w-full rounded-xl border border-slate-700 bg-slate-950 text-white placeholder:text-slate-400 p-3 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
          required
        />

        <div className="grid gap-4 md:grid-cols-3">
          <input
            name="make"
            placeholder="Marca"
            value={form.make}
            onChange={handleChange}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 text-white placeholder:text-slate-400 p-3 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
          />

          <input
            name="model"
            placeholder="Modelo"
            value={form.model}
            onChange={handleChange}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 text-white placeholder:text-slate-400 p-3 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
          />

          <input
            name="year"
            type="number"
            placeholder="Año"
            value={form.year}
            onChange={handleChange}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 text-white placeholder:text-slate-400 p-3 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
          />
        </div>

        <textarea
          name="summary"
          placeholder="Resumen del servicio"
          value={form.summary}
          onChange={handleChange}
          className="min-h-[110px] w-full rounded-xl border border-slate-700 bg-slate-950 text-white placeholder:text-slate-400 p-3 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
        />

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Fecha estimada de entrega
            </label>
            <input
              name="estimated_delivery_date"
              type="date"
              value={form.estimated_delivery_date}
              onChange={handleChange}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 text-white placeholder:text-slate-400 p-3 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Costo estimado de reparación
            </label>
            <input
              name="repair_cost"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={form.repair_cost}
              onChange={handleChange}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 text-white placeholder:text-slate-400 p-3 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
            />
          </div>
        </div>

        <textarea
          name="diagnosis_detail"
          placeholder="Detalle del diagnóstico"
          value={form.diagnosis_detail}
          onChange={handleChange}
          className="min-h-[130px] w-full rounded-xl border border-slate-700 bg-slate-950 text-white placeholder:text-slate-400 p-3 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
        />

        <textarea
          name="repair_detail"
          placeholder="Detalle de reparación a realizar"
          value={form.repair_detail}
          onChange={handleChange}
          className="min-h-[130px] w-full rounded-xl border border-slate-700 bg-slate-950 text-white placeholder:text-slate-400 p-3 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
        />

        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-orange-500 px-5 py-3 font-semibold text-white transition hover:bg-orange-600 disabled:opacity-60"
        >
          {loading ? "Creando..." : "Crear orden"}
        </button>
      </form>
    </div>
  );
}


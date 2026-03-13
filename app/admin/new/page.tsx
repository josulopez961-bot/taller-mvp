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
  engine: string;
  intake_km: string;
  intake_reason: string;
  estimated_delivery_date: string;
};

const initialForm: FormState = {
  plate: "",
  customer_name: "",
  whatsapp: "",
  make: "",
  model: "",
  year: "",
  engine: "",
  intake_km: "",
  intake_reason: "",
  estimated_delivery_date: "",
};

const inputClass =
  "w-full rounded-xl border border-slate-700 bg-slate-950 text-white placeholder:text-slate-400 p-3 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500";

const sectionLabel =
  "text-xs font-semibold uppercase tracking-widest text-orange-400 mb-3";

export default function AdminNewOrderPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(false);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/admin/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plate: form.plate.trim().toUpperCase(),
          customer_name: form.customer_name.trim(),
          whatsapp: form.whatsapp.trim(),
          make: form.make.trim() || null,
          model: form.model.trim() || null,
          year: form.year ? Number(form.year) : null,
          engine: form.engine.trim() || null,
          intake_km: form.intake_km ? Number(form.intake_km) : null,
          intake_reason: form.intake_reason.trim() || null,
          estimated_delivery_date: form.estimated_delivery_date || null,
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
        <p className="mt-1 text-sm text-slate-400">
          Registra el ingreso en menos de 30 segundos.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8 max-w-2xl">

        {/* CLIENTE */}
        <section>
          <p className={sectionLabel}>Cliente</p>
          <div className="space-y-3">
            <input
              name="customer_name"
              placeholder="Nombre completo"
              value={form.customer_name}
              onChange={handleChange}
              className={inputClass}
              required
            />
            <input
              name="whatsapp"
              placeholder="WhatsApp (ej. 593999123456)"
              value={form.whatsapp}
              onChange={handleChange}
              className={inputClass}
              required
            />
          </div>
        </section>

        {/* VEHÍCULO */}
        <section>
          <p className={sectionLabel}>Vehículo</p>
          <div className="space-y-3">
            <input
              name="plate"
              placeholder="Placa *"
              value={form.plate}
              onChange={handleChange}
              className={inputClass}
              required
            />
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
              <input
                name="make"
                placeholder="Marca"
                value={form.make}
                onChange={handleChange}
                className={inputClass}
              />
              <input
                name="model"
                placeholder="Modelo"
                value={form.model}
                onChange={handleChange}
                className={inputClass}
              />
              <input
                name="year"
                type="number"
                placeholder="Año"
                value={form.year}
                onChange={handleChange}
                className={inputClass}
              />
              <input
                name="engine"
                placeholder="Motor (ej. 2.0L)"
                value={form.engine}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
          </div>
        </section>

        {/* INGRESO */}
        <section>
          <p className={sectionLabel}>Ingreso</p>
          <div className="space-y-3">
            <textarea
              name="intake_reason"
              placeholder="Motivo de ingreso — lo que reporta el cliente (ej: ruido en suspensión, no carga batería)"
              value={form.intake_reason}
              onChange={handleChange}
              className={`${inputClass} min-h-[90px]`}
            />
            <div className="grid gap-3 grid-cols-2">
              <input
                name="intake_km"
                type="number"
                placeholder="KM al ingreso"
                value={form.intake_km}
                onChange={handleChange}
                className={inputClass}
              />
              <div>
                <label className="mb-1 block text-xs text-slate-400">
                  Fecha estimada de entrega
                </label>
                <input
                  name="estimated_delivery_date"
                  type="date"
                  value={form.estimated_delivery_date}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        </section>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-orange-500 px-5 py-4 font-semibold text-white text-lg transition hover:bg-orange-600 disabled:opacity-60"
        >
          {loading ? "Creando..." : "Crear orden →"}
        </button>
      </form>
    </div>
  );
}

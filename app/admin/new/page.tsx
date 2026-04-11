"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ORDER_WORK_TYPES,
  ORDER_WORK_TYPE_LABELS,
  type OrderWorkType,
} from "@/lib/order-work-types";

type FormState = {
  plate: string;
  customer_name: string;
  whatsapp: string;
  make: string;
  model: string;
  year: string;
  engine: string;
  intake_km: string;
  work_type: OrderWorkType;
  intake_reason: string;
  customer_concern: string;
  paint_scope: string;
  insurance_scope: string;
  insurance_company: string;
  insurance_claim_number: string;
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
  work_type: "mantenimiento",
  intake_reason: "",
  customer_concern: "",
  paint_scope: "",
  insurance_scope: "",
  insurance_company: "",
  insurance_claim_number: "",
  estimated_delivery_date: "",
};

const inputClass =
  "w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white placeholder:text-slate-400 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500";

const sectionLabel =
  "mb-3 text-xs font-semibold uppercase tracking-widest text-orange-400";

export default function AdminNewOrderPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(false);

  const isMaintenance = form.work_type === "mantenimiento";
  const isPaint = form.work_type === "pintura";
  const isIssue = form.work_type === "falla_puntual";
  const isInsurance = form.work_type === "aseguradora";

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
          work_type: form.work_type,
          intake_reason: form.intake_reason.trim() || null,
          customer_concern: form.customer_concern.trim() || null,
          paint_scope: form.paint_scope.trim() || null,
          insurance_scope: form.insurance_scope.trim() || null,
          insurance_company: form.insurance_company.trim() || null,
          insurance_claim_number: form.insurance_claim_number.trim() || null,
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
          console.warn("No se pudo copiar el link automaticamente");
        }
      }

      router.push("/admin/orders");
      router.refresh();
    } catch (error) {
      console.error("CREATE_ORDER_FORM_ERROR", error);
      alert("Ocurrio un error al crear la orden");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#050816] p-6 text-white">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Nueva orden</h1>
        <p className="mt-1 text-sm text-slate-400">
          Usa el mismo flujo base del MVP y abre nuevas areas sin complicarlo.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-8">
        <section>
          <p className={sectionLabel}>Tipo de trabajo</p>
          <div className="grid gap-3 md:grid-cols-2">
            {ORDER_WORK_TYPES.map((workType) => (
              <label
                key={workType}
                className={`rounded-2xl border p-4 transition ${
                  form.work_type === workType
                    ? "border-orange-500 bg-orange-500/10"
                    : "border-slate-800 bg-slate-900"
                }`}
              >
                <input
                  type="radio"
                  name="work_type"
                  value={workType}
                  checked={form.work_type === workType}
                  onChange={handleChange}
                  className="sr-only"
                />
                <p className="font-semibold text-white">
                  {ORDER_WORK_TYPE_LABELS[workType]}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  {workType === "mantenimiento" &&
                    "Servicios periodicos y revisiones preventivas."}
                  {workType === "pintura" &&
                    "Trabajo estetico, retoque o repintado de piezas."}
                  {workType === "falla_puntual" &&
                    "Dolor puntual o sintoma especifico reportado por el cliente."}
                  {workType === "aseguradora" &&
                    "Choque, siniestro o trabajo gestionado con aseguradora."}
                </p>
              </label>
            ))}
          </div>
        </section>

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

        <section>
          <p className={sectionLabel}>Vehiculo</p>
          <div className="space-y-3">
            <input
              name="plate"
              placeholder="Placa *"
              value={form.plate}
              onChange={handleChange}
              className={inputClass}
              required
            />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
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

        <section>
          <p className={sectionLabel}>Ingreso</p>
          <div className="space-y-3">
            <textarea
              name="intake_reason"
              placeholder={
                isMaintenance
                  ? "Servicio solicitado o mantenimiento a realizar"
                  : isPaint
                  ? "Que pieza o area requiere pintura"
                  : isInsurance
                  ? "Resumen inicial del siniestro o alcance"
                  : "Motivo de ingreso y sintoma reportado"
              }
              value={form.intake_reason}
              onChange={handleChange}
              className={`${inputClass} min-h-[90px]`}
              required
            />

            {(isIssue || isInsurance) && (
              <textarea
                name="customer_concern"
                placeholder="Que siente o reporta especificamente el cliente"
                value={form.customer_concern}
                onChange={handleChange}
                className={`${inputClass} min-h-[90px]`}
              />
            )}

            {isPaint && (
              <textarea
                name="paint_scope"
                placeholder="Alcance de pintura: piezas, color, retoque o repintado"
                value={form.paint_scope}
                onChange={handleChange}
                className={`${inputClass} min-h-[90px]`}
              />
            )}

            {isInsurance && (
              <>
                <textarea
                  name="insurance_scope"
                  placeholder="Alcance inicial para aseguradora o choque"
                  value={form.insurance_scope}
                  onChange={handleChange}
                  className={`${inputClass} min-h-[90px]`}
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    name="insurance_company"
                    placeholder="Aseguradora"
                    value={form.insurance_company}
                    onChange={handleChange}
                    className={inputClass}
                  />
                  <input
                    name="insurance_claim_number"
                    placeholder="Siniestro / referencia"
                    value={form.insurance_claim_number}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
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
          className="w-full rounded-xl bg-orange-500 px-5 py-4 text-lg font-semibold text-white transition hover:bg-orange-600 disabled:opacity-60"
        >
          {loading ? "Creando..." : "Guardar ingreso →"}
        </button>
      </form>
    </div>
  );
}

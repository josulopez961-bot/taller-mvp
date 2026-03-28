"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

type ServiceItem = { description: string; price: string };

function NewHistoryForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  // Vehículo & cliente
  const [plate, setPlate] = useState(searchParams.get("plate") || "");
  const [customerName, setCustomerName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [make, setMake] = useState(searchParams.get("make") || "");
  const [model, setModel] = useState(searchParams.get("model") || "");
  const [year, setYear] = useState("");
  const [engine, setEngine] = useState("");

  // Servicio
  const [serviceDate, setServiceDate] = useState("");
  const [km, setKm] = useState("");
  const [summary, setSummary] = useState("");
  const [items, setItems] = useState<ServiceItem[]>([{ description: "", price: "" }]);

  function addItem() {
    setItems((prev) => [...prev, { description: "", price: "" }]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, field: keyof ServiceItem, value: string) {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  }

  const total = items.reduce((sum, i) => sum + (Number(i.price) || 0), 0);

  async function handleSave() {
    if (!plate || !customerName || !whatsapp || !serviceDate) {
      alert("Completa placa, cliente, WhatsApp y fecha del servicio.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/orders/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plate, customer_name: customerName, whatsapp, make, model,
          year: year ? Number(year) : null, engine, service_date: serviceDate,
          km, summary,
          items: items.filter((i) => i.description.trim()),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "No se pudo guardar");
        return;
      }
      setSaved(data.public_code);
    } catch {
      alert("Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-green-800/40 bg-green-950/20 p-8 text-center space-y-4">
          <div className="text-4xl">✅</div>
          <h2 className="text-xl font-bold text-white">Historial registrado</h2>
          <p className="text-green-300">Código: <span className="font-bold">{saved}</span></p>
          <div className="flex gap-3 justify-center pt-2">
            <button
              onClick={() => { setSaved(null); setPlate(""); setCustomerName(""); setWhatsapp(""); setMake(""); setModel(""); setYear(""); setEngine(""); setServiceDate(""); setKm(""); setSummary(""); setItems([{ description: "", price: "" }]); }}
              className="rounded-xl bg-orange-500 hover:bg-orange-600 px-5 py-2 font-semibold"
            >
              + Agregar otro
            </button>
            <Link href="/admin/orders" className="rounded-xl border border-slate-600 hover:bg-slate-800 px-5 py-2 font-semibold">
              Ir a órdenes
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/admin/orders" className="text-slate-400 hover:text-white text-sm">← Órdenes</Link>
          <h1 className="text-2xl font-bold">Registrar servicio anterior</h1>
        </div>

        <p className="text-slate-400 text-sm">
          Registra un servicio realizado antes de usar la app. Quedará en el historial clínico del vehículo como entregado.
        </p>

        {/* Vehículo & Cliente */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
          <h2 className="font-semibold text-white text-lg">Vehículo y cliente</h2>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs text-slate-400 mb-1">Placa *</label>
              <input value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} placeholder="PPM0795" className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white text-sm outline-none focus:border-orange-500" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs text-slate-400 mb-1">Motor</label>
              <input value={engine} onChange={(e) => setEngine(e.target.value)} placeholder="2.0L" className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white text-sm outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Marca</label>
              <input value={make} onChange={(e) => setMake(e.target.value)} placeholder="Mitsubishi" className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white text-sm outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Modelo</label>
              <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Montero" className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white text-sm outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Año</label>
              <input value={year} onChange={(e) => setYear(e.target.value)} placeholder="2018" type="number" className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white text-sm outline-none focus:border-orange-500" />
            </div>
          </div>

          <div className="border-t border-slate-700 pt-4 grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Nombre del cliente *</label>
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Pablo Lopez" className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white text-sm outline-none focus:border-orange-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1">WhatsApp *</label>
              <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="593999000000" className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white text-sm outline-none focus:border-orange-500" />
            </div>
          </div>
        </section>

        {/* Datos del servicio */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
          <h2 className="font-semibold text-white text-lg">Datos del servicio</h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Fecha del servicio *</label>
              <input value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} type="date" className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white text-sm outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Kilómetros al momento</label>
              <input value={km} onChange={(e) => setKm(e.target.value)} type="number" placeholder="229002" className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white text-sm outline-none focus:border-orange-500" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Resumen del servicio</label>
            <textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Mantenimiento de 229.000 km — cambio de aceite, filtro, revisión general" rows={2} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white text-sm outline-none focus:border-orange-500" />
          </div>
        </section>

        {/* Servicios realizados */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
          <h2 className="font-semibold text-white text-lg">Servicios realizados</h2>

          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  value={item.description}
                  onChange={(e) => updateItem(idx, "description", e.target.value)}
                  placeholder="Ej: Cambio de aceite 10W40"
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white text-sm outline-none focus:border-orange-500"
                />
                <input
                  value={item.price}
                  onChange={(e) => updateItem(idx, "price", e.target.value)}
                  type="number"
                  placeholder="$0"
                  className="w-24 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white text-sm outline-none focus:border-orange-500"
                />
                {items.length > 1 && (
                  <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-300 px-2 text-lg font-bold">×</button>
                )}
              </div>
            ))}
          </div>

          <button onClick={addItem} className="text-sm text-orange-400 hover:text-orange-300">+ Agregar servicio</button>

          {total > 0 && (
            <div className="flex justify-between items-center pt-2 border-t border-slate-700">
              <span className="text-sm text-slate-400">Total del servicio</span>
              <span className="font-bold text-orange-400">${total.toFixed(2)}</span>
            </div>
          )}
        </section>

        {/* Guardar */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-xl bg-orange-500 hover:bg-orange-600 py-3 font-bold text-white disabled:opacity-60"
        >
          {saving ? "Guardando..." : "Guardar en historial"}
        </button>
      </div>
    </div>
  );
}

export default function NewHistoryPage() {
  return (
    <Suspense>
      <NewHistoryForm />
    </Suspense>
  );
}

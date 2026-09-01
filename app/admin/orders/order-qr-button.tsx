"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

export default function OrderQrButton({ publicCode }: { publicCode: string }) {
  const [open, setOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    if (!open) return;
    const url = `${window.location.origin}/o/${publicCode}`;
    QRCode.toDataURL(url, {
      width: 320,
      margin: 2,
      color: { dark: "#050816", light: "#ffffff" },
      errorCorrectionLevel: "M",
    }).then(setQrDataUrl);
  }, [open, publicCode]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex justify-center rounded-lg bg-amber-600 px-3 py-2 hover:bg-amber-500"
      >
        Mostrar QR
      </button>

      {open && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-950 p-6 text-center shadow-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400">
              FINECAR Beneficios
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white">Escanea para activar beneficios</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Abre el seguimiento de la orden {publicCode}, permite instalar FINECAR y entrega el bono de bienvenida.
            </p>
            <div className="mx-auto mt-5 flex min-h-80 w-80 items-center justify-center rounded-2xl bg-white p-3">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt={`QR de la orden ${publicCode}`} className="h-full w-full" />
              ) : (
                <span className="text-sm text-zinc-600">Generando QR...</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-5 w-full rounded-xl border border-zinc-600 px-5 py-3 font-semibold text-zinc-200 hover:bg-zinc-800"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </>
  );
}

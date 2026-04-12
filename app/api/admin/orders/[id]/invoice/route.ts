import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data, error } = await supabase
    .from("orders")
    .select("invoice_url, invoice_file_name, invoice_uploaded_at")
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    invoice_url: data?.invoice_url ?? null,
    invoice_file_name: data?.invoice_file_name ?? null,
    invoice_uploaded_at: data?.invoice_uploaded_at ?? null,
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 });
  }

  const { data: currentOrder } = await supabase
    .from("orders")
    .select("invoice_storage_path")
    .eq("id", id)
    .single();

  if (currentOrder?.invoice_storage_path) {
    await supabase.storage
      .from("order-photos")
      .remove([currentOrder.invoice_storage_path]);
  }

  const ext = file.name.split(".").pop() || "pdf";
  const storagePath = `${id}/invoice-${Date.now()}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  const { error: uploadError } = await supabase.storage
    .from("order-photos")
    .upload(storagePath, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = supabase.storage
    .from("order-photos")
    .getPublicUrl(storagePath);

  const invoiceUrl = urlData.publicUrl;

  const { error } = await supabase
    .from("orders")
    .update({
      invoice_url: invoiceUrl,
      invoice_storage_path: storagePath,
      invoice_file_name: file.name,
      invoice_uploaded_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    invoice_url: invoiceUrl,
    invoice_file_name: file.name,
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: order, error: fetchError } = await supabase
    .from("orders")
    .select("invoice_storage_path")
    .eq("id", id)
    .single();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (order?.invoice_storage_path) {
    await supabase.storage
      .from("order-photos")
      .remove([order.invoice_storage_path]);
  }

  const { error } = await supabase
    .from("orders")
    .update({
      invoice_url: null,
      invoice_storage_path: null,
      invoice_file_name: null,
      invoice_uploaded_at: null,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

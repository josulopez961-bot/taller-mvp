import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/admin/orders/[id]/photos
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data, error } = await supabase
    .from("order_photos")
    .select("id, url, created_at")
    .eq("order_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/admin/orders/[id]/photos
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

  const ext = file.name.split(".").pop() || "jpg";
  const storagePath = `${id}/${Date.now()}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  const { error: uploadError } = await supabase.storage
    .from("order-photos")
    .upload(storagePath, buffer, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = supabase.storage
    .from("order-photos")
    .getPublicUrl(storagePath);

  const publicUrl = urlData.publicUrl;

  const { data: photo, error: dbError } = await supabase
    .from("order_photos")
    .insert({ order_id: id, url: publicUrl, storage_path: storagePath })
    .select("id, url, created_at")
    .single();

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json(photo, { status: 201 });
}

// DELETE /api/admin/orders/[id]/photos?photoId=xxx
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const photoId = searchParams.get("photoId");

  if (!photoId) {
    return NextResponse.json({ error: "Falta photoId" }, { status: 400 });
  }

  const { data: photo, error: fetchError } = await supabase
    .from("order_photos")
    .select("storage_path")
    .eq("id", photoId)
    .eq("order_id", id)
    .single();

  if (fetchError || !photo) {
    return NextResponse.json({ error: "Foto no encontrada" }, { status: 404 });
  }

  await supabase.storage.from("order-photos").remove([photo.storage_path]);

  await supabase.from("order_photos").delete().eq("id", photoId);

  return NextResponse.json({ ok: true });
}

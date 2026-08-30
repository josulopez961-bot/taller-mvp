import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizePlate, normalizeWhatsapp } from "@/lib/customer-identity";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type VehicleRow = {
  id: string;
  plate: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  engine: string | null;
  odometer_unit: string | null;
};

type CustomerRow = {
  id: string;
  full_name: string | null;
  whatsapp: string | null;
  vehicles: VehicleRow[] | null;
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q")?.trim() || "";

  if (query.length < 2) {
    return NextResponse.json({ customers: [] });
  }

  const normalizedPhone = normalizeWhatsapp(query);
  const normalizedPlate = normalizePlate(query);
  const customerFilters = [
    `full_name.ilike.%${query}%`,
    `whatsapp.ilike.%${query}%`,
  ];

  if (normalizedPhone) {
    customerFilters.push(`whatsapp.ilike.%${normalizedPhone}%`);
  }

  const { data: customersData, error: customersError } = await supabase
    .from("customers")
    .select(`
      id,
      full_name,
      whatsapp,
      vehicles (
        id,
        plate,
        make,
        model,
        year,
        engine,
        odometer_unit
      )
    `)
    .or(customerFilters.join(","))
    .order("full_name", { ascending: true })
    .limit(8);

  if (customersError) {
    return NextResponse.json({ error: customersError.message }, { status: 500 });
  }

  let customers = (customersData || []) as CustomerRow[];

  if (normalizedPlate.length >= 2) {
    const { data: vehiclesData, error: vehiclesError } = await supabase
      .from("vehicles")
      .select(`
        id,
        plate,
        make,
        model,
        year,
        engine,
        odometer_unit,
        customer:customers (
          id,
          full_name,
          whatsapp
        )
      `)
      .ilike("plate", `%${normalizedPlate}%`)
      .limit(8);

    if (vehiclesError) {
      return NextResponse.json({ error: vehiclesError.message }, { status: 500 });
    }

    for (const vehicle of vehiclesData || []) {
      const customer = Array.isArray(vehicle.customer)
        ? vehicle.customer[0]
        : vehicle.customer;

      if (!customer || customers.some((item) => item.id === customer.id)) {
        continue;
      }

      customers.push({
        id: customer.id,
        full_name: customer.full_name,
        whatsapp: customer.whatsapp,
        vehicles: [
          {
            id: vehicle.id,
            plate: vehicle.plate,
            make: vehicle.make,
            model: vehicle.model,
            year: vehicle.year,
            engine: vehicle.engine,
            odometer_unit: vehicle.odometer_unit,
          },
        ],
      });
    }
  }

  customers = customers.slice(0, 8);

  return NextResponse.json({
    customers: customers.map((customer) => ({
      id: customer.id,
      full_name: customer.full_name || "",
      whatsapp: customer.whatsapp || "",
      vehicles: (customer.vehicles || []).map((vehicle) => ({
        id: vehicle.id,
        plate: vehicle.plate || "",
        make: vehicle.make || "",
        model: vehicle.model || "",
        year: vehicle.year ? String(vehicle.year) : "",
        engine: vehicle.engine || "",
        odometer_unit: vehicle.odometer_unit === "mi" ? "mi" : "km",
      })),
    })),
  });
}

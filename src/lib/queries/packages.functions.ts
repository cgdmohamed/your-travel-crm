import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-middleware";
import { query, queryOne } from "@/lib/db.server";
import { toNum } from "@/lib/queries/_shared.server";
import type { TourPackage } from "@/lib/crm-data";

type PackageRow = {
  id: string;
  name: string;
  destination: string;
  nights: number;
  price: string | number;
  seats: number;
  seats_taken: number;
  status: TourPackage["status"];
  category: TourPackage["category"];
  room_basis: TourPackage["roomBasis"];
  image_url: string | null;
  gallery: string[] | null;
  includes: string[] | null;
  excludes: string[] | null;
  wp_id: number | null;
  wp_slug: string | null;
};

function toPackage(r: PackageRow): TourPackage {
  return {
    id: r.id,
    name: r.name,
    destination: r.destination,
    nights: r.nights,
    price: toNum(r.price),
    seats: r.seats,
    seatsTaken: r.seats_taken,
    status: r.status,
    category: r.category,
    roomBasis: r.room_basis,
    image: r.image_url,
    gallery: r.gallery ?? [],
    includes: r.includes ?? [],
    excludes: r.excludes ?? [],
    wpId: r.wp_id ?? undefined,
    wpSlug: r.wp_slug ?? "",
  };
}

export const listPackages = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async (): Promise<TourPackage[]> => {
    const { rows } = await query<PackageRow>(
      `select id, name, destination, nights, price, seats, seats_taken, status, category,
              room_basis, image_url, gallery, includes, excludes, wp_id, wp_slug
       from packages order by created_at desc`,
    );
    return rows.map(toPackage);
  });

const packageInput = z.object({
  name: z.string().min(1),
  destination: z.string().min(1),
  nights: z.number().int().min(0),
  price: z.number().min(0),
  seats: z.number().int().min(0),
  seatsTaken: z.number().int().min(0),
  status: z.enum(["available", "full", "ended"]),
  category: z.enum(["flight", "hotel", "shared", "full", "cruise", "visa"]),
  roomBasis: z.enum(["single", "double", "triple", "quad"]),
  image: z.string().nullable().optional(),
  gallery: z.array(z.string()).optional(),
  includes: z.array(z.string()).optional(),
  excludes: z.array(z.string()).optional(),
  wpSlug: z.string().optional(),
});

export const createPackage = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: unknown) => packageInput.parse(data))
  .handler(async ({ data }): Promise<TourPackage> => {
    const row = await queryOne<PackageRow>(
      `insert into packages
         (name, destination, nights, price, seats, seats_taken, status, category, room_basis,
          image_url, gallery, includes, excludes, wp_slug)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       returning id, name, destination, nights, price, seats, seats_taken, status, category,
                 room_basis, image_url, gallery, includes, excludes, wp_id, wp_slug`,
      [
        data.name,
        data.destination,
        data.nights,
        data.price,
        data.seats,
        data.seatsTaken,
        data.status,
        data.category,
        data.roomBasis,
        data.image || null,
        data.gallery ?? [],
        data.includes ?? [],
        data.excludes ?? [],
        data.wpSlug ?? "",
      ],
    );
    return toPackage(row!);
  });

const packagePatch = packageInput.partial();

export const updatePackage = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), patch: packagePatch }).parse(data),
  )
  .handler(async ({ data }): Promise<TourPackage> => {
    const p = data.patch;
    const sets: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    const map: [keyof typeof p, string][] = [
      ["name", "name"],
      ["destination", "destination"],
      ["nights", "nights"],
      ["price", "price"],
      ["seats", "seats"],
      ["seatsTaken", "seats_taken"],
      ["status", "status"],
      ["category", "category"],
      ["roomBasis", "room_basis"],
      ["wpSlug", "wp_slug"],
    ];
    for (const [key, col] of map) {
      if (p[key] !== undefined) {
        sets.push(`${col} = $${i++}`);
        params.push(p[key]);
      }
    }
    if (p.image !== undefined) {
      sets.push(`image_url = $${i++}`);
      params.push(p.image || null);
    }
    if (p.gallery !== undefined) {
      sets.push(`gallery = $${i++}`);
      params.push(p.gallery);
    }
    if (p.includes !== undefined) {
      sets.push(`includes = $${i++}`);
      params.push(p.includes);
    }
    if (p.excludes !== undefined) {
      sets.push(`excludes = $${i++}`);
      params.push(p.excludes);
    }
    sets.push(`updated_at = now()`);
    params.push(data.id);
    const row = await queryOne<PackageRow>(
      `update packages set ${sets.join(", ")} where id = $${i}
       returning id, name, destination, nights, price, seats, seats_taken, status, category,
                 room_basis, image_url, gallery, includes, excludes, wp_id, wp_slug`,
      params,
    );
    if (!row) throw new Error("الباقة غير موجودة");
    return toPackage(row);
  });

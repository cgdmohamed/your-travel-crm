import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-middleware";
import { query, queryOne, withTransaction } from "@/lib/db.server";
import { isOwnerScoped, toDateStr, toNum } from "@/lib/queries/_shared.server";
import type { Booking } from "@/lib/crm-data";
import type { Role } from "@/lib/permissions";

type BookingRow = {
  id: string;
  ref: string;
  customer_id: string;
  package_id: string;
  travel_date: string | Date;
  pax: number;
  amount: string | number;
  paid: string | number;
  status: Booking["status"];
  owner_id: string | null;
  created_at: string | Date;
  booking_time: string | null;
};

function toBooking(r: BookingRow): Booking {
  return {
    id: r.id,
    ref: r.ref,
    customerId: r.customer_id,
    packageId: r.package_id,
    travelDate: toDateStr(r.travel_date),
    pax: r.pax,
    amount: toNum(r.amount),
    paid: toNum(r.paid),
    status: r.status,
    ownerId: r.owner_id ?? "",
    createdAt: toDateStr(r.created_at),
    time: r.booking_time ?? undefined,
  };
}

const BOOKING_COLUMNS = `id, ref, customer_id, package_id, travel_date, pax, amount, paid, status,
                         owner_id, created_at, booking_time`;

export const listBookings = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<Booking[]> => {
    const scoped = await isOwnerScoped(context.userId, context.role as Role);
    const { rows } = await query<BookingRow>(
      `select ${BOOKING_COLUMNS} from bookings
       ${scoped ? "where owner_id = $1" : ""}
       order by created_at desc`,
      scoped ? [context.userId] : [],
    );
    return rows.map(toBooking);
  });

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const bookingInput = z.object({
  customerId: z.string().uuid(),
  packageId: z.string().uuid(),
  travelDate: z.string().min(1),
  pax: z.number().int().min(1),
  amount: z.number().min(0),
  paid: z.number().min(0),
  status: z.enum(["draft", "confirmed", "paid", "cancelled"]),
  ownerId: z.string().uuid().optional(),
});

export const createBooking = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: unknown) => bookingInput.parse(data))
  .handler(async ({ data, context }): Promise<Booking> => {
    const ownerId = data.ownerId || context.userId;
    const time = nowHHMM();
    const row = await withTransaction(async (tx) => {
      const seq = await tx.query<{ nextval: string }>(`select nextval('booking_ref_seq')`);
      const ref = `BK-${seq.rows[0]!.nextval}`;
      const res = await tx.query<BookingRow>(
        `insert into bookings
           (ref, customer_id, package_id, travel_date, pax, amount, paid, status, owner_id, booking_time)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         returning ${BOOKING_COLUMNS}`,
        [
          ref,
          data.customerId,
          data.packageId,
          data.travelDate,
          data.pax,
          data.amount,
          data.paid,
          data.status,
          ownerId,
          time,
        ],
      );
      return res.rows[0]!;
    });
    return toBooking(row);
  });

export const setBookingStatus = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ id: z.string().uuid(), status: z.enum(["draft", "confirmed", "paid", "cancelled"]) })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<Booking> => {
    const row = await queryOne<BookingRow>(
      `update bookings set status = $1 where id = $2 returning ${BOOKING_COLUMNS}`,
      [data.status, data.id],
    );
    if (!row) throw new Error("الحجز غير موجود");
    const booking = toBooking(row);

    try {
      const { notifyUser, notifyRole } = await import("@/lib/notifications.server");
      const notif = {
        type: "booking_status",
        title: "تغيّرت حالة حجز",
        body: `الحجز ${booking.ref} أصبح "${booking.status}"`,
        link: "/bookings",
      };
      if (booking.ownerId && booking.ownerId !== context.userId) {
        await notifyUser(booking.ownerId, notif);
      }
      await notifyRole("admin", notif, context.userId);
    } catch (err) {
      console.error("notify booking status failed", err);
    }

    return booking;
  });

const convertInput = z.object({
  opportunityId: z.string().uuid(),
  travelDate: z.string().min(1),
  pax: z.number().int().min(1),
  amount: z.number().min(0),
  paid: z.number().min(0),
});

/** تحويل فرصة بيع إلى حجز — إدراج الحجز وتعليم الفرصة "won" في معاملة واحدة */
export const convertOpportunityToBooking = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: unknown) => convertInput.parse(data))
  .handler(async ({ data, context }): Promise<{ booking: Booking; ref: string } | { error: string }> => {
    const result = await withTransaction(async (tx) => {
      const opp = await tx.query<{
        id: string;
        customer_id: string;
        package_id: string | null;
        owner_id: string | null;
      }>(`select id, customer_id, package_id, owner_id from opportunities where id = $1 for update`, [
        data.opportunityId,
      ]);
      const o = opp.rows[0];
      if (!o || !o.package_id) return { error: "الفرصة غير موجودة أو بدون باقة محددة" } as const;

      const status = data.paid >= data.amount ? "paid" : data.paid > 0 ? "confirmed" : "draft";
      const seq = await tx.query<{ nextval: string }>(`select nextval('booking_ref_seq')`);
      const ref = `BK-${seq.rows[0]!.nextval}`;
      const time = nowHHMM();
      const bk = await tx.query<BookingRow>(
        `insert into bookings
           (ref, customer_id, package_id, travel_date, pax, amount, paid, status, owner_id, booking_time)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         returning ${BOOKING_COLUMNS}`,
        [ref, o.customer_id, o.package_id, data.travelDate, data.pax, data.amount, data.paid, status, o.owner_id, time],
      );
      const booking = bk.rows[0]!;
      await tx.query(`update opportunities set stage = 'won', booking_id = $1 where id = $2`, [
        booking.id,
        data.opportunityId,
      ]);
      return { booking: toBooking(booking), ref, ownerId: o.owner_id };
    });

    if ("error" in result) return result;

    try {
      const { notifyUser, notifyRole } = await import("@/lib/notifications.server");
      const notif = {
        type: "opportunity_won",
        title: "فرصة تحوّلت لحجز",
        body: `الحجز ${result.ref} تم إنشاؤه من فرصة بيع`,
        link: "/bookings",
      };
      if (result.ownerId && result.ownerId !== context.userId) {
        await notifyUser(result.ownerId, notif);
      }
      await notifyRole("admin", notif, context.userId);
    } catch (err) {
      console.error("notify opportunity converted failed", err);
    }

    return { booking: result.booking, ref: result.ref };
  });

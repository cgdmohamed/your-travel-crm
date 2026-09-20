import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-middleware";
import { query, queryOne } from "@/lib/db.server";
import { toDateStr, toNum } from "@/lib/queries/_shared.server";
import type { Ticket } from "@/lib/crm-data";

type TicketRow = {
  id: string;
  booking_id: string;
  customer_id: string;
  passenger: string;
  airline: string;
  flight_no: string | null;
  route: string | null;
  depart_date: string | Date | null;
  return_date: string | Date | null;
  pnr: string | null;
  cabin: Ticket["cabin"];
  price: string | number;
  status: Ticket["status"];
};

function toTicket(r: TicketRow): Ticket {
  return {
    id: r.id,
    bookingId: r.booking_id,
    customerId: r.customer_id,
    passenger: r.passenger,
    airline: r.airline,
    flightNo: r.flight_no ?? "",
    route: r.route ?? "",
    departDate: r.depart_date ? toDateStr(r.depart_date) : "",
    returnDate: r.return_date ? toDateStr(r.return_date) : undefined,
    pnr: r.pnr ?? "",
    cabin: r.cabin,
    price: toNum(r.price),
    status: r.status,
  };
}

const COLS = `id, booking_id, customer_id, passenger, airline, flight_no, route, depart_date,
              return_date, pnr, cabin, price, status`;

export const listTickets = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async (): Promise<Ticket[]> => {
    const { rows } = await query<TicketRow>(`select ${COLS} from tickets order by created_at desc`);
    return rows.map(toTicket);
  });

const ticketInput = z.object({
  bookingId: z.string().uuid(),
  customerId: z.string().uuid(),
  passenger: z.string().min(1),
  airline: z.string().min(1),
  flightNo: z.string().optional(),
  route: z.string().optional(),
  departDate: z.string().optional(),
  returnDate: z.string().optional(),
  pnr: z.string().optional(),
  cabin: z.enum(["economy", "business"]),
  price: z.number().min(0),
  status: z.enum(["issued", "pending", "cancelled"]),
});

export const addTicket = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: unknown) => ticketInput.parse(data))
  .handler(async ({ data }): Promise<Ticket> => {
    const row = await queryOne<TicketRow>(
      `insert into tickets
         (booking_id, customer_id, passenger, airline, flight_no, route, depart_date, return_date,
          pnr, cabin, price, status)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       returning ${COLS}`,
      [
        data.bookingId,
        data.customerId,
        data.passenger,
        data.airline,
        data.flightNo || null,
        data.route || null,
        data.departDate || null,
        data.returnDate || null,
        data.pnr || null,
        data.cabin,
        data.price,
        data.status,
      ],
    );
    return toTicket(row!);
  });

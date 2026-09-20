import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-middleware";
import { query, queryOne } from "@/lib/db.server";
import { toNum } from "@/lib/queries/_shared.server";
import type { HotelStay } from "@/lib/crm-data";

type HotelRow = {
  id: string;
  booking_id: string;
  customer_id: string;
  hotel: string;
  city: string | null;
  room_basis: HotelStay["roomBasis"];
  board: HotelStay["board"];
  check_in: string | null;
  check_out: string | null;
  rooms: number;
  guests: number;
  confirmation_no: string | null;
  price: string | number;
};

function toHotel(r: HotelRow): HotelStay {
  return {
    id: r.id,
    bookingId: r.booking_id,
    customerId: r.customer_id,
    hotel: r.hotel,
    city: r.city ?? "",
    roomBasis: r.room_basis,
    board: r.board,
    checkIn: r.check_in ? r.check_in.slice(0, 10) : "",
    checkOut: r.check_out ? r.check_out.slice(0, 10) : "",
    rooms: r.rooms,
    guests: r.guests,
    confirmationNo: r.confirmation_no ?? "",
    price: toNum(r.price),
  };
}

const COLS = `id, booking_id, customer_id, hotel, city, room_basis, board, check_in, check_out,
              rooms, guests, confirmation_no, price`;

export const listHotelStays = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async (): Promise<HotelStay[]> => {
    const { rows } = await query<HotelRow>(`select ${COLS} from hotel_stays order by created_at desc`);
    return rows.map(toHotel);
  });

const hotelInput = z.object({
  bookingId: z.string().uuid(),
  customerId: z.string().uuid(),
  hotel: z.string().min(1),
  city: z.string().optional(),
  roomBasis: z.enum(["single", "double", "triple", "quad"]),
  board: z.enum(["ro", "bb", "hb", "ai"]),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  rooms: z.number().int().min(1),
  guests: z.number().int().min(1),
  confirmationNo: z.string().optional(),
  price: z.number().min(0),
});

export const addHotelStay = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: unknown) => hotelInput.parse(data))
  .handler(async ({ data }): Promise<HotelStay> => {
    const row = await queryOne<HotelRow>(
      `insert into hotel_stays
         (booking_id, customer_id, hotel, city, room_basis, board, check_in, check_out, rooms,
          guests, confirmation_no, price)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       returning ${COLS}`,
      [
        data.bookingId,
        data.customerId,
        data.hotel,
        data.city || null,
        data.roomBasis,
        data.board,
        data.checkIn || null,
        data.checkOut || null,
        data.rooms,
        data.guests,
        data.confirmationNo || null,
        data.price,
      ],
    );
    return toHotel(row!);
  });

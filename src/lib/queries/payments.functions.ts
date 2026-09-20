import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-middleware";
import { query, queryOne, withTransaction } from "@/lib/db.server";
import { toNum } from "@/lib/queries/_shared.server";
import { trackMeta } from "@/lib/meta-track";
import type { Payment } from "@/lib/crm-data";

type PaymentRow = {
  id: string;
  booking_id: string;
  customer_id: string;
  paid_on: string;
  amount: string | number;
  method: Payment["method"];
  reference: string | null;
  collected_by: string | null;
  payment_time: string | null;
};

function toPayment(r: PaymentRow): Payment {
  return {
    id: r.id,
    bookingId: r.booking_id,
    customerId: r.customer_id,
    date: typeof r.paid_on === "string" ? r.paid_on.slice(0, 10) : r.paid_on,
    amount: toNum(r.amount),
    method: r.method,
    reference: r.reference ?? "",
    collectedBy: r.collected_by ?? "",
    time: r.payment_time ?? undefined,
  };
}

const COLS = `id, booking_id, customer_id, paid_on, amount, method, reference, collected_by, payment_time`;

export const listPayments = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async (): Promise<Payment[]> => {
    const { rows } = await query<PaymentRow>(`select ${COLS} from payments order by created_at desc`);
    return rows.map(toPayment);
  });

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const paymentInput = z.object({
  bookingId: z.string().uuid(),
  customerId: z.string().uuid(),
  date: z.string().min(1),
  amount: z.number().positive(),
  method: z.enum(["cash", "bank", "card", "instapay", "wallet"]),
  reference: z.string().optional(),
});

/** تسجيل دفعة — إدراج الدفعة وتحديث المدفوع/حالة الحجز في معاملة واحدة، ثم تتبّع Meta */
export const addPayment = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: unknown) => paymentInput.parse(data))
  .handler(async ({ data, context }): Promise<Payment> => {
    const time = nowHHMM();
    const { payment, customerName, customerPhone, customerEmail, customerCity } =
      await withTransaction(async (tx) => {
        const pay = await tx.query<PaymentRow>(
          `insert into payments (booking_id, customer_id, paid_on, amount, method, reference, collected_by, payment_time)
           values ($1,$2,$3,$4,$5,$6,$7,$8)
           returning ${COLS}`,
          [
            data.bookingId,
            data.customerId,
            data.date,
            data.amount,
            data.method,
            data.reference || null,
            context.userId,
            time,
          ],
        );
        const p = pay.rows[0]!;

        await tx.query(
          `update bookings set paid = paid + $1,
                  status = case when paid + $1 >= amount then 'paid' else status end
           where id = $2`,
          [data.amount, data.bookingId],
        );

        const cust = await tx.query<{ name: string; phone: string; email: string | null; city: string | null }>(
          `select name, phone, email, city from customers where id = $1`,
          [data.customerId],
        );
        const c = cust.rows[0];
        return {
          payment: p,
          customerName: c?.name,
          customerPhone: c?.phone,
          customerEmail: c?.email ?? undefined,
          customerCity: c?.city ?? undefined,
        };
      });

    trackMeta({
      eventName: "Purchase",
      customerId: data.customerId,
      customerName,
      phone: customerPhone,
      email: customerEmail,
      city: customerCity,
      value: data.amount,
    });

    return toPayment(payment);
  });

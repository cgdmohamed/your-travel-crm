import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-middleware";
import { query, queryOne } from "@/lib/db.server";
import { isOwnerScoped } from "@/lib/queries/_shared.server";
import { trackMeta } from "@/lib/meta-track";
import type { Customer, Note } from "@/lib/crm-data";
import type { Role } from "@/lib/permissions";

type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  city: string | null;
  source: Customer["source"];
  owner_id: string | null;
  notes: Note[];
};

function toCustomer(r: CustomerRow): Customer {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    email: r.email ?? "",
    city: r.city ?? "",
    source: r.source,
    ownerId: r.owner_id ?? "",
    notes: r.notes ?? [],
  };
}

const NOTES_SUBQUERY = `
  coalesce(
    (
      select json_agg(
               json_build_object(
                 'id', n.id,
                 'date', to_char(n.created_at, 'YYYY-MM-DD'),
                 'text', n.text,
                 'author', coalesce(u.name, '—')
               ) order by n.created_at desc
             )
      from customer_notes n
      left join users u on u.id = n.author_id
      where n.customer_id = c.id
    ),
    '[]'::json
  ) as notes
`;

/** قائمة العملاء — مقيّدة على عملاء الموظف نفسه لو دوره لا يملك "reports.all" */
export const listCustomers = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<Customer[]> => {
    const scoped = await isOwnerScoped(context.userId, context.role as Role);
    const { rows } = await query<CustomerRow>(
      `select c.id, c.name, c.phone, c.email, c.city, c.source, c.owner_id, ${NOTES_SUBQUERY}
       from customers c
       ${scoped ? "where c.owner_id = $1" : ""}
       order by c.created_at desc`,
      scoped ? [context.userId] : [],
    );
    return rows.map(toCustomer);
  });

const customerInput = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().optional(),
  city: z.string().optional(),
  source: z.enum(["whatsapp", "website", "direct"]),
  ownerId: z.string().uuid().optional(),
});

export const createCustomer = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: unknown) => customerInput.parse(data))
  .handler(async ({ data, context }): Promise<Customer> => {
    const ownerId = data.ownerId || context.userId;
    const row = await queryOne<{ id: string }>(
      `insert into customers (name, phone, email, city, source, owner_id)
       values ($1,$2,$3,$4,$5,$6) returning id`,
      [data.name, data.phone, data.email || null, data.city || null, data.source, ownerId],
    );
    const id = row!.id;
    trackMeta({
      eventName: "Lead",
      customerId: id,
      customerName: data.name,
      phone: data.phone,
      ...(data.email ? { email: data.email } : {}),
      ...(data.city ? { city: data.city } : {}),
    });
    return {
      id,
      name: data.name,
      phone: data.phone,
      email: data.email ?? "",
      city: data.city ?? "",
      source: data.source,
      ownerId,
      notes: [],
    };
  });

const noteInput = z.object({ customerId: z.string().uuid(), text: z.string().min(1) });

export const addCustomerNote = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: unknown) => noteInput.parse(data))
  .handler(async ({ data, context }): Promise<Note> => {
    const row = await queryOne<Note>(
      `with ins as (
         insert into customer_notes (customer_id, text, author_id)
         values ($1, $2, $3)
         returning id, created_at
       )
       select ins.id, to_char(ins.created_at, 'YYYY-MM-DD') as date, $2::text as text,
              coalesce(u.name, '—') as author
       from ins left join users u on u.id = $3`,
      [data.customerId, data.text, context.userId],
    );
    return row!;
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-middleware";
import { query, queryOne } from "@/lib/db.server";
import { isOwnerScoped, toDateStr, toNum } from "@/lib/queries/_shared.server";
import type { Opportunity } from "@/lib/crm-data";
import type { Role } from "@/lib/permissions";

type OpportunityRow = {
  id: string;
  title: string;
  customer_id: string;
  package_id: string | null;
  value: string | number;
  stage: Opportunity["stage"];
  owner_id: string | null;
  follow_up_date: string | Date | null;
  source: Opportunity["source"];
  pax: number | null;
  booking_id: string | null;
  lost_reason: string | null;
};

function toOpportunity(r: OpportunityRow): Opportunity {
  return {
    id: r.id,
    title: r.title,
    customerId: r.customer_id,
    packageId: r.package_id ?? "",
    value: toNum(r.value),
    stage: r.stage,
    ownerId: r.owner_id ?? "",
    followUpDate: r.follow_up_date ? toDateStr(r.follow_up_date) : "",
    source: r.source,
    pax: r.pax ?? undefined,
    bookingId: r.booking_id ?? undefined,
    lostReason: r.lost_reason ?? undefined,
  };
}

const OPP_COLUMNS = `id, title, customer_id, package_id, value, stage, owner_id, follow_up_date,
                      source, pax, booking_id, lost_reason`;

export const listOpportunities = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<Opportunity[]> => {
    const scoped = await isOwnerScoped(context.userId, context.role as Role);
    const { rows } = await query<OpportunityRow>(
      `select ${OPP_COLUMNS} from opportunities
       ${scoped ? "where owner_id = $1" : ""}
       order by created_at desc`,
      scoped ? [context.userId] : [],
    );
    return rows.map(toOpportunity);
  });

const oppInput = z.object({
  title: z.string().min(1),
  customerId: z.string().uuid(),
  packageId: z.string().uuid().optional(),
  value: z.number().min(0),
  stage: z.enum(["new", "contacted", "quote", "negotiation", "won", "lost"]),
  ownerId: z.string().uuid().optional(),
  followUpDate: z.string().min(1),
  source: z.enum(["whatsapp", "website", "direct"]),
  pax: z.number().int().optional(),
});

export const createOpportunity = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: unknown) => oppInput.parse(data))
  .handler(async ({ data, context }): Promise<Opportunity> => {
    const ownerId = data.ownerId || context.userId;
    const row = await queryOne<OpportunityRow>(
      `insert into opportunities
         (title, customer_id, package_id, value, stage, owner_id, follow_up_date, source, pax)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       returning ${OPP_COLUMNS}`,
      [
        data.title,
        data.customerId,
        data.packageId ?? null,
        data.value,
        data.stage,
        ownerId,
        data.followUpDate,
        data.source,
        data.pax ?? null,
      ],
    );
    return toOpportunity(row!);
  });

const oppPatch = z.object({
  stage: z.enum(["new", "contacted", "quote", "negotiation", "won", "lost"]).optional(),
  followUpDate: z.string().optional(),
  lostReason: z.string().optional(),
  bookingId: z.string().uuid().optional(),
});

export const updateOpportunity = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid(), patch: oppPatch }).parse(data))
  .handler(async ({ data }): Promise<Opportunity> => {
    const p = data.patch;
    const sets: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (p.stage !== undefined) {
      sets.push(`stage = $${i++}`);
      params.push(p.stage);
    }
    if (p.followUpDate !== undefined) {
      sets.push(`follow_up_date = $${i++}`);
      params.push(p.followUpDate);
    }
    if (p.lostReason !== undefined) {
      sets.push(`lost_reason = $${i++}`);
      params.push(p.lostReason || null);
    }
    if (p.bookingId !== undefined) {
      sets.push(`booking_id = $${i++}`);
      params.push(p.bookingId);
    }
    sets.push(`updated_at = now()`);
    params.push(data.id);
    const row = await queryOne<OpportunityRow>(
      `update opportunities set ${sets.join(", ")} where id = $${i} returning ${OPP_COLUMNS}`,
      params,
    );
    if (!row) throw new Error("الفرصة غير موجودة");
    return toOpportunity(row);
  });

export const moveOpportunity = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        stage: z.enum(["new", "contacted", "quote", "negotiation", "won", "lost"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<Opportunity> => {
    const row = await queryOne<OpportunityRow>(
      `update opportunities set stage = $1, updated_at = now() where id = $2 returning ${OPP_COLUMNS}`,
      [data.stage, data.id],
    );
    if (!row) throw new Error("الفرصة غير موجودة");
    const opportunity = toOpportunity(row);

    if (opportunity.stage === "won" || opportunity.stage === "lost") {
      try {
        const { notifyUser, notifyRole } = await import("@/lib/notifications.server");
        const notif = {
          type: opportunity.stage === "won" ? "opportunity_won" : "opportunity_lost",
          title: opportunity.stage === "won" ? "فرصة تم كسبها" : "فرصة تم فقدها",
          body: `الفرصة "${opportunity.title}" أصبحت ${opportunity.stage === "won" ? "مكسوبة" : "مفقودة"}`,
          link: "/pipeline",
        };
        if (opportunity.ownerId && opportunity.ownerId !== context.userId) {
          await notifyUser(opportunity.ownerId, notif);
        }
        await notifyRole("admin", notif, context.userId);
      } catch (err) {
        console.error("notify opportunity stage failed", err);
      }
    }

    return opportunity;
  });

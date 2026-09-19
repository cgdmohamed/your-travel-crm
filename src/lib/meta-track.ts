import { sendMetaEvent } from "@/lib/meta-capi.functions";

type TrackArgs = {
  eventName: "Lead" | "Purchase" | "Contact" | "InitiateCheckout" | "Schedule";
  customerId?: string | undefined;
  customerName?: string | undefined;
  phone?: string | undefined;
  email?: string | undefined;
  city?: string | undefined;
  value?: number | undefined;
  sentBy?: string | undefined;
};

/** إرسال حدث إلى Meta دون تعطيل واجهة المستخدم عند الفشل */
export function trackMeta(args: TrackArgs) {
  void sendMetaEvent({ data: { currency: "EGP", ...args } }).catch(() => {});
}

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-middleware";

const imageInput = z.object({
  fileName: z.string().min(1),
  dataUrl: z.string().min(1),
});

/** رفع صورة باقة سياحية — عامة (غير حساسة)، تُخدَّم عبر رابط ثابت */
export const uploadPackageImage = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: unknown) => imageInput.parse(data))
  .handler(async ({ data }) => {
    const { writeUpload, IMAGE_UPLOAD_OPTS } = await import("@/lib/upload.server");
    const { relativePath } = await writeUpload("package-images", data.dataUrl, data.fileName, IMAGE_UPLOAD_OPTS);
    return { ok: true as const, url: `/api/uploads/${relativePath}` };
  });

import { createFileRoute } from "@tanstack/react-router";
import { refresh } from "@/lib/auth-server";
import { ACCESS_COOKIE, REFRESH_COOKIE, buildCookie, readCookie } from "@/lib/cookies.server";

export const Route = createFileRoute("/api/auth/refresh")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const refreshToken = readCookie(request, REFRESH_COOKIE);
        if (!refreshToken) {
          return Response.json({ ok: false, message: "لا توجد جلسة" }, { status: 401 });
        }
        const result = await refresh(refreshToken);
        if (!result.ok) {
          return Response.json({ ok: false, message: result.message }, { status: 401 });
        }
        const headers = new Headers();
        headers.append("Set-Cookie", buildCookie(ACCESS_COOKIE, result.accessToken, 15 * 60));
        return Response.json({ ok: true }, { headers });
      },
    },
  },
});

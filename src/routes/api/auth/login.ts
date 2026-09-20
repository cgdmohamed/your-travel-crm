import { createFileRoute } from "@tanstack/react-router";
import { login } from "@/lib/auth-server";
import { ACCESS_COOKIE, REFRESH_COOKIE, buildCookie } from "@/lib/cookies.server";

export const Route = createFileRoute("/api/auth/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => null)) as
          | { email?: string; password?: string }
          | null;
        if (!body?.email || !body.password) {
          return Response.json({ ok: false, message: "أدخل البريد وكلمة المرور" }, { status: 400 });
        }
        const result = await login(body.email, body.password);
        if (!result.ok) {
          return Response.json({ ok: false, message: result.message }, { status: 401 });
        }
        const headers = new Headers();
        headers.append("Set-Cookie", buildCookie(ACCESS_COOKIE, result.accessToken, 15 * 60));
        headers.append(
          "Set-Cookie",
          buildCookie(REFRESH_COOKIE, result.refreshToken, 30 * 24 * 60 * 60),
        );
        return Response.json({ ok: true, user: result.user }, { headers });
      },
    },
  },
});

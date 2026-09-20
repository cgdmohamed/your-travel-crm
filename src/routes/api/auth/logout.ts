import { createFileRoute } from "@tanstack/react-router";
import { logout } from "@/lib/auth-server";
import { ACCESS_COOKIE, REFRESH_COOKIE, clearCookie, readCookie } from "@/lib/cookies.server";

export const Route = createFileRoute("/api/auth/logout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const refreshToken = readCookie(request, REFRESH_COOKIE);
        if (refreshToken) await logout(refreshToken);
        const headers = new Headers();
        headers.append("Set-Cookie", clearCookie(ACCESS_COOKIE));
        headers.append("Set-Cookie", clearCookie(REFRESH_COOKIE));
        return Response.json({ ok: true }, { headers });
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { currentUserFromAccessToken } from "@/lib/auth-server";
import { ACCESS_COOKIE, readCookie } from "@/lib/cookies.server";

export const Route = createFileRoute("/api/auth/me")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const accessToken = readCookie(request, ACCESS_COOKIE);
        const user = await currentUserFromAccessToken(accessToken);
        if (!user) return Response.json({ user: null }, { status: 401 });
        return Response.json({ user });
      },
    },
  },
});

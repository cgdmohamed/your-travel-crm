import { createMiddleware } from "@tanstack/react-start";

/**
 * Server function middleware — replaces `requireSupabaseAuth`.
 * Reads the httpOnly access-token cookie set by /api/auth/login, verifies the
 * JWT, and injects { userId, role } into the handler context. Role/permission
 * checks stay explicit in each handler (no RLS to lean on).
 *
 * NOTE: this file intentionally does NOT end in `.server.ts` — the
 * middleware object itself must be importable from client-bundled code (any
 * route file that uses a createServerFn with this middleware), even though
 * everything inside `.server(...)` below only ever executes on the server.
 * The actual server-only imports are loaded dynamically inside that callback
 * so the client bundle never pulls in `pg`/JWT verification code.
 */
export const requireAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const { getRequest } = await import("@tanstack/react-start/server");
  const { currentUserFromAccessToken } = await import("@/lib/auth-server");
  const { ACCESS_COOKIE, readCookie } = await import("@/lib/cookies.server");

  const request = getRequest();
  const accessToken = request ? readCookie(request, ACCESS_COOKIE) : undefined;
  const user = await currentUserFromAccessToken(accessToken);
  if (!user) throw new Error("Unauthorized");
  return next({ context: { userId: user.id, role: user.role } });
});

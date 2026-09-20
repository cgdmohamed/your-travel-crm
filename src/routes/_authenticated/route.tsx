import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { currentUserFromAccessToken } from "@/lib/auth-server";
import { ACCESS_COOKIE, readCookie } from "@/lib/cookies.server";
import { createServerFn } from "@tanstack/react-start";

const getServerUser = createServerFn({ method: "GET" }).handler(async () => {
  const { getRequest } = await import("@tanstack/react-start/server");
  const request = getRequest();
  const accessToken = readCookie(request, ACCESS_COOKIE);
  const user = await currentUserFromAccessToken(accessToken);
  return user;
});

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const user = await getServerUser().catch(() => null);
    if (!user) throw redirect({ to: "/auth" });
    return { user };
  },
  component: () => <Outlet />,
});

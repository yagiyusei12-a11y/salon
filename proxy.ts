import { withAuth } from "next-auth/middleware";

export default withAuth(function proxy() {});

export const config = {
  matcher: [
    "/",
    "/customers/:path*",
    "/appointments/:path*",
    "/menus/:path*",
    "/payments/:path*",
    "/staff/:path*",
    "/audit-logs/:path*",
    "/notifications/:path*",
    "/backup/:path*",
    "/api/backup",
  ],
};

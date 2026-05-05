import NextAuth from "next-auth";
import authConfig from "@/src/auth.config";

export const { auth: proxy } = NextAuth(authConfig);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/onboarding/:path*",
    "/profile/:path*",
    "/sources/:path*",
    "/archive/:path*",
  ],
};

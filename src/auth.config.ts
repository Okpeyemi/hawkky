import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

export default {
  providers: [GitHub, Google],
  pages: {
    signIn: "/signin",
    verifyRequest: "/verify",
  },
  callbacks: {
    authorized({ auth, request }) {
      const isLogged = !!auth?.user;
      const path = request.nextUrl.pathname;
      const isAppRoute =
        path.startsWith("/dashboard") ||
        path.startsWith("/onboarding") ||
        path.startsWith("/profile") ||
        path.startsWith("/sources") ||
        path.startsWith("/archive");
      if (isAppRoute) return isLogged;
      return true;
    },
  },
} satisfies NextAuthConfig;

import NextAuth from 'next-auth';

/**
 * NextAuth instance for the Crawl Job Data Pipeline web portal.
 *
 * This is a simplified auth setup for the standalone project.
 * In production, configure AUTH_SECRET and NEXTAUTH_URL env vars.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt', maxAge: 15 * 60 },
  trustHost: true,
  providers: [],
  callbacks: {
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        (session.user as { role?: string }).role = token.role as
          | string
          | undefined;
      }
      return session;
    },
  },
});

export function loginRedirectUrl(callbackPath: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3400';
  const callback = new URL(callbackPath || '/', base).toString();
  return `/api/auth/signin?callbackUrl=${encodeURIComponent(callback)}`;
}

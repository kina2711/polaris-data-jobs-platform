import NextAuth from 'next-auth';

/**
 * NextAuth instance for the Polaris Data Jobs web portal.
 *
 * Authentication providers are intentionally NOT_IMPLEMENTED until the
 * approved Polaris identity-provider contract is available.
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

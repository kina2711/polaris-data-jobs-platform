// Helper gọi central auth cross-origin từ client component.
// Trả null nếu network fail — caller swallow để không block logout/UX khi
// endpoint tạm thời unreachable.

export const LOGIN_ORIGIN =
  process.env.NEXT_PUBLIC_LOGIN_URL || 'http://localhost:3400';

export async function callCentral(path: string): Promise<Response | null> {
  try {
    return await fetch(`${LOGIN_ORIGIN}${path}`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    return null;
  }
}

// Revoke refresh token + clear cookie qua central trước khi
// NextAuth signOut.
export async function centralLogout(): Promise<void> {
  await callCentral('/api/auth/logout');
}

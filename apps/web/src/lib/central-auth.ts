// Optional bridge to a separately deployed Polaris identity service.
// Authentication is intentionally not assumed when the origin is unconfigured.
export const AUTH_ORIGIN = process.env.NEXT_PUBLIC_AUTH_ORIGIN?.replace(
  /\/$/,
  '',
);

export async function callCentral(path: string): Promise<Response | null> {
  if (!AUTH_ORIGIN) return null;

  try {
    return await fetch(`${AUTH_ORIGIN}${path}`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    return null;
  }
}

export async function centralLogout(): Promise<void> {
  await callCentral('/api/auth/logout');
}

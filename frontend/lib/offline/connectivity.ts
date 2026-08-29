export type ConnectionState = 'ONLINE' | 'OFFLINE' | 'API_UNREACHABLE';
export function connectionTransition(
  browserOnline: boolean,
  apiReachable?: boolean,
): ConnectionState {
  if (!browserOnline) return 'OFFLINE';
  return apiReachable === false ? 'API_UNREACHABLE' : 'ONLINE';
}
export async function checkApiReachability(fetcher: typeof fetch = fetch) {
  try {
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
    const response = await fetcher(base.replace(/\/api\/v1$/, '') + '/health', {
      cache: 'no-store',
    });
    return response.ok;
  } catch {
    return false;
  }
}

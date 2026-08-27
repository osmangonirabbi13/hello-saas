export type AuthenticatedContext = {
  user: { id: string; displayName: string };
  business: { id: string; name: string; slug: string; logoUrl: string | null };
  membership: { id: string; role: string; permissions: string[] };
};

export const DEMO_AUTHENTICATED_CONTEXT: AuthenticatedContext = {
  user: { id: 'demo-user', displayName: 'Osman Gani' },
  business: {
    id: 'demo-business',
    name: 'Rahman Computer',
    slug: 'rahman-computer',
    logoUrl: null,
  },
  membership: { id: 'demo-membership', role: 'OWNER', permissions: [] },
};

export function businessInitial(name: string) {
  const first = name.trim().match(/[\p{L}\p{N}]/u)?.[0];
  return first?.toLocaleUpperCase('en-US') ?? 'B';
}

export function formatRole(role: string) {
  return role
    .toLocaleLowerCase('en-US')
    .split('_')
    .map((part) => part.charAt(0).toLocaleUpperCase('en-US') + part.slice(1))
    .join(' ');
}

export async function loadAuthenticatedContext(accessToken: string) {
  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
  const response = await fetch(`${base}/dashboard/context`, {
    headers: { authorization: `Bearer ${accessToken}` },
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Unable to load authenticated business context.');
  const payload = (await response.json()) as { data: AuthenticatedContext };
  return payload.data;
}

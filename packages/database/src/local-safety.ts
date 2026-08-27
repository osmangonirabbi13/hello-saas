const localHosts = new Set(['localhost', '127.0.0.1', '::1', 'host.docker.internal']);

export function assertLocalDatabaseUrl(value: string): URL {
  const url = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !localHosts.has(url.hostname)) {
    throw new Error('Refusing database operation: DATABASE_URL must target local PostgreSQL.');
  }
  const databaseName = url.pathname.slice(1);
  if (!databaseName || ['postgres', 'template0', 'template1'].includes(databaseName)) {
    throw new Error('Refusing database operation: a dedicated local database is required.');
  }
  return url;
}

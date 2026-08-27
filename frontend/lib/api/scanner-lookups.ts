type ApiEnvelope<T> = { data: T };

async function authenticatedLookup<T>(path: string): Promise<T> {
  const token = sessionStorage.getItem('hello_shop_access');
  if (!token) throw new Error('Authentication is required for barcode lookup.');
  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
  const response = await fetch(`${base}${path}`, {
    headers: { authorization: `Bearer ${token}` },
    credentials: 'include',
  });
  const payload = (await response.json()) as ApiEnvelope<T> & {
    error?: { code: string; message: string };
  };
  if (!response.ok) throw new Error(payload.error?.message ?? 'Lookup failed.');
  return payload.data;
}

export function lookupProductBarcode<T>(barcode: string) {
  return authenticatedLookup<T>(`/products/lookup/barcode?barcode=${encodeURIComponent(barcode)}`);
}

export function lookupSellableSerial<T>(serial: string) {
  return authenticatedLookup<T>(`/serials/lookup?serial=${encodeURIComponent(serial)}`);
}

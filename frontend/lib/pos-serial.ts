export type PosSerialProduct = {
  id: string;
  name: string;
  serialized: boolean;
  available: number;
  serials: readonly string[];
};

export type PosSerialSelection = Record<string, string[]>;

export function findProductForSerial<T extends PosSerialProduct>(
  products: readonly T[],
  serial: string,
) {
  return products.find((product) => product.serials.includes(serial));
}

export function selectPosSerial(
  selected: PosSerialSelection,
  product: PosSerialProduct,
  serial: string,
) {
  const current = selected[product.id] ?? [];
  if (!product.serialized) return { selected, outcome: 'not-serialized' as const };
  if (!product.serials.includes(serial)) return { selected, outcome: 'unavailable' as const };
  if (current.includes(serial)) return { selected, outcome: 'duplicate' as const };
  if (current.length >= product.available) return { selected, outcome: 'unavailable' as const };
  return {
    selected: { ...selected, [product.id]: [...current, serial] },
    outcome: 'selected' as const,
  };
}

export function serializedCartQuantity(selected: PosSerialSelection, productId: string) {
  return selected[productId]?.length ?? 0;
}

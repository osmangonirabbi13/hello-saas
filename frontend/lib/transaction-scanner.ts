export type ScannableProduct = {
  id: string;
  name: string;
  barcode: string;
  serialized: boolean;
};

export type ScannedLine = { productId: string; quantity: number; serials: string };

export type ProductScanResult = {
  lines: ScannedLine[];
  lineIndex: number;
  outcome: 'added' | 'incremented' | 'serial-required';
};

export function applyProductScan(
  lines: ScannedLine[],
  product: ScannableProduct,
): ProductScanResult {
  const lineIndex = lines.findIndex((line) => line.productId === product.id);
  if (lineIndex === -1) {
    return {
      lines: [...lines, { productId: product.id, quantity: 1, serials: '' }],
      lineIndex: lines.length,
      outcome: product.serialized ? 'serial-required' : 'added',
    };
  }
  if (product.serialized) return { lines, lineIndex, outcome: 'serial-required' };
  return {
    lines: lines.map((line, index) =>
      index === lineIndex ? { ...line, quantity: line.quantity + 1 } : line,
    ),
    lineIndex,
    outcome: 'incremented',
  };
}

export function appendUniqueSerial(serials: string, serial: string) {
  const values = serials
    .split(/[\n,]+/)
    .map((value) => value.trim())
    .filter(Boolean);
  if (values.includes(serial)) return { value: serials, added: false };
  return { value: [...values, serial].join('\n'), added: true };
}

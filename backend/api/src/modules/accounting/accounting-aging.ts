export type AgingBucket = 'CURRENT' | '1_30' | '31_60' | '61_90' | '90_PLUS';

export function agingBucket(
  dueDate: Date | null,
  documentDate: Date,
  asOf: Date,
): { bucket: AgingBucket; ageDays: number } {
  const basis = dueDate ?? documentDate;
  const utcBasis = Date.UTC(basis.getUTCFullYear(), basis.getUTCMonth(), basis.getUTCDate());
  const utcAsOf = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());
  const ageDays = Math.max(0, Math.floor((utcAsOf - utcBasis) / 86_400_000));
  if (ageDays === 0) return { bucket: 'CURRENT', ageDays };
  if (ageDays <= 30) return { bucket: '1_30', ageDays };
  if (ageDays <= 60) return { bucket: '31_60', ageDays };
  if (ageDays <= 90) return { bucket: '61_90', ageDays };
  return { bucket: '90_PLUS', ageDays };
}

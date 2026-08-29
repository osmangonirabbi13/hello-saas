export function createOperationId() {
  return `op_${crypto.randomUUID()}`;
}
export function createLocalId() {
  return `local_${crypto.randomUUID()}`;
}

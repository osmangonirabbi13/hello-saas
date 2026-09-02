export type ApiErrorBody = {
  code?: string;
  message?: string;
  details?: {
    approvalId?: string;
    approvalNumber?: string;
    actionType?: string;
  };
};

export class ApprovalRequiredError extends Error {
  readonly code = 'APPROVAL_REQUIRED';
  constructor(
    message: string,
    readonly approvalId: string,
    readonly approvalNumber: string,
    readonly actionType: string,
  ) {
    super(message);
    this.name = 'ApprovalRequiredError';
  }
}

export function apiError(body: ApiErrorBody | undefined, fallback: string) {
  if (
    body?.code === 'APPROVAL_REQUIRED' &&
    body.details?.approvalId &&
    body.details.approvalNumber &&
    body.details.actionType
  )
    return new ApprovalRequiredError(
      body.message ?? 'Approval is required.',
      body.details.approvalId,
      body.details.approvalNumber,
      body.details.actionType,
    );
  return new Error(body?.message ?? fallback);
}

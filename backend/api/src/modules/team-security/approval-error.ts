import { AppError } from '../../common/errors/app-error.js';

export function approvalRequiredError(request: {
  id: string;
  approvalNumber: string;
  actionType: string;
}) {
  return new AppError(
    409,
    'APPROVAL_REQUIRED',
    'Approval is required before this action can be completed.',
    undefined,
    {
      approvalId: request.id,
      approvalNumber: request.approvalNumber,
      actionType: request.actionType,
    },
  );
}

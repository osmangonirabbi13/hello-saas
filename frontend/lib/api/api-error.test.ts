import { describe, expect, it } from 'vitest';
import { apiError, ApprovalRequiredError } from './api-error';

describe('STEP 11 approval-required API normalization', () => {
  it('preserves the server approval id and number for direct navigation', () => {
    const error = apiError(
      {
        code: 'APPROVAL_REQUIRED',
        message: 'Approval is required.',
        details: {
          approvalId: 'apr_1',
          approvalNumber: 'APR-000001',
          actionType: 'DAMAGE_POST',
        },
      },
      'Request failed.',
    );
    expect(error).toBeInstanceOf(ApprovalRequiredError);
    expect(error).toMatchObject({
      approvalId: 'apr_1',
      approvalNumber: 'APR-000001',
      actionType: 'DAMAGE_POST',
    });
  });

  it('does not invent approval navigation for incomplete server errors', () => {
    expect(apiError({ code: 'APPROVAL_REQUIRED' }, 'Request failed.')).not.toBeInstanceOf(
      ApprovalRequiredError,
    );
  });
});

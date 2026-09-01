'use client';
import { SetupWorkspace } from './setup-workspace';
import { CoaWorkspace } from './coa-workspace';
import { JournalWorkspace } from './journal-workspace';
import { SubledgerWorkspace } from './subledger-workspace';
import { LedgerWorkspace, ProfitLossWorkspace, TrialBalanceWorkspace } from './report-workspace';
type View =
  | 'overview'
  | 'accounts'
  | 'journals'
  | 'ledger'
  | 'receivables'
  | 'payables'
  | 'trial'
  | 'pnl'
  | 'periods'
  | 'settings';
export function AccountingWorkspace({ view }: { view: View }) {
  if (view === 'accounts') return <CoaWorkspace />;
  if (view === 'journals') return <JournalWorkspace />;
  if (view === 'receivables' || view === 'payables')
    return <SubledgerWorkspace kind={view === 'receivables' ? 'receivable' : 'payable'} />;
  if (view === 'ledger') return <LedgerWorkspace />;
  if (view === 'trial') return <TrialBalanceWorkspace />;
  if (view === 'pnl' || view === 'overview') return <ProfitLossWorkspace />;
  return <SetupWorkspace />;
}

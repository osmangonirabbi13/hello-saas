import { Wifi } from 'lucide-react';
import type { Capability } from '@/lib/offline/capabilities';
import { offlineCapability } from '@/lib/offline/capabilities';

export function OnlineRequiredNote({ capability }: { capability: Capability }) {
  if (offlineCapability(capability) !== 'ONLINE_REQUIRED') return null;
  return <p className="inline-flex items-center gap-1.5 text-xs text-slate-500"><Wifi aria-hidden size={14}/>Internet is required for this final action. Draft data can be saved locally when offline support is enabled.</p>;
}

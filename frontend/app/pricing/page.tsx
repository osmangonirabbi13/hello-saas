import type { Metadata } from 'next';
import { MarketingPage } from '@/components/marketing/site';
export const metadata: Metadata = {
  title: 'Pricing | Hello Shop',
  description: 'Simple Hello Shop plans with a server-controlled seven-day free trial.',
};
export default function PricingPage() {
  return <MarketingPage kind="pricing" />;
}

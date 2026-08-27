import type { Metadata } from 'next';
import { MarketingPage } from '@/components/marketing/site';
export const metadata: Metadata = {
  title: 'Features | Hello Shop',
  description:
    'Inventory, purchase, sales, VAT, barcode, IMEI and secure business operations in one ERP.',
};
export default function FeaturesPage() {
  return <MarketingPage kind="features" />;
}

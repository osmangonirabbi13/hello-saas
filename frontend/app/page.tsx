import type { Metadata } from 'next';
import { MarketingPage } from '@/components/marketing/site';

export const metadata: Metadata = {
  title: 'Hello Shop | ERP & POS for Bangladesh',
  description:
    'Run products, inventory, purchasing, sales, VAT, barcode and IMEI workflows from one secure workspace.',
};

export default function HomePage() {
  return <MarketingPage />;
}

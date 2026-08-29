import { InvoiceDocument } from '@/components/sale/invoice-document';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InvoiceDocument saleId={id} />;
}

import { InvitationRegistration } from '@/components/team-security/invitation-registration';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = '' } = await searchParams;
  return <InvitationRegistration token={token} />;
}

import { AppShell } from '@/components/app-shell';
export default function ErpLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AppShell>{children}</AppShell>;
}

'use client';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell,
  ChevronDown,
  Globe2,
  Headphones,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  Search,
  Sun,
  UserRound,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { BUSINESS_PERMISSIONS_FIXTURE } from '@/lib/demo/permissions';
import { visibleNavigation } from '@/lib/navigation';
import { cn } from '@/lib/utils';

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const demoMode =
    process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || process.env.NODE_ENV === 'development';
  useEffect(() => {
    const token = sessionStorage.getItem('hello_shop_access');
    if (!token && !demoMode) {
      router.replace('/login');
      return;
    }
    setCollapsed(localStorage.getItem('hello_shop_sidebar') === 'collapsed');
    try {
      const stored = JSON.parse(
        sessionStorage.getItem('hello_shop_permissions') ?? '[]',
      ) as string[];
      setPermissions(stored.length ? stored : demoMode ? [...BUSINESS_PERMISSIONS_FIXTURE] : []);
    } catch {
      setPermissions(demoMode ? [...BUSINESS_PERMISSIONS_FIXTURE] : []);
    }
    setReady(true);
  }, [demoMode, router]);
  const items = useMemo(() => visibleNavigation(new Set(permissions)), [permissions]);
  function toggleSidebar() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('hello_shop_sidebar', next ? 'collapsed' : 'expanded');
  }
  function logout() {
    sessionStorage.removeItem('hello_shop_access');
    sessionStorage.removeItem('hello_shop_permissions');
    router.replace('/login');
  }
  if (!ready)
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-500">
        Preparing your workspace…
      </div>
    );
  return (
    <div className={cn('min-h-screen bg-slate-50 text-slate-900', dark && 'dark')}>
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[270px] flex-col border-r border-slate-800 bg-[#10251f] text-slate-200 transition-transform lg:translate-x-0',
          !drawer && '-translate-x-full',
          collapsed && 'lg:w-[78px]',
        )}
      >
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-500 font-black text-white">
            H
          </span>
          <div className={cn('min-w-0 flex-1', collapsed && 'lg:hidden')}>
            <strong className="block truncate text-[15px] text-white">Hello Shop</strong>
            <small className="block truncate text-[10px] uppercase tracking-widest text-emerald-300/70">
              Business ERP
            </small>
          </div>
          <button
            className="hidden rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white lg:block"
            onClick={toggleSidebar}
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose size={18} />
          </button>
        </div>
        <nav
          className="flex-1 overflow-y-auto px-2.5 py-3 [scrollbar-width:thin]"
          aria-label="Main navigation"
        >
          {items.map((item) => (
            <div className="mb-1" key={item.id}>
              {item.href ? (
                <Link
                  className={cn(
                    'flex h-10 items-center gap-3 rounded-lg px-3 text-[13px] font-medium text-slate-300 hover:bg-white/8 hover:text-white',
                    pathname === item.href &&
                      'bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-400/15',
                    collapsed && 'lg:justify-center lg:px-0',
                  )}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon size={18} />
                  <span className={cn('flex-1', collapsed && 'lg:hidden')}>{item.label}</span>
                  {item.badge && <NavBadge collapsed={collapsed}>{item.badge}</NavBadge>}
                </Link>
              ) : (
                <details
                  className="group"
                  open={item.children?.some(
                    (child) => child.href && pathname.startsWith(child.href.split('?')[0]!),
                  )}
                >
                  <summary
                    className={cn(
                      'flex h-10 cursor-pointer list-none items-center gap-3 rounded-lg px-3 text-[13px] font-medium text-slate-300 hover:bg-white/8 hover:text-white',
                      collapsed && 'lg:justify-center lg:px-0',
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon size={18} />
                    <span className={cn('flex-1', collapsed && 'lg:hidden')}>{item.label}</span>
                    {item.badge && <NavBadge collapsed={collapsed}>{item.badge}</NavBadge>}
                    <ChevronDown
                      className={cn(
                        'transition-transform group-open:rotate-180',
                        collapsed && 'lg:hidden',
                      )}
                      size={14}
                    />
                  </summary>
                  <div
                    className={cn(
                      'ml-8 mt-1 space-y-0.5 border-l border-white/10 pl-3',
                      collapsed && 'lg:hidden',
                    )}
                  >
                    {item.children?.map((child) => (
                      <Link
                        className={cn(
                          'flex min-h-8 items-center justify-between rounded-md px-2 py-1.5 text-xs text-slate-400 hover:bg-white/8 hover:text-white',
                          pathname === child.href?.split('?')[0] && 'bg-white/8 text-emerald-300',
                        )}
                        href={child.href ?? '#'}
                        key={child.id}
                      >
                        <span>{child.label}</span>
                        {child.badge && <NavBadge>{child.badge}</NavBadge>}
                      </Link>
                    ))}
                  </div>
                </details>
              )}
            </div>
          ))}
        </nav>
        <div
          className={cn(
            'm-3 rounded-xl border border-white/10 bg-white/5 p-3',
            collapsed && 'lg:grid lg:place-items-center lg:p-2',
          )}
        >
          <Headphones className="text-emerald-300" size={18} />
          <div className={cn('mt-2', collapsed && 'lg:hidden')}>
            <p className="text-xs font-semibold text-white">Need assistance?</p>
            <p className="mt-0.5 text-[10px] text-slate-400">+880 1700 000 000</p>
          </div>
        </div>
      </aside>
      {drawer && (
        <button
          className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
          onClick={() => setDrawer(false)}
          aria-label="Close navigation"
        />
      )}
      <div className={cn('transition-[padding] lg:pl-[270px]', collapsed && 'lg:pl-[78px]')}>
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          <button
            className="rounded-lg border border-slate-200 p-2 text-slate-600 lg:hidden"
            onClick={() => setDrawer(true)}
            aria-label="Open navigation"
          >
            <Menu size={19} />
          </button>
          <label className="relative hidden w-full max-w-md md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-14 text-sm outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
              placeholder="Search menu, invoice, customer…"
            />
            <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-400">
              ⌘K
            </kbd>
          </label>
          <div className="ml-auto flex items-center gap-1.5">
            <button className="top-icon" onClick={() => setDark(!dark)} aria-label="Toggle theme">
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <Dropdown
              label={
                <>
                  <Globe2 size={18} />
                  <span className="hidden sm:inline">EN</span>
                </>
              }
            >
              <MenuItem>English</MenuItem>
              <MenuItem>বাংলা</MenuItem>
            </Dropdown>
            <a
              className="top-icon hidden sm:inline-flex"
              href="tel:+8801700000000"
              aria-label="Support"
            >
              <Headphones size={18} />
            </a>
            <button className="top-icon relative" aria-label="Notifications">
              <Bell size={18} />
              <i className="absolute right-2 top-2 size-1.5 rounded-full bg-rose-500" />
            </button>
            <Dropdown
              label={
                <>
                  <span className="grid size-7 place-items-center rounded-lg bg-emerald-100 text-[10px] font-bold text-emerald-700">
                    HS
                  </span>
                  <span className="hidden text-left sm:block">
                    <b className="block text-xs text-slate-800">Owner</b>
                    <small className="block text-[10px] text-slate-400">Hello Shop</small>
                  </span>
                  <ChevronDown size={13} />
                </>
              }
              align="end"
            >
              <MenuItem>
                <UserRound size={15} />
                My account
              </MenuItem>
              <MenuItem onSelect={logout}>
                <LogOut size={15} />
                Sign out
              </MenuItem>
            </Dropdown>
          </div>
        </header>
        <main className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-7">{children}</main>
      </div>
    </div>
  );
}
function NavBadge({ children, collapsed }: { children: ReactNode; collapsed?: boolean }) {
  return (
    <small
      className={cn(
        'rounded-full bg-emerald-400/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300',
        collapsed && 'lg:hidden',
      )}
    >
      {children}
    </small>
  );
}
function Dropdown({
  label,
  children,
  align = 'center',
}: {
  label: ReactNode;
  children: ReactNode;
  align?: 'center' | 'end';
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="top-icon gap-1.5">{label}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          sideOffset={8}
          className="z-[70] min-w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
        >
          <DropdownMenu.Arrow className="fill-white" />
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
function MenuItem({ children, onSelect }: { children: ReactNode; onSelect?: () => void }) {
  return (
    <DropdownMenu.Item
      {...(onSelect ? { onSelect } : {})}
      className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-700 outline-none hover:bg-slate-50 focus:bg-slate-50"
    >
      {children}
    </DropdownMenu.Item>
  );
}

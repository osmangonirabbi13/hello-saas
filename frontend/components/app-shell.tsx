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
  PanelLeftOpen,
  Search,
  Sun,
  UserRound,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { BUSINESS_PERMISSIONS_FIXTURE } from '@/lib/demo/permissions';
import { visibleNavigation } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import {
  businessInitial,
  DEMO_AUTHENTICATED_CONTEXT,
  formatRole,
  loadAuthenticatedContext,
  type AuthenticatedContext,
} from '@/lib/authenticated-context';
import { SyncCenter } from '@/components/offline/sync-center';
import { getOfflineDb } from '@/lib/offline/db';
import { SyncOutboxRepository } from '@/lib/offline/repositories';
import { syncOfflineChanges } from '@/lib/offline/sync-runtime';
import { hydrateOfflineReferences } from '@/lib/offline/hydration';

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [context, setContext] = useState<AuthenticatedContext | null>(null);
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
      const resolved = stored.length ? stored : demoMode ? [...BUSINESS_PERMISSIONS_FIXTURE] : [];
      setPermissions(resolved);
      if (token) {
        void loadAuthenticatedContext(token)
          .then((value) => {
            setContext(value);
            setPermissions(value.membership.permissions);
          })
          .catch(() => {
            if (demoMode)
              setContext({
                ...DEMO_AUTHENTICATED_CONTEXT,
                membership: { ...DEMO_AUTHENTICATED_CONTEXT.membership, permissions: resolved },
              });
          });
      } else if (demoMode) {
        setContext({
          ...DEMO_AUTHENTICATED_CONTEXT,
          membership: { ...DEMO_AUTHENTICATED_CONTEXT.membership, permissions: resolved },
        });
      }
    } catch {
      setPermissions(demoMode ? [...BUSINESS_PERMISSIONS_FIXTURE] : []);
    }
    setReady(true);
  }, [demoMode, router]);
  const items = useMemo(() => visibleNavigation(new Set(permissions)), [permissions]);
  const activeContext = context ?? DEMO_AUTHENTICATED_CONTEXT;
  const offlineScope = { userId: activeContext.user.id, businessRef: activeContext.business.id };
  useEffect(() => {
    sessionStorage.setItem('hello_shop_offline_scope', JSON.stringify(offlineScope));
    void hydrateOfflineReferences(offlineScope);
  }, [offlineScope.businessRef, offlineScope.userId]);
  function toggleSidebar() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('hello_shop_sidebar', next ? 'collapsed' : 'expanded');
  }
  async function logout() {
    const unsynced = (await new SyncOutboxRepository(getOfflineDb()).pending(offlineScope)).length;
    if (
      unsynced &&
      !window.confirm(
        `${unsynced} changes have not synced yet. Cancel to sync first, or continue to sign out while keeping them safely partitioned.`,
      )
    )
      return;
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
          'fixed inset-y-0 left-0 z-50 flex w-[270px] flex-col border-r border-slate-800 bg-[#10251f] text-slate-200 transition-[width,transform] duration-200 motion-reduce:transition-none lg:translate-x-0',
          !drawer && '-translate-x-full',
          collapsed && 'lg:w-[78px]',
        )}
      >
        <div
          className={cn(
            'relative flex min-h-20 items-center gap-3 border-b border-white/10 px-4 py-3',
            collapsed && 'lg:flex-col lg:justify-center lg:gap-2 lg:px-2',
          )}
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-500 font-black text-white">
            {businessInitial(activeContext.business.name)}
          </span>
          <div className={cn('min-w-0 flex-1', collapsed && 'lg:hidden')}>
            <strong
              className="block truncate text-[15px] text-white"
              title={activeContext.business.name}
            >
              {activeContext.business.name}
            </strong>
            <small className="block truncate text-[10px] uppercase tracking-widest text-emerald-300/70">
              Business ERP
            </small>
          </div>
          <button
            className="hidden size-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 lg:inline-flex"
            onClick={toggleSidebar}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
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
            <p className="mt-0.5 text-[10px] text-slate-400">Contact Hello Shop support</p>
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
      <div
        className={cn(
          'transition-[padding] duration-200 motion-reduce:transition-none lg:pl-[270px]',
          collapsed && 'lg:pl-[78px]',
        )}
      >
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
            <SyncCenter
              scope={offlineScope}
              onSync={() => syncOfflineChanges(offlineScope)}
            />
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
              href="/features"
              aria-label="Help and product guidance"
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
                    {businessInitial(activeContext.business.name)}
                  </span>
                  <span className="hidden text-left sm:block">
                    <b className="block text-xs text-slate-800">
                      {formatRole(activeContext.membership.role)}
                    </b>
                    <small
                      className="block max-w-36 truncate text-[10px] text-slate-500"
                      title={activeContext.business.name}
                    >
                      {activeContext.business.name}
                    </small>
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
              <MenuItem onSelect={() => void logout()}>
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

'use client';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import Link from 'next/link';
import { ChevronDown, Plus } from 'lucide-react';
import { Button } from './ui/primitives';
const actions = [
  ['New sale', '/sales/new'],
  ['New purchase', '/purchases/new'],
  ['New customer', '/customers'],
  ['New product', '/products/new'],
];
export function DashboardAddMenu() {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button>
          <Plus size={16} />
          Add new
          <ChevronDown size={14} />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
        >
          {actions.map(([label, href]) => (
            <DropdownMenu.Item asChild key={href}>
              <Link
                className="block rounded-lg px-3 py-2 text-sm text-slate-700 outline-none hover:bg-slate-50 focus:bg-slate-50"
                href={href!}
              >
                {label}
              </Link>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

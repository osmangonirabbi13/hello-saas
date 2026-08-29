'use client';
import { RouteError } from '@/components/ui/route-state';
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) { return <RouteError title="Unable to load customers" reset={reset} />; }

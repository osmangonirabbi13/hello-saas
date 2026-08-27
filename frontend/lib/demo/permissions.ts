import { navigation } from '@/lib/navigation';
export const BUSINESS_PERMISSIONS_FIXTURE = navigation
  .flatMap((item) => [item.permission, ...(item.children?.map((child) => child.permission) ?? [])])
  .filter((permission): permission is string => Boolean(permission));

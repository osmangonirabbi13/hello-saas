export const plans = [
  {
    name: 'Starter',
    price: '৳1,490',
    description: 'For a single growing shop building reliable daily operations.',
    featured: false,
    features: ['1 outlet', 'Products and inventory', 'Purchase and sales', 'Barcode-ready POS'],
  },
  {
    name: 'Business',
    price: '৳2,990',
    description: 'For established teams that need stronger controls and visibility.',
    featured: true,
    features: ['3 outlets', 'Role-based access', 'VAT sales', 'IMEI and serial tracking'],
  },
  {
    name: 'Scale',
    price: 'Talk to us',
    description: 'For multi-location operations with tailored rollout needs.',
    featured: false,
    features: ['Custom outlets', 'Priority onboarding', 'Advanced controls', 'Dedicated support'],
  },
] as const;

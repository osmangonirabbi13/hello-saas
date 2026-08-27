export const demoDashboard = {
  stats: [
    {
      title: 'Sales',
      amount: 1248900,
      tone: 'emerald',
      metrics: [
        ['Paid', '৳9,84,200'],
        ['Due', '৳2,64,700'],
        ['Recovered', '78.8%'],
      ],
    },
    {
      title: 'Purchase',
      amount: 746500,
      tone: 'blue',
      metrics: [
        ['Paid', '৳6,10,000'],
        ['Due', '৳1,36,500'],
        ['Paid rate', '81.7%'],
      ],
    },
    {
      title: 'Cash Flow',
      amount: 418200,
      tone: 'violet',
      metrics: [
        ['Received', '৳12,68,400'],
        ['Paid out', '৳8,50,200'],
        ['Net flow', '+32.9%'],
      ],
    },
    {
      title: 'Account',
      amount: 932450,
      tone: 'amber',
      metrics: [
        ['Active', '6 accounts'],
        ['Expense', '৳1,18,600'],
        ['Available', 'Healthy'],
      ],
    },
  ],
  secondary: [
    { label: 'Sales invoice', value: '286', delta: '+12.4%' },
    { label: 'Purchase invoice', value: '94', delta: '+6.8%' },
    { label: 'Cash flow entries', value: '412', delta: '+18.2%' },
    { label: 'Expense', value: '৳1.18L', delta: '-3.1%' },
    { label: 'Service paid', value: '৳86.4K', delta: '+9.7%' },
  ],
  distribution: [
    { name: 'Sales', value: 52, fill: '#147d64' },
    { name: 'Purchase', value: 28, fill: '#4f7cff' },
    { name: 'Expense', value: 12, fill: '#e2a33a' },
    { name: 'Service', value: 8, fill: '#8b5cf6' },
  ],
  trend: Array.from({ length: 12 }, (_, index) => ({
    day: String(index * 2 + 1).padStart(2, '0'),
    sales: 54 + ((index * 17) % 46),
    purchase: 31 + ((index * 11) % 32),
  })),
  insights: [
    { label: 'Receivable', value: '৳2,64,700', note: '18 customers', tone: 'rose' },
    { label: 'Payable', value: '৳1,36,500', note: '9 suppliers', tone: 'orange' },
    { label: 'Low stock', value: '14', note: '5 need attention', tone: 'amber' },
    { label: 'RMA pending', value: '8', note: '3 overdue', tone: 'violet' },
  ],
  activity: [
    { title: 'Sale HS-INV-10842 posted', meta: 'Rahman Computers · ৳48,500', time: '8 min' },
    { title: 'Customer payment received', meta: 'Nabila Enterprise · ৳22,000', time: '24 min' },
    {
      title: 'Purchase HS-PUR-3392 received',
      meta: 'Tech Distribution Ltd · 16 items',
      time: '1 hr',
    },
    { title: 'RMA status updated', meta: 'RMA-0284 · Ready for delivery', time: '2 hr' },
  ],
};

'use client';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { demoDashboard } from '@/lib/demo/dashboard';

export function FinancialDistributionChart() {
  return (
    <div className="grid h-64 grid-cols-[1fr_130px] items-center">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={demoDashboard.distribution}
            dataKey="value"
            innerRadius={58}
            outerRadius={82}
            paddingAngle={3}
          >
            {demoDashboard.distribution.map((entry) => (
              <Cell fill={entry.fill} key={entry.name} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
      <div className="space-y-3">
        {demoDashboard.distribution.map((entry) => (
          <div className="flex items-center justify-between gap-3 text-xs" key={entry.name}>
            <span className="flex items-center gap-2 text-slate-500">
              <i className="size-2 rounded-full" style={{ background: entry.fill }} />
              {entry.name}
            </span>
            <b className="text-slate-800">{entry.value}%</b>
          </div>
        ))}
      </div>
    </div>
  );
}
export function TrendChart() {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={demoDashboard.trend} margin={{ left: -18, right: 8 }}>
          <defs>
            <linearGradient id="sales" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#147d64" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#147d64" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#edf1ef" vertical={false} />
          <XAxis dataKey="day" axisLine={false} tickLine={false} fontSize={11} />
          <YAxis axisLine={false} tickLine={false} fontSize={11} />
          <Tooltip />
          <Area
            type="monotone"
            dataKey="sales"
            stroke="#147d64"
            strokeWidth={2.5}
            fill="url(#sales)"
          />
          <Area
            type="monotone"
            dataKey="purchase"
            stroke="#4f7cff"
            strokeWidth={2}
            fill="transparent"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

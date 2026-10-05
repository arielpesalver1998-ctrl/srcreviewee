export type TierKey = 'standard' | 'premium' | 'vip' | 'elite';

export interface TierInfo {
  key: TierKey;
  label: string;
  badge: string;
  description: string;
  color: string;
  bg: string;
  text: string;
  border: string;
  iconBg: string;
  accent: string;
}

export const TIERS: Record<TierKey, TierInfo> = {
  standard: {
    key: 'standard',
    label: 'Standard',
    badge: 'Standard Enrollee',
    description: 'Standard access to review materials, mock examinations, and score matrix.',
    color: 'slate',
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200',
    iconBg: 'bg-slate-50',
    accent: '#64748B',
  },
  premium: {
    key: 'premium',
    label: 'Premium',
    badge: 'Premium Reviewee',
    description: 'Advanced board exam diagnostics, subject analytics, and coaching support.',
    color: 'teal',
    bg: 'bg-teal-50',
    text: 'text-teal-700',
    border: 'border-teal-200',
    iconBg: 'bg-teal-100',
    accent: '#007C89',
  },
  vip: {
    key: 'vip',
    label: 'VIP',
    badge: 'VIP Scholar',
    description: 'Comprehensive 1-on-1 tutoring, priority review materials, and mock mastery tracks.',
    color: 'amber',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    iconBg: 'bg-amber-100',
    accent: '#D97706',
  },
  elite: {
    key: 'elite',
    label: 'Elite Honor',
    badge: 'Elite Honor Cohort',
    description: 'Top-tier board coaching cohort with intensive performance evaluation.',
    color: 'indigo',
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
    iconBg: 'bg-indigo-100',
    accent: '#6366F1',
  },
};

export function normalizeTierKey(val: any): TierKey {
  if (!val) return 'standard';
  const clean = String(val).toLowerCase().trim();
  if (clean.includes('elite') || clean.includes('honor')) return 'elite';
  if (clean.includes('vip')) return 'vip';
  if (clean.includes('prem')) return 'premium';
  return 'standard';
}

export function getAllTiers(): TierInfo[] {
  return Object.values(TIERS);
}

export function getTierInfo(val: any): TierInfo {
  const key = normalizeTierKey(val);
  return TIERS[key] || TIERS.standard;
}

export function getTierLabel(val: any): string {
  return getTierInfo(val).label;
}

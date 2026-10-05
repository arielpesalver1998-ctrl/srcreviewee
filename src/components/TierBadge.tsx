import React from 'react';
import { Award, Crown, Sparkles, Shield } from 'lucide-react';
import { getTierInfo, TierKey } from '../config/tierConfig';

export interface TierBadgeProps {
  tier?: TierKey | string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showLabel?: boolean;
  showSubtitle?: boolean;
  className?: string;
}

export const TierBadge: React.FC<TierBadgeProps> = ({
  tier,
  size = 'md',
  showIcon = true,
  showLabel = true,
  showSubtitle = false,
  className = '',
}) => {
  const info = getTierInfo(tier);

  const sizeClasses = {
    sm: 'px-2.5 py-1 text-[11px]',
    md: 'px-3 py-1.5 text-xs',
    lg: 'px-3.5 py-2 text-sm',
  }[size];

  const getIcon = () => {
    switch (info.key) {
      case 'elite':
        return <Crown size={size === 'sm' ? 12 : 14} className="text-indigo-600" />;
      case 'vip':
        return <Sparkles size={size === 'sm' ? 12 : 14} className="text-amber-600" />;
      case 'premium':
        return <Award size={size === 'sm' ? 12 : 14} className="text-teal-600" />;
      default:
        return <Shield size={size === 'sm' ? 12 : 14} className="text-slate-500" />;
    }
  };

  return (
    <div className={`inline-flex flex-col ${className}`}>
      <span
        className={`inline-flex items-center gap-1.5 rounded-full font-black uppercase tracking-wider border shadow-2xs ${info.bg} ${info.text} ${info.border} ${sizeClasses}`}
      >
        {showIcon && getIcon()}
        {showLabel && <span>{info.label} Tier</span>}
      </span>
      {showSubtitle && (
        <span className="text-[10px] text-slate-400 font-bold mt-0.5 px-1">
          {info.badge}
        </span>
      )}
    </div>
  );
};

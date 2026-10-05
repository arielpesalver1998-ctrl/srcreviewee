import React from 'react';
import { Award, Crown, Sparkles, Shield, Check } from 'lucide-react';
import { getAllTiers, TierInfo, TierKey } from '../config/tierConfig';

interface TierCardListProps {
  currentTier?: TierKey | string;
  onSelectTier?: (tierKey: TierKey) => void;
  isEditable?: boolean;
}

export const TierCardList: React.FC<TierCardListProps> = ({
  currentTier = 'standard',
  onSelectTier,
  isEditable = false,
}) => {
  const tiers = getAllTiers();

  const getTierIcon = (key: TierKey) => {
    switch (key) {
      case 'elite':
        return <Crown className="text-indigo-600" size={20} />;
      case 'vip':
        return <Sparkles className="text-amber-600" size={20} />;
      case 'premium':
        return <Award className="text-teal-600" size={20} />;
      default:
        return <Shield className="text-slate-600" size={20} />;
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {tiers.map((t) => {
        const isSelected = String(currentTier).toLowerCase() === t.key;
        return (
          <div
            key={t.key}
            onClick={() => isEditable && onSelectTier?.(t.key)}
            className={`relative rounded-2xl border p-4 transition-all ${
              isSelected
                ? `${t.bg} ${t.border} ring-2 ring-teal-500/30 shadow-md`
                : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
            } ${isEditable ? 'cursor-pointer' : ''}`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className={`p-2 rounded-xl ${t.iconBg}`}>
                {getTierIcon(t.key)}
              </div>
              {isSelected && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-600 text-white shadow-2xs">
                  <Check size={12} strokeWidth={3} />
                </span>
              )}
            </div>

            <h4 className="text-sm font-black text-slate-900">{t.label}</h4>
            <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
              {t.description}
            </p>
          </div>
        );
      })}
    </div>
  );
};

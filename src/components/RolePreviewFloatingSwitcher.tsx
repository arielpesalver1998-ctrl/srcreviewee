import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Eye,
  Shield,
  GraduationCap,
  Users,
  X,
  Check,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { isAdmin } from '../utils/roleUtils';

interface RolePreviewFloatingSwitcherProps {
  currentUser: any;
  currentMode: 'admin' | 'staff' | 'reviewee';
  onSwitchToAdmin?: () => void;
  onSwitchToStaff?: () => void;
  onSwitchToReviewee: () => void;
}

export const RolePreviewFloatingSwitcher: React.FC<RolePreviewFloatingSwitcherProps> = ({
  currentUser,
  currentMode,
  onSwitchToAdmin,
  onSwitchToStaff,
  onSwitchToReviewee,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const isDraggingRef = useRef(false);

  // Only show floating switcher for Super Admin users
  const userIsAdmin = isAdmin(currentUser);

  if (!userIsAdmin) {
    return null;
  }

  const handleSelectMode = (mode: 'admin' | 'staff' | 'reviewee') => {
    if (mode === currentMode) {
      setIsOpen(false);
      return;
    }

    if (mode === 'admin' && onSwitchToAdmin) {
      onSwitchToAdmin();
    } else if (mode === 'staff' && onSwitchToStaff) {
      onSwitchToStaff();
    } else if (mode === 'reviewee') {
      onSwitchToReviewee();
    }
    setIsOpen(false);
  };

  const previewOptions = [
    {
      key: 'admin' as const,
      title: 'Administrator Dashboard',
      shortLabel: 'Admin',
      subtitle: 'Full administrative control, folder sync, score matrix & system settings',
      icon: <Shield className="w-5 h-5 text-teal-600" />,
      badge: 'Super Admin',
      bgColor: 'bg-teal-50 hover:bg-teal-100/70 border-teal-200',
      activeColor: 'bg-teal-600 text-white',
    },
    {
      key: 'staff' as const,
      title: 'Staff Portal',
      shortLabel: 'Staff',
      subtitle: 'Score encoding, examination folders, reviewee directory & QR scanner',
      icon: <Users className="w-5 h-5 text-blue-600" />,
      badge: 'Staff Console',
      bgColor: 'bg-blue-50 hover:bg-blue-100/70 border-blue-200',
      activeColor: 'bg-blue-600 text-white',
    },
    {
      key: 'reviewee' as const,
      title: 'Reviewee Student View',
      shortLabel: 'Reviewee',
      subtitle: 'Preview the student experience, personal grades, evaluation results & progress',
      icon: <GraduationCap className="w-5 h-5 text-emerald-600" />,
      badge: 'Student View',
      bgColor: 'bg-emerald-50 hover:bg-emerald-100/70 border-emerald-200',
      activeColor: 'bg-emerald-600 text-white',
    },
  ];

  return (
    <>
      {/* Draggable Floating Action Button (Move anywhere on screen) */}
      <motion.div
        drag
        dragMomentum={false}
        dragElastic={0.1}
        onDragStart={() => {
          isDraggingRef.current = true;
        }}
        onDragEnd={() => {
          // Small timeout so click doesn't trigger immediately after dragging
          setTimeout(() => {
            isDraggingRef.current = false;
          }, 150);
        }}
        whileDrag={{ scale: 1.1, cursor: 'grabbing' }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-[9999] pointer-events-auto cursor-grab active:cursor-grabbing touch-none select-none"
        aria-label="Portal View Switcher"
      >
        <button
          type="button"
          onClick={(e) => {
            if (isDraggingRef.current) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            setIsOpen(true);
          }}
          className="w-12 h-12 rounded-full bg-gradient-to-tr from-slate-900 via-teal-950 to-slate-900 text-teal-300 flex items-center justify-center shadow-xl hover:shadow-2xl border border-teal-500/50 backdrop-blur-md transition-colors group cursor-pointer"
          title="Drag to move • Click to switch portal view"
          aria-label="Switch Role Preview"
        >
          <Eye size={22} className="group-hover:scale-110 group-hover:text-teal-200 transition-transform" />
        </button>
      </motion.div>

      {/* Modal / Dialog */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden z-10"
            >
              {/* Header */}
              <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-[#007C89]">
                    <Eye size={20} />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                      Switch Role Preview
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Select which portal interface you want to preview or manage
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Close"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body / Options */}
              <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
                {previewOptions.map((opt) => {
                  const isCurrent = currentMode === opt.key;

                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => handleSelectMode(opt.key)}
                      className={`w-full p-4 rounded-2xl border text-left transition-all flex items-start justify-between gap-3 cursor-pointer group ${
                        isCurrent
                          ? 'border-teal-500 bg-teal-50/60 ring-2 ring-teal-500/20 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start gap-3.5">
                        <div className={`p-2.5 rounded-xl border bg-white shadow-xs shrink-0 mt-0.5 ${opt.bgColor}`}>
                          {opt.icon}
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-black text-slate-900 group-hover:text-[#007C89] transition-colors">
                              {opt.title}
                            </span>
                            {isCurrent && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-teal-600 text-white shadow-xs">
                                Active View
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 font-medium leading-relaxed">
                            {opt.subtitle}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 pt-1">
                        {isCurrent ? (
                          <div className="w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center shadow-xs">
                            <Check size={14} strokeWidth={3} />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full border border-slate-300 group-hover:border-[#007C89] group-hover:bg-teal-50 flex items-center justify-center text-slate-400 group-hover:text-[#007C89] transition-colors">
                            <ChevronRight size={14} />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Footer with Cancel */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="w-full sm:w-auto px-5 py-2.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs sm:text-sm rounded-xl transition-all shadow-xs cursor-pointer flex items-center justify-center"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

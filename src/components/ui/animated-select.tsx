"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import {
  autoUpdate,
  flip,
  offset,
  shift,
  size,
  useFloating,
  useClick,
  useDismiss,
  useRole,
  useInteractions,
  FloatingPortal,
  FloatingFocusManager,
  useId,
} from "@floating-ui/react";
import { cn } from "../../lib/utils";

export type AnimatedSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
  description?: string;
  icon?: React.ReactNode;
  badge?: string;
};

type AnimatedSelectProps = {
  id?: string;
  value: string;
  options: AnimatedSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  label?: string;
  searchable?: boolean;
  mobileMode?: "popover" | "bottom-sheet";
  variant?: "default" | "compact-popover" | "searchable-popover";
  disabled?: boolean;
  onChange: (value: string) => void;
  className?: string;
  triggerClassName?: string;
  triggerTextClassName?: string;
};

export function AnimatedSelect({
  id,
  value,
  options,
  placeholder = "Select option",
  searchPlaceholder = "Search...",
  label,
  searchable = true,
  mobileMode = "popover",
  variant = "default",
  disabled = false,
  onChange,
  className,
  triggerClassName,
  triggerTextClassName,
}: AnimatedSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  
  const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches;
  const useBottomSheet = isMobile && mobileMode === "bottom-sheet";

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: "bottom-start",
    strategy: "fixed",
    transform: false,
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(6),
      flip({
        fallbackPlacements: ["bottom-end", "top-start", "top-end"],
        padding: 12,
      }),
      shift({ padding: 12 }),
      size({
        padding: 12,
        apply({ rects, availableWidth, availableHeight, elements }) {
          Object.assign(elements.floating.style, {
            width: `${rects.reference.width}px`,
            minWidth: `${Math.max(120, rects.reference.width)}px`,
            maxWidth: `${Math.min(360, Math.max(rects.reference.width, availableWidth))}px`,
            maxHeight: `${Math.min(320, availableHeight)}px`,
          });
        },
      }),
    ],
  });

  const click = useClick(context, { enabled: !disabled });
  const dismiss = useDismiss(context);
  const role = useRole(context);

  const { getReferenceProps, getFloatingProps } = useInteractions([
    click,
    dismiss,
    role,
  ]);

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = React.useMemo(() => {
    return options.filter((opt) =>
      opt.label.toLowerCase().includes(query.toLowerCase())
    );
  }, [options, query]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setQuery("");
  };

  const labelId = useId();

  React.useEffect(() => {
    if (isOpen && searchable && !useBottomSheet) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, searchable, useBottomSheet]);

  return (
    <div className={cn("relative w-full min-w-0", className)}>
      <button
        id={id}
        type="button"
        ref={refs.setReference}
        {...getReferenceProps()}
        disabled={disabled}
        className={cn(
          "flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 text-left text-xs sm:text-sm transition-all shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer",
          isOpen && "border-teal-500 ring-2 ring-teal-500/20",
          triggerClassName
        )}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {selectedOption?.icon && (
            <span className="shrink-0 flex items-center">{selectedOption.icon}</span>
          )}
          <span className={cn("truncate font-bold text-slate-800", triggerTextClassName)}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge && (
            <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-teal-50 text-teal-700 border border-teal-200/80">
              {selectedOption.badge}
            </span>
          )}
        </div>
        <ChevronDown
          size={15}
          className={cn(
            "shrink-0 opacity-60 transition-transform duration-200",
            isOpen && "rotate-180 opacity-100 text-teal-600"
          )}
        />
      </button>

      <FloatingPortal root={typeof document !== "undefined" && document.fullscreenElement ? (document.fullscreenElement as HTMLElement) : undefined}>
        <AnimatePresence>
          {isOpen && (
            <>
              {useBottomSheet ? (
                <div className="fixed inset-0 z-[100020] flex items-end justify-center bg-slate-950/50 backdrop-blur-sm">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0"
                    onClick={() => setIsOpen(false)}
                  />
                  <motion.section
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                    className="relative flex w-full max-h-[85dvh] flex-col overflow-hidden rounded-t-[2rem] bg-white shadow-2xl pb-[max(12px,env(safe-area-inset-bottom))]"
                  >
                    <header className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
                      <div className="space-y-0.5">
                        <h2 className="text-base font-black text-slate-900">
                          {label || placeholder}
                        </h2>
                        {selectedOption && (
                          <p className="text-xs font-bold text-teal-700 uppercase tracking-wider">
                            Selected: {selectedOption.label}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer"
                      >
                        <X size={18} strokeWidth={2.5} />
                      </button>
                    </header>

                    {searchable && (
                      <div className="shrink-0 border-b border-slate-100 p-3">
                        <div className="relative flex items-center">
                          <Search className="absolute left-3.5 h-4 w-4 text-slate-400" />
                          <input
                            ref={inputRef}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={searchPlaceholder}
                            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 text-xs font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all"
                          />
                          {query && (
                            <button
                              type="button"
                              onClick={() => setQuery("")}
                              className="absolute right-3.5 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
                      <div className="space-y-1">
                        {filteredOptions.length > 0 ? (
                          filteredOptions.map((option) => {
                            const isSelected = option.value === value;
                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => handleSelect(option.value)}
                                className={cn(
                                  "flex min-h-[44px] w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left transition-all cursor-pointer",
                                  isSelected
                                    ? "bg-teal-50 border border-teal-200/80 text-teal-950 font-black shadow-2xs"
                                    : "text-slate-700 hover:bg-slate-100 border border-transparent font-medium"
                                )}
                              >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  {option.icon && (
                                    <span className="shrink-0">{option.icon}</span>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className={cn(
                                        "truncate text-xs sm:text-sm",
                                        isSelected ? "font-black text-teal-900" : "font-bold text-slate-900"
                                      )}>
                                        {option.label}
                                      </span>
                                      {option.badge && (
                                        <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                                          {option.badge}
                                        </span>
                                      )}
                                    </div>
                                    {option.description && (
                                      <span className="mt-0.5 block truncate text-[11px] text-slate-500 font-medium">
                                        {option.description}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {isSelected && (
                                  <Check size={16} className="ml-2 shrink-0 text-teal-700" strokeWidth={3} />
                                )}
                              </button>
                            );
                          })
                        ) : (
                          <div className="flex flex-col items-center justify-center py-10 text-center">
                            <Search className="mb-2 h-7 w-7 text-slate-300" />
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                              No matching options found
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.section>
                </div>
              ) : (
                <FloatingFocusManager context={context} modal={false}>
                  <div
                    ref={refs.setFloating}
                    style={floatingStyles}
                    {...getFloatingProps()}
                    className="z-[100020]"
                  >
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.98 }}
                      transition={{ duration: 0.16, ease: "easeOut" }}
                      className={cn(
                        "flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white/98 backdrop-blur-md shadow-2xl outline-none",
                        variant === "compact-popover" ? "w-[min(340px,calc(100vw-24px))] max-h-[min(70dvh,520px)]" : "w-full"
                      )}
                    >
                      {variant === "compact-popover" && (
                        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-3.5 py-2.5">
                          <span className="text-xs font-black text-slate-900">{label || placeholder}</span>
                          <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-700 cursor-pointer"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )}
                      {searchable && (
                        <div className="shrink-0 border-b border-slate-100 p-2 bg-slate-50/80">
                          <div className="relative flex items-center">
                            <Search className="absolute left-2.5 h-3.5 w-3.5 text-slate-400" />
                            <input
                              ref={inputRef}
                              value={query}
                              onChange={(e) => setQuery(e.target.value)}
                              placeholder={searchPlaceholder}
                              className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-7 text-xs font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
                            />
                            {query && (
                              <button
                                type="button"
                                onClick={() => setQuery("")}
                                className="absolute right-2 p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                              >
                                <X size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="max-h-[280px] min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5 space-y-0.5">
                        {filteredOptions.length > 0 ? (
                          filteredOptions.map((option) => {
                            const isSelected = option.value === value;
                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => handleSelect(option.value)}
                                className={cn(
                                  "flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left transition-all cursor-pointer",
                                  isSelected
                                    ? "bg-teal-50 border border-teal-200/90 text-teal-950 font-black shadow-2xs"
                                    : "text-slate-700 hover:bg-slate-100/80 border border-transparent font-medium"
                                )}
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  {option.icon && (
                                    <span className="shrink-0">{option.icon}</span>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                      <span className={cn(
                                        "truncate text-xs",
                                        isSelected ? "font-black text-teal-950" : "font-bold text-slate-900"
                                      )}>
                                        {option.label}
                                      </span>
                                      {option.badge && (
                                        <span className="shrink-0 px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                                          {option.badge}
                                        </span>
                                      )}
                                    </div>
                                    {option.description && (
                                      <span className="block truncate text-[10px] text-slate-500 font-medium">
                                        {option.description}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {isSelected && (
                                  <Check size={14} className="ml-2 shrink-0 text-teal-700" strokeWidth={3} />
                                )}
                              </button>
                            );
                          })
                        ) : (
                          <div className="py-6 text-center">
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                              No options match search
                            </p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </div>
                </FloatingFocusManager>
              )}
            </>
          )}
        </AnimatePresence>
      </FloatingPortal>
    </div>
  );
}

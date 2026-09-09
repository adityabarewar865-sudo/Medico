import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface LiveDateTimeProps {
  className?: string;
  variant?: 'header' | 'badge' | 'compact' | 'card';
  showIcon?: boolean;
}

export const LiveDateTime: React.FC<LiveDateTimeProps> = ({
  className = '',
  variant = 'header',
  showIcon = true,
}) => {
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());

  useEffect(() => {
    // Update every second accurately using local browser/device time
    const timer = setInterval(() => {
      setCurrentDate(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format: 12:24:05 PM
  const timeStr = currentDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  // Format: Wednesday
  const dayStr = currentDate.toLocaleDateString('en-US', {
    weekday: 'long',
  });

  // Format: 08 September 2026
  const dateStr = currentDate.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  if (variant === 'compact') {
    return (
      <div
        className={`inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 ${className}`}
        title="Live local time"
      >
        {showIcon && <Clock className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />}
        <span className="font-mono font-bold tracking-tight text-teal-700 dark:text-teal-300">{timeStr}</span>
        <span className="text-slate-300 dark:text-slate-600">•</span>
        <span>{dayStr}</span>
        <span className="text-slate-300 dark:text-slate-600">•</span>
        <span>{dateStr}</span>
      </div>
    );
  }

  if (variant === 'badge') {
    return (
      <div
        className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs ${className}`}
        title="Live local time"
      >
        {showIcon && <Clock className="w-3 h-3 text-teal-600 dark:text-teal-400 shrink-0" />}
        <span className="font-mono font-black text-slate-900 dark:text-white">{timeStr}</span>
        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
          {dayStr}, {dateStr}
        </span>
      </div>
    );
  }

  // Default 'header' / 'card' layout
  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/95 dark:bg-slate-800/95 border border-slate-200 dark:border-slate-700 shadow-2xs text-left select-none transition-colors ${className}`}
      title="Live Device / Hospital Local Time (updates every second)"
    >
      {showIcon && (
        <div className="w-7 h-7 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0 border border-teal-100 dark:border-teal-900">
          <Clock className="w-3.5 h-3.5 animate-pulse" />
        </div>
      )}
      <div className="flex flex-col leading-tight">
        <span className="font-mono text-xs sm:text-sm font-black text-teal-800 dark:text-teal-300 tracking-tight">
          {timeStr}
        </span>
        <span className="text-[10px] sm:text-[11px] font-semibold text-slate-600 dark:text-slate-300">
          {dayStr} • {dateStr}
        </span>
      </div>
    </div>
  );
};

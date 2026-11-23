import React, { useState, useRef } from 'react';
import { FileDown, TrendingUp, TrendingDown, Wrench } from 'lucide-react';
import { ThreeHardwareScene } from './ThreeHardwareScene';
import { clampWelcomeTilt, formatWelcome3DTitle, AppThemeMode } from '../utils/welcome3d';

interface Welcome3DBannerProps {
  storeName?: string;
  today: string;
  performanceStatus: 'profitable' | 'loss' | 'breakeven';
  theme?: AppThemeMode;
  onExportMasterPdf: () => void;
}

export const Welcome3DBanner: React.FC<Welcome3DBannerProps> = ({
  storeName,
  today,
  performanceStatus,
  theme = 'light',
  onExportMasterPdf,
}) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const headline = formatWelcome3DTitle(storeName);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    const el = stageRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt(clampWelcomeTilt(nx, ny, 6));
  };

  const handlePointerLeave = () => {
    setTilt({ rx: 0, ry: 0 });
  };

  const isDark = theme === 'dark';

  return (
    <section
      ref={stageRef}
      data-testid="welcome-3d-banner"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      aria-label={headline}
      className={`relative rounded-2xl border shadow-sm transition-colors duration-200 ${
        isDark
          ? 'bg-gradient-to-l from-slate-950 via-slate-900 to-amber-950/50 border-amber-500/30 text-white'
          : 'bg-gradient-to-l from-[#fffdf7] via-[#f8fafc] to-[#fef3c7]/70 border-amber-300/70 text-slate-900'
      }`}
    >
      {/* Clipped Real-time 3D Hardware Backdrop + Contrast Scrim */}
      <div
        aria-hidden="true"
        className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none"
      >
        <ThreeHardwareScene
          interactive={true}
          theme={theme}
          speed={0.75}
          className={isDark ? 'opacity-55' : 'opacity-45'}
        />

        <div
          className={`absolute inset-0 ${
            isDark
              ? 'bg-gradient-to-l from-slate-950/90 via-slate-950/65 to-slate-900/80'
              : 'bg-gradient-to-l from-white/88 via-[#f8fafc]/75 to-amber-50/82'
          }`}
        />
      </div>

      {/* Foreground 3D Perspective Stage */}
      <div
        className="relative z-10 p-5 sm:px-7 sm:py-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5 stage-3d-preserve"
        style={{
          transform: `perspective(1100px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
          transition: 'transform 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* 3D Extruded Welcome Headline Block */}
        <div className="space-y-2 min-w-0 flex-1 stage-3d-preserve">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-300">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/35 text-amber-700 dark:text-amber-300 shadow-xs">
              <Wrench className="w-3.5 h-3.5" />
            </span>
            <span>نظام المحاسبة الذكي · بإدارة أحمد المامو</span>
          </div>

          <h2
            className={`text-2xl sm:text-3xl xl:text-[2.1rem] font-black leading-[1.3] tracking-tight select-none px-0.5 ${
              isDark ? 'text-3d-hardware-night' : 'text-3d-hardware-day'
            }`}
            style={{
              transform: 'translateZ(14px)',
              transformOrigin: 'right center',
            }}
          >
            {headline}
          </h2>

          <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
            <span>لوحة الإدارة اليومية المتكاملة للخردوات ومواد البناء</span>
            <span aria-hidden="true" className="mx-2 text-slate-400">
              ·
            </span>
            <span className="font-mono tabular-nums text-slate-700 dark:text-amber-200">
              {today}
            </span>
          </p>
        </div>

        {/* Actions & Monthly Result */}
        <div
          className="flex flex-wrap items-center gap-3 shrink-0 stage-3d-preserve"
          style={{ transform: 'translateZ(20px)' }}
        >
          <button
            type="button"
            onClick={onExportMasterPdf}
            title="تنزيل التقرير الشامل لكافة مؤشرات وبيانات المتجر بصيغة PDF"
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs transition-all shadow-md hover:shadow-lg cursor-pointer whitespace-nowrap shrink-0"
          >
            <FileDown className="w-4 h-4 text-slate-950 shrink-0" />
            <span>تنزيل تقرير كل المعلومات (PDF)</span>
          </button>

          <div
            className={`flex items-center gap-3 px-4 py-2 rounded-xl border shrink-0 ${
              isDark
                ? 'bg-slate-900/80 border-slate-700/80 text-white'
                : 'bg-white/95 border-slate-200/90 text-slate-900 shadow-2xs'
            }`}
          >
            <div className="text-right">
              <span className="text-[11px] text-slate-500 dark:text-slate-300 block">
                نتيجة أداء الشهر
              </span>
              <span
                className={`text-sm font-black ${
                  performanceStatus === 'profitable'
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : performanceStatus === 'loss'
                    ? 'text-rose-700 dark:text-rose-400'
                    : 'text-amber-700 dark:text-amber-400'
                }`}
              >
                {performanceStatus === 'profitable'
                  ? 'رابح (+)'
                  : performanceStatus === 'loss'
                  ? 'خاسر (-)'
                  : 'متعادل (0)'}
              </span>
            </div>
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                performanceStatus === 'profitable'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                  : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'
              }`}
            >
              {performanceStatus === 'profitable' ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

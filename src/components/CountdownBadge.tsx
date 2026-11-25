import { Clock, CheckCircle2 } from 'lucide-react';
import type { ItemStatus } from '@shared/types';

interface CountdownBadgeProps {
  timerStartedAt: string | null;
  timerEndsAt: string | null;
  nowMs: number;
  status: ItemStatus;
  compact?: boolean;
}

export function formatDuration(seconds: number): string {
  const clamped = Math.max(0, Math.ceil(seconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function CountdownBadge({
  timerStartedAt,
  timerEndsAt,
  nowMs,
  status,
  compact = false,
}: CountdownBadgeProps) {
  if (status === 'ready') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-2.5 py-1 text-xs font-bold text-white">
        <CheckCircle2 className="h-3.5 w-3.5 text-red-500" />
        Ready
      </span>
    );
  }

  if (!timerEndsAt) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-600">
        <Clock className="h-3 w-3" />
        Waiting for chef
      </span>
    );
  }

  const endMs = new Date(timerEndsAt).getTime();
  const startMs = timerStartedAt ? new Date(timerStartedAt).getTime() : endMs;
  const remainingSec = Math.max(0, Math.ceil((endMs - nowMs) / 1000));
  const totalSec = Math.max(1, Math.round((endMs - startMs) / 1000));
  const progressPct = Math.min(100, Math.max(0, ((totalSec - remainingSec) / totalSec) * 100));
  const isUrgent = remainingSec <= 30;

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${
          isUrgent ? 'bg-red-600 text-white pulse-crimson' : 'bg-red-50 text-red-700 border border-red-200'
        }`}
      >
        <Clock className="h-3.5 w-3.5" />
        {formatDuration(remainingSec)}
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1 min-w-[116px]">
      <div
        className={`inline-flex items-center justify-between gap-2 rounded-lg px-2.5 py-1 text-xs font-bold tabular-nums ${
          isUrgent ? 'bg-red-600 text-white pulse-crimson' : 'bg-neutral-900 text-white'
        }`}
      >
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5 text-red-400" />
          Prep
        </span>
        <span>{formatDuration(remainingSec)}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
        <div
          className="h-full rounded-full bg-red-600 transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
}

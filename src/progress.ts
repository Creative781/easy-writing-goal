import type {
  CountUnit,
  PluginSettings,
  SessionSnapshot,
  Weekday,
  WritingProject,
} from "./models";

/** Local calendar date YYYY-MM-DD. */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Session "today" after applying reset hour.
 * If now is before resetHour, still belongs to previous calendar day.
 */
export function sessionDateKey(now: Date, resetHour: number): string {
  const d = new Date(now);
  if (d.getHours() < resetHour) {
    d.setDate(d.getDate() - 1);
  }
  return toDateKey(d);
}

export function parseDateKey(key: string): Date | null {
  const normalized = normalizeDeadlineKey(key);
  if (!normalized) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Normalize stored deadline to YYYY-MM-DD for date input / calculations. */
export function normalizeDeadlineKey(deadline: string): string {
  const trimmed = deadline.trim();
  if (!trimmed) return "";

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (iso) return trimmed;

  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(trimmed);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;

  return "";
}

export function resolveUnit(
  project: WritingProject,
  settings: PluginSettings
): CountUnit {
  return project.unit ?? settings.defaultUnit;
}

/**
 * Count remaining writing days from sessionToday through deadline (inclusive optional).
 */
export function countWorkingDaysLeft(
  todayKey: string,
  deadlineKey: string,
  writingDays: Weekday[],
  includeDeadlineDay: boolean
): number {
  const start = parseDateKey(todayKey);
  const end = parseDateKey(deadlineKey);
  if (!start || !end || end < start) return 0;

  const writing = new Set(writingDays);
  let count = 0;
  const cursor = new Date(start);

  while (cursor <= end) {
    const isDeadline = toDateKey(cursor) === deadlineKey;
    if (isDeadline && !includeDeadlineDay) {
      break;
    }
    if (writing.has(cursor.getDay() as Weekday)) {
      count += 1;
    }
    if (isDeadline) break;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

export function computeSessionTarget(
  project: WritingProject,
  remaining: number,
  todayKey: string
): { sessionTarget: number; workingDaysLeft: number | null } {
  if (!project.autoSessionTarget || !project.deadline) {
    return {
      sessionTarget: Math.max(0, project.manualSessionTarget),
      workingDaysLeft: project.deadline
        ? countWorkingDaysLeft(
            todayKey,
            project.deadline,
            project.writingDays,
            project.includeDeadlineDay
          )
        : null,
    };
  }

  const days = countWorkingDaysLeft(
    todayKey,
    project.deadline,
    project.writingDays,
    project.includeDeadlineDay
  );

  if (days <= 0) {
    return { sessionTarget: Math.max(0, remaining), workingDaysLeft: 0 };
  }

  return {
    sessionTarget: Math.max(0, Math.ceil(remaining / days)),
    workingDaysLeft: days,
  };
}

export function ensureSnapshot(
  existing: SessionSnapshot | undefined,
  dateKey: string,
  currentTotal: number
): SessionSnapshot {
  if (existing && existing.dateKey === dateKey) {
    return {
      dateKey,
      startTotal: existing.startTotal,
      lastTotal: currentTotal,
    };
  }
  return {
    dateKey,
    startTotal: currentTotal,
    lastTotal: currentTotal,
  };
}

export function todayWritten(snapshot: SessionSnapshot, currentTotal: number): number {
  return currentTotal - snapshot.startTotal;
}

export function clampPercent(current: number, target: number): number {
  if (target <= 0) return current > 0 ? 100 : 0;
  return Math.min(100, Math.max(0, (current / target) * 100));
}

export const WEEKDAY_LABELS: { value: Weekday; label: string; short: string }[] = [
  { value: 0, label: "Sunday", short: "일" },
  { value: 1, label: "Monday", short: "월" },
  { value: 2, label: "Tuesday", short: "화" },
  { value: 3, label: "Wednesday", short: "수" },
  { value: 4, label: "Thursday", short: "목" },
  { value: 5, label: "Friday", short: "금" },
  { value: 6, label: "Saturday", short: "토" },
];

/** Count unit used across the vault (global setting). */
export type CountUnit = "chars" | "chars-no-space" | "words";

/** Weekday: 0 = Sunday … 6 = Saturday (JS Date.getDay()). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface WritingProject {
  id: string;
  name: string;
  /** Override unit for this project; null = use global setting. */
  unit: CountUnit | null;
  target: number;
  /** ISO date YYYY-MM-DD, or empty if none. */
  deadline: string;
  /** Days the user plans to write. */
  writingDays: Weekday[];
  includeDeadlineDay: boolean;
  /** Hour (0–23) when the session counter resets. */
  sessionResetHour: number;
  autoSessionTarget: boolean;
  /** Manual session target when auto is off. */
  manualSessionTarget: number;
}

export interface SessionSnapshot {
  /** Calendar date of the session bucket (local, after reset-hour adjust). */
  dateKey: string;
  startTotal: number;
  lastTotal: number;
}

/** path → end-of-day totals by dateKey */
export type ProjectHistory = Record<string, number>;

export interface PluginSettings {
  /** Frontmatter key that assigns a note to a writing project. */
  projectProperty: string;
  defaultUnit: CountUnit;
  excludeCodeBlocks: boolean;
  excludeFrontmatter: boolean;
  projects: Record<string, WritingProject>;
  snapshots: Record<string, SessionSnapshot>;
  /** projectId → dateKey → total count at end of that day */
  history: Record<string, ProjectHistory>;
  statusBarShowSession: boolean;
  statusBarShowProject: boolean;
}

export const DEFAULT_WRITING_DAYS: Weekday[] = [1, 2, 3, 4, 5];

export const DEFAULT_SETTINGS: PluginSettings = {
  projectProperty: "writing-project",
  defaultUnit: "words",
  excludeCodeBlocks: true,
  excludeFrontmatter: true,
  projects: {},
  snapshots: {},
  history: {},
  statusBarShowSession: true,
  statusBarShowProject: true,
};

export function createProject(
  id: string,
  name: string,
  partial?: Partial<WritingProject>
): WritingProject {
  return {
    id,
    name,
    unit: null,
    target: 10000,
    deadline: "",
    writingDays: [...DEFAULT_WRITING_DAYS],
    includeDeadlineDay: true,
    sessionResetHour: 0,
    autoSessionTarget: true,
    manualSessionTarget: 500,
    ...partial,
  };
}

export interface FileCountResult {
  path: string;
  count: number;
  projectId: string | null;
}

export interface ProjectProgress {
  project: WritingProject;
  unit: CountUnit;
  total: number;
  target: number;
  projectPercent: number;
  remaining: number;
  sessionTarget: number;
  todayWritten: number;
  sessionPercent: number;
  workingDaysLeft: number | null;
  deadline: string;
  files: FileCountResult[];
}

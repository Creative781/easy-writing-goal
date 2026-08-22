import { App, TFile, normalizePath } from "obsidian";
import { countText } from "./counter";
import {
  createProject,
  type FileCountResult,
  type PluginSettings,
  type ProjectProgress,
  type WritingProject,
} from "./models";
import {
  clampPercent,
  computeSessionTarget,
  ensureSnapshot,
  resolveUnit,
  sessionDateKey,
  todayWritten,
  toDateKey,
} from "./progress";

export class ProjectService {
  /** projectId → set of vault paths */
  private index = new Map<string, Set<string>>();
  /** path → projectId */
  private pathToProject = new Map<string, string | null>();
  /** path → cached count for current unit config fingerprint */
  private countCache = new Map<string, { fingerprint: string; count: number }>();

  constructor(
    private app: App,
    private getSettings: () => PluginSettings,
    private saveSettings: () => Promise<void>
  ) {}

  async rebuildIndex(): Promise<void> {
    this.index.clear();
    this.pathToProject.clear();
    this.countCache.clear();

    const files = this.app.vault.getMarkdownFiles();
    for (const file of files) {
      this.indexFile(file);
    }
  }

  indexFile(file: TFile): void {
    const settings = this.getSettings();
    const cache = this.app.metadataCache.getFileCache(file);
    const fm = cache?.frontmatter;
    const raw = fm?.[settings.projectProperty];
    const projectId =
      typeof raw === "string" && raw.trim() ? raw.trim() : null;

    const prev = this.pathToProject.get(file.path);
    if (prev && prev !== projectId) {
      this.index.get(prev)?.delete(file.path);
    }

    this.pathToProject.set(file.path, projectId);
    if (projectId) {
      if (!this.index.has(projectId)) this.index.set(projectId, new Set());
      this.index.get(projectId)!.add(file.path);
    }
    this.countCache.delete(file.path);
  }

  removeFile(path: string): void {
    const prev = this.pathToProject.get(path);
    if (prev) this.index.get(prev)?.delete(path);
    this.pathToProject.delete(path);
    this.countCache.delete(path);
  }

  renameFile(oldPath: string, newPath: string): void {
    const projectId = this.pathToProject.get(oldPath) ?? null;
    this.removeFile(oldPath);
    this.pathToProject.set(newPath, projectId);
    if (projectId) {
      if (!this.index.has(projectId)) this.index.set(projectId, new Set());
      this.index.get(projectId)!.add(newPath);
    }
  }

  getProjectIdForPath(path: string): string | null {
    return this.pathToProject.get(path) ?? null;
  }

  getPathsForProject(projectId: string): string[] {
    return [...(this.index.get(projectId) ?? [])].sort();
  }

  listKnownProjectIds(): string[] {
    const fromSettings = Object.keys(this.getSettings().projects);
    const fromIndex = [...this.index.keys()];
    return [...new Set([...fromSettings, ...fromIndex])].sort();
  }

  private fingerprint(unit: string): string {
    const s = this.getSettings();
    return `${unit}|${s.excludeCodeBlocks}|${s.excludeFrontmatter}`;
  }

  async countFile(file: TFile, unit: ReturnType<typeof resolveUnit>): Promise<number> {
    const fp = this.fingerprint(unit);
    const cached = this.countCache.get(file.path);
    if (cached && cached.fingerprint === fp) return cached.count;

    const raw = await this.app.vault.cachedRead(file);
    const settings = this.getSettings();
    const count = countText(raw, unit, {
      excludeFrontmatter: settings.excludeFrontmatter,
      excludeCodeBlocks: settings.excludeCodeBlocks,
    });
    this.countCache.set(file.path, { fingerprint: fp, count });
    return count;
  }

  ensureProjectRecord(id: string, name?: string): WritingProject {
    const settings = this.getSettings();
    if (!settings.projects[id]) {
      settings.projects[id] = createProject(id, name ?? id);
    }
    return settings.projects[id];
  }

  async computeProgress(projectId: string): Promise<ProjectProgress | null> {
    const settings = this.getSettings();
    const project = settings.projects[projectId] ?? this.ensureProjectRecord(projectId);
    const unit = resolveUnit(project, settings);
    const paths = this.getPathsForProject(projectId);
    const files: FileCountResult[] = [];

    let total = 0;
    for (const path of paths) {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (!(file instanceof TFile)) continue;
      const count = await this.countFile(file, unit);
      total += count;
      files.push({
        path,
        count,
        projectId,
      });
    }

    const target = Math.max(0, project.target);
    const remaining = Math.max(0, target - total);
    const todayKey = sessionDateKey(new Date(), project.sessionResetHour);
    const { sessionTarget, workingDaysLeft } = computeSessionTarget(
      project,
      remaining,
      todayKey
    );

    const snapshot = ensureSnapshot(
      settings.snapshots[projectId],
      todayKey,
      total
    );
    settings.snapshots[projectId] = snapshot;

    // Persist daily history peak/end total
    if (!settings.history[projectId]) settings.history[projectId] = {};
    settings.history[projectId][todayKey] = total;

    const written = todayWritten(snapshot, total);

    return {
      project,
      unit,
      total,
      target,
      projectPercent: clampPercent(total, target),
      remaining,
      sessionTarget,
      todayWritten: written,
      sessionPercent: clampPercent(Math.max(0, written), sessionTarget),
      workingDaysLeft,
      deadline: project.deadline,
      files,
    };
  }

  async refreshSnapshot(projectId: string): Promise<void> {
    await this.computeProgress(projectId);
    await this.saveSettings();
  }

  async assignFileToProject(file: TFile, projectId: string): Promise<void> {
    const settings = this.getSettings();
    this.ensureProjectRecord(projectId);
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      fm[settings.projectProperty] = projectId;
    });
    this.indexFile(file);
    await this.saveSettings();
  }

  async createProject(name: string, id?: string): Promise<WritingProject> {
    const slug =
      id?.trim() ||
      name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9가-힣]+/gi, "-")
        .replace(/^-|-$/g, "") ||
      `project-${Date.now()}`;
    const project = createProject(slug, name.trim() || slug);
    this.getSettings().projects[slug] = project;
    await this.saveSettings();
    return project;
  }

  async deleteProject(projectId: string, clearFrontmatter: boolean): Promise<void> {
    const settings = this.getSettings();
    const paths = this.getPathsForProject(projectId);
    delete settings.projects[projectId];
    delete settings.snapshots[projectId];
    delete settings.history[projectId];

    if (clearFrontmatter) {
      for (const path of paths) {
        const file = this.app.vault.getAbstractFileByPath(normalizePath(path));
        if (file instanceof TFile) {
          await this.app.fileManager.processFrontMatter(file, (fm) => {
            delete fm[settings.projectProperty];
          });
        }
      }
    }

    await this.saveSettings();
    await this.rebuildIndex();
  }

  /** Prune history older than N days (optional maintenance). */
  pruneHistory(keepDays = 365): void {
    const settings = this.getSettings();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - keepDays);
    const cutoffKey = toDateKey(cutoff);

    for (const projectId of Object.keys(settings.history)) {
      const hist = settings.history[projectId];
      for (const key of Object.keys(hist)) {
        if (key < cutoffKey) delete hist[key];
      }
    }
  }
}

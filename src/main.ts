import {
  MarkdownView,
  Notice,
  Plugin,
  TFile,
  WorkspaceLeaf,
} from "obsidian";
import { DEFAULT_SETTINGS, type PluginSettings } from "./models";
import {
  AssignProjectModal,
  CreateProjectModal,
  TargetsModal,
} from "./modals";
import { HistoryModal } from "./historyModal";
import {
  ProjectsView,
  VIEW_TYPE_WRITING_GOALS,
} from "./projectsView";
import { ProjectService } from "./service";
import { WritingGoalsSettingTab } from "./settingsTab";
import { StatusBarController } from "./statusBar";

export default class WritingGoalsPlugin extends Plugin {
  settings: PluginSettings = DEFAULT_SETTINGS;
  service!: ProjectService;
  private statusBar!: StatusBarController;
  private debounceTimer: number | null = null;
  private saveTimer: number | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.service = new ProjectService(
      this.app,
      () => this.settings,
      () => this.saveSettings()
    );

    this.registerView(
      VIEW_TYPE_WRITING_GOALS,
      (leaf) => new ProjectsView(leaf, this)
    );

    const statusEl = this.addStatusBarItem();
    this.statusBar = new StatusBarController(statusEl, () => {
      const id = this.statusBar.getProjectId();
      if (id) this.openTargets(id);
      else void this.activateView();
    });

    this.addRibbonIcon("target", "Easy Writing Goal", () => {
      void this.activateView();
    });

    this.addSettingTab(new WritingGoalsSettingTab(this.app, this));

    this.addCommand({
      id: "open-writing-goals-view",
      name: "Open writing goals view",
      callback: () => void this.activateView(),
    });

    this.addCommand({
      id: "show-project-targets",
      name: "Show project targets",
      callback: () => {
        const id = this.getActiveProjectId();
        if (!id) {
          new Notice("Active note is not in a writing project.");
          return;
        }
        this.openTargets(id);
      },
    });

    this.addCommand({
      id: "create-writing-project",
      name: "Create writing project",
      callback: () => {
        new CreateProjectModal(this.app, this.service, (id) => {
          this.openTargets(id);
          this.refreshAll();
        }).open();
      },
    });

    this.addCommand({
      id: "assign-note-to-project",
      name: "Assign note to writing project",
      checkCallback: (checking) => {
        const file = this.getActiveFile();
        if (!file) return false;
        if (!checking) {
          new AssignProjectModal(this.app, this.service, file, () => {
            this.refreshAll();
          }).open();
        }
        return true;
      },
    });

    this.addCommand({
      id: "show-writing-history",
      name: "Show writing history",
      callback: () => {
        const id = this.getActiveProjectId();
        if (!id) {
          new Notice("Active note is not in a writing project.");
          return;
        }
        this.openHistory(id);
      },
    });

    this.app.workspace.onLayoutReady(() => {
      void this.bootstrap();
    });

    this.registerEvent(
      this.app.metadataCache.on("changed", (file) => {
        if (file instanceof TFile) {
          this.service.indexFile(file);
          this.scheduleRefresh();
        }
      })
    );

    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof TFile && file.extension === "md") {
          this.service.indexFile(file);
          this.scheduleRefresh();
        }
      })
    );

    this.registerEvent(
      this.app.vault.on("create", (file) => {
        if (file instanceof TFile && file.extension === "md") {
          this.service.indexFile(file);
          this.scheduleRefresh();
        }
      })
    );

    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (file instanceof TFile) {
          this.service.removeFile(file.path);
          this.scheduleRefresh();
        }
      })
    );

    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        if (file instanceof TFile) {
          this.service.renameFile(oldPath, file.path);
          this.scheduleRefresh();
        }
      })
    );

    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        this.scheduleRefresh();
      })
    );

    // Midnight / session-boundary check every minute
    this.registerInterval(
      window.setInterval(() => {
        this.scheduleRefresh();
      }, 60_000)
    );
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_WRITING_GOALS);
  }

  private async bootstrap(): Promise<void> {
    await this.service.rebuildIndex();
    // Ensure orphan frontmatter project ids exist as records
    for (const id of this.service.listKnownProjectIds()) {
      this.service.ensureProjectRecord(id);
    }
    await this.saveSettings();
    this.refreshAll();
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      await this.loadData()
    );
    // Deep-merge nested maps that assign would shallow-overwrite incorrectly if missing
    this.settings.projects = this.settings.projects ?? {};
    this.settings.snapshots = this.settings.snapshots ?? {};
    this.settings.history = this.settings.history ?? {};
  }

  async saveSettings(): Promise<void> {
    // Debounce disk writes during rapid typing/recount
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      void this.saveData(this.settings);
    }, 400);
  }

  scheduleRefresh(): void {
    if (this.debounceTimer !== null) window.clearTimeout(this.debounceTimer);
    this.debounceTimer = window.setTimeout(() => {
      this.refreshAll();
    }, 350);
  }

  refreshAll(): void {
    void this.refreshStatusBar();
    this.app.workspace.getLeavesOfType(VIEW_TYPE_WRITING_GOALS).forEach((leaf) => {
      const view = leaf.view;
      if (view instanceof ProjectsView) view.requestRender();
    });
  }

  private async refreshStatusBar(): Promise<void> {
    const file = this.getActiveFile();
    if (!file) {
      this.statusBar.clear();
      return;
    }

    const projectId = this.service.getProjectIdForPath(file.path);
    if (!projectId) {
      this.statusBar.clear();
      return;
    }

    this.service.ensureProjectRecord(projectId);
    const progress = await this.service.computeProgress(projectId);
    if (!progress) {
      this.statusBar.clear();
      return;
    }

    this.statusBar.render(progress, {
      showProject: this.settings.statusBarShowProject,
      showSession: this.settings.statusBarShowSession,
    });

    // Persist snapshot/history without blocking UI hard
    void this.saveSettings();
  }

  getActiveFile(): TFile | null {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    return view?.file ?? null;
  }

  getActiveProjectId(): string | null {
    const file = this.getActiveFile();
    if (!file) return null;
    return this.service.getProjectIdForPath(file.path);
  }

  openTargets(projectId: string, onChanged?: () => void): void {
    new TargetsModal(this.app, this, this.service, projectId, () => {
      this.refreshAll();
      onChanged?.();
    }).open();
  }

  openHistory(projectId: string): void {
    new HistoryModal(this.app, this, projectId).open();
  }

  async activateView(): Promise<void> {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null = null;
    const existing = workspace.getLeavesOfType(VIEW_TYPE_WRITING_GOALS);
    if (existing.length > 0) {
      leaf = existing[0];
    } else {
      leaf = workspace.getRightLeaf(false);
      if (!leaf) leaf = workspace.getLeaf(true);
      await leaf.setViewState({ type: VIEW_TYPE_WRITING_GOALS, active: true });
    }
    workspace.revealLeaf(leaf);
  }
}

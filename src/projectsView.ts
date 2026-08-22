import { ItemView, WorkspaceLeaf, Notice, setIcon } from "obsidian";
import { formatCount, unitLabel } from "./counter";
import type { ProjectProgress } from "./models";
import type WritingGoalsPlugin from "./main";
import { AssignProjectModal, CreateProjectModal } from "./modals";

export const VIEW_TYPE_WRITING_GOALS = "writing-goals-view";

export class ProjectsView extends ItemView {
  private refreshTimer: number | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private plugin: WritingGoalsPlugin
  ) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_WRITING_GOALS;
  }

  getDisplayText(): string {
    return "Easy Writing Goal";
  }

  getIcon(): string {
    return "target";
  }

  async onOpen(): Promise<void> {
    await this.render();
  }

  async onClose(): Promise<void> {
    if (this.refreshTimer !== null) {
      window.clearTimeout(this.refreshTimer);
    }
  }

  requestRender(): void {
    if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => {
      void this.render();
    }, 200);
  }

  async render(): Promise<void> {
    const container = this.contentEl;
    container.empty();
    container.addClass("writing-goals-view");

    const header = container.createDiv({ cls: "writing-goals-view-header" });
    header.createEl("h2", { text: "Easy Writing Goal" });

    const toolbar = header.createDiv({ cls: "writing-goals-toolbar" });
    this.iconButton(toolbar, "plus", "New project", () => {
      new CreateProjectModal(this.app, this.plugin.service, (id) => {
        this.plugin.openTargets(id);
        void this.render();
      }).open();
    }, true);
    this.iconButton(toolbar, "refresh-cw", "Refresh", () => void this.render());

    const file = this.plugin.getActiveFile();
    if (!file) {
      this.renderEmpty(
        container,
        "열린 노트가 없습니다.",
        "노트를 열면 해당 프로젝트 목표가 여기에 표시됩니다."
      );
      return;
    }

    const projectId = this.plugin.service.getProjectIdForPath(file.path);
    if (!projectId) {
      const empty = this.renderEmpty(
        container,
        "프로젝트 목표가 없습니다.",
        `이 노트에 ${this.plugin.settings.projectProperty} 속성이 없거나, 아직 프로젝트에 연결되지 않았습니다.`
      );
      const actions = empty.createDiv({ cls: "writing-goals-empty-actions" });
      const assignBtn = actions.createEl("button", {
        text: "프로젝트에 연결",
        cls: "mod-cta",
        type: "button",
      });
      assignBtn.addEventListener("click", () => {
        new AssignProjectModal(this.app, this.plugin.service, file, () => {
          this.plugin.refreshAll();
        }).open();
      });
      return;
    }

    this.plugin.service.ensureProjectRecord(projectId);
    let progress: ProjectProgress | null = null;
    try {
      progress = await this.plugin.service.computeProgress(projectId);
    } catch (e) {
      console.error(e);
    }
    if (!progress) {
      this.renderEmpty(container, "진행률을 계산할 수 없습니다.", "");
      return;
    }

    const card = container.createDiv({ cls: "writing-goals-card" });
    const titleRow = card.createDiv({ cls: "writing-goals-card-title" });
    titleRow.createEl("h3", { text: progress.project.name });

    const actions = titleRow.createDiv({ cls: "writing-goals-card-actions" });
    this.iconButton(actions, "sliders-horizontal", "Targets", () => {
      this.plugin.openTargets(projectId);
    });
    this.iconButton(actions, "calendar", "History", () => {
      this.plugin.openHistory(projectId);
    });
    this.iconButton(actions, "trash-2", "Delete", async () => {
      const ok = confirm(
        `Delete project “${progress!.project.name}”? Notes keep their frontmatter.`
      );
      if (!ok) return;
      await this.plugin.service.deleteProject(projectId, false);
      new Notice("Project deleted");
      await this.render();
    }, false, true);

    this.drawCompactBar(
      card,
      "Project",
      progress.total,
      progress.target,
      progress.projectPercent,
      unitLabel(progress.unit, true)
    );
    this.drawCompactBar(
      card,
      "Today",
      Math.max(0, progress.todayWritten),
      progress.sessionTarget,
      progress.sessionPercent,
      unitLabel(progress.unit, true),
      true
    );

    const metaBits: string[] = [`${progress.files.length} notes`];
    if (progress.deadline) {
      metaBits.push(progress.deadline);
      if (progress.workingDaysLeft !== null) {
        metaBits.push(`${progress.workingDaysLeft}d left`);
      }
    }
    card.createDiv({
      cls: "writing-goals-meta",
      text: metaBits.join(" · "),
    });

    await this.plugin.saveSettings();
  }

  private renderEmpty(
    parent: HTMLElement,
    title: string,
    detail: string
  ): HTMLElement {
    const empty = parent.createDiv({ cls: "writing-goals-empty-state" });
    empty.createDiv({ cls: "writing-goals-empty-title", text: title });
    if (detail) {
      empty.createDiv({ cls: "writing-goals-empty-detail", text: detail });
    }
    return empty;
  }

  private drawCompactBar(
    parent: HTMLElement,
    label: string,
    current: number,
    target: number,
    percent: number,
    unitShort: string,
    session = false
  ): void {
    const row = parent.createDiv({ cls: "writing-goals-compact-row" });
    row.createSpan({
      cls: "writing-goals-compact-label",
      text: label,
    });
    row.createSpan({
      cls: "writing-goals-compact-nums",
      text: `${formatCount(current)}/${formatCount(target)}${unitShort} (${percent.toFixed(0)}%)`,
    });
    const track = parent.createDiv({
      cls: session
        ? "writing-goals-bar-track is-session"
        : "writing-goals-bar-track",
    });
    const fill = track.createDiv({
      cls: session
        ? "writing-goals-bar-fill is-session"
        : "writing-goals-bar-fill",
    });
    fill.style.width = `${Math.min(100, percent)}%`;
    if (percent >= 100) fill.addClass("is-complete");
  }

  private iconButton(
    parent: HTMLElement,
    icon: string,
    tooltip: string,
    onClick: () => void | Promise<void>,
    cta = false,
    warning = false
  ): void {
    const btn = parent.createEl("button", {
      cls:
        "writing-goals-icon-btn" +
        (cta ? " is-cta" : "") +
        (warning ? " is-warning" : ""),
      attr: { "aria-label": tooltip, title: tooltip, type: "button" },
    });
    setIcon(btn, icon);
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      void onClick();
    });
  }
}

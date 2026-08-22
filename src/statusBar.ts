import { setIcon } from "obsidian";
import { formatCount, unitLabel } from "./counter";
import type { ProjectProgress } from "./models";

export class StatusBarController {
  private el: HTMLElement;
  private projectId: string | null = null;

  constructor(
    statusBarEl: HTMLElement,
    private onClick: () => void
  ) {
    this.el = statusBarEl;
    this.el.addClass("writing-goals-status");
    this.el.setAttr("aria-label", "Easy Writing Goal");
    this.el.addEventListener("click", () => this.onClick());
    this.clear();
  }

  clear(): void {
    this.projectId = null;
    this.el.empty();
    this.el.hide();
  }

  getProjectId(): string | null {
    return this.projectId;
  }

  render(
    progress: ProjectProgress,
    options: { showProject: boolean; showSession: boolean }
  ): void {
    this.projectId = progress.project.id;
    this.el.empty();
    this.el.show();

    const icon = this.el.createSpan({ cls: "writing-goals-status-icon" });
    setIcon(icon, "target");

    const parts: string[] = [];
    const u = unitLabel(progress.unit, true);

    if (options.showProject) {
      parts.push(
        `${progress.project.name} ${formatCount(progress.total)}/${formatCount(progress.target)}${u}`
      );
    }
    if (options.showSession && progress.sessionTarget > 0) {
      const today = Math.max(0, progress.todayWritten);
      parts.push(
        `오늘 ${formatCount(today)}/${formatCount(progress.sessionTarget)}${u}`
      );
    }

    this.el.createSpan({
      text: parts.join(" · ") || progress.project.name,
      cls: "writing-goals-status-text",
    });

    const pct = options.showSession
      ? progress.sessionPercent
      : progress.projectPercent;
    this.el.toggleClass("is-complete", pct >= 100);
    this.el.toggleClass("is-behind", pct < 40 && progress.sessionTarget > 0);
  }
}

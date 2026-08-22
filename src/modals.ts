import { App, Modal, Notice, Setting, TFile } from "obsidian";
import { formatCount, unitLabel } from "./counter";
import type { CountUnit, ProjectProgress, WritingProject } from "./models";
import { WEEKDAY_LABELS, normalizeDeadlineKey } from "./progress";
import type { ProjectService } from "./service";
import type WritingGoalsPlugin from "./main";

export class TargetsModal extends Modal {
  private progress: ProjectProgress | null = null;

  constructor(
    app: App,
    private plugin: WritingGoalsPlugin,
    private service: ProjectService,
    private projectId: string,
    private onChanged: () => void
  ) {
    super(app);
  }

  async onOpen(): Promise<void> {
    this.modalEl.addClass("writing-goals-targets-modal");
    await this.refresh();
  }

  private async refresh(): Promise<void> {
    this.progress = await this.service.computeProgress(this.projectId);
    await this.plugin.saveSettings();
    this.draw();
  }

  private draw(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("writing-goals-modal");

    const progress = this.progress;
    if (!progress) {
      this.setTitle("Targets");
      contentEl.createEl("p", { text: "Project not found." });
      return;
    }

    const project = progress.project;
    project.deadline = normalizeDeadlineKey(project.deadline);
    this.setTitle(project.name);

    const summary = contentEl.createDiv({ cls: "writing-goals-modal-summary" });
    this.drawBar(
      summary,
      "Project",
      progress.total,
      progress.target,
      progress.projectPercent,
      progress.unit
    );
    this.drawBar(
      summary,
      "Today",
      Math.max(0, progress.todayWritten),
      progress.sessionTarget,
      progress.sessionPercent,
      progress.unit
    );

    const meta = summary.createDiv({ cls: "writing-goals-meta" });
    if (progress.deadline) {
      meta.setText(
        `${progress.deadline}` +
          (progress.workingDaysLeft !== null
            ? ` · ${progress.workingDaysLeft} writing days left`
            : "") +
          ` · ${unitLabel(progress.unit)} · ${progress.files.length} notes`
      );
    } else {
      meta.setText(
        `No deadline · ${unitLabel(progress.unit)} · ${progress.files.length} notes`
      );
    }

    const form = contentEl.createDiv({ cls: "writing-goals-modal-form" });

    new Setting(form).setName("Display name").addText((t) =>
      t.setValue(project.name).onChange(async (v) => {
        project.name = v.trim() || project.id;
        await this.plugin.saveSettings();
        this.setTitle(project.name);
        this.onChanged();
      })
    );

    new Setting(form)
      .setName("Project target")
      .setDesc(`Total ${unitLabel(progress.unit)} for all notes in this project.`)
      .addText((t) =>
        t.setValue(String(project.target)).onChange(async (v) => {
          const n = Number(v);
          if (!Number.isFinite(n) || n < 0) return;
          project.target = Math.round(n);
          await this.plugin.saveSettings();
          await this.refresh();
          this.onChanged();
        })
      );

    new Setting(form)
      .setName("Unit override")
      .setDesc("Empty = plugin default.")
      .addDropdown((d) => {
        d.addOption("", "Default");
        d.addOption("chars", "Characters");
        d.addOption("chars-no-space", "Characters (no spaces)");
        d.addOption("words", "Words");
        d.setValue(project.unit ?? "");
        d.onChange(async (v) => {
          project.unit = (v || null) as CountUnit | null;
          await this.plugin.saveSettings();
          await this.refresh();
          this.onChanged();
        });
      });

    const deadlineSetting = new Setting(form)
      .setName("Deadline")
      .setDesc("Click to pick a date from the calendar.");
    const deadlineControls = deadlineSetting.controlEl.createDiv({
      cls: "writing-goals-deadline-controls",
    });
    const dateInput = deadlineControls.createEl("input", {
      type: "date",
      cls: "writing-goals-date-input",
    });
    dateInput.value = project.deadline;
    dateInput.addEventListener("change", async () => {
      project.deadline = dateInput.value;
      await this.plugin.saveSettings();
      await this.refresh();
      this.onChanged();
    });
    const clearBtn = deadlineControls.createEl("button", {
      text: "Clear",
      cls: "writing-goals-date-clear",
      type: "button",
    });
    clearBtn.toggleClass("is-hidden", !project.deadline);
    clearBtn.addEventListener("click", async () => {
      project.deadline = "";
      dateInput.value = "";
      clearBtn.addClass("is-hidden");
      await this.plugin.saveSettings();
      await this.refresh();
      this.onChanged();
    });
    dateInput.addEventListener("input", () => {
      clearBtn.toggleClass("is-hidden", !dateInput.value);
    });

    this.drawWritingDaysBlock(form, project);

    new Setting(form).setName("Include deadline day").addToggle((tg) =>
      tg.setValue(project.includeDeadlineDay).onChange(async (v) => {
        project.includeDeadlineDay = v;
        await this.plugin.saveSettings();
        await this.refresh();
        this.onChanged();
      })
    );

    new Setting(form)
      .setName("Auto session from deadline")
      .addToggle((tg) =>
        tg.setValue(project.autoSessionTarget).onChange(async (v) => {
          project.autoSessionTarget = v;
          await this.plugin.saveSettings();
          await this.refresh();
          this.onChanged();
        })
      );

    if (!project.autoSessionTarget) {
      new Setting(form).setName("Manual session target").addText((t) =>
        t.setValue(String(project.manualSessionTarget)).onChange(async (v) => {
          const n = Number(v);
          if (!Number.isFinite(n) || n < 0) return;
          project.manualSessionTarget = Math.round(n);
          await this.plugin.saveSettings();
          await this.refresh();
          this.onChanged();
        })
      );
    }

    new Setting(form)
      .setName("Session reset hour")
      .setDesc("0–23. 0 = midnight. Use 4 if you write past midnight.")
      .addText((t) =>
        t
          .setPlaceholder("0")
          .setValue(String(project.sessionResetHour))
          .onChange(async (v) => {
            const n = Number(v.trim());
            if (!Number.isInteger(n) || n < 0 || n > 23) return;
            project.sessionResetHour = n;
            await this.plugin.saveSettings();
            await this.refresh();
            this.onChanged();
          })
      );

    const notes = contentEl.createDiv({ cls: "writing-goals-modal-notes" });
    notes.createEl("div", {
      cls: "writing-goals-modal-section-label",
      text: "Notes",
    });
    const list = notes.createEl("ul", { cls: "writing-goals-file-list" });
    if (progress.files.length === 0) {
      list.createEl("li", {
        text: `Add ${this.plugin.settings.projectProperty}: ${project.id}`,
      });
    } else {
      for (const f of progress.files) {
        const li = list.createEl("li");
        const name = f.path.split("/").pop() ?? f.path;
        li.createSpan({ text: `${name} — ${formatCount(f.count)}` });
      }
    }

    const footer = contentEl.createDiv({ cls: "writing-goals-modal-footer" });
    const histBtn = footer.createEl("button", { text: "History", type: "button" });
    histBtn.addEventListener("click", () => {
      this.close();
      this.plugin.openHistory(project.id);
    });
    const closeBtn = footer.createEl("button", {
      text: "Close",
      cls: "mod-cta",
      type: "button",
    });
    closeBtn.addEventListener("click", () => this.close());
  }

  private drawWritingDaysBlock(
    parent: HTMLElement,
    project: WritingProject
  ): void {
    const block = parent.createDiv({ cls: "writing-goals-days-block" });
    block.createDiv({ cls: "writing-goals-days-title", text: "Writing days" });
    block.createDiv({
      cls: "writing-goals-days-desc",
      text: "글쓰는 요일. 일일 세션 목표 계산에 사용됩니다.",
    });
    const row = block.createDiv({ cls: "writing-goals-days" });
    for (const day of WEEKDAY_LABELS) {
      const label = row.createEl("label", { cls: "writing-goals-day" });
      const cb = label.createEl("input", { type: "checkbox" });
      cb.checked = project.writingDays.includes(day.value);
      label.createSpan({ text: day.short });
      label.setAttr("title", day.label);
      cb.addEventListener("change", async () => {
        if (cb.checked) {
          if (!project.writingDays.includes(day.value)) {
            project.writingDays = [...project.writingDays, day.value].sort(
              (a, b) => a - b
            ) as WritingProject["writingDays"];
          }
        } else {
          if (project.writingDays.length <= 1) {
            cb.checked = true;
            new Notice("At least one writing day is required.");
            return;
          }
          project.writingDays = project.writingDays.filter((d) => d !== day.value);
        }
        await this.plugin.saveSettings();
        await this.refresh();
        this.onChanged();
      });
    }
  }

  private drawBar(
    parent: HTMLElement,
    label: string,
    current: number,
    target: number,
    percent: number,
    unit: CountUnit
  ): void {
    const wrap = parent.createDiv({ cls: "writing-goals-bar-block" });
    wrap.createDiv({
      cls: "writing-goals-bar-label",
      text: `${label}: ${formatCount(current)} / ${formatCount(target)} ${unitLabel(unit)} (${percent.toFixed(0)}%)`,
    });
    const track = wrap.createDiv({ cls: "writing-goals-bar-track" });
    const fill = track.createDiv({ cls: "writing-goals-bar-fill" });
    fill.style.width = `${Math.min(100, percent)}%`;
    if (percent >= 100) fill.addClass("is-complete");
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export class CreateProjectModal extends Modal {
  private nameValue = "";
  private idValue = "";

  constructor(
    app: App,
    private service: ProjectService,
    private onCreated: (id: string) => void
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle("New writing project");
    const { contentEl } = this;

    new Setting(contentEl).setName("Name").addText((t) =>
      t.setPlaceholder("Dissertation ch.3").onChange((v) => {
        this.nameValue = v;
      })
    );

    new Setting(contentEl)
      .setName("ID (optional)")
      .setDesc("Used in frontmatter. Auto-generated from name if empty.")
      .addText((t) =>
        t.setPlaceholder("dissertation-ch3").onChange((v) => {
          this.idValue = v;
        })
      );

    new Setting(contentEl).addButton((b) =>
      b
        .setButtonText("Create")
        .setCta()
        .onClick(async () => {
          if (!this.nameValue.trim() && !this.idValue.trim()) {
            new Notice("Enter a name or ID.");
            return;
          }
          const project = await this.service.createProject(
            this.nameValue || this.idValue,
            this.idValue || undefined
          );
          new Notice(`Created project “${project.name}”`);
          this.close();
          this.onCreated(project.id);
        })
    );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export class AssignProjectModal extends Modal {
  constructor(
    app: App,
    private service: ProjectService,
    private file: TFile,
    private onAssigned: () => void
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle("Assign to writing project");
    const { contentEl } = this;
    const ids = this.service.listKnownProjectIds();

    if (ids.length === 0) {
      contentEl.createEl("p", {
        text: "No projects yet. Create one from the Easy Writing Goal view first.",
      });
      return;
    }

    for (const id of ids) {
      const project = this.service.ensureProjectRecord(id);
      new Setting(contentEl).setName(project.name).setDesc(id).addButton((b) =>
        b.setButtonText("Assign").onClick(async () => {
          await this.service.assignFileToProject(this.file, id);
          new Notice(`Assigned to ${project.name}`);
          this.close();
          this.onAssigned();
        })
      );
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

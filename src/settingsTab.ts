import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type { CountUnit } from "./models";
import type WritingGoalsPlugin from "./main";
import { CreateProjectModal } from "./modals";

export class WritingGoalsSettingTab extends PluginSettingTab {
  private projectsListEl: HTMLElement | null = null;
  private projectsCountEl: HTMLElement | null = null;
  private projectFilter = "";

  constructor(
    app: App,
    private plugin: WritingGoalsPlugin
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("writing-goals-settings");

    new Setting(containerEl).setName("Easy Writing Goal").setHeading();
    new Setting(containerEl).setName("General").setHeading();

    new Setting(containerEl)
      .setName("Project property")
      .setDesc(
        "Frontmatter key that groups notes into a writing project (avoid generic names like “project”)."
      )
      .addText((t) =>
        t
          .setValue(this.plugin.settings.projectProperty)
          .onChange(async (v) => {
            const trimmed = v.trim() || "writing-project";
            this.plugin.settings.projectProperty = trimmed;
            await this.plugin.saveSettings();
            await this.plugin.service.rebuildIndex();
            this.plugin.refreshAll();
            this.refreshProjectsList();
          })
      );

    new Setting(containerEl)
      .setName("Default count unit")
      .setDesc("Used unless a project overrides it.")
      .addDropdown((d) => {
        d.addOption("chars", "Characters (with spaces)");
        d.addOption("chars-no-space", "Characters (no spaces)");
        d.addOption("words", "Words");
        d.setValue(this.plugin.settings.defaultUnit);
        d.onChange(async (v) => {
          this.plugin.settings.defaultUnit = v as CountUnit;
          await this.plugin.saveSettings();
          this.plugin.refreshAll();
        });
      });

    new Setting(containerEl)
      .setName("Exclude frontmatter from counts")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.excludeFrontmatter).onChange(async (v) => {
          this.plugin.settings.excludeFrontmatter = v;
          await this.plugin.saveSettings();
          this.plugin.refreshAll();
        })
      );

    new Setting(containerEl)
      .setName("Exclude fenced code blocks")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.excludeCodeBlocks).onChange(async (v) => {
          this.plugin.settings.excludeCodeBlocks = v;
          await this.plugin.saveSettings();
          this.plugin.refreshAll();
        })
      );

    new Setting(containerEl).setName("Status bar").setHeading();

    new Setting(containerEl)
      .setName("Show project progress")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.statusBarShowProject).onChange(async (v) => {
          this.plugin.settings.statusBarShowProject = v;
          await this.plugin.saveSettings();
          this.plugin.refreshAll();
        })
      );

    new Setting(containerEl)
      .setName("Show today’s session progress")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.statusBarShowSession).onChange(async (v) => {
          this.plugin.settings.statusBarShowSession = v;
          await this.plugin.saveSettings();
          this.plugin.refreshAll();
        })
      );

    this.renderProjectsSection(containerEl);

    new Setting(containerEl).setName("How to use").setHeading();
    containerEl.createEl("ol", undefined, (ol) => {
      ol.createEl("li", {
        text: "Create a project below, then add writing-project: <id> to notes.",
      });
      ol.createEl("li", {
        text: "Open a note in the project — the sidebar shows that project’s progress.",
      });
      ol.createEl("li", {
        text: "Use Targets to set goal, deadline, and writing days.",
      });
    });
  }

  private renderProjectsSection(containerEl: HTMLElement): void {
    const section = containerEl.createDiv({
      cls: "writing-goals-settings-projects",
    });
    new Setting(section).setName("Projects").setHeading();

    const toolbar = section.createDiv({ cls: "writing-goals-settings-toolbar" });
    const search = toolbar.createEl("input", {
      type: "search",
      cls: "writing-goals-settings-search",
      placeholder: "Search…",
    });
    search.value = this.projectFilter;
    search.addEventListener("input", () => {
      this.projectFilter = search.value.trim().toLowerCase();
      this.refreshProjectsList();
    });

    const newBtn = toolbar.createEl("button", {
      text: "New project",
      cls: "mod-cta writing-goals-settings-new-btn",
      type: "button",
    });
    newBtn.addEventListener("click", () => {
      new CreateProjectModal(this.app, this.plugin.service, (id) => {
        this.plugin.openTargets(id);
        this.refreshProjectsList();
        this.plugin.refreshAll();
      }).open();
    });

    const scroll = section.createDiv({
      cls: "writing-goals-settings-project-scroll",
    });
    this.projectsListEl = scroll.createDiv({
      cls: "writing-goals-settings-project-list",
    });
    this.projectsCountEl = section.createDiv({
      cls: "writing-goals-settings-project-count",
    });

    this.refreshProjectsList();
  }

  private refreshProjectsList(): void {
    if (!this.projectsListEl || !this.projectsCountEl) return;

    const list = this.projectsListEl;
    const countEl = this.projectsCountEl;
    list.empty();

    const allIds = this.plugin.service.listKnownProjectIds();
    const filtered = allIds.filter((id) => {
      if (!this.projectFilter) return true;
      const project = this.plugin.service.ensureProjectRecord(id);
      const hay = `${project.name} ${id}`.toLowerCase();
      return hay.includes(this.projectFilter);
    });

    if (filtered.length === 0) {
      list.createEl("p", {
        cls: "writing-goals-settings-empty",
        text:
          allIds.length === 0
            ? "No projects yet."
            : "No projects match your search.",
      });
      countEl.setText(
        allIds.length === 0 ? "" : `${allIds.length} project(s) total`
      );
      return;
    }

    for (const id of filtered) {
      const project = this.plugin.service.ensureProjectRecord(id);
      const noteCount = this.plugin.service.getPathsForProject(id).length;

      const row = list.createDiv({ cls: "writing-goals-settings-project-row" });

      const label = row.createDiv({ cls: "writing-goals-settings-project-label" });
      label.createSpan({
        cls: "writing-goals-settings-project-name",
        text: project.name,
      });
      label.createSpan({
        cls: "writing-goals-settings-project-meta",
        text: [
          id,
          `${noteCount}n`,
          project.deadline || null,
          project.target > 0 ? `${project.target.toLocaleString()}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
      });

      const actions = row.createDiv({
        cls: "writing-goals-settings-project-actions",
      });

      const targetsBtn = actions.createEl("button", {
        text: "Targets",
        cls: "writing-goals-settings-btn",
        type: "button",
      });
      targetsBtn.addEventListener("click", () => {
        this.plugin.openTargets(id, () => this.refreshProjectsList());
      });

      const deleteBtn = actions.createEl("button", {
        text: "Del",
        cls: "writing-goals-settings-btn is-warning",
        type: "button",
        attr: { title: "Delete project" },
      });
      deleteBtn.addEventListener("click", async () => {
        const msg =
          `Delete project “${project.name}”?\n\n` +
          "This removes goals, snapshots, and history.\n" +
          "Notes keep their frontmatter unless you choose to clear it.";
        if (!confirm(msg)) return;

        const clearFm = confirm(
          "Also remove writing-project from all notes in this project?"
        );
        await this.plugin.service.deleteProject(id, clearFm);
        new Notice(`Deleted project “${project.name}”`);
        this.refreshProjectsList();
        this.plugin.refreshAll();
      });
    }

    countEl.setText(
      filtered.length === allIds.length
        ? `${allIds.length} project(s)`
        : `${filtered.length} of ${allIds.length} project(s)`
    );
  }
}

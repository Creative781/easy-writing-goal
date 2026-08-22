import { App, Modal, Setting } from "obsidian";
import { formatCount } from "./counter";
import { parseDateKey, toDateKey } from "./progress";
import type WritingGoalsPlugin from "./main";

export class HistoryModal extends Modal {
  private monthOffset = 0;

  constructor(
    app: App,
    private plugin: WritingGoalsPlugin,
    private projectId: string
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle("Writing history");
    this.draw();
  }

  private draw(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("writing-goals-history");

    const project = this.plugin.settings.projects[this.projectId];
    const name = project?.name ?? this.projectId;
    contentEl.createEl("h2", { text: name });

    const hist = this.plugin.settings.history[this.projectId] ?? {};

    const nav = new Setting(contentEl).setName("Calendar");
    nav.addButton((b) =>
      b.setButtonText("←").onClick(() => {
        this.monthOffset -= 1;
        this.draw();
      })
    );
    nav.addButton((b) =>
      b.setButtonText("Today").onClick(() => {
        this.monthOffset = 0;
        this.draw();
      })
    );
    nav.addButton((b) =>
      b.setButtonText("→").onClick(() => {
        this.monthOffset += 1;
        this.draw();
      })
    );

    const base = new Date();
    base.setDate(1);
    base.setMonth(base.getMonth() + this.monthOffset);
    const year = base.getFullYear();
    const month = base.getMonth();

    contentEl.createEl("h3", {
      text: `${year}-${String(month + 1).padStart(2, "0")}`,
    });

    // Daily deltas from cumulative totals
    const keys = Object.keys(hist).sort();
    const deltas = new Map<string, number>();
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const prev = i > 0 ? hist[keys[i - 1]] : hist[key];
      // First day: show 0 delta vs itself unless we only have one point — use start as baseline
      if (i === 0) {
        deltas.set(key, 0);
      } else {
        deltas.set(key, hist[key] - prev);
      }
    }

    // Better first-day: if snapshot start exists for that day, use total - start
    // For calendar heatmap use max positive delta in month for scale
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthDeltas: number[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const key = toDateKey(new Date(year, month, day));
      const d = deltas.get(key);
      if (d !== undefined) monthDeltas.push(Math.max(0, d));
    }
    const maxDelta = Math.max(1, ...monthDeltas, 1);

    const cal = contentEl.createDiv({ cls: "writing-goals-calendar" });
    const header = cal.createDiv({ cls: "writing-goals-cal-header" });
    for (const label of ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]) {
      header.createDiv({ text: label, cls: "writing-goals-cal-dow" });
    }

    const grid = cal.createDiv({ cls: "writing-goals-cal-grid" });
    const firstDow = new Date(year, month, 1).getDay();
    for (let i = 0; i < firstDow; i++) {
      grid.createDiv({ cls: "writing-goals-cal-cell is-empty" });
    }

    const todayKey = toDateKey(new Date());
    for (let day = 1; day <= daysInMonth; day++) {
      const key = toDateKey(new Date(year, month, day));
      const cell = grid.createDiv({ cls: "writing-goals-cal-cell" });
      cell.createDiv({ text: String(day), cls: "writing-goals-cal-daynum" });

      const total = hist[key];
      const delta = deltas.get(key);
      if (total !== undefined) {
        const written = Math.max(0, delta ?? 0);
        const intensity = Math.min(1, written / maxDelta);
        cell.style.setProperty("--wg-intensity", String(intensity));
        cell.addClass("has-data");
        if (written > 0) cell.addClass("has-writing");
        cell.setAttr(
          "aria-label",
          `${key}: +${formatCount(written)} (total ${formatCount(total)})`
        );
        cell.createDiv({
          cls: "writing-goals-cal-delta",
          text: written > 0 ? `+${formatCount(written)}` : "·",
        });
      } else {
        cell.createDiv({ cls: "writing-goals-cal-delta", text: "" });
      }
      if (key === todayKey) cell.addClass("is-today");
    }

    // Sparkline / last 14 days list
    contentEl.createEl("h3", { text: "Recent days" });
    const list = contentEl.createEl("ul", { cls: "writing-goals-history-list" });
    const recent = keys.slice(-14).reverse();
    if (recent.length === 0) {
      list.createEl("li", { text: "No history yet. Write and save notes in this project." });
    } else {
      for (const key of recent) {
        const d = Math.max(0, deltas.get(key) ?? 0);
        list.createEl("li", {
          text: `${key}: +${formatCount(d)} → total ${formatCount(hist[key])}`,
        });
      }
    }

    // Chart bars for last 14 days chronological
    const chartKeys = keys.slice(-14);
    if (chartKeys.length > 0) {
      contentEl.createEl("h3", { text: "Last 14 sessions" });
      const chart = contentEl.createDiv({ cls: "writing-goals-chart" });
      const chartMax = Math.max(
        1,
        ...chartKeys.map((k) => Math.max(0, deltas.get(k) ?? 0))
      );
      for (const key of chartKeys) {
        const d = Math.max(0, deltas.get(key) ?? 0);
        const col = chart.createDiv({ cls: "writing-goals-chart-col" });
        const bar = col.createDiv({ cls: "writing-goals-chart-bar" });
        bar.style.height = `${Math.max(4, (d / chartMax) * 80)}px`;
        col.createDiv({
          cls: "writing-goals-chart-label",
          text: key.slice(5),
        });
        col.setAttr("aria-label", `${key}: +${formatCount(d)}`);
      }
    }

    new Setting(contentEl).addButton((b) =>
      b
        .setButtonText("Close")
        .setCta()
        .onClick(() => this.close())
    );

    void parseDateKey;
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

import type { CountUnit } from "./models";

/**
 * Strip YAML frontmatter and optionally fenced code blocks, then count.
 */
export function countText(
  raw: string,
  unit: CountUnit,
  options: { excludeFrontmatter: boolean; excludeCodeBlocks: boolean }
): number {
  let text = raw;

  if (options.excludeFrontmatter) {
    text = text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
  }

  if (options.excludeCodeBlocks) {
    text = text.replace(/```[\s\S]*?```/g, "");
    text = text.replace(/~~~[\s\S]*?~~~/g, "");
  }

  // Collapse wiki-links to display text: [[path|alias]] → alias, [[path]] → path
  text = text.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2");
  text = text.replace(/\[\[([^\]]+)\]\]/g, "$1");
  // Markdown links: [label](url) → label
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  switch (unit) {
    case "words":
      return countWords(text);
    case "chars-no-space":
      return text.replace(/\s+/g, "").length;
    case "chars":
    default:
      return text.replace(/\r\n/g, "\n").length;
  }
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;

  // Latin words + CJK runs as word-like units
  const latin: string[] =
    trimmed.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) ?? [];
  const cjk: string[] =
    trimmed.match(
      /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]+/g
    ) ?? [];
  // For CJK, count characters within runs as approximate "words" for Korean/Chinese drafts
  let cjkUnits = 0;
  for (const run of cjk) cjkUnits += run.length;
  // If mostly CJK, prefer char-as-word; if mixed, sum both (latin tokens + cjk chars)
  const hasLatin = latin.length > 0;
  const hasCjk = cjkUnits > 0;
  if (hasCjk && !hasLatin) return cjkUnits;
  if (hasLatin && !hasCjk) return latin.length;
  return latin.length + cjkUnits;
}

export function formatCount(n: number): string {
  return Math.round(n).toLocaleString();
}

export function unitLabel(unit: CountUnit, short = false): string {
  if (short) {
    switch (unit) {
      case "words":
        return "w";
      case "chars-no-space":
        return "c";
      default:
        return "c";
    }
  }
  switch (unit) {
    case "words":
      return "words";
    case "chars-no-space":
      return "chars (no spaces)";
    default:
      return "characters";
  }
}

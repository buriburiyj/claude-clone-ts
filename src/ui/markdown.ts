import chalk from 'chalk';
import { Marked } from 'marked';
import { markedTerminal } from 'marked-terminal';
import { getColors } from './theme.js';

let cached: { key: string; md: Marked } | null = null;

function instance(width: number): Marked {
  const c = getColors();
  const key = `${width}:${JSON.stringify(c)}`;
  if (cached && cached.key === key) return cached.md;
  const md = new Marked();
  md.use(
    markedTerminal({
      width,
      reflowText: true,
      tab: 2,
      showSectionPrefix: false,
      heading: (t: string) => chalk.bold.hex(c.signature ?? '#cc7832')(t),
      firstHeading: (t: string) => chalk.bold.hex(c.signature ?? '#cc7832')(t),
    }) as any,
  );
  cached = { key, md };
  return md;
}

/** Convert markdown to ANSI-styled text for Ink. Falls back to the raw text. */
export function renderMarkdown(text: string): string {
  if (!text) return text;
  const width = Math.max(40, (process.stdout.columns ?? 80) - 4);
  try {
    const out = instance(width).parse(text, { async: false }) as string;
    return out.replace(/\n{3,}/g, '\n\n').trimEnd().split('\n').map((l) => (l ? '  ' + l : l)).join('\n');
  } catch {
    return text;
  }
}

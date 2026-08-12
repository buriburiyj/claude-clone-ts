const HEAD_LINES = 50;
const TAIL_LINES = 20;
const DEFAULT_MAX_CHARS = 8000;

/**
 * Fold long command output so it does not flood the model context.
 * Keeps the first HEAD_LINES and last TAIL_LINES, with a marker in between.
 */
export function clampOutput(
  text: string,
  maxChars: number = DEFAULT_MAX_CHARS,
): { text: string; truncated: boolean } {
  if (!text) return { text, truncated: false };
  let out = text;
  let truncated = false;

  const lines = out.split('\n');
  if (lines.length > HEAD_LINES + TAIL_LINES + 1) {
    const head = lines.slice(0, HEAD_LINES);
    const tail = lines.slice(-TAIL_LINES);
    const omitted = lines.length - head.length - tail.length;
    out = [...head, `… ${omitted} lines omitted …`, ...tail].join('\n');
    truncated = true;
  }

  if (out.length > maxChars) {
    const keep = Math.floor(maxChars * 0.7);
    out = out.slice(0, keep) + `\n… ${out.length - maxChars} chars omitted …\n` + out.slice(-(maxChars - keep));
    truncated = true;
  }

  return { text: out, truncated };
}

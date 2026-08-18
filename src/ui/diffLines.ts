export type DiffLine = { type: 'add' | 'del' | 'same'; text: string };

/** 가운데 구간만 LCS. 길이 폭발을 막으려 상한을 둔다. */
const MAX_LCS = 400;

function lcsTable(a: string[], b: string[]): number[][] {
  const t: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      t[i]![j] = a[i] === b[j] ? t[i + 1]![j + 1]! + 1 : Math.max(t[i + 1]![j]!, t[i]![j + 1]!);
  return t;
}

function alignMiddle(a: string[], b: string[]): DiffLine[] {
  if (a.length === 0) return b.map((text) => ({ type: 'add' as const, text }));
  if (b.length === 0) return a.map((text) => ({ type: 'del' as const, text }));
  if (a.length > MAX_LCS || b.length > MAX_LCS)
    return [...a.map((text) => ({ type: 'del' as const, text })),
            ...b.map((text) => ({ type: 'add' as const, text }))];

  const t = lcsTable(a, b);
  const out: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { out.push({ type: 'same', text: a[i]! }); i++; j++; }
    else if (t[i + 1]![j]! >= t[i]![j + 1]!) { out.push({ type: 'del', text: a[i]! }); i++; }
    else { out.push({ type: 'add', text: b[j]! }); j++; }
  }
  while (i < a.length) out.push({ type: 'del', text: a[i++]! });
  while (j < b.length) out.push({ type: 'add', text: b[j++]! });
  return out;
}

export function diffLines(oldText: string, newText: string): DiffLine[] {
  const a = oldText.split('\n');
  const b = newText.split('\n');

  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;

  let tail = 0;
  while (tail < a.length - head && tail < b.length - head
         && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;

  return [
    ...a.slice(0, head).map((text) => ({ type: 'same' as const, text })),
    ...alignMiddle(a.slice(head, a.length - tail), b.slice(head, b.length - tail)),
    ...a.slice(a.length - tail).map((text) => ({ type: 'same' as const, text })),
  ];
}

/** 변경 지점 주변 context줄만 남기고 나머지는 접는다. */
export type DiffChunk = DiffLine | { type: 'skip'; count: number };

export function collapse(lines: DiffLine[], context = 3): DiffChunk[] {
  const keep = new Array(lines.length).fill(false);
  lines.forEach((l, i) => {
    if (l.type === 'same') return;
    for (let k = Math.max(0, i - context); k <= Math.min(lines.length - 1, i + context); k++) keep[k] = true;
  });
  const out: DiffChunk[] = [];
  let run = 0;
  for (let i = 0; i < lines.length; i++) {
    if (keep[i]) {
      if (run > 0) { out.push({ type: 'skip', count: run }); run = 0; }
      out.push(lines[i]!);
    } else run++;
  }
  if (run > 0) out.push({ type: 'skip', count: run });
  return out;
}

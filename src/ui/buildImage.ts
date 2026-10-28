// Draws a Character Builder build as one shareable picture (landscape, like a game's character sheet):
// every upgrade on the left, where the account lands and the totals on the right.

export interface ImageCard { name: string; from: string; to: string; changed: boolean; store: string; key: string }
export interface ImageGroup { title: string; cards: ImageCard[] }
export interface ImageResult { label: string; value: string; line: string }
export interface BuildImageData {
  title: string;
  subtitle: string;
  groups: ImageGroup[];
  results: ImageResult[];
  totals: { label: string; value: string }[];
  footer: string;
}

const W = 1600, H = 1040;
const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

function cssVar(name: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export async function drawBuildImage(d: BuildImageData): Promise<Blob> {
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  const accent = cssVar("--accent", "#3ddc97");
  const bg = "#0e1014", surface = "#171a21", surface2 = "#20242d", line = "#2e3440", text = "#e8eaed", muted = "#9aa3b2";

  const box = (x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string) => {
    g.beginPath(); g.roundRect(x, y, w, h, r); g.fillStyle = fill; g.fill();
    if (stroke) { g.lineWidth = 2; g.strokeStyle = stroke; g.stroke(); }
  };
  /** Writes text, shrinking the font until it fits maxW. */
  const write = (s: string, x: number, y: number, size: number, opts: { color?: string; weight?: number; mono?: boolean; align?: CanvasTextAlign; maxW?: number } = {}) => {
    let px = size;
    const set = () => { g.font = `${opts.weight ?? 400} ${px}px ${opts.mono ? MONO : FONT}`; };
    set();
    while (opts.maxW && g.measureText(s).width > opts.maxW && px > 9) { px -= 1; set(); }
    g.fillStyle = opts.color ?? text; g.textAlign = opts.align ?? "left"; g.textBaseline = "alphabetic";
    g.fillText(s, x, y);
  };

  g.fillStyle = bg; g.fillRect(0, 0, W, H);

  // Header
  box(24, 20, W - 48, 76, 14, surface);
  write(d.title, 48, 70, 34, { weight: 800 });
  write(d.subtitle, W - 48, 68, 24, { color: muted, align: "right", mono: true, maxW: 900 });

  // Left: one row per group, label column then cards
  const left = 24, labelW = 120, gap = 10, cols = 5, top = 116, rowH = 164;
  const cardW = (1060 - left - labelW - gap * cols) / cols;
  d.groups.forEach((grp, i) => {
    const y = top + i * (rowH + gap);
    box(left, y, labelW, rowH, 12, surface);
    const words = grp.title.split(/\s+/);
    words.forEach((w, j) => write(w.toUpperCase(), left + labelW / 2, y + rowH / 2 - (words.length - 1) * 12 + j * 24 + 6, 16, { weight: 800, color: muted, align: "center", maxW: labelW - 12 }));
    grp.cards.forEach((card, j) => {
      const x = left + labelW + gap + j * (cardW + gap);
      box(x, y, cardW, rowH, 12, card.changed ? surface : "#13161b", card.changed ? accent : line);
      write(card.name, x + cardW / 2, y + 30, 19, { weight: 700, align: "center", maxW: cardW - 16, color: card.changed ? text : muted });
      if (card.changed) {
        write(`${card.from} → ${card.to}`, x + cardW / 2, y + 78, 30, { weight: 800, mono: true, align: "center", maxW: cardW - 14, color: accent });
        write("STORE", x + 12, y + 112, 12, { weight: 700, color: muted });
        write(card.store, x + cardW - 12, y + 112, 16, { mono: true, align: "right", maxW: cardW - 70 });
        write("KEYGEN", x + 12, y + 142, 12, { weight: 700, color: muted });
        write(card.key, x + cardW - 12, y + 142, 16, { mono: true, align: "right", maxW: cardW - 80, color: card.key === "store only" ? muted : text });
      } else {
        write(card.from, x + cardW / 2, y + 96, 34, { weight: 800, mono: true, align: "center", maxW: cardW - 14, color: muted });
      }
    });
  });

  // Right: results and totals
  const rx = 1080, rw = W - 24 - rx;
  let y = top;
  write("WHERE THE ACCOUNT LANDS", rx + 4, y + 18, 15, { weight: 800, color: muted });
  y += 32;
  for (const res of d.results) {
    box(rx, y, rw, 104, 12, surface);
    write(res.label, rx + 18, y + 36, 20, { weight: 700, maxW: rw - 200 });
    write(res.value, rx + rw - 18, y + 40, 32, { weight: 800, mono: true, align: "right", color: accent });
    write(res.line, rx + 18, y + 80, 16, { mono: true, color: muted, maxW: rw - 36 });
    y += 116;
  }
  y += 8;
  write("TOTALS", rx + 4, y + 18, 15, { weight: 800, color: muted });
  y += 32;
  const tw = (rw - 10) / 2;
  d.totals.forEach((t, i) => {
    const x = rx + (i % 2) * (tw + 10), ty = y + Math.floor(i / 2) * 96;
    box(x, ty, tw, 86, 12, surface2);
    write(t.label.toUpperCase(), x + 14, ty + 30, 13, { weight: 700, color: muted, maxW: tw - 28 });
    write(t.value, x + 14, ty + 68, 28, { weight: 800, mono: true, maxW: tw - 28 });
  });

  write(d.footer, W - 30, H - 22, 15, { color: muted, align: "right" });

  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't make the image"))), "image/png"));
}

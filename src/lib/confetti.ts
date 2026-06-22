// confetti — tiny dependency-free 撒花 celebration, ported from the design
// reference (reference/confetti.js). Two entry points:
//   pobiBurst(host, opts)     — small burst anchored near a point (per-action feedback)
//   pobiCelebrate(host, opts) — fuller burst from the top (inbox-zero milestone)
// The canvas is appended to `host` (position:absolute, pointer-events:none) and
// removes itself when settled. Respects prefers-reduced-motion.

// cinnabar / ink / gold / jade / paper-blue / line — drawn from the design tokens
const COLORS = ["#B23A2B", "#2A2722", "#C9962F", "#4E9472", "#6F86C9", "#E7E2D7"];

type RunOpts = {
  count: number;
  originX: number; // 0–1 of host width
  originY: number; // 0–1 of host height
  spread: number;
  power: number;
  gravity: number;
  fade: number; // max frames
};

function run(host: HTMLElement | null, o: RunOpts) {
  if (!host || typeof window === "undefined") return;
  const cs = getComputedStyle(host);
  if (cs.position === "static") host.style.position = "relative";
  const rect = host.getBoundingClientRect();
  const W = rect.width;
  const H = rect.height;
  if (!W || !H) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const cv = document.createElement("canvas");
  cv.width = W * dpr;
  cv.height = H * dpr;
  Object.assign(cv.style, {
    position: "absolute",
    inset: "0",
    width: W + "px",
    height: H + "px",
    pointerEvents: "none",
    zIndex: "50",
  } as Partial<CSSStyleDeclaration>);
  host.appendChild(cv);
  const ctx = cv.getContext("2d");
  if (!ctx) {
    cv.remove();
    return;
  }
  ctx.scale(dpr, dpr);

  const ox = o.originX * W;
  const oy = o.originY * H;
  const parts = Array.from({ length: o.count }, () => {
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * o.spread;
    const v = o.power * (0.55 + Math.random() * 0.7);
    return {
      x: ox + (Math.random() - 0.5) * 24,
      y: oy + (Math.random() - 0.5) * 12,
      vx: Math.cos(ang) * v + (Math.random() - 0.5) * 1.5,
      vy: Math.sin(ang) * v,
      w: 5 + Math.random() * 6,
      h: 7 + Math.random() * 7,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.35,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      flip: Math.random() * Math.PI,
      vf: 0.12 + Math.random() * 0.12,
      life: 0,
    };
  });

  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) {
    setTimeout(() => cv.remove(), 10);
    return;
  }

  let frames = 0;
  const maxFrames = o.fade;
  const tick = () => {
    frames++;
    ctx.clearRect(0, 0, W, H);
    let alive = 0;
    const globalFade = Math.max(0, 1 - Math.max(0, frames - maxFrames * 0.55) / (maxFrames * 0.45));
    for (const p of parts) {
      p.life++;
      p.vy += o.gravity;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.flip += p.vf;
      if (p.y < H + 24) alive++;
      const sx = Math.abs(Math.cos(p.flip));
      ctx.save();
      ctx.globalAlpha = globalFade;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(sx, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (frames < maxFrames && (alive > 0 || frames < 40)) requestAnimationFrame(tick);
    else cv.remove();
  };
  requestAnimationFrame(tick);
}

// Small anchored burst — for a single completed/removed item.
export function pobiBurst(
  host: HTMLElement | null,
  opts: { count?: number; originX?: number; originY?: number; spread?: number; power?: number } = {}
) {
  run(host, {
    count: opts.count ?? 36,
    originX: opts.originX ?? 0.5,
    originY: opts.originY ?? 0.6,
    spread: opts.spread ?? 1.5,
    power: opts.power ?? 11,
    gravity: 0.34,
    fade: 80,
  });
}

// Fuller celebration — for clearing the inbox (milestone).
export function pobiCelebrate(host: HTMLElement | null, opts: { count?: number } = {}) {
  run(host, {
    count: opts.count ?? 130,
    originX: 0.5,
    originY: 0.32,
    spread: 2.4,
    power: 15,
    gravity: 0.3,
    fade: 150,
  });
}

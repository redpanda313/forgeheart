/**
 * Lightweight runtime profiler for mega-city scale work.
 * Toggle with F3 or pause-menu checkbox.
 */

export type PerfSnapshot = {
  fps: number;
  frameMs: number;
  draws: number;
  tris: number;
  colliders: number;
  colliderQueries: number;
  streamLoaded: number;
  streamTotal: number;
  npcsActive: number;
  npcsTotal: number;
  aoiFull: number;
};

export class PerfStats {
  enabled = false;
  colliderQueries = 0;
  streamLoaded = 0;
  streamTotal = 0;
  npcsActive = 0;
  npcsTotal = 0;
  colliderCount = 0;
  aoiFull = 0;

  private frames = 0;
  private acc = 0;
  private fps = 0;
  private frameMs = 0;
  private draws = 0;
  private tris = 0;
  private el: HTMLElement | null = null;

  ensureDom() {
    if (this.el || typeof document === 'undefined') return;
    const el = document.createElement('div');
    el.id = 'perf-hud';
    el.className = 'perf-hud hidden';
    el.setAttribute('aria-hidden', 'true');
    document.getElementById('app')?.appendChild(el);
    this.el = el;
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    this.ensureDom();
    if (!this.el) return;
    if (on) {
      this.el.classList.remove('hidden');
      this.el.setAttribute('aria-hidden', 'false');
    } else {
      this.el.classList.add('hidden');
      this.el.setAttribute('aria-hidden', 'true');
    }
  }

  toggle() {
    this.setEnabled(!this.enabled);
  }

  beginFrame() {
    this.colliderQueries = 0;
  }

  endFrame(dt: number, renderer: { info: { render: { calls: number; triangles: number } } }) {
    this.frameMs = dt * 1000;
    this.frames++;
    this.acc += dt;
    if (this.acc >= 0.5) {
      this.fps = this.frames / this.acc;
      this.frames = 0;
      this.acc = 0;
    }
    this.draws = renderer.info.render.calls;
    this.tris = renderer.info.render.triangles;
    if (this.enabled) this.paint();
  }

  snapshot(): PerfSnapshot {
    return {
      fps: this.fps,
      frameMs: this.frameMs,
      draws: this.draws,
      tris: this.tris,
      colliders: this.colliderCount,
      colliderQueries: this.colliderQueries,
      streamLoaded: this.streamLoaded,
      streamTotal: this.streamTotal,
      npcsActive: this.npcsActive,
      npcsTotal: this.npcsTotal,
      aoiFull: this.aoiFull,
    };
  }

  private paint() {
    if (!this.el) return;
    const s = this.snapshot();
    this.el.textContent =
      `${s.fps.toFixed(0)} fps · ${s.frameMs.toFixed(1)} ms\n` +
      `draw ${s.draws} · tri ${(s.tris / 1000).toFixed(1)}k\n` +
      `col ${s.colliders} · q ${s.colliderQueries}\n` +
      `stream ${s.streamLoaded}/${s.streamTotal}\n` +
      `npc ${s.npcsActive}/${s.npcsTotal} · aoi ${s.aoiFull}`;
  }
}

export const perfStats = new PerfStats();

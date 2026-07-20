/**
 * ForgeHeart — on-screen touch controls for mobile browsers.
 * Shown only when a mobile / coarse-pointer browser is detected.
 */

export function isMobileBrowser(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const mobileUa =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);
  // iPadOS 13+ can report as MacIntel with touch
  const iPadOs = navigator.platform === 'MacIntel' && (navigator.maxTouchPoints ?? 0) > 1;
  const coarse =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches;
  const touch = (navigator.maxTouchPoints ?? 0) > 0 || 'ontouchstart' in window;
  return mobileUa || iPadOs || (coarse && touch);
}

export type MobileInputHost = {
  /** Apply look delta in CSS pixels (positive dx = look right, dy = look down). */
  applyTouchLook(dx: number, dy: number): void;
  setFireHeld(v: boolean): void;
  setPaused(p: boolean): void;
  isPaused(): boolean;
  /** Inject a key code as if pressed on a keyboard (edge + hold). */
  injectKey(code: string, down: boolean): void;
  isDisposed(): boolean;
};

type StickAxes = { x: number; y: number };

const MOVE_CODES = ['KeyW', 'KeyA', 'KeyS', 'KeyD'] as const;

/**
 * Virtual joystick + action buttons for mobile play.
 * Expects `#mobile-controls` markup in index.html.
 */
export class MobileControls {
  private root: HTMLElement | null;
  private stick: HTMLElement | null;
  private stickKnob: HTMLElement | null;
  private lookPad: HTMLElement | null;
  private host: MobileInputHost | null = null;
  private abort: AbortController | null = null;
  private active = false;
  private visible = false;

  private stickPointerId: number | null = null;
  private stickOrigin = { x: 0, y: 0 };
  private stickAxes: StickAxes = { x: 0, y: 0 };
  private moveHeld = new Set<string>();

  private lookPointerId: number | null = null;
  private lookLast = { x: 0, y: 0 };

  private fireHeld = false;
  readonly enabled: boolean;

  constructor() {
    this.enabled = isMobileBrowser();
    this.root = document.getElementById('mobile-controls');
    this.stick = document.getElementById('mobile-stick');
    this.stickKnob = document.getElementById('mobile-stick-knob');
    this.lookPad = document.getElementById('mobile-look');
    if (!this.enabled) {
      this.root?.classList.add('hidden');
      this.root?.setAttribute('aria-hidden', 'true');
      return;
    }
  }

  attach(host: MobileInputHost) {
    if (!this.enabled || !this.root) return;
    this.detach();
    this.host = host;
    document.documentElement.classList.add('forgeheart-mobile');
    document.body.classList.add('forgeheart-mobile');
    this.abort = new AbortController();
    const sig = this.abort.signal;
    this.bindStick(sig);
    this.bindLook(sig);
    this.bindButtons(sig);
    this.setVisible(true);
  }

  detach() {
    this.releaseAll();
    try {
      this.abort?.abort();
    } catch {
      /* ignore */
    }
    this.abort = null;
    this.host = null;
    this.setVisible(false);
    document.documentElement.classList.remove('forgeheart-mobile');
    document.body.classList.remove('forgeheart-mobile');
  }

  setVisible(v: boolean) {
    this.visible = v && this.enabled;
    if (!this.root) return;
    if (this.visible) {
      this.root.classList.remove('hidden');
      this.root.setAttribute('aria-hidden', 'false');
    } else {
      this.root.classList.add('hidden');
      this.root.setAttribute('aria-hidden', 'true');
      this.releaseAll();
    }
  }

  /** Hide joysticks while pause / modal UI owns the screen; keep root for resume if needed. */
  setGameplayActive(active: boolean) {
    const was = this.active;
    this.active = active;
    if (!this.root) return;
    this.root.classList.toggle('mobile-controls-dimmed', !active);
    // Only release sticks/keys when transitioning to inactive (avoid per-frame clears)
    if (!active && was) this.releaseAll();
  }

  private releaseAll() {
    this.clearMoveKeys();
    this.resetStickVisual();
    this.stickPointerId = null;
    this.lookPointerId = null;
    if (this.fireHeld) {
      this.fireHeld = false;
      this.host?.setFireHeld(false);
    }
  }

  private bindStick(sig: AbortSignal) {
    const el = this.stick;
    if (!el) return;

    const onDown = (ev: PointerEvent) => {
      if (!this.host || this.host.isDisposed() || !this.visible) return;
      if (this.stickPointerId != null) return;
      if (ev.button !== 0 && ev.pointerType === 'mouse') return;
      ev.preventDefault();
      ev.stopPropagation();
      this.stickPointerId = ev.pointerId;
      const rect = el.getBoundingClientRect();
      this.stickOrigin.x = rect.left + rect.width / 2;
      this.stickOrigin.y = rect.top + rect.height / 2;
      el.setPointerCapture(ev.pointerId);
      this.updateStick(ev.clientX, ev.clientY, rect.width / 2);
    };

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== this.stickPointerId) return;
      ev.preventDefault();
      const rect = el.getBoundingClientRect();
      this.updateStick(ev.clientX, ev.clientY, rect.width / 2);
    };

    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== this.stickPointerId) return;
      ev.preventDefault();
      this.stickPointerId = null;
      this.stickAxes = { x: 0, y: 0 };
      this.clearMoveKeys();
      this.resetStickVisual();
      try {
        el.releasePointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }
    };

    el.addEventListener('pointerdown', onDown, { signal: sig });
    el.addEventListener('pointermove', onMove, { signal: sig });
    el.addEventListener('pointerup', onUp, { signal: sig });
    el.addEventListener('pointercancel', onUp, { signal: sig });
    el.addEventListener('lostpointercapture', onUp, { signal: sig });
  }

  private updateStick(clientX: number, clientY: number, radius: number) {
    const maxR = Math.max(24, radius * 0.72);
    let dx = clientX - this.stickOrigin.x;
    let dy = clientY - this.stickOrigin.y;
    const len = Math.hypot(dx, dy);
    if (len > maxR && len > 1e-6) {
      dx = (dx / len) * maxR;
      dy = (dy / len) * maxR;
    }
    if (this.stickKnob) {
      this.stickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    }
    const dead = 0.22;
    const nx = dx / maxR;
    const ny = dy / maxR;
    this.stickAxes = {
      x: Math.abs(nx) < dead ? 0 : nx,
      y: Math.abs(ny) < dead ? 0 : ny,
    };
    this.syncMoveKeys();
  }

  private resetStickVisual() {
    if (this.stickKnob) this.stickKnob.style.transform = 'translate(0px, 0px)';
  }

  private syncMoveKeys() {
    const next = new Set<string>();
    const { x, y } = this.stickAxes;
    // Screen Y down → forward is negative y
    if (y < -0.2) next.add('KeyW');
    if (y > 0.2) next.add('KeyS');
    if (x < -0.2) next.add('KeyA');
    if (x > 0.2) next.add('KeyD');

    for (const code of MOVE_CODES) {
      const want = next.has(code);
      const had = this.moveHeld.has(code);
      if (want && !had) {
        this.moveHeld.add(code);
        this.host?.injectKey(code, true);
      } else if (!want && had) {
        this.moveHeld.delete(code);
        this.host?.injectKey(code, false);
      }
    }
  }

  private clearMoveKeys() {
    for (const code of [...this.moveHeld]) {
      this.host?.injectKey(code, false);
    }
    this.moveHeld.clear();
  }

  private bindLook(sig: AbortSignal) {
    const el = this.lookPad;
    if (!el) return;

    const onDown = (ev: PointerEvent) => {
      if (!this.host || this.host.isDisposed() || !this.visible || !this.active) return;
      if (this.lookPointerId != null) return;
      if (ev.button !== 0 && ev.pointerType === 'mouse') return;
      // Ignore if target is a button inside look pad (shouldn't happen)
      const t = ev.target as HTMLElement | null;
      if (t?.closest?.('.mobile-btn')) return;
      ev.preventDefault();
      ev.stopPropagation();
      this.lookPointerId = ev.pointerId;
      this.lookLast.x = ev.clientX;
      this.lookLast.y = ev.clientY;
      el.setPointerCapture(ev.pointerId);
    };

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== this.lookPointerId || !this.host) return;
      ev.preventDefault();
      const dx = ev.clientX - this.lookLast.x;
      const dy = ev.clientY - this.lookLast.y;
      this.lookLast.x = ev.clientX;
      this.lookLast.y = ev.clientY;
      if (dx !== 0 || dy !== 0) this.host.applyTouchLook(dx, dy);
    };

    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== this.lookPointerId) return;
      this.lookPointerId = null;
      try {
        el.releasePointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }
    };

    el.addEventListener('pointerdown', onDown, { signal: sig });
    el.addEventListener('pointermove', onMove, { signal: sig });
    el.addEventListener('pointerup', onUp, { signal: sig });
    el.addEventListener('pointercancel', onUp, { signal: sig });
  }

  private bindButtons(sig: AbortSignal) {
    if (!this.root) return;
    const buttons = this.root.querySelectorAll<HTMLElement>('[data-mobile-action]');
    for (const btn of buttons) {
      const action = btn.dataset.mobileAction;
      if (!action) continue;

      const press = (ev: PointerEvent) => {
        if (!this.host || this.host.isDisposed() || !this.visible) return;
        if (ev.button !== 0 && ev.pointerType === 'mouse') return;
        ev.preventDefault();
        ev.stopPropagation();
        btn.classList.add('active');
        try {
          btn.setPointerCapture(ev.pointerId);
        } catch {
          /* ignore */
        }
        this.onAction(action, true);
      };

      const release = (ev: PointerEvent) => {
        btn.classList.remove('active');
        try {
          btn.releasePointerCapture(ev.pointerId);
        } catch {
          /* ignore */
        }
        this.onAction(action, false);
      };

      btn.addEventListener('pointerdown', press, { signal: sig });
      btn.addEventListener('pointerup', release, { signal: sig });
      btn.addEventListener('pointercancel', release, { signal: sig });
      btn.addEventListener('lostpointercapture', () => {
        btn.classList.remove('active');
        this.onAction(action, false);
      }, { signal: sig });
    }
  }

  private onAction(action: string, down: boolean) {
    const host = this.host;
    if (!host) return;

    switch (action) {
      case 'jump':
        host.injectKey('Space', down);
        break;
      case 'interact':
        // Edge tap — inject press+release on down so E fires once
        if (down) {
          host.injectKey('KeyE', true);
          host.injectKey('KeyE', false);
        }
        break;
      case 'attack':
        this.fireHeld = down;
        host.setFireHeld(down);
        break;
      case 'slide':
        host.injectKey('ShiftLeft', down);
        break;
      case 'pause':
        if (down) host.setPaused(!host.isPaused());
        break;
      case 'board':
        if (down) {
          host.injectKey('KeyQ', true);
          host.injectKey('KeyQ', false);
        }
        break;
      case 'bay':
        if (down) {
          host.injectKey('KeyI', true);
          host.injectKey('KeyI', false);
        }
        break;
      case 'map':
        if (down) {
          host.injectKey('KeyM', true);
          host.injectKey('KeyM', false);
        }
        break;
      case 'hand':
        if (down) {
          host.injectKey('Digit1', true);
          host.injectKey('Digit1', false);
        }
        break;
      case 'wrench':
        if (down) {
          host.injectKey('Digit2', true);
          host.injectKey('Digit2', false);
        }
        break;
      case 'weapon-board':
        if (down) {
          host.injectKey('Digit3', true);
          host.injectKey('Digit3', false);
        }
        break;
      case 'camera':
        if (down) {
          host.injectKey('Tab', true);
          host.injectKey('Tab', false);
        }
        break;
      default:
        break;
    }
  }
}

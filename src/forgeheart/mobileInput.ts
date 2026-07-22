/**
 * ForgeHeart — on-screen touch controls for mobile / touch browsers.
 *
 * Shown when:
 * - iPhone / iPad / Android / coarse-pointer / narrow touch screen, or
 * - URL has ?mobile=1 / ?touch=1, or
 * - localStorage forgeheart-force-mobile=1, or
 * - the player touches the screen during play (auto-enable)
 */

const FORCE_KEY = 'forgeheart-force-mobile';

export function isMobileBrowser(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

  // Explicit opt-in (debug / stubborn devices)
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.get('mobile') === '1' || q.get('touch') === '1') return true;
    if (localStorage.getItem(FORCE_KEY) === '1') return true;
  } catch {
    /* ignore */
  }

  const nav = navigator as Navigator & {
    userAgentData?: { mobile?: boolean };
    standalone?: boolean;
  };
  const ua = nav.userAgent || '';
  const platform = nav.platform || '';
  const touchPoints = nav.maxTouchPoints ?? 0;
  const hasTouch = touchPoints > 0 || 'ontouchstart' in window;

  // Client Hints / PWA
  if (nav.userAgentData?.mobile === true) return true;
  if (nav.standalone === true) return true;

  // Classic mobile UA (incl. iOS browsers that put CriOS/FxiOS in the string)
  if (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|SamsungBrowser|CriOS|FxiOS|EdgiOS/i.test(
      ua,
    )
  ) {
    return true;
  }

  // iPadOS 13+ desktop-class UA still has multi-touch
  if (platform === 'MacIntel' && touchPoints > 1) return true;

  // iOS Safari desktop-mode / WebKit tells
  const webkitTouch =
    typeof CSS !== 'undefined' &&
    typeof CSS.supports === 'function' &&
    CSS.supports('-webkit-touch-callout', 'none') &&
    hasTouch &&
    touchPoints > 0;
  if (webkitTouch && /Macintosh|iPhone|iPad|iPod/i.test(ua + platform)) return true;

  const mq = (q: string) =>
    typeof window.matchMedia === 'function' && window.matchMedia(q).matches;

  const coarse = mq('(pointer: coarse)') || mq('(any-pointer: coarse)');
  const noHover = mq('(hover: none)') || mq('(any-hover: none)');
  // Phones in landscape still need controls
  const narrowTouch =
    hasTouch && Math.min(window.innerWidth || 0, window.innerHeight || 0) <= 920;

  // Orientation API is common on phones
  const orientable = typeof window.orientation === 'number' && hasTouch;

  return (coarse && hasTouch) || (noHover && hasTouch) || narrowTouch || orientable;
}

export type MobileInputHost = {
  /** Apply look delta in CSS pixels (positive dx = look right, dy = look down). */
  applyTouchLook(dx: number, dy: number): void;
  /**
   * Two-finger twist / rotate-button delta in radians. Positive = CCW.
   * Used to rotate the site / aimed prop while the site builder is open.
   */
  applyTouchRotate(deltaRad: number): void;
  /** True while site builder can accept rotate gestures / buttons. */
  isSiteRotateEnabled(): boolean;
  setFireHeld(v: boolean): void;
  setPaused(p: boolean): void;
  isPaused(): boolean;
  /** Inject a key code as if pressed on a keyboard (edge + hold). */
  injectKey(code: string, down: boolean): void;
  isDisposed(): boolean;
  /** Cycle Hand → Wrench (if unlocked) → Board (if owned). */
  cycleWeapon(): void;
  /** Proximity interact (same as E). */
  tryInteract(): void;
  /** Open / close empire map when available. */
  toggleMap(): void;
  /** True while surfing the market / city board. */
  isBoardMounted(): boolean;
  /** Called when touch controls newly activate mid-session. */
  onMobileControlsEnabled?(): void;
};

type StickAxes = { x: number; y: number };

const MOVE_CODES = ['KeyW', 'KeyA', 'KeyS', 'KeyD'] as const;
const WEAPON_HOLD_MS = 420;
const LOOK_TAP_MAX_MOVE = 14;

/**
 * Virtual joystick + action buttons for mobile play.
 * Expects `#mobile-controls` markup in index.html.
 */
export class MobileControls {
  private root: HTMLElement | null;
  private stick: HTMLElement | null;
  private stickKnob: HTMLElement | null;
  private lookPad: HTMLElement | null;
  private tapAffordance: HTMLElement | null;
  private host: MobileInputHost | null = null;
  private abort: AbortController | null = null;
  private touchArmAbort: AbortController | null = null;
  private active = false;
  private visible = false;
  private attached = false;

  private stickPointerId: number | null = null;
  private stickOrigin = { x: 0, y: 0 };
  private stickAxes: StickAxes = { x: 0, y: 0 };
  private moveHeld = new Set<string>();

  private lookPointerId: number | null = null;
  private lookLast = { x: 0, y: 0 };
  private lookStart = { x: 0, y: 0 };
  private lookMoved = false;
  /** Active look-pad pointers for one-finger look / two-finger twist. */
  private lookPointers = new Map<number, { x: number; y: number }>();
  private rotateLastAngle: number | null = null;
  private rotateMode = false;

  private fireHeld = false;
  private attackHoldTimer: number | null = null;
  private _enabled: boolean;

  constructor() {
    this.root = document.getElementById('mobile-controls');
    this.stick = document.getElementById('mobile-stick');
    this.stickKnob = document.getElementById('mobile-stick-knob');
    this.lookPad = document.getElementById('mobile-look');
    this.tapAffordance = document.getElementById('mobile-tap-affordance');
    this._enabled = isMobileBrowser();
    if (!this._enabled) {
      this.root?.classList.add('hidden');
      this.root?.setAttribute('aria-hidden', 'true');
    } else {
      // Eagerly mark the document so CSS (HUD layout) applies before first frame
      document.documentElement.classList.add('forgeheart-mobile');
      document.body.classList.add('forgeheart-mobile');
    }
  }

  get enabled() {
    return this._enabled;
  }

  /** Persist + enable touch UI (also used by ?mobile=1 and first-touch arming). */
  forceEnable(persist = true) {
    this._enabled = true;
    document.documentElement.classList.add('forgeheart-mobile');
    document.body.classList.add('forgeheart-mobile');
    if (persist) {
      try {
        localStorage.setItem(FORCE_KEY, '1');
      } catch {
        /* ignore */
      }
    }
  }

  /**
   * Bind host callbacks. If not yet detected as mobile, arm a one-shot touch
   * listener so the first finger contact enables the on-screen pad.
   */
  attach(host: MobileInputHost) {
    this.host = host;
    this.touchArmAbort?.abort();
    this.touchArmAbort = null;

    // Re-check detection (UA can settle after first paint on some WebViews)
    if (!this._enabled && isMobileBrowser()) {
      this.forceEnable(true);
    }

    if (this._enabled) {
      this.mountUi();
      this.syncBoardButtons();
      return;
    }

    // Desktop browsers: wait for a real touch — then show controls
    this.touchArmAbort = new AbortController();
    const arm = (ev: Event) => {
      if (this.host?.isDisposed()) return;
      if ((navigator.maxTouchPoints ?? 0) === 0 && !('ontouchstart' in window)) return;
      ev.preventDefault?.();
      this.forceEnable(true);
      this.mountUi();
      this.syncBoardButtons();
      this.host?.onMobileControlsEnabled?.();
    };
    window.addEventListener('touchstart', arm, {
      signal: this.touchArmAbort.signal,
      passive: false,
      once: true,
      capture: true,
    });
  }

  private mountUi() {
    if (!this.root || !this.host || this.attached) {
      this.setVisible(true);
      return;
    }
    this.attached = true;
    document.documentElement.classList.add('forgeheart-mobile');
    document.body.classList.add('forgeheart-mobile');
    this.abort = new AbortController();
    const sig = this.abort.signal;
    this.bindStick(sig);
    this.bindLook(sig);
    this.bindTwoFingerTouchRotate(sig);
    this.bindButtons(sig);
    this.bindTapAffordance(sig);
    this.setVisible(true);
    this.setGameplayActive(true);
    this.syncBoardButtons();
    this.syncSiteRotateButtons();
  }

  detach() {
    this.releaseAll();
    this.clearAttackHold();
    try {
      this.abort?.abort();
    } catch {
      /* ignore */
    }
    try {
      this.touchArmAbort?.abort();
    } catch {
      /* ignore */
    }
    this.abort = null;
    this.touchArmAbort = null;
    this.host = null;
    this.attached = false;
    this.setVisible(false);
    this.hideTapAffordance();
    document.documentElement.classList.remove('forgeheart-mobile');
    document.body.classList.remove('forgeheart-mobile');
  }

  setVisible(v: boolean) {
    this.visible = v && this._enabled;
    if (!this.root) return;
    if (this.visible) {
      this.root.classList.remove('hidden');
      this.root.setAttribute('aria-hidden', 'false');
    } else {
      this.root.classList.add('hidden');
      this.root.setAttribute('aria-hidden', 'true');
      this.releaseAll();
      this.hideTapAffordance();
    }
  }

  /** Hide joysticks while pause / modal UI owns the screen; keep pause util. */
  setGameplayActive(active: boolean) {
    const was = this.active;
    this.active = active;
    if (!this.root) return;
    this.root.classList.toggle('mobile-controls-dimmed', !active);
    if (!active && was) this.releaseAll();
    if (!active) this.hideTapAffordance();
  }

  /** Show Slide / Cam only while riding the board. */
  syncBoardButtons() {
    const riding = !!this.host?.isBoardMounted();
    this.root?.querySelectorAll<HTMLElement>('.mobile-board-only').forEach((el) => {
      el.classList.toggle('hidden', riding ? false : true);
      el.setAttribute('aria-hidden', riding ? 'false' : 'true');
    });
  }

  /** Show ⟲/⟳ while the site builder can rotate. */
  syncSiteRotateButtons() {
    const on = !!this.host?.isSiteRotateEnabled();
    this.root?.querySelectorAll<HTMLElement>('.mobile-site-rotate').forEach((el) => {
      el.classList.toggle('hidden', !on);
      el.setAttribute('aria-hidden', on ? 'false' : 'true');
    });
  }

  /**
   * Position the floating Tap badge over a world interactable (CSS px in #app).
   * Pass null to hide.
   */
  setTapAffordance(screen: { x: number; y: number; label?: string } | null) {
    const el = this.tapAffordance;
    if (!el) return;
    if (!this.visible || !this.active || !screen) {
      this.hideTapAffordance();
      return;
    }
    el.textContent = screen.label ?? 'Tap';
    el.style.left = `${screen.x}px`;
    el.style.top = `${screen.y}px`;
    el.classList.remove('hidden');
    el.setAttribute('aria-hidden', 'false');
  }

  private hideTapAffordance() {
    const el = this.tapAffordance;
    if (!el) return;
    el.classList.add('hidden');
    el.setAttribute('aria-hidden', 'true');
  }

  private releaseAll() {
    this.clearMoveKeys();
    this.resetStickVisual();
    this.stickPointerId = null;
    this.lookPointerId = null;
    this.lookPointers.clear();
    this.rotateLastAngle = null;
    this.rotateMode = false;
    this.clearAttackHold();
    if (this.fireHeld) {
      this.fireHeld = false;
      this.host?.setFireHeld(false);
    }
  }

  private clearAttackHold() {
    if (this.attackHoldTimer != null) {
      window.clearTimeout(this.attackHoldTimer);
      this.attackHoldTimer = null;
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

    const angleOf = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.atan2(b.y - a.y, b.x - a.x);

    const syncRotateAnchor = () => {
      if (this.lookPointers.size < 2) {
        this.rotateLastAngle = null;
        this.rotateMode = false;
        return;
      }
      const pts = [...this.lookPointers.values()];
      this.rotateLastAngle = angleOf(pts[0]!, pts[1]!);
      this.rotateMode = true;
      // Cancel pending one-finger tap once twist starts
      this.lookMoved = true;
      this.lookPointerId = null;
    };

    const onDown = (ev: PointerEvent) => {
      if (!this.host || this.host.isDisposed() || !this.visible || !this.active) return;
      if (ev.button !== 0 && ev.pointerType === 'mouse') return;
      const t = ev.target as HTMLElement | null;
      if (
        t?.closest?.(
          '.mobile-btn, .mobile-stick, .mobile-left, .mobile-right, .mobile-pause, #mobile-tap-affordance, #nav-compass',
        )
      ) {
        return;
      }
      ev.preventDefault();
      ev.stopPropagation();
      this.lookPointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      try {
        el.setPointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }

      if (this.lookPointers.size >= 2) {
        syncRotateAnchor();
        return;
      }

      // Single-finger look / tap
      this.lookPointerId = ev.pointerId;
      this.lookLast.x = ev.clientX;
      this.lookLast.y = ev.clientY;
      this.lookStart.x = ev.clientX;
      this.lookStart.y = ev.clientY;
      this.lookMoved = false;
      this.rotateMode = false;
      this.rotateLastAngle = null;
    };

    const onMove = (ev: PointerEvent) => {
      if (!this.lookPointers.has(ev.pointerId) || !this.host) return;
      ev.preventDefault();
      this.lookPointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });

      if (this.lookPointers.size >= 2) {
        if (!this.rotateMode || this.rotateLastAngle == null) syncRotateAnchor();
        const pts = [...this.lookPointers.values()];
        const ang = angleOf(pts[0]!, pts[1]!);
        let delta = ang - (this.rotateLastAngle ?? ang);
        // Wrap to [-π, π]
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        this.rotateLastAngle = ang;
        if (Math.abs(delta) > 1e-4) {
          this.host.applyTouchRotate(delta);
        }
        return;
      }

      // One-finger look
      if (ev.pointerId !== this.lookPointerId) return;
      const dx = ev.clientX - this.lookLast.x;
      const dy = ev.clientY - this.lookLast.y;
      this.lookLast.x = ev.clientX;
      this.lookLast.y = ev.clientY;
      if (dx !== 0 || dy !== 0) {
        if (
          Math.hypot(ev.clientX - this.lookStart.x, ev.clientY - this.lookStart.y) >
          LOOK_TAP_MAX_MOVE
        ) {
          this.lookMoved = true;
        }
        this.host.applyTouchLook(dx, dy);
      }
    };

    const onUp = (ev: PointerEvent) => {
      if (!this.lookPointers.has(ev.pointerId)) return;
      const wasPrimary = ev.pointerId === this.lookPointerId;
      const wasTap = wasPrimary && !this.lookMoved && !this.rotateMode;
      this.lookPointers.delete(ev.pointerId);
      try {
        el.releasePointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }

      if (this.lookPointers.size >= 2) {
        syncRotateAnchor();
      } else if (this.lookPointers.size === 1) {
        // Fall back to single-finger look with remaining finger
        this.rotateMode = false;
        this.rotateLastAngle = null;
        const [id, pt] = [...this.lookPointers.entries()][0]!;
        this.lookPointerId = id;
        this.lookLast.x = pt.x;
        this.lookLast.y = pt.y;
        this.lookStart.x = pt.x;
        this.lookStart.y = pt.y;
        this.lookMoved = true; // don't treat as tap after a pinch
      } else {
        this.lookPointerId = null;
        this.rotateMode = false;
        this.rotateLastAngle = null;
        // Short tap on world (not a look-drag / twist) → interact when in range
        if (wasTap && this.active && this.host && !this.host.isDisposed()) {
          this.host.tryInteract();
        }
      }
    };

    el.addEventListener('pointerdown', onDown, { signal: sig });
    el.addEventListener('pointermove', onMove, { signal: sig });
    el.addEventListener('pointerup', onUp, { signal: sig });
    el.addEventListener('pointercancel', onUp, { signal: sig });
  }

  /**
   * Native TouchEvent two-finger twist — more reliable on iOS than multi-pointer
   * on the look pad alone (second finger often lands on stick / wizard / buttons).
   */
  private bindTwoFingerTouchRotate(sig: AbortSignal) {
    let lastAngle: number | null = null;
    let active = false;

    const angleTouches = (a: Touch, b: Touch) => Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX);

    const enabled = () =>
      !!this.host &&
      !this.host.isDisposed() &&
      this.visible &&
      this.active &&
      this.host.isSiteRotateEnabled();

    const onStart = (ev: TouchEvent) => {
      if (!enabled()) {
        lastAngle = null;
        active = false;
        return;
      }
      if (ev.touches.length >= 2) {
        lastAngle = angleTouches(ev.touches[0]!, ev.touches[1]!);
        active = true;
        // Don't treat concurrent look-pad drag as a tap
        this.lookMoved = true;
        this.rotateMode = true;
      }
    };

    const onMove = (ev: TouchEvent) => {
      if (!enabled() || !active || ev.touches.length < 2 || lastAngle == null) return;
      // Block page pinch-zoom while twisting the site
      ev.preventDefault();
      const ang = angleTouches(ev.touches[0]!, ev.touches[1]!);
      let delta = ang - lastAngle;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      lastAngle = ang;
      if (Math.abs(delta) > 1e-4) {
        this.host!.applyTouchRotate(delta);
      }
    };

    const onEnd = (ev: TouchEvent) => {
      if (ev.touches.length < 2) {
        lastAngle = null;
        active = false;
        this.rotateMode = false;
      } else {
        lastAngle = angleTouches(ev.touches[0]!, ev.touches[1]!);
      }
    };

    window.addEventListener('touchstart', onStart, { signal: sig, passive: true, capture: true });
    window.addEventListener('touchmove', onMove, { signal: sig, passive: false, capture: true });
    window.addEventListener('touchend', onEnd, { signal: sig, passive: true, capture: true });
    window.addEventListener('touchcancel', onEnd, { signal: sig, passive: true, capture: true });
  }

  private bindTapAffordance(sig: AbortSignal) {
    const el = this.tapAffordance;
    if (!el) return;
    const onTap = (ev: Event) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (!this.host || this.host.isDisposed() || !this.visible || !this.active) return;
      this.host.tryInteract();
    };
    el.addEventListener('pointerdown', onTap, { signal: sig });
    el.addEventListener('click', onTap, { signal: sig });
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
      btn.addEventListener(
        'lostpointercapture',
        () => {
          btn.classList.remove('active');
          this.onAction(action, false);
        },
        { signal: sig },
      );
    }
  }

  private onAction(action: string, down: boolean) {
    const host = this.host;
    if (!host) return;

    switch (action) {
      case 'jump':
        host.injectKey('Space', down);
        break;
      case 'attack':
        if (down) {
          this.fireHeld = true;
          host.setFireHeld(true);
          this.clearAttackHold();
          this.attackHoldTimer = window.setTimeout(() => {
            this.attackHoldTimer = null;
            if (!this.host || this.host.isDisposed()) return;
            this.fireHeld = false;
            this.host.setFireHeld(false);
            this.host.cycleWeapon();
          }, WEAPON_HOLD_MS);
        } else {
          this.clearAttackHold();
          if (this.fireHeld) {
            this.fireHeld = false;
            host.setFireHeld(false);
          }
        }
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
      case 'camera':
        if (down) {
          host.injectKey('Tab', true);
          host.injectKey('Tab', false);
        }
        break;
      case 'map':
        if (down) host.toggleMap();
        break;
      case 'rotate-left':
        // One tap = one home 90° step (threshold 0.22)
        if (down) host.applyTouchRotate(0.25);
        break;
      case 'rotate-right':
        if (down) host.applyTouchRotate(-0.25);
        break;
      default:
        break;
    }
  }
}

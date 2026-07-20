/**
 * ForgeHeart: Gift of the Brass Gods — Tutorial (Brother's Workshop)
 * Solid 3D platforming; separate product from Trump Doom.
 */

import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import {
  buildBrotherWorkshop,
  JUMP_H,
  PLAYER_H,
  PLAYER_R,
  type Collider,
  type Interactable,
  type LevelBuilt,
  aabbOverlap,
} from './level';
import {
  RobotUnit,
  SparkBolt,
  createHusk,
  createBlastFx,
  ROBOT,
} from './robot';
import { ForgeAudio } from './audio';
import { nearestOnPath, type RacewayBuilt } from './raceway';
import { Surfboard, BOARD } from './surfboard';
import { EliasCompanion } from './eliasCompanion';
import { MobileControls } from './mobileInput';
import {
  writeSlot,
  emptySave,
  LEVEL_NAMES,
  type ForgeSaveData,
  type LevelId,
  type TutorialPhaseSave,
} from './save';
import {
  CityEditor,
  ALL_CATEGORIES,
  CATEGORY_LABELS,
  LAYER_HEIGHT,
  layerToY,
  yToLayer,
  type ScaleAxis,
} from './cityEditor';
import { CATALOG, catalogFor } from './editorCatalog';
import {
  generateCitySection,
  transformBlueprint,
  newCitySeed,
  type CitySectionBlueprint,
} from './citySection';
import type { FloatingCityBuilt } from './floatingCity';
import { buildMarketHub, type MarketHubBuilt, type HubInteract } from './marketHub';
import { buildSkyCity, type SkyCityBuilt, type CityInteract } from './skyCity';
import {
  buildLiveMarkers,
  renderCityMap,
  describeSelection,
  hitTestMap,
  listMapPlaces,
  defaultMapCamera,
  zoomMapCamera,
  panMapCamera,
  focusMapOn,
  resolveMapTarget,
  routeToTarget,
  clientToMapSvg,
  mapToWorld,
  mapWorldScale,
  type MapLiveMarker,
  type MapPlaceFilter,
  type MapCamera,
} from './cityMap';
import {
  emptyInventory,
  invFromSave,
  invToSave,
  sellToVendor,
  buyFromVendor,
  leaseParcel,
  craft,
  canCraft,
  craftCustom,
  hireLaborer,
  expandBay,
  sellFrameToBroker,
  completeRepair,
  setWorkerJob,
  assignWorkerProgram,
  setWorkerHarvestSite,
  listHarvestSites,
  describeWorkerAssignment,
  createProgram,
  addProgramNode,
  removeProgramNode,
  moveProgramNode,
  equipWorkerBoard,
  equipWorkerTool,
  inventCustomRecipe,
  buyPlayerBoard,
  upgradePlayerBoard,
  sellCustomToVendor,
  tickBayUpkeep,
  tickStall,
  tickAllStalls,
  tickAllPassiveWorkers,
  applyHarvestSuccess,
  DEFAULT_HARVEST_POOL,
  leaseStall,
  leaseCityStall,
  toggleStallOpen,
  toggleCityStallOpen,
  stockStallFromInv,
  stockInventionOnStall,
  ensureCityStall,
  raiseWorkerPay,
  hireCost,
  expandBayCost,
  canInvent,
  canEmpireExpand,
  TRAINING_MAX_BAY_LEVEL,
  ownedCityStallCount,
  nudgeStallAsk,
  setStallAsk,
  getStallAsk,
  fairStallPrice,
  productQuality,
  stallDemandInfo,
  resolveStallHaggle,
  notePeakBrass,
  buyApartment,
  leaseCityWorkshop,
  repairRogueRobot,
  districtById,
  APARTMENT_COST,
  STALL_LEASE_COST,
  STALL_INTERVAL,
  PAY_RAISE_COST,
  playerWalkSpeedMul,
  playerBoardSpeedMul,
  bayLevelName,
  maxWorkersForBay,
  RECIPES,
  JOB_DEFS,
  PROGRAM_NODE_DEFS,
  UPKEEP_INTERVAL,
  FRAME_BROKER_PRICE,
  REPAIR_PAY,
  BOARD_BASE_COST,
  BOARD_THRUSTER_COST,
  BOARD_RAILS_COST,
  BOARD_DECK_COST,
  COMMODITIES,
  type InventoryState,
  type VendorDef,
  type CommodityId,
  type Recipe,
  type JobId,
  type ProgramNodeKind,
} from './economy';
import { generateBackstory, type Backstory } from './backstory';
import { WorkerAgent, createWorkerAgents } from './workerAgent';
import { NavGrid, pointInBayBounds, getBayBuildBounds } from './navGrid';

/** Game Maker interaction mode */
type MakerTool = 'place' | 'select' | 'copy' | 'city';

export interface GameStartOptions {
  slot: number;
  /** null = new game on that slot */
  save: ForgeSaveData | null;
}

const GRAVITY = 28;
const MOVE_SPEED = 7;
const JUMP_VEL = Math.sqrt(2 * GRAVITY * JUMP_H);

type Weapon = 'hand' | 'wrench' | 'board';

/** Tutorial progression */
type TutorialPhase =
  | 'explore' // lab, hand only, brother disabled
  | 'rebuild' // scrapped brother — gather trays
  | 'siege' // ally online, demons banging
  | 'breach' // door open, fight 2 demons
  | 'escape' // get to the boat
  | 'won'
  | 'race'; // sky city surfboard leg

export class ForgeHeartGame {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: PointerLockControls;
  /** Mouse look multiplier (0.5–3). Persisted in localStorage. */
  private lookSensitivity = 1;
  private clock = new THREE.Clock();
  private audio = new ForgeAudio();

  private level: LevelBuilt;
  private colliders: Collider[] = [];
  private velocity = new THREE.Vector3();
  private onGround = false;
  private keys = new Set<string>();

  private health = 100;
  private plasma = 100;
  private brass = 0;
  private gears = 0;
  private weapon: Weapon = 'hand';
  private wrenchUnlocked = false;
  /** After first pickup, board is inventory — deploy from anywhere */
  private boardOwned = false;
  /** Small carried board visual when owned + on foot */
  private boardCarryMesh: THREE.Object3D | null = null;
  private atkCd = 0;
  private invuln = 0;
  private arcMesh: THREE.Mesh | null = null;

  private robots: RobotUnit[] = [];
  private husks: THREE.Object3D[] = [];
  private bolts: SparkBolt[] = [];
  private blasts: THREE.Group[] = [];
  private interactables: Interactable[] = [];
  private exit: THREE.Vector3;
  private won = false;
  private paused = false;

  private hpFill: HTMLElement;
  private plasmaFill: HTMLElement;
  private weaponEl: HTMLElement;
  private statsEl: HTMLElement;
  private locEl: HTMLElement | null;
  private toastEl: HTMLElement;
  private convertEl: HTMLElement;
  private helpEl: HTMLElement | null = null;
  private msg = '';
  private msgT = 0;

  private fireHeld = false;
  private safePos = new THREE.Vector3();
  private safeTimer = 0;
  private allyStarveT = 0;

  // ——— Tutorial state ———
  private tutorial: TutorialPhase = 'explore';
  private traysCollected = 0;
  private bangCount = 0;
  private bangTimer = 0;
  private readonly bangsTotal = 10;
  private readonly bangInterval = 3;
  /** Arc wrench hits needed to force the lab door during siege */
  private doorHp = 4;
  private readonly doorHpMax = 4;
  private brotherScrapped = false;
  private hadAllyOnce = false;
  private objective = 'Read the lab. Wake Elias with the Hand (1) — do not scrap him.';

  // ——— Race / surfboard (legacy; Phase 0 uses economy hub) ———
  private raceway: RacewayBuilt | null = null;
  private board: Surfboard | null = null;
  private elias: EliasCompanion | null = null;
  private raceActive = false;
  /** Phase 0–2 sky market training hub */
  private economyActive = false;
  private hub: MarketHubBuilt | null = null;
  /** Phase 3 true sky city */
  private megaCityActive = false;
  private skyCity: SkyCityBuilt | null = null;
  private cityTime = 0;
  private cityInteractPrompt: CityInteract | null = null;
  private neighborLineIdx = 0;
  private inv: InventoryState = emptyInventory(40);
  private activeVendor: VendorDef | null = null;
  private craftOpen = false;
  /** Workbench filter chip */
  private craftFilter: 'ready' | 'basics' | 'tools' | 'frames' | 'invent' | 'all' = 'ready';
  /** Selected recipe id, or `custom:${id}` for inventions */
  private craftSelectedId: string | null = null;
  private bayOpen = false;
  private boardShopOpen = false;
  private programOpen = false;
  private programFilter:
    | 'haul'
    | 'craft'
    | 'market_sell'
    | 'market_buy'
    | 'service'
    | 'stall' = 'haul';
  private programPickNode: ProgramNodeKind | null = null;
  private stallOpen = false;
  private stallAcc = 0;
  /** Active stall context: 'training' or district id */
  private activeStallKey: string = 'training';
  private harvestOpen = false;
  private harvestNeedle = 0;
  private harvestDir = 1;
  /** Active reef pool (city biomes specialize mats) */
  private harvestPool: CommodityId[] = [...DEFAULT_HARVEST_POOL];
  private harvestLabel = 'Cloud reef';
  /** Passive worker clock in mega city (no hub nav) */
  private cityWorkerAcc = 0;
  /** Empire map (M) */
  private cityMapOpen = false;
  private cityMapSelectedId: string | null = null;
  private cityMapLive: MapLiveMarker[] = [];
  private cityMapWired = false;
  private cityMapFilter: MapPlaceFilter = 'all';
  private cityMapCam: MapCamera | null = null;
  private cityMapDrag: {
    active: boolean;
    moved: boolean;
    lastU: number;
    lastV: number;
  } | null = null;
  private upkeepAcc = 0;
  private workerAgents: WorkerAgent[] = [];
  private navGrid = new NavGrid(1.2, 0.5);
  private activeProgramId: string | null = null;
  private marketBoardPath: THREE.Vector3[] = [];
  private marketBoardPathDist: number[] = [];
  private bayTab: 'inv' | 'workers' | 'invent' | 'code' = 'inv';
  private backstory: Backstory | null = null;
  private hubInteractPrompt: HubInteract | null = null;
  private raceFinished = false;
  private checkpointIdx = 0;
  private lastCheckpointPos = new THREE.Vector3();
  private lastCheckpointYaw = 0;
  private speedBlurEl: HTMLElement | null = null;
  private camPitchOffset = 0;
  private whooshCursor = 0;
  private bringEliasToRace = false;
  private activeSlot = 0;
  private pendingLoad: ForgeSaveData | null = null;
  private autosaveT = 0;
  private disposed = false;
  /** On-screen touch controls when a mobile browser is detected. */
  private mobile = new MobileControls();
  /** Abort all window/canvas/DOM listeners for this session (title exit / new game). */
  private sessionAbort = new AbortController();
  private craftDoWired = false;
  /** Prevent respawn spam when race floor was missing */
  private respawnCd = 0;
  /** Board camera: first-person default; last mode remembered in save */
  private boardCamMode: 'first' | 'third' = 'first';

  // ——— Game Maker ———
  private cityEditor: CityEditor | null = null;
  private gameMakerActive = false;
  private makerPaletteOpen = false;
  private makerTool: MakerTool = 'place';
  private makerScaleAxis: ScaleAxis = 'uniform';
  /** Active half-story layer for placement / layer moves */
  private makerLayer = 0;
  private makerYaw = 0;
  private makerRay = new THREE.Raycaster();
  private makerNd = new THREE.Vector2(0, 0); // screen center
  private baseFogNear = 28;
  private baseFogFar = 95;
  private raceFogNear = 40;
  private raceFogFar = 180;
  /** Procedural path/rails before editor merge */
  private raceBasePath: THREE.Vector3[] | null = null;
  private raceBasePathDist: number[] | null = null;
  private raceBaseRails: import('./raceway').RaceRail[] | null = null;
  private raceBaseRamps: import('./raceway').RaceRamp[] | null = null;
  private raceBaseBumps: THREE.Vector3[] | null = null;
  private paletteWired = false;
  /** City section preview (confirm to bake as editable objects) */
  private cityBlueprint: CitySectionBlueprint | null = null;
  private cityGhost: THREE.Group | null = null;
  private cityGhostYaw = 0;
  private cityGhostScale = 1;
  private cityGhostPos = new THREE.Vector3();
  /** Demo floating sky district (platforms, enterable buildings, docks) */
  private floatingCity: FloatingCityBuilt | null = null;
  private floatTime = 0;
  /**
   * Fall kill plane — below lowest placed / race / city content.
   * Refreshed when race loads and when editor objects change.
   */
  private fallKillY = -24;

  constructor(
    private canvas: HTMLCanvasElement,
    options: GameStartOptions = { slot: 0, save: null },
  ) {
    this.activeSlot = options.slot;
    this.pendingLoad = options.save;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.camera = new THREE.PerspectiveCamera(70, canvas.clientWidth / canvas.clientHeight, 0.08, 120);
    this.controls = new PointerLockControls(this.camera, canvas);
    // Mobile / touch: pointer lock is unreliable — no-op when touch UI is active.
    const origLock = this.controls.lock.bind(this.controls);
    this.controls.lock = () => {
      if (this.mobile.enabled) return;
      return origLock();
    };
    this.loadLookSensitivity();
    this.wireLookSensitivityUi();

    // Warm lab interior; cooler open sky outside
    // Cool sky haze — far fog so painted backdrops dissolve instead of cutting off hard
    this.scene.background = new THREE.Color(0x7a92a8);
    this.scene.fog = new THREE.Fog(0x8a9eb0, 28, 95);

    const hemi = new THREE.HemisphereLight(0xffe8c8, 0x3a3028, 0.6);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff0d0, 1.15);
    sun.position.set(8, 28, 14);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 80;
    sun.shadow.camera.left = -30;
    sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 30;
    sun.shadow.camera.bottom = -30;
    this.scene.add(sun);

    this.level = buildBrotherWorkshop();
    this.scene.add(this.level.group);
    this.colliders = [...this.level.colliders];
    this.interactables = this.level.interactables;
    this.exit = this.level.exit.clone();
    this.baseFogNear = 28;
    this.baseFogFar = 95;

    // City editor root — available on all levels; loads saved placements
    this.initCityEditor(this.level.mats);

    // Only Elias — deactivated, leaned on the workstation
    const brother = new RobotUnit(this.level.mats, this.level.anchors.brotherSpot.clone());
    brother.isBrother = true;
    brother.displayName = 'Elias';
    brother.setPhase('disabled');
    brother.scramble = 100;
    brother.scrambled = true;
    this.robots.push(brother);
    this.scene.add(brother.mesh);

    this.camera.position.set(
      this.level.spawn.x,
      this.level.spawn.y + PLAYER_H * 0.9 + 0.2,
      this.level.spawn.z,
    );
    this.safePos.copy(this.camera.position);

    this.hpFill = document.getElementById('resolve-fill')!;
    this.plasmaFill = document.getElementById('voice-fill')!;
    this.weaponEl = document.getElementById('weapon-name')!;
    this.statsEl = document.getElementById('stats-line')!;
    this.locEl = document.getElementById('location-line');
    this.toastEl = document.getElementById('plaque-toast')!;
    this.convertEl = document.getElementById('convert-toast')!;
    this.helpEl = document.querySelector('.help-line');
    this.speedBlurEl = document.getElementById('speed-blur');
    const face = document.getElementById('resolve-face');
    if (face) face.textContent = '⚙️';
    document.querySelectorAll('.hud-bar .label').forEach((el) => {
      if (el.textContent === 'VOICE' || el.textContent === 'PLASMA') el.textContent = 'PLASMA';
      if (el.textContent === 'RESOLVE' || el.textContent === 'INTEGRITY') el.textContent = 'INTEGRITY';
    });

    this.bindInput();
    this.wireHarvestTouchUi();
    window.addEventListener('resize', () => this.onResize(), { signal: this.sessionAbort.signal });
    // Always attach: shows immediately on phones, or arms first-touch enable on other devices
    this.mobile.attach({
      applyTouchLook: (dx, dy) => this.applyTouchLook(dx, dy),
      setFireHeld: (v) => this.setFireHeld(v),
      setPaused: (p) => this.setPaused(p),
      isPaused: () => this.isPaused(),
      injectKey: (code, down) => this.injectKey(code, down),
      isDisposed: () => this.disposed,
      cycleWeapon: () => this.cycleMobileWeapon(),
      tryInteract: () => {
        if (this.currentInteractWorldPos()) this.tryInteract();
      },
      toggleMap: () => this.toggleCityMapFromMobile(),
      isBoardMounted: () => !!this.board?.mounted,
      onMobileControlsEnabled: () => {
        this.syncMobileGameplay();
        // First-time mobile enable with no saved look pref → 3×
        this.ensureMobileLookDefault();
        this.setHelp('Stick move · drag look · tap to interact · Attack · Jump · Pause');
        this.toast('Touch controls on — stick · look · tap prompts · Pause top-left', 4);
      },
    });
    if (this.mobile.enabled) {
      this.syncMobileGameplay();
      this.setHelp('Stick move · drag look · tap to interact · Attack · Jump · Pause');
    } else {
      this.setHelp('WASD look · E read / interact · 1 Hand reprogram · Space jump');
    }
    this.wireNavCompassTap();
  }

  private bindInput() {
    const sig = this.sessionAbort.signal;
    window.addEventListener('keydown', (e) => {
      if (this.disposed) return;
      const wasDown = this.keys.has(e.code);
      this.keys.add(e.code);
      if (e.code === 'Space') e.preventDefault();

      // Game Maker hotkeys (even when palette open, except Esc)
      if (this.gameMakerActive && !this.paused) {
        if (!wasDown && (e.code === 'Backquote' || e.key === '`' || e.key === '~')) {
          e.preventDefault();
          this.toggleMakerPalette();
          return;
        }
        if (!wasDown && this.handleMakerKey(e.code)) {
          e.preventDefault();
          return;
        }
      }

      if (this.gameMakerActive) {
        if (e.code === 'Escape') {
          // City preview: Esc cancels section first
          if (this.makerTool === 'city' && this.cityGhost && !this.makerPaletteOpen) {
            this.clearCityGhost();
            this.makerTool = 'place';
            this.refreshMakerPalette();
            this.syncMakerHud();
            this.toast('City section cancelled', 1.5);
            return;
          }
          // Close palette first, then pause
          if (this.makerPaletteOpen) {
            this.setMakerPaletteOpen(false);
          } else {
            this.setPaused(!this.paused);
          }
        }
        return;
      }

      if (e.code === 'Digit1' && !this.board?.mounted) {
        this.weapon = 'hand';
        this.syncWeaponHud();
      }
      if (e.code === 'Digit2' && !this.board?.mounted) {
        if (this.wrenchUnlocked) {
          this.weapon = 'wrench';
          this.syncWeaponHud();
        } else this.toast('Arc wrench is on the wall rack — claim it when the door fails.');
      }
      if (e.code === 'Digit3' && !this.board?.mounted) {
        if (this.boardOwned) {
          this.weapon = 'board';
          this.syncWeaponHud();
          this.toast('Surfboard ready — E or click to ride from here', 2);
        } else {
          this.toast('Find and claim the plasma surfboard first (E near it).', 2.5);
        }
      }
      // Q: market board mount/stow (always available once owned — not a weapon slot)
      if (
        this.economyActive &&
        !this.gameMakerActive &&
        !wasDown &&
        e.code === 'KeyQ' &&
        (this.inv.playerBoard.owned || this.boardOwned)
      ) {
        e.preventDefault();
        if (this.isEconomyUiOpen() || this.harvestOpen) return;
        if (this.board?.mounted) this.dismountMarketBoard();
        else this.tryMountMarketBoard();
        return;
      }
      if (e.code === 'KeyE' && !wasDown) {
        this.tryInteract();
        return;
      }
      // Harvest mini-game
      if (this.harvestOpen && !wasDown && e.code === 'Space') {
        e.preventDefault();
        const inZone = this.harvestNeedle >= 55 && this.harvestNeedle <= 75;
        this.closeHarvest(inZone);
        return;
      }
      if (this.harvestOpen && e.code === 'Escape') {
        this.closeHarvest(false);
        return;
      }
      // Market / craft panels
      if (this.activeVendor && e.code === 'Escape') {
        this.closeMarket();
        return;
      }
      if (this.craftOpen && e.code === 'Escape') {
        this.closeCraft();
        return;
      }
      if (this.bayOpen && e.code === 'Escape') {
        this.closeBay();
        return;
      }
      if (this.boardShopOpen && e.code === 'Escape') {
        this.closeBoardShop();
        return;
      }
      if (this.programOpen && e.code === 'Escape') {
        this.closeProgram();
        return;
      }
      if (this.stallOpen && e.code === 'Escape') {
        this.closeStall();
        return;
      }
      if (this.cityMapOpen && e.code === 'Escape') {
        this.closeCityMap();
        return;
      }
      // Empire map (M) — available walking or on board
      if (
        this.megaCityActive &&
        !wasDown &&
        e.code === 'KeyM' &&
        !this.gameMakerActive
      ) {
        e.preventDefault();
        if (this.cityMapOpen) this.closeCityMap();
        else if (
          !this.harvestOpen &&
          !this.craftOpen &&
          !this.bayOpen &&
          !this.boardShopOpen &&
          !this.programOpen &&
          !this.stallOpen &&
          !this.activeVendor
        ) {
          this.openCityMap();
        }
        return;
      }
      // Bay office inventory (I) while in sky city
      if (this.economyActive && !wasDown && e.code === 'KeyI') {
        e.preventDefault();
        if (this.bayOpen) this.closeBay();
        else if (
          !this.harvestOpen &&
          !this.craftOpen &&
          !this.activeVendor &&
          !this.boardShopOpen &&
          !this.programOpen &&
          !this.cityMapOpen &&
          !this.board?.mounted
        ) {
          this.openBay();
        }
        return;
      }
      if (this.economyActive && this.board?.mounted && !wasDown && (e.code === 'Space' || e.code === 'KeyJ')) {
        e.preventDefault();
        this.board.requestJump();
        return;
      }
      // Jump while boarded (Space) — Shift is powerslide
      if (this.board?.mounted && !wasDown && (e.code === 'Space' || e.code === 'KeyJ')) {
        e.preventDefault();
        this.board.requestJump();
      }
      // Tab: toggle first / third person while on the board
      if (!wasDown && e.code === 'Tab') {
        e.preventDefault();
        if (this.board?.mounted) this.toggleBoardCamera();
      }
      if (e.code === 'Escape') {
        this.setPaused(!this.paused);
      }
    }, { signal: sig });
    window.addEventListener(
      'keyup',
      (e) => {
        if (this.disposed) return;
        this.keys.delete(e.code);
      },
      { signal: sig },
    );
    this.canvas.addEventListener(
      'click',
      (e) => {
        if (this.disposed || this.paused) return;
        if (this.gameMakerActive) {
          if (this.makerPaletteOpen) return;
          e.preventDefault();
          this.onMakerClick();
          if (!this.controls.isLocked) this.controls.lock();
          return;
        }
        this.controls.lock();
      },
      { signal: sig },
    );
  }

  private initCityEditor(mats: import('./materials').Mats) {
    if (this.cityEditor) {
      this.scene.remove(this.cityEditor.group);
    }
    this.cityEditor = new CityEditor(mats);
    this.cityEditor.loadFromStorage();
    this.scene.add(this.cityEditor.group);
    this.applyClearGeneratedVisual();
    this.wireMakerPaletteUi();
  }

  isGameMakerActive() {
    return this.gameMakerActive;
  }

  /** Enter free-fly place mode from pause menu. */
  enterGameMaker() {
    if (this.disposed) return;
    // Dismount board so free-fly is clean
    if (this.board?.mounted) {
      this.dismountMarketBoard();
    }
    // In sky market: bay workshop builder only (need leased bay)
    if (this.economyActive && (!this.inv.parcelLeased || this.inv.bayLevel < 1)) {
      this.toast('Lease a bay first — Game Maker builds only on your owned workshop.', 3.5);
      return;
    }
    this.gameMakerActive = true;
    this.paused = false;
    this.velocity.set(0, 0, 0);
    this.makerLayer = yToLayer(this.camera.position.y - 2);
    this.makerTool = 'place';
    this.makerScaleAxis = 'uniform';
    this.makerYaw = this.camera.rotation.y;
    this.camera.up.set(0, 1, 0);
    this.applySpeedFx(0, 0);
    this.camera.fov = 70;
    this.camera.far = 500;
    this.camera.near = 0.1;
    this.camera.updateProjectionMatrix();
    this.setMakerPaletteOpen(false);
    this.cityEditor?.highlightLayer(this.makerLayer, null);
    this.syncMakerHud();
    if (this.economyActive) {
      this.setHelp(
        'BAY MAKER · place only inside your bay · P/X/C · 1–5 · PgUp/Dn · ~ menu · no city sections',
      );
      this.toast(
        `Workshop builder · ${bayLevelName(this.inv.bayLevel)} bounds only. Expand bay for more floor.`,
        4,
      );
      if (this.locEl) this.locEl.textContent = 'Game Maker · Your Bay';
      // Snap camera above bay
      const b = getBayBuildBounds(this.inv.bayLevel);
      if (b) {
        this.camera.position.set(
          (b.min.x + b.max.x) / 2,
          Math.max(this.camera.position.y, 8),
          (b.min.z + b.max.z) / 2,
        );
      }
    } else {
      this.setHelp(
        'GAME MAKER · P place · X select · C copy · 1–5 prefab · Z scale axis · PgUp/Dn layer · ~ menu',
      );
      this.toast(
        'Game Maker · P/X/C tools · place never steals select · half-story layers (PgUp/Dn)',
        4,
      );
      if (this.locEl) this.locEl.textContent = 'Game Maker Mode';
    }
    document.getElementById('pause-menu')?.classList.add('hidden');
    this.controls.lock();
  }

  /** Leave maker and resume normal play at current camera position. */
  exitGameMaker() {
    if (!this.gameMakerActive) return;
    this.gameMakerActive = false;
    this.clearCityGhost();
    this.setMakerPaletteOpen(false);
    this.cityEditor?.updateGhost(null, 0);
    this.cityEditor?.select(null);
    this.cityEditor?.clearLayerHighlights();
    this.cityEditor?.persist();
    this.applyEditorGameplay();
    if (this.economyActive) this.rebuildHubNav();
    this.paused = false;
    this.velocity.set(0, 0, 0);
    this.onGround = false;
    this.syncMakerHud();
    document.getElementById('pause-menu')?.classList.add('hidden');
    if (this.raceActive) {
      this.setHelp(
        'E board · W accel · S brake · A/D bank · hold Shift slide · Space jump · Esc pause',
      );
      if (this.locEl) this.locEl.textContent = 'Sky City · Racetrack';
    } else if (this.economyActive) {
      this.setHelp('WASD · E interact · I bay · board at dock · Esc save · ~ Game Maker');
      if (this.locEl) this.locEl.textContent = 'Sky City · Market District';
    } else {
      this.setHelp('WASD look · E read / interact · 1 Hand reprogram · Space jump · Esc');
    }
    this.toast(
      this.economyActive
        ? 'Bay edit saved — workers repath around new walls.'
        : 'Game Maker off — play to test your city.',
      3.5,
    );
    this.controls.lock();
  }

  /** True when Game Maker is restricted to owned bay footprint */
  private isBayMakerMode() {
    return this.economyActive && this.inv.parcelLeased && this.inv.bayLevel >= 1;
  }

  private assertBayPlace(pos: THREE.Vector3): boolean {
    if (!this.isBayMakerMode()) return true;
    if (pointInBayBounds(pos, this.inv.bayLevel)) return true;
    this.toast('Outside your bay — expand the pad or place inside the workshop bounds.', 2.5);
    return false;
  }

  private syncMakerHud() {
    const hud = document.getElementById('maker-hud');
    if (!hud) return;
    if (this.gameMakerActive) {
      hud.classList.remove('hidden');
      hud.setAttribute('aria-hidden', 'false');
    } else {
      hud.classList.add('hidden');
      hud.setAttribute('aria-hidden', 'true');
    }
    const st = document.getElementById('maker-status');
    if (st) {
      const cat = this.cityEditor?.activeCategory ?? 'building';
      const v = this.cityEditor?.activeVariant ?? 0;
      const entry = CATALOG.find((c) => c.category === cat && c.variant === v);
      const scaleLabel =
        this.makerScaleAxis === 'uniform'
          ? 'Scale:UNI'
          : this.makerScaleAxis === 'horizontal'
            ? 'Scale:H'
            : 'Scale:V';
      const peers = this.cityEditor?.countOnLayer(this.makerLayer, this.cityEditor.selectedId) ?? 0;
      const tool =
        this.makerTool === 'place'
          ? `PLACE ${entry?.label ?? cat}`
          : this.makerTool === 'select'
            ? 'SELECT/MOVE'
            : this.makerTool === 'copy'
              ? 'COPY'
              : `CITY ×${this.cityGhostScale.toFixed(2)}`;
      st.textContent = `${tool} · L${this.makerLayer} (${peers} peers) · ${scaleLabel} · P/X/C/B · 1–5 · ~`;
    }
  }

  private setMakerTool(tool: MakerTool) {
    if (tool !== 'city') this.clearCityGhost();
    this.makerTool = tool;
    if (tool === 'copy' && !this.cityEditor?.getSelected()) {
      this.toast('Copy mode — select an object first (X), then click to stamp copies', 3);
    }
    if (tool === 'city') {
      this.beginCitySectionPreview();
    }
    this.refreshMakerPalette();
    this.syncMakerHud();
    this.toast(
      tool === 'place'
        ? 'Place mode — LMB/Space places only (never selects)'
        : tool === 'select'
          ? 'Select mode — LMB pick · empty/Space move · arrows · PgUp/Dn layer'
          : tool === 'copy'
            ? 'Copy mode — LMB/Space stamps a copy of the selection'
            : 'City section — move look · R/F rotate · [/] scale · G re-roll · Enter confirm · Esc cancel',
      2.8,
    );
  }

  private beginCitySectionPreview() {
    if (!this.cityEditor) return;
    this.cityBlueprint = generateCitySection(newCitySeed());
    this.cityGhostYaw = this.lookYaw();
    this.cityGhostScale = 1;
    this.rebuildCityGhost();
    this.toast(
      `City section seed ${this.cityBlueprint.seed} · Enter to place (editable after) · G randomize`,
      3.5,
    );
  }

  private rebuildCityGhost() {
    if (!this.cityEditor || !this.cityBlueprint) return;
    if (this.cityGhost) {
      this.scene.remove(this.cityGhost);
      this.cityGhost.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.geometry?.dispose();
          const mat = m.material;
          if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
          else (mat as THREE.Material | undefined)?.dispose?.();
        }
      });
      this.cityGhost = null;
    }
    // Ghost built in local space at origin; we transform the group
    const local = transformBlueprint(this.cityBlueprint, { x: 0, y: 0, z: 0 }, 0, 1);
    this.cityGhost = this.cityEditor.buildPreviewGroup(local);
    this.scene.add(this.cityGhost);
    this.syncCityGhostTransform();
  }

  private syncCityGhostTransform() {
    if (!this.cityGhost) return;
    this.cityGhost.position.copy(this.cityGhostPos);
    this.cityGhost.rotation.set(0, this.cityGhostYaw, 0);
    this.cityGhost.scale.setScalar(this.cityGhostScale);
  }

  private clearCityGhost() {
    if (this.cityGhost) {
      this.scene.remove(this.cityGhost);
      this.cityGhost.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.geometry?.dispose();
          const mat = m.material;
          if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
          else (mat as THREE.Material | undefined)?.dispose?.();
        }
      });
      this.cityGhost = null;
    }
    this.cityBlueprint = null;
  }

  private confirmCitySection() {
    if (this.isBayMakerMode()) {
      this.toast('City sections disabled while building your bay workshop.', 2.5);
      return;
    }
    if (!this.cityEditor || !this.cityBlueprint) {
      this.toast('No city section preview — press B or open City section', 2);
      return;
    }
    const items = transformBlueprint(
      this.cityBlueprint,
      {
        x: this.cityGhostPos.x,
        y: this.cityGhostPos.y,
        z: this.cityGhostPos.z,
      },
      this.cityGhostYaw,
      this.cityGhostScale,
    );
    const n = this.cityEditor.placeMany(items);
    this.clearCityGhost();
    this.makerTool = 'select';
    this.applyEditorGameplay();
    this.refreshFallKillY();
    this.refreshMakerPalette();
    this.syncMakerHud();
    this.toast(
      `City section placed · ${n} objects · all editable (X select) · path network rebuilt`,
      4,
    );
  }

  private rerollCitySection() {
    if (this.makerTool !== 'city') return;
    this.cityBlueprint = generateCitySection(newCitySeed());
    this.rebuildCityGhost();
    this.toast(`New layout · seed ${this.cityBlueprint.seed}`, 2);
  }

  private cycleScaleAxis() {
    this.makerScaleAxis =
      this.makerScaleAxis === 'uniform'
        ? 'horizontal'
        : this.makerScaleAxis === 'horizontal'
          ? 'vertical'
          : 'uniform';
    this.syncMakerHud();
    this.refreshMakerPalette();
    this.toast(
      this.makerScaleAxis === 'uniform'
        ? 'Scale: uniform (all axes)'
        : this.makerScaleAxis === 'horizontal'
          ? 'Scale: horizontal (width/depth only)'
          : 'Scale: vertical (height only)',
      1.8,
    );
  }

  private setMakerLayer(layer: number, moveSelected: boolean) {
    this.makerLayer = layer;
    if (moveSelected && this.cityEditor?.getSelected()) {
      this.cityEditor.setSelectedLayer(layer);
    }
    const exclude = this.cityEditor?.selectedId ?? null;
    this.cityEditor?.highlightLayer(layer, exclude);
    const peers = this.cityEditor?.countOnLayer(layer, exclude) ?? 0;
    this.toast(
      `Layer ${layer} · y=${layerToY(layer).toFixed(1)} · ${peers} other object${peers === 1 ? '' : 's'} here`,
      1.6,
    );
    this.syncMakerHud();
  }

  private setMakerPaletteOpen(open: boolean) {
    this.makerPaletteOpen = open;
    const el = document.getElementById('maker-palette');
    if (el) {
      el.classList.toggle('hidden', !open);
      el.setAttribute('aria-hidden', open ? 'false' : 'true');
    }
    if (open) {
      try {
        this.controls.unlock();
      } catch {
        /* ignore */
      }
      this.refreshMakerPalette();
    } else if (this.gameMakerActive && !this.paused && !this.disposed) {
      this.controls.lock();
    }
  }

  private toggleMakerPalette() {
    this.setMakerPaletteOpen(!this.makerPaletteOpen);
  }

  private wireMakerPaletteUi() {
    if (this.paletteWired || this.disposed) return;
    this.paletteWired = true;
    const sig = this.sessionAbort.signal;
    const live = (fn: () => void) => () => {
      if (!this.disposed) fn();
    };
    const close = document.getElementById('maker-close');
    close?.addEventListener('click', live(() => this.setMakerPaletteOpen(false)), { signal: sig });

    document.getElementById('maker-tool-place')?.addEventListener('click', live(() => {
      this.setMakerTool('place');
    }), { signal: sig });
    document.getElementById('maker-tool-select')?.addEventListener('click', live(() => {
      this.setMakerTool('select');
    }), { signal: sig });
    document.getElementById('maker-tool-copy')?.addEventListener('click', live(() => {
      this.setMakerTool('copy');
    }), { signal: sig });
    document.getElementById('maker-tool-city')?.addEventListener('click', live(() => {
      this.setMakerTool('city');
    }), { signal: sig });
    document.getElementById('maker-city-reroll')?.addEventListener('click', live(() => {
      this.rerollCitySection();
    }), { signal: sig });
    document.getElementById('maker-city-confirm')?.addEventListener('click', live(() => {
      this.confirmCitySection();
    }), { signal: sig });
    document.getElementById('maker-scale-uni')?.addEventListener('click', live(() => {
      this.makerScaleAxis = 'uniform';
      this.refreshMakerPalette();
      this.syncMakerHud();
    }), { signal: sig });
    document.getElementById('maker-scale-h')?.addEventListener('click', live(() => {
      this.makerScaleAxis = 'horizontal';
      this.refreshMakerPalette();
      this.syncMakerHud();
    }), { signal: sig });
    document.getElementById('maker-scale-v')?.addEventListener('click', live(() => {
      this.makerScaleAxis = 'vertical';
      this.refreshMakerPalette();
      this.syncMakerHud();
    }), { signal: sig });
    document.getElementById('maker-dup')?.addEventListener('click', live(() => {
      this.cityEditor?.duplicateSelected();
      this.toast('Duplicated nearby', 1);
    }), { signal: sig });
    document.getElementById('maker-del')?.addEventListener('click', live(() => {
      this.cityEditor?.deleteSelected();
      this.toast('Deleted', 1);
    }), { signal: sig });
    document.getElementById('maker-cycle')?.addEventListener('click', live(() => {
      this.cityEditor?.cycleVariant(1);
      this.toast('Variant changed', 1);
      this.syncMakerHud();
    }), { signal: sig });
    document.getElementById('maker-layer-up')?.addEventListener('click', live(() => {
      this.setMakerLayer(this.makerLayer + 1, !!this.cityEditor?.getSelected());
    }), { signal: sig });
    document.getElementById('maker-layer-dn')?.addEventListener('click', live(() => {
      this.setMakerLayer(this.makerLayer - 1, !!this.cityEditor?.getSelected());
    }), { signal: sig });
    document.getElementById('maker-erase-gen')?.addEventListener('click', live(() => {
      this.cityEditor?.setClearGenerated(true);
      this.applyClearGeneratedVisual();
      this.toast('Generated race path hidden — place Path segments to rebuild.', 4);
    }), { signal: sig });
    document.getElementById('maker-show-gen')?.addEventListener('click', live(() => {
      this.cityEditor?.restoreGenerated();
      this.applyClearGeneratedVisual();
      this.applyEditorGameplay();
      this.toast('Generated race path restored.', 2);
    }), { signal: sig });
    document.getElementById('maker-erase-all')?.addEventListener('click', live(() => {
      if (!window.confirm('Erase all placed Game Maker objects?')) return;
      this.cityEditor?.eraseAll(false);
      this.applyEditorGameplay();
      this.toast('All placed objects erased.', 2);
    }), { signal: sig });
  }

  private refreshMakerPalette() {
    const cats = document.getElementById('maker-cats');
    const vars = document.getElementById('maker-variants');
    if (!cats || !vars || !this.cityEditor) return;
    cats.innerHTML = '';
    vars.innerHTML = '';
    for (const cat of ALL_CATEGORIES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = CATEGORY_LABELS[cat];
      if (this.cityEditor.activeCategory === cat) b.classList.add('active');
      b.addEventListener('click', () => {
        if (!this.cityEditor) return;
        this.cityEditor.activeCategory = cat;
        this.cityEditor.activeVariant = 0;
        this.setMakerTool('place');
        this.refreshMakerPalette();
        this.syncMakerHud();
      });
      cats.appendChild(b);
    }
    const entries = catalogFor(this.cityEditor.activeCategory);
    entries.forEach((entry, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      const num = i + 1;
      b.textContent = num <= 9 ? `${num} ${entry.label}` : entry.label;
      if (this.cityEditor!.activeVariant === entry.variant) b.classList.add('active');
      b.addEventListener('click', () => {
        if (!this.cityEditor) return;
        this.cityEditor.activeCategory = entry.category;
        this.cityEditor.activeVariant = entry.variant;
        this.setMakerTool('place');
        this.refreshMakerPalette();
        this.syncMakerHud();
      });
      vars.appendChild(b);
    });
    document.getElementById('maker-tool-place')?.classList.toggle('active', this.makerTool === 'place');
    document.getElementById('maker-tool-select')?.classList.toggle('active', this.makerTool === 'select');
    document.getElementById('maker-tool-copy')?.classList.toggle('active', this.makerTool === 'copy');
    document.getElementById('maker-tool-city')?.classList.toggle('active', this.makerTool === 'city');
    document.getElementById('maker-scale-uni')?.classList.toggle('active', this.makerScaleAxis === 'uniform');
    document.getElementById('maker-scale-h')?.classList.toggle('active', this.makerScaleAxis === 'horizontal');
    document.getElementById('maker-scale-v')?.classList.toggle('active', this.makerScaleAxis === 'vertical');
    const cityRow = document.getElementById('maker-city-row');
    if (cityRow) cityRow.classList.toggle('hidden', this.makerTool !== 'city');
    const layerEl = document.getElementById('maker-layer-label');
    if (layerEl) {
      if (this.makerTool === 'city' && this.cityBlueprint) {
        layerEl.textContent = `City section · seed ${this.cityBlueprint.seed} · scale ${this.cityGhostScale.toFixed(2)} · Enter confirm · G re-roll`;
      } else {
        const peers = this.cityEditor.countOnLayer(this.makerLayer, this.cityEditor.selectedId);
        layerEl.textContent = `Layer ${this.makerLayer} · y ${layerToY(this.makerLayer).toFixed(1)} · ${peers} peers · ½-story (${LAYER_HEIGHT}u)`;
      }
    }
  }

  /** Returns true if key was consumed by maker edit tools */
  private handleMakerKey(code: string): boolean {
    if (!this.cityEditor || this.makerPaletteOpen) return false;

    // Tool modes (X not S — S is fly-back in WASD)
    if (code === 'KeyP') {
      this.setMakerTool('place');
      return true;
    }
    if (code === 'KeyX') {
      this.setMakerTool('select');
      return true;
    }
    if (code === 'KeyC') {
      this.setMakerTool('copy');
      return true;
    }
    if (code === 'KeyB') {
      this.setMakerTool('city');
      return true;
    }

    // City section preview tools
    if (this.makerTool === 'city') {
      if (code === 'Enter' || code === 'NumpadEnter') {
        this.confirmCitySection();
        return true;
      }
      if (code === 'Space') {
        this.confirmCitySection();
        return true;
      }
      if (code === 'KeyG') {
        this.rerollCitySection();
        return true;
      }
      if (code === 'KeyR') {
        this.cityGhostYaw += Math.PI / 8;
        this.syncCityGhostTransform();
        return true;
      }
      if (code === 'KeyF') {
        this.cityGhostYaw -= Math.PI / 8;
        this.syncCityGhostTransform();
        return true;
      }
      if (code === 'BracketRight' || code === 'Equal' || code === 'NumpadAdd') {
        this.cityGhostScale = Math.min(2.5, this.cityGhostScale * 1.08);
        this.syncCityGhostTransform();
        this.syncMakerHud();
        return true;
      }
      if (code === 'BracketLeft' || code === 'Minus' || code === 'NumpadSubtract') {
        this.cityGhostScale = Math.max(0.4, this.cityGhostScale / 1.08);
        this.syncCityGhostTransform();
        this.syncMakerHud();
        return true;
      }
      if (code === 'PageUp') {
        this.makerLayer++;
        this.syncMakerHud();
        return true;
      }
      if (code === 'PageDown') {
        this.makerLayer--;
        this.syncMakerHud();
        return true;
      }
      return false;
    }

    // Variant hotkeys 1–9 (and 0 = 10th if any)
    const digit = this.digitFromCode(code);
    if (digit != null) {
      this.pickVariantByIndex(digit === 0 ? 9 : digit - 1);
      return true;
    }

    // Scale axis cycle
    if (code === 'KeyZ') {
      this.cycleScaleAxis();
      return true;
    }

    // Primary action (place / move / copy) at look point
    if (code === 'Space') {
      this.makerPrimaryAction();
      return true;
    }

    if (code === 'KeyR') {
      this.cityEditor.rotateSelected(Math.PI / 8);
      return true;
    }
    if (code === 'KeyF') {
      this.cityEditor.rotateSelected(-Math.PI / 8);
      return true;
    }
    if (code === 'BracketRight' || code === 'Equal' || code === 'NumpadAdd') {
      this.cityEditor.scaleSelected(1.1, this.makerScaleAxis);
      return true;
    }
    if (code === 'BracketLeft' || code === 'Minus' || code === 'NumpadSubtract') {
      this.cityEditor.scaleSelected(1 / 1.1, this.makerScaleAxis);
      return true;
    }
    if (code === 'Delete' || code === 'Backspace') {
      this.cityEditor.deleteSelected();
      this.toast('Deleted', 1);
      this.syncMakerHud();
      return true;
    }
    // Instant offset-duplicate (V — D is fly-right in WASD)
    if (code === 'KeyV') {
      this.cityEditor.duplicateSelected();
      this.toast('Duplicated nearby · V', 1);
      return true;
    }
    // Cycle selected variant (G — V is now duplicate)
    if (code === 'KeyG') {
      this.cityEditor.cycleVariant(1);
      this.syncMakerHud();
      return true;
    }
    // Horizontal move when something is selected
    if (code === 'ArrowLeft') {
      this.cityEditor.nudgeSelected(-0.5, 0, 0);
      return true;
    }
    if (code === 'ArrowRight') {
      this.cityEditor.nudgeSelected(0.5, 0, 0);
      return true;
    }
    if (code === 'ArrowUp') {
      this.cityEditor.nudgeSelected(0, 0, -0.5);
      return true;
    }
    if (code === 'ArrowDown') {
      this.cityEditor.nudgeSelected(0, 0, 0.5);
      return true;
    }
    // Half-story layers
    if (code === 'PageUp') {
      const hasSel = !!this.cityEditor.getSelected();
      this.setMakerLayer(this.makerLayer + 1, hasSel);
      return true;
    }
    if (code === 'PageDown') {
      const hasSel = !!this.cityEditor.getSelected();
      this.setMakerLayer(this.makerLayer - 1, hasSel);
      return true;
    }
    // Home = snap active layer to camera height (placement only unless selected)
    if (code === 'Home') {
      this.setMakerLayer(yToLayer(this.camera.position.y - 2), !!this.cityEditor.getSelected());
      return true;
    }
    return false;
  }

  private digitFromCode(code: string): number | null {
    if (code.startsWith('Digit')) {
      const n = Number(code.slice(5));
      if (n >= 0 && n <= 9) return n;
    }
    if (code.startsWith('Numpad')) {
      const n = Number(code.slice(6));
      if (n >= 0 && n <= 9) return n;
    }
    return null;
  }

  private pickVariantByIndex(index: number) {
    if (!this.cityEditor) return;
    const entries = catalogFor(this.cityEditor.activeCategory);
    if (entries.length === 0) return;
    const entry = entries[Math.min(index, entries.length - 1)];
    if (!entry) return;
    this.cityEditor.activeVariant = entry.variant;
    // Numbers always mean "I want this prefab" → place mode
    this.makerTool = 'place';
    this.refreshMakerPalette();
    this.syncMakerHud();
    this.toast(`Place: ${entry.label} (${index + 1})`, 1.2);
  }

  /**
   * Place mode: always place (never select).
   * Select mode: pick object OR move selected to look point.
   * Copy mode: stamp copy of selection at look point.
   */
  private onMakerClick() {
    if (!this.cityEditor) return;
    this.makerRay.setFromCamera(this.makerNd, this.camera);

    if (this.makerTool === 'city') {
      // Click confirms city section at current ghost position
      this.confirmCitySection();
      return;
    }

    if (this.makerTool === 'place') {
      this.placeAtLook();
      return;
    }

    if (this.makerTool === 'copy') {
      this.copyAtLook();
      return;
    }

    // Select / move
    const hitId = this.cityEditor.pick(this.makerRay);
    if (hitId) {
      this.cityEditor.select(hitId);
      const o = this.cityEditor.getSelected();
      if (o) {
        this.makerLayer = yToLayer(o.root.position.y);
        this.cityEditor.highlightLayer(this.makerLayer, o.data.id);
      }
      this.syncMakerHud();
      this.toast('Selected — arrows move · PgUp/Dn layer · Space/LMB empty relocates · V dup', 2.5);
      return;
    }
    // Empty click: move selection if any, else deselect
    if (this.cityEditor.getSelected()) {
      this.moveSelectedAtLook();
    } else {
      this.cityEditor.select(null);
      this.cityEditor.highlightLayer(this.makerLayer, null);
      this.syncMakerHud();
    }
  }

  private makerPrimaryAction() {
    if (this.makerTool === 'city') this.confirmCitySection();
    else if (this.makerTool === 'place') this.placeAtLook();
    else if (this.makerTool === 'copy') this.copyAtLook();
    else if (this.cityEditor?.getSelected()) this.moveSelectedAtLook();
  }

  private placeAtLook() {
    if (!this.cityEditor) return;
    if (this.isBayMakerMode() && this.makerTool === 'city') {
      this.toast('City sections disabled in bay workshop mode.', 2);
      return;
    }
    const pos = this.rayPlacePoint();
    if (!pos) return;
    if (!this.assertBayPlace(pos)) return;
    const yaw = this.lookYaw();
    // Place without forcing tool switch; keep selection off so next place stays clean
    this.cityEditor.placeAt(pos, yaw, false);
    this.cityEditor.highlightLayer(this.makerLayer, null);
    if (this.economyActive) this.rebuildHubNav();
    const net = this.cityEditor.getNetworkStats();
    const netHint =
      net.connections > 0
        ? ` · network ${net.connections} links / ${net.junctions} joins`
        : '';
    this.toast(
      `Placed · L${this.makerLayer} · auto-saved (${this.cityEditor.objects.length})${netHint}`,
      1.4,
    );
    this.applyEditorGameplay();
    this.refreshFallKillY();
    this.syncMakerHud();
  }

  private copyAtLook() {
    if (!this.cityEditor) return;
    if (!this.cityEditor.getSelected()) {
      this.toast('Select an object first (X), then copy with LMB/Space', 2);
      return;
    }
    const pos = this.rayPlacePoint();
    if (!pos) return;
    if (!this.assertBayPlace(pos)) return;
    const yaw = this.lookYaw();
    this.cityEditor.placeCopyAt(pos, yaw);
    this.toast(`Copied · L${this.makerLayer}`, 1);
    this.applyEditorGameplay();
    if (this.economyActive) this.rebuildHubNav();
    this.syncMakerHud();
  }

  private moveSelectedAtLook() {
    if (!this.cityEditor?.getSelected()) return;
    const pos = this.rayPlacePoint();
    if (!pos) return;
    if (!this.assertBayPlace(pos)) return;
    this.cityEditor.moveSelectedTo(pos);
    this.toast(`Moved · L${this.makerLayer}`, 1);
    this.applyEditorGameplay();
    if (this.economyActive) this.rebuildHubNav();
    this.syncMakerHud();
  }

  private lookYaw(): number {
    const d = new THREE.Vector3();
    this.camera.getWorldDirection(d);
    d.y = 0;
    if (d.lengthSq() < 1e-6) return this.makerYaw;
    return Math.atan2(d.x, d.z);
  }

  private rayPlacePoint(): THREE.Vector3 | null {
    this.makerRay.setFromCamera(this.makerNd, this.camera);
    const origin = this.makerRay.ray.origin;
    const dir = this.makerRay.ray.direction;
    // Always place/move on the active half-story layer plane
    const planeY = layerToY(this.makerLayer);
    if (Math.abs(dir.y) > 1e-4) {
      const t = (planeY - origin.y) / dir.y;
      if (t > 0.15 && t < 250) {
        const p = origin.clone().addScaledVector(dir, t);
        p.y = planeY;
        return p;
      }
    }
    // Fallback: point ahead of camera on layer plane
    const d = dir.clone();
    d.y = 0;
    if (d.lengthSq() < 1e-6) d.set(0, 0, 1);
    else d.normalize();
    return new THREE.Vector3(
      this.camera.position.x + d.x * 8,
      planeY,
      this.camera.position.z + d.z * 8,
    );
  }

  private tickGameMaker(dt: number) {
    if (!this.cityEditor) return;
    // Free-fly — no gravity, fast movement
    // Note: S is Select tool — do not use Arrow keys alone for fly; WASD for fly
    // S key is tool switch on keydown only; hold S is not used for fly (KeyS is select hotkey)
    const boost =
      this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 3.2 : 1;
    const speed = 28 * boost;
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const wish = new THREE.Vector3();
    // Fly with WASD only — arrows are reserved for nudging selected objects
    if (this.keys.has('KeyW')) wish.add(forward);
    if (this.keys.has('KeyS')) wish.sub(forward);
    if (this.keys.has('KeyD')) wish.add(right);
    if (this.keys.has('KeyA')) wish.sub(right);
    if (this.keys.has('KeyE')) wish.add(up);
    if (this.keys.has('KeyQ')) wish.sub(up);
    if (wish.lengthSq() > 0) {
      wish.normalize().multiplyScalar(speed * dt);
      this.camera.position.add(wish);
    }
    this.makerYaw = this.lookYaw();
    // City section ghost follows look on active layer
    if (this.makerTool === 'city' && this.cityGhost) {
      const p = this.rayPlacePoint();
      if (p) {
        this.cityGhostPos.copy(p);
        this.syncCityGhostTransform();
      }
      this.cityEditor.updateGhost(null, 0);
    } else if ((this.makerTool === 'place' || this.makerTool === 'copy') && !this.makerPaletteOpen) {
      const p = this.rayPlacePoint();
      this.cityEditor.updateGhost(p, this.makerYaw);
    } else {
      this.cityEditor.updateGhost(null, 0);
    }
    this.animateEditorFx(dt);
    if (this.locEl) {
      this.locEl.textContent =
        this.makerTool === 'city'
          ? `Game Maker · City section preview`
          : `Game Maker · Layer ${this.makerLayer}`;
    }
    this.weaponEl.textContent =
      this.makerTool === 'place'
        ? 'PLACE'
        : this.makerTool === 'select'
          ? 'SELECT'
          : this.makerTool === 'copy'
            ? 'COPY'
            : 'CITY';
    const peers = this.cityEditor.countOnLayer(this.makerLayer, this.cityEditor.selectedId);
    const net = this.cityEditor.getNetworkStats();
    this.statsEl.textContent =
      this.makerTool === 'city' && this.cityBlueprint
        ? `CITY seed ${this.cityBlueprint.seed} · Enter confirm · G re-roll · R/F rot · [/] scale`
        : `${this.cityEditor.objects.length} objs · L${this.makerLayer} · ${peers} peers · path links ${net.connections}`;
  }

  private animateEditorFx(_dt: number) {
    if (!this.cityEditor) return;
    const t = performance.now() * 0.001;
    for (const o of this.cityEditor.objects) {
      if (o.data.category !== 'fountain') continue;
      o.root.traverse((ch) => {
        const m = ch as THREE.Mesh;
        if (!m.isMesh) return;
        if (m.name === 'fountainWater' || (m.material as THREE.MeshStandardMaterial)?.transparent) {
          const mat = m.material as THREE.MeshStandardMaterial;
          if (mat?.opacity != null && mat.transparent) {
            mat.opacity = Math.min(0.75, 0.32 + Math.sin(t * 4 + o.root.position.x) * 0.14);
          }
          if (m.name === 'fountainWater') {
            m.scale.y = 1 + Math.sin(t * 5 + o.root.position.z) * 0.08;
          }
        }
      });
    }
  }

  private applyClearGeneratedVisual() {
    if (!this.raceway || !this.cityEditor) return;
    this.raceway.group.visible = !this.cityEditor.clearGenerated;
  }

  /**
   * Merge editor rails/ramps/fog/path into live raceway gameplay data.
   * Custom path replaces procedural path when clearGenerated and enough points.
   */
  private applyEditorGameplay() {
    if (!this.cityEditor) return;
    this.applyClearGeneratedVisual();
    const exp = this.cityEditor.exportGameplay();

    if (this.raceway) {
      // Snapshot originals once
      if (!this.raceBasePath) {
        this.raceBasePath = this.raceway.path.map((p) => p.clone());
        this.raceBasePathDist = [...this.raceway.pathDist];
        this.raceBaseRails = this.raceway.rails.map((r) => ({
          points: r.points.map((p) => p.clone()),
        }));
        this.raceBaseRamps = this.raceway.ramps.map((r) => ({
          pos: r.pos.clone(),
          yaw: r.yaw,
          len: r.len,
        }));
        this.raceBaseBumps = this.raceway.bumpPoints.map((p) => p.clone());
      }

      const useCustomPath =
        this.cityEditor.clearGenerated && exp.pathPoints.length >= 3;

      if (useCustomPath) {
        this.raceway.path = exp.pathPoints.map((p) => p.clone());
        let acc = 0;
        const dist: number[] = [0];
        for (let i = 1; i < this.raceway.path.length; i++) {
          acc += this.raceway.path[i]!.distanceTo(this.raceway.path[i - 1]!);
          dist.push(acc);
        }
        this.raceway.pathDist = dist;
        this.raceway.totalLength = acc;
        // Path-only rails/ramps from editor when generated cleared
        this.raceway.rails = exp.rails;
        this.raceway.ramps = exp.ramps;
        this.raceway.bumpPoints = exp.bumps;
      } else {
        const baseRails = this.raceBaseRails ?? [];
        const baseRamps = this.raceBaseRamps ?? [];
        const baseBumps = this.raceBaseBumps ?? [];
        if (this.cityEditor.clearGenerated) {
          this.raceway.rails = exp.rails;
          this.raceway.ramps = exp.ramps;
          this.raceway.bumpPoints = exp.bumps;
        } else {
          this.raceway.rails = [
            ...baseRails.map((r) => ({ points: r.points.map((p) => p.clone()) })),
            ...exp.rails,
          ];
          this.raceway.ramps = [
            ...baseRamps.map((r) => ({
              pos: r.pos.clone(),
              yaw: r.yaw,
              len: r.len,
            })),
            ...exp.ramps,
          ];
          this.raceway.bumpPoints = [...baseBumps.map((p) => p.clone()), ...exp.bumps];
        }
        // Restore base path if we had swapped earlier
        if (this.raceBasePath && this.raceBasePathDist && !this.cityEditor.clearGenerated) {
          this.raceway.path = this.raceBasePath.map((p) => p.clone());
          this.raceway.pathDist = [...this.raceBasePathDist];
          this.raceway.totalLength =
            this.raceBasePathDist[this.raceBasePathDist.length - 1] ?? 0;
        }
      }
    }
  }

  private applyFogZones(dt: number) {
    void dt;
    if (!this.cityEditor || this.gameMakerActive) {
      // In maker, keep long draw distance
      if (this.gameMakerActive && this.scene.fog instanceof THREE.Fog) {
        this.scene.fog.near = 20;
        this.scene.fog.far = 400;
      }
      return;
    }
    const fog = this.scene.fog;
    if (!(fog instanceof THREE.Fog)) return;
    const baseNear = this.raceActive ? this.raceFogNear : this.baseFogNear;
    const baseFar = this.raceActive ? this.raceFogFar : this.baseFogFar;
    const exp = this.cityEditor.exportGameplay();
    let far = baseFar;
    let near = baseNear;
    const pos = this.camera.position;
    for (const z of exp.fogZones) {
      const d = pos.distanceTo(z.pos);
      if (d < z.radius) {
        const t = 1 - d / z.radius;
        far = Math.min(far, THREE.MathUtils.lerp(baseFar, z.far, t));
        near = Math.min(near, far * 0.25);
      }
    }
    fog.near = THREE.MathUtils.damp(fog.near, near, 4, Math.min(0.05, dt || 0.016));
    fog.far = THREE.MathUtils.damp(fog.far, far, 4, Math.min(0.05, dt || 0.016));
  }

  setFireHeld(v: boolean) {
    this.fireHeld = v;
  }
  setAltHeld(_v: boolean) {}

  isDisposed() {
    return this.disposed;
  }

  /**
   * Touch look — same YXZ yaw/pitch model as PointerLockControls, without requiring lock.
   * dx/dy are CSS pixels (positive dx looks right, positive dy looks down).
   */
  applyTouchLook(dx: number, dy: number) {
    if (this.disposed || this.paused) return;
    if (this.isEconomyUiOpen() && !this.gameMakerActive) return;
    const sens = 0.0028 * this.lookSensitivity;
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y -= dx * sens;
    this.camera.rotation.x -= dy * sens;
    const lim = Math.PI / 2 - 0.02;
    this.camera.rotation.x = Math.max(-lim, Math.min(lim, this.camera.rotation.x));
  }

  /**
   * Inject a keyboard code from on-screen controls so existing keydown/keyup handlers run.
   */
  injectKey(code: string, down: boolean) {
    if (this.disposed) return;
    const type = down ? 'keydown' : 'keyup';
    const key =
      code === 'Space'
        ? ' '
        : code === 'ShiftLeft' || code === 'ShiftRight'
          ? 'Shift'
          : code === 'Tab'
            ? 'Tab'
            : code.startsWith('Key')
              ? code.slice(3).toLowerCase()
              : code.startsWith('Digit')
                ? code.slice(5)
                : code;
    window.dispatchEvent(
      new KeyboardEvent(type, {
        code,
        key,
        bubbles: true,
        cancelable: true,
      }),
    );
  }

  isPaused() {
    return this.paused;
  }

  setPaused(p: boolean) {
    this.paused = p;
    const menu = document.getElementById('pause-menu');
    const label = document.getElementById('pause-slot-label');
    if (label) {
      const lvl = this.economyActive || this.raceActive
        ? LEVEL_NAMES.sky_city
        : this.gameMakerActive
          ? 'Game Maker'
          : LEVEL_NAMES.workshop;
      const mode = this.gameMakerActive ? ' · maker' : '';
      label.textContent = `Slot ${this.activeSlot + 1} · ${lvl}${mode} · Esc to resume`;
    }
    // Pause menu maker button visibility
    const btnIn = document.getElementById('btn-game-maker');
    const btnOut = document.getElementById('btn-exit-maker');
    if (btnIn) btnIn.classList.toggle('hidden', this.gameMakerActive);
    if (btnOut) btnOut.classList.toggle('hidden', !this.gameMakerActive);

    if (p) {
      if (this.makerPaletteOpen) this.setMakerPaletteOpen(false);
      this.controls.unlock();
      menu?.classList.remove('hidden');
      this.syncLookSensitivityUi();
    } else {
      menu?.classList.add('hidden');
      if (!this.disposed && !this.makerPaletteOpen && !this.mobile.enabled) {
        this.canvas.requestPointerLock();
      }
    }
    this.syncMobileGameplay();
  }

  private static readonly LOOK_SENS_KEY = 'forgeheart-look-sensitivity';

  private loadLookSensitivity() {
    // Mobile default 3× when the player has never set a preference
    let v = this.mobile.enabled ? 3 : 1;
    try {
      const raw = localStorage.getItem(ForgeHeartGame.LOOK_SENS_KEY);
      if (raw != null) {
        const n = Number(raw);
        if (Number.isFinite(n)) v = n;
      }
    } catch {
      /* ignore */
    }
    this.applyLookSensitivity(v, false);
  }

  /** If mobile just enabled and no saved sens, bump to 3× once. */
  private ensureMobileLookDefault() {
    try {
      if (localStorage.getItem(ForgeHeartGame.LOOK_SENS_KEY) != null) return;
    } catch {
      /* ignore */
    }
    this.applyLookSensitivity(3, true);
  }

  private applyLookSensitivity(v: number, persist = true) {
    this.lookSensitivity = Math.max(0.5, Math.min(3, Math.round(v * 10) / 10));
    this.controls.pointerSpeed = this.lookSensitivity;
    if (persist) {
      try {
        localStorage.setItem(ForgeHeartGame.LOOK_SENS_KEY, String(this.lookSensitivity));
      } catch {
        /* ignore */
      }
    }
    this.syncLookSensitivityUi();
  }

  private syncLookSensitivityUi() {
    const slider = document.getElementById('look-sens-slider') as HTMLInputElement | null;
    const val = document.getElementById('look-sens-val');
    if (slider) slider.value = String(this.lookSensitivity);
    if (val) val.textContent = `${this.lookSensitivity.toFixed(1)}×`;
  }

  private wireLookSensitivityUi() {
    const slider = document.getElementById('look-sens-slider') as HTMLInputElement | null;
    if (!slider || this.disposed) return;
    const onChange = () => {
      if (this.disposed) return;
      const n = Number(slider.value);
      if (Number.isFinite(n)) this.applyLookSensitivity(n);
    };
    slider.addEventListener('input', onChange, { signal: this.sessionAbort.signal });
    slider.addEventListener('change', onChange, { signal: this.sessionAbort.signal });
    this.syncLookSensitivityUi();
  }

  /** Public toast for main.ts save button */
  toastPublic(t: string, sec = 2) {
    this.toast(t, sec);
  }

  private setHelp(t: string) {
    if (!this.helpEl) return;
    this.helpEl.textContent = this.mobile.enabled ? this.mobileHelpText(t) : t;
  }

  /**
   * Keep on-screen controls visible through workshop → market tutorial → empire.
   * Dim stick/look/actions only while pause or a blocking panel owns the screen.
   */
  private syncMobileGameplay() {
    if (!this.mobile.enabled) return;
    this.mobile.setVisible(true);
    const blocked =
      this.paused ||
      this.disposed ||
      this.harvestOpen ||
      this.cityMapOpen ||
      this.makerPaletteOpen ||
      this.isEconomyUiOpen();
    this.mobile.setGameplayActive(!blocked);
    this.mobile.syncBoardButtons();
  }

  /** Phase-aware help when touch controls are active. */
  private mobileHelpText(fallback: string): string {
    // Keep proximity / map prompts readable — rewrite E → Tap
    if (fallback.startsWith('E ·')) {
      return `Tap · ${fallback.slice(3)}`;
    }
    if (fallback.startsWith('Map ·') || fallback.startsWith('Loading')) {
      return fallback;
    }
    if (this.gameMakerActive) {
      return 'Stick fly · drag look · Pause · tools in pause menu';
    }
    if (this.board?.mounted) {
      return this.boardCamMode === 'first'
        ? 'Stick ride · Jump · Slide · Board stow · Cam · Pause'
        : 'Stick ride · Jump · Slide · Board stow · Cam · Pause';
    }
    if (this.megaCityActive) {
      return this.boardOwned || this.inv.playerBoard.owned
        ? 'Stick · look · tap · Board · Bay · compass map · Jump · Pause'
        : 'Stick · look · tap · Bay · compass map · Jump · Pause';
    }
    if (this.economyActive) {
      return this.boardOwned || this.inv.playerBoard.owned
        ? 'Stick · look · tap · Board · Bay · Jump · Pause'
        : 'Stick · look · tap · Bay · Jump · Pause';
    }
    return 'Stick · look · tap to interact · Attack (hold swap) · Jump · Pause';
  }

  /** Cycle unlocked weapons from the Attack long-press. */
  cycleMobileWeapon() {
    if (this.disposed || this.board?.mounted) return;
    type W = 'hand' | 'wrench' | 'board';
    const opts: W[] = ['hand'];
    if (this.wrenchUnlocked) opts.push('wrench');
    if (this.boardOwned || this.inv.playerBoard.owned) opts.push('board');
    const cur = this.weapon as W;
    const i = Math.max(0, opts.indexOf(cur));
    const next = opts[(i + 1) % opts.length]!;
    this.weapon = next;
    this.syncWeaponHud();
    const label = next === 'hand' ? 'Hand' : next === 'wrench' ? 'Arc Wrench' : 'Board';
    this.toast(`Weapon · ${label}`, 1.4);
  }

  /** Empire map toggle from compass / mobile host. */
  toggleCityMapFromMobile() {
    if (this.disposed || !this.megaCityActive || this.gameMakerActive) return;
    if (this.cityMapOpen) {
      this.closeCityMap();
      return;
    }
    if (
      this.harvestOpen ||
      this.craftOpen ||
      this.bayOpen ||
      this.boardShopOpen ||
      this.programOpen ||
      this.stallOpen ||
      this.activeVendor
    ) {
      return;
    }
    this.openCityMap();
  }

  private wireNavCompassTap() {
    const el = document.getElementById('nav-compass');
    if (!el || this.disposed) return;
    el.addEventListener(
      'pointerdown',
      (ev) => {
        if (!this.mobile.enabled || this.disposed) return;
        ev.preventDefault();
        ev.stopPropagation();
        this.toggleCityMapFromMobile();
      },
      { signal: this.sessionAbort.signal },
    );
  }

  /** Floating Tap badge over the current proximity interactable. */
  private syncMobileTapAffordance() {
    if (!this.mobile.enabled) {
      this.mobile.setTapAffordance(null);
      return;
    }
    const target = this.currentInteractWorldPos();
    if (!target) {
      this.mobile.setTapAffordance(null);
      return;
    }
    const ndc = target.clone().project(this.camera);
    if (ndc.z > 1 || ndc.z < -1 || Math.abs(ndc.x) > 1.15 || Math.abs(ndc.y) > 1.15) {
      this.mobile.setTapAffordance(null);
      return;
    }
    const app = document.getElementById('app');
    const w = app?.clientWidth ?? this.canvas.clientWidth;
    const h = app?.clientHeight ?? this.canvas.clientHeight;
    const x = (ndc.x * 0.5 + 0.5) * w;
    const y = (-ndc.y * 0.5 + 0.5) * h;
    this.mobile.setTapAffordance({ x, y, label: 'Tap' });
  }

  private currentInteractWorldPos(): THREE.Vector3 | null {
    if (this.megaCityActive && this.cityInteractPrompt) {
      return this.cityInteractPrompt.position.clone().add(new THREE.Vector3(0, 1.2, 0));
    }
    if (this.economyActive && this.hubInteractPrompt) {
      return this.hubInteractPrompt.position.clone().add(new THREE.Vector3(0, 1.2, 0));
    }
    if (!this.megaCityActive && !this.economyActive && !this.raceActive) {
      const pos = this.camera.position;
      let best: { p: THREE.Vector3; d: number } | null = null;
      for (const it of this.interactables) {
        if (it.opened) continue;
        if (it.type === 'tray' && (!this.brotherScrapped || !it.mesh.visible)) continue;
        if (it.type === 'wrench_pickup' && (!it.mesh.visible || this.wrenchUnlocked)) continue;
        if (it.type === 'boat' && this.tutorial !== 'escape' && this.tutorial !== 'breach') continue;
        const d = it.position.distanceTo(pos);
        if (d <= it.radius + 0.4 && (!best || d < best.d)) {
          best = { p: it.position.clone().add(new THREE.Vector3(0, 0.9, 0)), d };
        }
      }
      return best?.p ?? null;
    }
    return null;
  }

  private wireHarvestTouchUi() {
    const sig = this.sessionAbort.signal;
    const extract = document.getElementById('harvest-extract');
    const cancel = document.getElementById('harvest-cancel');
    extract?.addEventListener(
      'click',
      (e) => {
        e.preventDefault();
        if (this.disposed || !this.harvestOpen) return;
        const inZone = this.harvestNeedle >= 55 && this.harvestNeedle <= 75;
        this.closeHarvest(inZone);
      },
      { signal: sig },
    );
    cancel?.addEventListener(
      'click',
      (e) => {
        e.preventDefault();
        if (this.disposed || !this.harvestOpen) return;
        this.closeHarvest(false);
      },
      { signal: sig },
    );
  }

  private toggleBoardCamera() {
    this.boardCamMode = this.boardCamMode === 'third' ? 'first' : 'third';
    this.syncBoardRiderVisibility();
    this.persistBoardCamMode();
    this.toast(
      this.boardCamMode === 'first'
        ? 'Camera: first person (on the board)'
        : 'Camera: third person (chase)',
      2,
    );
    this.applyBoardCamHelp();
  }

  /** Engineer only when mounted + third-person */
  private syncBoardRiderVisibility() {
    if (!this.board) return;
    this.board.setRiderVisible(this.board.mounted && this.boardCamMode === 'third');
  }

  private persistBoardCamMode() {
    // Write into active slot so continue / remount keeps the choice
    const data = this.buildSaveData();
    writeSlot(this.activeSlot, data);
  }

  private applyBoardCamHelp() {
    if (!this.board?.mounted) return;
    this.setHelp(
      this.boardCamMode === 'first'
        ? 'FP · W/S · A/D · Shift slide · Space jump · Tab 3rd person · E dismount (slow)'
        : '3rd · W/S · A/D · Shift slide · Space jump · Tab 1st person · E dismount (slow)',
    );
  }

  /** Build snapshot for the active slot (named by current level). */
  buildSaveData(): ForgeSaveData {
    const levelId: LevelId = this.megaCityActive
      ? 'mega_city'
      : this.economyActive || this.raceActive
        ? 'sky_city'
        : 'workshop';
    const phase = this.tutorial as TutorialPhaseSave;
    // Sync workshop brass into inv when in economy
    if (this.economyActive || this.megaCityActive) {
      this.inv.brass = Math.max(this.inv.brass, this.brass);
    }
    this.syncBoardOwnership();
    return {
      version: 1,
      levelId,
      levelName: LEVEL_NAMES[levelId],
      savedAt: Date.now(),
      health: this.health,
      plasma: this.plasma,
      brass: this.economyActive || this.megaCityActive ? this.inv.brass : this.brass,
      gears: this.gears,
      wrenchUnlocked: this.wrenchUnlocked,
      bringElias: this.bringEliasToRace || this.hadAllyOnce,
      tutorialPhase:
        this.megaCityActive || this.economyActive || this.raceActive ? 'city' : phase,
      raceCheckpoint: this.checkpointIdx,
      raceFinished: this.raceFinished,
      boardCamMode: this.boardCamMode,
      boardOwned: this.boardOwned || this.inv.playerBoard.owned,
      economy: invToSave(this.inv),
      backstorySeed: this.backstory?.seed,
    };
  }

  private syncWeaponHud() {
    if (this.raceActive && this.board?.mounted) return;
    if (this.weapon === 'board') this.weaponEl.textContent = 'SURFBOARD';
    else if (this.weapon === 'wrench') this.weaponEl.textContent = this.wrenchUnlocked ? 'ARC WRENCH' : 'HAND ONLY';
    else this.weaponEl.textContent = 'REPROGRAM HAND';
  }

  saveProgress() {
    const data = this.buildSaveData();
    writeSlot(this.activeSlot, data);
    this.toast(`Saved · Slot ${this.activeSlot + 1} · ${data.levelName}`, 2.5);
  }

  dispose() {
    this.disposed = true;
    this.paused = false;
    this.gameMakerActive = false;
    this.megaCityActive = false;
    this.economyActive = false;
    this.raceActive = false;
    this.keys.clear();
    this.mobile.detach();
    this.hubInteractPrompt = null;
    this.cityInteractPrompt = null;
    this.activeVendor = null;
    // Close all HTML panels so the next session doesn't inherit bay/market UI
    this.forceCloseAllUiPanels();
    this.clearCityGhost();
    this.floatingCity = null;
    this.setMakerPaletteOpen(false);
    this.syncMakerHud();
    this.hideNavCompass();
    // Drop all window/canvas/DOM listeners for this instance
    try {
      this.sessionAbort.abort();
    } catch {
      /* ignore */
    }
    // Kill music / wind / board loops so title→play never double-stacks audio
    try {
      this.audio.stop();
    } catch {
      /* ignore */
    }
    try {
      this.controls.unlock();
    } catch {
      /* ignore */
    }
    try {
      this.renderer.dispose();
    } catch {
      /* ignore */
    }
  }

  /** Hard-hide economy/maker HTML so a disposed session can't leave bay panel open. */
  private forceCloseAllUiPanels() {
    this.bayOpen = false;
    this.craftOpen = false;
    this.boardShopOpen = false;
    this.programOpen = false;
    this.stallOpen = false;
    this.harvestOpen = false;
    this.cityMapOpen = false;
    this.cityMapSelectedId = null;
    this.cityMapCam = null;
    this.cityMapDrag = null;
    this.activeVendor = null;
    const ids = [
      'bay-panel',
      'craft-panel',
      'market-panel',
      'board-panel',
      'program-panel',
      'stall-panel',
      'harvest-overlay',
      'shop-panel',
      'maker-palette',
      'maker-hud',
      'nav-compass',
      'city-map-panel',
      'pause-menu',
    ];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.classList.add('hidden');
      el.setAttribute('aria-hidden', 'true');
    }
  }

  async start() {
    await this.audio.resume();

    // New game: seed empty save on slot
    if (!this.pendingLoad) {
      writeSlot(this.activeSlot, emptySave('workshop'));
      this.flash('The Workshop — Elias waits on the bench');
      this.toast(
        'Your brother is gone. The frame holds a talisman of his. Walk the lab. Read. Then use the Hand (1) to wake him — not scrap (E).',
        8,
      );
      this.controls.lock();
      return;
    }

    const s = this.pendingLoad;
    this.health = s.health;
    this.plasma = s.plasma;
    this.brass = s.brass;
    this.gears = s.gears;
    this.wrenchUnlocked = s.wrenchUnlocked;
    this.bringEliasToRace = s.bringElias;
    this.hadAllyOnce = s.bringElias;
    this.boardOwned = !!s.boardOwned;
    // Economy blob may lag the top-level flag (and vice versa) — unify
    if (s.economy?.playerBoard?.owned) this.boardOwned = true;

    if (s.levelId === 'mega_city') {
      this.flash(`Continue — ${LEVEL_NAMES.mega_city}`);
      this.toast('Returning to your sky apartment…', 3);
      this.enterMegaCity(s);
      return;
    }
    if (
      s.levelId === 'sky_city' ||
      s.levelId === 'sky_race' ||
      s.tutorialPhase === 'race' ||
      s.tutorialPhase === 'city' ||
      s.tutorialPhase === 'won'
    ) {
      // Deed holders may prefer full city — load market training (ferry to city)
      this.flash(`Continue — ${LEVEL_NAMES.sky_city}`);
      this.toast(`Loading ${s.levelName}…`, 3);
      this.enterSkyCity(s);
      return;
    }

    // Workshop continue — restore gear; open late-game states if needed
    const phase = s.tutorialPhase;
    if (phase === 'breach' || phase === 'escape' || phase === 'siege' || phase === 'rebuild' || phase === 'explore') {
      this.tutorial = phase === 'rebuild' ? 'rebuild' : phase === 'explore' ? 'explore' : phase;
    } else {
      this.tutorial = 'explore';
    }
    if (s.wrenchUnlocked) {
      for (const it of this.interactables) {
        if (it.type === 'wrench_pickup') {
          it.mesh.visible = true;
          it.opened = false;
        }
      }
    }
    if (phase === 'breach' || phase === 'escape') {
      this.tutorial = 'siege';
      this.breachDoor('forced');
      if (phase === 'escape') {
        this.tutorial = 'escape';
        this.objective = 'Reach the escape skiff on the sky dock';
      }
    } else if (phase === 'siege') {
      this.beginSiege();
    }

    this.flash(`Continue — ${s.levelName}`);
    this.toast(`Slot ${this.activeSlot + 1} · ${s.levelName}. Esc to save.`, 4);
    this.controls.lock();
  }

  update(_dtExternal?: number) {
    if (this.disposed) return;
    // Keep touch controls present in workshop, market tutorial, and empire
    if (this.mobile.enabled) this.syncMobileGameplay();
    const dt = Math.min(0.05, this.clock.getDelta());
    if (this.paused) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    // won freezes only the brief skiff cinematic before race loads
    if (this.won && !this.raceActive) {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    this.msgT -= dt;
    this.atkCd = Math.max(0, this.atkCd - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.audio.tickWhooshCd(dt);

    this.autosaveT += dt;
    if (this.autosaveT > 45) {
      this.autosaveT = 0;
      writeSlot(this.activeSlot, this.buildSaveData());
    }

    // Game Maker free-fly — skips normal gameplay physics
    if (this.gameMakerActive) {
      this.tickGameMaker(dt);
      this.applyFogZones(dt);
      this.hpFill.style.width = `${this.health}%`;
      this.plasmaFill.style.width = `${this.plasma}%`;
      this.renderer.render(this.scene, this.camera);
      this.drawOverlay();
      return;
    }

    this.applyFogZones(dt);

    if (this.megaCityActive) {
      this.tickMegaCity(dt);
    } else if (this.economyActive) {
      this.tickSkyCity(dt);
    } else if (this.raceActive) {
      this.tickRace(dt);
    } else {
      this.tickAllyPower(dt);
      this.tickTutorial(dt);
      this.updateInteractPrompts();
      // Wind swells when outside the lab door (z past ~8)
      const outdoor = Math.max(0, Math.min(1, (this.camera.position.z - 7.5) / 6));
      this.audio.setWind(outdoor);

      // Movement relative to camera yaw
      const forward = new THREE.Vector3();
      this.camera.getWorldDirection(forward);
      forward.y = 0;
      forward.normalize();
      const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

      const wish = new THREE.Vector3();
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) wish.add(forward);
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) wish.sub(forward);
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) wish.add(right);
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) wish.sub(right);
      if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(MOVE_SPEED);

      this.velocity.x = wish.x;
      this.velocity.z = wish.z;
      this.velocity.y -= GRAVITY * dt;

      if ((this.keys.has('Space') || this.keys.has('KeyJ')) && this.onGround) {
        this.velocity.y = JUMP_VEL;
        this.onGround = false;
      }

      this.moveWithCollision(dt);

      if (this.fireHeld || this.keys.has('ControlLeft')) this.tryFire();

      this.updateRobots(dt);
      this.updateBolts(dt);
      this.updateBlasts(dt);
      this.updateArcVisual(dt);
      this.checkExit();
    }

    // HUD
    this.hpFill.style.width = `${this.health}%`;
    this.plasmaFill.style.width = `${this.plasma}%`;
    const pct = document.getElementById('resolve-pct');
    if (pct) pct.textContent = String(Math.round(this.health));
    if (this.economyActive) {
      this.syncEconomyHud();
    } else if (this.raceActive && this.board?.mounted) {
      const sp = Math.round(this.board.speed);
      const max = BOARD.maxSpeed;
      let mode = 'SKY SURF';
      if (this.board.isGrinding()) {
        const b = this.board.grindBalance;
        const pct = Math.round(Math.abs(b) * 100);
        const side = b < -0.08 ? '◀' : b > 0.08 ? '▶' : '●';
        mode = `GRIND ${side}${pct}`;
      } else if (this.board.isPowersliding()) {
        mode = `SLIDE ${Math.round(this.board.slideCharge * 100)}%`;
      }
      this.weaponEl.textContent = mode;
      this.statsEl.textContent = `${this.objective} · ${sp}/${max} u/s`;
      if (this.locEl) this.locEl.textContent = 'Sky City · Racetrack';
    } else if (this.raceActive) {
      this.weaponEl.textContent = 'SKY CITY';
      this.statsEl.textContent = this.objective;
      if (this.locEl) this.locEl.textContent = 'Sky City';
    } else {
      this.weaponEl.textContent =
        this.weapon === 'hand'
          ? 'REPROGRAM HAND'
          : this.wrenchUnlocked
            ? 'ARC WRENCH'
            : 'HAND ONLY';
      const allies = this.countPoweredAllies();
      const eq = this.plasmaEquilibrium(allies);
      const net = this.plasmaNetPerSec(allies);
      const nearEq = Math.abs(this.plasma - eq) < 1.5;
      const rateLabel =
        allies === 0
          ? 'PLASMA STEADY'
          : nearEq
            ? `EQ ${eq}%`
            : `${net >= 0 ? '+' : ''}${net.toFixed(1)}/s →${eq}%`;
      this.statsEl.textContent = `${this.objective} · ${rateLabel}`;
      if (this.locEl) {
        const z = this.camera.position.z;
        this.locEl.textContent =
          z > 9 ? 'Sky Docks · Escape' : 'Voss Workshop · Tutorial';
      }
    }

    if (this.msgT > 0) {
      // drawn via toast element for plaques; on-canvas for short msgs in render
    }

    this.syncMobileTapAffordance();
    this.renderer.render(this.scene, this.camera);
    // overlay messages
    this.drawOverlay();
  }

  /** Compatibility with main loop that calls render separately */
  render() {
    // rendering happens in update for Three.js
    if (!this.clock.running) this.renderer.render(this.scene, this.camera);
  }

  private drawOverlay() {
    // Use convert toast for big messages
    if (this.msgT > 0 && this.msg) {
      // keep lightweight — toast element
    }
  }

  /**
   * Robust character collision:
   * - Cap fall speed
   * - Fixed substeps (prevents tunneling)
   * - Sweep per axis with full body AABB
   * - Ground snap to highest surface under feet
   * - Void rescue to last safe position
   */
  private moveWithCollision(dt: number) {
    // Terminal velocity — limits how far we can tunnel in one frame
    this.velocity.y = Math.max(this.velocity.y, -22);

    const maxStep = 1 / 120;
    const steps = Math.max(1, Math.min(10, Math.ceil(dt / maxStep)));
    const sdt = dt / steps;

    for (let s = 0; s < steps; s++) {
      this.physicsSubstep(sdt);
    }

    this.snapToGround(0.45);

    // Remember safe standing spots
    if (this.onGround) {
      this.safeTimer += dt;
      if (this.safeTimer > 0.15) {
        this.safePos.copy(this.camera.position);
      }
    } else {
      this.safeTimer = 0;
    }

    // Fell through the world
    const killY = this.economyActive || this.raceActive ? this.fallKillY : -2;
    if (this.camera.position.y < killY) {
      this.camera.position.copy(this.safePos);
      this.velocity.set(0, 0, 0);
      this.onGround = true;
      // Only toast if we actually fell a meaningful distance
      if (this.safePos.y - killY > 3) {
        this.toast('Brass gods catch you — restored to solid ground.', 2);
      }
    }
  }

  private playerAabb(pos: THREE.Vector3): { min: THREE.Vector3; max: THREE.Vector3 } {
    const feet = pos.y - PLAYER_H * 0.9;
    const head = pos.y + 0.15;
    return {
      min: new THREE.Vector3(pos.x - PLAYER_R, feet, pos.z - PLAYER_R),
      max: new THREE.Vector3(pos.x + PLAYER_R, head, pos.z + PLAYER_R),
    };
  }

  /** Walkable on foot? Skyways are board-only wind paths. */
  private isWalkFloor(c: Collider): boolean {
    if (c.kind === 'skyway') return false;
    if (c.kind === 'floor') return true;
    if (c.kind === 'solid') return false;
    // Legacy workshop floors: thick underside (colH ~0.85) but low top surface
    const h = c.max.y - c.min.y;
    if (h <= 1.1 && c.max.y < 2.2) return true;
    // Very thin slabs
    return h <= 0.55;
  }

  /** Board can ride island decks + glowing skyways between islands. */
  private isBoardFloor(c: Collider): boolean {
    if (c.kind === 'skyway' || c.kind === 'floor') return true;
    if (c.kind === 'solid') return false;
    return this.isWalkFloor(c);
  }

  private physicsSubstep(dt: number) {
    const pos = this.camera.position;

    const resolveAxis = (axis: 'x' | 'y' | 'z') => {
      const delta = this.velocity[axis] * dt;
      if (Math.abs(delta) < 1e-8) return;
      pos[axis] += delta;

      let { min, max } = this.playerAabb(pos);
      for (const c of this.colliders) {
        // Wind skyways: board-only — walkers fall/pass through completely
        if (c.kind === 'skyway') continue;
        if (!aabbOverlap(min, max, c.min, c.max)) continue;
        const floor = this.isWalkFloor(c);

        if (axis === 'y') {
          if (delta < 0) {
            // Land on floors / low tops — skip tall walls
            if (!floor) continue;
            // Only land if feet are near the top (not tunneling from far above)
            const feet = pos.y - PLAYER_H * 0.9;
            if (feet > c.max.y + 0.5) continue;
            pos.y = c.max.y + PLAYER_H * 0.9 + 0.002;
            this.velocity.y = 0;
            this.onGround = true;
          } else {
            // Ceiling — solids / thick only
            if (floor) continue;
            pos.y = c.min.y - 0.16;
            this.velocity.y = Math.min(0, this.velocity.y);
          }
          min = this.playerAabb(pos).min;
          max = this.playerAabb(pos).max;
        } else if (axis === 'x') {
          // Floors never block horizontal movement
          if (floor) continue;
          const feet = pos.y - PLAYER_H * 0.9;
          const onTop = feet >= c.max.y - 0.08 && feet <= c.max.y + 0.35;
          if (onTop && this.velocity.y <= 0) continue;
          if (delta > 0) pos.x = c.min.x - PLAYER_R - 0.002;
          else pos.x = c.max.x + PLAYER_R + 0.002;
          this.velocity.x = 0;
          min = this.playerAabb(pos).min;
          max = this.playerAabb(pos).max;
        } else {
          if (floor) continue;
          const feet = pos.y - PLAYER_H * 0.9;
          const onTop = feet >= c.max.y - 0.08 && feet <= c.max.y + 0.35;
          if (onTop && this.velocity.y <= 0) continue;
          if (delta > 0) pos.z = c.min.z - PLAYER_R - 0.002;
          else pos.z = c.max.z + PLAYER_R + 0.002;
          this.velocity.z = 0;
          min = this.playerAabb(pos).min;
          max = this.playerAabb(pos).max;
        }
      }
    };

    // Only clear grounded when actually falling / jumping
    if (this.velocity.y > 0.5) this.onGround = false;
    if (this.velocity.y < -0.5) this.onGround = false;

    resolveAxis('x');
    resolveAxis('z');
    resolveAxis('y');
  }

  /**
   * Place feet on the highest walkable surface under the player.
   */
  private snapToGround(snapDist: number) {
    const pos = this.camera.position;
    const feetY = pos.y - PLAYER_H * 0.9;
    const r = PLAYER_R * 0.75;
    let bestTop = -Infinity;
    let found = false;

    for (const c of this.colliders) {
      if (!this.isWalkFloor(c)) continue;
      if (pos.x + r < c.min.x || pos.x - r > c.max.x) continue;
      if (pos.z + r < c.min.z || pos.z - r > c.max.z) continue;
      const top = c.max.y;
      if (top <= feetY + 0.15 && top >= feetY - snapDist) {
        if (top > bestTop) {
          bestTop = top;
          found = true;
        }
      }
    }

    if (found && this.velocity.y <= 0.5) {
      pos.y = bestTop + PLAYER_H * 0.9 + 0.002;
      if (this.velocity.y < 0) this.velocity.y = 0;
      this.onGround = true;
    }
  }

  private tryFire() {
    if (this.atkCd > 0) return;
    // Race: click deploys owned board when weapon slot selected
    if (this.weapon === 'board' && this.boardOwned && this.raceActive && !this.board?.mounted) {
      this.mountBoardHere(false);
      this.atkCd = 0.25;
      return;
    }
    if (this.weapon === 'wrench') {
      if (!this.wrenchUnlocked) {
        this.toast('You only have the Hand for now.');
        this.weapon = 'hand';
        return;
      }
      this.atkCd = 0.36;
      this.plasma = Math.max(0, this.plasma - ROBOT.arcPlasmaCost);
      this.spawnArcFx();
      const origin = this.camera.position.clone();
      const dir = new THREE.Vector3();
      this.camera.getWorldDirection(dir);
      // Optional: force the lab door open early during the siege
      if (this.tryBashLabDoor(origin, dir)) return;
      for (const r of this.robots) {
        if (r.phase !== 'active') continue;
        const to = r.position.clone().add(new THREE.Vector3(0, 1, 0)).sub(origin);
        const dist = to.length();
        if (dist > 2.5 || dist < 0.01) continue;
        to.normalize();
        if (to.dot(dir) < 0.52) continue;
        const res = r.applyArc(ROBOT.arcDamage, ROBOT.scramblePerHit);
        if (res === 'disabled') {
          this.flash('KNOCKED OUT — eyes dark. Hand reprogram or E scrap');
        } else if (res === 'scrambled') {
          this.flash('SCRAMBLE FULL — Hand (1) to rewrite while it still walks');
        }
      }
    } else {
      // Reprogram: scrambled OR disabled
      let best: RobotUnit | null = null;
      let bestD = 2.6;
      for (const r of this.robots) {
        if (!r.reprogramReady) continue;
        const d = r.position.distanceTo(this.camera.position);
        if (d < bestD) {
          best = r;
          bestD = d;
        }
      }
      if (!best) {
        this.atkCd = 0.35;
        this.toast(
          this.tutorial === 'explore' || this.tutorial === 'rebuild'
            ? 'Stand close to the deactivated frame. Click with Hand (1) to wake a soul.'
            : 'Need a scramble-full or knocked-out frame nearby.',
        );
        return;
      }
      const allyCount = this.countPoweredAllies();
      if (allyCount >= ROBOT.maxAllies) {
        this.atkCd = 0.35;
        this.toast(`Power grid full — only ${ROBOT.maxAllies} allies.`);
        return;
      }
      const reprogramCost = best.isBrother ? 12 : 16;
      if (this.plasma < reprogramCost) {
        this.atkCd = 0.35;
        this.toast(`Need ${reprogramCost} plasma (have ${Math.floor(this.plasma)}).`);
        return;
      }
      this.atkCd = 0.5;
      this.plasma -= reprogramCost;
      best.setPhase('ally');
      best.returning = false;
      best.vy = 0;
      best.onGround = true;
      this.audio.playReprogram();
      if (best.isBrother) {
        this.flash('ELIAS — the talisman finds him. Green eyes. Your brother.');
        this.toast('Plasma will settle near three-quarters with one ally. Stay close to him.', 5);
      } else {
        const eq = this.plasmaEquilibrium(allyCount + 1);
        this.flash(`REPROGRAMMED · grid settles ~${eq}%`);
      }
      this.onAllyCreated();
    }
  }

  private onAllyCreated() {
    if (this.hadAllyOnce) return;
    this.hadAllyOnce = true;
    this.bringEliasToRace = true;
    if (this.tutorial === 'explore' || this.tutorial === 'rebuild') {
      this.beginSiege();
    }
  }

  private beginSiege() {
    this.tutorial = 'siege';
    this.bangCount = 0;
    this.bangTimer = 1.2;
    this.doorHp = this.doorHpMax;
    this.audio.setTension(0.55);
    this.objective = 'Something is at the door…';
    this.setHelp('Grab Arc Wrench (E) · wait out the bangs — or bash the door open with 2');
    this.flash('A BANG at the lab door —');
    this.toast(
      'Demon-ridden frames. Hold the workshop — or take the Arc Wrench and force the door open early.',
      5,
    );
    // Reveal wrench on the rack
    for (const it of this.interactables) {
      if (it.type === 'wrench_pickup') {
        it.mesh.visible = true;
        if (it.prompt) it.prompt.visible = true;
      }
    }
  }

  /**
   * Arc the sealed lab door during siege. Returns true if the swing hit the door.
   * Enough hits force a breach without waiting for all outside bangs.
   */
  private tryBashLabDoor(origin: THREE.Vector3, dir: THREE.Vector3): boolean {
    if (this.tutorial !== 'siege') return false;
    // Intersect ray with door plane (z ≈ 8)
    const doorZ = this.level.anchors.doorSpot.z;
    if (Math.abs(dir.z) < 0.08) return false;
    const t = (doorZ - origin.z) / dir.z;
    if (t < 0.35 || t > 3.4) return false;
    const hit = origin.clone().addScaledVector(dir, t);
    // Door opening bounds (must face the seal, not side walls)
    if (Math.abs(hit.x) > 2.55) return false;
    if (hit.y < 0.15 || hit.y > 3.4) return false;
    // Prefer swinging from inside the lab
    if (origin.z > doorZ + 0.4) return false;

    this.doorHp = Math.max(0, this.doorHp - 1);
    this.audio.playBang(0.45 + (1 - this.doorHp / this.doorHpMax) * 0.5);
    // Visual rattle
    for (const m of this.level.labDoor.meshes) {
      m.position.x += (Math.random() - 0.5) * 0.08;
      m.position.z += (Math.random() - 0.5) * 0.03;
    }

    if (this.doorHp <= 0) {
      this.flash('DOOR BREACHED — you forced it open!');
      this.toast('The seal yields to the arc. Whatever was banging is coming through.', 4);
      this.breachDoor('forced');
      return true;
    }

    const left = this.doorHp;
    this.objective = `Bash the door · ${this.doorHpMax - left}/${this.doorHpMax} arc hits`;
    this.toast(
      left === 1
        ? 'Door almost broken — one more arc!'
        : `Iron rings under the wrench — ${left} hits left.`,
      2,
    );
    return true;
  }

  private tickTutorial(dt: number) {
    if (this.tutorial === 'siege') {
      this.bangTimer -= dt;
      if (this.bangTimer <= 0) {
        this.bangCount++;
        this.bangTimer = this.bangInterval;
        const intensity = 0.55 + (this.bangCount / this.bangsTotal) * 0.55;
        this.audio.playBang(intensity);
        this.audio.setTension(0.4 + (this.bangCount / this.bangsTotal) * 0.6);
        // Rattle door meshes
        for (const m of this.level.labDoor.meshes) {
          m.position.x += (Math.random() - 0.5) * 0.04 * intensity;
        }
        if (this.bangCount === 1) {
          this.toast('BANG. The iron door shudders.', 2);
        } else if (this.bangCount === 5) {
          this.toast('Five strikes. Take the Arc Wrench from the rack (E).', 4);
          this.objective = 'Take the Arc Wrench (E) — the door is failing';
        } else if (this.bangCount === 8) {
          this.toast('Almost through — stand ready with Elias.', 3);
        }
        if (this.bangCount >= this.bangsTotal) {
          this.breachDoor();
        } else {
          this.objective = `Door under assault · ${this.bangCount}/${this.bangsTotal}`;
        }
      }
    }

    if (this.tutorial === 'breach' || this.tutorial === 'escape') {
      const hostiles = this.robots.filter((r) => r.phase === 'active' && r.mesh.visible).length;
      if (hostiles === 0 && this.tutorial === 'breach') {
        this.tutorial = 'escape';
        this.objective = 'Reach the escape skiff on the sky dock';
        this.setHelp('Follow the walkway · E on boat controls to cast off');
        this.flash('Demons down — get to the boat!');
        this.toast('Outside: a floating city. The skiff waits at the end of the brass walkway.', 5);
        this.audio.setTension(0.15);
      }
    }
  }

  private breachDoor(reason: 'timer' | 'forced' = 'timer') {
    if (this.tutorial !== 'siege') return; // already open / not in siege
    this.tutorial = 'breach';
    this.doorHp = 0;
    this.audio.setTension(1);
    this.audio.playBang(1.2);
    // Remove door collision + hide meshes
    for (const m of this.level.labDoor.meshes) {
      m.visible = false;
      m.position.y = -40;
    }
    const doorSet = new Set(this.level.labDoor.colliders);
    this.colliders = this.colliders.filter((c) => !doorSet.has(c));
    // Spawn 2 demon bots
    for (const spot of this.level.anchors.enemySpawns) {
      const r = new RobotUnit(this.level.mats, spot.clone());
      r.displayName = 'Possessed Frame';
      r.setPhase('active');
      r.aggro = true;
      this.robots.push(r);
      this.scene.add(r.mesh);
    }
    this.objective = 'Survive — arc the demons, keep Elias close';
    this.setHelp('2 Wrench · scramble or KO · Hand reprogram optional · flee to the dock if needed');
    if (reason === 'forced') {
      this.flash('YOU OPENED THE DOOR — two demon frames!');
      this.toast('They wear scrap like coats. Fight with Elias or run for the skiff.', 5);
    } else {
      this.flash('THE DOOR GIVES — two demon frames!');
      this.toast('They wear scrap like coats. Arc wrench for combat. Elias will fight beside you.', 5);
    }
    // Auto-offer wrench if not taken
    if (!this.wrenchUnlocked) {
      this.toast('Arc Wrench still on the rack — grab it (E)!', 3);
    }
  }

  private updateInteractPrompts() {
    const pos = this.camera.position;
    for (const it of this.interactables) {
      if (!it.prompt) continue;
      // Trays only when scrapped path active and not collected
      if (it.type === 'tray') {
        const show = this.brotherScrapped && !it.opened && it.mesh.visible;
        it.prompt.visible = show && it.position.distanceTo(pos) < 5;
        if (it.prompt.visible) it.prompt.lookAt(pos);
        continue;
      }
      if (it.type === 'wrench_pickup') {
        const show = !it.opened && it.mesh.visible && !this.wrenchUnlocked;
        it.prompt.visible = show && it.position.distanceTo(pos) < 5;
        if (it.prompt.visible) it.prompt.lookAt(pos);
        continue;
      }
      if (it.type === 'boat') {
        const show = !it.opened && (this.tutorial === 'escape' || this.tutorial === 'breach');
        it.prompt.visible = show && it.position.distanceTo(pos) < 6;
        if (it.prompt.visible) it.prompt.lookAt(pos);
        continue;
      }
      // lore / photo always when near
      if (it.type === 'photo' || it.type === 'note' || it.type === 'plaque') {
        it.prompt.visible = !it.opened && it.position.distanceTo(pos) < 3.5;
        if (it.prompt.visible) it.prompt.lookAt(pos);
      }
    }
  }

  /**
   * Live powered allies only — re-scanned every call.
   * Excludes husks, invisible meshes, and units removed from the scene
   * so upkeep never sticks at a peak (e.g. 3→1) ally count.
   */
  private countPoweredAllies(): number {
    let n = 0;
    for (const r of this.robots) {
      if (this.isPoweredAlly(r)) n++;
    }
    return Math.min(n, ROBOT.maxAllies);
  }

  private isPoweredAlly(r: RobotUnit): boolean {
    return r.phase === 'ally' && r.mesh.visible && r.mesh.parent != null;
  }

  private getPoweredAllies(): RobotUnit[] {
    return this.robots.filter((r) => this.isPoweredAlly(r));
  }

  /** Rest point for plasma given current ally load (0..3). */
  private plasmaEquilibrium(allyCount: number): number {
    const n = Math.max(0, Math.min(ROBOT.maxAllies, allyCount | 0));
    return ROBOT.plasmaEq[n]!;
  }

  /**
   * Instantaneous dP/dt toward equilibrium.
   * dP/dt = k · (P* − P)  with separate k for regen vs drain.
   */
  private plasmaNetPerSec(allyCount: number, plasma = this.plasma): number {
    const n = Math.max(0, Math.min(ROBOT.maxAllies, allyCount | 0));
    const eq = ROBOT.plasmaEq[n]!;
    const err = eq - plasma;
    if (Math.abs(err) < 0.05) return 0;
    // Below eq → regen k; above eq → drain k (err negative)
    const k = err > 0 ? ROBOT.plasmaRegenK[n]! : ROBOT.plasmaDrainK[n]!;
    return k * err;
  }

  /**
   * Equilibrium attractor — settles at P*(allies), never free-falls to 0
   * unless the player dumps plasma with arcs / reprograms.
   */
  private tickAllyPower(dt: number) {
    for (const r of this.robots) {
      if (r.phase !== 'ally') continue;
      if (r.position.y < -2) {
        r.position.y = 0.05;
        r.vy = 0;
        r.onGround = true;
      }
    }

    const allies = this.getPoweredAllies();
    const n = allies.length;
    const net = this.plasmaNetPerSec(n);
    this.plasma = Math.max(0, Math.min(100, this.plasma + net * dt));

    // Soft snap when very close (stops micro-jitter at the rest point)
    const eq = this.plasmaEquilibrium(n);
    if (Math.abs(this.plasma - eq) < 0.35 && Math.abs(net) < 0.4) {
      this.plasma = eq;
    }

    if (n === 0) {
      this.allyStarveT = 0;
      return;
    }

    // Starvation only if attacks/reprograms emptied the bar (passive never does)
    if (this.plasma <= 0.05) {
      this.allyStarveT += dt;
      if (Math.floor(this.allyStarveT * 2) !== Math.floor((this.allyStarveT - dt) * 2)) {
        if (this.allyStarveT < ROBOT.allyStarveTime) {
          this.toast(`⚠ Plasma empty — ${n} link${n > 1 ? 's' : ''} destabilizing…`);
        }
      }
      if (this.allyStarveT >= ROBOT.allyStarveTime) {
        let worst = allies[0]!;
        let bestD = -1;
        const p = this.camera.position;
        for (const a of allies) {
          const d = a.position.distanceTo(p);
          if (d > bestD) {
            bestD = d;
            worst = a;
          }
        }
        this.turnAllyRogue(worst);
        this.allyStarveT = 0;
      }
    } else {
      this.allyStarveT = Math.max(0, this.allyStarveT - dt * 1.5);
    }
  }

  private turnAllyRogue(r: RobotUnit) {
    r.scrambled = false;
    r.scramble = 0;
    r.hp = Math.max(50, r.hp);
    r.maxHp = ROBOT.maxHp;
    r.vy = 0;
    r.onGround = true;
    r.setPhase('active');
    r.mode = 'chase';
    r.returning = false;
    r.fuseT = 0;
    const left = this.countPoweredAllies();
    const eq = this.plasmaEquilibrium(left);
    this.flash(`LINK SEVERED — rogue! Grid ${left}/${ROBOT.maxAllies} · settles ~${eq}%`);
  }

  /**
   * Move robot in XZ with wall collision + auto step/jump onto ledges.
   * Returns horizontal delta applied.
   */
  private moveRobot(r: RobotUnit, wish: THREE.Vector3, speed: number, dt: number): THREE.Vector3 {
    const applied = new THREE.Vector3();
    r.jumpCd = Math.max(0, r.jumpCd - dt);

    // Gravity + vertical resolve first
    r.vy -= ROBOT.robotGravity * dt;
    r.vy = Math.max(r.vy, -24);
    r.position.y += r.vy * dt;
    this.resolveRobotVertical(r);

    if (wish.lengthSq() < 1e-6) {
      if (r.onGround) this.snapRobotToFloor(r);
      return applied;
    }
    const dir = wish.clone().setY(0);
    if (dir.lengthSq() < 1e-6) {
      if (r.onGround) this.snapRobotToFloor(r);
      return applied;
    }
    dir.normalize();

    const tryAxis = (axis: 'x' | 'z', amount: number): number => {
      if (Math.abs(amount) < 1e-8) return 0;
      const prev = r.position[axis];
      r.position[axis] += amount;
      if (this.robotBodyHitsWall(r)) {
        r.position[axis] = prev;
        if (r.onGround && r.jumpCd <= 0 && this.tryRobotStepOrJump(r, dir)) {
          // After step/jump, nudge along wish so we clear the riser
          const nudge = amount * (r.onGround ? 0.55 : 0.4);
          r.position[axis] += nudge;
          if (this.robotBodyHitsWall(r)) r.position[axis] = prev;
        }
      }
      return r.position[axis] - prev;
    };

    const dx = dir.x * speed * dt;
    const dz = dir.z * speed * dt;
    applied.x = tryAxis('x', dx);
    applied.z = tryAxis('z', dz);

    // Blocked + player clearly above → jump to follow stairs / platforms
    const playerFeetY = this.camera.position.y - PLAYER_H * 0.9;
    const stuck = applied.lengthSq() < (speed * dt * 0.25) ** 2;
    if (r.onGround && r.jumpCd <= 0 && wish.lengthSq() > 0.1) {
      if (stuck && playerFeetY > r.position.y + 0.35) {
        this.robotJump(r);
      } else if (stuck) {
        // Flat obstacle — try climb in move dir before random turn
        if (!this.tryRobotStepOrJump(r, dir)) {
          r.wanderAngle += (Math.random() > 0.5 ? 1 : -1) * (0.9 + Math.random());
        }
      } else if (playerFeetY > r.position.y + 0.55) {
        // Moving toward player who is upstairs — hop onto riser if one is ahead
        this.tryRobotStepOrJump(r, dir);
      }
    }

    if (r.onGround) this.snapRobotToFloor(r);
    return applied;
  }

  private robotBodyHitsWall(r: RobotUnit): boolean {
    const rad = r.radius;
    const feet = r.position.y;
    // Body starts slightly above feet so pure floors don't count as walls
    const min = new THREE.Vector3(r.position.x - rad, feet + 0.18, r.position.z - rad);
    const max = new THREE.Vector3(r.position.x + rad, feet + 1.45, r.position.z + rad);
    for (const c of this.colliders) {
      // Skip surfaces we're standing on (tops at/near feet) — not climbable risers
      if (c.max.y <= feet + 0.12) continue;
      if (aabbOverlap(min, max, c.min, c.max)) return true;
    }
    return false;
  }

  private resolveRobotVertical(r: RobotUnit) {
    const rad = r.radius;
    const min = new THREE.Vector3(r.position.x - rad, r.position.y - 0.05, r.position.z - rad);
    const max = new THREE.Vector3(r.position.x + rad, r.position.y + 1.55, r.position.z + rad);
    let grounded = false;
    for (const c of this.colliders) {
      if (!aabbOverlap(min, max, c.min, c.max)) continue;
      // Land on top when falling / resting
      if (r.vy <= 0.05 && r.position.y + 0.25 >= c.max.y - 0.2 && r.position.y <= c.max.y + 0.35) {
        r.position.y = c.max.y;
        r.vy = 0;
        grounded = true;
      } else if (r.vy > 0 && r.position.y + 1.45 > c.min.y && r.position.y + 0.4 < c.min.y) {
        // Head bump
        r.position.y = c.min.y - 1.5;
        r.vy = 0;
      }
    }
    r.onGround = grounded;
  }

  private robotJump(r: RobotUnit) {
    r.vy = ROBOT.robotJumpVel;
    r.onGround = false;
    r.jumpCd = ROBOT.robotJumpCooldown;
  }

  /**
   * Climb short risers (stairs / curbs) or jump half-walls.
   * Only considers standable tops in a climb window — never ceilings / full walls.
   */
  private tryRobotStepOrJump(r: RobotUnit, dir: THREE.Vector3): boolean {
    const probeDist = r.radius + 0.4;
    const samples = [
      r.position.clone().addScaledVector(dir, probeDist),
      r.position.clone().addScaledVector(dir, probeDist * 0.55),
      r.position
        .clone()
        .addScaledVector(dir, probeDist)
        .add(new THREE.Vector3(-dir.z * 0.25, 0, dir.x * 0.25)),
      r.position
        .clone()
        .addScaledVector(dir, probeDist)
        .add(new THREE.Vector3(dir.z * 0.25, 0, -dir.x * 0.25)),
    ];

    let bestTop = -Infinity;
    const feet = r.position.y;
    for (const ahead of samples) {
      for (const c of this.colliders) {
        if (ahead.x < c.min.x || ahead.x > c.max.x || ahead.z < c.min.z || ahead.z > c.max.z) continue;
        const rise = c.max.y - feet;
        // Climb window only — skip floors under us and tall walls / ceilings
        if (rise <= 0.06 || rise > ROBOT.robotMaxClimb) continue;
        if (c.max.y > bestTop) bestTop = c.max.y;
      }
    }
    if (bestTop === -Infinity) return false;

    const rise = bestTop - feet;
    if (rise <= ROBOT.robotStepHeight) {
      r.position.y = bestTop + 0.02;
      r.vy = 0;
      r.onGround = true;
      return true;
    }
    // Need a jump to clear
    this.robotJump(r);
    return true;
  }

  private spawnArcFx() {
    if (this.arcMesh) {
      this.scene.remove(this.arcMesh);
      this.arcMesh.geometry.dispose();
    }
    const geo = new THREE.SphereGeometry(0.15, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0x66ccff });
    this.arcMesh = new THREE.Mesh(geo, mat);
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    this.arcMesh.position.copy(this.camera.position).add(dir.multiplyScalar(1.2));
    this.scene.add(this.arcMesh);
    window.setTimeout(() => {
      if (this.arcMesh) {
        this.scene.remove(this.arcMesh);
        this.arcMesh = null;
      }
    }, 120);
  }

  private updateArcVisual(_dt: number) {}

  private tryInteract() {
    if (this.disposed) return;
    // Don't open bay/market while another economy panel is already open
    if (this.isEconomyUiOpen() || this.harvestOpen) return;
    if (this.megaCityActive) {
      this.tryCityInteract();
      return;
    }
    if (this.economyActive) {
      this.tryHubInteract();
      return;
    }
    if (this.raceActive) {
      this.tryBoardInteract();
      return;
    }
    const pos = this.camera.position;

    // Priority: world interactables near crosshair/proximity
    let bestIt: Interactable | null = null;
    let bestD = 2.8;
    for (const it of this.interactables) {
      if (it.opened) continue;
      if (it.type === 'tray' && (!this.brotherScrapped || !it.mesh.visible)) continue;
      if (it.type === 'wrench_pickup' && (!it.mesh.visible || this.wrenchUnlocked)) continue;
      if (it.type === 'boat' && this.tutorial !== 'escape' && this.tutorial !== 'breach') continue;
      const d = it.position.distanceTo(pos);
      if (d < bestD && d <= it.radius + 0.4) {
        bestIt = it;
        bestD = d;
      }
    }
    if (bestIt) {
      this.useInteractable(bestIt);
      return;
    }

    // Scrap disabled robots (including accidental brother scrap)
    for (const r of this.robots) {
      if (r.phase !== 'disabled') continue;
      if (r.position.distanceTo(pos) < 2.4) {
        this.scrapRobot(r);
        return;
      }
    }
  }

  private useInteractable(it: Interactable) {
    if (it.type === 'photo' || it.type === 'note' || it.type === 'plaque') {
      this.plaque(`${it.title ?? 'Note'}\n\n${it.text ?? ''}`);
      return;
    }
    if (it.type === 'tray' && !it.opened) {
      it.opened = true;
      it.mesh.visible = false;
      if (it.prompt) it.prompt.visible = false;
      this.traysCollected++;
      this.audio.playPickup();
      this.flash(`Part recovered — ${it.title} (${this.traysCollected}/3)`);
      this.objective = `Rebuild Elias — trays ${this.traysCollected}/3`;
      if (this.traysCollected >= 3) this.rebuildBrotherFrame();
      return;
    }
    if (it.type === 'wrench_pickup' && !it.opened) {
      it.opened = true;
      it.mesh.visible = false;
      if (it.prompt) it.prompt.visible = false;
      this.wrenchUnlocked = true;
      this.weapon = 'wrench';
      this.audio.playPickup();
      this.flash('ARC WRENCH — bash the door or wait · plasma per swing');
      this.setHelp(
        this.tutorial === 'siege'
          ? 'Aim at the lab door and swing · or wait for it to fail · 1 Hand'
          : '2 Wrench · 1 Hand · arcs cost plasma · settle back to EQ',
      );
      return;
    }
    if (it.type === 'boat' && !it.opened) {
      if (this.tutorial !== 'escape' && this.tutorial !== 'breach') {
        this.toast('Not yet — the lab door still holds.');
        return;
      }
      // Allow early boat if demons still up but player flees
      it.opened = true;
      this.winTutorial();
      return;
    }
  }

  private scrapRobot(r: RobotUnit) {
    const wasBrother = r.isBrother;
    const bonus = r.scramble >= 100 ? 1.0 : 0.55;
    const b = Math.round(6 * bonus + Math.random() * 4);
    const g = Math.round(2 * bonus + Math.random() * 2);
    this.brass += b;
    this.gears += g;
    r.setPhase('husk');
    const husk = createHusk(this.level.mats, r.position.clone());
    this.scene.add(husk);
    this.husks.push(husk);
    this.scene.remove(r.mesh);

    if (wasBrother && !this.brotherScrapped && !this.hadAllyOnce) {
      this.brotherScrapped = true;
      this.tutorial = 'rebuild';
      this.objective = 'You dismantled him — gather 3 trays to rebuild';
      this.setHelp('E on glowing trays around the workstation · then Hand to wake him');
      this.flash('The talisman frame is scrap —');
      this.toast(
        'No. The trays on the worktables still hold his parts. Gather all three (E), then rebuild.',
        7,
      );
      for (const it of this.interactables) {
        if (it.type === 'tray') {
          it.mesh.visible = true;
          it.opened = false;
          if (it.prompt) it.prompt.visible = true;
        }
      }
      this.audio.playBang(0.3);
    } else {
      this.flash(`Scrapped — +${b} brass, +${g} gears`);
    }
  }

  private rebuildBrotherFrame() {
    const spot = this.level.anchors.brotherSpot.clone();
    const brother = new RobotUnit(this.level.mats, spot);
    brother.isBrother = true;
    brother.displayName = 'Elias';
    brother.setPhase('disabled');
    brother.scramble = 100;
    brother.scrambled = true;
    this.robots.push(brother);
    this.scene.add(brother.mesh);
    this.traysCollected = 0;
    this.brotherScrapped = false;
    for (const it of this.interactables) {
      if (it.type === 'tray') {
        it.mesh.visible = false;
        if (it.prompt) it.prompt.visible = false;
      }
    }
    this.objective = 'Frame rebuilt — Hand (1) to call Elias home';
    this.flash('A new shell stands — the talisman gear is reseated');
    this.toast('Stand close. Hand weapon. Click to reprogram. Speak his name in the plasma.', 6);
    this.audio.playPickup();
  }

  private winTutorial() {
    if (this.won) return;
    this.won = true;
    this.tutorial = 'won';
    this.objective = 'Workshop complete — market training next';
    this.audio.setTension(0);
    this.audio.playWin();
    this.flash('SKIFF AWAY — Elias is with you');
    this.toast(
      'Next: Sky City Market training — earn 1000 brass and buy a sky apartment.',
      6,
    );
    this.setHelp('Loading Sky City Market…');
    this.bringEliasToRace = this.bringEliasToRace || this.hadAllyOnce;
    const pre = this.buildSaveData();
    pre.levelId = 'sky_city';
    pre.levelName = LEVEL_NAMES.sky_city;
    pre.tutorialPhase = 'won';
    writeSlot(this.activeSlot, pre);
    window.setTimeout(() => this.enterSkyCity(), 2800);
  }

  /** Market training complete — apartment deed purchased */
  private winMarketTutorial() {
    if (this.inv.apartmentOwned) {
      this.audio.playWin();
      this.flash('APARTMENT SECURED');
      this.objective = 'Training complete · E at Real Estate to go home';
      this.toast(
        'Deed signed! Talk to Real Estate again (E) when ready to travel to your sky apartment.',
        7,
      );
      this.setHelp('E at Real Estate · travel to Sky City home · or keep training here');
      writeSlot(this.activeSlot, this.buildSaveData());
    }
  }

  /**
   * Sky City hub: market, harvest, lease, craft, hire, broker, repair.
   * No racetrack / floating-city sample in play flow.
   */
  private enterSkyCity(fromSave?: ForgeSaveData | null) {
    // Tear down workshop / combat world
    this.scene.remove(this.level.group);
    for (const r of this.robots) this.scene.remove(r.mesh);
    for (const h of this.husks) this.scene.remove(h);
    for (const b of this.bolts) this.scene.remove(b.mesh);
    for (const bl of this.blasts) this.scene.remove(bl);
    this.robots = [];
    this.husks = [];
    this.bolts = [];
    this.blasts = [];
    this.interactables = [];

    // Clear race track + floating city sample
    if (this.raceway) {
      this.scene.remove(this.raceway.group);
      this.raceway = null;
    }
    if (this.floatingCity) {
      this.scene.remove(this.floatingCity.group);
      this.floatingCity = null;
    }
    if (this.board) {
      this.scene.remove(this.board.mesh);
      this.board = null;
    }
    if (this.elias) {
      this.elias = null;
    }
    if (this.hub) {
      this.scene.remove(this.hub.group);
      this.hub = null;
    }
    if (this.skyCity) {
      this.scene.remove(this.skyCity.group);
      this.skyCity = null;
    }

    // Economy state — keep live inv when re-entering without a save blob
    if (fromSave?.economy) {
      this.inv = invFromSave(fromSave.economy, fromSave.brass ?? Math.max(40, this.brass));
    } else if (fromSave) {
      this.inv = invFromSave(null, fromSave.brass ?? Math.max(40, this.brass));
    }
    // else: preserve this.inv (in-session travel / apartment ferry)
    if (fromSave?.boardOwned) this.boardOwned = true;
    this.syncBoardOwnership();
    this.brass = this.inv.brass;
    const seed = fromSave?.backstorySeed ?? this.backstory?.seed ?? ((Math.random() * 0xffffffff) >>> 0);
    this.backstory = generateBackstory(seed);

    // Phase 0 hub
    this.hub = buildMarketHub();
    this.scene.add(this.hub.group);
    this.initCityEditor(this.hub.mats);
    this.hub.parcelGroup.visible = this.inv.parcelLeased;
    this.syncBayVisuals();
    this.syncStallVisual();
    this.buildMarketBoardPath();
    this.rebuildHubNav();
    this.rebuildWorkerAgents();
    this.ensureMarketBoard();
    this.upkeepAcc = 0;
    this.stallAcc = 0;
    this.craftOpen = false;
    this.bayOpen = false;
    this.boardShopOpen = false;
    this.programOpen = false;
    this.stallOpen = false;
    this.syncBoardOwnership();

    this.scene.background = new THREE.Color(0x6a90b0);
    this.scene.fog = new THREE.Fog(0x8aabcc, 25, 120);
    this.camera.far = 250;
    this.camera.fov = 70;
    this.camera.updateProjectionMatrix();
    this.camera.up.set(0, 1, 0);

    this.economyActive = true;
    this.megaCityActive = false;
    this.hideNavCompass();
    this.raceActive = false;
    this.won = false;
    this.tutorial = 'race';
    this.velocity.set(0, 0, 0);
    this.onGround = true;
    this.respawnCd = 0;
    this.fallKillY = -12;
    this.refreshFallKillY();

    this.camera.position.copy(this.hub.spawn);
    this.safePos.copy(this.hub.spawn);

    this.objective = this.skyCityObjective();
    this.setHelp(
      this.inv.apartmentOwned
        ? 'Training done · E at Real Estate → go home · or keep practicing'
        : this.inv.playerBoard.owned
          ? 'WASD · E · Q board · I bay · goal: 1000 brass → apartment east'
          : 'WASD · E interact · I bay · goal: 1000 brass → Real Estate east',
    );
    this.flash(
      fromSave
        ? `CONTINUE — ${LEVEL_NAMES.sky_city}`
        : 'MARKET TRAINING · 1000 BRASS → APARTMENT',
    );

    // Personalized backstory intro
    const bs = this.backstory;
    this.toast(bs.lines[0] + ' ' + bs.lines[1], 6);
    window.setTimeout(() => {
      if (this.disposed) return;
      this.toast(bs.lines[2] + ' ' + bs.lines[3], 6);
    }, 6500);
    window.setTimeout(() => {
      if (this.disposed) return;
      if (this.inv.apartmentOwned) {
        this.toast('Apartment already deeded — free practice in the training market.', 6);
      } else {
        this.toast(
          `Market training: trade, craft, hire, sell. Reach ${APARTMENT_COST} brass, then follow the path east to Sky Real Estate.`,
          8,
        );
      }
    }, 13000);

    this.audio.setWind(0.3);
    this.syncEconomyHud();
    writeSlot(this.activeSlot, this.buildSaveData());
    this.syncMobileGameplay();
    this.controls.lock();
  }

  private syncEconomyHud() {
    if (!this.economyActive && !this.megaCityActive) return;
    notePeakBrass(this.inv);
    this.weaponEl.textContent = `${this.inv.brass} BRASS`;
    const extras: string[] = [];
    if (this.megaCityActive) {
      if (this.inv.cityWorkshopLeased) extras.push('Workshop');
      const shops = ownedCityStallCount(this.inv);
      if (shops > 0) extras.push(`${shops} shops`);
      if ((this.inv.inventionsMade ?? 0) > 0) extras.push(`Inv ${this.inv.inventionsMade}`);
      extras.push(`Day ${Math.floor(this.cityTime * 100)}%`);
    } else if (!this.inv.apartmentOwned) {
      extras.push(`${Math.min(this.inv.brass, APARTMENT_COST)}/${APARTMENT_COST}`);
    } else {
      extras.push('Apartment');
    }
    if (this.inv.bayLevel > 0) extras.push(bayLevelName(this.inv.bayLevel));
    if (this.inv.workers.length) extras.push(`${this.inv.workers.length} crew`);
    if (this.inv.playerBoard.owned) extras.push('Board');
    if (this.inv.framesSold > 0) extras.push(`Fr ${this.inv.framesSold}`);
    const tail = extras.length ? ` · ${extras.join(' · ')}` : '';
    this.statsEl.textContent = `${this.objective} · Æ ${this.inv.aether}${tail}`;
    if (this.locEl) {
      this.locEl.textContent = this.megaCityActive
        ? 'Sky Empire · Multi-plaza city'
        : this.inv.apartmentOwned
          ? 'Sky City · Market Training (complete)'
          : 'Sky City · Market Training';
    }
    const pct = document.getElementById('resolve-pct');
    if (pct) pct.textContent = String(Math.round(this.health));
  }

  private skyCityObjective(): string {
    // Market tutorial win state
    if (this.inv.apartmentOwned) {
      return 'Training complete · E at Real Estate to go home (full city)';
    }
    // Soft onboarding steps toward the 1000 brass goal
    if (!this.inv.parcelLeased) {
      return `Training: lease bay · earn ${APARTMENT_COST} brass · apartment unlocks full game`;
    }
    if (this.inv.framesSold < 1 && this.inv.brass < 200) {
      return `Brass ${this.inv.brass}/${APARTMENT_COST} · craft & sell · stall sales add brass`;
    }
    if (this.inv.workers.length < 1 && this.inv.brass < 400) {
      return `Brass ${this.inv.brass}/${APARTMENT_COST} · hire (optional) · bay max L${TRAINING_MAX_BAY_LEVEL} here`;
    }
    if (this.inv.brass < APARTMENT_COST) {
      return `Brass ${this.inv.brass}/${APARTMENT_COST} · stall/vendor sales → Real Estate east`;
    }
    return `You have ${this.inv.brass} brass · east → buy apartment · full sky city starts`;
  }

  private syncBayVisuals() {
    if (!this.hub) return;
    this.hub.parcelGroup.visible = this.inv.parcelLeased;
    this.hub.expandL2.visible = this.inv.bayLevel >= 2;
    this.hub.expandL3.visible = this.inv.bayLevel >= 3;
  }

  private syncStallVisual() {
    if (!this.hub) return;
    this.hub.stallGroup.visible = this.inv.stall.owned;
  }

  /** Hub floors/walls + Game Maker props → player collision + worker nav */
  private collectPlayColliders(): Collider[] {
    const out: Collider[] = this.hub ? [...this.hub.colliders] : [];
    if (this.cityEditor) {
      const box = new THREE.Box3();
      for (const o of this.cityEditor.objects) {
        box.setFromObject(o.root);
        if (box.isEmpty()) continue;
        const h = box.max.y - box.min.y;
        const cat = o.data.category;
        const asFloor =
          cat === 'ground' ||
          cat === 'walkway' ||
          cat === 'path' ||
          (h <= 0.55 && cat !== 'building' && cat !== 'vehicle');
        out.push({
          min: box.min.clone(),
          max: box.max.clone(),
          kind: asFloor ? 'floor' : 'solid',
        });
      }
    }
    return out;
  }

  private rebuildHubNav() {
    this.colliders = this.collectPlayColliders();
    this.navGrid.rebuild(this.colliders);
    if (this.hub) {
      for (const a of this.workerAgents) {
        a.repath(this.inv, this.hub.waypoints, this.navGrid);
      }
    }
  }

  private rebuildWorkerAgents() {
    if (!this.hub) return;
    while (this.hub.workerRoot.children.length) {
      this.hub.workerRoot.remove(this.hub.workerRoot.children[0]!);
    }
    this.workerAgents = createWorkerAgents(
      this.inv,
      this.hub.waypoints,
      this.hub.workerRoot,
      this.navGrid,
    );
  }

  private syncWorkerAgentsLoadout() {
    for (const a of this.workerAgents) {
      const w = this.inv.workers.find((x) => x.id === a.workerId);
      if (w) a.syncLoadout(w);
    }
    if (this.workerAgents.length !== this.inv.workers.length) {
      this.rebuildWorkerAgents();
    } else if (this.hub) {
      for (const a of this.workerAgents) {
        a.repath(this.inv, this.hub.waypoints, this.navGrid);
      }
    }
  }

  private buildMarketBoardPath() {
    // Soft guide ring around plaza + dock (board still collides with solids)
    const pts: THREE.Vector3[] = [
      new THREE.Vector3(0, 0.4, 28),
      new THREE.Vector3(10, 0.4, 18),
      new THREE.Vector3(12, 0.4, 0),
      new THREE.Vector3(8, 0.4, -14),
      new THREE.Vector3(0, 0.4, -20),
      new THREE.Vector3(-10, 0.4, -14),
      new THREE.Vector3(-14, 0.4, 0),
      new THREE.Vector3(-10, 0.4, 16),
      new THREE.Vector3(0, 0.4, 28),
    ];
    this.marketBoardPath = pts;
    let acc = 0;
    this.marketBoardPathDist = [0];
    for (let i = 1; i < pts.length; i++) {
      acc += pts[i]!.distanceTo(pts[i - 1]!);
      this.marketBoardPathDist.push(acc);
    }
  }

  /** One purchase forever: top-level boardOwned ↔ inv.playerBoard.owned */
  private syncBoardOwnership() {
    if (this.boardOwned || this.inv.playerBoard.owned) {
      this.boardOwned = true;
      this.inv.playerBoard.owned = true;
    }
  }

  private ensureMarketBoard() {
    const mats = this.hub?.mats ?? this.skyCity?.mats;
    if (!mats) return;
    this.syncBoardOwnership();
    if (!this.inv.playerBoard.owned && !this.boardOwned) {
      if (this.board && !this.raceActive) {
        this.scene.remove(this.board.mesh);
        this.board = null;
      }
      return;
    }
    this.boardOwned = true;
    this.inv.playerBoard.owned = true;
    if (this.board) {
      // Owned = inventory; only visible while riding
      if (!this.board.mounted) this.board.mesh.visible = false;
      return;
    }
    const spawn = this.skyCity
      ? this.skyCity.apartmentSpawn.clone().setY(0.55)
      : new THREE.Vector3(12, 0.55, 26);
    this.board = new Surfboard(mats, spawn, 0);
    this.board.mesh.visible = false; // stowed until deploy
    this.scene.add(this.board.mesh);
  }

  /** Once owned, deploy underfoot anywhere (inventory board). */
  private tryMountMarketBoard(): boolean {
    if (!this.economyActive || this.board?.mounted) return false;
    this.syncBoardOwnership();
    if (!this.inv.playerBoard.owned && !this.boardOwned) return false;
    if (!this.board) this.ensureMarketBoard();
    if (!this.board) return false;
    this.boardOwned = true;
    this.inv.playerBoard.owned = true;
    this.mountMarketBoardHere();
    return true;
  }

  /** Deploy owned market board at the player's feet — always equipped (Q). */
  private mountMarketBoardHere() {
    // Works in training hub and mega city (mats from either)
    if (!this.board) this.ensureMarketBoard();
    if (!this.board) return;

    const floorY = this.sampleWalkFloorY(this.camera.position.x, this.camera.position.z);
    const feetY = this.camera.position.y - PLAYER_H * 0.9;
    const y =
      (floorY != null ? floorY : Math.max(0.15, feetY)) + BOARD.hoverHeight;

    // Face look direction (pointer-lock yaw)
    const look = new THREE.Vector3();
    this.camera.getWorldDirection(look);
    look.y = 0;
    const yaw = look.lengthSq() > 1e-6 ? Math.atan2(look.x, look.z) : this.lookYaw();

    this.board.position.set(this.camera.position.x, y, this.camera.position.z);
    this.board.yaw = yaw;
    this.board.velYaw = yaw;
    this.board.mesh.position.copy(this.board.position);
    this.board.mesh.rotation.set(0, yaw, 0);
    this.board.mesh.visible = true;
    this.board.mount();
    this.board.speed = 2;
    this.board.speedNorm = 0;
    this.board.vy = 0;
    this.board.onGround = true;
    this.velocity.set(0, 0, 0);
    this.syncBoardRiderVisibility();
    this.mobile.syncBoardButtons();
    this.audio.playPickup();
    this.toast(
      this.boardCamMode === 'first'
        ? 'Board · 1st person · Cam · Board stow · stick ride'
        : 'Board · 3rd person · Cam · Board stow · stick ride',
      2.5,
    );
    this.setHelp('WASD ride · Shift slide · Space jump · Tab camera · Q stow');
  }

  private dismountMarketBoard() {
    if (!this.board?.mounted) return;
    const yaw = this.board.yaw;
    const side = this.board.dismount();
    // Prefer island deck; mid-skyway still upright — player may fall (intended)
    const floorY = this.sampleWalkFloorY(side.x, side.z);
    if (floorY != null) {
      this.camera.position.set(side.x, floorY + PLAYER_H * 0.9, side.z);
    } else {
      this.camera.position.set(side.x, Math.max(side.y, 1.2), side.z);
    }
    this.velocity.set(0, 0, 0);
    this.onGround = floorY != null;
    this.safePos.copy(this.camera.position);
    // Stow — still owned; Q rides again anywhere
    this.board.mesh.visible = false;
    this.board.mesh.rotation.set(0, yaw, 0);
    this.board.setRiderVisible(false);
    this.boardOwned = true;
    this.inv.playerBoard.owned = true;
    this.applySpeedFx(0, 0);
    // Kill bank/roll leftover from lookAt + tilted camera.up while riding
    this.resetWalkCameraAfterBoard(yaw);
    this.mobile.syncBoardButtons();
    this.toast('Board stowed · Q to ride anytime', 2);
    this.setHelp(
      this.megaCityActive
        ? 'WASD · E · Q board · wind skyways between islands · I'
        : 'WASD · E interact · Q board · I bay · Esc · ~ maker',
    );
    writeSlot(this.activeSlot, this.buildSaveData());
  }

  /**
   * After board ride, camera.up was banked and lookAt left roll in the quaternion.
   * PointerLock walking needs pure YXZ yaw/pitch with zero roll or the view stays tilted.
   */
  private resetWalkCameraAfterBoard(preferYaw?: number) {
    this.camPitchOffset = 0;
    this.camera.fov = 70;
    this.camera.updateProjectionMatrix();
    this.camera.up.set(0, 1, 0);

    let yaw = preferYaw;
    if (yaw == null || Number.isNaN(yaw)) {
      const d = new THREE.Vector3();
      this.camera.getWorldDirection(d);
      d.y = 0;
      yaw = d.lengthSq() > 1e-6 ? Math.atan2(d.x, d.z) : 0;
    }

    // Face travel direction, horizon level (no bank roll / residual pitch tip)
    const look = this.camera.position
      .clone()
      .add(new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)));
    this.camera.lookAt(look);

    // Strip roll + board tip pitch so PLC mouse look is upright again
    this.camera.rotation.order = 'YXZ';
    const e = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
    e.z = 0;
    e.x = 0;
    this.camera.rotation.set(e.x, e.y, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(this.camera.rotation);
    this.camera.updateMatrixWorld(true);
  }

  /** Highest walkable floor under XZ (same rules as walking — no skyways). */
  private sampleWalkFloorY(x: number, z: number): number | null {
    let best: number | null = null;
    const r = 0.4;
    for (const c of this.colliders) {
      if (!this.isWalkFloor(c)) continue;
      if (x < c.min.x - r || x > c.max.x + r || z < c.min.z - r || z > c.max.z + r) continue;
      if (best == null || c.max.y > best) best = c.max.y;
    }
    return best;
  }

  /** Island deck or wind-skyway surface for surfboard free-roam. */
  private sampleBoardFloorY(x: number, z: number): number | null {
    let best: number | null = null;
    const r = 1.1; // wider than walk — sky ribbons feel rideable
    for (const c of this.colliders) {
      if (!this.isBoardFloor(c)) continue;
      if (x < c.min.x - r || x > c.max.x + r || z < c.min.z - r || z > c.max.z + r) continue;
      if (best == null || c.max.y > best) best = c.max.y;
    }
    return best;
  }

  private isEconomyUiOpen(): boolean {
    if (
      this.harvestOpen ||
      this.craftOpen ||
      this.bayOpen ||
      this.boardShopOpen ||
      this.programOpen ||
      this.stallOpen ||
      this.cityMapOpen ||
      this.activeVendor
    ) {
      return true;
    }
    const market = document.getElementById('market-panel');
    if (market && !market.classList.contains('hidden')) return true;
    const craft = document.getElementById('craft-panel');
    if (craft && !craft.classList.contains('hidden')) return true;
    const bay = document.getElementById('bay-panel');
    if (bay && !bay.classList.contains('hidden')) return true;
    const board = document.getElementById('board-panel');
    if (board && !board.classList.contains('hidden')) return true;
    const prog = document.getElementById('program-panel');
    if (prog && !prog.classList.contains('hidden')) return true;
    const stall = document.getElementById('stall-panel');
    if (stall && !stall.classList.contains('hidden')) return true;
    return false;
  }

  private tickMegaCity(dt: number) {
    if (!this.skyCity) return;
    this.respawnCd = Math.max(0, this.respawnCd - dt);
    this.cityTime = (this.cityTime + dt / 480) % 1; // ~8 min day cycle
    this.skyCity.animate(this.cityTime, dt);
    // Refresh colliders if workshop toggled
    this.colliders = [...this.skyCity.colliders];
    this.clearCityMapRouteIfArrived();
    this.updateNavCompass();
    if (this.cityMapOpen) this.refreshCityMap();

    if (this.harvestOpen) {
      this.harvestNeedle += this.harvestDir * dt * 55;
      if (this.harvestNeedle >= 100) {
        this.harvestNeedle = 100;
        this.harvestDir = -1;
      } else if (this.harvestNeedle <= 0) {
        this.harvestNeedle = 0;
        this.harvestDir = 1;
      }
      const needle = document.getElementById('harvest-needle');
      if (needle) needle.style.left = `${this.harvestNeedle}%`;
      this.renderer.render(this.scene, this.camera);
      return;
    }

    if (this.isEconomyUiOpen()) {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    // Upkeep + stall (same as training)
    this.upkeepAcc += dt;
    if (this.upkeepAcc >= UPKEEP_INTERVAL) {
      this.upkeepAcc = 0;
      const r = tickBayUpkeep(this.inv);
      if (r.msg) this.toast(r.msg, 2.4);
      this.brass = this.inv.brass;
      this.syncEconomyHud();
      writeSlot(this.activeSlot, this.buildSaveData());
    }
    // Multi-plaza retail + training stall
    this.stallAcc += dt;
    if (this.stallAcc >= STALL_INTERVAL) {
      this.stallAcc = 0;
      const r = tickAllStalls(this.inv);
      if (r.haggle && r.msg) {
        this.toast(r.msg, 4);
        if (this.stallOpen) this.fillStallPanel();
      } else if (r.ok && r.msg) this.toast(r.msg, 2.2);
      else if (r.msg && Math.random() < 0.25) this.toast(r.msg, 2);
      this.brass = this.inv.brass;
      this.syncEconomyHud();
      writeSlot(this.activeSlot, this.buildSaveData());
    }

    // Empire crew works without hub nav — harvest/craft/stock programs still advance
    if (this.inv.workers.length > 0 && !this.board?.mounted) {
      this.cityWorkerAcc += dt;
      if (this.cityWorkerAcc >= 16) {
        this.cityWorkerAcc = 0;
        const wr = tickAllPassiveWorkers(this.inv);
        if (wr.brassDelta) this.brass = this.inv.brass;
        if (wr.msgs.length && Math.random() < 0.55) {
          this.toast(wr.msgs[wr.msgs.length - 1]!, 2.2);
        }
        this.syncEconomyHud();
        writeSlot(this.activeSlot, this.buildSaveData());
      }
    }

    if (this.board?.mounted) {
      this.tickMarketBoard(dt);
      this.syncEconomyHud();
      this.audio.setWind(0.35 + this.board.speedNorm * 0.4);
      return;
    }
    if (this.board) this.board.tickIdle(dt);

    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, 1);
    else forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    const wish = new THREE.Vector3();
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) wish.add(forward);
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) wish.sub(forward);
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) wish.add(right);
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) wish.sub(right);
    const speed = MOVE_SPEED * playerWalkSpeedMul(this.inv);
    if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(speed);
    this.velocity.x = wish.x;
    this.velocity.z = wish.z;
    this.velocity.y -= GRAVITY * dt;
    if ((this.keys.has('Space') || this.keys.has('KeyJ')) && this.onGround) {
      this.velocity.y = JUMP_VEL;
      this.onGround = false;
    }
    this.moveWithCollision(dt);
    this.snapToGround(1.0);

    if (this.camera.position.y < this.fallKillY && this.respawnCd <= 0) {
      this.camera.position.copy(this.skyCity.apartmentSpawn);
      this.velocity.set(0, 0, 0);
      this.onGround = true;
      this.respawnCd = 1;
      this.toast('Restored to your apartment.', 2);
    }

    this.cityInteractPrompt = null;
    let bestD = 3.5;
    for (const it of this.skyCity.interactables) {
      if (it.kind === 'workshop_chest' && !this.inv.cityWorkshopLeased) continue;
      // Hide repaired rogues
      if (it.kind === 'rogue_robot' && !it.mesh.visible) continue;
      const d = this.camera.position.distanceTo(it.position);
      if (d < bestD && d <= it.radius + 0.5) {
        bestD = d;
        this.cityInteractPrompt = it;
      }
    }
    if (this.cityInteractPrompt) {
      this.setHelp(`E · ${this.cityInteractPrompt.label}`);
    } else if ((this.boardOwned || this.inv.playerBoard.owned) && !this.board?.mounted) {
      this.setHelp('WASD · E · Q board · ride wind skyways between islands · I');
    } else {
      this.setHelp('WASD · E · board shop · Q ride wind paths (no roads between islands)');
    }

    this.objective = this.megaCityObjective();
    this.syncEconomyHud();
    this.audio.setWind(0.3 + Math.sin(this.cityTime * Math.PI * 2) * 0.05);
  }

  private tryCityInteract() {
    if (!this.skyCity || !this.cityInteractPrompt) return false;
    const it = this.cityInteractPrompt;
    if (it.kind === 'neighbor' && it.lines?.length) {
      const line = it.lines[this.neighborLineIdx % it.lines.length]!;
      this.neighborLineIdx++;
      this.toast(line, this.mobile.enabled ? 9.5 : 5);
      this.audio.playPickup();
      return true;
    }
    if (it.kind === 'vendor' && it.vendor) {
      this.openMarket(it.vendor);
      return true;
    }
    if (it.kind === 'board_shop') {
      this.openBoardShop();
      return true;
    }
    if (it.kind === 'workshop_lease') {
      const r = leaseCityWorkshop(this.inv);
      this.toast(r.msg, 4);
      if (r.ok) {
        this.brass = this.inv.brass;
        this.syncCityWorkshopVisuals();
        this.audio.playPickup();
        writeSlot(this.activeSlot, this.buildSaveData());
      }
      this.syncEconomyHud();
      return true;
    }
    if (it.kind === 'workshop_chest') {
      if (!this.inv.cityWorkshopLeased && !this.inv.parcelLeased) {
        this.toast('Lease the city workshop first (industrial plaza).', 3);
        return true;
      }
      this.openBay();
      return true;
    }
    if (it.kind === 'craft_bench') {
      if (!this.inv.cityWorkshopLeased && !this.inv.parcelLeased) {
        this.toast('Lease the city workshop to use the craft bench.', 3);
        return true;
      }
      this.openCraft();
      return true;
    }
    if (it.kind === 'hire_board') {
      if (!this.inv.cityWorkshopLeased && !this.inv.parcelLeased) {
        this.toast('Lease the city workshop before hiring crew.', 3);
        return true;
      }
      if (this.inv.workers.length < maxWorkersForBay(this.inv.bayLevel)) {
        const r = hireLaborer(this.inv);
        this.toast(r.msg, 3.5);
        if (r.ok) {
          this.brass = this.inv.brass;
          this.audio.playPickup();
          writeSlot(this.activeSlot, this.buildSaveData());
        }
      } else {
        this.toast(
          `Crew full (${this.inv.workers.length}/${maxWorkersForBay(this.inv.bayLevel)}). Expand bay for more slots.`,
          3,
        );
      }
      this.bayTab = 'workers';
      this.openBay();
      this.syncEconomyHud();
      return true;
    }
    if (it.kind === 'bay_expand') {
      if (!this.inv.cityWorkshopLeased && !this.inv.parcelLeased) {
        this.toast(
          this.megaCityActive
            ? 'Lease the industrial workshop first · then board to Sky Foundry expand yards.'
            : 'Lease a starter bay first.',
          3.5,
        );
        return true;
      }
      // leaseParcel routes to expandBay when already owned
      const r = this.inv.parcelLeased ? expandBay(this.inv) : leaseParcel(this.inv);
      this.toast(r.msg, 4);
      if (r.ok) {
        this.brass = this.inv.brass;
        this.syncCityWorkshopVisuals();
        this.audio.playPickup();
        writeSlot(this.activeSlot, this.buildSaveData());
      }
      this.syncEconomyHud();
      return true;
    }
    if (it.kind === 'invent_desk') {
      if (!canInvent(this.inv)) {
        this.toast('Invent needs Workshop Wing (L3+) or a leased city workshop.', 3.5);
        return true;
      }
      this.bayTab = 'invent';
      this.openBay();
      return true;
    }
    if (it.kind === 'repair_job') {
      const r = completeRepair(this.inv);
      this.toast(r.msg, 3.5);
      if (r.ok) {
        this.brass = this.inv.brass;
        this.audio.playPickup();
        writeSlot(this.activeSlot, this.buildSaveData());
      }
      this.syncEconomyHud();
      return true;
    }
    if (it.kind === 'harvest') {
      this.openHarvest({
        pool: it.harvestPool,
        name: it.harvestName ?? 'Cloud reef',
      });
      return true;
    }
    if (it.kind === 'broker') {
      const r = sellFrameToBroker(this.inv);
      this.toast(r.msg, 3);
      if (r.ok) {
        this.brass = this.inv.brass;
        this.audio.playPickup();
        writeSlot(this.activeSlot, this.buildSaveData());
      }
      this.syncEconomyHud();
      return true;
    }
    if (it.kind === 'city_stall') {
      const did = it.districtId ?? 'grand_market';
      this.activeStallKey = did;
      this.openStall();
      this.syncCityStallVisuals();
      return true;
    }
    if (it.kind === 'rogue_robot') {
      const r = repairRogueRobot(this.inv);
      this.toast(r.msg, 3);
      this.brass = this.inv.brass;
      it.mesh.visible = false;
      this.audio.playPickup();
      writeSlot(this.activeSlot, this.buildSaveData());
      this.syncEconomyHud();
      return true;
    }
    if (it.kind === 'ferry_training') {
      this.toast('Ferry to market training…', 2);
      writeSlot(this.activeSlot, this.buildSaveData());
      window.setTimeout(() => {
        if (!this.disposed) {
          this.megaCityActive = false;
          this.enterSkyCity(this.buildSaveData());
        }
      }, 600);
      return true;
    }
    return false;
  }

  /** Show/hide empire workshop + expand yards based on lease + bay level */
  private syncCityWorkshopVisuals() {
    if (!this.skyCity) return;
    const leased = this.inv.cityWorkshopLeased || this.inv.parcelLeased;
    const wg = this.skyCity.workshopGroup;
    wg.visible = leased;
    // Workshop cosmetic wings
    wg.traverse((o) => {
      if (o.name === 'cityWingL2') o.visible = this.inv.bayLevel >= 2;
      if (o.name === 'cityWingL3') o.visible = this.inv.bayLevel >= 3;
    });
    // Expand yards live on Sky Foundry (separate island)
    const yg = this.skyCity.expandYardGroup;
    yg.visible = leased;
    yg.traverse((o) => {
      const min = (o as THREE.Object3D).userData?.expandMinLevel as number | undefined;
      if (typeof min === 'number') {
        o.visible = this.inv.bayLevel >= min;
      }
      if (o.name.startsWith('expandWingL')) {
        const n = Number(o.name.replace('expandWingL', ''));
        if (Number.isFinite(n)) o.visible = this.inv.bayLevel >= n;
      }
    });
  }

  /**
   * Compass: apartment (HOME) + industrial workshop (WORK) + active map-route arrow.
   * Top of ring = facing direction; pips rotate with bearing; legend shows range.
   * Element lives under #app (not bottom #hud) so top-right placement is visible.
   */
  private updateNavCompass() {
    const el = document.getElementById('nav-compass');
    if (!el) return;
    // Show in empire city whenever skyCity is live (hide only in Game Maker free-fly)
    if (!this.megaCityActive || !this.skyCity || this.gameMakerActive || this.disposed) {
      el.classList.add('hidden');
      el.setAttribute('aria-hidden', 'true');
      return;
    }
    el.classList.remove('hidden');
    el.setAttribute('aria-hidden', 'false');

    const pos = this.board?.mounted ? this.board.position : this.camera.position;
    const look = new THREE.Vector3();
    if (this.board?.mounted) {
      look.set(Math.sin(this.board.yaw), 0, Math.cos(this.board.yaw));
    } else {
      this.camera.getWorldDirection(look);
      look.y = 0;
      if (look.lengthSq() < 1e-8) look.set(0, 0, 1);
      else look.normalize();
    }
    const faceYaw = Math.atan2(look.x, look.z);

    const home = this.skyCity.apartmentSpawn;
    // Prefer workshop pad center; industrial district is the empire HQ
    const work = this.skyCity.industrial;

    this.placeCompassMark('nav-mark-home', 'nav-home-dist', 'nav-home-line', pos, home, faceYaw);
    this.placeCompassMark('nav-mark-work', 'nav-work-dist', 'nav-work-line', pos, work, faceYaw);
    this.updateCompassRouteMark(pos, faceYaw);
  }

  private placeCompassMark(
    markId: string,
    distId: string,
    lineId: string,
    from: THREE.Vector3,
    target: THREE.Vector3,
    faceYaw: number,
  ) {
    const mark = document.getElementById(markId);
    const distEl = document.getElementById(distId);
    const line = document.getElementById(lineId);
    if (!mark || !distEl) return;

    const dx = target.x - from.x;
    const dz = target.z - from.z;
    const dist = Math.hypot(dx, dz);
    const bearing = Math.atan2(dx, dz) - faceYaw;
    // CSS rotate: 0° = up (forward)
    const deg = (bearing * 180) / Math.PI;
    mark.style.transform = `translate(-50%, -50%) rotate(${deg}deg)`;

    distEl.textContent = dist < 8 ? 'here' : `${Math.round(dist)} u`;

    const near = dist < 28;
    mark.classList.toggle('near', near);
    line?.classList.toggle('near', near);
  }

  /** Gold rim arrow toward the next hop on the active map route (hidden when none). */
  private updateCompassRouteMark(from: THREE.Vector3, faceYaw: number) {
    const mark = document.getElementById('nav-mark-route');
    if (!mark || !this.skyCity) return;

    const id = this.cityMapSelectedId;
    const dest =
      id && id !== 'player'
        ? resolveMapTarget(this.skyCity.mapSnapshot, this.cityMapLive, id)
        : null;
    if (!dest) {
      mark.classList.add('hidden');
      mark.setAttribute('aria-hidden', 'true');
      return;
    }

    const route = routeToTarget(this.skyCity.mapSnapshot, { x: from.x, z: from.z }, dest);
    const steer = this.routeSteerPoint({ x: from.x, z: from.z }, route) ?? dest;
    const dx = steer.x - from.x;
    const dz = steer.z - from.z;
    const dist = Math.hypot(dx, dz);
    const bearing = Math.atan2(dx, dz) - faceYaw;
    const deg = (bearing * 180) / Math.PI;
    mark.style.transform = `translate(-50%, -50%) rotate(${deg}deg)`;
    mark.classList.toggle('near', dist < 28);
    mark.classList.remove('hidden');
    mark.setAttribute('aria-hidden', 'false');
    mark.title = `Route · ${dest.label}`;
  }

  /** Look-ahead point on the map route polyline for compass steering. */
  private routeSteerPoint(
    from: { x: number; z: number },
    route: { x: number; z: number }[],
  ): { x: number; z: number } | null {
    if (route.length < 2) return null;
    const lookAhead = 40;
    let steer = route[route.length - 1]!;
    for (let i = 1; i < route.length; i++) {
      const p = route[i]!;
      if (Math.hypot(p.x - from.x, p.z - from.z) >= lookAhead) {
        steer = p;
        break;
      }
      steer = p;
    }
    return steer;
  }

  private hideNavCompass() {
    const el = document.getElementById('nav-compass');
    if (!el) return;
    el.classList.add('hidden');
    el.setAttribute('aria-hidden', 'true');
  }

  private wireCityMapUi() {
    if (this.cityMapWired || this.disposed) return;
    this.cityMapWired = true;
    const sig = this.sessionAbort.signal;
    document.getElementById('city-map-close')?.addEventListener(
      'click',
      () => {
        if (!this.disposed) this.closeCityMap();
      },
      { signal: sig },
    );
    document.getElementById('city-map-filters')?.addEventListener(
      'click',
      (ev) => {
        if (this.disposed || !this.cityMapOpen) return;
        const t = (ev.target as HTMLElement).closest('button[data-map-filter]') as HTMLElement | null;
        if (!t?.dataset.mapFilter) return;
        const next = t.dataset.mapFilter;
        if (
          next !== 'all' &&
          next !== 'district' &&
          next !== 'harvest' &&
          next !== 'stall' &&
          next !== 'service' &&
          next !== 'crew'
        ) {
          return;
        }
        this.cityMapFilter = next;
        document.querySelectorAll('#city-map-filters button').forEach((b) => {
          b.classList.toggle('active', (b as HTMLElement).dataset.mapFilter === this.cityMapFilter);
        });
        this.refreshCityMap();
      },
      { signal: sig },
    );
    document.getElementById('city-map-tools')?.addEventListener(
      'click',
      (ev) => {
        if (this.disposed || !this.cityMapOpen || !this.skyCity || !this.cityMapCam) return;
        const t = (ev.target as HTMLElement).closest('button[data-map-tool]') as HTMLElement | null;
        const tool = t?.dataset.mapTool;
        if (!tool) return;
        const snap = this.skyCity.mapSnapshot;
        const pos = this.board?.mounted ? this.board.position : this.camera.position;
        if (tool === 'fit') {
          this.cityMapCam = defaultMapCamera(snap);
        } else if (tool === 'you') {
          this.cityMapCam = focusMapOn(snap, this.cityMapCam, pos.x, pos.z, 2.2);
          this.cityMapSelectedId = 'player';
        } else if (tool === 'focus') {
          const tgt = resolveMapTarget(snap, this.cityMapLive, this.cityMapSelectedId);
          if (tgt) this.cityMapCam = focusMapOn(snap, this.cityMapCam, tgt.x, tgt.z, 2.4);
          else this.cityMapCam = focusMapOn(snap, this.cityMapCam, pos.x, pos.z, 2.2);
        } else if (tool === 'follow') {
          this.cityMapCam = {
            ...this.cityMapCam,
            follow: !this.cityMapCam.follow,
            cx: pos.x,
            cz: pos.z,
            zoom: Math.max(this.cityMapCam.zoom, 1.8),
          };
        } else if (tool === 'zin') {
          this.cityMapCam = zoomMapCamera(snap, this.cityMapCam, 1.25);
        } else if (tool === 'zout') {
          this.cityMapCam = zoomMapCamera(snap, this.cityMapCam, 1 / 1.25);
        }
        this.refreshCityMap();
      },
      { signal: sig },
    );

    const svg = document.getElementById('city-map-svg');
    svg?.addEventListener(
      'wheel',
      (ev) => {
        if (this.disposed || !this.cityMapOpen || !this.skyCity || !this.cityMapCam) return;
        ev.preventDefault();
        const el = ev.currentTarget as SVGSVGElement;
        const loc = clientToMapSvg(el, (ev as WheelEvent).clientX, (ev as WheelEvent).clientY);
        if (!loc) return;
        const snap = this.skyCity.mapSnapshot;
        const pivot = mapToWorld(snap, loc.u, loc.v, undefined, this.cityMapCam);
        const factor = (ev as WheelEvent).deltaY > 0 ? 1 / 1.12 : 1.12;
        this.cityMapCam = zoomMapCamera(snap, { ...this.cityMapCam, follow: false }, factor, pivot);
        this.refreshCityMap();
      },
      { signal: sig, passive: false },
    );
    svg?.addEventListener(
      'pointerdown',
      (ev) => {
        if (this.disposed || !this.cityMapOpen || !this.skyCity || !this.cityMapCam) return;
        if ((ev as PointerEvent).button !== 0) return;
        const el = ev.currentTarget as SVGSVGElement;
        const loc = clientToMapSvg(el, (ev as PointerEvent).clientX, (ev as PointerEvent).clientY);
        if (!loc) return;
        this.cityMapDrag = {
          active: true,
          moved: false,
          lastU: loc.u,
          lastV: loc.v,
        };
        el.classList.add('dragging');
        try {
          el.setPointerCapture((ev as PointerEvent).pointerId);
        } catch {
          /* ignore */
        }
      },
      { signal: sig },
    );
    svg?.addEventListener(
      'pointermove',
      (ev) => {
        if (!this.cityMapDrag?.active || !this.skyCity || !this.cityMapCam) return;
        const el = ev.currentTarget as SVGSVGElement;
        const loc = clientToMapSvg(el, (ev as PointerEvent).clientX, (ev as PointerEvent).clientY);
        if (!loc) return;
        const du = loc.u - this.cityMapDrag.lastU;
        const dv = loc.v - this.cityMapDrag.lastV;
        if (!this.cityMapDrag.moved && Math.hypot(du, dv) < 3) return;
        this.cityMapDrag.moved = true;
        this.cityMapDrag.lastU = loc.u;
        this.cityMapDrag.lastV = loc.v;
        const snap = this.skyCity.mapSnapshot;
        const s = Math.max(1e-6, mapWorldScale(snap, undefined, this.cityMapCam));
        // Drag map content with pointer (pan opposite of finger movement)
        this.cityMapCam = panMapCamera(snap, this.cityMapCam, -du / s, -dv / s);
        this.refreshCityMap();
      },
      { signal: sig },
    );
    const endDrag = (ev: Event) => {
      const el = ev.currentTarget as SVGSVGElement;
      el.classList.remove('dragging');
      const drag = this.cityMapDrag;
      this.cityMapDrag = null;
      if (!drag || this.disposed || !this.cityMapOpen || !this.skyCity || !this.cityMapCam) return;
      // Click (no pan) → select under cursor
      if (drag.moved) return;
      const pe = ev as PointerEvent;
      const loc = clientToMapSvg(el, pe.clientX, pe.clientY);
      if (!loc) return;
      const snap = this.skyCity.mapSnapshot;
      const id = hitTestMap(
        snap,
        this.cityMapLive,
        loc.u,
        loc.v,
        undefined,
        this.cityMapCam,
        this.cityMapFilter,
      );
      this.cityMapSelectedId = id;
      this.refreshCityMap();
    };
    svg?.addEventListener('pointerup', endDrag, { signal: sig });
    svg?.addEventListener('pointercancel', endDrag, { signal: sig });
    svg?.addEventListener(
      'dblclick',
      (ev) => {
        if (this.disposed || !this.cityMapOpen || !this.skyCity || !this.cityMapCam) return;
        ev.preventDefault();
        const el = ev.currentTarget as SVGSVGElement;
        const loc = clientToMapSvg(el, (ev as MouseEvent).clientX, (ev as MouseEvent).clientY);
        if (!loc) return;
        const snap = this.skyCity.mapSnapshot;
        const id = hitTestMap(
          snap,
          this.cityMapLive,
          loc.u,
          loc.v,
          undefined,
          this.cityMapCam,
          this.cityMapFilter,
        );
        this.cityMapSelectedId = id;
        const tgt = resolveMapTarget(snap, this.cityMapLive, id);
        if (tgt) {
          this.cityMapCam = focusMapOn(snap, this.cityMapCam, tgt.x, tgt.z, Math.max(this.cityMapCam.zoom, 2.5));
        } else {
          const w = mapToWorld(snap, loc.u, loc.v, undefined, this.cityMapCam);
          this.cityMapCam = focusMapOn(snap, this.cityMapCam, w.x, w.z, Math.min(6, this.cityMapCam.zoom * 1.4));
        }
        this.refreshCityMap();
      },
      { signal: sig },
    );
  }

  private openCityMap() {
    if (this.disposed || !this.megaCityActive || !this.skyCity) return;
    this.cityMapOpen = true;
    // Keep cityMapSelectedId so the dotted route persists across open/close
    this.cityMapCam = defaultMapCamera(this.skyCity.mapSnapshot);
    this.cityMapDrag = null;
    const panel = document.getElementById('city-map-panel');
    panel?.classList.remove('hidden');
    panel?.setAttribute('aria-hidden', 'false');
    this.refreshCityMap();
    try {
      this.controls.unlock();
    } catch {
      /* ignore */
    }
    this.setHelp('Map · scroll zoom · drag pan · click route · M/Esc close');
    this.syncMobileGameplay();
  }

  private closeCityMap() {
    this.cityMapOpen = false;
    // Keep cityMapSelectedId — route redraws when the map reopens
    this.cityMapCam = null;
    this.cityMapDrag = null;
    const panel = document.getElementById('city-map-panel');
    panel?.classList.add('hidden');
    panel?.setAttribute('aria-hidden', 'true');
    if (!this.paused && !this.disposed) this.controls.lock();
    this.setHelp(
      this.boardOwned || this.inv.playerBoard.owned
        ? 'Home · E · Q board · M map · wind skyways · I · Esc'
        : 'Home · E · M map · board shop · wind skyways',
    );
    this.syncMobileGameplay();
  }

  /** Clear map route when the player reaches the selected destination. */
  private clearCityMapRouteIfArrived() {
    const id = this.cityMapSelectedId;
    if (!id || id === 'player' || !this.skyCity) return;
    const pos = this.board?.mounted ? this.board.position : this.camera.position;
    const snap = this.skyCity.mapSnapshot;
    const target = resolveMapTarget(snap, this.cityMapLive, id);
    if (!target) {
      // Transient pin gone (e.g. attention marker) — drop the route
      this.cityMapSelectedId = null;
      return;
    }
    const pad = snap.pads.find((p) => p.id === id);
    const radius = pad ? Math.max(28, pad.size * 0.45) : 18;
    if (Math.hypot(target.x - pos.x, target.z - pos.z) <= radius) {
      this.cityMapSelectedId = null;
    }
  }

  private refreshCityMap() {
    if (!this.skyCity || !this.cityMapOpen) return;
    const svg = document.getElementById('city-map-svg') as SVGSVGElement | null;
    if (!svg) return;
    const pos = this.board?.mounted ? this.board.position : this.camera.position;
    let yaw = 0;
    if (this.board?.mounted) {
      yaw = this.board.yaw;
    } else {
      const look = new THREE.Vector3();
      this.camera.getWorldDirection(look);
      look.y = 0;
      if (look.lengthSq() > 1e-8) yaw = Math.atan2(look.x, look.z);
    }
    const snap = this.skyCity.mapSnapshot;
    if (!this.cityMapCam) this.cityMapCam = defaultMapCamera(snap);
    if (this.cityMapCam.follow) {
      this.cityMapCam = {
        ...this.cityMapCam,
        cx: pos.x,
        cz: pos.z,
      };
    }
    this.cityMapLive = buildLiveMarkers(
      snap,
      this.inv,
      { x: pos.x, z: pos.z, yaw },
      { workshopLeased: this.inv.cityWorkshopLeased },
    );
    renderCityMap(
      svg,
      snap,
      this.cityMapLive,
      this.cityMapSelectedId,
      undefined,
      this.cityMapCam,
      this.cityMapFilter,
    );

    const followBtn = document.getElementById('city-map-follow');
    followBtn?.classList.toggle('active', !!this.cityMapCam.follow);

    const detail = document.getElementById('city-map-detail');
    if (detail) {
      detail.textContent = describeSelection(
        snap,
        this.cityMapLive,
        this.cityMapSelectedId,
        { x: pos.x, z: pos.z },
      );
    }
    const attn = document.getElementById('city-map-attn');
    if (attn) {
      const alerts = this.cityMapLive
        .filter((m) => m.kind === 'attention' || m.attention)
        .map((m) => m.label);
      attn.textContent = alerts.length
        ? `Attention: ${alerts.slice(0, 4).join(' · ')}`
        : '';
    }

    // Places list (distance-sorted, filterable)
    const placesEl = document.getElementById('city-map-places');
    if (placesEl) {
      placesEl.innerHTML = '';
      const places = listMapPlaces(
        snap,
        { x: pos.x, z: pos.z },
        this.cityMapFilter,
        this.cityMapLive,
      );
      for (const p of places.slice(0, 40)) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className =
          'city-map-place' + (p.id === this.cityMapSelectedId ? ' selected' : '');
        btn.innerHTML = `<span class="mp-name">${p.label}</span><span class="mp-dist">${Math.round(p.dist)} u</span>${
          p.blurb ? `<span class="mp-blurb">${p.blurb}</span>` : ''
        }`;
        btn.addEventListener('click', () => {
          this.cityMapSelectedId = p.id;
          const tgt = resolveMapTarget(snap, this.cityMapLive, p.id);
          if (tgt && this.cityMapCam) {
            this.cityMapCam = focusMapOn(snap, this.cityMapCam, tgt.x, tgt.z, Math.max(this.cityMapCam.zoom, 2));
          }
          this.refreshCityMap();
        });
        placesEl.appendChild(btn);
      }
    }
  }

  private tickSkyCity(dt: number) {
    if (!this.hub) return;
    this.respawnCd = Math.max(0, this.respawnCd - dt);

    // Harvest mini-game needle
    if (this.harvestOpen) {
      this.harvestNeedle += this.harvestDir * dt * 55;
      if (this.harvestNeedle >= 100) {
        this.harvestNeedle = 100;
        this.harvestDir = -1;
      } else if (this.harvestNeedle <= 0) {
        this.harvestNeedle = 0;
        this.harvestDir = 1;
      }
      const needle = document.getElementById('harvest-needle');
      if (needle) needle.style.left = `${this.harvestNeedle}%`;
      this.renderer.render(this.scene, this.camera);
      return;
    }

    // Market / craft / bay panels — freeze player, still tick workers lightly
    if (this.isEconomyUiOpen()) {
      this.tickWorkers(dt);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    // Bay upkeep + wages
    this.upkeepAcc += dt;
    if (this.upkeepAcc >= UPKEEP_INTERVAL) {
      this.upkeepAcc = 0;
      const r = tickBayUpkeep(this.inv);
      if (r.msg) this.toast(r.msg, 2.4);
      if (!r.ok) {
        this.syncWorkerAgentsLoadout();
        this.objective = this.skyCityObjective();
      }
      this.brass = this.inv.brass;
      this.syncEconomyHud();
      writeSlot(this.activeSlot, this.buildSaveData());
    }

    // Retail stall customers (training market)
    if (this.inv.stall.owned && this.inv.stall.open) {
      this.stallAcc += dt;
      if (this.stallAcc >= STALL_INTERVAL) {
        this.stallAcc = 0;
        const r = tickStall(this.inv);
        if (r.haggle && r.msg) {
          this.toast(r.msg, 4);
          if (this.stallOpen) this.fillStallPanel();
        } else if (r.ok && r.msg) this.toast(r.msg, 2);
        else if (r.msg && Math.random() < 0.35) this.toast(r.msg, 2);
        this.brass = this.inv.brass;
        this.syncEconomyHud();
        writeSlot(this.activeSlot, this.buildSaveData());
      }
    } else {
      this.stallAcc = 0;
    }

    this.tickWorkers(dt);

    // Ride market board
    if (this.board?.mounted) {
      this.tickMarketBoard(dt);
      this.syncEconomyHud();
      this.audio.setWind(0.35 + this.board.speedNorm * 0.4);
      return;
    }

    if (this.board) this.board.tickIdle(dt);

    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, 1);
    else forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    const wish = new THREE.Vector3();
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) wish.add(forward);
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) wish.sub(forward);
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) wish.add(right);
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) wish.sub(right);
    const speed = MOVE_SPEED * playerWalkSpeedMul(this.inv);
    if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(speed);
    this.velocity.x = wish.x;
    this.velocity.z = wish.z;
    this.velocity.y -= GRAVITY * dt;
    if ((this.keys.has('Space') || this.keys.has('KeyJ')) && this.onGround) {
      this.velocity.y = JUMP_VEL;
      this.onGround = false;
    }

    this.moveWithCollision(dt);
    this.snapToGround(0.7);

    if (this.camera.position.y < this.fallKillY && this.respawnCd <= 0) {
      this.camera.position.copy(this.hub.spawn);
      this.velocity.set(0, 0, 0);
      this.onGround = true;
      this.respawnCd = 1;
      this.toast('Restored to arrival dock.', 2);
    }

    // Proximity prompt
    this.hubInteractPrompt = null;
    let bestD = 3.2;
    for (const it of this.hub.interactables) {
      if (it.kind === 'parcel_chest' && !this.inv.parcelLeased) continue;
      const d = this.camera.position.distanceTo(it.position);
      if (d < bestD && d <= it.radius + 0.5) {
        bestD = d;
        this.hubInteractPrompt = it;
      }
    }
    if (this.hubInteractPrompt) {
      this.setHelp(`E · ${this.hubInteractPrompt.label}`);
    } else if (this.boardOwned || this.inv.playerBoard.owned) {
      this.setHelp('WASD · E interact · Q board · I bay · Esc · ~ maker');
    } else {
      this.setHelp('WASD · E interact · I bay · Esc · ~ bay Game Maker');
    }

    this.syncEconomyHud();
    this.audio.setWind(0.25);
  }

  private tickMarketBoard(dt: number) {
    // Free-roam board in training market OR mega city (no hub required)
    if (!this.board || (!this.hub && !this.skyCity)) return;
    let accel = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) accel += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) accel -= 1;
    let steer = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) steer -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) steer += 1;
    // Shift only — Ctrl can conflict with browser shortcuts
    const slide = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');

    // Free-roam: island decks + board-only skyways (no solid roads between islands)
    const floorY = this.sampleBoardFloorY(this.board.position.x, this.board.position.z);
    this.board.tick(
      dt,
      accel,
      steer,
      this.marketBoardPath,
      this.marketBoardPathDist,
      slide,
      [],
      [],
      [],
      true,
      floorY,
    );

    // Shop upgrades → speed cap
    const mul = playerBoardSpeedMul(this.inv);
    const cap = BOARD.maxSpeed * mul;
    if (this.board.speed > cap) this.board.speed = cap;

    // Same solid walls as walking (not every floor slab / soft bump sphere)
    this.resolveBoardWallsLikeWalk();

    // Camera: first person on deck (default) or third chase — Tab toggles
    const sn = this.board.speedNorm;
    const targetFov = THREE.MathUtils.lerp(BOARD.fovBase, BOARD.fovFast, sn * sn);
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 5, dt);
    this.camera.updateProjectionMatrix();

    const tipTarget =
      accel > 0.2 ? BOARD.camTipAccel * (0.5 + sn) : accel < -0.2 ? BOARD.camTipBrake : 0;
    this.camPitchOffset = THREE.MathUtils.damp(this.camPitchOffset, tipTarget, 6, dt);

    const forward = new THREE.Vector3(Math.sin(this.board.yaw), 0, Math.cos(this.board.yaw));
    const right = new THREE.Vector3(forward.z, 0, -forward.x);
    const bank = this.board.bank;
    this.camera.up.set(Math.sin(bank) * 0.55, 1, 0).normalize();

    if (this.boardCamMode === 'first') {
      const ideal = this.board.position
        .clone()
        .addScaledVector(forward, -0.35)
        .add(new THREE.Vector3(0, 1.05 + (this.board.onGround ? 0 : 0.15), 0));
      ideal.addScaledVector(right, bank * 0.12);
      this.camera.position.lerp(ideal, 1 - Math.exp(-14 * dt));
      const look = this.board.position
        .clone()
        .addScaledVector(forward, 4.5)
        .add(new THREE.Vector3(0, 0.85 + this.camPitchOffset * 6, 0));
      this.camera.lookAt(look);
    } else {
      const back = forward.clone().multiplyScalar(-1);
      const camDist = 5.2 + sn * 1.4;
      const camHeight = 2.1 + sn * 0.35 + (this.board.onGround ? 0 : 0.4);
      const ideal = this.board.position
        .clone()
        .addScaledVector(back, camDist)
        .add(new THREE.Vector3(0, camHeight, 0));
      if (this.board.isPowersliding()) {
        ideal.addScaledVector(right, this.board.bank * 2.8);
      }
      this.camera.position.lerp(ideal, 1 - Math.exp(-8 * dt));
      const look = this.board.position.clone().add(new THREE.Vector3(0, 0.85, 0));
      look.y += this.camPitchOffset * 8;
      this.camera.lookAt(look);
    }
    this.syncBoardRiderVisibility();
    this.applySpeedFx(sn, accel);

    this.weaponEl.textContent = `${Math.round(this.board.speed)} u/s · BOARD`;
    this.setHelp(
      this.boardCamMode === 'first'
        ? '1st person · WASD · Shift slide · Space · Tab 3rd · Q stow'
        : '3rd person · WASD · Shift slide · Space · Tab 1st · Q stow',
    );

    if (this.board.position.y < this.fallKillY && this.respawnCd <= 0) {
      this.board.position.set(12, 0.55, 26);
      this.board.speed = 0;
      this.board.vy = 0;
      this.respawnCd = 1;
      this.toast('Board restored to dock.', 2);
    }
  }

  /**
   * Board vs walls using the same solid/floor classification as walking.
   * Avoids treating plazas, floor pads, and soft bump spheres as invisible walls.
   */
  private resolveBoardWallsLikeWalk() {
    if (!this.board) return;
    const r = PLAYER_R + 0.12;
    const pos = this.board.position;
    // Feet height for "can ride over" checks
    const feetY = pos.y - BOARD.hoverHeight + 0.05;

    for (const c of this.colliders) {
      // Decks + wind skyways never side-block the board
      if (this.isBoardFloor(c) || c.kind === 'skyway') continue;
      // Only block with real walls / tall solids (match walk horizontal resolve)
      const h = c.max.y - c.min.y;
      if (h <= 0.55 && c.kind !== 'solid') continue;
      // Standing on top of a solid crate/table — don't side-block
      if (feetY >= c.max.y - 0.08 && feetY <= c.max.y + 0.45) continue;
      // Board flying high over short props
      if (feetY > c.max.y + 0.35) continue;

      const minX = c.min.x - r;
      const maxX = c.max.x + r;
      const minZ = c.min.z - r;
      const maxZ = c.max.z + r;
      if (pos.x <= minX || pos.x >= maxX || pos.z <= minZ || pos.z >= maxZ) continue;

      const dxL = pos.x - minX;
      const dxR = maxX - pos.x;
      const dzB = pos.z - minZ;
      const dzF = maxZ - pos.z;
      const m = Math.min(dxL, dxR, dzB, dzF);
      if (m === dxL) pos.x = minX;
      else if (m === dxR) pos.x = maxX;
      else if (m === dzB) pos.z = minZ;
      else pos.z = maxZ;
      this.board.speed *= 0.72;
    }
    this.board.mesh.position.x = pos.x;
    this.board.mesh.position.z = pos.z;
    this.board.mesh.position.y = pos.y;
  }

  private tickWorkers(dt: number) {
    if (!this.hub) return;
    let dirty = false;
    for (const a of this.workerAgents) {
      const r = a.tick(dt, this.inv, this.hub.waypoints, this.navGrid);
      if (r?.msg) {
        this.toast(r.msg, 2);
        dirty = true;
      }
    }
    if (dirty) {
      this.brass = this.inv.brass;
      this.objective = this.skyCityObjective();
      // Refresh tool/board visuals after wear or job results
      for (const a of this.workerAgents) {
        const w = this.inv.workers.find((x) => x.id === a.workerId);
        if (w) a.syncLoadout(w);
      }
      this.syncEconomyHud();
      writeSlot(this.activeSlot, this.buildSaveData());
    }
  }

  private openMarket(v: VendorDef) {
    this.activeVendor = v;
    const panel = document.getElementById('market-panel');
    const title = document.getElementById('market-title');
    const greet = document.getElementById('market-greeting');
    const wallet = document.getElementById('market-wallet');
    const log = document.getElementById('market-log');
    if (title) title.textContent = `${v.title} — ${v.name}`;
    if (greet) greet.textContent = v.greeting;
    if (wallet) wallet.textContent = `Brass ${this.inv.brass} · Aether ${this.inv.aether}`;
    if (log) log.textContent = '';
    this.fillMarketLists(v);
    panel?.classList.remove('hidden');
    panel?.setAttribute('aria-hidden', 'false');
    try {
      this.controls.unlock();
    } catch {
      /* ignore */
    }
  }

  private closeMarket() {
    const panel = document.getElementById('market-panel');
    panel?.classList.add('hidden');
    panel?.setAttribute('aria-hidden', 'true');
    this.activeVendor = null;
    if (!this.paused && !this.disposed) this.controls.lock();
  }

  /** Public for main.ts close button */
  closeMarketPublic() {
    this.closeMarket();
  }

  closeCraftPublic() {
    this.closeCraft();
  }

  closeBayPublic() {
    this.closeBay();
  }

  closeBoardPublic() {
    this.closeBoardShop();
  }

  closeProgramPublic() {
    this.closeProgram();
  }

  closeStallPublic() {
    this.closeStall();
  }

  openProgramPublic() {
    this.closeBay();
    this.openProgram();
  }

  newProgramPublic() {
    const r = createProgram(this.inv);
    this.programLog(r.msg);
    if (r.ok && r.program) {
      this.activeProgramId = r.program.id;
      writeSlot(this.activeSlot, this.buildSaveData());
      this.fillProgramPanel();
    }
  }

  setBayTabPublic(tab: string) {
    if (tab === 'inv' || tab === 'workers' || tab === 'invent' || tab === 'code') {
      this.bayTab = tab;
      this.syncBayTabs();
      this.fillBayPanel();
    }
  }

  private openCraft() {
    this.craftOpen = true;
    this.craftFilter = 'ready';
    this.craftSelectedId = null;
    const panel = document.getElementById('craft-panel');
    const wallet = document.getElementById('craft-wallet');
    const log = document.getElementById('craft-log');
    const sub = document.getElementById('craft-sub');
    if (wallet) {
      wallet.textContent = `Brass ${this.inv.brass} · ${bayLevelName(this.inv.bayLevel)}`;
    }
    if (log) log.textContent = '';
    if (sub) {
      sub.textContent = this.inv.parcelLeased
        ? 'Filter → select → craft. Ready shows what you can make now.'
        : 'Lease a bay at the Lease Office before crafting.';
    }
    this.wireCraftDoButton();
    this.fillCraftUi();
    panel?.classList.remove('hidden');
    panel?.setAttribute('aria-hidden', 'false');
    try {
      this.controls.unlock();
    } catch {
      /* ignore */
    }
  }

  private closeCraft() {
    this.craftOpen = false;
    const panel = document.getElementById('craft-panel');
    panel?.classList.add('hidden');
    panel?.setAttribute('aria-hidden', 'true');
    if (!this.paused && !this.disposed) this.controls.lock();
  }

  private wireCraftDoButton() {
    const btn = document.getElementById('craft-do-btn');
    if (!btn || this.craftDoWired || this.disposed) return;
    this.craftDoWired = true;
    btn.addEventListener(
      'click',
      () => {
        if (this.disposed) return;
        this.craftSelected();
      },
      { signal: this.sessionAbort.signal },
    );
  }

  private recipeCategory(recipe: Recipe): 'basics' | 'tools' | 'frames' {
    if (recipe.id === 'basic_frame' || recipe.id === 'fine_frame') return 'frames';
    if (
      recipe.id === 'speed_tool' ||
      recipe.id === 'haul_pack' ||
      recipe.id === 'polished_wire'
    ) {
      return 'tools';
    }
    return 'basics';
  }

  private craftEntries(): {
    id: string;
    name: string;
    ready: boolean;
    kind: 'recipe' | 'custom';
    recipe?: Recipe;
    customId?: string;
  }[] {
    const out: {
      id: string;
      name: string;
      ready: boolean;
      kind: 'recipe' | 'custom';
      recipe?: Recipe;
      customId?: string;
    }[] = [];
    for (const recipe of RECIPES) {
      out.push({
        id: recipe.id,
        name: recipe.name,
        ready: canCraft(this.inv, recipe),
        kind: 'recipe',
        recipe,
      });
    }
    for (const cr of this.inv.customRecipes) {
      const can =
        this.inv.parcelLeased &&
        cr.inputs.every((inp) => (this.inv.items[inp.id] ?? 0) >= inp.n);
      out.push({
        id: `custom:${cr.id}`,
        name: cr.name,
        ready: can,
        kind: 'custom',
        customId: cr.id,
      });
    }
    return out;
  }

  private fillCraftUi() {
    this.fillCraftFilters();
    this.fillCraftList();
    this.fillCraftDetail();
    const wallet = document.getElementById('craft-wallet');
    if (wallet) {
      wallet.textContent = `Brass ${this.inv.brass} · ${bayLevelName(this.inv.bayLevel)}`;
    }
  }

  private fillCraftFilters() {
    const el = document.getElementById('craft-filters');
    if (!el) return;
    const entries = this.craftEntries();
    const readyN = entries.filter((e) => e.ready).length;
    const inventN = this.inv.customRecipes.length;
    type CraftFilter = 'ready' | 'basics' | 'tools' | 'frames' | 'invent' | 'all';
    const chips: { id: CraftFilter; label: string; disabled?: boolean }[] = [
      { id: 'ready', label: `Ready (${readyN})` },
      { id: 'basics', label: 'Basics' },
      { id: 'tools', label: 'Tools' },
      { id: 'frames', label: 'Frames' },
      { id: 'invent', label: inventN ? `Invent (${inventN})` : 'Invent', disabled: inventN === 0 },
      { id: 'all', label: 'All' },
    ];
    el.innerHTML = '';
    for (const c of chips) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ui-chip' + (this.craftFilter === c.id ? ' active' : '');
      b.textContent = c.label;
      b.disabled = !!c.disabled;
      b.addEventListener('click', () => {
        this.craftFilter = c.id;
        this.fillCraftUi();
      });
      el.appendChild(b);
    }
  }

  private filteredCraftEntries() {
    const all = this.craftEntries();
    switch (this.craftFilter) {
      case 'ready':
        return all.filter((e) => e.ready);
      case 'basics':
        return all.filter((e) => e.kind === 'recipe' && this.recipeCategory(e.recipe!) === 'basics');
      case 'tools':
        return all.filter((e) => e.kind === 'recipe' && this.recipeCategory(e.recipe!) === 'tools');
      case 'frames':
        return all.filter((e) => e.kind === 'recipe' && this.recipeCategory(e.recipe!) === 'frames');
      case 'invent':
        return all.filter((e) => e.kind === 'custom');
      default:
        return all;
    }
  }

  private fillCraftList() {
    const list = document.getElementById('craft-recipe-list');
    if (!list) return;
    list.innerHTML = '';
    const filtered = this.filteredCraftEntries();
    // Drop selection if filtered out
    if (this.craftSelectedId && !filtered.some((e) => e.id === this.craftSelectedId)) {
      this.craftSelectedId = null;
    }
    // Auto-select first ready (or first) when none selected
    if (!this.craftSelectedId && filtered.length) {
      const prefer = filtered.find((e) => e.ready) ?? filtered[0]!;
      this.craftSelectedId = prefer.id;
    }
    if (filtered.length === 0) {
      const p = document.createElement('p');
      p.className = 'craft-hint';
      p.style.margin = '0.5rem 0';
      p.textContent =
        this.craftFilter === 'ready'
          ? 'Nothing ready — harvest mats or switch filter.'
          : this.craftFilter === 'invent'
            ? 'No inventions yet — use the L3 invent desk.'
            : 'No recipes in this filter.';
      list.appendChild(p);
      return;
    }
    for (const e of filtered) {
      const btn = document.createElement('button');
      btn.type = 'button';
      if (e.ready) btn.classList.add('craft-ready');
      if (e.id === this.craftSelectedId) btn.classList.add('craft-selected');
      const name = document.createElement('span');
      name.className = 'craft-name';
      name.textContent = e.kind === 'custom' ? `Invent · ${e.name}` : e.name;
      const mark = document.createElement('span');
      mark.className = 'craft-mark';
      mark.textContent = e.ready ? '✓' : '·';
      btn.appendChild(name);
      btn.appendChild(mark);
      btn.addEventListener('click', () => {
        this.craftSelectedId = e.id;
        this.fillCraftList();
        this.fillCraftDetail();
      });
      list.appendChild(btn);
    }
  }

  private fillCraftDetail() {
    const empty = document.getElementById('craft-detail-empty');
    const body = document.getElementById('craft-detail-body');
    const nameEl = document.getElementById('craft-detail-name');
    const outEl = document.getElementById('craft-detail-out');
    const needsEl = document.getElementById('craft-detail-needs');
    const reasonEl = document.getElementById('craft-detail-reason');
    const doBtn = document.getElementById('craft-do-btn') as HTMLButtonElement | null;
    if (!empty || !body || !nameEl || !outEl || !needsEl || !reasonEl || !doBtn) return;

    const entry = this.craftEntries().find((e) => e.id === this.craftSelectedId);
    if (!entry) {
      empty.classList.remove('hidden');
      body.classList.add('hidden');
      return;
    }
    empty.classList.add('hidden');
    body.classList.remove('hidden');

    if (entry.kind === 'recipe' && entry.recipe) {
      const recipe = entry.recipe;
      nameEl.textContent = recipe.name;
      outEl.textContent = `Makes ${recipe.output.n}× ${COMMODITIES[recipe.output.id].name}`;
      needsEl.innerHTML = '';
      let missing = false;
      for (const inp of recipe.inputs) {
        const have = this.inv.items[inp.id] ?? 0;
        const ok = have >= inp.n;
        if (!ok) missing = true;
        const row = document.createElement('div');
        row.className = 'craft-need-row ' + (ok ? 'ok' : 'bad');
        row.innerHTML = `<span>${COMMODITIES[inp.id].name}</span><span>${have}/${inp.n} ${ok ? '✓' : '✗'}</span>`;
        needsEl.appendChild(row);
      }
      if (!this.inv.parcelLeased) {
        reasonEl.textContent = 'Lease a bay to use the workbench.';
        doBtn.disabled = true;
      } else if (missing) {
        const need = recipe.inputs.find((inp) => (this.inv.items[inp.id] ?? 0) < inp.n)!;
        const short = need.n - (this.inv.items[need.id] ?? 0);
        reasonEl.textContent = `Missing ${short}× ${COMMODITIES[need.id].name}`;
        doBtn.disabled = true;
      } else {
        reasonEl.textContent = '';
        doBtn.disabled = false;
      }
      doBtn.textContent = 'Craft';
    } else if (entry.kind === 'custom' && entry.customId) {
      const cr = this.inv.customRecipes.find((r) => r.id === entry.customId)!;
      nameEl.textContent = cr.name;
      outEl.textContent = `Invention · sells for ${cr.sellValue} brass`;
      needsEl.innerHTML = '';
      let missing = false;
      for (const inp of cr.inputs) {
        const have = this.inv.items[inp.id] ?? 0;
        const ok = have >= inp.n;
        if (!ok) missing = true;
        const row = document.createElement('div');
        row.className = 'craft-need-row ' + (ok ? 'ok' : 'bad');
        row.innerHTML = `<span>${COMMODITIES[inp.id].name}</span><span>${have}/${inp.n} ${ok ? '✓' : '✗'}</span>`;
        needsEl.appendChild(row);
      }
      if (!this.inv.parcelLeased) {
        reasonEl.textContent = 'Lease a bay first.';
        doBtn.disabled = true;
      } else if (missing) {
        reasonEl.textContent = 'Missing materials for this invention.';
        doBtn.disabled = true;
      } else {
        reasonEl.textContent = '';
        doBtn.disabled = false;
      }
      doBtn.textContent = 'Craft invention';
    }
  }

  private craftSelected() {
    if (!this.craftSelectedId) return;
    const entry = this.craftEntries().find((e) => e.id === this.craftSelectedId);
    if (!entry) return;
    const log = document.getElementById('craft-log');
    if (entry.kind === 'recipe' && entry.recipe) {
      const r = craft(this.inv, entry.recipe);
      if (log) log.textContent = r.msg;
      if (r.ok) {
        this.audio.playPickup();
        this.brass = this.inv.brass;
        this.objective = this.skyCityObjective();
        writeSlot(this.activeSlot, this.buildSaveData());
      }
    } else if (entry.kind === 'custom' && entry.customId) {
      const r = craftCustom(this.inv, entry.customId);
      if (log) log.textContent = r.msg;
      if (r.ok) {
        this.audio.playPickup();
        writeSlot(this.activeSlot, this.buildSaveData());
      }
    }
    this.fillCraftUi();
    this.syncEconomyHud();
  }

  private openBay() {
    if (this.disposed) return;
    // Only open when player has a bay / city workshop
    if (!this.inv.parcelLeased && !this.inv.cityWorkshopLeased) {
      this.toast('Lease a bay or city workshop first.', 2.5);
      return;
    }
    this.bayOpen = true;
    this.bayTab = 'inv';
    const panel = document.getElementById('bay-panel');
    panel?.classList.remove('hidden');
    panel?.setAttribute('aria-hidden', 'false');
    this.syncBayTabs();
    this.fillBayPanel();
    try {
      this.controls.unlock();
    } catch {
      /* ignore */
    }
  }

  private closeBay() {
    this.bayOpen = false;
    const panel = document.getElementById('bay-panel');
    panel?.classList.add('hidden');
    panel?.setAttribute('aria-hidden', 'true');
    if (!this.paused && !this.disposed) this.controls.lock();
  }

  private syncBayTabs() {
    document.querySelectorAll('.bay-tab').forEach((el) => {
      const t = (el as HTMLElement).dataset.bayTab;
      el.classList.toggle('active', t === this.bayTab);
    });
    const inv = document.getElementById('bay-tab-inv');
    const wr = document.getElementById('bay-tab-workers');
    const invn = document.getElementById('bay-tab-invent');
    const code = document.getElementById('bay-tab-code');
    inv?.classList.toggle('hidden', this.bayTab !== 'inv');
    wr?.classList.toggle('hidden', this.bayTab !== 'workers');
    invn?.classList.toggle('hidden', this.bayTab !== 'invent');
    code?.classList.toggle('hidden', this.bayTab !== 'code');
  }

  private fillBayPanel() {
    const wallet = document.getElementById('bay-wallet');
    const sub = document.getElementById('bay-sub');
    if (wallet) {
      wallet.textContent = `Brass ${this.inv.brass} · ${bayLevelName(this.inv.bayLevel)} · workers ${this.inv.workers.length}/${maxWorkersForBay(this.inv.bayLevel)}`;
    }
    if (sub) {
      const empire = this.megaCityActive && this.inv.cityWorkshopLeased;
      sub.textContent =
        this.inv.parcelLeased || this.inv.cityWorkshopLeased
          ? empire
            ? `Empire HQ · ${bayLevelName(this.inv.bayLevel)} · ${ownedCityStallCount(this.inv)} shops · invent cycle`
            : 'Inventory · assign jobs · invent (L3+)'
          : 'Lease a bay (training) or city workshop (industrial).';
    }
    const invEl = document.getElementById('bay-tab-inv');
    const wrEl = document.getElementById('bay-tab-workers');
    const invnEl = document.getElementById('bay-tab-invent');
    if (invEl) {
      invEl.innerHTML = '';
      const rows = Object.entries(this.inv.items).filter(([, n]) => (n ?? 0) > 0);
      if (rows.length === 0) {
        invEl.innerHTML = '<p class="craft-hint">Empty — harvest the reef or buy at stalls.</p>';
      }
      for (const [id, n] of rows) {
        const def = COMMODITIES[id as CommodityId];
        const row = document.createElement('div');
        row.className = 'bay-inv-row';
        row.textContent = `${def?.name ?? id} × ${n}`;
        invEl.appendChild(row);
      }
      for (const [rid, n] of Object.entries(this.inv.customStock)) {
        if (n < 1) continue;
        const recipe = this.inv.customRecipes.find((r) => r.id === rid);
        const row = document.createElement('div');
        row.className = 'bay-inv-row';
        row.textContent = `${recipe?.name ?? rid} × ${n} (invention · sell ${recipe?.sellValue ?? '?'}b)`;
        const sell = document.createElement('button');
        sell.type = 'button';
        sell.textContent = 'Sell 1 (any vendor-ish · Mira rate)';
        sell.style.marginLeft = '0.5rem';
        sell.addEventListener('click', () => {
          const r = sellCustomToVendor(this.inv, rid);
          this.bayLog(r.msg);
          if (r.ok) {
            this.brass = this.inv.brass;
            this.audio.playPickup();
            writeSlot(this.activeSlot, this.buildSaveData());
            this.fillBayPanel();
            this.syncEconomyHud();
          }
        });
        row.appendChild(sell);
        invEl.appendChild(row);
      }
      if (this.inv.playerBoard.owned) {
        const row = document.createElement('div');
        row.className = 'bay-inv-row';
        const parts = [
          'Board base',
          this.inv.playerBoard.thruster ? 'thruster' : null,
          this.inv.playerBoard.rails ? 'rails' : null,
          this.inv.playerBoard.deck ? 'deck' : null,
        ]
          .filter(Boolean)
          .join(' · ');
        row.textContent = parts;
        invEl.appendChild(row);
      }
    }
    if (wrEl) {
      wrEl.innerHTML = '';
      if (this.inv.workers.length === 0) {
        wrEl.innerHTML = `<p class="craft-hint">No crew. Hire at the Hire Board (${hireCost(this.inv)}b). Assign tasks in Programs (reefs + programs). Gear & pay here.</p>`;
      }
      const cap = maxWorkersForBay(this.inv.bayLevel);
      if (this.inv.workers.length > 0) {
        const head = document.createElement('p');
        head.className = 'craft-hint';
        const expandHint = canEmpireExpand(this.inv)
          ? this.megaCityActive
            ? `Sky Foundry expand L${this.inv.bayLevel + 1} · ${expandBayCost(this.inv.bayLevel)}b`
            : `next expand L${this.inv.bayLevel + 1} · ${expandBayCost(this.inv.bayLevel)}b`
          : this.inv.bayLevel >= TRAINING_MAX_BAY_LEVEL
            ? `bay max L${TRAINING_MAX_BAY_LEVEL} in training`
            : `next expand L${this.inv.bayLevel + 1} · ${expandBayCost(this.inv.bayLevel)}b`;
        head.textContent = `Status & gear only · ${this.inv.workers.length}/${cap} crew · hire ${hireCost(this.inv)}b · ${expandHint} · assign in Programs`;
        wrEl.appendChild(head);
      }
      for (const w of this.inv.workers) {
        if (w.harvestSiteId === undefined) w.harvestSiteId = null;
        const card = document.createElement('div');
        card.className = 'bay-worker-card';
        const pg = w.payGrade ?? 0;
        const assignment = describeWorkerAssignment(this.inv, w);
        const gear = [
          w.hasBoard ? 'Board' : null,
          w.hasSpeedTool ? 'Spanner' : null,
          w.hasHaulPack ? 'Pack' : null,
        ]
          .filter(Boolean)
          .join(' · ');
        card.innerHTML = `<strong>${w.name}</strong> · pay grade ${pg}
          <span class="bay-worker-status">Doing: ${assignment}</span>
          <span class="bay-worker-meta">Gear: ${gear || 'none'} · jobs done ${w.jobsDone ?? 0}</span>`;
        const actions = document.createElement('div');
        actions.className = 'bay-worker-actions';
        const raise = document.createElement('button');
        raise.type = 'button';
        raise.textContent = `Raise pay (${PAY_RAISE_COST + pg * 25}b)`;
        raise.addEventListener('click', () => {
          const r = raiseWorkerPay(this.inv, w.id);
          this.bayLog(r.msg);
          if (r.ok) {
            this.brass = this.inv.brass;
            this.audio.playPickup();
            writeSlot(this.activeSlot, this.buildSaveData());
          }
          this.fillBayPanel();
          this.syncEconomyHud();
        });
        actions.appendChild(raise);
        const eqB = document.createElement('button');
        eqB.type = 'button';
        eqB.textContent = 'Equip board (40b)';
        eqB.addEventListener('click', () => {
          const r = equipWorkerBoard(this.inv, w.id);
          this.bayLog(r.msg);
          if (r.ok) {
            this.brass = this.inv.brass;
            this.audio.playPickup();
            this.syncWorkerAgentsLoadout();
            writeSlot(this.activeSlot, this.buildSaveData());
          }
          this.fillBayPanel();
          this.syncEconomyHud();
        });
        actions.appendChild(eqB);
        const eqT = document.createElement('button');
        eqT.type = 'button';
        eqT.textContent = 'Equip spanner';
        eqT.addEventListener('click', () => {
          const r = equipWorkerTool(this.inv, w.id, 'speed');
          this.bayLog(r.msg);
          if (r.ok) {
            this.audio.playPickup();
            this.syncWorkerAgentsLoadout();
            writeSlot(this.activeSlot, this.buildSaveData());
          }
          this.fillBayPanel();
        });
        actions.appendChild(eqT);
        const eqP = document.createElement('button');
        eqP.type = 'button';
        eqP.textContent = 'Equip pack';
        eqP.addEventListener('click', () => {
          const r = equipWorkerTool(this.inv, w.id, 'haul');
          this.bayLog(r.msg);
          if (r.ok) {
            this.audio.playPickup();
            this.syncWorkerAgentsLoadout();
            writeSlot(this.activeSlot, this.buildSaveData());
          }
          this.fillBayPanel();
        });
        actions.appendChild(eqP);
        const goProg = document.createElement('button');
        goProg.type = 'button';
        goProg.textContent = 'Assign in Programs…';
        goProg.addEventListener('click', () => {
          this.closeBay();
          this.openProgram();
        });
        actions.appendChild(goProg);
        card.appendChild(actions);
        wrEl.appendChild(card);
      }
    }
    if (invnEl) {
      invnEl.innerHTML = '';
      if (!canInvent(this.inv)) {
        invnEl.innerHTML =
          '<p class="craft-hint">Unlock invent: expand bay to Workshop Wing (L3) or lease a city workshop (industrial).</p>';
      } else {
        const intro = document.createElement('p');
        intro.className = 'craft-hint';
        intro.textContent =
          'Market cycle: invent → craft at workbench → stock multi-plaza stalls (premium plazas pay invent bonus). Lab fee rises with each prototype.';
        invnEl.appendChild(intro);
        const row = document.createElement('div');
        row.className = 'bay-invent-row';
        const a = document.createElement('select');
        a.id = 'invent-a';
        const b = document.createElement('select');
        b.id = 'invent-b';
        const mats: CommodityId[] = [
          'cloud_iron',
          'scrap_brass',
          'spore_silk',
          'sky_salt',
          'wire',
          'gear_blank',
        ];
        for (const id of mats) {
          for (const sel of [a, b]) {
            const o = document.createElement('option');
            o.value = id;
            o.textContent = `${COMMODITIES[id].name} (×${this.inv.items[id] ?? 0})`;
            sel.appendChild(o);
          }
        }
        b.selectedIndex = 1;
        const go = document.createElement('button');
        go.type = 'button';
        go.textContent = 'Prototype invention (2 of each + lab fee)';
        go.addEventListener('click', () => {
          const r = inventCustomRecipe(
            this.inv,
            a.value as CommodityId,
            b.value as CommodityId,
          );
          this.bayLog(r.msg);
          if (r.ok) {
            this.audio.playPickup();
            this.objective = this.megaCityActive
              ? this.megaCityObjective()
              : this.skyCityObjective();
            writeSlot(this.activeSlot, this.buildSaveData());
            this.fillBayPanel();
            this.syncEconomyHud();
          }
        });
        row.appendChild(a);
        row.appendChild(b);
        row.appendChild(go);
        invnEl.appendChild(row);
        for (const cr of this.inv.customRecipes) {
          const d = document.createElement('div');
          d.className = 'bay-inv-row';
          const stock = this.inv.customStock[cr.id] ?? 0;
          d.textContent = `Book: ${cr.name} Q${cr.quality ?? 1} · sells ~${cr.sellValue}b · stock ${stock} · ${cr.inputs
            .map((i) => COMMODITIES[i.id].name)
            .join(' + ')}`;
          invnEl.appendChild(d);
        }
      }
    }
  }

  private bayLog(msg: string) {
    const log = document.getElementById('bay-log');
    if (log) log.textContent = msg;
  }

  private openBoardShop() {
    this.syncBoardOwnership();
    this.boardShopOpen = true;
    const panel = document.getElementById('board-panel');
    const wallet = document.getElementById('board-wallet');
    const log = document.getElementById('board-log');
    if (wallet) wallet.textContent = `Brass ${this.inv.brass}`;
    if (log) {
      log.textContent = this.inv.playerBoard.owned
        ? 'You already own a chassis — upgrades only (one purchase forever).'
        : '';
    }
    this.fillBoardShop();
    panel?.classList.remove('hidden');
    panel?.setAttribute('aria-hidden', 'false');
    try {
      this.controls.unlock();
    } catch {
      /* ignore */
    }
  }

  private closeBoardShop() {
    this.boardShopOpen = false;
    const panel = document.getElementById('board-panel');
    panel?.classList.add('hidden');
    panel?.setAttribute('aria-hidden', 'true');
    if (!this.paused && !this.disposed) this.controls.lock();
  }

  private fillBoardShop() {
    const list = document.getElementById('board-shop-list');
    if (!list) return;
    list.innerHTML = '';
    const mk = (label: string, done: boolean, fn: () => void) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = done ? `✓ ${label}` : label;
      b.disabled = done;
      if (!done) b.addEventListener('click', fn);
      list.appendChild(b);
    };
    mk(`Buy board chassis (${BOARD_BASE_COST} brass)`, this.inv.playerBoard.owned, () => {
      const r = buyPlayerBoard(this.inv);
      this.boardShopLog(r.msg);
      if (r.ok) {
        this.brass = this.inv.brass;
        this.boardOwned = true;
        this.inv.playerBoard.owned = true;
        this.ensureMarketBoard();
        this.audio.playPickup();
        this.toast('Board ready anytime — press Q to ride, Q again to stow. Tab switches camera.', 4);
        this.objective = this.megaCityActive
          ? this.megaCityObjective()
          : this.skyCityObjective();
        writeSlot(this.activeSlot, this.buildSaveData());
      }
      this.fillBoardShop();
      this.syncBoardWallet();
      this.syncEconomyHud();
    });
    mk(`Fit thruster (${BOARD_THRUSTER_COST}b) — walk speed`, this.inv.playerBoard.thruster, () => {
      const r = upgradePlayerBoard(this.inv, 'thruster');
      this.boardShopLog(r.msg);
      if (r.ok) {
        this.brass = this.inv.brass;
        this.audio.playPickup();
        writeSlot(this.activeSlot, this.buildSaveData());
      }
      this.fillBoardShop();
      this.syncBoardWallet();
      this.syncEconomyHud();
    });
    mk(`Fit rails (${BOARD_RAILS_COST}b)`, this.inv.playerBoard.rails, () => {
      const r = upgradePlayerBoard(this.inv, 'rails');
      this.boardShopLog(r.msg);
      if (r.ok) {
        this.brass = this.inv.brass;
        this.audio.playPickup();
        writeSlot(this.activeSlot, this.buildSaveData());
      }
      this.fillBoardShop();
      this.syncBoardWallet();
      this.syncEconomyHud();
    });
    mk(`Upgrade deck (${BOARD_DECK_COST}b)`, this.inv.playerBoard.deck, () => {
      const r = upgradePlayerBoard(this.inv, 'deck');
      this.boardShopLog(r.msg);
      if (r.ok) {
        this.brass = this.inv.brass;
        this.audio.playPickup();
        writeSlot(this.activeSlot, this.buildSaveData());
      }
      this.fillBoardShop();
      this.syncBoardWallet();
      this.syncEconomyHud();
    });
  }

  private syncBoardWallet() {
    const wallet = document.getElementById('board-wallet');
    if (wallet) wallet.textContent = `Brass ${this.inv.brass}`;
  }

  private boardShopLog(msg: string) {
    const log = document.getElementById('board-log');
    if (log) log.textContent = msg;
  }

  private openProgram() {
    this.programOpen = true;
    if (!this.activeProgramId && this.inv.programs[0]) {
      this.activeProgramId = this.inv.programs[0].id;
    }
    const panel = document.getElementById('program-panel');
    panel?.classList.remove('hidden');
    panel?.setAttribute('aria-hidden', 'false');
    this.fillProgramPanel();
    try {
      this.controls.unlock();
    } catch {
      /* ignore */
    }
  }

  private closeProgram() {
    this.programOpen = false;
    const panel = document.getElementById('program-panel');
    panel?.classList.add('hidden');
    panel?.setAttribute('aria-hidden', 'true');
    if (!this.paused && !this.disposed) this.controls.lock();
  }

  private programLog(msg: string) {
    const log = document.getElementById('program-log');
    if (log) log.textContent = msg;
  }

  private fillProgramPanel() {
    const list = document.getElementById('program-list');
    const nodesEl = document.getElementById('program-nodes');
    const addEl = document.getElementById('program-add-nodes');
    const assignEl = document.getElementById('program-assign');
    const title = document.getElementById('program-edit-title');
    if (!list || !nodesEl || !addEl || !assignEl) return;

    list.innerHTML = '';
    for (const p of this.inv.programs) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = `${p.name} (${p.nodes.length} nodes)`;
      if (p.id === this.activeProgramId) b.style.borderColor = '#88e0ff';
      b.addEventListener('click', () => {
        this.activeProgramId = p.id;
        this.fillProgramPanel();
      });
      list.appendChild(b);
    }

    const prog = this.inv.programs.find((p) => p.id === this.activeProgramId);
    if (title) title.textContent = prog ? `Nodes · ${prog.name}` : 'Nodes';
    nodesEl.innerHTML = '';
    if (!prog) {
      nodesEl.innerHTML = '<p class="craft-hint">Create a program first.</p>';
    } else {
      prog.nodes.forEach((n, i) => {
        const row = document.createElement('div');
        row.className = 'program-node';
        const def = PROGRAM_NODE_DEFS.find((d) => d.id === n);
        row.innerHTML = `<span class="pn-idx">${i + 1}</span><span>${def?.name ?? n}</span>`;
        const acts = document.createElement('div');
        acts.className = 'pn-actions';
        const up = document.createElement('button');
        up.type = 'button';
        up.textContent = '↑';
        up.addEventListener('click', () => {
          moveProgramNode(this.inv, prog.id, i, -1);
          writeSlot(this.activeSlot, this.buildSaveData());
          this.fillProgramPanel();
        });
        const dn = document.createElement('button');
        dn.type = 'button';
        dn.textContent = '↓';
        dn.addEventListener('click', () => {
          moveProgramNode(this.inv, prog.id, i, 1);
          writeSlot(this.activeSlot, this.buildSaveData());
          this.fillProgramPanel();
        });
        const rm = document.createElement('button');
        rm.type = 'button';
        rm.textContent = '×';
        rm.addEventListener('click', () => {
          removeProgramNode(this.inv, prog.id, i);
          writeSlot(this.activeSlot, this.buildSaveData());
          this.fillProgramPanel();
          this.syncWorkerAgentsLoadout();
        });
        acts.appendChild(up);
        acts.appendChild(dn);
        acts.appendChild(rm);
        row.appendChild(acts);
        nodesEl.appendChild(row);
      });
    }

    // Category chips + compact picker (same pattern as workbench)
    const filterEl = document.getElementById('program-filters');
    const blurbEl = document.getElementById('program-add-blurb');
    const addBtn = document.getElementById('program-add-btn') as HTMLButtonElement | null;
    type ProgFilter =
      | 'haul'
      | 'craft'
      | 'market_sell'
      | 'market_buy'
      | 'service'
      | 'stall';
    const cats: { id: ProgFilter; label: string }[] = [
      { id: 'haul', label: 'Haul' },
      { id: 'craft', label: 'Craft' },
      { id: 'market_sell', label: 'Sell' },
      { id: 'market_buy', label: 'Buy' },
      { id: 'stall', label: 'Stall' },
      { id: 'service', label: 'Service' },
    ];
    if (filterEl) {
      filterEl.innerHTML = '';
      for (const c of cats) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'ui-chip' + (this.programFilter === c.id ? ' active' : '');
        b.textContent = c.label;
        b.addEventListener('click', () => {
          this.programFilter = c.id;
          this.programPickNode = null;
          this.fillProgramPanel();
        });
        filterEl.appendChild(b);
      }
    }

    const catNodes = PROGRAM_NODE_DEFS.filter((d) => d.category === this.programFilter);
    if (
      this.programPickNode &&
      !catNodes.some((d) => d.id === this.programPickNode)
    ) {
      this.programPickNode = null;
    }
    if (!this.programPickNode && catNodes[0]) {
      this.programPickNode = catNodes[0].id;
    }

    addEl.innerHTML = '';
    for (const def of catNodes) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = def.name;
      if (def.id === this.programPickNode) b.classList.add('prog-node-selected');
      b.addEventListener('click', () => {
        this.programPickNode = def.id;
        this.fillProgramPanel();
      });
      addEl.appendChild(b);
    }

    const picked = PROGRAM_NODE_DEFS.find((d) => d.id === this.programPickNode);
    if (blurbEl) {
      blurbEl.textContent = picked
        ? `${picked.name} — ${picked.blurb}`
        : 'Select a node type, then Add.';
    }
    if (addBtn) {
      if (addBtn.dataset.wired !== '1') {
        addBtn.dataset.wired = '1';
        addBtn.addEventListener('click', () => {
          if (!this.activeProgramId || !this.programPickNode) return;
          const r = addProgramNode(this.inv, this.activeProgramId, this.programPickNode);
          this.programLog(r.msg);
          writeSlot(this.activeSlot, this.buildSaveData());
          this.fillProgramPanel();
          this.syncWorkerAgentsLoadout();
        });
      }
      addBtn.disabled = !this.activeProgramId || !this.programPickNode;
      addBtn.textContent = picked ? `Add · ${picked.name}` : 'Add to program';
    }

    assignEl.innerHTML = '';
    if (this.inv.workers.length === 0) {
      assignEl.innerHTML =
        '<span class="craft-hint">Hire a worker first (Hire Board at workshop).</span>';
    }
    const sites = listHarvestSites();
    // In training, still show mixed + a few empire sites for planning; all work via pool
    for (const w of this.inv.workers) {
      if (w.harvestSiteId === undefined) w.harvestSiteId = null;
      const card = document.createElement('div');
      card.className = 'program-assign-card';
      const runningProg =
        w.job === 'program' && w.programId === this.activeProgramId;
      const status = describeWorkerAssignment(this.inv, w);
      card.innerHTML = `<strong>${w.name}</strong><div class="pa-status">${status}${
        runningProg ? ' · this program' : ''
      }</div>`;

      // Harvest reef site (applies to harvest job + harvest program nodes)
      const reefRow = document.createElement('div');
      reefRow.className = 'pa-row';
      const reefLab = document.createElement('label');
      reefLab.className = 'pa-lab';
      reefLab.textContent = 'REEF';
      const reefSel = document.createElement('select');
      for (const s of sites) {
        const o = document.createElement('option');
        o.value = s.id ?? '';
        o.textContent = `${s.name} (${s.mats.map((m) => COMMODITIES[m].name.split(' ')[0]).join('/')})`;
        if ((w.harvestSiteId ?? '') === (s.id ?? '')) o.selected = true;
        reefSel.appendChild(o);
      }
      reefSel.addEventListener('change', () => {
        const id = reefSel.value === '' ? null : reefSel.value;
        const r = setWorkerHarvestSite(this.inv, w.id, id);
        this.programLog(r.msg);
        // Auto-set harvest job if idle-ish so reef choice does work immediately
        if (w.job === 'idle' || w.job === 'harvest') {
          setWorkerJob(this.inv, w.id, 'harvest');
        }
        writeSlot(this.activeSlot, this.buildSaveData());
        this.fillProgramPanel();
        this.syncEconomyHud();
      });
      reefRow.appendChild(reefLab);
      reefRow.appendChild(reefSel);
      card.appendChild(reefRow);

      // Quick jobs
      const jobRow = document.createElement('div');
      jobRow.className = 'pa-row';
      const jobLab = document.createElement('label');
      jobLab.className = 'pa-lab';
      jobLab.textContent = 'JOB';
      jobRow.appendChild(jobLab);
      for (const j of JOB_DEFS) {
        if (j.id === 'program') continue;
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = j.name;
        if (w.job === j.id) b.classList.add('active');
        b.title = j.blurb;
        b.addEventListener('click', () => {
          const r = setWorkerJob(this.inv, w.id, j.id as JobId);
          this.programLog(r.msg);
          this.syncWorkerAgentsLoadout();
          writeSlot(this.activeSlot, this.buildSaveData());
          this.fillProgramPanel();
          this.syncEconomyHud();
        });
        jobRow.appendChild(b);
      }
      card.appendChild(jobRow);

      // Assign this program
      const progRow = document.createElement('div');
      progRow.className = 'pa-row';
      const progLab = document.createElement('label');
      progLab.className = 'pa-lab';
      progLab.textContent = 'PROG';
      progRow.appendChild(progLab);
      const assignBtn = document.createElement('button');
      assignBtn.type = 'button';
      assignBtn.className = 'primary';
      assignBtn.textContent = runningProg
        ? `✓ Running this program`
        : this.activeProgramId
          ? `Run “${prog?.name ?? 'program'}”`
          : 'Select a program first';
      assignBtn.disabled = !this.activeProgramId;
      assignBtn.addEventListener('click', () => {
        if (!this.activeProgramId) return;
        const r = assignWorkerProgram(this.inv, w.id, this.activeProgramId);
        this.programLog(r.msg);
        this.syncWorkerAgentsLoadout();
        writeSlot(this.activeSlot, this.buildSaveData());
        this.fillProgramPanel();
        this.syncEconomyHud();
      });
      progRow.appendChild(assignBtn);
      if (w.job === 'program' && w.programId && w.programId !== this.activeProgramId) {
        const other = this.inv.programs.find((p) => p.id === w.programId);
        const note = document.createElement('span');
        note.className = 'craft-hint';
        note.textContent = `on “${other?.name ?? 'other'}”`;
        progRow.appendChild(note);
      }
      card.appendChild(progRow);

      assignEl.appendChild(card);
    }
  }

  private fillMarketLists(v: VendorDef) {
    const buyList = document.getElementById('market-buy-list');
    const sellList = document.getElementById('market-sell-list');
    if (!buyList || !sellList) return;
    buyList.innerHTML = '';
    sellList.innerHTML = '';
    for (const id of v.stock) {
      const def = COMMODITIES[id];
      const price = Math.round(def.baseSell * v.sellMul);
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = `Buy ${def.name} · ${price} brass`;
      b.addEventListener('click', () => {
        const r = buyFromVendor(this.inv, v, id, 1);
        this.marketLog(r.msg);
        this.brass = this.inv.brass;
        this.fillMarketLists(v);
        this.syncMarketWallet();
        this.syncEconomyHud();
      });
      buyList.appendChild(b);
    }
    for (const id of v.stock) {
      const q = this.inv.items[id] ?? 0;
      if (q < 1) continue;
      const def = COMMODITIES[id];
      const price = Math.round(def.baseBuy * v.buyMul);
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = `Sell ${def.name} (×${q}) · ${price} ea`;
      b.addEventListener('click', () => {
        const r = sellToVendor(this.inv, v, id, 1);
        this.marketLog(r.msg);
        this.brass = this.inv.brass;
        this.fillMarketLists(v);
        this.syncMarketWallet();
        this.syncEconomyHud();
      });
      sellList.appendChild(b);
    }
    if (sellList.children.length === 0) {
      const p = document.createElement('p');
      p.style.cssText = 'color:#6a7a8a;font-size:0.75rem;margin:0';
      p.textContent = 'Nothing they want yet — try the reef.';
      sellList.appendChild(p);
    }
  }

  private syncMarketWallet() {
    const wallet = document.getElementById('market-wallet');
    if (wallet) wallet.textContent = `Brass ${this.inv.brass} · Aether ${this.inv.aether}`;
  }

  private marketLog(msg: string) {
    const log = document.getElementById('market-log');
    if (log) log.textContent = msg;
  }

  private openHarvest(opts?: { pool?: CommodityId[]; name?: string }) {
    this.harvestOpen = true;
    this.harvestNeedle = 0;
    this.harvestDir = 1;
    this.harvestPool =
      opts?.pool && opts.pool.length ? [...opts.pool] : [...DEFAULT_HARVEST_POOL];
    this.harvestLabel = opts?.name ?? 'Cloud reef';
    const el = document.getElementById('harvest-overlay');
    el?.classList.remove('hidden');
    el?.setAttribute('aria-hidden', 'false');
    const hint = document.getElementById('harvest-hint');
    if (hint) {
      const mats = this.harvestPool.map((id) => COMMODITIES[id].name).join(', ');
      hint.textContent = this.mobile.enabled
        ? `${this.harvestLabel} · tap EXTRACT in the green zone · yields: ${mats}`
        : `${this.harvestLabel} · Space in green · yields: ${mats}`;
    }
    this.syncMobileGameplay();
    try {
      this.controls.unlock();
    } catch {
      /* ignore */
    }
  }

  private closeHarvest(success: boolean) {
    this.harvestOpen = false;
    const el = document.getElementById('harvest-overlay');
    el?.classList.add('hidden');
    el?.setAttribute('aria-hidden', 'true');
    if (success) {
      const r = applyHarvestSuccess(this.inv, this.harvestPool);
      this.toast(`${this.harvestLabel}: ${r.msg}`, 2.5);
      this.audio.playPickup();
      writeSlot(this.activeSlot, this.buildSaveData());
    } else {
      this.toast('Extraction failed — try again.', 2);
    }
    this.syncEconomyHud();
    this.syncMobileGameplay();
    if (!this.paused && !this.disposed) this.controls.lock();
  }

  private tryHubInteract() {
    if (!this.hub) return false;
    // Board is Q-only in market (always equipped once owned)
    if (!this.hubInteractPrompt) return false;
    const it = this.hubInteractPrompt;
    if (it.kind === 'vendor' && it.vendor) {
      this.openMarket(it.vendor);
      return true;
    }
    if (it.kind === 'harvest') {
      this.openHarvest();
      return true;
    }
    if (it.kind === 'lease_office' || it.kind === 'bay_expand') {
      const r = leaseParcel(this.inv);
      this.toast(r.msg, 3.5);
      if (r.ok && this.hub) {
        this.syncBayVisuals();
        this.rebuildHubNav();
        this.brass = this.inv.brass;
        this.objective = this.skyCityObjective();
        writeSlot(this.activeSlot, this.buildSaveData());
        this.audio.playPickup();
      }
      this.syncEconomyHud();
      return true;
    }
    if (it.kind === 'parcel_chest') {
      if (!this.inv.parcelLeased) {
        this.toast('Lease this bay at the Lease Office first (25 brass).', 3);
        return true;
      }
      this.openBay();
      return true;
    }
    if (it.kind === 'craft_bench') {
      this.openCraft();
      return true;
    }
    if (it.kind === 'hire_board') {
      // Hire if under cap, then open bay workers tab
      if (this.inv.workers.length < maxWorkersForBay(this.inv.bayLevel) || this.inv.workers.length === 0) {
        const r = hireLaborer(this.inv);
        this.toast(r.msg, 3.5);
        if (r.ok) {
          this.brass = this.inv.brass;
          this.syncWorkerAgentsLoadout();
          this.objective = this.skyCityObjective();
          writeSlot(this.activeSlot, this.buildSaveData());
          this.audio.playPickup();
        }
      }
      this.bayTab = 'workers';
      this.openBay();
      this.syncEconomyHud();
      return true;
    }
    if (it.kind === 'robot_broker') {
      const r = sellFrameToBroker(this.inv);
      this.toast(r.msg, 3.5);
      if (r.ok) {
        this.brass = this.inv.brass;
        this.objective = this.skyCityObjective();
        writeSlot(this.activeSlot, this.buildSaveData());
        this.audio.playPickup();
        this.flash(`+${FRAME_BROKER_PRICE} BRASS`);
      }
      this.syncEconomyHud();
      return true;
    }
    if (it.kind === 'repair_job') {
      const r = completeRepair(this.inv);
      this.toast(r.msg, 3.5);
      if (r.ok) {
        this.brass = this.inv.brass;
        this.objective = this.skyCityObjective();
        writeSlot(this.activeSlot, this.buildSaveData());
        this.audio.playPickup();
        this.flash(`REPAIR +${REPAIR_PAY}`);
      }
      this.syncEconomyHud();
      return true;
    }
    if (it.kind === 'board_shop') {
      this.openBoardShop();
      return true;
    }
    if (it.kind === 'invent_desk') {
      if (!canInvent(this.inv)) {
        this.toast(
          'Invent unlocks at Workshop Wing (bay L3+) or with a leased city workshop.',
          3.5,
        );
        return true;
      }
      this.bayTab = 'invent';
      this.openBay();
      return true;
    }
    if (it.kind === 'retail_stall') {
      this.activeStallKey = 'training';
      this.openStall();
      return true;
    }
    if (it.kind === 'real_estate') {
      this.tryBuyApartment();
      return true;
    }
    return false;
  }

  private tryBuyApartment() {
    if (this.inv.apartmentOwned) {
      this.toast('Traveling to your sky apartment…', 2.5);
      const snap = this.buildSaveData();
      writeSlot(this.activeSlot, snap);
      window.setTimeout(() => {
        if (!this.disposed) this.enterMegaCity(snap);
      }, 800);
      return;
    }
    const had = this.inv.brass;
    const r = buyApartment(this.inv);
    this.toast(r.msg, 5);
    if (r.ok) {
      this.brass = this.inv.brass;
      this.objective = this.skyCityObjective();
      this.syncEconomyHud();
      this.winMarketTutorial();
    } else if (had < APARTMENT_COST) {
      this.toast(
        `Short ${APARTMENT_COST - had} brass. Trade, craft, stall, or broker — path east when ready.`,
        4,
      );
    }
  }

  /**
   * Phase 3: true sky city — spawn at apartment, living districts.
   */
  private enterMegaCity(fromSave?: ForgeSaveData | null) {
    // Tear down workshop / market
    if (this.level?.group) this.scene.remove(this.level.group);
    for (const r of this.robots) this.scene.remove(r.mesh);
    for (const h of this.husks) this.scene.remove(h);
    for (const b of this.bolts) this.scene.remove(b.mesh);
    for (const bl of this.blasts) this.scene.remove(bl);
    this.robots = [];
    this.husks = [];
    this.bolts = [];
    this.blasts = [];
    this.interactables = [];

    if (this.raceway) {
      this.scene.remove(this.raceway.group);
      this.raceway = null;
    }
    if (this.floatingCity) {
      this.scene.remove(this.floatingCity.group);
      this.floatingCity = null;
    }
    if (this.board) {
      this.scene.remove(this.board.mesh);
      this.board = null;
    }
    if (this.hub) {
      this.scene.remove(this.hub.group);
      this.hub = null;
    }
    if (this.skyCity) {
      this.scene.remove(this.skyCity.group);
      this.skyCity = null;
    }

    // Preserve live inventory when traveling in-session (don't wipe board ownership)
    if (fromSave?.economy) {
      this.inv = invFromSave(fromSave.economy, fromSave.brass ?? Math.max(40, this.brass));
    } else if (fromSave) {
      this.inv = invFromSave(null, fromSave.brass ?? Math.max(40, this.brass));
    }
    // else: keep this.inv as-is
    if (fromSave?.boardOwned) this.boardOwned = true;
    // Must have deed to live here
    if (!this.inv.apartmentOwned) {
      this.inv.apartmentOwned = true;
    }
    this.syncBoardOwnership();
    this.brass = this.inv.brass;
    const seed =
      fromSave?.backstorySeed ?? this.backstory?.seed ?? ((Math.random() * 0xffffffff) >>> 0);
    this.backstory = generateBackstory(seed);

    this.skyCity = buildSkyCity();
    this.scene.add(this.skyCity.group);
    this.colliders = [...this.skyCity.colliders];
    this.initCityEditor(this.skyCity.mats);
    this.syncCityWorkshopVisuals();
    this.syncCityStallVisuals();
    this.cityWorkerAcc = 0;
    this.skyCity.stallGroup.visible = this.inv.stall.owned;

    this.scene.background = new THREE.Color(0x5a7a9a);
    this.scene.fog = new THREE.Fog(0x7a9ab8, 80, 900);
    this.camera.far = 1200;
    this.camera.fov = 70;
    this.camera.updateProjectionMatrix();
    this.camera.up.set(0, 1, 0);

    this.megaCityActive = true;
    this.economyActive = true; // reuse economy UI / board / craft
    this.raceActive = false;
    this.won = false;
    this.tutorial = 'race'; // city phase flag lives on levelId mega_city
    this.cityTime = 0.25;
    this.neighborLineIdx = 0;
    this.velocity.set(0, 0, 0);
    this.onGround = true;
    this.respawnCd = 0;
    this.fallKillY = this.skyCity.lowestY - 20;
    this.syncCityStallVisuals();
    this.updateNavCompass(); // show home/work compass immediately
    this.wireCityMapUi();
    this.cityMapOpen = false;
    this.cityMapSelectedId = null;
    this.cityMapCam = null;
    this.cityMapDrag = null;
    this.upkeepAcc = 0;
    this.stallAcc = 0;
    this.craftOpen = false;
    this.bayOpen = false;
    this.boardShopOpen = false;
    this.programOpen = false;
    this.stallOpen = false;

    this.camera.position.copy(this.skyCity.apartmentSpawn);
    this.safePos.copy(this.skyCity.apartmentSpawn);

    this.ensureMarketBoard();
    // Method side-effect assigns board; assert past CFA after explicit null above
    const cityBoard = this.board as Surfboard | null;
    if (cityBoard) {
      cityBoard.mesh.visible = false;
      cityBoard.position.copy(this.skyCity.apartmentSpawn);
      cityBoard.position.y = 0.55;
    }

    this.objective = this.megaCityObjective();
    this.setHelp(
      this.boardOwned || this.inv.playerBoard.owned
        ? 'Home · E · Q board · M map · wind skyways · I · Esc'
        : 'Home · E neighbor · M map · board shop · wind skyways only',
    );
    this.flash(fromSave ? 'HOME — EMPIRE SKY CITY' : 'YOUR SKY APARTMENT');
    this.toast(
      'Empire loop: lease industrial workshop · harvest reefs · expand at Sky Foundry · invent → craft → stalls.',
      6.5,
    );
    window.setTimeout(() => {
      if (this.disposed || !this.megaCityActive) return;
      this.toast(
        'Workshop: craft · hire · invent. Expand yards: board west to Sky Foundry. Q wind skyways.',
        7,
      );
    }, 6500);

    this.audio.setWind(0.35);
    this.syncEconomyHud();
    writeSlot(this.activeSlot, this.buildSaveData());
    this.syncMobileGameplay();
    this.controls.lock();
  }

  private megaCityObjective(): string {
    const shops = ownedCityStallCount(this.inv);
    if (!this.inv.cityWorkshopLeased) {
      return 'Industrial west · lease empire workshop (craft · hire · invent)';
    }
    if (!this.inv.playerBoard.owned && !this.boardOwned) {
      return 'Board shop · Q wind skyways · harvest reefs have different mats';
    }
    if (this.inv.harvestRuns < 3) {
      return 'Harvest specialized reefs · Harbor salt · Spore silk · Foundry scrap';
    }
    if (this.inv.workers.length < 1) {
      return 'Hire board at workshop · equip workers · raise pay for long programs';
    }
    if (this.inv.customRecipes.length < 1) {
      return 'Invent desk · craft inventions · stock premium plaza stalls';
    }
    if (shops < 1) {
      return 'Lease multi-plaza stalls · Spore Gardens / Aether Spire invent premium';
    }
    if (shops < 3) {
      return `Empire shops ${shops}/3+ · expand bay · crew stock stalls across the map`;
    }
    if (this.inv.bayLevel < 4) {
      return `Sky Foundry expand yards · bay L${this.inv.bayLevel} → more crew · shops ${shops}`;
    }
    return `Empire: ${shops} shops · ${this.inv.workers.length} crew · invent sold ${this.inv.inventionsSold ?? 0}`;
  }

  private openStall() {
    this.stallOpen = true;
    const panel = document.getElementById('stall-panel');
    panel?.classList.remove('hidden');
    panel?.setAttribute('aria-hidden', 'false');
    this.fillStallPanel();
    try {
      this.controls.unlock();
    } catch {
      /* ignore */
    }
  }

  private closeStall() {
    this.stallOpen = false;
    const panel = document.getElementById('stall-panel');
    panel?.classList.add('hidden');
    panel?.setAttribute('aria-hidden', 'true');
    if (!this.paused && !this.disposed) this.controls.lock();
  }

  private stallLog(msg: string) {
    const log = document.getElementById('stall-log');
    if (log) log.textContent = msg;
  }

  private getActiveStall() {
    if (this.activeStallKey === 'training' || !this.activeStallKey) {
      return { stall: this.inv.stall, label: 'Training market', districtId: null as string | null };
    }
    const dist = districtById(this.activeStallKey);
    const stall = ensureCityStall(this.inv, this.activeStallKey);
    return {
      stall,
      label: dist?.name ?? this.activeStallKey,
      districtId: this.activeStallKey as string | null,
    };
  }

  private syncCityStallVisuals() {
    if (!this.skyCity?.districtStallGroups) return;
    for (const [id, g] of Object.entries(this.skyCity.districtStallGroups)) {
      g.visible = !!this.inv.cityStalls?.[id]?.owned;
    }
    // Legacy group
    if (this.skyCity.stallGroup) {
      const gm = this.inv.cityStalls?.['grand_market'];
      this.skyCity.stallGroup.visible = !!gm?.owned;
    }
  }

  private fillStallPanel() {
    const wallet = document.getElementById('stall-wallet');
    const status = document.getElementById('stall-status');
    const actions = document.getElementById('stall-actions');
    const shelf = document.getElementById('stall-shelf');
    const stockBtns = document.getElementById('stall-stock-btns');
    const { stall, label, districtId } = this.getActiveStall();
    const dist = districtId ? districtById(districtId) : null;
    const shops = ownedCityStallCount(this.inv);

    if (wallet) {
      const dem = stall.lastDemand ?? '—';
      wallet.textContent = `Brass ${this.inv.brass} · ${label} · sales ${stall.sales} · earned ${stall.earned} · demand ${dem} · empire shops ${shops}`;
    }
    if (status) {
      if (!stall.owned) {
        const cost = dist?.stallCost ?? STALL_LEASE_COST;
        status.textContent = districtId
          ? `Lease stall in ${label} for ${cost}b (invent bonus ×${dist?.inventBonus ?? 1}). Multi-plaza network = empire cashflow.`
          : `No stall yet · lease for ${STALL_LEASE_COST} brass. Set ask prices once stocked.`;
      } else if (stall.pendingHaggle) {
        const h = stall.pendingHaggle;
        status.textContent = `HAGGLE · ${COMMODITIES[h.id].name} offer ${h.offer}b (ask ${h.ask}b · fair ${h.fair}b) · ${h.ttl} checks left`;
      } else {
        const bonus = dist ? ` · invent ×${dist.inventBonus}` : '';
        status.textContent = stall.open
          ? `OPEN @ ${label} · demand ${stall.lastDemand ?? 'Steady'}${bonus} · stock inventions for premium plazas`
          : `CLOSED @ ${label} · toggle open when ready`;
      }
    }
    if (actions) {
      actions.innerHTML = '';
      if (stall.owned && stall.pendingHaggle) {
        const h = stall.pendingHaggle;
        const acc = document.createElement('button');
        acc.type = 'button';
        acc.textContent = `Accept ${h.offer}b`;
        acc.addEventListener('click', () => {
          const r = resolveStallHaggle(this.inv, true, stall);
          this.stallLog(r.msg);
          if (r.ok) {
            this.brass = this.inv.brass;
            this.audio.playPickup();
          }
          writeSlot(this.activeSlot, this.buildSaveData());
          this.fillStallPanel();
          this.syncEconomyHud();
        });
        actions.appendChild(acc);
        const ref = document.createElement('button');
        ref.type = 'button';
        ref.textContent = 'Refuse';
        ref.addEventListener('click', () => {
          const r = resolveStallHaggle(this.inv, false, stall);
          this.stallLog(r.msg);
          writeSlot(this.activeSlot, this.buildSaveData());
          this.fillStallPanel();
        });
        actions.appendChild(ref);
      }
      if (!stall.owned) {
        const b = document.createElement('button');
        b.type = 'button';
        const cost = dist?.stallCost ?? STALL_LEASE_COST;
        b.textContent = `Lease ${label} (${cost}b)`;
        b.addEventListener('click', () => {
          const r = districtId
            ? leaseCityStall(this.inv, districtId)
            : leaseStall(this.inv);
          this.stallLog(r.msg);
          if (r.ok) {
            this.brass = this.inv.brass;
            this.syncStallVisual();
            this.syncCityStallVisuals();
            this.audio.playPickup();
            writeSlot(this.activeSlot, this.buildSaveData());
          }
          this.fillStallPanel();
          this.syncEconomyHud();
        });
        actions.appendChild(b);
      } else {
        const open = document.createElement('button');
        open.type = 'button';
        open.textContent = stall.open ? 'Close stall' : 'Open stall';
        open.addEventListener('click', () => {
          const r = districtId
            ? toggleCityStallOpen(this.inv, districtId)
            : toggleStallOpen(this.inv);
          this.stallLog(r.msg);
          writeSlot(this.activeSlot, this.buildSaveData());
          this.fillStallPanel();
        });
        actions.appendChild(open);
        const mkToggle = (lab: string, key: 'autoFrames' | 'autoHarvest' | 'autoWire' | 'autoInvent') => {
          const b = document.createElement('button');
          b.type = 'button';
          const on = key === 'autoInvent' ? !!stall.autoInvent : !!stall[key];
          b.textContent = `${on ? '✓' : '·'} ${lab}`;
          b.addEventListener('click', () => {
            if (key === 'autoInvent') stall.autoInvent = !stall.autoInvent;
            else stall[key] = !stall[key];
            writeSlot(this.activeSlot, this.buildSaveData());
            this.fillStallPanel();
          });
          actions.appendChild(b);
        };
        mkToggle('Auto frames', 'autoFrames');
        mkToggle('Auto harvest', 'autoHarvest');
        mkToggle('Auto wire', 'autoWire');
        mkToggle('Auto invent', 'autoInvent');
      }
    }
    if (shelf) {
      shelf.innerHTML = '';
      const entries = Object.entries(stall.shelf).filter(([, n]) => (n ?? 0) > 0);
      const inventEntries = Object.entries(stall.customShelf ?? {}).filter(([, n]) => (n ?? 0) > 0);
      if (!stall.owned) {
        shelf.innerHTML = '<p class="craft-hint">Lease the stall to stock a shelf.</p>';
      } else if (entries.length === 0 && inventEntries.length === 0) {
        shelf.innerHTML =
          '<p class="craft-hint">Shelf empty — stock goods/inventions below. Premium plazas pay invent bonus.</p>';
      } else {
        for (const [cid, n] of entries) {
          const id = cid as CommodityId;
          const fair = fairStallPrice(id, this.inv);
          const ask = getStallAsk(this.inv, id, stall);
          const q = productQuality(id);
          const d = stallDemandInfo(ask, fair, q);
          const card = document.createElement('div');
          card.className = 'stall-price-card';
          card.innerHTML = `
            <div class="stall-price-head">
              <strong>${COMMODITIES[id].name}</strong>
              <span>×${n} · Q${q} · demand <em>${d.label}</em></span>
            </div>
            <div class="stall-price-row">
              <span class="craft-hint">Fair ${fair}b</span>
              <div class="stall-price-btns"></div>
            </div>`;
          const btns = card.querySelector('.stall-price-btns')!;
          const mk = (lab: string, delta: number | 'fair') => {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = lab;
            b.addEventListener('click', () => {
              const r =
                delta === 'fair'
                  ? setStallAsk(this.inv, id, fair, stall)
                  : nudgeStallAsk(this.inv, id, delta, stall);
              this.stallLog(r.msg);
              writeSlot(this.activeSlot, this.buildSaveData());
              this.fillStallPanel();
            });
            btns.appendChild(b);
          };
          mk('−5', -5);
          mk('−1', -1);
          const mid = document.createElement('span');
          mid.className = 'stall-ask-val';
          mid.textContent = `${ask}b ask`;
          btns.appendChild(mid);
          mk('+1', 1);
          mk('+5', 5);
          mk('Fair', 'fair');
          shelf.appendChild(card);
        }
        for (const [rid, n] of inventEntries) {
          const recipe = this.inv.customRecipes.find((r) => r.id === rid);
          if (!recipe) continue;
          const est = Math.round(recipe.sellValue * (dist?.inventBonus ?? 1));
          const row = document.createElement('div');
          row.className = 'stall-price-card';
          row.innerHTML = `<div class="stall-price-head"><strong>Invent · ${recipe.name}</strong><span>×${n} · ~${est}b @ ${label}</span></div>`;
          shelf.appendChild(row);
        }
      }
    }
    if (stockBtns) {
      stockBtns.innerHTML = '';
      if (!stall.owned) return;
      const opts: { id: CommodityId; n: number; label: string }[] = [
        { id: 'basic_frame', n: 1, label: 'Frame ×1' },
        { id: 'fine_frame', n: 1, label: 'Masterwork ×1' },
        { id: 'polished_wire', n: 2, label: 'Polished wire ×2' },
        { id: 'wire', n: 3, label: 'Wire ×3' },
        { id: 'scrap_brass', n: 5, label: 'Scrap ×5' },
        { id: 'cloud_iron', n: 3, label: 'Iron ×3' },
        { id: 'gear_blank', n: 2, label: 'Gear ×2' },
        { id: 'repair_kit', n: 2, label: 'Kit ×2' },
      ];
      for (const o of opts) {
        const b = document.createElement('button');
        b.type = 'button';
        const have = this.inv.items[o.id] ?? 0;
        const fair = fairStallPrice(o.id, this.inv);
        b.textContent = `${o.label} (have ${have} · fair ${fair}b)`;
        b.disabled = have < o.n;
        b.addEventListener('click', () => {
          const r = stockStallFromInv(this.inv, o.id, o.n, undefined, stall);
          this.stallLog(r.msg);
          if (r.ok) {
            this.audio.playPickup();
            writeSlot(this.activeSlot, this.buildSaveData());
          }
          this.fillStallPanel();
          this.syncEconomyHud();
        });
        stockBtns.appendChild(b);
      }
      // Invention stock buttons — full market cycle
      for (const cr of this.inv.customRecipes) {
        const have = this.inv.customStock[cr.id] ?? 0;
        const b = document.createElement('button');
        b.type = 'button';
        const est = Math.round(cr.sellValue * (dist?.inventBonus ?? 1));
        b.textContent = `Invent ${cr.name} ×1 (have ${have} · ~${est}b here)`;
        b.disabled = have < 1;
        b.addEventListener('click', () => {
          const r = stockInventionOnStall(this.inv, cr.id, 1, stall);
          this.stallLog(r.msg);
          if (r.ok) {
            this.audio.playPickup();
            writeSlot(this.activeSlot, this.buildSaveData());
          }
          this.fillStallPanel();
          this.syncEconomyHud();
        });
        stockBtns.appendChild(b);
      }
    }
  }

  private tickRace(dt: number) {
    if (!this.raceway || !this.board) return;
    this.respawnCd = Math.max(0, this.respawnCd - dt);

    // Floating city sample: bob platforms, pulse domes, sway free-float props
    if (this.floatingCity) {
      this.floatTime += dt;
      this.floatingCity.animate(this.floatTime, dt);
      this.colliders = [...this.raceway.colliders, ...this.floatingCity.colliders];
      // Bobbing platforms slightly change min Y — keep kill plane under them
      if (Math.floor(this.floatTime * 2) !== Math.floor((this.floatTime - dt) * 2)) {
        this.refreshFallKillY();
      }
    }

    this.board.tickIdle(dt);
    const nearBoard =
      !this.board.mounted && this.camera.position.distanceTo(this.board.position) < 8;

    if (!this.board.mounted) {
      this.audio.setBoardAudio(nearBoard && !this.boardOwned ? 1 : 0.15, 0);
      this.applySpeedFx(0, 0);
      if (this.camera.fov > BOARD.fovBase + 1) {
        this.camera.fov = THREE.MathUtils.damp(this.camera.fov, BOARD.fovBase, 6, dt);
        this.camera.updateProjectionMatrix();
      }
      this.camera.up.set(0, 1, 0);
      this.updateBoardCarryVisual();

      const forward = new THREE.Vector3();
      this.camera.getWorldDirection(forward);
      forward.y = 0;
      if (forward.lengthSq() < 1e-6) forward.set(0, 0, 1);
      else forward.normalize();
      const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
      const wish = new THREE.Vector3();
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) wish.add(forward);
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) wish.sub(forward);
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) wish.add(right);
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) wish.sub(right);
      if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(MOVE_SPEED);
      this.velocity.x = wish.x;
      this.velocity.z = wish.z;
      this.velocity.y -= GRAVITY * dt;
      if ((this.keys.has('Space') || this.keys.has('KeyJ')) && this.onGround) {
        this.velocity.y = JUMP_VEL;
        this.onGround = false;
      }

      const nearCity =
        !!this.floatingCity &&
        this.camera.position.distanceTo(this.floatingCity.sampleCenter) < 100;

      if (this.floatingCity && this.floatingCity.colliders.length > 0 && nearCity) {
        // City walk: collision only — no race-path magnet / no safePos teleports mid-walk
        this.moveWithCollisionCity(dt);
      } else if (this.floatingCity && this.floatingCity.colliders.length > 0) {
        this.moveWithCollision(dt);
        this.snapToGround(0.9);
        if (!this.onGround) this.snapRaceFeetToRoad(dt);
      } else {
        this.camera.position.x += this.velocity.x * dt;
        this.camera.position.z += this.velocity.z * dt;
        this.camera.position.y += this.velocity.y * dt;
        this.snapRaceFeetToRoad(dt);
      }

      if (this.camera.position.y < this.fallKillY && this.respawnCd <= 0) {
        this.respawnAtCheckpoint(true);
      }
      this.audio.setWind(0.4);
      if (this.elias) {
        this.elias.update(
          dt,
          false,
          null,
          this.camera.position,
          this.raceway.path,
          this.raceway.pathDist,
        );
      }
      return;
    }

    // ——— Mounted ———
    let accel = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) accel += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) accel -= 1;
    let steer = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) steer -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) steer += 1;
    // Shift only — Ctrl is fire in workshop and was falsely holding slide
    const slideHeld = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');

    // Prefer translucent sky-lane paths near the floating district
    let surfPath = this.raceway.path;
    let surfDist = this.raceway.pathDist;
    if (this.floatingCity) {
      const sky = this.floatingCity.preferSurfPath(this.board.position);
      if (sky && sky.lateral < 28) {
        const raceNear = nearestOnPath(
          this.raceway.path,
          this.raceway.pathDist,
          this.board.position,
        );
        const raceLat = Math.hypot(
          this.board.position.x - raceNear.point.x,
          this.board.position.z - raceNear.point.z,
        );
        // Use sky lane when closer than the racetrack corridor
        if (sky.lateral < raceLat + 6 || raceLat > 20) {
          surfPath = sky.path;
          surfDist = sky.pathDist;
        }
      }
    }

    this.board.tick(
      dt,
      accel,
      steer,
      surfPath,
      surfDist,
      slideHeld,
      this.raceway.ramps,
      this.raceway.rails,
      this.raceway.bumpPoints,
    );

    // Board fell below kill plane — soft reset on current surf path (not session spawn)
    if (this.board.position.y < this.fallKillY && this.respawnCd <= 0) {
      this.respawnAtCheckpoint(false);
    }

    // Surf around / land on floating city platforms & bounce off walls
    if (this.floatingCity) {
      const res = this.floatingCity.resolveBoardCollision(
        this.board.position,
        1.55,
        1.1,
        this.board.vy,
      );
      this.board.position.copy(res.pos);
      this.board.vy = res.vy;
      if (res.onGround) {
        this.board.onGround = true;
      }
      this.board.mesh.position.copy(this.board.position);
    }

    if (this.elias) {
      this.elias.update(
        dt,
        true,
        this.board,
        this.camera.position,
        this.raceway.path,
        this.raceway.pathDist,
      );
    }

    // Camera: FOV + blur always; first person sits on deck, third chases
    const sn = this.board.speedNorm;
    const targetFov = THREE.MathUtils.lerp(BOARD.fovBase, BOARD.fovFast, sn * sn);
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 5, dt);
    this.camera.updateProjectionMatrix();

    const tipTarget =
      accel > 0.2 ? BOARD.camTipAccel * (0.5 + sn) : accel < -0.2 ? BOARD.camTipBrake : 0;
    this.camPitchOffset = THREE.MathUtils.damp(this.camPitchOffset, tipTarget, 6, dt);

    const forward = new THREE.Vector3(Math.sin(this.board.yaw), 0, Math.cos(this.board.yaw));
    const right = new THREE.Vector3(forward.z, 0, -forward.x);
    // Board-local up from bank
    const bank = this.board.bank;
    this.camera.up.set(Math.sin(bank) * 0.55, 1, 0).normalize();

    if (this.boardCamMode === 'first') {
      // On the rear deck, looking forward along the board
      const ideal = this.board.position
        .clone()
        .addScaledVector(forward, -0.35)
        .add(new THREE.Vector3(0, 1.05 + (this.board.onGround ? 0 : 0.15), 0));
      // Slight bank sway
      ideal.addScaledVector(right, bank * 0.12);
      this.camera.position.lerp(ideal, 1 - Math.exp(-14 * dt));

      const look = this.board.position
        .clone()
        .addScaledVector(forward, 4.5)
        .add(new THREE.Vector3(0, 0.85 + this.camPitchOffset * 6, 0));
      this.camera.lookAt(look);
    } else {
      const back = forward.clone().multiplyScalar(-1);
      const camDist = 5.2 + sn * 1.4;
      const camHeight = 2.1 + sn * 0.35 + (this.board.onGround ? 0 : 0.4);
      const ideal = this.board.position
        .clone()
        .addScaledVector(back, camDist)
        .add(new THREE.Vector3(0, camHeight, 0));
      if (this.board.isPowersliding()) {
        ideal.addScaledVector(right, this.board.bank * 2.8);
      }
      this.camera.position.lerp(ideal, 1 - Math.exp(-8 * dt));

      const look = this.board.position.clone().add(new THREE.Vector3(0, 0.85, 0));
      look.y += this.camPitchOffset * 8;
      this.camera.lookAt(look);
    }
    this.syncBoardRiderVisibility();

    this.audio.setBoardAudio(0.2, sn);
    this.audio.setWind(0.25 + sn * 0.75);
    this.applySpeedFx(sn, accel);
    this.tickWhooshes(dt);

    const near = nearestOnPath(this.raceway.path, this.raceway.pathDist, this.board.position);
    const pct = Math.min(99, Math.floor((near.dist / this.raceway.totalLength) * 100));
    this.objective = this.raceFinished
      ? 'Racetrack complete!'
      : `Sky road · ${pct}% · CP ${this.checkpointIdx}/${this.raceway.checkpoints.length}`;

    if (!this.raceFinished && this.checkpointIdx < this.raceway.checkpoints.length) {
      const cp = this.raceway.checkpoints[this.checkpointIdx]!;
      if (this.board.position.distanceTo(cp.position) < 18) {
        this.checkpointIdx++;
        this.lastCheckpointPos.copy(cp.position);
        this.lastCheckpointYaw = near.yaw;
        this.audio.playPickup();
        if (this.checkpointIdx < this.raceway.checkpoints.length) {
          this.toast(`Checkpoint ${this.checkpointIdx}`, 1.5);
        }
      }
    }

    if (!this.raceFinished && this.board.position.distanceTo(this.raceway.finishPos) < 14) {
      this.finishRace();
    }
  }

  /**
   * Race road has no mesh colliders — pin feet to nearest path height
   * so on-foot never free-falls into the cloud void.
   * Prefers floating-city floors when standing on sample platforms/docks.
   */
  private snapRaceFeetToRoad(_dt: number) {
    if (!this.raceway) return;

    if (this.floatingCity) {
      const fy = this.floatingCity.sampleFloorY(
        this.camera.position.x,
        this.camera.position.z,
        this.camera.position.y,
      );
      if (fy != null) {
        const standY = fy + PLAYER_H * 0.9;
        if (this.velocity.y <= 0.5 && this.camera.position.y <= standY + 0.45) {
          this.camera.position.y = standY;
          this.velocity.y = 0;
          this.onGround = true;
          this.safePos.copy(this.camera.position);
        }
        return;
      }
    }

    const near = nearestOnPath(
      this.raceway.path,
      this.raceway.pathDist,
      this.camera.position,
    );
    const lateral = Math.hypot(
      this.camera.position.x - near.point.x,
      this.camera.position.z - near.point.z,
    );
    const standY = near.point.y + PLAYER_H * 0.9 + 0.15;
    // Soft pull back onto road if slightly off — skip when exploring floating city
    const nearCity =
      !!this.floatingCity &&
      this.camera.position.distanceTo(this.floatingCity.sampleCenter) < 95;
    if (!nearCity && lateral > 14) {
      const t = Math.min(1, (lateral - 14) / 20);
      this.camera.position.x += (near.point.x - this.camera.position.x) * t * 0.08;
      this.camera.position.z += (near.point.z - this.camera.position.z) * t * 0.08;
    }
    if (lateral < 16) {
      if (this.velocity.y <= 0.5 && this.camera.position.y <= standY + 0.35) {
        this.camera.position.y = standY;
        this.velocity.y = 0;
        this.onGround = true;
        this.safePos.copy(this.camera.position);
      }
    }
    // Do not respawn just for being off the road — only the global kill plane
    // (below lowest content) triggers fall respawn.
  }

  /**
   * Kill plane sits below the lowest race path, placed editor objects,
   * and floating-city solids — so exploring multi-layer sky districts
   * doesn't constantly trigger respawn mid-air.
   */
  private refreshFallKillY() {
    let lowest = Infinity;

    if (this.hub) {
      for (const c of this.hub.colliders) lowest = Math.min(lowest, c.min.y);
      lowest = Math.min(lowest, this.hub.spawn.y);
    }

    if (this.raceway) {
      for (const p of this.raceway.path) lowest = Math.min(lowest, p.y);
      for (const cp of this.raceway.checkpoints) lowest = Math.min(lowest, cp.position.y);
      lowest = Math.min(lowest, this.raceway.boardSpawn.y, this.raceway.finishPos.y);
    }

    const editorLow = this.cityEditor?.lowestObjectY() ?? null;
    if (editorLow != null) lowest = Math.min(lowest, editorLow);

    if (this.floatingCity) {
      lowest = Math.min(lowest, this.floatingCity.lowestContentY());
    }

    if (!Number.isFinite(lowest)) {
      lowest = 0;
    }

    this.fallKillY = lowest - 18;
  }

  /** Put board + player together on the path (mount always reachable). */
  private placeBoardAndPlayerAt(pathPoint: THREE.Vector3, yaw: number, mount: boolean) {
    if (!this.board) return;
    const boardPos = pathPoint.clone();
    boardPos.y = pathPoint.y + BOARD.hoverHeight;
    this.board.position.copy(boardPos);
    this.board.yaw = yaw;
    this.board.velYaw = yaw;
    this.board.speed = 0;
    this.board.vy = 0;
    this.board.slideCharge = 0;
    this.board.sliding = false;
    this.board.mounted = mount;
    this.board.onGround = true;
    this.board.mesh.position.copy(boardPos);
    this.board.mesh.rotation.set(0, yaw, 0);

    const side = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    this.camera.position.set(
      boardPos.x + side.x * 1.6,
      pathPoint.y + PLAYER_H * 0.9 + 0.15,
      boardPos.z + side.z * 1.6,
    );
    this.safePos.copy(this.camera.position);
    this.velocity.set(0, 0, 0);
    this.onGround = true;
    this.camera.fov = BOARD.fovBase;
    this.camera.updateProjectionMatrix();
    this.camera.up.set(0, 1, 0);
    this.applySpeedFx(0, 0);
  }

  private respawnAtCheckpoint(onFoot: boolean) {
    if (!this.raceway || !this.board) return;
    if (this.respawnCd > 0) return;

    if (onFoot || !this.board.mounted) {
      if (this.board.mounted) {
        this.board.dismount();
        this.board.mesh.visible = this.boardOwned ? false : true;
      }
      this.respawnAtLastSafeOrCity();
      this.audio.playBang(0.35);
      return;
    }

    // Boarded fall — re-seat on last checkpoint path without stealing walk position rules
    this.respawnCd = 1.2;
    const near = nearestOnPath(
      this.raceway.path,
      this.raceway.pathDist,
      this.lastCheckpointPos,
    );
    const yaw = this.lastCheckpointYaw || near.yaw;
    this.placeBoardAndPlayerAt(near.point, yaw, true);
    this.audio.playBang(0.35);
    this.toast('Respawned at checkpoint.', 2);
  }

  private applySpeedFx(speedNorm: number, accel: number) {
    if (!this.speedBlurEl) return;
    const rush = Math.max(speedNorm, accel > 0 ? speedNorm * 0.45 : 0);
    if (rush > 0.22) {
      this.speedBlurEl.classList.remove('hidden');
      this.speedBlurEl.classList.add('active');
      // Edge-only: opacity scales; blur amount via CSS mask (center stays clear)
      const blurPx = 6 + Math.floor(rush * rush * 14);
      this.speedBlurEl.style.opacity = String(Math.min(1, 0.35 + rush * 0.75));
      this.speedBlurEl.style.backdropFilter = `blur(${blurPx}px)`;
      (
        this.speedBlurEl.style as CSSStyleDeclaration & { webkitBackdropFilter?: string }
      ).webkitBackdropFilter = `blur(${blurPx}px)`;
    } else {
      this.speedBlurEl.classList.remove('active');
      this.speedBlurEl.style.opacity = '0';
      if (rush <= 0.05) this.speedBlurEl.classList.add('hidden');
    }
  }

  private tickWhooshes(_dt: number) {
    if (!this.raceway || !this.board || this.board.speedNorm < 0.35) return;
    const pos = this.board.position;
    // Scan a window of whoosh points
    const pts = this.raceway.whooshPoints;
    if (pts.length === 0) return;
    for (let k = 0; k < 12; k++) {
      const i = (this.whooshCursor + k) % pts.length;
      const p = pts[i]!;
      const d = pos.distanceTo(p);
      if (d < 7 + this.board.speedNorm * 4) {
        this.audio.playPassWhoosh(0.5 + this.board.speedNorm * 0.6);
        this.whooshCursor = (i + 1) % pts.length;
        break;
      }
    }
    this.whooshCursor = (this.whooshCursor + 1) % pts.length;
  }

  private finishRace() {
    this.raceFinished = true;
    this.objective = 'Racetrack complete!';
    this.audio.playWin();
    this.flash('FINISH — Sky City run complete');
    this.toast(
      'You carved a line through brass districts and cloud parks. Progress saved to your slot.',
      8,
    );
    this.setHelp('E to dismount · Esc to save · Title from pause menu');
    writeSlot(this.activeSlot, this.buildSaveData());
  }

  private tryBoardInteract() {
    if (!this.board || !this.raceway) return false;

    // ——— Dismount: stay where you are, board becomes carried inventory ———
    if (this.board.mounted) {
      if (this.board.speed > 5) {
        this.toast('Slow down to dismount (S).');
        return true;
      }
      this.persistBoardCamMode();
      const yaw = this.board.yaw;
      const stand = this.board.dismount();
      // Stand next to where you left the board — never snap to race path
      this.camera.position.set(stand.x, stand.y + PLAYER_H * 0.35, stand.z);
      // Prefer floor under feet if any
      if (this.floatingCity) {
        const fy = this.floatingCity.sampleFloorY(
          this.camera.position.x,
          this.camera.position.z,
          this.camera.position.y,
        );
        if (fy != null) this.camera.position.y = fy + PLAYER_H * 0.9;
      }
      this.velocity.set(0, 0, 0);
      this.onGround = true;
      this.safePos.copy(this.camera.position);
      this.boardOwned = true;
      this.board.mesh.visible = false;
      this.board.mesh.rotation.set(0, yaw, 0);
      this.ensureBoardCarryMesh();
      this.weapon = 'board';
      this.syncWeaponHud();
      this.audio.setBoardAudio(0.2, 0);
      this.applySpeedFx(0, 0);
      this.syncBoardRiderVisibility();
      this.resetWalkCameraAfterBoard(yaw);
      this.flash('Board stowed — 3 + E to ride again anywhere');
      this.setHelp('3 surfboard · E deploy · walk freely · Tab only while riding');
      writeSlot(this.activeSlot, this.buildSaveData());
      return true;
    }

    // ——— Claim first world board (one-time world pickup) ———
    if (!this.boardOwned) {
      const flatDist = Math.hypot(
        this.camera.position.x - this.board.position.x,
        this.camera.position.z - this.board.position.z,
      );
      if (flatDist < 4.5) {
        this.boardOwned = true;
        this.mountBoardHere(true);
        this.toast('Surfboard claimed! After dismount: press 3, then E to ride from anywhere.', 6);
        writeSlot(this.activeSlot, this.buildSaveData());
        return true;
      }
      this.toast('Find the humming surfboard near the start dock to claim it.', 2.5);
      return false;
    }

    // ——— Owned: E deploys board from inventory at your feet ———
    this.mountBoardHere(false);
    return true;
  }

  /** Mount at the player's current location — no path / spawn teleport. */
  private mountBoardHere(firstClaim: boolean) {
    if (!this.board) return;
    const feetY = this.camera.position.y - PLAYER_H * 0.9;
    let y = feetY + BOARD.hoverHeight;
    if (this.floatingCity) {
      const fy = this.floatingCity.sampleFloorY(
        this.camera.position.x,
        this.camera.position.z,
        this.camera.position.y,
      );
      if (fy != null) y = fy + BOARD.hoverHeight;
    }
    const yaw = this.lookYaw();
    this.board.position.set(this.camera.position.x, y, this.camera.position.z);
    this.board.yaw = yaw;
    this.board.velYaw = yaw;
    this.board.mesh.position.copy(this.board.position);
    this.board.mesh.rotation.set(0, yaw, 0);
    this.board.mesh.visible = true;
    this.board.mount();
    this.board.speed = firstClaim ? 0 : 2;
    this.board.speedNorm = 0;
    this.velocity.set(0, 0, 0);
    this.applySpeedFx(0, 0);
    this.audio.playPickup();
    if (this.boardCarryMesh) this.boardCarryMesh.visible = false;
    this.syncBoardRiderVisibility();
    this.applyBoardCamHelp();
    this.flash(
      this.boardCamMode === 'first'
        ? 'BOARDED — first person · Tab 3rd · E stows board'
        : 'BOARDED — third person · Tab 1st · E stows board',
    );
    this.objective = 'Surf sky lanes · E stows board to walk';
  }

  private ensureBoardCarryMesh() {
    if (!this.board || this.boardCarryMesh) return;
    // Lightweight carry prop (clone scale of board mesh)
    const carry = this.board.mesh.clone(true);
    carry.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.material) {
        m.material = (m.material as THREE.Material).clone();
      }
    });
    carry.scale.setScalar(0.35);
    carry.visible = false;
    this.camera.add(carry);
    carry.position.set(0.35, -0.35, -0.45);
    carry.rotation.set(0.4, 0.6, 0.15);
    this.boardCarryMesh = carry;
  }

  private updateBoardCarryVisual() {
    if (!this.boardCarryMesh) return;
    const show = this.boardOwned && !this.board?.mounted && this.raceActive;
    this.boardCarryMesh.visible = show;
  }

  /**
   * City walk physics without safePos void teleports or race-path magnets.
   * Softer ground snap to avoid "pop" between platforms.
   */
  private moveWithCollisionCity(dt: number) {
    this.velocity.y = Math.max(this.velocity.y, -22);
    const maxStep = 1 / 120;
    const steps = Math.max(1, Math.min(8, Math.ceil(dt / maxStep)));
    const sdt = dt / steps;
    for (let s = 0; s < steps; s++) {
      this.physicsSubstep(sdt);
    }
    // Gentle ground stick — short range only
    this.snapToGround(0.55);
    if (this.floatingCity && this.velocity.y <= 0.25) {
      const fy = this.floatingCity.sampleFloorY(
        this.camera.position.x,
        this.camera.position.z,
        this.camera.position.y - PLAYER_H * 0.5,
      );
      if (fy != null) {
        const feet = this.camera.position.y - PLAYER_H * 0.9;
        // Only stick if very close to surface (prevents long-range pop to park decks)
        if (feet <= fy + 0.35 && feet >= fy - 0.65) {
          this.camera.position.y = fy + PLAYER_H * 0.9 + 0.002;
          this.velocity.y = 0;
          this.onGround = true;
        }
      }
    }
    if (this.onGround) {
      this.safeTimer += dt;
      if (this.safeTimer > 0.2) this.safePos.copy(this.camera.position);
    } else {
      this.safeTimer = 0;
    }
    // No mid-walk safePos teleport — only hard kill plane handles void
  }

  /** Respawn without forcing race-road checkpoint when exploring city */
  private respawnAtLastSafeOrCity() {
    if (this.respawnCd > 0) return;
    this.respawnCd = 1.0;
    // Prefer last solid footing (must be reasonably near current area)
    const safeNear =
      this.safePos.lengthSq() > 1 &&
      this.safePos.y > this.fallKillY + 2 &&
      this.safePos.distanceTo(this.camera.position) < 80;
    if (safeNear) {
      this.camera.position.copy(this.safePos);
      this.velocity.set(0, 0, 0);
      this.onGround = true;
      this.toast('Caught by the brass gods — restored to last footing.', 2);
      return;
    }
    // City dock if available
    if (this.floatingCity && this.floatingCity.docks.length > 0) {
      const d = this.floatingCity.docks[0]!;
      this.camera.position.set(d.x, d.y + PLAYER_H * 0.9 + 0.5, d.z);
      this.velocity.set(0, 0, 0);
      this.onGround = true;
      this.safePos.copy(this.camera.position);
      this.toast('Respawned at Dock A.', 2);
      return;
    }
    // Last resort: board spawn area without full path place
    if (this.raceway) {
      const p = this.raceway.boardSpawn;
      this.camera.position.set(p.x, p.y + PLAYER_H * 0.9 + 0.2, p.z + 2);
      this.velocity.set(0, 0, 0);
      this.onGround = true;
      this.safePos.copy(this.camera.position);
      this.toast('Respawned near board dock.', 2);
    }
  }

  private updateRobots(dt: number) {
    const playerPos = this.camera.position.clone();
    const playerFeet = playerPos.clone();
    playerFeet.y -= 0.4;

    for (const r of this.robots) {
      if (r.phase === 'husk') continue;
      // Rescue frames that slipped into the void (path gaps / chase off edge)
      if (r.position.y < -0.8) {
        const rescue = this.level.anchors.doorSpot;
        r.position.set(rescue.x + (Math.random() - 0.5) * 1.2, 0.08, rescue.z + 2.5);
        r.vy = 0;
        r.onGround = true;
      }
      r.attackCd = Math.max(0, r.attackCd - dt);
      r.boltCd = Math.max(0, r.boltCd - dt);
      r.repairCd = Math.max(0, r.repairCd - dt);
      r.tickRepair(dt);

      if (r.phase === 'disabled') {
        r.mode = 'disabled';
        r.tickAnim(dt, false, 'disabled');
        if (r.onGround) this.snapRobotToFloor(r);
        continue;
      }

      if (r.phase === 'ally') {
        this.updateAlly(r, dt, playerFeet);
        // snap only when grounded — airborne jump/fall handled inside moveRobot
        if (r.onGround) this.snapRobotToFloor(r);
        continue;
      }

      // ——— Hostile AI ———
      const dist = r.position.distanceTo(playerFeet);
      r.mesh.lookAt(playerFeet.x, r.position.y, playerFeet.z);

      // Self-destruct fuse when very close
      if (r.mode === 'fuse') {
        r.fuseT += dt;
        r.tickAnim(dt, false, 'fuse');
        if (dist > ROBOT.fuseCancelRange) {
          r.mode = 'chase';
          r.fuseT = 0;
          this.toast('Self-destruct cancelled — frame resumes pursuit.');
        } else if (r.fuseT >= ROBOT.fuseDuration) {
          this.detonateRobot(r);
        }
        if (r.onGround) this.snapRobotToFloor(r);
        continue;
      }

      // Bolt windup
      if (r.mode === 'windup_bolt') {
        r.windupT -= dt;
        r.tickAnim(dt, false, 'windup_bolt');
        if (r.windupT <= 0) {
          r.mode = 'chase';
          r.boltCd = ROBOT.boltCd;
          this.fireBolt(r, playerFeet);
        }
        if (r.onGround) this.snapRobotToFloor(r);
        continue;
      }

      // Start fuse if in melee bubble
      if (dist < ROBOT.fuseTriggerRange && dist > 0.3) {
        r.mode = 'fuse';
        r.fuseT = 0;
        this.toast('⚠ SELF-DESTRUCT ARMED — back away!');
        r.tickAnim(dt, false, 'fuse');
        if (r.onGround) this.snapRobotToFloor(r);
        continue;
      }

      // Start bolt windup on cooldown when mid range
      if (r.boltCd <= 0 && dist > 2.5 && dist < 14) {
        r.mode = 'windup_bolt';
        r.windupT = ROBOT.boltWindup;
        r.tickAnim(dt, false, 'windup_bolt');
        if (r.onGround) this.snapRobotToFloor(r);
        continue;
      }

      // Chase (slow) + separation so hostiles don't stack + wall collision
      let moving = false;
      const wish = new THREE.Vector3();
      if (dist < 18 && dist > ROBOT.fuseTriggerRange + 0.15) {
        const dir = playerFeet.clone().sub(r.position);
        dir.y = 0;
        if (dir.lengthSq() > 0.01) {
          dir.normalize();
          const sep = this.separation(r, ROBOT.enemySeparateRadius, ROBOT.enemySeparateStrength, 'hostile');
          wish.copy(dir).add(sep);
        }
      } else {
        const sep = this.separation(r, ROBOT.enemySeparateRadius, ROBOT.enemySeparateStrength, 'hostile');
        if (sep.lengthSq() > 0.01) wish.copy(sep);
      }
      if (wish.lengthSq() > 0.01) {
        const applied = this.moveRobot(r, wish, ROBOT.chaseSpeed, dt);
        moving = applied.lengthSq() > 1e-6 || !r.onGround;
        if (moving && r.onGround) this.faceMoveDir(r, applied);
      }
      r.mode = 'chase';
      r.tickAnim(dt, moving, 'chase');
      if (r.onGround) this.snapRobotToFloor(r);
    }

    // Pickup orbs
    for (const it of this.interactables) {
      if (it.text !== 'pickup' || it.opened) continue;
      if (it.position.distanceTo(this.camera.position) < 1.4) {
        it.opened = true;
        it.mesh.visible = false;
        if (it.title === 'oil') this.health = Math.min(100, this.health + 25);
        else this.plasma = Math.min(100, this.plasma + 30);
        this.toast(it.title === 'oil' ? 'Machine oil.' : 'Plasma cell.');
      }
    }
  }

  /**
   * Soft push away from other robots so units don't stack.
   * kind: who to avoid (allies only / hostiles only / both active bodies)
   */
  private separation(
    self: RobotUnit,
    radius: number,
    strength: number,
    kind: 'ally' | 'hostile' | 'all',
  ): THREE.Vector3 {
    const push = new THREE.Vector3();
    for (const o of this.robots) {
      if (o === self || o.phase === 'husk' || o.phase === 'disabled') continue;
      if (kind === 'ally' && o.phase !== 'ally') continue;
      if (kind === 'hostile' && o.phase !== 'active') continue;
      const d = self.position.distanceTo(o.position);
      if (d < 0.01 || d > radius) continue;
      const away = self.position.clone().sub(o.position);
      away.y = 0;
      const falloff = 1 - d / radius;
      away.normalize().multiplyScalar(strength * falloff * falloff);
      push.add(away);
    }
    return push;
  }

  private faceMoveDir(r: RobotUnit, move: THREE.Vector3) {
    if (move.lengthSq() < 0.0004) return;
    r.faceDir.copy(move).setY(0).normalize();
    const look = r.position.clone().add(r.faceDir);
    r.mesh.lookAt(look.x, r.position.y, look.z);
  }

  private updateAlly(r: RobotUnit, dt: number, playerFeet: THREE.Vector3) {
    r.mode = 'ally';
    const dist = r.position.distanceTo(playerFeet);
    let moving = false;
    const wish = new THREE.Vector3();

    // Hysteresis leash — no twitching at one threshold
    if (!r.returning && dist > ROBOT.allyLeashHard) r.returning = true;
    if (r.returning && dist < ROBOT.allyResumeWander) r.returning = false;

    // Idle only when not returning and not in combat
    if (r.idleT > 0 && !r.returning) {
      r.idleT -= dt;
      const sep = this.separation(r, ROBOT.separateRadius, ROBOT.separateStrength, 'ally');
      if (sep.lengthSq() > 0.05) {
        const applied = this.moveRobot(r, sep, ROBOT.allySpeed * 0.4, dt);
        if (applied.lengthSq() > 1e-6) {
          this.faceMoveDir(r, applied);
          moving = true;
        }
      } else {
        const look = r.position.clone().add(r.faceDir);
        r.mesh.lookAt(look.x, r.position.y, look.z);
      }
      if (dist > ROBOT.allyLeashHard * 0.9) r.idleT = 0;
      else {
        r.tickAnim(dt, moving, 'ally');
        this.allyCombatAndRepair(r, dt, playerFeet);
        if (r.onGround) this.snapRobotToFloor(r);
        return;
      }
    }

    r.nextIdleRoll -= dt;
    if (r.nextIdleRoll <= 0) {
      r.nextIdleRoll = 2.8 + Math.random() * 4;
      if (!r.returning && dist < ROBOT.allyLeashComfort && Math.random() < ROBOT.allyIdleChance) {
        r.idleT = ROBOT.allyIdleMin + Math.random() * (ROBOT.allyIdleMax - ROBOT.allyIdleMin);
      }
    }

    let foe: RobotUnit | null = null;
    let fd = 6;
    for (const o of this.robots) {
      if (o.phase !== 'active') continue;
      const d = o.position.distanceTo(r.position);
      if (d < fd) {
        fd = d;
        foe = o;
      }
    }

    let speed: number = ROBOT.allyWanderSpeed;

    if (foe && fd < 7.5) {
      if (fd > 1.5) {
        const toward = foe.position.clone().sub(r.position);
        toward.y = 0;
        if (toward.lengthSq() > 0.01) wish.add(toward.normalize());
      }
      speed = ROBOT.allySpeed * 0.95;
      r.mesh.lookAt(foe.position.x, r.position.y, foe.position.z);
    } else if (r.returning) {
      // Steady catch-up until inside resumeWander — no flip-flop
      const toward = playerFeet.clone().sub(r.position);
      toward.y = 0;
      if (toward.lengthSq() > 0.01) wish.add(toward.normalize());
      speed = ROBOT.allySpeed;
      // If player is upstairs and we're close in XZ, bias into stairs/walls to trigger step/jump
      const horiz = Math.hypot(playerFeet.x - r.position.x, playerFeet.z - r.position.z);
      if (playerFeet.y > r.position.y + 0.45 && horiz < 6 && r.onGround && r.jumpCd <= 0) {
        // Prefer world stairs zone near courtyard upper (nudge if player is higher)
        if (horiz < 1.2) {
          // Already under player — hop straight up
          this.robotJump(r);
        }
      }
    } else {
      // Autonomous wander
      r.wanderTimer -= dt;
      if (r.wanderTimer <= 0) {
        r.wanderTimer = 1.4 + Math.random() * 3.2;
        r.wanderAngle += (Math.random() - 0.5) * 1.6;
      }
      const wander = new THREE.Vector3(Math.cos(r.wanderAngle), 0, Math.sin(r.wanderAngle));

      if (dist < 1.5) {
        const away = r.position.clone().sub(playerFeet);
        away.y = 0;
        if (away.lengthSq() > 0.01) wander.addScaledVector(away.normalize(), 0.5);
      }
      // Very mild bias when past comfort but not yet "returning"
      if (dist > ROBOT.allyLeashComfort && dist < ROBOT.allyLeashHard) {
        const t = (dist - ROBOT.allyLeashComfort) / (ROBOT.allyLeashHard - ROBOT.allyLeashComfort);
        const toward = playerFeet.clone().sub(r.position);
        toward.y = 0;
        if (toward.lengthSq() > 0.01) wander.addScaledVector(toward.normalize(), 0.15 + t * 0.35);
      }

      if (wander.lengthSq() > 0.01) wish.add(wander.normalize());
      speed = ROBOT.allyWanderSpeed;
    }

    const sep = this.separation(r, ROBOT.separateRadius, ROBOT.separateStrength, 'ally');
    sep.add(this.separation(r, ROBOT.enemySeparateRadius * 0.9, 1.4, 'hostile'));
    wish.add(sep);

    if (wish.lengthSq() > 0.02) {
      const applied = this.moveRobot(r, wish, speed, dt);
      if (applied.lengthSq() > 1e-6) {
        moving = true;
        if (!(foe && fd < 2.2)) this.faceMoveDir(r, applied);
      }
    }

    this.allyCombatAndRepair(r, dt, playerFeet);
    r.tickAnim(dt, moving, 'ally');
  }

  private allyCombatAndRepair(r: RobotUnit, dt: number, playerFeet: THREE.Vector3) {
    let foe: RobotUnit | null = null;
    let fd = 6;
    for (const o of this.robots) {
      if (o.phase !== 'active') continue;
      const d = o.position.distanceTo(r.position);
      if (d < fd) {
        fd = d;
        foe = o;
      }
    }
    if (foe && fd < 1.55 && r.attackCd <= 0) {
      r.attackCd = 0.9;
      foe.aggro = true;
      const res = foe.applyArc(12, 18);
      if (res === 'disabled') this.toast('Ally knocked a frame out!');
      else if (res === 'scrambled') this.toast('Ally scrambled a frame!');
    }

    if (r.repairCd <= 0) {
      for (const o of this.robots) {
        if (o === r || o.phase !== 'ally') continue;
        if (o.position.distanceTo(r.position) < 3.2 && o.hp < o.maxHp) {
          o.hp = Math.min(o.maxHp, o.hp + 8);
          r.repairCd = 1.1;
        }
      }
      if (r.position.distanceTo(playerFeet) < 3.2 && this.health < 100) {
        this.health = Math.min(100, this.health + 5);
        r.repairCd = 1.1;
      }
    }
    void dt;
  }

  private fireBolt(r: RobotUnit, target: THREE.Vector3) {
    const dir = target.clone().sub(r.position);
    dir.y = 0.2;
    if (dir.lengthSq() < 0.01) dir.set(0, 0, 1);
    dir.normalize();
    const bolt = new SparkBolt(r.position.clone(), dir);
    this.bolts.push(bolt);
    this.scene.add(bolt.mesh);
  }

  private updateBolts(dt: number) {
    const target = this.camera.position.clone();
    const alive: SparkBolt[] = [];
    for (const b of this.bolts) {
      const ok = b.update(dt, target);
      if (!ok) {
        this.scene.remove(b.mesh);
        b.mesh.geometry.dispose();
        (b.mesh.material as THREE.Material).dispose();
        continue;
      }
      // Hit player
      if (b.mesh.position.distanceTo(this.camera.position) < 0.7 && this.invuln <= 0) {
        this.hurtPlayer(b.damage);
        this.scene.remove(b.mesh);
        b.mesh.geometry.dispose();
        (b.mesh.material as THREE.Material).dispose();
        this.toast('Spark bolt hit!');
        continue;
      }
      // Hit wall roughly (out of map bounds / below ground)
      if (b.mesh.position.y < -1 || b.mesh.position.y > 12) {
        this.scene.remove(b.mesh);
        continue;
      }
      alive.push(b);
    }
    this.bolts = alive;
  }

  private detonateRobot(r: RobotUnit) {
    const pos = r.position.clone();
    const blast = createBlastFx(pos);
    this.blasts.push(blast);
    this.scene.add(blast);

    const dist = pos.distanceTo(this.camera.position);
    if (dist < ROBOT.blastRadius && this.invuln <= 0) {
      const falloff = 1 - dist / ROBOT.blastRadius;
      this.hurtPlayer(ROBOT.blastDamage * (0.45 + 0.55 * falloff));
      this.toast('Self-destruct blast!');
    }
    // Splash damage to nearby hostiles
    for (const o of this.robots) {
      if (o === r || o.phase !== 'active') continue;
      if (o.position.distanceTo(pos) < ROBOT.blastRadius) {
        o.applyArc(35, 40);
      }
    }

    // Detonation destroys the frame as husk with reduced scrap (no player scrap)
    r.setPhase('husk');
    const husk = createHusk(this.level.mats, pos);
    this.scene.add(husk);
    this.husks.push(husk);
    this.scene.remove(r.mesh);
    this.flash('Frame detonated');
  }

  private updateBlasts(dt: number) {
    const keep: THREE.Group[] = [];
    for (const b of this.blasts) {
      b.userData.life -= dt;
      const life = b.userData.life as number;
      const max = b.userData.maxLife as number;
      const t = 1 - life / max;
      const scale = 0.5 + t * ROBOT.blastRadius * 2.2;
      b.scale.setScalar(scale);
      const sphere = b.children[0] as THREE.Mesh;
      if (sphere?.material) {
        const m = sphere.material as THREE.MeshBasicMaterial;
        m.opacity = Math.max(0, 0.9 * (1 - t));
      }
      if (life > 0) keep.push(b);
      else this.scene.remove(b);
    }
    this.blasts = keep;
  }

  private hurtPlayer(amount: number) {
    if (this.invuln > 0) return;
    this.health -= amount;
    this.invuln = 0.55;
    if (this.health <= 0) {
      this.health = 100;
      this.camera.position.set(
        this.level.spawn.x,
        this.level.spawn.y + PLAYER_H * 0.9 + 0.2,
        this.level.spawn.z,
      );
      this.safePos.copy(this.camera.position);
      this.velocity.set(0, 0, 0);
      this.toast('Integrity failed — returned to annex door.');
    }
  }

  private snapRobotToFloor(r: RobotUnit) {
    // Never cancel a jump / fall with a snap
    if (!r.onGround || r.vy > 0.2) {
      if (!r.onGround) this.resolveRobotVertical(r);
      return;
    }
    const x = r.position.x;
    const z = r.position.z;
    const rad = r.radius * 0.65;
    let bestY = -Infinity;
    for (const c of this.colliders) {
      if (x + rad < c.min.x || x - rad > c.max.x || z + rad < c.min.z || z - rad > c.max.z) continue;
      // Standable tops near current feet (not ceilings far above)
      if (c.max.y <= r.position.y + 0.4 && c.max.y >= r.position.y - 1.4) {
        if (c.max.y > bestY) bestY = c.max.y;
      }
    }
    if (bestY > -Infinity) {
      r.position.y = bestY;
      r.vy = 0;
      r.onGround = true;
    } else if (r.position.y < -1) {
      r.position.y = 0;
      r.vy = 0;
      r.onGround = true;
    }
  }

  private checkExit() {
    // Boat controls (E) are the intentional win; proximity only hints
    if (this.won) return;
    if (this.tutorial !== 'escape' && this.tutorial !== 'breach') return;
    const p = this.camera.position;
    if (Math.hypot(p.x - this.exit.x, p.z - this.exit.z) < 3.5 && p.y < 4) {
      // Soft reminder once near boat
      if (this.msgT <= 0) {
        this.toast('Boat controls — press E to cast off.', 2);
      }
    }
  }

  private toast(t: string, sec = 2.5) {
    this.msg = t;
    this.msgT = sec;
    this.toastEl.textContent = t;
    this.toastEl.classList.remove('hidden');
    window.setTimeout(() => this.toastEl.classList.add('hidden'), sec * 1000);
  }
  private plaque(t: string) {
    const sec = this.mobile.enabled ? 9.5 : 5;
    this.msg = t;
    this.msgT = sec;
    this.toastEl.textContent = t;
    this.toastEl.classList.remove('hidden');
    window.setTimeout(() => this.toastEl.classList.add('hidden'), sec * 1000);
  }
  private flash(t: string) {
    this.convertEl.textContent = t;
    this.convertEl.classList.remove('hidden');
    window.setTimeout(() => this.convertEl.classList.add('hidden'), 2200);
  }

  private onResize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }
}

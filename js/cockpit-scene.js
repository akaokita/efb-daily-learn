/**
 * B737NG immersive cockpit scene (Three.js r160+)
 * Procedural NG-style interior + Wikimedia CC textures (runtime load).
 */
import * as THREE from 'three';

const TEX = {
  ata: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/a/a0/Cockpit_of_Boeing_737-800%2C_ATA_Airlines_1.jpg',
    credit: 'Nick Bartolotta / CC BY-SA 3.0 — Cockpit of Boeing 737-800, ATA Airlines',
    page: 'https://commons.wikimedia.org/wiki/File:Cockpit_of_Boeing_737-800,_ATA_Airlines_1.jpg',
  },
  classic: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/5/5b/Boeing_737_cockpit.jpg',
    credit: 'Milkmandan / CC BY-SA 3.0 — Boeing 737 cockpit (Museum of Flight)',
    page: 'https://commons.wikimedia.org/wiki/File:Boeing_737_cockpit.jpg',
  },
};

/** Approximate seating: CAPT left, looking -Z (forward). Units ≈ meters. */
const LOOK = {
  forward: { yaw: 0, pitch: -0.08 },
  overhead: { yaw: 0, pitch: 0.72 },
  pedestal: { yaw: 0.05, pitch: -0.55 },
  right: { yaw: 0.95, pitch: -0.05 },
};

/**
 * Hotspot local placement relative to cockpit origin.
 * x: right+, y: up+, z: aft+ (forward is -z)
 */
const PLACES = {
  // Overhead — looking up, slightly aft of MCP
  irs_l: [-0.35, 1.62, -0.15],
  irs_r: [0.35, 1.62, -0.15],
  yaw_damper: [0.0, 1.58, -0.05],
  fuel_crossfeed: [0.0, 1.55, 0.05],
  fuel_ctr_l: [-0.18, 1.52, 0.08],
  fuel_ctr_r: [0.18, 1.52, 0.08],
  fuel_fwd_1: [-0.42, 1.50, 0.12],
  fuel_aft_1: [-0.28, 1.50, 0.12],
  fuel_fwd_2: [0.28, 1.50, 0.12],
  fuel_aft_2: [0.42, 1.50, 0.12],
  batt: [-0.55, 1.56, 0.0],
  apu_sw: [-0.05, 1.48, 0.18],
  apu_gen: [0.12, 1.48, 0.18],
  fire_test: [0.0, 1.44, 0.22],
  window_heat: [0.48, 1.54, -0.02],
  wing_anti_ice: [0.0, 1.46, 0.28],
  eng_anti_ice_1: [-0.22, 1.46, 0.28],
  eng_anti_ice_2: [0.22, 1.46, 0.28],
  emer_exit_lt: [0.55, 1.58, 0.05],
  hyd_eng_a: [-0.35, 1.42, 0.32],
  hyd_eng_b: [0.35, 1.42, 0.32],
  hyd_elec_a: [-0.18, 1.40, 0.35],
  hyd_elec_b: [0.18, 1.40, 0.35],
  pack_l: [-0.32, 1.36, 0.38],
  pack_r: [0.32, 1.36, 0.38],
  isol_valve: [0.0, 1.34, 0.40],
  bleed_1: [-0.38, 1.32, 0.42],
  bleed_apu: [0.0, 1.30, 0.44],
  bleed_2: [0.38, 1.32, 0.42],
  press_mode: [0.0, 1.28, 0.46],
  eec_1: [-0.48, 1.60, 0.08],
  eec_2: [0.48, 1.60, 0.08],
  ignition: [0.0, 1.38, 0.25],
  eng_start_1: [-0.22, 1.38, 0.25],
  eng_start_2: [0.22, 1.38, 0.25],
  anti_coll: [0.55, 1.48, 0.15],
  landing_lt: [0.48, 1.45, 0.20],
  taxi_lt: [0.40, 1.45, 0.24],
  pass_oxy: [-0.55, 1.50, 0.10],
  flt_recorder: [-0.48, 1.48, 0.14],
  evac_switch: [0.55, 1.52, -0.08],

  // Glareshield / MCP
  fire_warn: [-0.55, 1.12, -0.95],
  master_caution: [-0.42, 1.12, -0.95],
  mcp_course_l: [-0.55, 1.08, -0.88],
  mcp_fd_l: [-0.38, 1.08, -0.88],
  mcp_at: [-0.22, 1.08, -0.88],
  mcp_spd: [-0.08, 1.08, -0.88],
  mcp_lnav: [0.05, 1.08, -0.88],
  mcp_vnav: [0.18, 1.08, -0.88],
  mcp_hdg: [0.32, 1.08, -0.88],
  mcp_alt: [0.48, 1.08, -0.88],
  mcp_fd_r: [0.62, 1.08, -0.88],

  // Main instrument
  gear_lights: [0.0, 0.92, -1.05],
  gear_lever: [0.12, 0.78, -1.0],
  autobrake: [0.28, 0.82, -1.02],
  mach_warn_test: [-0.35, 0.75, -1.0],
  stall_warn_test: [-0.18, 0.75, -1.0],

  // Pedestal
  speedbrake: [-0.22, 0.62, -0.15],
  flap_lever: [0.22, 0.58, 0.05],
  stab_trim: [-0.35, 0.55, 0.0],
  throttle_1: [-0.08, 0.68, -0.05],
  throttle_2: [0.08, 0.68, -0.05],
  fuel_lever_1: [-0.08, 0.55, 0.08],
  fuel_lever_2: [0.08, 0.55, 0.08],
  park_brake: [0.0, 0.52, 0.22],
  transponder: [0.0, 0.48, 0.38],
};

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.72,
    metalness: opts.metalness ?? 0.18,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    transparent: !!opts.transparent,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
  });
}

function box(w, h, d, material, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = false;
  m.receiveShadow = true;
  return m;
}

export class CockpitScene {
  constructor(container, opts = {}) {
    this.container = container;
    this.onSelect = opts.onSelect || (() => {});
    this.credits = [];
    this.hotspots = new Map();
    this.targetId = null;
    this.mode = 'guide'; // guide | explore
    this.doneIds = new Set();
    this.litIds = new Set();
    this._yaw = LOOK.forward.yaw;
    this._pitch = LOOK.forward.pitch;
    this._vyaw = 0;
    this._vpitch = 0;
    this._dragging = false;
    this._lastX = 0;
    this._lastY = 0;
    this._gyro = false;
    this._baseAlpha = null;
    this._baseBeta = null;
    this._raf = 0;
    this._clock = new THREE.Clock();
    this.ok = false;

    try {
      this._initThree();
      this._bindInput();
      this._resize();
      this.ok = true;
      this._loop();
      this._ready = this._buildCockpit().catch((err) => {
        console.warn('Cockpit build/texture issue', err);
      });
    } catch (err) {
      console.error('CockpitScene init failed', err);
      this.ok = false;
      throw err;
    }
  }

  _initThree() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, false);
    this.renderer.setClearColor(0x1a2332, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.touchAction = 'none';

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a2332);
    this.scene.fog = new THREE.Fog(0x1a2332, 6, 22);

    this.camera = new THREE.PerspectiveCamera(72, Math.max(w, 1) / Math.max(h, 1), 0.05, 40);
    // CAPT seat eye point
    this.camPos = new THREE.Vector3(-0.42, 1.18, 0.42);
    this.camera.position.copy(this.camPos);

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    const amb = new THREE.AmbientLight(0xb8c4d6, 1.15);
    this.scene.add(amb);
    const key = new THREE.DirectionalLight(0xfff0dd, 1.1);
    key.position.set(-1.2, 2.2, 1.5);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xa8c8e8, 0.65);
    fill.position.set(1.5, 1.2, -0.5);
    this.scene.add(fill);
    const hemi = new THREE.HemisphereLight(0x9eb6ff, 0x2a2018, 0.55);
    this.scene.add(hemi);
    // Instrument glow
    const glow = new THREE.PointLight(0x66ccff, 1.4, 4.5, 2);
    glow.position.set(0, 0.95, -0.7);
    this.scene.add(glow);
    const ohLight = new THREE.PointLight(0xffcc88, 0.9, 3.5, 2);
    ohLight.position.set(0, 1.55, 0.1);
    this.scene.add(ohLight);

    window.addEventListener('resize', () => this._resize());
    if (typeof ResizeObserver !== 'undefined') {
      this._ro = new ResizeObserver(() => this._resize());
      this._ro.observe(this.container);
    }
  }

  _loadTexture(key) {
    const info = TEX[key];
    if (!info) return Promise.resolve(null);
    return new Promise((resolve) => {
      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin('anonymous');
      loader.load(
        info.url,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
          this.credits.push(info);
          resolve(tex);
        },
        undefined,
        () => resolve(null)
      );
    });
  }

  async _buildCockpit() {
    const root = new THREE.Group();
    this.root = root;
    this.scene.add(root);

    const dark = mat(0x3a4558, { roughness: 0.75, metalness: 0.22 });
    const darker = mat(0x2a3344, { roughness: 0.85, metalness: 0.12 });
    const metal = mat(0x6a7a90, { roughness: 0.4, metalness: 0.5 });
    const beige = mat(0x5a4a38, { roughness: 0.75, metalness: 0.05 });
    const glass = mat(0x88aacc, { roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.22, side: THREE.DoubleSide });
    const screen = mat(0x0a1a22, { roughness: 0.35, metalness: 0.2, emissive: 0x1a4a5a, emissiveIntensity: 0.55 });
    const seat = mat(0x1c2430, { roughness: 0.9, metalness: 0.05 });

    // Floor / tunnel
    root.add(box(2.4, 0.06, 3.2, darker, 0, 0.22, 0.1));
    // Side walls
    root.add(box(0.08, 1.6, 3.0, dark, -1.15, 1.0, 0.0));
    root.add(box(0.08, 1.6, 3.0, dark, 1.15, 1.0, 0.0));
    // Ceiling
    root.add(box(2.3, 0.06, 2.6, darker, 0, 1.85, 0.05));
    // Aft bulkhead hint
    root.add(box(2.2, 1.5, 0.08, dark, 0, 1.0, 1.35));

    // Windshield frame
    root.add(box(2.0, 0.08, 0.08, metal, 0, 1.42, -1.55));
    root.add(box(0.08, 0.7, 0.08, metal, -0.95, 1.15, -1.55));
    root.add(box(0.08, 0.7, 0.08, metal, 0.95, 1.15, -1.55));
    root.add(box(0.06, 0.7, 0.08, metal, 0, 1.15, -1.55));
    // Glass panes
    const wsL = box(0.9, 0.65, 0.02, glass, -0.48, 1.18, -1.52);
    const wsR = box(0.9, 0.65, 0.02, glass, 0.48, 1.18, -1.52);
    root.add(wsL, wsR);
    // Night sky beyond
    const sky = box(3.5, 2.2, 0.02, mat(0x0a1020, { emissive: 0x152038, emissiveIntensity: 0.4 }), 0, 1.3, -2.4);
    root.add(sky);

    // Glareshield
    root.add(box(1.9, 0.08, 0.45, beige, 0, 1.14, -1.05, -0.15, 0, 0));
    // MCP bar
    const mcp = box(1.7, 0.1, 0.18, metal, 0, 1.06, -0.88);
    root.add(mcp);

    // Main instrument panel
    const mainPanel = box(1.85, 0.55, 0.12, dark, 0, 0.82, -1.08, -0.08, 0, 0);
    root.add(mainPanel);
    // Fake PFD/ND screens
    root.add(box(0.32, 0.28, 0.02, screen, -0.55, 0.95, -1.01));
    root.add(box(0.32, 0.28, 0.02, screen, -0.18, 0.95, -1.01));
    root.add(box(0.32, 0.28, 0.02, screen, 0.18, 0.95, -1.01));
    root.add(box(0.32, 0.28, 0.02, screen, 0.55, 0.95, -1.01));

    // Pedestal
    root.add(box(0.55, 0.35, 1.15, dark, 0, 0.48, 0.15));
    root.add(box(0.5, 0.04, 1.1, metal, 0, 0.66, 0.15));

    // Overhead panel (angled toward pilot)
    const oh = box(1.6, 0.08, 0.95, dark, 0, 1.58, 0.15, 0.55, 0, 0);
    root.add(oh);
    root.add(box(1.55, 0.02, 0.9, metal, 0, 1.54, 0.15, 0.55, 0, 0));

    // Seats
    root.add(box(0.45, 0.12, 0.45, seat, -0.45, 0.48, 0.55));
    root.add(box(0.42, 0.55, 0.1, seat, -0.45, 0.8, 0.72));
    root.add(box(0.45, 0.12, 0.45, seat, 0.45, 0.48, 0.55));
    root.add(box(0.42, 0.55, 0.1, seat, 0.45, 0.8, 0.72));

    // Control columns (simple)
    root.add(box(0.06, 0.55, 0.06, metal, -0.42, 0.7, -0.35));
    root.add(box(0.22, 0.04, 0.08, metal, -0.42, 0.98, -0.35));
    root.add(box(0.06, 0.55, 0.06, metal, 0.42, 0.7, -0.35));
    root.add(box(0.22, 0.04, 0.08, metal, 0.42, 0.98, -0.35));

    this.hotRoot = new THREE.Group();
    root.add(this.hotRoot);
    this._makeHotspots();

    // Texture planes (async; hotspots already interactive)
    const [texAta, texClassic] = await Promise.all([this._loadTexture('ata'), this._loadTexture('classic')]);
    if (texAta) {
      const photoMat = new THREE.MeshBasicMaterial({ map: texAta, transparent: true, opacity: 0.55 });
      const photo = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.05), photoMat);
      photo.position.set(0, 1.05, -1.35);
      photo.rotation.x = -0.05;
      root.add(photo);
    }
    if (texClassic) {
      const ohTex = new THREE.MeshBasicMaterial({ map: texClassic, transparent: true, opacity: 0.28 });
      const ohPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.8), ohTex);
      ohPlane.position.set(0, 1.52, 0.15);
      ohPlane.rotation.x = Math.PI / 2 + 0.55;
      root.add(ohPlane);
    }
  }

  _makeHotspots() {
    const geo = new THREE.SphereGeometry(0.035, 12, 12);
    const hitGeo = new THREE.SphereGeometry(0.07, 8, 8);
    Object.keys(PLACES).forEach((id) => {
      const [x, y, z] = PLACES[id];
      const group = new THREE.Group();
      group.position.set(x, y, z);
      group.userData.id = id;

      const coreMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0ea5e9,
        emissiveIntensity: 0.6,
        roughness: 0.4,
        metalness: 0.2,
        transparent: true,
        opacity: 0.85,
      });
      const core = new THREE.Mesh(geo, coreMat);
      core.userData.id = id;
      group.add(core);

      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x67e8f9,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.045, 0.065, 24), ringMat);
      ring.lookAt(this.camPos);
      ring.userData.id = id;
      group.add(ring);

      const hitMat = new THREE.MeshBasicMaterial({ visible: false });
      const hit = new THREE.Mesh(hitGeo, hitMat);
      hit.userData.id = id;
      group.add(hit);

      this.hotRoot.add(group);
      this.hotspots.set(id, { group, core, ring, coreMat, ringMat });
    });
    this._refreshHotVisuals();
  }

  applyControlPositions(controls) {
    if (!Array.isArray(controls)) return;
    controls.forEach((c) => {
      if (!c || !c.id) return;
      const hs = this.hotspots.get(c.id);
      if (!hs) return;
      if (Array.isArray(c.pos) && c.pos.length >= 3) {
        hs.group.position.set(c.pos[0], c.pos[1], c.pos[2]);
      } else if (c.yaw != null && c.pitch != null && c.dist != null) {
        // spherical hint from camera — optional
        const yaw = c.yaw;
        const pitch = c.pitch;
        const d = c.dist;
        const x = this.camPos.x + Math.sin(yaw) * Math.cos(pitch) * d;
        const y = this.camPos.y + Math.sin(pitch) * d;
        const z = this.camPos.z - Math.cos(yaw) * Math.cos(pitch) * d;
        hs.group.position.set(x, y, z);
      }
    });
  }

  setMode(mode) {
    this.mode = mode;
    this._refreshHotVisuals();
  }

  setTarget(id) {
    this.targetId = id || null;
    this._refreshHotVisuals();
    if (id && this.hotspots.has(id)) {
      this.lookToward(this.hotspots.get(id).group.position);
    }
  }

  setDone(ids) {
    this.doneIds = new Set(ids || []);
    this._refreshHotVisuals();
  }

  setLit(id, on) {
    if (on) this.litIds.add(id);
    else this.litIds.delete(id);
    this._refreshHotVisuals();
  }

  lookSnap(name) {
    const L = LOOK[name] || LOOK.forward;
    this._yaw = L.yaw;
    this._pitch = L.pitch;
    this._vyaw = 0;
    this._vpitch = 0;
  }

  lookToward(worldPos) {
    const dir = new THREE.Vector3().subVectors(worldPos, this.camPos).normalize();
    this._yaw = Math.atan2(dir.x, -dir.z);
    this._pitch = Math.asin(THREE.MathUtils.clamp(dir.y, -0.99, 0.99));
    this._pitch = THREE.MathUtils.clamp(this._pitch, -1.2, 1.25);
    this._vyaw = 0;
    this._vpitch = 0;
  }

  getCredits() {
    // unique by url
    const seen = new Set();
    return this.credits.filter((c) => {
      if (seen.has(c.url)) return false;
      seen.add(c.url);
      return true;
    });
  }

  enableGyro(on) {
    if (!on) {
      this._gyro = false;
      return Promise.resolve(false);
    }
    const req = typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function'
      ? DeviceOrientationEvent.requestPermission()
      : Promise.resolve('granted');
    return req
      .then((state) => {
        if (state !== 'granted' && state !== undefined) return false;
        this._baseAlpha = null;
        this._baseBeta = null;
        this._gyro = true;
        return true;
      })
      .catch(() => false);
  }

  dispose() {
    cancelAnimationFrame(this._raf);
    this._unbindInput();
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement && this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }
  }

  _refreshHotVisuals() {
    const t = performance.now() * 0.001;
    this.hotspots.forEach((hs, id) => {
      const isTarget = this.mode === 'guide' && id === this.targetId;
      const isDone = this.doneIds.has(id);
      const isLit = this.litIds.has(id);
      let opacity = 0.55;
      let emissive = 0.35;
      let color = 0x38bdf8;
      let ringOp = 0.2;
      let scale = 1;

      if (this.mode === 'guide') {
        if (isTarget) {
          opacity = 1;
          emissive = 0.9 + Math.sin(t * 6) * 0.25;
          color = 0x22d3ee;
          ringOp = 0.55 + Math.sin(t * 6) * 0.25;
          scale = 1.25 + Math.sin(t * 6) * 0.12;
        } else if (isDone) {
          opacity = 0.7;
          emissive = 0.45;
          color = 0x22c55e;
          ringOp = 0.15;
          scale = 0.9;
        } else {
          opacity = 0.12;
          emissive = 0.05;
          color = 0x64748b;
          ringOp = 0.05;
          scale = 0.75;
        }
      } else {
        // explore
        opacity = isLit ? 0.95 : 0.65;
        emissive = isLit ? 0.8 : 0.4;
        color = isLit ? 0xfbbf24 : 0x38bdf8;
        ringOp = isLit ? 0.4 : 0.22;
        scale = isLit ? 1.15 : 1;
      }

      hs.coreMat.color.setHex(color);
      hs.coreMat.emissive.setHex(color);
      hs.coreMat.emissiveIntensity = emissive;
      hs.coreMat.opacity = opacity;
      hs.ringMat.color.setHex(color);
      hs.ringMat.opacity = ringOp;
      hs.group.scale.setScalar(scale);
      hs.ring.lookAt(this.camera.position);
    });
  }

  _bindInput() {
    const el = this.renderer.domElement;
    this._onPointerDown = (e) => {
      this._dragging = true;
      this._moved = false;
      this._lastX = e.clientX;
      this._lastY = e.clientY;
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
    };
    this._onPointerMove = (e) => {
      if (!this._dragging) return;
      const dx = e.clientX - this._lastX;
      const dy = e.clientY - this._lastY;
      if (Math.abs(dx) + Math.abs(dy) > 4) this._moved = true;
      this._lastX = e.clientX;
      this._lastY = e.clientY;
      const sens = 0.0055;
      this._yaw -= dx * sens;
      this._pitch -= dy * sens;
      this._pitch = THREE.MathUtils.clamp(this._pitch, -1.25, 1.3);
      this._vyaw = -dx * sens * 0.35;
      this._vpitch = -dy * sens * 0.35;
      if (this._gyro) this._gyro = false; // manual overrides gyro until re-enabled
    };
    this._onPointerUp = (e) => {
      if (!this._dragging) return;
      this._dragging = false;
      try { el.releasePointerCapture(e.pointerId); } catch (_) {}
      if (!this._moved) this._pick(e.clientX, e.clientY);
    };
    el.addEventListener('pointerdown', this._onPointerDown);
    el.addEventListener('pointermove', this._onPointerMove);
    el.addEventListener('pointerup', this._onPointerUp);
    el.addEventListener('pointercancel', this._onPointerUp);

    this._onOrient = (e) => {
      if (!this._gyro) return;
      if (e.alpha == null || e.beta == null) return;
      if (this._baseAlpha == null) {
        this._baseAlpha = e.alpha;
        this._baseBeta = e.beta;
      }
      const dAlpha = ((e.alpha - this._baseAlpha + 540) % 360) - 180;
      const dBeta = e.beta - this._baseBeta;
      this._yaw = -dAlpha * (Math.PI / 180);
      this._pitch = THREE.MathUtils.clamp(
        LOOK.forward.pitch - dBeta * (Math.PI / 180) * 0.85,
        -1.25,
        1.3
      );
    };
    window.addEventListener('deviceorientation', this._onOrient);
  }

  _unbindInput() {
    const el = this.renderer && this.renderer.domElement;
    if (el) {
      el.removeEventListener('pointerdown', this._onPointerDown);
      el.removeEventListener('pointermove', this._onPointerMove);
      el.removeEventListener('pointerup', this._onPointerUp);
      el.removeEventListener('pointercancel', this._onPointerUp);
    }
    window.removeEventListener('deviceorientation', this._onOrient);
  }

  _pick(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const meshes = [];
    this.hotspots.forEach((hs) => {
      hs.group.children.forEach((c) => meshes.push(c));
    });
    const hits = this.raycaster.intersectObjects(meshes, false);
    if (hits.length) {
      const id = hits[0].object.userData.id;
      if (id) this.onSelect(id);
    }
  }

  _resize() {
    const rect = this.container.getBoundingClientRect();
    let w = Math.floor(rect.width) || this.container.clientWidth || window.innerWidth;
    let h = Math.floor(rect.height) || this.container.clientHeight || 0;
    if (h < 80) h = Math.max(240, Math.floor(window.innerHeight * 0.55));
    if (w < 80) w = Math.max(320, window.innerWidth);
    this.camera.aspect = w / Math.max(h, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  _applyLook() {
    // light inertia
    if (!this._dragging && !this._gyro) {
      this._yaw += this._vyaw;
      this._pitch = THREE.MathUtils.clamp(this._pitch + this._vpitch, -1.25, 1.3);
      this._vyaw *= 0.92;
      this._vpitch *= 0.92;
    }
    const look = new THREE.Vector3(
      this.camPos.x + Math.sin(this._yaw) * Math.cos(this._pitch),
      this.camPos.y + Math.sin(this._pitch),
      this.camPos.z - Math.cos(this._yaw) * Math.cos(this._pitch)
    );
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(look);
  }

  _loop() {
    this._raf = requestAnimationFrame(() => this._loop());
    this._applyLook();
    this._refreshHotVisuals();
    this.renderer.render(this.scene, this.camera);
  }
}

export function detectWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl') || c.getContext('experimental-webgl'));
  } catch {
    return false;
  }
}

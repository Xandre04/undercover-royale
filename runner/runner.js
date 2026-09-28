// Royale Rush: an endless lane runner. Loaded on demand from app.js, so three.js
// is only downloaded when someone opens this mode.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { MODELS, MODEL_DIR, POWERUPS } from './models.js';

const LANES = [-1.8, 0, 1.8];
const GRAVITY = 40;
const JUMP_V = 12.5;
const SLIDE_TIME = 0.75;
const START_SPEED = 12;
const MAX_SPEED = 30;
const SPAWN_Z = -95;
const DESPAWN_Z = 12;
const STAND_H = 1.6;
const SLIDE_H = 0.7;
const PLAYER_HALF_W = 0.35;
const CHASER_CLOSE = 2.1;
const CHASER_FAR = 16;

// Hit boxes, in meters. y0..y1 is the vertical span the player must avoid.
const OBSTACLES = {
  barrel:   { w: 1.1, d: 1.0, y0: 0, y1: 0.95 },
  log:      { w: 1.5, d: 0.8, y0: 0, y1: 0.7, extraSpeed: 7 },
  skeleton: { w: 1.3, d: 0.9, y0: 0, y1: 1.15 },
  crates:   { w: 1.4, d: 1.6, y0: 0, y1: 2.6 },
  arrows:   { w: 1.6, d: 0.6, y0: 1.0, y1: 1.9, extraSpeed: 4 },
};

const rand = (a, b) => a + Math.random() * (b - a);
const pickWeighted = (entries) => {
  const total = entries.reduce((n, [, w]) => n + w, 0);
  let r = Math.random() * total;
  for (const [k, w] of entries) { if ((r -= w) <= 0) return k; }
  return entries[0][0];
};

// ---------- asset loading ----------
function findClip(clips, candidates = []) {
  for (const c of candidates) { const hit = clips.find(k => k.name === c); if (hit) return hit; }
  for (const c of candidates) { const hit = clips.find(k => k.name.toLowerCase().includes(c.toLowerCase())); if (hit) return hit; }
  return null;
}

function prepare(gltf, cfg) {
  const root = new THREE.Group();
  const model = gltf.scene;
  model.rotation.y = THREE.MathUtils.degToRad(cfg.rotationY || 0);
  root.add(model);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  let s = size.y > 0 ? cfg.height / size.y : 1;
  if (cfg.maxWidth) s = Math.min(s, cfg.maxWidth / Math.max(size.x, size.z, 0.001));
  const center = box.getCenter(new THREE.Vector3());
  model.scale.multiplyScalar(s);
  model.position.set(-center.x * s, -box.min.y * s, -center.z * s);
  let skinned = false;
  model.traverse(o => {
    if (o.isSkinnedMesh) { skinned = true; o.frustumCulled = false; }
  });
  return { template: root, clips: gltf.animations || [], cfg, skinned };
}

function placeholder(cfg) {
  const root = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(Math.min(cfg.maxWidth || 0.8, 1.2), cfg.height, 0.8), new THREE.MeshStandardMaterial({ color: 0xff00aa }));
  mesh.position.y = cfg.height / 2;
  root.add(mesh);
  return { template: root, clips: [], cfg, skinned: false };
}

async function loadModels(onProgress) {
  const loader = new GLTFLoader();
  const entries = Object.entries(MODELS);
  const assets = {};
  let done = 0;
  await Promise.all(entries.map(async ([key, cfg]) => {
    try {
      assets[key] = prepare(await loader.loadAsync(MODEL_DIR + cfg.file), cfg);
    } catch (e) {
      console.warn(`Royale Rush: could not load ${cfg.file}, using a placeholder box.`, e);
      assets[key] = placeholder(cfg);
    }
    onProgress && onProgress(++done / entries.length);
  }));
  return assets;
}

function instantiate(asset) {
  const obj = asset.skinned ? cloneSkinned(asset.template) : asset.template.clone();
  const inst = { obj, mixer: null, actions: {}, current: null };
  if (asset.clips.length) {
    inst.mixer = new THREE.AnimationMixer(obj);
    for (const [name, candidates] of Object.entries(asset.cfg.anims || {})) {
      const clip = findClip(asset.clips, candidates);
      if (clip) inst.actions[name] = inst.mixer.clipAction(clip);
    }
  }
  return inst;
}

function play(inst, name, { once = false, fade = 0.12, timeScale = 1 } = {}) {
  const action = inst.actions[name];
  if (!action) return 0;
  if (inst.current === action && !once) { action.timeScale = timeScale; return action.getClip().duration; }
  action.reset();
  action.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
  action.clampWhenFinished = once;
  action.timeScale = timeScale;
  action.enabled = true;
  if (inst.current && inst.current !== action) action.crossFadeFrom(inst.current, fade, false);
  action.play();
  inst.current = action;
  return action.getClip().duration / timeScale;
}

// ---------- procedural bits ----------
function canvasTexture(w, h, draw, repeatX = 1, repeatY = 1) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function makeShadowTexture() {
  return canvasTexture(64, 64, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(0,0,0,0.45)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
  });
}

function makeElixirTemplate() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xe23cf0, emissive: 0x7a1690, emissiveIntensity: 0.7, roughness: 0.2, metalness: 0.1 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), mat);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.32, 16), mat);
  tip.position.y = 0.28;
  const shine = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  shine.position.set(-0.08, 0.08, 0.18);
  g.add(body, tip, shine);
  return g;
}

function makeLog() {
  const g = new THREE.Group();
  const bark = new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.9 });
  const end = new THREE.MeshStandardMaterial({ color: 0xd9a86a, roughness: 0.8 });
  const log = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.5, 14), [bark, end, end]);
  log.rotation.z = Math.PI / 2;
  log.position.y = 0.35;
  g.add(log);
  g.userData.roller = log;
  return g;
}

function makeArrows() {
  const g = new THREE.Group();
  const shaftMat = new THREE.MeshStandardMaterial({ color: 0x9b6a3a });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xcfd8e3, metalness: 0.6, roughness: 0.3 });
  const featherMat = new THREE.MeshStandardMaterial({ color: 0xff4d4d, side: THREE.DoubleSide });
  const shaftGeo = new THREE.CylinderGeometry(0.025, 0.025, 1.0, 6);
  const headGeo = new THREE.ConeGeometry(0.07, 0.2, 6);
  const featherGeo = new THREE.PlaneGeometry(0.12, 0.22);
  for (let i = 0; i < 7; i++) {
    const a = new THREE.Group();
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    const head = new THREE.Mesh(headGeo, headMat); head.position.y = 0.6;
    const f1 = new THREE.Mesh(featherGeo, featherMat); f1.position.y = -0.42;
    const f2 = f1.clone(); f2.rotation.y = Math.PI / 2;
    a.add(shaft, head, f1, f2);
    a.rotation.x = Math.PI / 2 + 0.25; // point at the player, tipped slightly down
    a.position.set(rand(-0.7, 0.7), rand(1.15, 1.75), rand(-0.3, 0.3));
    g.add(a);
  }
  // Spell circle on the ground, like the Arrows spell radius.
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.65, 0.8, 32), new THREE.MeshBasicMaterial({ color: 0xff4d4d, transparent: true, opacity: 0.6 }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03;
  g.add(ring);
  return g;
}

// ---------- the game ----------
export async function createRunner(container, { onHud, onEvent, onGameOver, onProgress } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.touchAction = 'none';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const sky = 0x8fd3ff;
  scene.background = new THREE.Color(sky);
  scene.fog = new THREE.Fog(sky, 45, 95);
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 200);
  camera.position.set(0, 4.3, 7.4);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x5a8f3c, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(-5, 10, 6);
  scene.add(sun);

  // Ground: a stone arena path with checkered grass on both sides.
  const pathTex = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#d8b983'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(120,85,40,.45)'; g.lineWidth = 4;
    for (let y = 0; y <= h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    for (let row = 0; row < 4; row++) for (let x = (row % 2) * 43; x <= w; x += 86) { g.beginPath(); g.moveTo(x, row * 64); g.lineTo(x, row * 64 + 64); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,.08)';
    for (let i = 0; i < 40; i++) g.fillRect(Math.random() * w, Math.random() * h, 6, 3);
  }, 2, 40);
  const path = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 200), new THREE.MeshStandardMaterial({ map: pathTex, roughness: 1 }));
  path.rotation.x = -Math.PI / 2; path.position.z = -85;
  scene.add(path);

  const grassTex = canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#7fcf46'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#6fbd3a'; g.fillRect(0, 0, w / 2, h / 2); g.fillRect(w / 2, h / 2, w / 2, h / 2);
  }, 12, 60);
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(60, 200), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 }));
  grass.rotation.x = -Math.PI / 2; grass.position.set(0, -0.01, -85);
  scene.add(grass);

  const curbMat = new THREE.MeshStandardMaterial({ color: 0x9aa4b1, roughness: 0.9 });
  for (const side of [-1, 1]) {
    const curb = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.25, 200), curbMat);
    curb.position.set(side * 3.25, 0.12, -85);
    scene.add(curb);
  }

  const shadowTex = makeShadowTexture();
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });
  const shadowGeo = new THREE.PlaneGeometry(1, 1);
  const addShadow = (parent, size) => {
    const s = new THREE.Mesh(shadowGeo, shadowMat);
    s.rotation.x = -Math.PI / 2; s.position.y = 0.02; s.scale.set(size, size, 1);
    parent.add(s);
    return s;
  };

  const assets = await loadModels(onProgress);

  // Player and chaser
  const player = instantiate(assets.runner);
  scene.add(player.obj);
  const playerShadow = addShadow(scene, 1.1);
  const chaser = instantiate(assets.chaser);
  scene.add(chaser.obj);
  addShadow(chaser.obj, 1.2);

  // Power-up effects around the player
  const rageAura = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.06, 8, 32), new THREE.MeshBasicMaterial({ color: POWERUPS.rage.color, transparent: true, opacity: 0.8 }));
  rageAura.rotation.x = Math.PI / 2; rageAura.position.y = 0.15;
  const shieldBubble = new THREE.Mesh(new THREE.SphereGeometry(1.05, 24, 16), new THREE.MeshBasicMaterial({ color: POWERUPS.shield.color, transparent: true, opacity: 0.22, depthWrite: false }));
  shieldBubble.position.y = 0.85;
  const magnetRing = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.04, 8, 32), new THREE.MeshBasicMaterial({ color: POWERUPS.magnet.color, transparent: true, opacity: 0.8 }));
  magnetRing.rotation.x = Math.PI / 2; magnetRing.position.y = 0.6;
  const fx = new THREE.Group();
  fx.add(rageAura, shieldBubble, magnetRing);
  scene.add(fx);

  // Scenery: blue towers on the left, red on the right, trees behind them.
  const scenery = [];
  const SCENERY_SPAN = 150;
  for (let z = 0; z > -SCENERY_SPAN; z -= 30) {
    for (const side of [-1, 1]) {
      const tower = assets[side < 0 ? 'towerBlue' : 'towerRed'].template.clone();
      tower.position.set(side * 6, 0, z);
      tower.rotation.y = rand(0, Math.PI * 2);
      scene.add(tower); scenery.push(tower);
    }
  }
  for (let i = 0; i < 26; i++) {
    const tree = assets.tree.template.clone();
    const side = i % 2 ? 1 : -1;
    tree.position.set(side * rand(8.5, 16), 0, -rand(0, SCENERY_SPAN));
    tree.rotation.y = rand(0, Math.PI * 2);
    tree.scale.setScalar(rand(0.8, 1.3));
    scene.add(tree); scenery.push(tree);
  }

  // Pools
  const elixirTemplate = makeElixirTemplate();
  const cardLoader = new THREE.TextureLoader();
  const cardTextures = {};
  for (const [key, p] of Object.entries(POWERUPS)) {
    const tex = cardLoader.load(`./assets/cards/${p.card}.webp`);
    tex.colorSpace = THREE.SRGBColorSpace;
    cardTextures[key] = tex;
  }

  const world = new THREE.Group();
  scene.add(world);
  const pools = {};
  const takeFromPool = (kind, make) => {
    const pool = pools[kind] || (pools[kind] = []);
    const item = pool.pop() || make();
    item.obj.visible = true;
    world.add(item.obj);
    return item;
  };
  const release = (item) => {
    item.obj.visible = false;
    world.remove(item.obj);
    (pools[item.kind] || (pools[item.kind] = [])).push(item);
  };

  const makeObstacle = (kind) => () => {
    let item;
    if (kind === 'skeleton') {
      const obj = new THREE.Group();
      const members = [];
      [[-0.4, 0.2], [0.4, 0.2], [0, -0.3]].forEach(([x, z]) => {
        const s = instantiate(assets.skeleton);
        s.obj.position.set(x, 0, z);
        obj.add(s.obj);
        addShadow(s.obj, 0.7);
        members.push(s);
      });
      item = { obj, members };
    } else if (kind === 'log') {
      item = { obj: makeLog() };
      addShadow(item.obj, 1.3);
    } else if (kind === 'arrows') {
      item = { obj: makeArrows() };
    } else {
      const inst = instantiate(assets[kind]);
      item = { obj: inst.obj };
      addShadow(item.obj, kind === 'crates' ? 1.8 : 1.2);
    }
    item.kind = kind;
    return item;
  };

  const makeElixir = () => {
    const obj = elixirTemplate.clone();
    return { obj, kind: 'elixir' };
  };

  const makePowerup = (type) => () => {
    const obj = new THREE.Group();
    const card = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 1.02), new THREE.MeshBasicMaterial({ map: cardTextures[type], transparent: true, side: THREE.DoubleSide }));
    card.position.y = 1.0;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.6, 32), new THREE.MeshBasicMaterial({ color: POWERUPS[type].color, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03;
    obj.add(card, ring);
    obj.userData.card = card;
    return { obj, kind: 'pu_' + type, type };
  };

  let obstacles = [];
  let pickups = [];

  // ---------- state ----------
  const s = {};
  const reset = () => {
    obstacles.forEach(release); pickups.forEach(release);
    obstacles = []; pickups = [];
    Object.assign(s, {
      status: 'ready', speed: START_SPEED, dist: 0, score: 0, elixir: 0, elapsed: 0,
      lane: 1, prevLane: 1, x: 0, y: 0, vy: 0, jumping: false, sliding: 0, slideQueued: false,
      rage: 0, magnet: 0, shield: 0, chaserT: 0, stumbleCooldown: 0, nextRowAt: 30, lastPowerupAt: 0,
      chaserZ: CHASER_CLOSE, overT: 0, caught: false,
    });
    player.obj.position.set(0, 0, 0);
    player.obj.rotation.set(0, 0, 0);
    chaser.obj.position.set(0.9, 0, CHASER_CLOSE);
    play(player, 'idle');
    play(chaser, 'idle');
    emitHud(true);
  };

  let hudTimer = 0;
  function emitHud(force) {
    if (!onHud) return;
    hudTimer = 0;
    onHud({
      status: s.status, score: Math.floor(s.score), elixir: s.elixir,
      rage: s.rage, magnet: s.magnet, shield: s.shield, chaser: s.chaserT > 0 && s.status === 'running',
      force: !!force,
    });
  }
  const emit = (name, data) => onEvent && onEvent(name, data);

  // ---------- actions ----------
  const moveLane = (dir) => {
    if (s.status !== 'running') return;
    const next = Math.max(0, Math.min(2, s.lane + dir));
    if (next === s.lane) return;
    s.prevLane = s.lane;
    s.lane = next;
    emit('lane');
  };
  const jump = () => {
    if (s.status !== 'running' || s.jumping) return;
    s.jumping = true; s.vy = JUMP_V; s.sliding = 0;
    play(player, 'jump', { once: true, timeScale: 1.3 });
    emit('jump');
  };
  const slide = () => {
    if (s.status !== 'running') return;
    if (s.jumping) { s.vy = -JUMP_V * 1.4; s.slideQueued = true; return; }
    s.sliding = SLIDE_TIME;
    play(player, 'slide', { once: true, timeScale: 1.4 });
    emit('slide');
  };

  const endRun = (caught) => {
    if (s.status !== 'running') return;
    s.status = 'over';
    s.caught = caught;
    s.overT = 0;
    if (caught) { s.chaserZ = 1.4; play(chaser, 'cheer'); play(player, 'hit', { once: true }); }
    else { play(player, 'death', { once: true }); play(chaser, 'cheer'); }
    emit('crash', { caught });
    emitHud(true);
    setTimeout(() => onGameOver && onGameOver({ score: Math.floor(s.score), elixir: s.elixir, distance: Math.floor(s.dist), caught }), 1100);
  };

  const stumble = () => {
    if (s.stumbleCooldown > 0) return;
    s.stumbleCooldown = 0.6;
    const t = s.lane; s.lane = s.prevLane; s.prevLane = t;
    if (s.chaserT > 0) { endRun(true); return; }
    s.chaserT = 5;
    play(player, 'hit', { once: true, timeScale: 1.5 });
    emit('stumble');
  };

  // ---------- spawning ----------
  const gapTime = () => Math.max(0.78, 1.45 - s.elapsed * 0.005);

  const spawnElixirLine = (lane, z, count = 5, arc = false) => {
    for (let i = 0; i < count; i++) {
      const e = takeFromPool('elixir', makeElixir);
      const t = count > 1 ? i / (count - 1) : 0;
      e.baseY = arc ? 0.9 + Math.sin(t * Math.PI) * 1.3 : 0.8;
      e.obj.position.set(LANES[lane], e.baseY, z - i * 2.2);
      e.lane = lane;
      pickups.push(e);
    }
  };

  const spawnRow = () => {
    const t = s.elapsed;
    const weights = [['barrel', 3], ['skeleton', 3], ['crates', 2.5], ['arrows', t > 10 ? 2 : 0], ['log', t > 18 ? 1.6 : 0]];
    const roll = Math.random();
    let blocked = roll < (t < 15 ? 0.7 : 0.45) ? 1 : (roll < 0.93 || t < 35 ? 2 : 3);
    const lanes = [0, 1, 2].sort(() => Math.random() - 0.5);
    const kinds = lanes.slice(0, blocked).map(() => pickWeighted(weights));
    if (blocked === 3 && kinds.every(k => k === 'crates')) kinds[0] = 'barrel';
    if (blocked === 2 && kinds[0] === 'crates' && kinds[1] === 'crates' && Math.random() < 0.5) kinds[1] = 'barrel';

    kinds.forEach((kind, i) => {
      const lane = lanes[i];
      const ob = takeFromPool(kind, makeObstacle(kind));
      ob.lane = lane;
      ob.hit = false; ob.sideHit = false;
      ob.obj.position.set(LANES[lane], 0, SPAWN_Z);
      ob.obj.rotation.set(0, 0, 0);
      if (ob.members) ob.members.forEach(m => { play(m, 'idle'); m.mixer && m.mixer.setTime(Math.random() * 2); });
      obstacles.push(ob);
      if (kind === 'barrel' && Math.random() < 0.3) spawnElixirLine(lane, SPAWN_Z + 3.3, 3, true);
    });

    const free = lanes.slice(blocked);
    if (!free.length) return;
    const lane = free[Math.floor(Math.random() * free.length)];
    const noPowerActive = s.rage <= 0 && s.magnet <= 0 && s.shield <= 0;
    if (noPowerActive && s.dist - s.lastPowerupAt > 320 && Math.random() < 0.35) {
      const type = pickWeighted([['rage', 1], ['magnet', 1], ['shield', 1]]);
      const pu = takeFromPool('pu_' + type, makePowerup(type));
      pu.lane = lane;
      pu.obj.position.set(LANES[lane], 0, SPAWN_Z);
      pickups.push(pu);
      s.lastPowerupAt = s.dist;
    } else if (Math.random() < 0.7) {
      spawnElixirLine(lane, SPAWN_Z + 4);
    }
  };

  // ---------- update ----------
  const tmp = new THREE.Vector3();
  const update = (dt) => {
    if (s.status === 'running') {
      s.elapsed += dt;
      s.speed = Math.min(MAX_SPEED, START_SPEED + s.elapsed * 0.22);
      const move = s.speed * dt;
      s.dist += move;
      s.score += move * 0.5 * (s.rage > 0 ? 2 : 1);
      s.rage = Math.max(0, s.rage - dt);
      s.magnet = Math.max(0, s.magnet - dt);
      s.shield = Math.max(0, s.shield - dt);
      s.chaserT = Math.max(0, s.chaserT - dt);
      s.stumbleCooldown = Math.max(0, s.stumbleCooldown - dt);

      // Player movement
      s.x += (LANES[s.lane] - s.x) * Math.min(1, dt * 14);
      if (s.jumping) {
        s.vy -= GRAVITY * dt;
        s.y += s.vy * dt;
        if (s.y <= 0) {
          s.y = 0; s.vy = 0; s.jumping = false;
          if (s.slideQueued) { s.slideQueued = false; s.sliding = SLIDE_TIME; play(player, 'slide', { once: true, timeScale: 1.4 }); }
          else play(player, 'run', { timeScale: s.speed / 14 });
        }
      } else if (s.sliding > 0) {
        s.sliding -= dt;
        if (s.sliding <= 0) play(player, 'run', { timeScale: s.speed / 14 });
      } else if (player.current !== player.actions.hit || !player.actions.hit.isRunning()) {
        play(player, 'run', { timeScale: s.speed / 14 });
      }

      // Spawning
      if (s.dist >= s.nextRowAt) { spawnRow(); s.nextRowAt = s.dist + s.speed * gapTime(); }

      // Obstacles
      const playerTop = s.y + (s.sliding > 0 ? SLIDE_H : STAND_H);
      for (let i = obstacles.length - 1; i >= 0; i--) {
        const ob = obstacles[i];
        const spec = OBSTACLES[ob.kind];
        ob.obj.position.z += move + (spec.extraSpeed || 0) * dt;
        if (ob.kind === 'log') ob.obj.userData.roller.rotation.x -= dt * 8;
        if (ob.flying) { ob.obj.position.y += dt * 6; ob.obj.rotation.x += dt * 6; }
        if (ob.obj.position.z > DESPAWN_Z) { release(ob); obstacles.splice(i, 1); continue; }
        if (ob.hit || ob.flying) continue;
        const dz = Math.abs(ob.obj.position.z);
        if (dz > spec.d / 2 + 0.3) continue;
        const dx = Math.abs(ob.obj.position.x - s.x);
        if (dx >= spec.w / 2 + PLAYER_HALF_W) continue;
        if (!(s.y < spec.y1 && playerTop > spec.y0)) continue;
        // Collision
        const frontal = ob.lane === s.lane && Math.abs(s.x - LANES[s.lane]) < 0.5;
        if (s.shield > 0) {
          s.shield = 0; ob.flying = true; emit('shieldBreak');
        } else if (frontal) {
          ob.hit = true; endRun(false); break;
        } else if (!ob.sideHit) {
          ob.sideHit = true; stumble();
        }
      }

      // Pickups
      for (let i = pickups.length - 1; i >= 0; i--) {
        const p = pickups[i];
        p.obj.position.z += move;
        if (p.kind === 'elixir') {
          p.obj.rotation.y += dt * 3;
          if (s.magnet > 0 && p.obj.position.z > -14 && p.obj.position.z < 1) {
            p.obj.position.x += (s.x - p.obj.position.x) * Math.min(1, dt * 8);
            p.obj.position.y += (s.y + 0.9 - p.obj.position.y) * Math.min(1, dt * 8);
          }
        } else {
          p.obj.userData.card.rotation.y += dt * 2.5;
          p.obj.userData.card.position.y = 1.0 + Math.sin(s.elapsed * 4) * 0.12;
        }
        if (p.obj.position.z > DESPAWN_Z) { release(p); pickups.splice(i, 1); continue; }
        const dx = Math.abs(p.obj.position.x - s.x), dz = Math.abs(p.obj.position.z);
        const py = p.kind === 'elixir' ? p.obj.position.y : 1.0;
        if (dx < 0.8 && dz < 0.8 && Math.abs(s.y + 0.8 - py) < 1.1) {
          if (p.kind === 'elixir') {
            const gain = s.rage > 0 ? 2 : 1;
            s.elixir += gain; s.score += 10 * gain;
            emit('elixir');
          } else {
            s[p.type] = POWERUPS[p.type].duration;
            emit('powerup', { type: p.type });
          }
          release(p); pickups.splice(i, 1);
        }
      }

      // Scenery and ground scroll
      pathTex.offset.y += move / 5;
      grassTex.offset.y += move / (200 / 60);
      for (const o of scenery) { o.position.z += move; if (o.position.z > DESPAWN_Z) o.position.z -= SCENERY_SPAN + DESPAWN_Z; }

      // Chaser
      const target = s.chaserT > 0 ? CHASER_CLOSE : CHASER_FAR;
      s.chaserZ += (target - s.chaserZ) * Math.min(1, dt * (s.chaserT > 0 ? 3 : 0.8));
      play(chaser, 'run', { timeScale: s.speed / 14 });
    } else if (s.status === 'over') {
      s.overT += dt;
      if (s.caught) s.chaserZ += (1.3 - s.chaserZ) * Math.min(1, dt * 6);
      if (s.y > 0) { s.vy -= GRAVITY * dt; s.y = Math.max(0, s.y + s.vy * dt); }
    }

    // Place characters
    player.obj.position.set(s.x, s.y, 0);
    player.obj.rotation.z = (LANES[s.lane] - s.x) * -0.08;
    playerShadow.position.set(s.x, 0.02, 0);
    playerShadow.scale.setScalar(1.1 - Math.min(0.5, s.y * 0.2));
    const chaserX = s.x + (s.lane === 2 ? -0.9 : 0.9);
    chaser.obj.position.x += (chaserX - chaser.obj.position.x) * Math.min(1, dt * 4);
    chaser.obj.position.z = s.chaserZ;
    chaser.obj.visible = s.chaserZ < 14;

    fx.position.set(s.x, s.y, 0);
    rageAura.visible = s.rage > 0; rageAura.scale.setScalar(1 + Math.sin(performance.now() / 120) * 0.08);
    magnetRing.visible = s.magnet > 0; magnetRing.rotation.z += dt * 4;
    shieldBubble.visible = s.shield > 0;
    shieldBubble.material.opacity = s.shield > 0 && s.shield < 3 ? 0.12 + (Math.sin(performance.now() / 90) > 0 ? 0.12 : 0) : 0.22;

    // Animation mixers (skip far-away obstacles to save time on phones)
    player.mixer && player.mixer.update(dt);
    chaser.mixer && chaser.mixer.update(dt);
    for (const ob of obstacles) {
      if (ob.members && ob.obj.position.z > -45) for (const m of ob.members) m.mixer && m.mixer.update(dt);
    }

    // Camera follows the player
    const fovTarget = 62 + (s.speed - START_SPEED) * 0.35;
    camera.fov += (fovTarget - camera.fov) * Math.min(1, dt * 2);
    camera.updateProjectionMatrix();
    camera.position.x += (s.x * 0.55 - camera.position.x) * Math.min(1, dt * 6);
    camera.position.y += (4.3 + s.y * 0.35 - camera.position.y) * Math.min(1, dt * 6);
    tmp.set(camera.position.x * 0.9, 0.9 + s.y * 0.2, -8);
    camera.lookAt(tmp);

    hudTimer += dt;
    if (hudTimer > 0.1) emitHud(false);
  };

  // ---------- loop, resize, input ----------
  let raf = 0, last = 0, paused = false, destroyed = false;
  const frame = (now) => {
    if (destroyed) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    if (!paused) update(dt);
    renderer.render(scene, camera);
  };

  const resize = () => {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  const onKey = (e) => {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a') moveLane(-1);
    else if (k === 'arrowright' || k === 'd') moveLane(1);
    else if (k === 'arrowup' || k === 'w' || k === ' ') jump();
    else if (k === 'arrowdown' || k === 's') slide();
    else return;
    e.preventDefault();
  };
  let touchStart = null;
  const onTouchStart = (e) => { const t = e.changedTouches[0]; touchStart = { x: t.clientX, y: t.clientY, used: false }; };
  const onTouchMove = (e) => {
    if (!touchStart || touchStart.used) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x, dy = t.clientY - touchStart.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 28) return;
    touchStart.used = true;
    if (Math.abs(dx) > Math.abs(dy)) moveLane(dx > 0 ? 1 : -1);
    else if (dy < 0) jump(); else slide();
    e.preventDefault();
  };
  // Mouse drag works the same way on desktop.
  let mouseStart = null;
  const onMouseDown = (e) => { mouseStart = { x: e.clientX, y: e.clientY, used: false }; };
  const onMouseMove = (e) => {
    if (!mouseStart || mouseStart.used) return;
    const dx = e.clientX - mouseStart.x, dy = e.clientY - mouseStart.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 28) return;
    mouseStart.used = true;
    if (Math.abs(dx) > Math.abs(dy)) moveLane(dx > 0 ? 1 : -1);
    else if (dy < 0) jump(); else slide();
  };
  const onMouseUp = () => { mouseStart = null; };
  const onVisibility = () => { if (document.hidden && s.status === 'running') { paused = true; emit('autoPause'); } };

  window.addEventListener('keydown', onKey);
  container.addEventListener('touchstart', onTouchStart, { passive: true });
  container.addEventListener('touchmove', onTouchMove, { passive: false });
  container.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  document.addEventListener('visibilitychange', onVisibility);

  reset();
  raf = requestAnimationFrame(frame);

  // Test hook: open the page with ?rushdebug to step the game manually from the console.
  if (new URLSearchParams(location.search).has('rushdebug')) {
    window.__rush = {
      state: s, obstacles: () => obstacles, pickups: () => pickups,
      step(seconds = 1, fps = 60) { for (let i = 0; i < seconds * fps; i++) update(1 / fps); renderer.render(scene, camera); },
      input: { left: () => moveLane(-1), right: () => moveLane(1), jump, slide },
    };
    document.removeEventListener('visibilitychange', onVisibility);
  }

  return {
    start() {
      if (s.status !== 'ready') reset();
      s.status = 'running';
      paused = false;
      play(player, 'run', { timeScale: s.speed / 14 });
      emitHud(true);
    },
    restart() { reset(); this.start(); },
    pause() { paused = true; },
    resume() { paused = false; last = 0; },
    isPaused: () => paused,
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('keydown', onKey);
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('visibilitychange', onVisibility);
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

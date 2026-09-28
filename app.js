// Undercover Royale. Plain ES module, no build step: Preact + htm render the UI.
// Styles live in styles.css (source) and app.css (built by the GitHub Action).
import { html, render, useState, useEffect, useRef, useMemo } from './vendor/preact-htm.js';
import { ICONS } from './vendor/icons.js';
import { POWERUPS } from './runner/models.js';

// --- CONFIG ---
const CARD_BASE_URL = './assets/cards/';
const BADGE_BASE_URL = './assets/badges/';
const ARENA_BASE_URL = './assets/arenas/';
const CARD_DATA_URL = './card_data.json?v=2';
const UNKNOWN_CARD = CARD_BASE_URL + 'card-legendary-unknown.webp';
const SAD_GOBLIN_GIF = 'https://media1.tenor.com/m/d8gHX1wRaaRAAAAC/clash-royale-goblin.gif';
const MAX_GUESSES = 10;
const STORAGE_KEY = 'undercover-royale:v2';
const ASSET_CACHE = 'ur-assets-v1'; // must match sw.js

// One distinct badge per seat, so each player keeps the same avatar all game.
const AVATAR_BADGES = [
  'A_Char_King_01.webp', 'A_Char_Knight_01.webp', 'A_Char_Goblin_01.webp', 'A_Char_Pekka_01.webp',
  'A_Char_Prince_01.webp', 'A_Char_MiniPekka_01.webp', 'A_Char_Barbarian_01.webp', 'A_Char_DarkPrince_01.webp',
  'A_Char_Bomb_01.webp', 'A_Char_Hammer_01.webp', 'A_Char_Rocket_01.webp', 'Crown_01.webp',
  'Bolt_01.webp', 'Elixir_01.webp', 'Diamond_01.webp'
];

const PAIRS = [
  {civilian:"Knight",undercover:"Mega Knight"},
  {civilian:"Musketeer",undercover:"Archers"},
  {civilian:"Giant",undercover:"Golem"},
  {civilian:"Wizard",undercover:"Ice Wizard"},
  {civilian:"Baby Dragon",undercover:"Inferno Dragon"},
  {civilian:"Skeleton Army",undercover:"Goblin Gang"},
  {civilian:"Prince",undercover:"Dark Prince"},
  {civilian:"Fireball",undercover:"Rocket"},
  {civilian:"Tesla",undercover:"Inferno Tower"},
  {civilian:"Minions",undercover:"Bats"},
  {civilian:"Hog Rider",undercover:"Ram Rider"},
  {civilian:"P.E.K.K.A",undercover:"Mini P.E.K.K.A"},
  {civilian:"Barbarians",undercover:"Elite Barbarians"},
  {civilian:"Cannon",undercover:"Mortar"},
  {civilian:"Princess",undercover:"Archer Queen"},
  {civilian:"Goblins",undercover:"Spear Goblins"},
  {civilian:"Balloon",undercover:"Skeleton Barrel"},
  {civilian:"Valkyrie",undercover:"Executioner"},
  {civilian:"Zap",undercover:"Lightning"},
  {civilian:"Witch",undercover:"Night Witch"},
  {civilian:"Miner",undercover:"Goblin Drill"},
  {civilian:"Arrows",undercover:"The Log"},
  {civilian:"Royal Giant",undercover:"Electro Giant"},
  {civilian:"Bandit",undercover:"Golden Knight"},
  {civilian:"Electro Dragon",undercover:"Skeleton Dragons"},
  {civilian:"Magic Archer",undercover:"Dart Goblin"},
  {civilian:"Royal Hogs",undercover:"Battle Ram"},
  {civilian:"Poison",undercover:"Earthquake"},
  {civilian:"Tombstone",undercover:"Furnace"},
  {civilian:"Mega Minion",undercover:"Phoenix"},
  {civilian:"Ice Spirit",undercover:"Electro Spirit"},
  {civilian:"Lumberjack",undercover:"Mighty Miner"},
  {civilian:"Freeze",undercover:"Tornado"},
  {civilian:"Graveyard",undercover:"Goblin Barrel"},
  {civilian:"Elixir Collector",undercover:"Goblin Hut"},
  {civilian:"Barbarian Hut",undercover:"Goblin Cage"},
  {civilian:"X-Bow",undercover:"Bomb Tower"},
  {civilian:"Lava Hound",undercover:"Giant Skeleton"},
  {civilian:"Rage",undercover:"Clone"},
  {civilian:"Wall Breakers",undercover:"Skeletons"},
  {civilian:"Guards",undercover:"Rascals"},
  {civilian:"Battle Healer",undercover:"Monk"},
  {civilian:"Cannon Cart",undercover:"Goblin Giant"},
  {civilian:"Elixir Golem",undercover:"Ice Golem"},
  {civilian:"Flying Machine",undercover:"Zappies"},
  {civilian:"Giant Snowball",undercover:"Barbarian Barrel"},
  {civilian:"Little Prince",undercover:"Skeleton King"},
  {civilian:"Bowler",undercover:"Executioner"},
  {civilian:"Fisherman",undercover:"Royal Ghost"},
  {civilian:"Sparky",undercover:"Inferno Dragon"}
];

// --- CONSTANTS ---
const ROLES = { CIV:'civilian', UND:'undercover', WHT:'mr_white', JES:'jester', BG:'bodyguard', HNT:'hunter', EWIZ:'electro' };
const MODES = { REG:'regular', CHS:'chaos', STAT:'stat_guess', RUSH:'rush' };
const IMPOSTOR_ROLES = [ROLES.UND, ROLES.WHT, ROLES.EWIZ];
const CIVILIAN_ROLES = [ROLES.CIV, ROLES.BG, ROLES.HNT];
const SPECIAL_ROLES = [ROLES.WHT, ROLES.JES, ROLES.BG, ROLES.HNT, ROLES.EWIZ];
const CHAOS_ROLES = [ROLES.JES, ROLES.BG, ROLES.HNT, ROLES.EWIZ];

// Role presentation: name, accent color, team, card art, short blurb.
const ROLE_INFO = {
  [ROLES.CIV]:  { name:'Civilian',       color:'var(--civ)', team:'Civilians', art:'knight',         blurb:'Gets the common card. Find the impostors.' },
  [ROLES.UND]:  { name:'Undercover',     color:'var(--und)', team:'Impostors', art:'royal-ghost',    blurb:'Gets a similar card. Blend in.' },
  [ROLES.WHT]:  { name:'Mr. White',      color:'var(--wht)', team:'Impostors', art:null,             blurb:'No card at all. If caught, guess the civilian card to steal the win.' },
  [ROLES.JES]:  { name:'Jester',         color:'var(--jes)', team:'Neutral',   art:'goblins',        blurb:'Wins alone the moment they are voted out.' },
  [ROLES.BG]:   { name:'Bodyguard',      color:'var(--bg)',  team:'Civilians', art:'royal-recruits', blurb:'Protects one player. Falls with them if they are eliminated.' },
  [ROLES.HNT]:  { name:'Hunter',         color:'var(--hnt)', team:'Civilians', art:'hunter',         blurb:'When voted out, takes one last shot at another player.' },
  [ROLES.EWIZ]: { name:'Electro Wizard', color:'var(--ewz)', team:'Impostors', art:'electro-wizard', blurb:'Silences one player for the first discussion round.' },
};

const ROLE_SETTINGS = [
  { k:'und', role:ROLES.UND,  chaosOnly:false },
  { k:'wht', role:ROLES.WHT,  chaosOnly:false },
  { k:'ewz', role:ROLES.EWIZ, chaosOnly:true },
  { k:'jes', role:ROLES.JES,  chaosOnly:true },
  { k:'bg',  role:ROLES.BG,   chaosOnly:true },
  { k:'hnt', role:ROLES.HNT,  chaosOnly:true },
];
const IMPOSTOR_KEYS = ['und','wht','ewz'];

const MODE_INFO = {
  [MODES.REG]:  { label:'Regular',    icon:'users-three', btn:'btn-gold',   tab:['var(--blue-1)','var(--blue-2)','var(--blue-lip)'],       arena:'arena7.webp',  blurb:'Civilians, Undercover and Mr. White. Say one word, find the fake.' },
  [MODES.CHS]:  { label:'Chaos',      icon:'skull',       btn:'btn-purple', tab:['var(--purple-1)','var(--purple-2)','var(--purple-lip)'], arena:'arena12.webp', blurb:'Adds the Jester, Bodyguard, Hunter and Electro Wizard.' },
  [MODES.STAT]: { label:'Stat Guess', short:'Stats', icon:'target', btn:'btn-green', tab:['var(--green-1)','var(--green-2)','var(--green-lip)'],    arena:'arena20.webp', blurb:'Guess the hidden card from its stats in 10 tries.' },
  [MODES.RUSH]: { label:'Royale Rush', short:'Rush', icon:'person-simple-run', btn:'btn-red', tab:['var(--red-1)','var(--red-2)','var(--red-lip)'], arena:'arena2.webp', blurb:'Dodge skeletons, barrels and arrows. Grab elixir. Outrun the Barbarian.' },
};

const TIMER_OPTIONS = [60, 120, 180, 300];
const DEFAULT_SETTINGS = { total:5, und:1, wht:0, jes:0, bg:0, hnt:0, ewz:0, timer:180, sound:true, vibrate:true };
const DEFAULT_STAT_STATS = { played:0, wins:0, streak:0, best:0 };
const DEFAULT_RUSH_STATS = { best:0, runs:0, elixir:0 };

// --- UTILS ---
const prefs = { sound: true, vibrate: true };
const getCardUrl = (n) => n ? `${CARD_BASE_URL}${n.toLowerCase().replace(/\./g, '').replace(/\s+/g, '-')}.webp` : UNKNOWN_CARD;
const roleArtUrl = (role) => ROLE_INFO[role]?.art ? getCardUrl(ROLE_INFO[role].art) : UNKNOWN_CARD;
const onImgError = (e) => { if (!e.currentTarget.dataset.fallback) { e.currentTarget.dataset.fallback = '1'; e.currentTarget.src = UNKNOWN_CARD; } };
const levenshtein=(s,t)=>{if(!s.length)return t.length;if(!t.length)return s.length;const d=[];for(let i=0;i<=t.length;i++){d[i]=[i];for(let j=1;j<=s.length;j++){d[i][j]=i===0?j:Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(s[j-1]===t[i-1]?0:1))}}return d[t.length][s.length]};
const isCorrect=(g,a,t=0.75)=>{const G=g.trim().toLowerCase(),A=a.trim().toLowerCase();if(!G)return false;return G===A||(1-levenshtein(G,A)/Math.max(G.length,A.length))>=t; };
const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const fmtTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
const buzz = (p = 12) => { if (!prefs.vibrate) return; try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };
const loadSaved = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch (e) { return {}; } };
const defaultName = (i) => `Player ${i + 1}`;
const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// Tiny synthesized sound effects, so there are no audio files to download.
let audioCtx = null;
const tone = (freq, dur = 0.12, type = 'square', vol = 0.07, when = 0) => {
  if (!prefs.sound) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t = audioCtx.currentTime + when;
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(audioCtx.destination); o.start(t); o.stop(t + dur + 0.02);
  } catch (e) {}
};
const SFX = {
  tap:  () => tone(520, .05, 'triangle', .05),
  flip: () => { tone(320, .07, 'triangle', .06); tone(640, .1, 'triangle', .06, .06); },
  tick: () => tone(900, .06, 'square', .035),
  end:  () => { tone(220, .35, 'sawtooth', .07); tone(165, .5, 'sawtooth', .07, .3); },
  elim: () => { tone(260, .12, 'square', .06); tone(140, .3, 'square', .06, .1); },
  zap:  () => { tone(1400, .05, 'sawtooth', .04); tone(900, .08, 'sawtooth', .04, .05); tone(1600, .05, 'sawtooth', .04, .12); },
  win:  () => [523, 659, 784, 1047].forEach((f, i) => tone(f, .2, 'triangle', .08, i * .12)),
  lose: () => [392, 330, 262].forEach((f, i) => tone(f, .25, 'triangle', .08, i * .16)),
  coin: () => { tone(1320, .05, 'triangle', .045); tone(1760, .07, 'triangle', .04, .04); },
  hop:  () => { tone(330, .06, 'triangle', .05); tone(520, .08, 'triangle', .05, .04); },
  swish:() => tone(240, .07, 'triangle', .04),
};

const RUSH_SFX = {
  elixir: () => SFX.coin(),
  jump: () => SFX.hop(),
  slide: () => SFX.swish(),
  lane: () => tone(620, .03, 'triangle', .025),
  powerup: () => { SFX.zap(); buzz(30); },
  shieldBreak: () => { tone(300, .2, 'square', .06); buzz(60); },
  stumble: () => { SFX.elim(); buzz(50); },
  crash: () => { SFX.lose(); buzz([80, 40, 120]); },
};

// Settings validity: at least one civilian, and impostors must start outnumbered.
const activeKeys = (mode) => ROLE_SETTINGS.filter(r => mode === MODES.CHS || !r.chaosOnly).map(r => r.k);
const countOf = (s, keys) => keys.reduce((n, k) => n + (s[k] || 0), 0);
const isValidSettings = (s, mode) => {
  const keys = activeKeys(mode);
  const specials = countOf(s, keys);
  const impostors = countOf(s, keys.filter(k => IMPOSTOR_KEYS.includes(k)));
  return specials <= s.total - 1 && impostors <= Math.floor((s.total - 1) / 2);
};
const clampSettings = (s, mode) => {
  const next = { ...s };
  const order = ['hnt','bg','jes','ewz','wht','und'];
  let guard = 50;
  while (!isValidSettings(next, mode) && guard-- > 0) {
    const k = order.find(key => next[key] > 0 && activeKeys(mode).includes(key));
    if (!k) break;
    next[k] -= 1;
  }
  return next;
};

const winnersOf = (team, players, justEliminated) => players.filter(p =>
  (team === 'CIVILIANS' && CIVILIAN_ROLES.includes(p.role)) ||
  ((team === 'IMPOSTORS' || team === 'MR. WHITE') && IMPOSTOR_ROLES.includes(p.role)) ||
  (team === 'JESTER' && p.role === ROLES.JES && justEliminated.some(e => e.id === p.id)));

// Stat Guess comparison
const RARITY_ORDER = ['Common','Rare','Epic','Legendary','Champion'];
const SPEED_ORDER = ['Slow','Medium','Fast','Very Fast'];
const baseOf = (v) => String(v ?? '').split(' (')[0].trim();
const partsOf = (v) => baseOf(v).split(/\s*[\/&]\s*/).filter(Boolean);
const compareStat = (key, g, t) => {
  if (key === 'elixir' || key === 'hit_speed') {
    const G = parseFloat(g), T = parseFloat(t);
    if (isNaN(G) || isNaN(T)) return { status: String(g) === String(t) ? 'correct' : 'cold', value: g };
    if (G === T) return { status: 'correct', value: g };
    const close = key === 'elixir' ? Math.abs(G - T) <= 1 : Math.abs(G - T) <= 0.3;
    return { status: close ? 'warm' : 'cold', value: g, dir: G < T ? 'up' : 'down' };
  }
  if (String(g) === String(t)) return { status: 'correct', value: g };
  if (key === 'rarity' || key === 'speed') {
    const order = key === 'rarity' ? RARITY_ORDER : SPEED_ORDER;
    const gi = order.indexOf(baseOf(g)), ti = order.indexOf(baseOf(t));
    if (gi === ti && gi >= 0) return { status: 'warm', value: g };
    if (gi < 0 || ti < 0) return { status: 'cold', value: g };
    return { status: Math.abs(gi - ti) === 1 ? 'warm' : 'cold', value: g, dir: gi < ti ? 'up' : 'down' };
  }
  const gp = partsOf(g), tp = partsOf(t);
  return { status: gp.some(p => tp.includes(p)) ? 'warm' : 'cold', value: g };
};
const STAT_ROW_1 = [['elixir','Elixir'],['rarity','Rarity'],['speed','Speed'],['hit_speed','Hit spd']];
const STAT_ROW_2 = [['type','Type'],['targets','Targets'],['range_type','Range']];
const STAT_EMOJI = { correct: '\u{1F7E9}', warm: '\u{1F7E8}', cold: '\u{1F7E5}' };

// --- UI PRIMITIVES ---
const Icon = ({ name, fill = false, className = '' }) => html`
  <svg class=${`icon ${className}`} viewBox="0 0 256 256" aria-hidden="true" dangerouslySetInnerHTML=${{ __html: ICONS[name]?.[fill ? 'f' : 'b'] || '' }}></svg>`;

const Screen = ({ children, className = '' }) => html`
  <div class=${`h-full w-full max-w-[460px] mx-auto flex flex-col safe-top safe-bottom px-4 ${className}`}>${children}</div>`;

const TopBar = ({ left, title, right }) => html`
  <div class="flex items-center gap-3 mb-3 flex-shrink-0 min-h-[48px]">
    <div class="w-11 flex-shrink-0">${left}</div>
    <div class="flex-1 text-center display stroke text-2xl truncate">${title}</div>
    <div class="w-11 flex-shrink-0 flex justify-end">${right}</div>
  </div>`;

const Modal = ({ onClose, title, children, footer }) => {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return html`
    <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 bg-[rgba(5,12,30,.72)] backdrop-blur-[2px] anim-pop" onClick=${onClose} role="dialog" aria-modal="true" aria-label=${title}>
      <div class="panel w-full max-w-[440px] max-h-[86dvh] flex flex-col p-4 safe-bottom" onClick=${e => e.stopPropagation()}>
        <div class="flex items-center justify-between mb-3 flex-shrink-0">
          <h2 class="display stroke text-2xl text-gold">${title}</h2>
          <button class="btn btn-red btn-icon" onClick=${onClose} aria-label="Close"><${Icon} name="x" /></button>
        </div>
        <div class="overflow-y-auto flex-1 min-h-0 pr-1">${children}</div>
        ${footer && html`<div class="flex-shrink-0 pt-3">${footer}</div>`}
      </div>
    </div>`;
};

const Stepper = ({ value, onDec, onInc, canDec, canInc, label }) => html`
  <div class="flex items-center gap-2">
    <button class="step-btn" onClick=${onDec} disabled=${!canDec} aria-label=${`Fewer ${label}`}><${Icon} name="minus" /></button>
    <span class="display stroke text-xl w-7 text-center tabular-nums">${value}</span>
    <button class="step-btn" onClick=${onInc} disabled=${!canInc} aria-label=${`More ${label}`}><${Icon} name="plus" /></button>
  </div>`;

const RoleArt = ({ role, className = 'w-10' }) => html`
  <img src=${roleArtUrl(role)} onError=${onImgError} alt="" class=${`${className} h-auto drop-shadow-[0_2px_0_rgba(0,0,0,.4)]`} draggable="false" />`;

const RolePill = ({ role }) => html`
  <span class="display stroke-sm text-[11px] px-2 py-[3px] rounded-full border-2 border-[var(--ink)] whitespace-nowrap"
    style=${{ background: ROLE_INFO[role]?.color, color: '#fff' }}>${ROLE_INFO[role]?.name}</span>`;

const Toggle = ({ on, onClick, icon, iconOff, label }) => html`
  <button class="chip display stroke-sm icon-toggle flex-1 justify-center !py-2" aria-pressed=${on} onClick=${onClick}>
    <${Icon} name=${on ? icon : iconOff} fill className="text-base" /> ${label} ${on ? 'on' : 'off'}
  </button>`;

const PlayerTile = ({ p, selected, isFirst, onSelect, disabled, showZap, index }) => {
  const selectable = !!onSelect && !disabled && p.isAlive;
  const cls = ['ptile anim-rise',
    !p.isAlive && 'is-dead',
    selectable && !selected && 'is-target',
    selected && 'is-selected',
    isFirst && p.isAlive && !selectable && 'is-first',
  ].filter(Boolean).join(' ');
  return html`
    <button class=${cls} style=${{ '--i': index }} disabled=${!selectable} onClick=${() => { buzz(8); SFX.tap(); onSelect(p.id); }}
      aria-pressed=${selected} aria-label=${`${p.name}${!p.isAlive ? ', eliminated' : ''}`}>
      ${isFirst && p.isAlive && !selectable && html`<span class="tag display stroke-sm" style=${{ background: 'var(--gold-2)' }}>STARTS</span>`}
      ${showZap && p.isZapped && p.isAlive && html`<span class="tag display stroke-sm" style=${{ background: 'var(--ewz)' }}><${Icon} name="lightning" fill /> SILENCED</span>`}
      <img class="badge" src=${BADGE_BASE_URL + p.avatar} alt="" draggable="false" />
      <div class="pname display stroke-sm">${p.name}</div>
      ${!p.isAlive && html`
        <div class="absolute inset-0 grid place-items-center text-4xl text-white/80"><${Icon} name="skull" fill /></div>
        <div class="absolute -bottom-2 left-1/2 -translate-x-1/2"><${RolePill} role=${p.role} /></div>`}
    </button>`;
};

// The secret card: a card back that flips to the player's identity.
const RevealCard = ({ player, players, revealed, onReveal, small = false }) => {
  const info = ROLE_INFO[player.role];
  const isSpecial = SPECIAL_ROLES.includes(player.role);
  const artSrc = isSpecial ? roleArtUrl(player.role) : getCardUrl(player.word);
  return html`
    <div class=${`flip ${small ? 'w-[min(48vw,190px)]' : 'w-[min(72vw,280px)]'} aspect-[3/4] flex-shrink-0 ${revealed ? 'is-flipped' : ''}`}>
      <div class="flip-inner">
        <button class="face cardback flex flex-col items-center justify-center gap-4 w-full" onClick=${onReveal} aria-label="Reveal your card">
          <img src=${ARENA_BASE_URL + 'arena23.webp'} alt="" class="w-[62%] drop-shadow-[0_6px_0_rgba(0,0,0,.35)]" />
          <span class="display stroke text-xl">TAP TO REVEAL</span>
        </button>
        <div class="face face-back panel !rounded-[22px] flex flex-col items-center justify-center p-4 text-center"
          style=${{ boxShadow: `inset 0 0 0 4px ${isSpecial ? info.color : 'var(--gold-2)'}, 0 8px 0 rgba(5,12,30,.6)` }}>
          ${revealed && html`
            <img src=${artSrc} onError=${onImgError} alt="" class="w-[62%] h-auto drop-shadow-[0_6px_0_rgba(0,0,0,.35)]" />
            ${isSpecial
              ? html`<div class="display stroke text-2xl mt-3" style=${{ color: info.color }}>${info.name.toUpperCase()}</div>
                     <div class="body-font text-[11px] text-muted mt-1 uppercase tracking-wider">Team ${info.team}</div>`
              : html`<div class="display stroke text-2xl mt-3 text-gold leading-tight">${player.word}</div>`}
            ${player.role === ROLES.BG && html`<div class="body-font text-xs text-muted mt-1">Protect ${players.find(p => p.id === player.targetId)?.name}</div>`}`}
        </div>
      </div>
    </div>`;
};

// Royale Rush: the 3D runner lives in runner/runner.js and is only loaded when needed.
const RushScreen = ({ best, hold, onExit, onQuit, onResult }) => {
  const hostRef = useRef(null);
  const runnerRef = useRef(null);
  const bestAtStart = useRef(best);
  const [phase, setPhase] = useState('loading'); // loading | ready | running | paused | over | error
  const [progress, setProgress] = useState(0);
  const [hud, setHud] = useState({ score: 0, elixir: 0, rage: 0, magnet: 0, shield: 0, chaser: false });
  const [result, setResult] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let runner = null;
    import('./runner/runner.js')
      .then(m => m.createRunner(hostRef.current, {
        onProgress: (p) => !cancelled && setProgress(p),
        onHud: (h) => !cancelled && setHud(h),
        onEvent: (name) => {
          if (name === 'autoPause') { setPhase(ph => ph === 'running' ? 'paused' : ph); return; }
          RUSH_SFX[name] && RUSH_SFX[name]();
        },
        onGameOver: (r) => {
          if (cancelled) return;
          setResult({ ...r, newBest: r.score > bestAtStart.current && r.score > 0 });
          setPhase('over');
          onResult(r);
        },
      }))
      .then(r => {
        if (cancelled) { r.destroy(); return; }
        runner = r; runnerRef.current = r;
        setPhase('ready');
      })
      .catch(e => { console.error(e); if (!cancelled) setPhase('error'); });
    return () => { cancelled = true; runner && runner.destroy(); runnerRef.current = null; };
  }, []);

  // Pause while the "leave battle" dialog is open.
  useEffect(() => {
    const r = runnerRef.current;
    if (!r) return;
    if (hold) r.pause();
    else if (phase === 'running') r.resume();
  }, [hold]);

  const start = () => { SFX.tap(); buzz(15); runnerRef.current?.start(); setPhase('running'); };
  const again = () => {
    SFX.tap(); buzz(15);
    bestAtStart.current = Math.max(bestAtStart.current, result?.score || 0);
    setResult(null);
    runnerRef.current?.restart();
    setPhase('running');
  };
  const pause = () => { runnerRef.current?.pause(); setPhase('paused'); };
  const resume = () => { runnerRef.current?.resume(); setPhase('running'); };

  const powerChips = Object.entries(POWERUPS).filter(([k]) => hud[k] > 0);
  const hudBest = Math.max(bestAtStart.current, hud.score);

  return html`
    <div class="relative h-full w-full overflow-hidden">
      <div ref=${hostRef} class="absolute inset-0"></div>

      <div class="absolute inset-x-0 top-0 safe-top px-3 pointer-events-none">
        <div class="max-w-[460px] mx-auto flex items-start gap-2">
          <button class="btn btn-red btn-icon pointer-events-auto" onClick=${onQuit} aria-label="Quit to menu"><${Icon} name="house" fill /></button>
          <div class="flex-1 text-center">
            <div class="display stroke text-4xl tabular-nums leading-none">${hud.score}</div>
            <div class="display stroke-sm text-xs text-gold mt-1">BEST ${hudBest}</div>
          </div>
          ${phase === 'running'
            ? html`<button class="btn btn-icon pointer-events-auto" onClick=${pause} aria-label="Pause"><${Icon} name="pause" fill /></button>`
            : html`<div class="w-11"></div>`}
        </div>
        <div class="max-w-[460px] mx-auto flex flex-wrap items-center gap-1.5 mt-2">
          <span class="chip display stroke-sm"><img src=${BADGE_BASE_URL + 'Elixir_01.webp'} alt="" class="w-5 h-5 object-contain" /> ${hud.elixir}</span>
          ${powerChips.map(([k, p]) => html`
            <span key=${k} class="chip display stroke-sm"><img src=${getCardUrl(p.card)} alt="" class="w-5 h-auto" /> ${p.name} ${Math.ceil(hud[k])}s</span>`)}
          ${hud.chaser && phase === 'running' && html`<span class="chip display stroke-sm anim-pulse" style=${{ borderColor: 'var(--red-1)', color: 'var(--red-1)' }}>BARBARIAN CLOSE</span>`}
        </div>
      </div>

      ${phase === 'loading' && html`
        <div class="absolute inset-0 grid place-items-center bg-[rgba(10,23,51,.85)]">
          <div class="w-[min(80vw,320px)] text-center">
            <img src=${ARENA_BASE_URL + 'arena2.webp'} alt="" class="w-32 mx-auto anim-bob" />
            <div class="display stroke text-2xl mt-2">BUILDING THE ARENA</div>
            <div class="elixir mt-4"><div class="elixir-fill" style=${{ transform: `scaleX(${Math.max(0.05, progress)})`, transition: 'transform .2s' }}></div></div>
          </div>
        </div>`}

      ${phase === 'error' && html`
        <div class="absolute inset-0 grid place-items-center bg-[rgba(10,23,51,.9)] p-6">
          <div class="panel p-5 text-center max-w-[340px]">
            <div class="display stroke text-2xl">3D DID NOT LOAD</div>
            <p class="body-font text-sm text-muted mt-2">This device or browser could not start the 3D arena. Try another browser, or connect to the internet the first time you play.</p>
            <button class="btn w-full mt-4" onClick=${onExit}>Back to menu</button>
          </div>
        </div>`}

      ${phase === 'ready' && html`
        <div class="absolute inset-x-0 bottom-0 safe-bottom px-4 pointer-events-none">
          <div class="panel p-4 max-w-[440px] mx-auto pointer-events-auto anim-pop">
            <div class="display stroke text-2xl text-center">ROYALE RUSH</div>
            <div class="grid grid-cols-3 gap-2 mt-3 text-center body-font text-xs text-muted">
              <div class="well p-2"><div class="text-xl text-gold"><${Icon} name="hand-swipe-right" fill /></div>Swipe to change lane</div>
              <div class="well p-2"><div class="text-xl text-gold"><${Icon} name="arrow-fat-up" fill /></div>Swipe up to jump</div>
              <div class="well p-2"><div class="text-xl text-gold"><${Icon} name="arrow-fat-down" fill /></div>Swipe down to slide</div>
            </div>
            <button class="btn btn-gold btn-xl w-full mt-4" onClick=${start}><${Icon} name="person-simple-run" fill /> Run</button>
          </div>
        </div>`}

      ${phase === 'paused' && !hold && html`
        <div class="absolute inset-0 grid place-items-center bg-[rgba(10,23,51,.6)]">
          <div class="panel p-5 w-[min(84vw,320px)] text-center anim-pop">
            <div class="display stroke text-3xl">PAUSED</div>
            <button class="btn btn-gold btn-xl w-full mt-4" onClick=${resume}><${Icon} name="play" fill /> Resume</button>
            <button class="btn btn-slate w-full mt-3" onClick=${onExit}>Menu</button>
          </div>
        </div>`}

      ${phase === 'over' && result && html`
        <div class="absolute inset-0 grid place-items-center bg-[rgba(10,23,51,.55)] px-4">
          <div class="panel p-5 w-full max-w-[380px] text-center">
            <span class="ribbon display stroke text-2xl anim-banner" style=${{ background: 'linear-gradient(180deg,var(--red-1),var(--red-2))', boxShadow: 'inset 0 -3px 0 var(--red-lip), 0 3px 0 var(--ink)' }}>${result.caught ? 'CAUGHT' : 'KNOCKED OUT'}</span>
            <div class="display stroke text-5xl mt-4 tabular-nums">${result.score}</div>
            ${result.newBest
              ? html`<div class="display stroke text-gold mt-1 anim-pulse">NEW BEST</div>`
              : html`<div class="body-font text-sm text-muted mt-1">Best ${Math.max(bestAtStart.current, result.score)}</div>`}
            <div class="flex justify-center flex-wrap gap-1.5 mt-3">
              <span class="chip display"><img src=${BADGE_BASE_URL + 'Elixir_01.webp'} alt="" class="w-4 h-4 object-contain" /> ${result.elixir} elixir</span>
              <span class="chip display">${result.distance} m</span>
            </div>
            <div class="grid grid-cols-[auto_1fr] gap-3 mt-5">
              <button class="btn btn-icon !min-h-[60px] !w-[60px]" onClick=${onExit} aria-label="Menu"><${Icon} name="house" fill /></button>
              <button class="btn btn-gold btn-xl" onClick=${again}><${Icon} name="arrow-clockwise" /> Run again</button>
            </div>
          </div>
        </div>`}
    </div>`;
};

// Capture the install prompt as early as possible (index.html also stashes it).
let installPrompt = window.__installPrompt || null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; window.dispatchEvent(new Event('ur-installable')); });

// --- MAIN APP ---
const App = () => {
  const saved = useMemo(loadSaved, []);
  const [cardData, setCardData] = useState([]);
  const [cardDataError, setCardDataError] = useState(false);
  const [gameState, setGameState] = useState('setup');
  const [gameMode, setGameMode] = useState(saved.gameMode && Object.values(MODES).includes(saved.gameMode) ? saved.gameMode : MODES.REG);
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS, ...(saved.settings || {}) });
  const [playerNames, setPlayerNames] = useState(() => {
    const base = Array(15).fill('').map((_, i) => defaultName(i));
    (saved.playerNames || []).slice(0, 15).forEach((n, i) => { if (typeof n === 'string') base[i] = n; });
    return base;
  });
  const [scores, setScores] = useState(saved.scores || {});
  const [statStats, setStatStats] = useState({ ...DEFAULT_STAT_STATS, ...(saved.statStats || {}) });
  const [rushStats, setRushStats] = useState({ ...DEFAULT_RUSH_STATS, ...(saved.rushStats || {}) });
  const [recentPairs, setRecentPairs] = useState(Array.isArray(saved.recentPairs) ? saved.recentPairs : []);
  const [players, setPlayers] = useState([]);
  const [revealIndex, setRevealIndex] = useState(0);
  const [isRevealing, setIsRevealing] = useState(false);
  const [winner, setWinner] = useState({ team: null, reason: null });
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [justEliminated, setJustEliminated] = useState([]);
  const [currentWords, setCurrentWords] = useState({ civilian: '', undercover: '' });
  const [mrWhiteGuess, setMrWhiteGuess] = useState('');
  const [lastWhiteGuess, setLastWhiteGuess] = useState(null);
  const [showRules, setShowRules] = useState(false);
  const [showNames, setShowNames] = useState(false);
  const [showQuit, setShowQuit] = useState(false);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [canInstall, setCanInstall] = useState(() => !isStandalone() && (!!installPrompt || isIOS()));
  const [peek, setPeek] = useState(null); // null | { id: null } picking | { id, revealed }
  const [toast, setToast] = useState(null);
  const [timer, setTimer] = useState(settings.timer);
  const [paused, setPaused] = useState(false);
  const [round, setRound] = useState(1);
  const [firstSpeaker, setFirstSpeaker] = useState(null);
  const [statGuessTarget, setStatGuessTarget] = useState(null);
  const [statGuesses, setStatGuesses] = useState([]);
  const [statGuessInput, setStatGuessInput] = useState('');
  const [statError, setStatError] = useState('');
  const [suggestOpen, setSuggestOpen] = useState(false);
  const timerRef = useRef(null);
  const toastRef = useRef(null);
  const prevTimer = useRef(timer);
  const gameId = useRef(0);
  const settledGame = useRef(0);
  const gameStateRef = useRef(gameState);
  const whiteInputRef = useRef(null);
  gameStateRef.current = gameState;
  prefs.sound = settings.sound !== false;
  prefs.vibrate = settings.vibrate !== false;

  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 2200);
  };

  // --- EFFECTS ---
  useEffect(() => {
    fetch(CARD_DATA_URL)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(list => setCardData(list.filter((c, i, a) => c && c.name && a.findIndex(x => x.name === c.name) === i)))
      .catch(() => setCardDataError(true));
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ gameMode, settings, playerNames, scores, statStats, rushStats, recentPairs })); } catch (e) {}
  }, [gameMode, settings, playerNames, scores, statStats, rushStats, recentPairs]);

  // Discussion timer
  useEffect(() => {
    if (gameState === 'discussing' && !paused) {
      timerRef.current = setInterval(() => {
        setTimer(prev => {
          if (prev <= 1) { clearInterval(timerRef.current); return 0; }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [gameState, paused]);

  useEffect(() => {
    if (gameState === 'discussing' && timer !== prevTimer.current) {
      if (timer === 0) { SFX.end(); buzz([200, 100, 200]); }
      else if (timer <= 5) SFX.tick();
    }
    prevTimer.current = timer;
  }, [timer]);

  // Keep the screen awake while a game is running.
  const inGame = gameState !== 'setup';
  useEffect(() => {
    if (!inGame || !('wakeLock' in navigator)) return;
    let lock = null, cancelled = false;
    const request = async () => {
      try {
        if (document.visibilityState !== 'visible') return;
        lock = await navigator.wakeLock.request('screen');
        if (cancelled) lock.release();
      } catch (e) {}
    };
    request();
    const onVis = () => document.visibilityState === 'visible' && request();
    document.addEventListener('visibilitychange', onVis);
    return () => { cancelled = true; document.removeEventListener('visibilitychange', onVis); lock && lock.release().catch(() => {}); };
  }, [inGame]);

  // Phone back button: ask before leaving a game instead of closing the app.
  useEffect(() => {
    if (!inGame) return;
    history.pushState({ ur: 1 }, '');
    const onPop = () => {
      if (gameStateRef.current === 'over') { setGameState('setup'); return; }
      history.pushState({ ur: 1 }, '');
      setShowQuit(true);
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (history.state && history.state.ur) history.back();
    };
  }, [inGame]);

  // Install availability
  useEffect(() => {
    const onInstallable = () => setCanInstall(!isStandalone());
    const onInstalled = () => { setCanInstall(false); installPrompt = null; showToast('Installed. Find it on your home screen.'); };
    window.addEventListener('ur-installable', onInstallable);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('ur-installable', onInstallable); window.removeEventListener('appinstalled', onInstalled); };
  }, []);

  // Once card data is in, quietly cache every card image so Stat Guess works offline.
  useEffect(() => {
    if (!cardData.length || !('caches' in window) || navigator.connection?.saveData) return;
    const urls = [...new Set([
      ...cardData.map(c => getCardUrl(c.name)),
      ...PAIRS.flatMap(p => [getCardUrl(p.civilian), getCardUrl(p.undercover)]),
      ...Object.keys(ROLE_INFO).map(roleArtUrl),
    ])];
    let cancelled = false;
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1500));
    idle(async () => {
      try {
        const cache = await caches.open(ASSET_CACHE);
        for (const u of urls) {
          if (cancelled) return;
          const abs = new URL(u, location.href).href;
          if (await cache.match(abs)) continue;
          try { const r = await fetch(abs); if (r.ok) await cache.put(abs, r); } catch (e) {}
        }
      } catch (e) {}
    });
    return () => { cancelled = true; };
  }, [cardData]);

  // Settle a finished game once: scoreboard, Stat Guess streaks, sounds.
  useEffect(() => {
    if (gameState !== 'over' || settledGame.current === gameId.current) return;
    settledGame.current = gameId.current;
    if (gameMode === MODES.STAT) {
      const won = winner.team === 'GUESSERS';
      won ? SFX.win() : SFX.lose();
      setStatStats(s => {
        const streak = won ? s.streak + 1 : 0;
        return { played: s.played + 1, wins: s.wins + (won ? 1 : 0), streak, best: Math.max(s.best, streak) };
      });
    } else {
      SFX.win();
      const ws = winnersOf(winner.team, players, justEliminated);
      if (ws.length) setScores(prev => { const n = { ...prev }; ws.forEach(p => { n[p.name] = (n[p.name] || 0) + 1; }); return n; });
    }
  }, [gameState]);

  useEffect(() => { if (gameState === 'wht_guess') whiteInputRef.current?.focus(); }, [gameState]);

  // --- SETTINGS ---
  const changeSetting = (key, delta) => {
    buzz(6); SFX.tap();
    setSettings(prev => {
      if (key === 'total') {
        const total = Math.max(3, Math.min(15, prev.total + delta));
        return clampSettings({ ...prev, total }, gameMode);
      }
      const next = { ...prev, [key]: Math.max(0, prev[key] + delta) };
      return isValidSettings(next, gameMode) ? next : prev;
    });
  };
  const canChange = (key, delta) => {
    if (key === 'total') { const t = settings.total + delta; return t >= 3 && t <= 15; }
    const v = settings[key] + delta;
    if (v < 0) return false;
    return isValidSettings({ ...settings, [key]: v }, gameMode);
  };

  const selectMode = (m) => {
    buzz(6); SFX.tap();
    setGameMode(m);
    if (m === MODES.REG || m === MODES.CHS) setSettings(prev => clampSettings(prev, m));
  };

  const handleInstall = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      try { const { outcome } = await installPrompt.userChoice; if (outcome === 'accepted') setCanInstall(false); } catch (e) {}
      installPrompt = null;
    } else {
      setShowInstallHelp(true);
    }
  };

  // --- GAME FUNCTIONS ---
  const chooseFirstSpeaker = (list) => {
    const alive = list.filter(p => p.isAlive);
    const preferred = alive.filter(p => p.role !== ROLES.WHT && !p.isZapped);
    const pool = preferred.length ? preferred : alive;
    setFirstSpeaker(pool.length ? pick(pool).id : null);
  };

  const startStatGame = () => {
    const elixirCards = cardData.filter(c => !isNaN(parseFloat(c.elixir)));
    if (!elixirCards.length) return;
    gameId.current += 1;
    setStatGuessTarget(pick(elixirCards));
    setStatGuesses([]);
    setStatGuessInput('');
    setStatError('');
    setGameState('stat_game');
  };

  const pickPair = () => {
    const recent = recentPairs.filter(i => i < PAIRS.length);
    const pool = PAIRS.map((_, i) => i).filter(i => !recent.includes(i));
    const idx = pick(pool.length ? pool : PAIRS.map((_, i) => i));
    const keep = Math.min(15, PAIRS.length - 1);
    setRecentPairs([idx, ...recent].slice(0, keep));
    return PAIRS[idx];
  };

  const startGame = () => {
    buzz(20); SFX.flip();
    if (gameMode === MODES.STAT) { startStatGame(); return; }
    gameId.current += 1;
    if (gameMode === MODES.RUSH) { setGameState('rush'); return; }

    const pair = pickPair();
    const swap = Math.random() > 0.5;
    const words = {
      [ROLES.CIV]: swap ? pair.undercover : pair.civilian,
      [ROLES.UND]: swap ? pair.civilian : pair.undercover,
      [ROLES.WHT]: null, [ROLES.JES]: 'Goblins', [ROLES.BG]: 'Royal Recruits', [ROLES.HNT]: 'Hunter', [ROLES.EWIZ]: 'Electro Wizard'
    };
    setCurrentWords({ civilian: words[ROLES.CIV], undercover: words[ROLES.UND] });

    const s = clampSettings(settings, gameMode);
    let roleDeck = [...Array(s.und).fill(ROLES.UND), ...Array(s.wht).fill(ROLES.WHT)];
    if (gameMode === MODES.CHS) {
      roleDeck.push(...Array(s.jes).fill(ROLES.JES), ...Array(s.bg).fill(ROLES.BG), ...Array(s.hnt).fill(ROLES.HNT), ...Array(s.ewz).fill(ROLES.EWIZ));
    }
    while (roleDeck.length < s.total) roleDeck.push(ROLES.CIV);
    roleDeck = shuffle(roleDeck);

    // Seats keep their avatar; the reveal order is shuffled.
    const seats = shuffle(Array.from({ length: s.total }, (_, i) => i));
    let newPlayers = roleDeck.map((role, i) => {
      const seat = seats[i];
      return {
        id: i, name: (playerNames[seat] || '').trim() || defaultName(seat), role, word: words[role],
        isAlive: true, isZapped: false, avatar: AVATAR_BADGES[seat % AVATAR_BADGES.length]
      };
    });

    if (gameMode === MODES.CHS) {
      // Mirror Match: two civilians are told they share a card.
      const civilians = newPlayers.filter(p => p.role === ROLES.CIV);
      if (civilians.length >= 2 && Math.random() < 0.05) {
        const [p1, p2] = shuffle(civilians);
        newPlayers = newPlayers.map(p =>
          p.id === p1.id ? { ...p, mirrorId: p2.id, mirrorName: p2.name } :
          p.id === p2.id ? { ...p, mirrorId: p1.id, mirrorName: p1.name } : p
        );
      }
      newPlayers.filter(p => p.role === ROLES.BG).forEach(bg => {
        const potentialTargets = newPlayers.filter(p => p.id !== bg.id && !p.isTarget);
        if (potentialTargets.length > 0) {
          const target = pick(potentialTargets);
          newPlayers = newPlayers.map(p =>
            p.id === bg.id ? { ...p, targetId: target.id } :
            p.id === target.id ? { ...p, isTarget: true } : p
          );
        }
      });
    }

    setPlayers(newPlayers);
    setRevealIndex(0);
    setIsRevealing(false);
    setSelectedPlayerId(null);
    setJustEliminated([]);
    setMrWhiteGuess('');
    setLastWhiteGuess(null);
    setTimer(s.timer);
    setPaused(false);
    setRound(1);
    setPeek(null);
    setGameState('reveal');
  };

  const reveal = () => { buzz(15); SFX.flip(); setIsRevealing(true); };

  const handleNextReveal = () => {
    buzz(10); SFX.tap();
    setIsRevealing(false);
    if (revealIndex + 1 < players.length) {
      setRevealIndex(revealIndex + 1);
    } else {
      chooseFirstSpeaker(players);
      setGameState('discussing');
    }
  };

  const handleZap = (targetId) => {
    buzz(30); SFX.zap();
    const updated = players.map(p => p.id === targetId ? { ...p, isZapped: true } : p);
    setPlayers(updated);
    setIsRevealing(false);
    if (revealIndex + 1 < updated.length) setRevealIndex(revealIndex + 1);
    else { chooseFirstSpeaker(updated); setGameState('discussing'); }
  };

  const killPlayers = (eliminatedPlayers) => {
    SFX.elim();
    setJustEliminated(eliminatedPlayers);
    const eliminatedIds = eliminatedPlayers.map(p => p.id);
    const updatedPlayers = players.map(p => eliminatedIds.includes(p.id) ? { ...p, isAlive: false } : p);
    setPlayers(updatedPlayers);

    const alivePlayers = updatedPlayers.filter(p => p.isAlive);
    const impostors = alivePlayers.filter(p => IMPOSTOR_ROLES.includes(p.role)).length;
    const civilians = alivePlayers.filter(p => CIVILIAN_ROLES.includes(p.role)).length;

    setSelectedPlayerId(null);

    if (impostors === 0 && civilians > 0) {
      setWinner({ team: 'CIVILIANS', reason: 'Every impostor has been found.' });
      setGameState('over');
    } else if (impostors >= civilians && impostors > 0) {
      setWinner({ team: 'IMPOSTORS', reason: 'The impostors took over the clan.' });
      setGameState('over');
    } else if (civilians === 0 && impostors === 0) {
      setWinner({ team: 'NO ONE', reason: 'Nobody is left standing.' });
      setGameState('over');
    } else {
      setGameState('summary');
    }
  };

  const finalizeElimination = (targetPlayer) => {
    const bodyguards = players.filter(p => p.role === ROLES.BG && p.isAlive && p.targetId === targetPlayer.id);
    killPlayers([targetPlayer, ...bodyguards]);
  };

  const handleElimination = () => {
    if (selectedPlayerId === null) return;
    buzz(40);
    const targetPlayer = players.find(p => p.id === selectedPlayerId);

    if (targetPlayer.role === ROLES.JES) {
      setJustEliminated([targetPlayer]);
      setPlayers(players.map(p => p.id === targetPlayer.id ? { ...p, isAlive: false } : p));
      setWinner({ team: 'JESTER', reason: `${targetPlayer.name} wanted to be voted out.` });
      setGameState('over');
      return;
    }
    if (targetPlayer.role === ROLES.WHT) {
      SFX.elim();
      setJustEliminated([targetPlayer]);
      setMrWhiteGuess('');
      setGameState('wht_guess');
      setSelectedPlayerId(null);
      return;
    }
    if (targetPlayer.role === ROLES.HNT) {
      SFX.elim();
      setJustEliminated([targetPlayer]);
      setGameState('hnt_rev');
      setSelectedPlayerId(null);
      return;
    }
    finalizeElimination(targetPlayer);
  };

  const handleHunterShot = (targetId) => {
    buzz(40);
    const hunter = justEliminated.find(p => p.role === ROLES.HNT);
    const targetPlayer = players.find(p => p.id === targetId);
    const bodyguards = players.filter(p => p.role === ROLES.BG && p.isAlive && p.id !== hunter.id && (p.targetId === targetPlayer.id || p.targetId === hunter.id));
    const list = [hunter, targetPlayer, ...bodyguards].filter((p, i, a) => a.findIndex(x => x.id === p.id) === i);
    killPlayers(list);
  };

  const handleMrWhiteGuess = () => {
    if (!mrWhiteGuess.trim()) return;
    if (isCorrect(mrWhiteGuess, currentWords.civilian)) {
      buzz([60, 40, 60]);
      setWinner({ team: 'MR. WHITE', reason: `${justEliminated[0]?.name} guessed ${currentWords.civilian}.` });
      setGameState('over');
    } else {
      setLastWhiteGuess(mrWhiteGuess.trim());
      finalizeElimination(justEliminated[0]);
    }
  };

  const nextRound = () => {
    buzz(10); SFX.tap();
    const cleared = players.map(p => ({ ...p, isZapped: false }));
    setPlayers(cleared);
    setRound(r => r + 1);
    setTimer(settings.timer);
    setPaused(false);
    setLastWhiteGuess(null);
    chooseFirstSpeaker(cleared);
    setGameState('discussing');
  };

  const quitToMenu = () => { setShowQuit(false); setPeek(null); setGameState('setup'); };

  // --- STAT GUESS ---
  const guessedNames = useMemo(() => new Set(statGuesses.map(g => g.cardName)), [statGuesses]);
  const suggestions = useMemo(() => {
    const q = statGuessInput.trim().toLowerCase();
    if (!q) return [];
    return cardData
      .filter(c => !guessedNames.has(c.name) && c.name.toLowerCase().includes(q))
      .sort((a, b) => (b.name.toLowerCase().startsWith(q) - a.name.toLowerCase().startsWith(q)) || a.name.localeCompare(b.name))
      .slice(0, 6);
  }, [statGuessInput, cardData, guessedNames]);

  const submitStatGuess = (nameOverride) => {
    const raw = (nameOverride ?? statGuessInput).trim().toLowerCase();
    if (!raw) return;
    let guessedCard = cardData.find(c => c.name.toLowerCase() === raw);
    if (!guessedCard && !nameOverride && suggestions.length === 1) guessedCard = suggestions[0];
    if (!guessedCard) { setStatError('Not a card we know. Pick one from the list.'); buzz(60); return; }
    if (guessedNames.has(guessedCard.name)) { setStatError(`You already tried ${guessedCard.name}.`); buzz(60); return; }

    buzz(12); SFX.flip();
    const feedback = {};
    [...STAT_ROW_1, ...STAT_ROW_2].forEach(([key]) => { feedback[key] = compareStat(key, guessedCard[key], statGuessTarget[key]); });
    const isWin = guessedCard.name === statGuessTarget.name;

    const newGuesses = [{ cardName: guessedCard.name, feedback, isWin }, ...statGuesses];
    setStatGuesses(newGuesses);
    setStatGuessInput('');
    setStatError('');
    setSuggestOpen(false);

    if (isWin) {
      setWinner({ team: 'GUESSERS', reason: `Found in ${newGuesses.length} ${newGuesses.length === 1 ? 'try' : 'tries'}.` });
      setTimeout(() => setGameState('over'), 900);
    } else if (newGuesses.length >= MAX_GUESSES) {
      setWinner({ team: 'FAIL', reason: `Out of tries. The card was ${statGuessTarget.name}.` });
      setTimeout(() => setGameState('over'), 900);
    }
  };

  const shareStatResult = async () => {
    const won = winner.team === 'GUESSERS';
    const rows = [...statGuesses].reverse().map(g => [...STAT_ROW_1, ...STAT_ROW_2].map(([k]) => STAT_EMOJI[g.feedback[k].status]).join(''));
    const text = `Undercover Royale: Stat Guess ${won ? statGuesses.length : 'X'}/${MAX_GUESSES}\n${rows.join('\n')}\n${location.origin + location.pathname}`;
    if (navigator.share) {
      try { await navigator.share({ text }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(text); showToast('Result copied'); } catch (e) { showToast('Could not share'); }
  };

  // ================= RENDER =================
  const quitButton = html`<button class="btn btn-red btn-icon" onClick=${() => setShowQuit(true)} aria-label="Quit to menu"><${Icon} name="house" fill /></button>`;

  const overlays = html`
    ${showQuit && html`
      <${Modal} title="LEAVE BATTLE?" onClose=${() => setShowQuit(false)}
        footer=${html`<div class="grid grid-cols-2 gap-3"><button class="btn btn-sm" onClick=${() => setShowQuit(false)}>Stay</button><button class="btn btn-red btn-sm" onClick=${quitToMenu}>Leave</button></div>`}>
        <p class="body-font text-muted">This game ends and roles are lost. Your settings and names are kept.</p>
      <//>`}
    ${toast && html`<div class="toast display stroke-sm anim-pop" role="status">${toast}</div>`}`;

  let screen = null;

  // ---------- SETUP ----------
  if (gameState === 'setup') {
    const mode = MODE_INFO[gameMode];
    const keys = activeKeys(gameMode);
    const impostors = countOf(settings, keys.filter(k => IMPOSTOR_KEYS.includes(k)));
    const specials = countOf(settings, keys);
    const civilians = settings.total - specials;
    const isStat = gameMode === MODES.STAT;
    const isRush = gameMode === MODES.RUSH;
    const statReady = cardData.length > 0;
    const canStart = isRush ? true : isStat ? statReady : impostors > 0;
    const cta = isRush ? 'Run' : isStat ? (cardDataError ? 'Cards failed to load' : statReady ? 'Start guessing' : 'Loading cards') : (canStart ? 'Battle' : 'Add an impostor');
    const scoreList = Object.entries(scores).sort((a, b) => b[1] - a[1]);

    screen = html`
      <${Screen}>
        <header class="flex items-center gap-3 mb-2 flex-shrink-0 anim-pop">
          <img src=${BADGE_BASE_URL + 'Crown_01.webp'} alt="" class="w-11 h-11 object-contain" />
          <h1 class="display stroke leading-[.95] flex-1 min-w-0">
            <span class="block text-[26px]">UNDERCOVER</span>
            <span class="block text-[30px] text-gold">ROYALE</span>
          </h1>
          ${canInstall && html`<button class="btn btn-green btn-icon" onClick=${handleInstall} aria-label="Install app"><${Icon} name="download-simple" /></button>`}
          <button class="btn btn-icon" onClick=${() => setShowRules(true)} aria-label="How to play"><${Icon} name="question" /></button>
        </header>

        <div class="flex-1 min-h-0 overflow-y-auto no-scrollbar -mx-4 px-4 pb-3">
          <div class="relative flex items-center gap-2 mb-3">
            <img key=${mode.arena} src=${ARENA_BASE_URL + mode.arena} alt="" class="w-[42%] max-w-[180px] aspect-square object-contain anim-pop anim-bob drop-shadow-[0_10px_12px_rgba(0,0,0,.45)]" />
            <div class="flex-1 anim-pop" key=${gameMode}>
              <div class="display stroke text-3xl">${mode.label.toUpperCase()}</div>
              <p class="body-font text-sm text-muted mt-1 leading-snug">${mode.blurb}</p>
            </div>
          </div>

          <div class="well p-1.5 flex gap-1.5 mb-4" role="tablist" aria-label="Game mode">
            ${Object.entries(MODE_INFO).map(([m, info]) => html`
              <button key=${m} role="tab" aria-selected=${gameMode === m} class="tab stroke-sm" onClick=${() => selectMode(m)}
                style=${{ '--c1': info.tab[0], '--c2': info.tab[1], '--lip': info.tab[2] }}>
                <${Icon} name=${info.icon} fill />
                ${(info.short || info.label).toUpperCase()}
              </button>`)}
          </div>

          ${isRush ? html`
            <div class="panel p-4 anim-pop" key="rushcfg">
              <div class="display stroke text-xl mb-3">HOW TO RUN</div>
              <div class="grid grid-cols-3 gap-2 text-center">
                ${[['arrow-left', 'arrow-right', 'Swipe sideways', 'Change lane'], ['arrow-fat-up', null, 'Swipe up', 'Jump'], ['arrow-fat-down', null, 'Swipe down', 'Slide']].map(([a, b, h, t]) => html`
                  <div key=${h} class="well p-2 flex flex-col items-center gap-1">
                    <div class="text-2xl text-gold flex"><${Icon} name=${a} fill />${b && html`<${Icon} name=${b} fill />`}</div>
                    <div class="display stroke-sm text-xs">${t}</div>
                    <div class="body-font text-[10px] text-muted leading-tight">${h}</div>
                  </div>`)}
              </div>
              <p class="body-font text-xs text-muted mt-2 flex items-center gap-1.5"><${Icon} name="keyboard" /> On a keyboard: arrow keys or WASD, space to jump.</p>
              <div class="display stroke text-lg mt-4 mb-2">POWER-UPS</div>
              <div class="space-y-2">
                ${Object.entries(POWERUPS).map(([k, p]) => html`
                  <div key=${k} class="well p-2 flex items-center gap-3">
                    <img src=${getCardUrl(p.card)} alt="" class="w-9 h-auto" />
                    <div class="min-w-0">
                      <div class="display stroke-sm text-sm">${p.name}</div>
                      <div class="body-font text-xs text-muted">${p.blurb}. Lasts ${p.duration}s.</div>
                    </div>
                  </div>`)}
              </div>
              <p class="body-font text-xs text-muted mt-3">Brush an obstacle from the side and you stumble, and the Barbarian catches up. Stumble again while he is close and he gets you.</p>
              ${rushStats.runs > 0 && html`
                <div class="mt-3 flex flex-wrap gap-1.5">
                  <span class="chip display"><${Icon} name="trophy" fill className="text-gold" /> Best ${rushStats.best}</span>
                  <span class="chip display">Runs ${rushStats.runs}</span>
                  <span class="chip display"><img src=${BADGE_BASE_URL + 'Elixir_01.webp'} alt="" class="w-4 h-4 object-contain" /> ${rushStats.elixir}</span>
                </div>`}
            </div>
          ` : !isStat ? html`
            <div class="panel p-4 space-y-4 anim-pop" key=${'cfg' + gameMode}>
              <div class="flex items-center justify-between">
                <div>
                  <div class="display stroke text-xl">PLAYERS</div>
                  <div class="body-font text-xs text-muted">3 to 15, one phone</div>
                </div>
                <${Stepper} label="players" value=${settings.total}
                  onDec=${() => changeSetting('total', -1)} onInc=${() => changeSetting('total', 1)}
                  canDec=${canChange('total', -1)} canInc=${canChange('total', 1)} />
              </div>

              <div class="grid grid-cols-2 gap-2">
                ${ROLE_SETTINGS.filter(r => keys.includes(r.k)).map((r, i) => html`
                  <div key=${r.k} class="well p-2.5 flex flex-col gap-2 anim-rise" style=${{ '--i': i }}>
                    <div class="flex items-center gap-2 min-w-0">
                      <${RoleArt} role=${r.role} className="w-7 flex-shrink-0" />
                      <span class="display stroke-sm text-[13px] leading-tight" style=${{ color: ROLE_INFO[r.role].color }}>${ROLE_INFO[r.role].name}</span>
                    </div>
                    <${Stepper} label=${ROLE_INFO[r.role].name} value=${settings[r.k]}
                      onDec=${() => changeSetting(r.k, -1)} onInc=${() => changeSetting(r.k, 1)}
                      canDec=${canChange(r.k, -1)} canInc=${canChange(r.k, 1)} />
                  </div>`)}
              </div>

              <div class="flex flex-wrap gap-1.5" aria-live="polite">
                <span class="chip display"><span style=${{ color: 'var(--civ)' }}>${civilians}</span> Civilian${civilians === 1 ? '' : 's'}</span>
                <span class="chip display"><span style=${{ color: 'var(--und)' }}>${impostors}</span> Impostor${impostors === 1 ? '' : 's'}</span>
                ${gameMode === MODES.CHS && settings.jes > 0 && html`<span class="chip display"><span style=${{ color: 'var(--jes)' }}>${settings.jes}</span> Neutral</span>`}
              </div>

              <div>
                <div class="display stroke-sm text-sm mb-2">DISCUSSION TIMER</div>
                <div class="well p-1 grid grid-cols-4 gap-1">
                  ${TIMER_OPTIONS.map(t => html`
                    <button key=${t} class="tab stroke-sm !min-h-[38px]" aria-selected=${settings.timer === t}
                      style=${{ '--c1': 'var(--blue-1)', '--c2': 'var(--blue-2)', '--lip': 'var(--blue-lip)' }}
                      onClick=${() => { buzz(6); SFX.tap(); setSettings(s => ({ ...s, timer: t })); }}>
                      ${t / 60} MIN
                    </button>`)}
                </div>
              </div>

              <button class="well w-full p-2.5 flex items-center gap-3 text-left active:scale-[.98] transition-transform" onClick=${() => setShowNames(true)}>
                <div class="flex -space-x-3 flex-shrink-0">
                  ${Array.from({ length: Math.min(settings.total, 5) }).map((_, i) => html`
                    <img key=${i} src=${BADGE_BASE_URL + AVATAR_BADGES[i]} alt="" class="w-9 h-9 object-contain" />`)}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="display stroke-sm text-sm">EDIT NAMES</div>
                  <div class="body-font text-xs text-muted truncate">${playerNames.slice(0, settings.total).map((n, i) => n.trim() || defaultName(i)).join(', ')}</div>
                </div>
                <${Icon} name="pencil-simple" className="text-xl text-gold" />
              </button>
            </div>

            ${scoreList.length > 0 && html`
              <div class="panel p-3 mt-4 anim-pop">
                <div class="flex items-center justify-between mb-2">
                  <div class="display stroke text-lg flex items-center gap-2"><${Icon} name="trophy" fill className="text-gold" /> SCOREBOARD</div>
                  <button class="btn btn-slate btn-sm !min-h-[34px] !text-xs" onClick=${() => { setScores({}); showToast('Scores reset'); }}>Reset</button>
                </div>
                <div class="flex flex-wrap gap-1.5">
                  ${scoreList.slice(0, 8).map(([name, pts], i) => html`
                    <span key=${name} class="chip display">${i === 0 && html`<${Icon} name="crown-simple" fill className="text-gold" />`}${name} <span class="text-gold">${pts}</span></span>`)}
                </div>
              </div>`}
          ` : html`
            <div class="panel p-4 anim-pop" key="statcfg">
              <div class="display stroke text-xl mb-3">HOW IT WORKS</div>
              <div class="space-y-2 body-font text-sm">
                <div class="flex items-center gap-3"><span class="stile s-correct !min-h-0 w-16 display stroke-sm text-xs">MATCH</span><span class="text-muted">Stat is exactly right.</span></div>
                <div class="flex items-center gap-3"><span class="stile s-warm !min-h-0 w-16 display stroke-sm text-xs">CLOSE</span><span class="text-muted">Nearly there, or partly right.</span></div>
                <div class="flex items-center gap-3"><span class="stile s-cold !min-h-0 w-16 display stroke-sm text-xs">MISS</span><span class="text-muted">Arrow shows if the answer is higher or lower.</span></div>
              </div>
              <div class="mt-4 flex flex-wrap gap-1.5">
                <span class="chip body-font">
                  ${cardDataError ? html`<span style=${{ color: 'var(--red-1)' }}>Could not load card data. Check your connection and reload.</span>`
                    : statReady ? `${cardData.length} cards in the pool`
                    : html`<span class="animate-pulse">Loading cards...</span>`}
                </span>
                ${statStats.played > 0 && html`
                  <span class="chip display"><${Icon} name="fire" fill className="text-gold" /> Streak ${statStats.streak}</span>
                  <span class="chip display">Best ${statStats.best}</span>
                  <span class="chip display">Won ${statStats.wins}/${statStats.played}</span>`}
              </div>
            </div>`}

          <div class="grid grid-cols-2 gap-2 mt-4">
            <${Toggle} on=${settings.sound !== false} icon="speaker-high" iconOff="speaker-slash" label="Sound"
              onClick=${() => setSettings(s => { const next = { ...s, sound: s.sound === false }; prefs.sound = next.sound; if (next.sound) SFX.tap(); return next; })} />
            <${Toggle} on=${settings.vibrate !== false} icon="lightning" iconOff="lightning" label="Vibration"
              onClick=${() => setSettings(s => { const next = { ...s, vibrate: s.vibrate === false }; prefs.vibrate = next.vibrate; buzz(20); return next; })} />
          </div>
        </div>

        <div class="flex-shrink-0 pt-2">
          <button class=${`btn btn-xl w-full ${mode.btn}`} disabled=${!canStart} onClick=${startGame}>
            ${canStart && html`<${Icon} name=${isRush ? 'person-simple-run' : isStat ? 'target' : 'sword'} fill />`}
            ${cta}
          </button>
          <div class="text-center body-font text-[11px] text-white/35 mt-2 tracking-wider">BY VALE</div>
        </div>

        ${showRules && html`
          <${Modal} title="HOW TO PLAY" onClose=${() => setShowRules(false)}>
            <div class="body-font text-sm space-y-4">
              <ol class="space-y-2">
                ${[
                  ['Pass the phone', 'Each player secretly sees their card.'],
                  ['Describe it', 'Take turns saying one word about your card.'],
                  ['Vote', 'Eliminate who you think is lying.'],
                  ['Win', 'Civilians win when every impostor is out. Impostors win once they match the civilians.'],
                ].map(([h, b], i) => html`
                  <li key=${h} class="well p-3 flex gap-3">
                    <span class="display stroke text-xl text-gold w-5">${i + 1}</span>
                    <span><span class="display stroke-sm">${h}.</span> <span class="text-muted">${b}</span></span>
                  </li>`)}
              </ol>
              <div>
                <div class="display stroke text-lg mb-2">ROLES</div>
                <div class="space-y-2">
                  ${Object.entries(ROLE_INFO).map(([role, info]) => html`
                    <div key=${role} class="well p-2.5 flex items-center gap-3">
                      <${RoleArt} role=${role} className="w-10 flex-shrink-0" />
                      <div class="min-w-0">
                        <div class="flex items-baseline gap-2 flex-wrap">
                          <span class="display stroke-sm text-sm" style=${{ color: info.color }}>${info.name}</span>
                          <span class="text-[10px] text-muted uppercase tracking-wide">${info.team}${CHAOS_ROLES.includes(role) ? ', Chaos only' : ''}</span>
                        </div>
                        <p class="text-xs text-muted leading-snug">${info.blurb}</p>
                      </div>
                    </div>`)}
                </div>
              </div>
              <p class="text-xs text-muted">Forgot your card mid-game? Tap the eye button during the discussion. Chaos mode twist: rarely, two civilians are secretly told they share the same card (Mirror Match).</p>
            </div>
          <//>`}

        ${showNames && html`
          <${Modal} title="PLAYER NAMES" onClose=${() => setShowNames(false)}
            footer=${html`<div class="grid grid-cols-2 gap-3">
              <button class="btn btn-slate btn-sm" onClick=${() => setPlayerNames(Array(15).fill('').map((_, i) => defaultName(i)))}>Reset</button>
              <button class="btn btn-green btn-sm" onClick=${() => setShowNames(false)}>Done</button>
            </div>`}>
            <div class="space-y-2">
              ${Array.from({ length: settings.total }).map((_, i) => html`
                <label key=${i} class="flex items-center gap-2">
                  <img src=${BADGE_BASE_URL + AVATAR_BADGES[i]} alt="" class="w-10 h-10 object-contain flex-shrink-0" />
                  <span class="sr-only">Player ${i + 1} name</span>
                  <input type="text" class="field" maxLength="14" value=${playerNames[i]} placeholder=${defaultName(i)}
                    onFocus=${e => e.target.select()}
                    onInput=${(e) => { const v = e.target.value; setPlayerNames(prev => { const n = [...prev]; n[i] = v; return n; }); }} />
                </label>`)}
            </div>
          <//>`}

        ${showInstallHelp && html`
          <${Modal} title="INSTALL" onClose=${() => setShowInstallHelp(false)}>
            <div class="body-font text-sm space-y-2">
              <p class="text-muted">Add Undercover Royale to your home screen. It opens full screen and works offline.</p>
              ${isIOS() ? html`
                <div class="well p-3 flex items-center gap-3"><${Icon} name="export" className="text-2xl text-gold" /><span>Tap <b>Share</b> in the Safari toolbar.</span></div>
                <div class="well p-3 flex items-center gap-3"><${Icon} name="plus-square" className="text-2xl text-gold" /><span>Choose <b>Add to Home Screen</b>, then <b>Add</b>.</span></div>
              ` : html`
                <div class="well p-3 flex items-center gap-3"><${Icon} name="download-simple" className="text-2xl text-gold" /><span>Open your browser menu and choose <b>Install app</b> or <b>Add to Home screen</b>.</span></div>`}
            </div>
          <//>`}
      <//>`;
  }

  // ---------- REVEAL ----------
  else if (gameState === 'reveal') {
    const player = players[revealIndex];
    const potentialZapTargets = players.filter(p => !p.isZapped && p.id !== player.id);
    const needsToZap = player.role === ROLES.EWIZ && potentialZapTargets.length > 0;

    let hint = 'Remember your card. Do not say it out loud.';
    if (player.role === ROLES.WHT) hint = 'You have no card. Listen closely and bluff.';
    else if (player.role === ROLES.JES) hint = 'Act suspicious. Get yourself voted out.';
    else if (player.role === ROLES.HNT) hint = 'If you are voted out, you take someone with you.';
    else if (player.role === ROLES.BG) hint = `Protect ${players.find(p => p.id === player.targetId)?.name}. If they fall, so do you.`;
    else if (player.role === ROLES.EWIZ) hint = needsToZap ? 'Pick a player to silence for round one.' : 'Everyone is already silenced.';
    else if (player.mirrorId !== undefined) hint = `Mirror Match: ${player.mirrorName} has the same card as you.`;

    screen = html`
      <${Screen}>
        <${TopBar} left=${quitButton} title=${html`<span>REVEAL <span class="text-gold">${revealIndex + 1}</span>/${players.length}</span>`} />
        <div class="flex gap-1 mb-4 flex-shrink-0" aria-hidden="true">
          ${players.map((_, i) => html`
            <div key=${i} class="h-2 flex-1 rounded-full border-2 border-[var(--ink)]" style=${{ background: i < revealIndex ? 'var(--gold-2)' : i === revealIndex ? 'var(--gold-1)' : 'var(--well)' }}></div>`)}
        </div>

        <div class="flex-1 min-h-0 flex flex-col items-center overflow-y-auto no-scrollbar" key=${revealIndex}>
          <div class="flex items-center gap-3 mb-3 anim-pop">
            <img src=${BADGE_BASE_URL + player.avatar} alt="" class="w-14 h-14 object-contain" />
            <div>
              <div class="body-font text-sm text-muted">${isRevealing ? 'Only you should see this' : 'Pass the phone to'}</div>
              <div class="display stroke text-3xl text-gold truncate max-w-[240px]">${player.name}</div>
            </div>
          </div>

          <${RevealCard} player=${player} players=${players} revealed=${isRevealing} onReveal=${reveal} small=${isRevealing && needsToZap} />

          ${isRevealing && html`
            <p class="body-font text-center text-sm mt-4 px-4 anim-rise" style=${{ color: player.mirrorId !== undefined ? 'var(--gold)' : 'var(--muted)' }}>${hint}</p>`}

          ${isRevealing && needsToZap && html`
            <div class="grid grid-cols-3 gap-2 w-full mt-4 pb-2">
              ${potentialZapTargets.map((p, i) => html`
                <button key=${p.id} class="ptile is-target anim-rise" style=${{ '--i': i }} onClick=${() => handleZap(p.id)}>
                  <img class="badge !w-10 !h-10" src=${BADGE_BASE_URL + p.avatar} alt="" />
                  <div class="pname display stroke-sm">${p.name}</div>
                </button>`)}
            </div>`}
        </div>

        <div class="flex-shrink-0 pt-3">
          ${!isRevealing
            ? html`<button class="btn btn-xl w-full" onClick=${reveal}><${Icon} name="eye" fill /> Show my card</button>`
            : !needsToZap && html`<button class="btn btn-gold btn-xl w-full" onClick=${handleNextReveal}>${revealIndex + 1 < players.length ? 'Got it, hide' : 'Start battle'}</button>`}
        </div>
      <//>`;
  }

  // ---------- DISCUSS / VOTE / HUNTER ----------
  else if (gameState === 'discussing' || gameState === 'voting' || gameState === 'hnt_rev') {
    const discussing = gameState === 'discussing';
    const hunter = justEliminated.find(p => p.role === ROLES.HNT);
    const selectedName = players.find(p => p.id === selectedPlayerId)?.name;
    const first = players.find(p => p.id === firstSpeaker);
    const low = timer <= 30;
    const title = discussing ? 'DISCUSSION' : gameState === 'hnt_rev' ? 'LAST SHOT' : 'VOTE';
    const peekPlayer = peek && peek.id !== null ? players.find(p => p.id === peek.id) : null;

    screen = html`
      <${Screen}>
        <${TopBar} left=${quitButton} title=${title}
          right=${html`<span class="chip display stroke-sm whitespace-nowrap">R${round}</span>`} />

        ${discussing && html`
          <div class="mb-4 flex-shrink-0 anim-pop">
            <div class="flex items-center gap-3">
              <img src=${BADGE_BASE_URL + 'Elixir_01.webp'} alt="" class="w-9 h-9 object-contain" />
              <div class="flex-1 elixir" role="timer" aria-label=${`Time left ${fmtTime(timer)}`}>
                <div class="elixir-fill" style=${{ transform: `scaleX(${timer / settings.timer})` }}></div>
                <div class="elixir-ticks">${Array.from({ length: 10 }).map((_, i) => html`<span key=${i}></span>`)}</div>
              </div>
              <div class=${`display stroke text-2xl tabular-nums w-[64px] text-right ${low ? 'anim-pulse' : ''}`} style=${{ color: timer === 0 ? 'var(--red-1)' : low ? 'var(--gold)' : '#fff' }}>${fmtTime(timer)}</div>
            </div>
            <div class="flex items-center justify-between mt-3 gap-2">
              <p class="body-font text-sm text-muted truncate">
                ${timer === 0 ? html`<span style=${{ color: 'var(--red-1)' }}>Time is up. Go to the vote.</span>`
                  : first ? html`One word each. <span class="text-gold">${first.name}</span> starts.` : 'One word each.'}
              </p>
              <div class="flex gap-2 flex-shrink-0">
                <button class="btn btn-sm btn-icon" onClick=${() => setPeek({ id: null })} aria-label="Check my card"><${Icon} name="eye" fill /></button>
                <button class="btn btn-sm btn-icon" onClick=${() => setPaused(p => !p)} aria-label=${paused ? 'Resume timer' : 'Pause timer'} disabled=${timer === 0}>
                  <${Icon} name=${paused ? 'play' : 'pause'} fill />
                </button>
                <button class="btn btn-sm btn-icon" onClick=${() => setTimer(t => Math.min(t + 30, settings.timer))} aria-label="Add 30 seconds" disabled=${timer >= settings.timer}>
                  <span class="text-sm display">+30</span>
                </button>
              </div>
            </div>
          </div>`}

        ${gameState === 'voting' && html`<p class="body-font text-center text-muted text-sm mb-4 flex-shrink-0 anim-pop">Tap the player the clan wants out.</p>`}
        ${gameState === 'hnt_rev' && html`
          <div class="panel p-3 mb-4 flex items-center gap-3 flex-shrink-0 anim-pop" style=${{ boxShadow: 'inset 0 0 0 3px var(--hnt), 0 5px 0 rgba(5,12,30,.6)' }}>
            <${RoleArt} role=${ROLES.HNT} className="w-12" />
            <p class="body-font text-sm"><span class="display stroke-sm" style=${{ color: 'var(--hnt)' }}>${hunter?.name}</span> was the Hunter. Pick one player to take down with you.</p>
          </div>`}

        <div class="flex-1 min-h-0 overflow-y-auto no-scrollbar -mx-1 px-1 pt-3 pb-4">
          <div class="grid grid-cols-3 gap-x-2 gap-y-4">
            ${players.map((p, i) => html`
              <${PlayerTile} key=${p.id} p=${p} index=${i}
                selected=${selectedPlayerId === p.id}
                isFirst=${discussing && firstSpeaker === p.id}
                showZap=${discussing}
                onSelect=${discussing ? null : setSelectedPlayerId}
                disabled=${gameState === 'hnt_rev' && hunter && p.id === hunter.id} />`)}
          </div>
        </div>

        <div class="flex-shrink-0 pt-2">
          ${discussing && html`<button class="btn btn-red btn-xl w-full" onClick=${() => { buzz(15); SFX.tap(); setSelectedPlayerId(null); setGameState('voting'); }}><${Icon} name="gavel" fill /> Go to vote</button>`}
          ${gameState === 'voting' && html`
            <div class="grid grid-cols-[auto_1fr] gap-3">
              <button class="btn btn-icon !min-h-[64px] !w-[64px]" onClick=${() => { setSelectedPlayerId(null); setGameState('discussing'); }} aria-label="Back to discussion"><${Icon} name="arrow-left" /></button>
              <button class="btn btn-red btn-xl" disabled=${selectedPlayerId === null} onClick=${handleElimination}>
                <span class="truncate">${selectedName ? `Eliminate ${selectedName}` : 'Pick a player'}</span>
              </button>
            </div>`}
          ${gameState === 'hnt_rev' && html`
            <button class="btn btn-purple btn-xl w-full" disabled=${selectedPlayerId === null} onClick=${() => handleHunterShot(selectedPlayerId)}>
              <${Icon} name="crosshair" /> <span class="truncate">${selectedName ? `Shoot ${selectedName}` : 'Pick a target'}</span>
            </button>`}
        </div>

        ${peek && html`
          <${Modal} title="CHECK YOUR CARD" onClose=${() => setPeek(null)}
            footer=${peekPlayer && html`<button class="btn btn-gold w-full" onClick=${() => setPeek(null)}>${peek.revealed ? 'Hide my card' : 'Cancel'}</button>`}>
            ${!peekPlayer ? html`
              <p class="body-font text-sm text-muted mb-3">Who needs a reminder? Only that player should look at the screen.</p>
              <div class="grid grid-cols-3 gap-x-2 gap-y-3 pt-1">
                ${players.filter(p => p.isAlive).map((p, i) => html`
                  <button key=${p.id} class="ptile anim-rise" style=${{ '--i': i }} onClick=${() => { SFX.tap(); setPeek({ id: p.id, revealed: false }); }}>
                    <img class="badge !w-10 !h-10" src=${BADGE_BASE_URL + p.avatar} alt="" />
                    <div class="pname display stroke-sm">${p.name}</div>
                  </button>`)}
              </div>` : html`
              <div class="flex flex-col items-center pb-2">
                <div class="body-font text-sm text-muted mb-3">Only <span class="text-gold display stroke-sm">${peekPlayer.name}</span> should look</div>
                <${RevealCard} player=${peekPlayer} players=${players} revealed=${!!peek.revealed} small
                  onReveal=${() => { SFX.flip(); buzz(15); setPeek({ ...peek, revealed: true }); }} />
              </div>`}
          <//>`}
      <//>`;
  }

  // ---------- MR. WHITE GUESS ----------
  else if (gameState === 'wht_guess') {
    screen = html`
      <${Screen}>
        <${TopBar} left=${quitButton} title="LAST CHANCE" />
        <div class="flex-1 min-h-0 flex flex-col items-center justify-center text-center anim-pop">
          <img src=${UNKNOWN_CARD} alt="" class="w-32 mb-4 anim-bob" />
          <h2 class="display stroke text-3xl"><span class="text-gold">${justEliminated[0]?.name}</span> is Mr. White</h2>
          <p class="body-font text-muted mt-2 max-w-[30ch]">Name the civilians' card to steal the win. Close spelling counts.</p>
          <input ref=${whiteInputRef} type="text" value=${mrWhiteGuess} onInput=${(e) => setMrWhiteGuess(e.target.value)}
            onKeyDown=${(e) => e.key === 'Enter' && handleMrWhiteGuess()}
            placeholder="Type a card name" aria-label="Your guess"
            class="field mt-6 !text-2xl text-center display !py-4" />
        </div>
        <div class="flex-shrink-0 pt-3">
          <button class="btn btn-gold btn-xl w-full" disabled=${!mrWhiteGuess.trim()} onClick=${handleMrWhiteGuess}><${Icon} name="target" fill /> Lock in guess</button>
        </div>
      <//>`;
  }

  // ---------- ROUND SUMMARY ----------
  else if (gameState === 'summary') {
    const ids = justEliminated.map(p => p.id);
    const hunter = justEliminated.find(p => p.role === ROLES.HNT);
    const noteFor = (p) => {
      if (p.role === ROLES.WHT && lastWhiteGuess) return `Guessed "${lastWhiteGuess}". Wrong.`;
      if (p.role === ROLES.BG && ids.includes(p.targetId)) return `Fell protecting ${players.find(x => x.id === p.targetId)?.name}.`;
      if (hunter && p.id !== hunter.id && p.role !== ROLES.BG) return 'Shot by the Hunter.';
      return null;
    };
    const aliveCount = players.filter(p => p.isAlive).length;
    screen = html`
      <${Screen}>
        <div class="text-center mt-4 mb-5 flex-shrink-0">
          <span class="ribbon display stroke text-2xl anim-banner">ELIMINATED</span>
        </div>
        <div class="flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-4">
          ${justEliminated.map((p, i) => {
            const info = ROLE_INFO[p.role];
            const note = noteFor(p);
            return html`
              <div key=${p.id} class="panel p-4 flex items-center gap-4 anim-rise" style=${{ '--i': i * 3, boxShadow: `inset 0 0 0 3px ${info.color}, 0 5px 0 rgba(5,12,30,.6)` }}>
                <div class="w-24 flex-shrink-0 grid place-items-center">
                  ${p.role === ROLES.CIV
                    ? html`<img src=${SAD_GOBLIN_GIF} alt="Sad goblin" class="w-24 h-auto rounded-xl" onError=${(e) => { e.currentTarget.onerror = null; e.currentTarget.src = getCardUrl(p.word); }} />`
                    : html`<${RoleArt} role=${p.role} className="w-20" />`}
                </div>
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <img src=${BADGE_BASE_URL + p.avatar} alt="" class="w-7 h-7 object-contain" />
                    <div class="display stroke text-2xl truncate">${p.name}</div>
                  </div>
                  <div class="body-font text-sm text-muted mt-1">was the</div>
                  <div class="display stroke text-2xl" style=${{ color: info.color }}>${info.name.toUpperCase()}</div>
                  ${note && html`<div class="body-font text-xs text-muted mt-1">${note}</div>`}
                </div>
              </div>`;
          })}
          <p class="body-font text-center text-sm text-muted pt-2">${aliveCount} players still standing. The battle goes on.</p>
        </div>
        <div class="flex-shrink-0 pt-3">
          <button class="btn btn-gold btn-xl w-full" onClick=${nextRound}>Round ${round + 1} <${Icon} name="arrow-right" /></button>
        </div>
      <//>`;
  }

  // ---------- ROYALE RUSH ----------
  else if (gameState === 'rush') {
    screen = html`<${RushScreen} best=${rushStats.best} hold=${showQuit}
      onExit=${() => setGameState('setup')} onQuit=${() => setShowQuit(true)}
      onResult=${(r) => setRushStats(st => ({ best: Math.max(st.best, r.score), runs: st.runs + 1, elixir: st.elixir + r.elixir }))} />`;
  }

  // ---------- STAT GUESS GAME ----------
  else if (gameState === 'stat_game') {
    const triesLeft = MAX_GUESSES - statGuesses.length;
    const finished = statGuesses.some(g => g.isWin) || triesLeft <= 0;
    const renderTile = ([key, label], g, idx) => {
      const f = g.feedback[key];
      const cls = f.status === 'correct' ? 's-correct' : f.status === 'warm' ? 's-warm' : 's-cold';
      return html`
        <div key=${key} class=${`stile ${cls} anim-tile`} style=${{ '--i': idx }}>
          <span class="lbl">${label}</span>
          <span class="val display stroke-sm">${key === 'hit_speed' && parseFloat(f.value) === 0 ? 'N/A' : String(f.value ?? '-')}</span>
          ${f.dir && html`<span class="dir display stroke-sm" aria-label=${f.dir === 'up' ? 'higher' : 'lower'}><${Icon} name=${f.dir === 'up' ? 'arrow-fat-up' : 'arrow-fat-down'} fill /></span>`}
        </div>`;
    };

    screen = html`
      <${Screen}>
        <${TopBar} left=${quitButton} title="STAT GUESS" />
        <div class="flex items-center justify-center gap-1.5 mb-3 flex-shrink-0" aria-label=${`${triesLeft} tries left`}>
          ${Array.from({ length: MAX_GUESSES }).map((_, i) => html`
            <span key=${i} class="w-5 h-5 rounded-full border-2 border-[var(--ink)]"
              style=${{ background: i < statGuesses.length ? 'var(--well)' : triesLeft <= 3 ? 'var(--red-2)' : 'var(--elixir-2)', boxShadow: i < statGuesses.length ? 'inset 0 2px 0 rgba(0,0,0,.4)' : 'inset 0 2px 0 rgba(255,255,255,.4)' }}></span>`)}
        </div>

        <div class="flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-3 pb-2">
          ${statGuesses.length === 0 && html`
            <div class="panel p-5 text-center anim-pop">
              <img src=${ARENA_BASE_URL + 'arena20.webp'} alt="" class="w-28 mx-auto anim-bob" />
              <div class="display stroke text-xl mt-2">A card is hiding</div>
              <p class="body-font text-sm text-muted mt-1">Type any card below. Each guess shows how close its stats are to the hidden one.</p>
            </div>`}
          ${statGuesses.map((g, gi) => html`
            <div key=${g.cardName} class=${`panel p-2.5 ${gi === 0 ? 'anim-pop' : ''}`} style=${g.isWin ? { boxShadow: 'inset 0 0 0 3px var(--green-1), 0 5px 0 rgba(5,12,30,.6)' } : undefined}>
              <div class="flex items-center gap-2 mb-2">
                <img src=${getCardUrl(g.cardName)} onError=${onImgError} alt="" class="w-8 h-auto" />
                <div class="display stroke text-lg truncate flex-1">${g.cardName}</div>
                <span class="body-font text-xs text-muted">#${statGuesses.length - gi}</span>
              </div>
              <div class="grid grid-cols-4 gap-1.5 mb-1.5">${STAT_ROW_1.map((s, i) => renderTile(s, g, gi === 0 ? i : 0))}</div>
              <div class="grid grid-cols-3 gap-1.5">${STAT_ROW_2.map((s, i) => renderTile(s, g, gi === 0 ? i + 4 : 0))}</div>
            </div>`)}
        </div>

        <div class="flex-shrink-0 pt-2 relative">
          ${suggestOpen && suggestions.length > 0 && html`
            <ul class="panel absolute bottom-full left-0 right-0 mb-2 p-1.5 space-y-1 z-20 anim-pop" role="listbox">
              ${suggestions.map(c => html`
                <li key=${c.name}>
                  <button class="w-full flex items-center gap-3 p-1.5 rounded-xl active:bg-white/10 hover:bg-white/10 text-left" role="option"
                    onMouseDown=${e => e.preventDefault()} onClick=${() => submitStatGuess(c.name)}>
                    <img src=${getCardUrl(c.name)} onError=${onImgError} alt="" class="w-8 h-auto" />
                    <span class="display stroke-sm">${c.name}</span>
                    <span class="ml-auto body-font text-xs text-muted">${c.rarity}</span>
                  </button>
                </li>`)}
            </ul>`}
          ${statError && html`<p class="body-font text-sm mb-2 anim-shake" style=${{ color: 'var(--red-1)' }} role="alert">${statError}</p>`}
          <div class="grid grid-cols-[1fr_auto] gap-2">
            <div class="relative">
              <${Icon} name="magnifying-glass" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-lg" />
              <input type="text" value=${statGuessInput} disabled=${finished}
                onInput=${(e) => { setStatGuessInput(e.target.value); setStatError(''); setSuggestOpen(true); }}
                onFocus=${() => setSuggestOpen(true)} onBlur=${() => setTimeout(() => setSuggestOpen(false), 120)}
                onKeyDown=${(e) => { if (e.key === 'Enter') submitStatGuess(); }}
                placeholder="Search a card" aria-label="Card name" autocomplete="off"
                class="field !pl-10 h-[64px]" />
            </div>
            <button class="btn btn-gold btn-xl" onClick=${() => submitStatGuess()} disabled=${!statGuessInput.trim() || finished}>Guess</button>
          </div>
        </div>
      <//>`;
  }

  // ---------- GAME OVER ----------
  else if (gameState === 'over' && gameMode === MODES.STAT) {
    const won = winner.team === 'GUESSERS';
    screen = html`
      <${Screen}>
        <div class="flex-1 min-h-0 flex flex-col items-center justify-center text-center">
          <span class="ribbon display stroke text-3xl anim-banner" style=${won ? undefined : { background: 'linear-gradient(180deg,var(--red-1),var(--red-2))', boxShadow: 'inset 0 -3px 0 var(--red-lip), 0 3px 0 var(--ink)' }}>${won ? 'VICTORY' : 'DEFEAT'}</span>
          <p class="body-font text-muted mt-3">${winner.reason}</p>
          <div class="relative mt-6 anim-pop">
            <div class="absolute inset-0 blur-2xl rounded-full" style=${{ background: won ? 'rgba(143,227,86,.35)' : 'rgba(255,122,107,.3)' }}></div>
            <img src=${getCardUrl(statGuessTarget.name)} onError=${onImgError} alt=${statGuessTarget.name} class="relative w-44 h-auto drop-shadow-[0_10px_0_rgba(0,0,0,.35)]" />
          </div>
          <div class="display stroke text-3xl mt-4 text-gold">${statGuessTarget.name}</div>
          <div class="flex flex-wrap justify-center gap-1.5 mt-3">
            <span class="chip display">${statGuessTarget.elixir} Elixir</span>
            <span class="chip display">${statGuessTarget.rarity}</span>
            <span class="chip display">${statGuessTarget.type}</span>
          </div>
          <div class="flex flex-wrap justify-center gap-1.5 mt-4">
            <span class="chip display"><${Icon} name="fire" fill className="text-gold" /> Streak ${statStats.streak}</span>
            <span class="chip display">Best ${statStats.best}</span>
            <span class="chip display">Won ${statStats.wins}/${statStats.played}</span>
          </div>
        </div>
        <div class="flex-shrink-0 grid grid-cols-[auto_auto_1fr] gap-3 pt-3">
          <button class="btn btn-icon !min-h-[64px] !w-[64px]" onClick=${() => setGameState('setup')} aria-label="Menu"><${Icon} name="house" fill /></button>
          <button class="btn btn-purple btn-icon !min-h-[64px] !w-[64px]" onClick=${shareStatResult} aria-label="Share result"><${Icon} name="share-network" fill /></button>
          <button class="btn btn-green !min-h-[64px]" onClick=${startStatGame}><${Icon} name="arrow-clockwise" /> Play again</button>
        </div>
      <//>`;
  }

  else if (gameState === 'over') {
    const teamColor = { CIVILIANS: 'var(--civ)', IMPOSTORS: 'var(--und)', JESTER: 'var(--jes)', 'MR. WHITE': 'var(--wht)', 'NO ONE': 'var(--slate-1)' }[winner.team] || '#fff';
    const winArena = winner.team === 'CIVILIANS' ? 'arena23.webp' : winner.team === 'IMPOSTORS' || winner.team === 'MR. WHITE' ? 'arena22.webp' : 'arena15.webp';
    const winnerIds = new Set(winnersOf(winner.team, players, justEliminated).map(p => p.id));
    const sorted = [...players].sort((a, b) => winnerIds.has(b.id) - winnerIds.has(a.id));
    const board = players.map(p => ({ name: p.name, pts: scores[p.name] || 0, won: winnerIds.has(p.id) })).sort((a, b) => b.pts - a.pts);

    screen = html`
      <${Screen}>
        <div class="flex-1 min-h-0 overflow-y-auto no-scrollbar">
          <div class="text-center pt-2">
            <img src=${ARENA_BASE_URL + winArena} alt="" class="w-28 mx-auto anim-banner drop-shadow-[0_8px_10px_rgba(0,0,0,.4)]" />
            <h1 class="display stroke text-4xl mt-1 anim-banner" style=${{ color: teamColor }}>${winner.team === 'NO ONE' ? 'DRAW' : `${winner.team} WIN`}</h1>
            <p class="body-font text-muted text-sm mt-1">${winner.reason}</p>
          </div>

          <div class="grid grid-cols-2 gap-3 mt-4">
            ${[['Civilian card', currentWords.civilian, 'var(--civ)'], ['Undercover card', currentWords.undercover, 'var(--und)']].map(([label, w, c], i) => html`
              <div key=${label} class="panel p-3 flex flex-col items-center text-center anim-rise" style=${{ '--i': i + 2 }}>
                <div class="body-font text-[11px] uppercase tracking-wider" style=${{ color: c }}>${label}</div>
                <img src=${getCardUrl(w)} onError=${onImgError} alt="" class="w-20 h-auto my-2" />
                <div class="display stroke text-base leading-tight">${w}</div>
              </div>`)}
          </div>

          <div class="panel p-2 mt-4 space-y-1.5">
            ${sorted.map((p, i) => html`
              <div key=${p.id} class="well flex items-center gap-2 p-2 anim-rise" style=${{ '--i': i + 4 }}>
                <img src=${BADGE_BASE_URL + p.avatar} alt="" class=${`w-9 h-9 object-contain flex-shrink-0 ${p.isAlive ? '' : 'grayscale opacity-60'}`} />
                <div class="min-w-0 flex-1">
                  <div class=${`display stroke-sm truncate ${p.isAlive ? '' : 'opacity-60'}`}>${p.name}</div>
                  ${!SPECIAL_ROLES.includes(p.role) && html`<div class="body-font text-[11px] text-muted truncate">${p.word}</div>`}
                </div>
                ${winnerIds.has(p.id) && html`<${Icon} name="crown-simple" fill className="text-gold text-lg" />`}
                ${!p.isAlive && html`<${Icon} name="skull" fill className="text-white/50" />`}
                <${RolePill} role=${p.role} />
              </div>`)}
          </div>

          <div class="panel p-3 mt-4 mb-2">
            <div class="display stroke text-lg flex items-center gap-2 mb-2"><${Icon} name="trophy" fill className="text-gold" /> SCOREBOARD</div>
            <div class="flex flex-wrap gap-1.5">
              ${board.map((b, i) => html`
                <span key=${b.name} class="chip display">${i === 0 && b.pts > 0 && html`<${Icon} name="crown-simple" fill className="text-gold" />`}${b.name} <span class="text-gold">${b.pts}</span>${b.won && html`<span class="text-[10px]" style=${{ color: 'var(--green-1)' }}>+1</span>`}</span>`)}
            </div>
          </div>
        </div>
        <div class="flex-shrink-0 grid grid-cols-[auto_1fr] gap-3 pt-3">
          <button class="btn btn-icon !min-h-[64px] !w-[64px]" onClick=${() => setGameState('setup')} aria-label="Menu"><${Icon} name="house" fill /></button>
          <button class=${`btn btn-xl ${MODE_INFO[gameMode].btn}`} onClick=${startGame}><${Icon} name="arrow-clockwise" /> Rematch</button>
        </div>
      <//>`;
  }

  return html`${screen}${overlays}`;
};

render(html`<${App} />`, document.getElementById('root'));

// Offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

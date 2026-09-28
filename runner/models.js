// Royale Rush model slots.
//
// To use your own model, put a .glb file in runner/models/ with the same file name
// as the slot you want to replace (for example runner.glb). The game scales every
// model to the height below, stands it on the ground and centers it, so any size works.
//
//   file       File name inside runner/models/.
//   height     Height in meters after scaling (a lane is 1.8 m wide).
//   maxWidth   Optional. Also shrink the model so it is never wider than this.
//   rotationY  Degrees to turn the model. Characters should face the camera at 0;
//              the runner and chaser are turned 180 so they run away from it.
//   anims      Animation names to try, in order. The first exact match wins, then
//              the first clip whose name contains one of these words.
//
// Stand-in models are CC0 (free to use) from KayKit by Kay Lousberg:
// https://kaylousberg.com  (Adventurers, Skeletons, Dungeon and Medieval Hexagon packs)
// Tip: tools/prune_glb.py strips unused animations and meshes to shrink a model.

export const MODEL_DIR = './runner/models/';

export const MODELS = {
  runner: {
    file: 'runner.glb', height: 1.7, rotationY: 180,
    anims: {
      run: ['Running_A', 'run'],
      jump: ['Jump_Full_Short', 'jump'],
      slide: ['Dodge_Forward', 'slide', 'roll', 'dodge'],
      hit: ['Hit_A', 'hit', 'stumble'],
      death: ['Death_A', 'death', 'die'],
      idle: ['Idle', 'idle'],
      cheer: ['Cheer', 'cheer', 'victory'],
    },
  },
  chaser: {
    file: 'chaser.glb', height: 1.8, rotationY: 180,
    anims: { run: ['Running_A', 'run'], cheer: ['Cheer', 'cheer', 'taunt'], idle: ['Idle', 'idle'] },
  },
  skeleton: {
    file: 'skeleton.glb', height: 1.15, rotationY: 0,
    anims: { idle: ['Idle_Combat', 'idle'], taunt: ['Taunt', 'taunt'] },
  },
  barrel: { file: 'barrel.glb', height: 0.95, maxWidth: 1.1 },
  crates: { file: 'crates.glb', height: 2.6, maxWidth: 1.6 },
  towerBlue: { file: 'tower_blue.glb', height: 5.5, maxWidth: 4 },
  towerRed: { file: 'tower_red.glb', height: 5.5, maxWidth: 4 },
  tree: { file: 'tree.glb', height: 3, maxWidth: 2.5 },
};

// Power-ups use Clash card art from assets/cards/.
export const POWERUPS = {
  rage: { card: 'rage', name: 'Rage', duration: 10, color: 0xc13cff, blurb: 'Double score and elixir' },
  magnet: { card: 'tornado', name: 'Tornado', duration: 10, color: 0x6fd0ff, blurb: 'Pulls elixir to you' },
  shield: { card: 'guards', name: 'Guards', duration: 15, color: 0xffd23f, blurb: 'Survive one crash' },
};

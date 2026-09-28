# Royale Rush models

Drop a `.glb` file here with the same name to replace a stand-in model:

| File | What it is | Needs animations |
| --- | --- | --- |
| `runner.glb` | The character you play | run, jump, slide, hit, death, idle (cheer optional) |
| `chaser.glb` | Who chases you after a stumble | run, cheer |
| `skeleton.glb` | One member of the Skeleton Army obstacle (3 are spawned) | idle (taunt optional) |
| `barrel.glb` | Low obstacle, jump over it | none |
| `crates.glb` | Tall obstacle, change lanes | none |
| `tower_blue.glb`, `tower_red.glb` | Towers along the path | none |
| `tree.glb` | Scenery | none |

Models are scaled, grounded and centered automatically. If a model faces the wrong way or its
animations have different names, edit `runner/models.js` (`rotationY` and `anims`).

To shrink a big model (drop unused animations and meshes, downscale textures):

```
python tools/prune_glb.py big.glb runner/models/runner.glb --keep-anims Run,Jump,Slide,Hit,Death,Idle --max-texture 512
```

## Credits

The stand-in models are by Kay Lousberg (KayKit: Adventurers, Skeletons, Dungeon Remastered and
Medieval Hexagon packs), released under CC0 1.0: https://kaylousberg.com

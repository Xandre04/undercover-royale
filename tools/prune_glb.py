"""Slim a glTF/GLB model for Royale Rush.

Keeps only the animations and meshes you name, drops everything else, and packs the
result (including external .bin files and textures) into one .glb file.

Usage:
  python tools/prune_glb.py IN.glb OUT.glb [--keep-anims Run,Jump,...] [--drop-meshes Shield,Axe,...]
                                           [--max-texture 512]

  --keep-anims   Animation names to keep (exact names). Omit to keep all.
  --drop-meshes  Node names whose mesh should be removed (e.g. extra weapons).
  --max-texture  Downscale embedded PNG/JPEG textures larger than this (needs Pillow).

Only needs Python 3 (Pillow is optional, for --max-texture).
"""
import argparse
import io
import json
import os
import struct


def load(path):
    base = os.path.dirname(os.path.abspath(path))
    data = open(path, 'rb').read()
    if data[:4] == b'glTF':
        json_len = struct.unpack('<I', data[12:16])[0]
        gltf = json.loads(data[20:20 + json_len])
        rest = data[20 + json_len:]
        binary = rest[8:8 + struct.unpack('<I', rest[:4])[0]] if len(rest) >= 8 else b''
        buffers = [binary]
        for b in gltf.get('buffers', [])[1:]:
            buffers.append(open(os.path.join(base, b['uri']), 'rb').read())
    else:
        gltf = json.loads(data)
        buffers = [open(os.path.join(base, b['uri']), 'rb').read() for b in gltf.get('buffers', [])]
    return gltf, buffers, base


def view_bytes(gltf, buffers, index):
    v = gltf['bufferViews'][index]
    start = v.get('byteOffset', 0)
    return buffers[v['buffer']][start:start + v['byteLength']]


def shrink_image(raw, mime, max_size):
    try:
        from PIL import Image
    except ImportError:
        return raw, mime
    img = Image.open(io.BytesIO(raw))
    if max(img.size) <= max_size:
        return raw, mime
    img.thumbnail((max_size, max_size), Image.LANCZOS)
    out = io.BytesIO()
    img.save(out, 'PNG', optimize=True)
    return out.getvalue(), 'image/png'


def prune(gltf, buffers, base, keep_anims, drop_meshes, max_texture):
    if keep_anims is not None:
        gltf['animations'] = [a for a in gltf.get('animations', []) if a.get('name') in keep_anims]
        missing = keep_anims - {a.get('name') for a in gltf['animations']}
        if missing:
            print('warning: animations not found:', ', '.join(sorted(missing)))
    for node in gltf.get('nodes', []):
        if node.get('name') in drop_meshes:
            node.pop('mesh', None)
            node.pop('skin', None)

    # Meshes still referenced by nodes
    mesh_map = {}
    new_meshes = []
    for node in gltf.get('nodes', []):
        if 'mesh' in node:
            old = node['mesh']
            if old not in mesh_map:
                mesh_map[old] = len(new_meshes)
                new_meshes.append(gltf['meshes'][old])
            node['mesh'] = mesh_map[old]
    gltf['meshes'] = new_meshes

    # Accessors still in use
    used_acc = set()
    for mesh in gltf['meshes']:
        for prim in mesh['primitives']:
            used_acc.update(prim['attributes'].values())
            if 'indices' in prim:
                used_acc.add(prim['indices'])
            for target in prim.get('targets', []):
                used_acc.update(target.values())
    for skin in gltf.get('skins', []):
        if 'inverseBindMatrices' in skin:
            used_acc.add(skin['inverseBindMatrices'])
    for anim in gltf.get('animations', []):
        for s in anim['samplers']:
            used_acc.update((s['input'], s['output']))

    acc_map = {old: new for new, old in enumerate(sorted(used_acc))}
    accessors = [gltf['accessors'][old] for old in sorted(used_acc)]
    for acc in accessors:
        if 'sparse' in acc:
            raise SystemExit('sparse accessors are not supported')

    # Rebuild one binary buffer with only the data still in use
    blob = bytearray()
    new_views = []
    view_map = {}

    def add_view(raw, template=None):
        while len(blob) % 4:
            blob.append(0)
        view = {'buffer': 0, 'byteOffset': len(blob), 'byteLength': len(raw)}
        if template:
            for key in ('byteStride', 'target'):
                if key in template:
                    view[key] = template[key]
        blob.extend(raw)
        new_views.append(view)
        return len(new_views) - 1

    for acc in accessors:
        if 'bufferView' in acc:
            old = acc['bufferView']
            if old not in view_map:
                view_map[old] = add_view(view_bytes(gltf, buffers, old), gltf['bufferViews'][old])
            acc['bufferView'] = view_map[old]

    for img in gltf.get('images', []):
        if 'bufferView' in img:
            raw, mime = view_bytes(gltf, buffers, img['bufferView']), img.get('mimeType', 'image/png')
        else:
            uri = img.pop('uri')
            raw = open(os.path.join(base, uri), 'rb').read()
            mime = 'image/jpeg' if uri.lower().endswith(('.jpg', '.jpeg')) else 'image/png'
        if max_texture:
            raw, mime = shrink_image(raw, mime, max_texture)
        img['bufferView'] = add_view(raw)
        img['mimeType'] = mime

    # Remap accessor indices everywhere
    for mesh in gltf['meshes']:
        for prim in mesh['primitives']:
            prim['attributes'] = {k: acc_map[v] for k, v in prim['attributes'].items()}
            if 'indices' in prim:
                prim['indices'] = acc_map[prim['indices']]
            if 'targets' in prim:
                prim['targets'] = [{k: acc_map[v] for k, v in t.items()} for t in prim['targets']]
    for skin in gltf.get('skins', []):
        if 'inverseBindMatrices' in skin:
            skin['inverseBindMatrices'] = acc_map[skin['inverseBindMatrices']]
    for anim in gltf.get('animations', []):
        for s in anim['samplers']:
            s['input'], s['output'] = acc_map[s['input']], acc_map[s['output']]

    gltf['accessors'] = accessors
    gltf['bufferViews'] = new_views
    gltf['buffers'] = [{'byteLength': len(blob)}]
    return gltf, bytes(blob)


def write_glb(path, gltf, blob):
    js = json.dumps(gltf, separators=(',', ':')).encode()
    js += b' ' * (-len(js) % 4)
    blob += b'\0' * (-len(blob) % 4)
    total = 12 + 8 + len(js) + 8 + len(blob)
    with open(path, 'wb') as f:
        f.write(struct.pack('<4sII', b'glTF', 2, total))
        f.write(struct.pack('<I4s', len(js), b'JSON') + js)
        f.write(struct.pack('<I4s', len(blob), b'BIN\0') + blob)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('input')
    ap.add_argument('output')
    ap.add_argument('--keep-anims')
    ap.add_argument('--drop-meshes', default='')
    ap.add_argument('--max-texture', type=int, default=0)
    args = ap.parse_args()
    keep = set(args.keep_anims.split(',')) if args.keep_anims else None
    drop = set(filter(None, args.drop_meshes.split(',')))
    gltf, buffers, base = load(args.input)
    gltf, blob = prune(gltf, buffers, base, keep, drop, args.max_texture)
    write_glb(args.output, gltf, blob)
    print(f'{args.output}: {os.path.getsize(args.output) // 1024} KB, '
          f'{len(gltf.get("animations", []))} animations')


if __name__ == '__main__':
    main()

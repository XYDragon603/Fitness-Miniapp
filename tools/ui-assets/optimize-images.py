"""主包图片瘦身：按显示尺寸压缩，删除没被引用的图标和旧 tab 图标。

用法：python tools/ui-assets/optimize-images.py [--dry-run]
原图在 git 历史和 tools/ui-assets/equipment-meal/sources 里，需要时可重新导出。
"""
import os
import re
import sys

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
DRY = '--dry-run' in sys.argv
CODE_DIRS = ['pages', 'packageExercise', 'components', 'custom-tab-bar', 'utils']
CODE_FILES = ['app.js', 'app.json', 'app.wxss']

# 动态拼接的图标路径（wxml 里的 {{}}），展开成具体文件名
DYNAMIC_ICONS = [
    'chevron-left-white', 'chevron-left-ink', 'moon-white', 'moon-ink', 'dumbbell-lime',
    # 减脂习惯：{{item.icon}}-ink
    'dumbbell-ink', 'fork-ink', 'plate-ink', 'veg-ink', 'drop-ink', 'sofa-ink'
]


def read_code():
    texts = []
    for name in CODE_FILES:
        texts.append(open(os.path.join(ROOT, name), encoding='utf8').read())
    for folder in CODE_DIRS:
        for base, _, files in os.walk(os.path.join(ROOT, folder)):
            for file in files:
                if file.endswith(('.js', '.wxml', '.wxss', '.json')):
                    texts.append(open(os.path.join(base, file), encoding='utf8').read())
    return '\n'.join(texts)


def size_kb(path):
    return os.path.getsize(path) / 1024


def save_jpg(path, max_side, quality):
    image = Image.open(path).convert('RGB')
    image.thumbnail((max_side, max_side), Image.LANCZOS)
    if not DRY:
        image.save(path, quality=quality, optimize=True, progressive=True)


def save_png(path, max_w, max_h, colors):
    image = Image.open(path).convert('RGBA')
    image.thumbnail((max_w, max_h), Image.LANCZOS)
    # 带透明度的调色板量化：体积通常降到原来的 1/3 以下
    quantized = image.quantize(colors=colors, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    if not DRY:
        quantized.save(path, optimize=True)


def main():
    before = {}
    images = os.path.join(ROOT, 'images')
    for base, _, files in os.walk(images):
        for file in files:
            before[os.path.join(base, file)] = size_kb(os.path.join(base, file))

    code = read_code()
    referenced = set(re.findall(r'/images/icons/([A-Za-z0-9-]+)\.svg', code)) | set(DYNAMIC_ICONS)
    removed = []
    icon_dir = os.path.join(images, 'icons')
    for file in sorted(os.listdir(icon_dir)):
        name = file[:-4]
        if file.endswith('.svg') and name not in referenced:
            removed.append(os.path.join(icon_dir, file))

    # 旧版 tab 图标（已换成 tab-*.png）
    for old in ['food', 'food-active', 'history', 'history-active', 'plan', 'plan-active', 'record', 'record-active', 'stats', 'stats-active']:
        path = os.path.join(images, f'{old}.png')
        if os.path.exists(path) and f'/images/{old}.png' not in code:
            removed.append(path)

    for path in removed:
        if not DRY:
            os.remove(path)

    # 餐食图：列表最大约 200rpx 宽（3 倍屏约 300px）
    for file in os.listdir(os.path.join(images, 'meal')):
        save_jpg(os.path.join(images, 'meal', file), 360, 80)
    # 器械图：最大显示约 300rpx 宽（3 倍屏约 450px）
    for file in os.listdir(os.path.join(images, 'equipment')):
        save_png(os.path.join(images, 'equipment', file), 480, 360, 96)
    # 动作库首页的肌肉图：显示 220×400rpx
    for file in os.listdir(os.path.join(images, 'muscles', 'dark')):
        save_png(os.path.join(images, 'muscles', 'dark', file), 240, 480, 48)

    after = 0
    for base, _, files in os.walk(images):
        for file in files:
            after += size_kb(os.path.join(base, file))
    print(f"removed {len(removed)} unused files; images {sum(before.values()):.0f} KB -> {after:.0f} KB{' (dry run)' if DRY else ''}")


if __name__ == '__main__':
    main()

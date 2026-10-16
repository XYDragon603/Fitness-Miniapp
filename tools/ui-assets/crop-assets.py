"""从 UI 效果图裁出器械插画和餐食图，输出到 images/。

用法：python tools/ui-assets/crop-assets.py
效果图位于 docs/codex-tasks/ui-design-proposal/。后续拿到高清素材时直接替换 images/ 下同名文件即可。
"""
import os

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
DESIGN = os.path.join(ROOT, 'docs', 'codex-tasks', 'ui-design-proposal')
OUT_EQUIP = os.path.join(ROOT, 'images', 'equipment')
OUT_MEAL = os.path.join(ROOT, 'images', 'meal')

A = Image.open(os.path.join(DESIGN, 'v1-today-workout-plan.png')).convert('RGB')
B = Image.open(os.path.join(DESIGN, 'v1-library-diet-me.png')).convert('RGB')

# (名称, 源图, 裁剪框, 背景类型)
# bench / incline / rack / dumbbell / dumbbell-rack 和全部餐食图已换成 tools/ui-assets/equipment-meal 产出的成品，
# 这里只剩还没替换的两张，避免重跑时覆盖。
EQUIPMENT = [
    ('barbell', B, (66, 860, 142, 912), 'light'),
    ('pulldown', B, (74, 918, 134, 973), 'light'),
]

MEALS = []  # 餐食图已替换


def matte(img, scale):
    """按与背景色（取四边中位数）的距离抠图，保留原色。先放大再抠，边缘收缩 1px 去掉背景色描边，
    这样同一张图放在浅色和深色底上都不会有光晕。"""
    big = img.resize((img.width * scale, img.height * scale), Image.LANCZOS)
    arr = np.asarray(big).astype(np.float64)
    border = np.concatenate([arr[0], arr[-1], arr[:, 0], arr[:, -1]])
    bg = np.median(border, axis=0)
    dist = np.sqrt(((arr - bg) ** 2).sum(axis=2))

    low, high = 22.0, 48.0
    alpha = np.clip((dist - low) / (high - low), 0, 1) * 255
    mask = Image.fromarray(alpha.astype(np.uint8), 'L')
    mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))

    out = big.convert('RGBA')
    out.putalpha(mask)
    return out


def trim(img, pad=4):
    box = img.getchannel('A').point(lambda a: 255 if a > 10 else 0).getbbox()
    if not box:
        return img
    left, top, right, bottom = box
    return img.crop((max(left - pad, 0), max(top - pad, 0), min(right + pad, img.width), min(bottom + pad, img.height)))


def upscale(img, target_width):
    scale = target_width / img.width
    big = img.resize((target_width, round(img.height * scale)), Image.LANCZOS)
    return big.filter(ImageFilter.UnsharpMask(radius=1.2, percent=60, threshold=2))


def main():
    os.makedirs(OUT_EQUIP, exist_ok=True)
    os.makedirs(OUT_MEAL, exist_ok=True)

    for name, source, box, _ in EQUIPMENT:
        cut = trim(matte(source.crop(box), 2 if name == 'bench' else 4))
        cut = upscale(cut, 480 if name == 'bench' else 240)
        cut.save(os.path.join(OUT_EQUIP, name + '.png'), optimize=True)
        print('equipment', name, cut.size)

    for name, source, box in MEALS:
        photo = upscale(source.crop(box), 240).convert('RGB')
        photo.save(os.path.join(OUT_MEAL, name + '.jpg'), quality=86, optimize=True)
        print('meal', name, photo.size)


if __name__ == '__main__':
    main()

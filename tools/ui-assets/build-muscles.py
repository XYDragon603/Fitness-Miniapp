"""Export aligned anatomy assets from one ImageGen segmentation atlas.

Requires Pillow, NumPy and SciPy. Run from any directory with Python.
The atlas and reusable bases/masks stay in tools; app-ready PNGs go to images.
"""
from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
WORK = Path(__file__).resolve().parent / "muscles"
SOURCE = WORK / "anatomy-atlas.png"
OUT = ROOT / "images" / "muscles"
SIZE = (400, 800)
GREEN = np.array([200, 247, 110], dtype=np.float32)
PALETTE = {
    "red": (230, 75, 93), "blue": (64, 136, 232),
    "orange": (244, 163, 64), "cyan": (64, 197, 204),
    "yellow": (231, 211, 75), "purple": (154, 98, 222),
    "magenta": (216, 92, 187),
}
REGIONS = {
    "front": {
        "chest": ("red", .16, .34),
        "shoulders": ("blue", .16, .32),
        "biceps": ("orange", .24, .40),
        "forearms": ("cyan", .33, .54),
        "abs": ("yellow", .27, .49),
        "quads": ("purple", .44, .70),
        "front-calves": ("magenta", .66, .91),
    },
    "back": {
        "lats": ("blue", .23, .45),
        "traps": ("yellow", .08, .36),
        "lowerback": ("orange", .29, .49),
        "triceps": ("red", .23, .42),
        "glutes": ("purple", .39, .58),
        "hamstrings": ("cyan", .49, .73),
        "calves": ("magenta", .65, .91),
    },
}
TARGETS = {
    "chest": ("front", ["chest"]),
    "shoulders": ("front", ["shoulders"]),
    "biceps": ("front", ["biceps"]),
    "arms": ("front", ["biceps", "forearms"]),
    "forearms": ("front", ["forearms"]),
    "abs": ("front", ["abs"]),
    "quads": ("front", ["quads"]),
    "legs": ("front", ["quads", "front-calves"]),
    "cardio": ("front", []),
    "back": ("back", ["lats", "traps"]),
    "traps": ("back", ["traps"]),
    "lowerback": ("back", ["lowerback"]),
    "triceps": ("back", ["triceps"]),
    "glutes": ("back", ["glutes"]),
    "hamstrings": ("back", ["hamstrings"]),
    "calves": ("back", ["calves"]),
}


def largest_silhouette(alpha):
    solid = ndimage.binary_opening(alpha >= 200, iterations=1)
    labels, count = ndimage.label(solid)
    if not count:
        raise ValueError("Source has no opaque anatomy silhouette")
    areas = np.bincount(labels.ravel())
    areas[0] = 0
    return labels == areas.argmax()


def clean_region(mask):
    mask = ndimage.binary_opening(mask, iterations=1)
    labels, count = ndimage.label(mask)
    sizes = np.bincount(labels.ravel())
    sizes[0] = 0
    return np.isin(labels, np.flatnonzero(sizes >= 70)) if count else mask


def rgba(rgb, alpha):
    arr = np.dstack([np.clip(np.rint(rgb), 0, 255).astype(np.uint8), alpha])
    arr[alpha == 0, :3] = 0
    return Image.fromarray(arr)


def save_indexed(image, destination, theme, cardio=False):
    """Use fixed anatomy colors and seven shared alpha levels for compact PNGs."""
    low, high = ((27, 34, 39), (88, 101, 112)) if theme == "dark" else ((125, 136, 144), (210, 219, 224))
    neutral = [np.array(low) + t * (np.array(high) - np.array(low)) for t in np.linspace(0, 1, 16)]
    blends = [neutral[10] * (1 - t) + GREEN * t for t in [.12, .28, .44, .6, .76, .9]]
    colors = np.clip(np.rint([shade * .75 + GREEN * .25 for shade in neutral]
                            if cardio else neutral + blends + [GREEN]), 0, 255).astype(np.uint8)
    palette = Image.new("P", (1, 1))
    palette.putpalette(colors.ravel().tolist() + GREEN.astype(int).tolist() * (256 - len(colors)))
    indices = np.asarray(image.convert("RGB").quantize(palette=palette, dither=Image.Dither.NONE)).copy()
    indices[indices >= len(colors)] = len(colors) - 1
    levels = np.rint(np.asarray(image)[..., 3].astype(np.float32) * 7 / 255).astype(np.uint8)
    result_indices = np.where(levels == 0, 0, 1 + indices.astype(np.uint16) * 7 + levels - 1).astype(np.uint8)
    result = Image.new("P", image.size)
    result.putdata(result_indices.ravel())
    rgb_palette, transparency = [0, 0, 0], [0]
    for color in colors:
        for alpha in [36, 73, 109, 146, 182, 219, 255]:
            rgb_palette.extend(color.tolist())
            transparency.append(alpha)
    rgb_palette.extend([0] * (768 - len(rgb_palette)))
    result.putpalette(rgb_palette)
    result.save(destination, transparency=bytes(transparency), optimize=True)


def run():
    atlas = Image.open(SOURCE).convert("RGBA")
    width, height = atlas.size
    sources = {}
    for view, box in [("front", (0, 0, width // 2, height)),
                      ("back", (width // 2, 0, width, height))]:
        image = atlas.crop(box)
        pixels = np.asarray(image)
        silhouette = largest_silhouette(pixels[..., 3])
        ys, xs = np.where(silhouette)
        sources[view] = {"image": image, "pixels": pixels, "solid": silhouette,
                         "top": int(ys.min()), "bottom": int(ys.max()),
                         "center": (int(xs.min()) + int(xs.max())) / 2,
                         "width": int(xs.max() - xs.min() + 1)}
    top = min(item["top"] for item in sources.values())
    bottom = max(item["bottom"] for item in sources.values())
    scale = min(744 / (bottom - top + 1),
                332 / max(item["width"] for item in sources.values()))
    color_keys = list(PALETTE)
    palette_hues = np.asarray(Image.fromarray(np.array(
        [[PALETTE[key] for key in color_keys]], dtype=np.uint8)).convert("HSV"))[0, :, 0]
    bases, masks = {}, {}
    for view, item in sources.items():
        affine = (1 / scale, 0, item["center"] - 200 / scale,
                  0, 1 / scale, top - 28 / scale)
        def fit(array):
            return np.asarray(Image.fromarray(array.astype(np.uint8)).transform(
                SIZE, Image.Transform.AFFINE, affine,
                resample=Image.Resampling.BICUBIC))
        alpha_steps = np.array([0, 36, 73, 109, 146, 182, 219, 255], dtype=np.uint8)
        coverage = alpha_steps[np.rint(fit(item["solid"] * 255).astype(np.float32) * 7 / 255).astype(np.uint8)]
        hsv = np.asarray(item["image"].convert("HSV"))
        hue = hsv[..., 0].astype(np.int16)
        distances = np.abs(hue[..., None] - palette_hues.astype(np.int16))
        nearest = np.minimum(distances, 256 - distances).argmin(axis=-1)
        saturated = (hsv[..., 1] > 65) & (hsv[..., 2] > 75) & item["solid"]
        yy = np.arange(item["image"].height)[:, None] / height
        masks[view] = {}
        for region, (color, y0, y1) in REGIONS[view].items():
            selected = saturated & (nearest == color_keys.index(color)) & (yy >= y0) & (yy <= y1)
            fitted = fit(clean_region(selected) * 255)
            masks[view][region] = np.minimum(fitted, coverage)
            if np.count_nonzero(fitted > 127) < 100:
                raise ValueError(f"Empty region: {view}/{region}")
        value = hsv[..., 2].astype(np.float32) / 255
        tone = np.where(hsv[..., 1] > 50, .85 + .15 * value, value * 1.34)
        tone = np.clip(tone, 0, 1)
        for theme, low, high in [
            ("dark", (27, 34, 39), (88, 101, 112)),
            ("light", (125, 136, 144), (210, 219, 224)),
        ]:
            colors = np.array(low) + tone[..., None] * (np.array(high) - np.array(low))
            colors = np.stack([fit(colors[..., c]) for c in range(3)], axis=-1)
            bases[view, theme] = rgba(colors, coverage)
            (WORK / "bases").mkdir(parents=True, exist_ok=True)
            bases[view, theme].save(WORK / "bases" / f"{view}-{theme}.png", optimize=True)

    (WORK / "masks").mkdir(parents=True, exist_ok=True)
    for name, (view, regions) in TARGETS.items():
        alpha = np.asarray(bases[view, "dark"])[..., 3]
        mask = (np.rint(alpha * .25).astype(np.uint8) if name == "cardio" else
                np.maximum.reduce([masks[view][region] for region in regions]))
        green = np.broadcast_to(GREEN, (SIZE[1], SIZE[0], 3))
        rgba(green, mask).save(WORK / "masks" / f"{name}.png", optimize=True)
        for theme in ["dark", "light"]:
            base = np.asarray(bases[view, theme]).astype(np.float32)
            # Mask is already constrained to the silhouette. Keep alpha exactly
            # identical across every target and both themes.
            factor = np.divide(mask, alpha, out=np.zeros_like(mask, dtype=np.float32),
                               where=alpha > 0)[..., None]
            result = rgba(base[..., :3] * (1 - factor) + GREEN * factor, alpha)
            (OUT / theme).mkdir(parents=True, exist_ok=True)
            save_indexed(result, OUT / theme / f"{name}.png", theme, name == "cardio")

    report = {"size": list(SIZE), "highlight": "#C8F76E", "targets": {}, "bytes": 0}
    for name, (view, _) in TARGETS.items():
        dark = np.asarray(Image.open(OUT / "dark" / f"{name}.png").convert("RGBA"))
        light = np.asarray(Image.open(OUT / "light" / f"{name}.png").convert("RGBA"))
        assert dark.shape == light.shape == (800, 400, 4)
        assert np.array_equal(dark[..., 3], light[..., 3])
        assert np.array_equal(dark[..., 3], np.asarray(bases[view, "dark"])[..., 3])
        assert dark[0, 0, 3] == 0 and dark[-1, -1, 3] == 0
        if name != "cardio":
            dark_green = np.all(dark[..., :3] == GREEN, axis=-1) & (dark[..., 3] > 0)
            light_green = np.all(light[..., :3] == GREEN, axis=-1) & (light[..., 3] > 0)
            interior = np.asarray(Image.open(WORK / "masks" / f"{name}.png"))[..., 3] == 255
            assert np.all(dark_green[interior]) and np.all(light_green[interior]) and interior.sum() > 100
        report["targets"][name] = {"view": view, "bbox": list(Image.open(OUT / "dark" / f"{name}.png").getbbox())}
        report["bytes"] += sum((OUT / theme / f"{name}.png").stat().st_size for theme in ["dark", "light"])
    (WORK / "validation.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    preview = Image.new("RGB", (1280, 1400), "#20292d")
    draw = ImageDraw.Draw(preview)
    font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 17)
    for index, name in enumerate(TARGETS):
        for theme_index, theme in enumerate(["dark", "light"]):
            x = (index % 4 * 2 + theme_index) * 160
            y = index // 4 * 350
            bg, fg = ("#0F1418", "#F4F5EF") if theme == "dark" else ("#FFFFFF", "#253139")
            draw.rectangle((x, y, x + 159, y + 349), fill=bg)
            draw.text((x + 10, y + 10), name, fill=fg, font=font)
            draw.text((x + 10, y + 31), theme, fill=fg, font=font)
            thumb = Image.open(OUT / theme / f"{name}.png").convert("RGBA").resize((145, 290), Image.Resampling.LANCZOS)
            preview.paste(thumb, (x + 7, y + 54), thumb)
    preview_path = ROOT / "docs" / "codex-tasks" / "ui-design-proposal" / "muscle-assets-preview.png"
    preview.save(preview_path, optimize=True)
    print(f"Exported {len(TARGETS) * 2} aligned transparent PNGs; {report['bytes'] / 1024:.1f} KB")


if __name__ == "__main__":
    run()

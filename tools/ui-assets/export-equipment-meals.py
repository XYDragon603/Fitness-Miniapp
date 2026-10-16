"""Export ImageGen originals into exact app asset sizes, preserving source alpha."""
from pathlib import Path
import json
import shutil
from PIL import Image, ImageOps, ImageDraw, ImageFont, ImageFilter, ImageChops

ROOT = Path(__file__).resolve().parents[2]
WORK = Path(__file__).resolve().parent / "equipment-meal"
EQUIPMENT = ["bench", "rack", "incline", "dumbbell", "dumbbell-rack"]
MEALS = ["breakfast", "lunch", "dinner", "snack"]


def archive(destination):
    previous = WORK / "previous" / destination.parent.name / destination.name
    if destination.exists() and not previous.exists():
        previous.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(destination, previous)


def run():
    report = {"equipment": {}, "meals": {}}
    for name in EQUIPMENT:
        original = Image.open(WORK / "sources" / f"{name}.png").convert("RGBA")
        assert original.getextrema()[3][0] == 0, f"Missing transparent background: {name}"
        # Normalize the generated alpha matte before downsampling. Preserve
        # object highlights while discarding bright matting pixels at its edge.
        red, green, blue, alpha = original.split()
        solid = alpha.point(lambda a: 255 if a >= 200 else 0)
        edge = ImageChops.subtract(solid, solid.filter(ImageFilter.MinFilter(7)))
        bright = ImageChops.darker(ImageChops.darker(red, green), blue).point(lambda v: 255 if v > 205 else 0)
        alpha = ImageChops.subtract(alpha, ImageChops.multiply(edge, bright)).filter(ImageFilter.MinFilter(3))
        original.putalpha(alpha)
        box = original.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
        cropped = original.crop(box)
        cropped.thumbnail((720, 520), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (800, 600))
        canvas.paste(cropped, ((800 - cropped.width) // 2, (600 - cropped.height) // 2))
        destination = ROOT / "images" / "equipment" / f"{name}.png"
        archive(destination)
        indexed = canvas.quantize(colors=256, method=Image.Quantize.FASTOCTREE,
                                  dither=Image.Dither.NONE)
        palette = indexed.getpalette("RGBA")
        for i in range(3, len(palette), 4):
            if palette[i] >= 250:
                palette[i] = 255
        indexed.putpalette(palette, rawmode="RGBA")
        indexed.save(destination, optimize=True)
        saved = Image.open(destination).convert("RGBA")
        assert saved.size == (800, 600) and saved.getextrema()[3] == (0, 255)
        report["equipment"][name] = {"size": list(saved.size), "bbox": list(saved.getbbox()),
                                      "bytes": destination.stat().st_size}
    for name in MEALS:
        original = Image.open(WORK / "sources" / f"{name}.png").convert("RGB")
        result = ImageOps.fit(original, (600, 600), method=Image.Resampling.LANCZOS)
        destination = ROOT / "images" / "meal" / f"{name}.jpg"
        archive(destination)
        result.save(destination, quality=85, subsampling=2, optimize=True, progressive=True)
        saved = Image.open(destination)
        assert saved.size == (600, 600) and saved.mode == "RGB" and saved.format == "JPEG"
        report["meals"][name] = {"size": list(saved.size), "bytes": destination.stat().st_size}

    preview = Image.new("RGB", (1200, 800), "#F6F4EE")
    draw = ImageDraw.Draw(preview)
    font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 17)
    for row, (background, foreground) in enumerate([("#12191C", "#F6F4EE"), ("#F6F4EE", "#12191C")]):
        y = row * 225
        draw.rectangle((0, y, 1200, y + 224), fill=background)
        for column, name in enumerate(EQUIPMENT):
            x = column * 240
            draw.text((x + 12, y + 10), name + ".png", fill=foreground, font=font)
            image = Image.open(ROOT / "images" / "equipment" / f"{name}.png").convert("RGBA")
            image.thumbnail((230, 173), Image.Resampling.LANCZOS)
            preview.paste(image, (x + (240 - image.width) // 2, y + 37), image)
    for index, name in enumerate(MEALS):
        x = index * 300
        draw.text((x + 12, 465), name + ".jpg", fill="#12191C", font=font)
        image = Image.open(ROOT / "images" / "meal" / f"{name}.jpg").resize((280, 280), Image.Resampling.LANCZOS)
        preview.paste(image, (x + 10, 500))
    preview_path = ROOT / "docs" / "codex-tasks" / "ui-design-proposal" / "equipment-meal-preview.jpg"
    preview.save(preview_path, quality=92, optimize=True)
    (WORK / "validation.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    for group, assets in report.items():
        print(group, len(assets), "files", round(sum(a["bytes"] for a in assets.values()) / 1024, 1), "KB")


if __name__ == "__main__":
    run()

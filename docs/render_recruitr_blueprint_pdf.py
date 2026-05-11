from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
SOURCE_PATH = ROOT / "recruitr_build_blueprint.md"
OUTPUT_PATH = ROOT / "recruitr_build_blueprint.pdf"

DPI = 150
PAGE_WIDTH = int(8.5 * DPI)
PAGE_HEIGHT = int(11 * DPI)
LEFT = 108
RIGHT = PAGE_WIDTH - 108
TOP = 150
BOTTOM = PAGE_HEIGHT - 108
MAX_TEXT_WIDTH = RIGHT - LEFT


FONT_CANDIDATES = {
    "regular": [
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Helvetica.ttc",
    ],
    "bold": [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/Library/Fonts/Arial Bold.ttf",
        "/System/Library/Fonts/Supplemental/Helvetica.ttc",
    ],
}


STYLES = {
    "title": {"font_size": 30, "color": "#0f172a", "space_after": 14},
    "h2": {"font_size": 21, "color": "#0b3b66", "space_before": 12, "space_after": 10},
    "h3": {"font_size": 16, "color": "#0f172a", "space_after": 8},
    "body": {"font_size": 13, "color": "#111827", "space_after": 8},
    "bullet": {"font_size": 13, "color": "#111827", "space_after": 7},
}


def load_font(kind: str, size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for candidate in FONT_CANDIDATES[kind]:
        path = Path(candidate)
        if path.exists():
            try:
                return ImageFont.truetype(str(path), size=size)
            except OSError:
                continue
    return ImageFont.load_default()


def parse_markdown(path: Path) -> list[list[tuple[str, str]]]:
    pages: list[list[tuple[str, str]]] = [[]]
    for raw in path.read_text().splitlines():
        line = raw.rstrip()
        if line == "<!-- pagebreak -->":
            if pages[-1]:
                pages.append([])
            continue
        if not line.strip():
            pages[-1].append(("blank", ""))
            continue
        if line.startswith("# "):
            pages[-1].append(("title", line[2:].strip()))
        elif line.startswith("## "):
            pages[-1].append(("h2", line[3:].strip()))
        elif line.startswith("### "):
            pages[-1].append(("h3", line[4:].strip()))
        elif line.startswith("- "):
            pages[-1].append(("bullet", line[2:].strip()))
        else:
            pages[-1].append(("body", line.strip()))
    return [page for page in pages if page]


def text_width(draw: ImageDraw.ImageDraw, text: str, font) -> int:
    box = draw.textbbox((0, 0), text, font=font)
    return box[2] - box[0]


def line_height(draw: ImageDraw.ImageDraw, font) -> int:
    box = draw.textbbox((0, 0), "Ag", font=font)
    return box[3] - box[1]


def wrap_text(draw: ImageDraw.ImageDraw, text: str, font, max_width: int) -> list[str]:
    words = text.split()
    if not words:
        return [""]

    lines: list[str] = []
    current = words[0]
    for word in words[1:]:
        trial = f"{current} {word}"
        if text_width(draw, trial, font) <= max_width:
            current = trial
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


def hex_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))


def draw_header(draw: ImageDraw.ImageDraw, page_num: int, total_pages: int) -> None:
    draw.rectangle([(0, 0), (PAGE_WIDTH, 64)], fill=hex_rgb("#0b2440"))
    header_font = load_font("bold", 15)
    small_font = load_font("regular", 12)
    draw.text((LEFT, 20), "Recruitr MVP Build Blueprint", fill="white", font=header_font)
    page_label = f"Page {page_num} of {total_pages}"
    label_width = text_width(draw, page_label, small_font)
    draw.text((RIGHT - label_width, 22), page_label, fill=hex_rgb("#dbeafe"), font=small_font)


def draw_footer(draw: ImageDraw.ImageDraw) -> None:
    footer_font = load_font("regular", 11)
    draw.text(
        (LEFT, PAGE_HEIGHT - 42),
        "Prepared for internal product, engineering, and launch planning.",
        fill=hex_rgb("#64748b"),
        font=footer_font,
    )


def render_page(page_items: list[tuple[str, str]], page_num: int, total_pages: int) -> Image.Image:
    image = Image.new("RGB", (PAGE_WIDTH, PAGE_HEIGHT), "white")
    draw = ImageDraw.Draw(image)
    draw_header(draw, page_num, total_pages)
    draw_footer(draw)

    y = TOP
    for kind, text in page_items:
        if kind == "blank":
            y += 6
            continue

        style = STYLES.get(kind, STYLES["body"])
        if kind == "h2":
            y += style.get("space_before", 0)
            draw.rectangle([(LEFT, y + 24), (RIGHT, y + 27)], fill=hex_rgb("#7dd3fc"))

        font_kind = "bold" if kind in {"title", "h2", "h3"} else "regular"
        font = load_font(font_kind, style["font_size"])
        base_line_height = line_height(draw, font) + 4

        if kind == "bullet":
            bullet_prefix = "• "
            bullet_width = text_width(draw, bullet_prefix, font)
            lines = wrap_text(draw, text, font, MAX_TEXT_WIDTH - bullet_width - 10)
            for idx, line in enumerate(lines):
                prefix = bullet_prefix if idx == 0 else "  "
                draw.text((LEFT + 10, y), prefix + line, fill=hex_rgb(style["color"]), font=font)
                y += base_line_height
        else:
            lines = wrap_text(draw, text, font, MAX_TEXT_WIDTH)
            for line in lines:
                draw.text((LEFT, y), line, fill=hex_rgb(style["color"]), font=font)
                y += base_line_height

        y += style.get("space_after", 0)

    return image


def main() -> None:
    pages = parse_markdown(SOURCE_PATH)
    rendered = [render_page(page, idx, len(pages)) for idx, page in enumerate(pages, start=1)]
    first, rest = rendered[0], rendered[1:]
    first.save(OUTPUT_PATH, "PDF", resolution=DPI, save_all=True, append_images=rest)
    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()

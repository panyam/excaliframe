#!/usr/bin/env python3
"""Generate Excalidraw drawing fixtures of various sizes.

Usage:
    # Preset sizes (approximate targets)
    python fixtures/generate.py a5          # ~250KB
    python fixtures/generate.py a4          # ~500KB
    python fixtures/generate.py a3          # ~1MB
    python fixtures/generate.py a2          # ~5MB
    python fixtures/generate.py a1          # ~10MB
    python fixtures/generate.py a0          # ~20MB

    # Custom: specify target size
    python fixtures/generate.py 750kb       # ~750KB
    python fixtures/generate.py 3mb         # ~3MB

    # Custom: specify element count
    python fixtures/generate.py --elements 2000

    # Output to specific file
    python fixtures/generate.py a3 -o my_drawing.json

    # List presets
    python fixtures/generate.py --list
"""

import argparse
import json
import random
import re
import sys
from pathlib import Path

# Each element is roughly 400-500 bytes of JSON
BYTES_PER_ELEMENT = 450

PRESETS = {
    "a5":  {"target_kb": 250,   "label": "A5 (~250KB)"},
    "a4":  {"target_kb": 500,   "label": "A4 (~500KB)"},
    "a3":  {"target_kb": 1024,  "label": "A3 (~1MB)"},
    "a2":  {"target_kb": 5120,  "label": "A2 (~5MB)"},
    "a1":  {"target_kb": 10240, "label": "A1 (~10MB)"},
    "a0":  {"target_kb": 20480, "label": "A0 (~20MB)"},
}

ELEMENT_TYPES = ["rectangle", "ellipse", "diamond", "line", "arrow", "text"]
COLORS = ["#1e1e1e", "#e03131", "#2f9e44", "#1971c2", "#f08c00", "#9c36b5", "#0c8599", "#862e9c"]
FILLS = ["#a5d8ff", "#ffc9c9", "#b2f2bb", "#ffec99", "#d0bfff", "#c3fae8", "transparent"]
FONT_FAMILIES = [1, 2, 3]  # Virgil, Helvetica, Cascadia

# Longer text phrases to bulk up text elements
PHRASES = [
    "Architecture decision record",
    "Service boundary definition",
    "Authentication flow diagram",
    "Database migration plan",
    "API gateway configuration",
    "Deployment pipeline stages",
    "Error handling strategy",
    "Performance monitoring setup",
    "Security audit checklist",
    "Infrastructure topology map",
    "Load balancer routing rules",
    "Container orchestration layout",
    "Message queue flow diagram",
    "Microservice dependencies",
    "Cache invalidation strategy",
]


def make_element(idx: int, canvas_width: int = 4000, canvas_height: int = 3000) -> dict:
    etype = ELEMENT_TYPES[idx % len(ELEMENT_TYPES)]

    # Spread elements across a large canvas
    grid_cols = max(1, canvas_width // 150)
    col = idx % grid_cols
    row = idx // grid_cols
    x = 30 + col * 150 + random.randint(-20, 20)
    y = 30 + row * 120 + random.randint(-20, 20)
    w = 60 + random.randint(0, 80)
    h = 40 + random.randint(0, 60)

    base = {
        "id": f"gen-{idx:06d}",
        "type": etype,
        "x": x,
        "y": y,
        "width": w,
        "height": h,
        "strokeColor": random.choice(COLORS),
        "backgroundColor": random.choice(FILLS),
        "fillStyle": random.choice(["solid", "hachure", "cross-hatch"]),
        "strokeWidth": random.choice([1, 2, 4]),
        "roughness": random.choice([0, 1, 2]),
        "opacity": 100,
        "angle": 0,
        "seed": random.randint(1, 9999999),
        "version": random.randint(1, 5),
        "versionNonce": random.randint(1, 9999999),
        "isDeleted": False,
        "groupIds": [],
        "boundElements": None,
        "updated": 1700000000000 + idx,
        "link": None,
        "locked": False,
    }

    if etype in ("line", "arrow"):
        # Multi-segment lines are larger
        num_points = random.randint(2, 6)
        base["points"] = [
            [random.randint(-50, 200), random.randint(-50, 150)]
            for _ in range(num_points)
        ]
        base["points"][0] = [0, 0]
        if etype == "arrow":
            base["startArrowhead"] = None
            base["endArrowhead"] = "arrow"
    elif etype == "text":
        phrase = random.choice(PHRASES)
        base["text"] = phrase
        base["fontSize"] = random.choice([14, 16, 20, 24])
        base["fontFamily"] = random.choice(FONT_FAMILIES)
        base["textAlign"] = random.choice(["left", "center"])
        base["verticalAlign"] = "top"
        base["baseline"] = base["fontSize"] - 2
        base["width"] = len(phrase) * base["fontSize"] * 0.6
        base["height"] = base["fontSize"] * 1.5
    else:
        base["roundness"] = {"type": random.choice([2, 3])}

    # Add grouping for some elements (bulks up groupIds)
    if idx % 7 == 0 and idx > 0:
        base["groupIds"] = [f"grp-{idx // 7:04d}"]

    return base


def generate(num_elements: int, seed: int = 42) -> dict:
    random.seed(seed)

    # Scale canvas with element count
    canvas_w = min(20000, max(4000, num_elements * 3))
    canvas_h = min(15000, max(3000, num_elements * 2))

    return {
        "type": "excalidraw",
        "version": 2,
        "source": "excaliframe-e2e-fixture",
        "elements": [make_element(i, canvas_w, canvas_h) for i in range(num_elements)],
        "appState": {
            "viewBackgroundColor": "#ffffff",
            "gridSize": None,
        },
    }


def parse_size(size_str: str) -> int:
    """Parse a size string like '750kb' or '3mb' into KB."""
    size_str = size_str.lower().strip()
    match = re.match(r'^(\d+(?:\.\d+)?)\s*(kb|mb|gb)?$', size_str)
    if not match:
        raise ValueError(f"Can't parse size: {size_str}")
    num = float(match.group(1))
    unit = match.group(2) or "kb"
    multipliers = {"kb": 1, "mb": 1024, "gb": 1024 * 1024}
    return int(num * multipliers[unit])


def elements_for_target_kb(target_kb: int) -> int:
    """Estimate element count needed for a target file size."""
    target_bytes = target_kb * 1024
    return max(10, target_bytes // BYTES_PER_ELEMENT)


def main():
    parser = argparse.ArgumentParser(
        description="Generate Excalidraw fixture files of various sizes.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Presets: " + ", ".join(f"{k} ({v['label']})" for k, v in PRESETS.items()),
    )
    parser.add_argument(
        "size",
        nargs="?",
        help="Preset name (a5-a0) or target size (750kb, 3mb)",
    )
    parser.add_argument(
        "--elements", "-n",
        type=int,
        help="Exact number of elements to generate",
    )
    parser.add_argument(
        "--output", "-o",
        type=str,
        help="Output file path (default: fixtures/<size>.json)",
    )
    parser.add_argument(
        "--seed", "-s",
        type=int,
        default=42,
        help="Random seed for reproducibility (default: 42)",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="List available presets",
    )

    args = parser.parse_args()

    if args.list:
        print("Available presets:")
        for name, info in PRESETS.items():
            elems = elements_for_target_kb(info["target_kb"])
            print(f"  {name:4s}  {info['label']:15s}  ~{elems} elements")
        return

    if not args.size and args.elements is None:
        parser.print_help()
        return

    # Determine element count
    if args.elements:
        num_elements = args.elements
        label = f"{num_elements}-elements"
    elif args.size.lower() in PRESETS:
        preset = PRESETS[args.size.lower()]
        num_elements = elements_for_target_kb(preset["target_kb"])
        label = args.size.lower()
    else:
        target_kb = parse_size(args.size)
        num_elements = elements_for_target_kb(target_kb)
        label = args.size.lower().replace(" ", "")

    # Generate
    drawing = generate(num_elements, seed=args.seed)

    # Output
    fixtures_dir = Path(__file__).parent
    out_path = Path(args.output) if args.output else fixtures_dir / f"{label}.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)

    content = json.dumps(drawing)
    out_path.write_text(content)

    size_bytes = len(content.encode())
    if size_bytes >= 1024 * 1024:
        size_str = f"{size_bytes / (1024 * 1024):.1f}MB"
    else:
        size_str = f"{size_bytes / 1024:.0f}KB"

    print(f"{len(drawing['elements'])} elements, {size_str} → {out_path}")


if __name__ == "__main__":
    main()

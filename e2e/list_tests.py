#!/usr/bin/env python3
"""List E2E tests with descriptions from docstrings.

Usage:
    python list_tests.py              # List all tests
    python list_tests.py collab       # Filter by substring
    python list_tests.py -v encrypt   # Verbose: show fixtures, markers, file location
"""

import ast
import sys
from pathlib import Path

TESTS_DIR = Path(__file__).parent / "tests"

# Markers we care about showing
KNOWN_MARKERS = {"collab", "slow"}


def extract_tests(filepath: Path) -> list[dict]:
    """Parse a test file and extract test info from the AST."""
    source = filepath.read_text()
    tree = ast.parse(source, filename=str(filepath))

    module_doc = ast.get_docstring(tree) or ""
    results = []

    for node in ast.walk(tree):
        if not isinstance(node, ast.ClassDef):
            continue
        class_doc = ast.get_docstring(node) or ""
        for item in node.body:
            if not isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue
            if not item.name.startswith("test_"):
                continue
            # Extract fixture names from function args (skip self)
            fixtures = [
                arg.arg for arg in item.args.args
                if arg.arg not in ("self", "request", "tmp_path")
            ]
            results.append({
                "name": item.name,
                "class": node.name,
                "class_doc": class_doc.split("\n")[0],
                "doc": (ast.get_docstring(item) or "").split("\n")[0],
                "module": filepath.stem,
                "module_doc": module_doc.split("\n")[0],
                "file": str(filepath),
                "line": item.lineno,
                "fixtures": fixtures,
            })

    return results


def extract_markers(filepath: Path) -> set[str]:
    """Extract module-level pytestmark markers."""
    source = filepath.read_text()
    markers = set()
    for line in source.split("\n"):
        if "pytestmark" in line:
            for m in KNOWN_MARKERS:
                if m in line:
                    markers.add(m)
    return markers


def main():
    verbose = "-v" in sys.argv
    args = [a for a in sys.argv[1:] if a != "-v"]
    pattern = args[0].lower() if args else None

    all_tests = []
    for f in sorted(TESTS_DIR.glob("test_*.py")):
        markers = extract_markers(f)
        for t in extract_tests(f):
            t["markers"] = markers
            all_tests.append(t)

    if pattern:
        all_tests = [
            t for t in all_tests
            if pattern in t["name"].lower()
            or pattern in t["module"].lower()
            or pattern in t["doc"].lower()
            or pattern in t["class"].lower()
        ]

    if not all_tests:
        print(f"  No tests matching '{pattern}'.")
        return

    current_module = None
    for t in all_tests:
        if t["module"] != current_module:
            current_module = t["module"]
            header = t["module"]
            if t["module_doc"]:
                header += f"  — {t['module_doc']}"
            print(f"\n  {header}")
            print("  " + "─" * 70)

        tags = ""
        if t["markers"]:
            tags = f"  [{', '.join(sorted(t['markers']))}]"

        print(f"    {t['name']:<45} {t['doc']}{tags}")

        if verbose:
            print(f"      class:    {t['class']} — {t['class_doc']}")
            print(f"      fixtures: {', '.join(t['fixtures'])}")
            print(f"      file:     {t['file']}:{t['line']}")
            print()

    total = len(all_tests)
    print(f"\n  {total} test{'s' if total != 1 else ''} found.\n")


if __name__ == "__main__":
    main()

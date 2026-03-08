"""IndexedDB seeding helpers for E2E tests.

Provides a catalog of sample drawings (SAMPLES) that tests pick from by name,
plus low-level seed_drawing() / clear_drawings() for custom cases.

Usage in tests:
    from helpers.seed import seed_samples, SAMPLES

    def test_listing(page):
        seed_samples(page, "blank_excalidraw", "simple_mermaid")
        # ...

Each sample has a stable UUID so tests can navigate directly:
    page.goto(f"/playground/{SAMPLES['blank_excalidraw']['id']}/edit")
"""

import json
from dataclasses import dataclass
from playwright.sync_api import Page


DB_NAME = "excaliframe-playground"
STORE_NAME = "drawings"


# ── Excalidraw scene payloads ──────────────────────────────────────────

_EMPTY_EXCALIDRAW = json.dumps({
    "type": "excalidraw",
    "version": 2,
    "source": "excaliframe-e2e",
    "elements": [],
    "appState": {"viewBackgroundColor": "#ffffff"},
})

_RECTANGLE_EXCALIDRAW = json.dumps({
    "type": "excalidraw",
    "version": 2,
    "source": "excaliframe-e2e",
    "elements": [
        {
            "id": "rect-1",
            "type": "rectangle",
            "x": 100,
            "y": 100,
            "width": 200,
            "height": 150,
            "strokeColor": "#1e1e1e",
            "backgroundColor": "transparent",
            "fillStyle": "solid",
            "strokeWidth": 2,
            "roughness": 1,
            "opacity": 100,
            "angle": 0,
            "seed": 12345,
            "version": 1,
            "versionNonce": 1,
            "isDeleted": False,
            "groupIds": [],
            "boundElements": None,
            "updated": 1700000000000,
            "link": None,
            "locked": False,
            "roundness": {"type": 3},
        }
    ],
    "appState": {"viewBackgroundColor": "#ffffff"},
})

_MULTI_ELEMENT_EXCALIDRAW = json.dumps({
    "type": "excalidraw",
    "version": 2,
    "source": "excaliframe-e2e",
    "elements": [
        {
            "id": "rect-a",
            "type": "rectangle",
            "x": 50, "y": 50, "width": 120, "height": 80,
            "strokeColor": "#1e1e1e", "backgroundColor": "#a5d8ff",
            "fillStyle": "solid", "strokeWidth": 2, "roughness": 1,
            "opacity": 100, "angle": 0, "seed": 111, "version": 1,
            "versionNonce": 1, "isDeleted": False, "groupIds": [],
            "boundElements": None, "updated": 1700000000000,
            "link": None, "locked": False,
        },
        {
            "id": "ellipse-b",
            "type": "ellipse",
            "x": 250, "y": 80, "width": 100, "height": 100,
            "strokeColor": "#e03131", "backgroundColor": "#ffc9c9",
            "fillStyle": "solid", "strokeWidth": 2, "roughness": 1,
            "opacity": 100, "angle": 0, "seed": 222, "version": 1,
            "versionNonce": 2, "isDeleted": False, "groupIds": [],
            "boundElements": None, "updated": 1700000000000,
            "link": None, "locked": False,
        },
        {
            "id": "line-c",
            "type": "line",
            "x": 170, "y": 90, "width": 80, "height": 40,
            "points": [[0, 0], [80, 40]],
            "strokeColor": "#1e1e1e", "backgroundColor": "transparent",
            "fillStyle": "solid", "strokeWidth": 2, "roughness": 1,
            "opacity": 100, "angle": 0, "seed": 333, "version": 1,
            "versionNonce": 3, "isDeleted": False, "groupIds": [],
            "boundElements": None, "updated": 1700000000000,
            "link": None, "locked": False,
        },
    ],
    "appState": {"viewBackgroundColor": "#ffffff"},
})

# ── Mermaid payloads ───────────────────────────────────────────────────

_SIMPLE_FLOWCHART = "graph TD\n    A[Start] --> B[End]"

_SEQUENCE_DIAGRAM = (
    "sequenceDiagram\n"
    "    Alice->>Bob: Hello\n"
    "    Bob-->>Alice: Hi back"
)

_COMPLEX_FLOWCHART = (
    "graph LR\n"
    "    A[Input] --> B{Decision}\n"
    "    B -->|Yes| C[Process]\n"
    "    B -->|No| D[Skip]\n"
    "    C --> E[Output]\n"
    "    D --> E"
)


# ── Sample catalog ─────────────────────────────────────────────────────
# Stable UUIDs so tests can navigate to /playground/{id}/edit directly.

SAMPLES: dict[str, dict] = {
    # Excalidraw drawings
    "blank_excalidraw": {
        "id": "e2e-excal-blank-0001",
        "title": "Blank Excalidraw",
        "tool": "excalidraw",
        "data": _EMPTY_EXCALIDRAW,
    },
    "rectangle_excalidraw": {
        "id": "e2e-excal-rect-0002",
        "title": "Rectangle Drawing",
        "tool": "excalidraw",
        "data": _RECTANGLE_EXCALIDRAW,
    },
    "multi_excalidraw": {
        "id": "e2e-excal-multi-0003",
        "title": "Multi-Element Drawing",
        "tool": "excalidraw",
        "data": _MULTI_ELEMENT_EXCALIDRAW,
    },
    # Mermaid drawings
    "blank_mermaid": {
        "id": "e2e-mermaid-blank-0004",
        "title": "Blank Mermaid",
        "tool": "mermaid",
        "data": "",
    },
    "flowchart_mermaid": {
        "id": "e2e-mermaid-flow-0005",
        "title": "Simple Flowchart",
        "tool": "mermaid",
        "data": _SIMPLE_FLOWCHART,
    },
    "sequence_mermaid": {
        "id": "e2e-mermaid-seq-0006",
        "title": "Sequence Diagram",
        "tool": "mermaid",
        "data": _SEQUENCE_DIAGRAM,
    },
    "complex_mermaid": {
        "id": "e2e-mermaid-complex-0007",
        "title": "Complex Flowchart",
        "tool": "mermaid",
        "data": _COMPLEX_FLOWCHART,
    },
}


# ── Core seeding functions ─────────────────────────────────────────────

def seed_drawing(
    page: Page,
    drawing_id: str,
    title: str = "Test Drawing",
    tool: str = "excalidraw",
    data: str = "",
) -> None:
    """Seed a single drawing into IndexedDB via page.evaluate().

    Must be called after navigating to the site origin (any page).
    """
    page.evaluate(
        """([id, title, tool, data]) => {
            return new Promise((resolve, reject) => {
                const req = indexedDB.open('excaliframe-playground', 1);
                req.onupgradeneeded = () => {
                    if (!req.result.objectStoreNames.contains('drawings'))
                        req.result.createObjectStore('drawings', { keyPath: 'id' });
                };
                req.onsuccess = () => {
                    const tx = req.result.transaction('drawings', 'readwrite');
                    tx.objectStore('drawings').put({
                        id: id,
                        title: title,
                        envelope: {
                            tool: tool,
                            version: 1,
                            data: data,
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                        },
                    });
                    tx.oncomplete = () => resolve(null);
                    tx.onerror = () => reject(tx.error);
                };
                req.onerror = () => reject(req.error);
            });
        }""",
        [drawing_id, title, tool, data],
    )


def seed_samples(page: Page, *names: str) -> dict[str, dict]:
    """Seed one or more samples by name and return them.

    Usage:
        samples = seed_samples(page, "blank_excalidraw", "flowchart_mermaid")
        page.goto(f"/playground/{samples['blank_excalidraw']['id']}/edit")
    """
    result = {}
    for name in names:
        sample = SAMPLES[name]
        seed_drawing(
            page,
            drawing_id=sample["id"],
            title=sample["title"],
            tool=sample["tool"],
            data=sample["data"],
        )
        result[name] = sample
    return result


def seed_all_samples(page: Page) -> dict[str, dict]:
    """Seed every sample in the catalog."""
    return seed_samples(page, *SAMPLES.keys())


def clear_drawings(page: Page) -> None:
    """Clear all drawings from IndexedDB."""
    page.evaluate(
        """() => {
            return new Promise((resolve, reject) => {
                const req = indexedDB.open('excaliframe-playground', 1);
                req.onupgradeneeded = () => {
                    if (!req.result.objectStoreNames.contains('drawings'))
                        req.result.createObjectStore('drawings', { keyPath: 'id' });
                };
                req.onsuccess = () => {
                    const tx = req.result.transaction('drawings', 'readwrite');
                    tx.objectStore('drawings').clear();
                    tx.oncomplete = () => resolve(null);
                    tx.onerror = () => reject(tx.error);
                };
                req.onerror = () => reject(req.error);
            });
        }"""
    )

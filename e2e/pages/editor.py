"""Page object for the editor page (/playground/{id}/edit)."""

from playwright.sync_api import Page

from .toolbar import FloatingToolbar
from .share_panel import SharePanel


class EditorPage:
    def __init__(self, page: Page):
        self.page = page
        self.root = page.locator("#playground-root")
        self.toolbar = FloatingToolbar(page)
        self.share_panel = SharePanel(page)

    def goto(self, drawing_id: str, **query: str) -> None:
        qs = "&".join(f"{k}={v}" for k, v in query.items())
        url = f"/playground/{drawing_id}/edit"
        if qs:
            url += f"?{qs}"
        self.page.goto(url)
        self.wait_for_loaded()

    def wait_for_loaded(self) -> None:
        self.root.wait_for(state="visible", timeout=30_000)
        # Wait for either Excalidraw canvas or Mermaid textarea to appear
        self.page.wait_for_function(
            "document.querySelector('.excalidraw') || document.querySelector('textarea')",
            timeout=30_000,
        )

    def is_excalidraw(self) -> bool:
        return self.page.locator(".excalidraw").count() > 0

    def is_mermaid(self) -> bool:
        return self.page.locator("textarea").count() > 0

    def excalidraw_canvas(self):
        return self.page.locator(".excalidraw canvas").first

    def draw_line(self) -> None:
        """Draw a simple line on the Excalidraw canvas."""
        canvas = self.excalidraw_canvas()
        box = canvas.bounding_box()
        assert box is not None
        self.page.mouse.move(box["x"] + 100, box["y"] + 100)
        self.page.mouse.down()
        self.page.mouse.move(box["x"] + 300, box["y"] + 300, steps=10)
        self.page.mouse.up()

    def draw_rectangle(self) -> None:
        """Select rectangle tool and draw on canvas."""
        # Press 'r' to select rectangle tool (Excalidraw shortcut)
        self.page.keyboard.press("r")
        canvas = self.excalidraw_canvas()
        box = canvas.bounding_box()
        assert box is not None
        self.page.mouse.move(box["x"] + 120, box["y"] + 120)
        self.page.mouse.down()
        self.page.mouse.move(box["x"] + 280, box["y"] + 250, steps=5)
        self.page.mouse.up()

    def type_mermaid(self, code: str) -> None:
        self.page.locator("textarea").first.fill(code)

    def get_mermaid_text(self) -> str:
        return self.page.locator("textarea").first.input_value()

    def excalidraw_element_count(self) -> int:
        """Return the number of non-deleted Excalidraw elements via JS."""
        return self.page.evaluate(
            """() => {
                const api = window.__EXCALIDRAW_API__;
                if (!api) return -1;
                return api.getSceneElements().filter(e => !e.isDeleted).length;
            }"""
        )

    def title_text(self) -> str:
        return self.page.locator("#drawing-title-slot").text_content() or ""

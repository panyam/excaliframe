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
        """Return the interactive canvas (not the static rendering canvas)."""
        return self.page.locator(".excalidraw__canvas.interactive").first

    def _focus_canvas(self) -> None:
        """Click canvas to ensure Excalidraw has focus (not toolbar/share panel)."""
        canvas = self.excalidraw_canvas()
        canvas.click()
        self.page.wait_for_timeout(200)

    def _dispatch_draw(self, start: tuple[int, int], end: tuple[int, int], steps: int = 5) -> None:
        """Draw on canvas by dispatching PointerEvents via JS.

        Playwright mouse events don't reliably reach Excalidraw's canvas
        handlers in headless mode, so we dispatch native PointerEvents.
        """
        self.page.evaluate(
            """([startX, startY, endX, endY, steps]) => {
                const canvas = document.querySelector('.excalidraw__canvas.interactive');
                const rect = canvas.getBoundingClientRect();
                const sx = rect.left + startX, sy = rect.top + startY;
                const ex = rect.left + endX, ey = rect.top + endY;
                const opts = { bubbles: true, cancelable: true,
                               pointerType: 'mouse', pointerId: 1 };

                canvas.dispatchEvent(new PointerEvent('pointerdown', {
                    ...opts, clientX: sx, clientY: sy,
                    button: 0, buttons: 1, pressure: 0.5,
                }));
                for (let i = 1; i <= steps; i++) {
                    canvas.dispatchEvent(new PointerEvent('pointermove', {
                        ...opts, button: 0, buttons: 1, pressure: 0.5,
                        clientX: sx + (ex - sx) * i / steps,
                        clientY: sy + (ey - sy) * i / steps,
                    }));
                }
                canvas.dispatchEvent(new PointerEvent('pointerup', {
                    ...opts, clientX: ex, clientY: ey,
                    button: 0, buttons: 0,
                }));
            }""",
            [start[0], start[1], end[0], end[1], steps],
        )

    def draw_line(self) -> None:
        """Draw a simple line on the Excalidraw canvas."""
        self._focus_canvas()
        self._dispatch_draw((100, 100), (300, 300), steps=10)

    def draw_rectangle(self) -> None:
        """Select rectangle tool and draw on canvas."""
        self._focus_canvas()
        self.page.keyboard.press("r")
        self.page.wait_for_timeout(100)
        self._dispatch_draw((120, 120), (280, 250))

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

"""Shared fixtures for E2E tests.

- server: session-scoped Go dev server (build + start before all tests)
- owner / follower: isolated browser contexts for multi-profile collab tests
- seeded_page: page with IndexedDB already initialized (navigated to origin)
"""

import os
import time
import pytest
from playwright.sync_api import Browser, BrowserContext, Page

from helpers.server import start_server, stop_server
from helpers.seed import clear_drawings


# ── Server lifecycle ───────────────────────────────────────────────────

SERVER_PORT = int(os.environ.get("E2E_PORT", "9222"))
SERVER_URL = f"http://localhost:{SERVER_PORT}"
SKIP_BUILD = os.environ.get("E2E_SKIP_BUILD", "").lower() in ("1", "true", "yes")
PAUSE_END = float(os.environ.get("E2E_PAUSE_END", "0"))  # seconds to pause after each test


@pytest.fixture(scope="session")
def server():
    """Start the Go dev server before all tests, stop after."""
    proc = start_server(port=SERVER_PORT, build=not SKIP_BUILD)
    yield {"url": SERVER_URL, "port": SERVER_PORT, "process": proc}
    stop_server(proc)


@pytest.fixture(scope="session")
def base_url(server) -> str:
    """Provide base_url for pytest-playwright (auto-used by page fixture)."""
    return server["url"]


# ── Isolated browser contexts ─────────────────────────────────────────

# Window layout for headed mode (side-by-side tiling)
WINDOW_WIDTH = int(os.environ.get("E2E_WINDOW_W", "700"))
WINDOW_HEIGHT = int(os.environ.get("E2E_WINDOW_H", "800"))
WINDOW_X = int(os.environ.get("E2E_WINDOW_X", "0"))
WINDOW_Y = int(os.environ.get("E2E_WINDOW_Y", "0"))
WINDOW_POSITIONS = {
    "owner": (WINDOW_X, WINDOW_Y),
    "follower": (WINDOW_X + WINDOW_WIDTH + 10, WINDOW_Y),
}


def _make_context(browser: Browser, server: dict) -> BrowserContext:
    """Create an isolated browser context with granted clipboard permissions."""
    return browser.new_context(
        base_url=server["url"],
        permissions=["clipboard-read", "clipboard-write"],
        viewport={"width": WINDOW_WIDTH - 20, "height": WINDOW_HEIGHT - 100},
    )


def _position_window(page, x: int, y: int, width: int, height: int) -> None:
    """Position browser window using CDP (Chromium only, headed mode)."""
    try:
        cdp = page.context.new_cdp_session(page)
        target = cdp.send("Browser.getWindowForTarget")
        cdp.send("Browser.setWindowBounds", {
            "windowId": target["windowId"],
            "bounds": {"left": x, "top": y, "width": width, "height": height},
        })
        cdp.detach()
    except Exception:
        pass  # Silently skip in headless mode or non-Chromium


@pytest.fixture
def owner(request, browser: Browser, server) -> dict:
    """Owner profile — isolated browser context for collab tests."""
    ctx = _make_context(browser, server)
    page = ctx.new_page()
    if request.config.getoption("--headed", default=False):
        x, y = WINDOW_POSITIONS["owner"]
        _position_window(page, x, y, WINDOW_WIDTH, WINDOW_HEIGHT)
    yield {"context": ctx, "page": page}
    ctx.close()


@pytest.fixture
def follower(request, browser: Browser, server) -> dict:
    """Follower profile — separate isolated browser context."""
    ctx = _make_context(browser, server)
    page = ctx.new_page()
    if request.config.getoption("--headed", default=False):
        x, y = WINDOW_POSITIONS["follower"]
        _position_window(page, x, y, WINDOW_WIDTH, WINDOW_HEIGHT)
    yield {"context": ctx, "page": page}
    ctx.close()


# ── Seeded page helper ────────────────────────────────────────────────


@pytest.fixture
def seeded_page(page: Page, server) -> Page:
    """A page that has visited the origin (so IndexedDB is accessible).

    Clears any leftover drawings before yielding.
    """
    page.goto(server["url"] + "/about/")
    clear_drawings(page)
    return page


# ── End-of-test pause (headed mode) ─────────────────────────────────


@pytest.fixture(autouse=True)
def pause_after_test(request):
    """Pause after each test so the final page state is visible in headed mode.

    Auto-detects --headed flag (3s default). Override with E2E_PAUSE_END=<seconds>.
    Set E2E_PAUSE_END=0 to disable even in headed mode.
    """
    yield
    pause = PAUSE_END
    if pause == 0 and request.config.getoption("--headed", default=False):
        pause = 3.0
    if pause > 0:
        time.sleep(pause)

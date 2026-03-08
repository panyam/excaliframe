"""Shared fixtures for E2E tests.

- server: session-scoped Go dev server (build + start before all tests)
- owner / follower: isolated browser contexts for multi-profile collab tests
- seeded_page: page with IndexedDB already initialized (navigated to origin)
"""

import os
import pytest
from playwright.sync_api import Browser, BrowserContext, Page

from helpers.server import start_server, stop_server
from helpers.seed import clear_drawings


# ── Server lifecycle ───────────────────────────────────────────────────

SERVER_PORT = int(os.environ.get("E2E_PORT", "9222"))
SERVER_URL = f"http://localhost:{SERVER_PORT}"
SKIP_BUILD = os.environ.get("E2E_SKIP_BUILD", "").lower() in ("1", "true", "yes")


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


def _make_context(browser: Browser, server: dict) -> BrowserContext:
    """Create an isolated browser context with granted clipboard permissions."""
    return browser.new_context(
        base_url=server["url"],
        permissions=["clipboard-read", "clipboard-write"],
    )


@pytest.fixture
def owner(browser: Browser, server) -> dict:
    """Owner profile — isolated browser context for collab tests."""
    ctx = _make_context(browser, server)
    page = ctx.new_page()
    yield {"context": ctx, "page": page}
    ctx.close()


@pytest.fixture
def follower(browser: Browser, server) -> dict:
    """Follower profile — separate isolated browser context."""
    ctx = _make_context(browser, server)
    page = ctx.new_page()
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

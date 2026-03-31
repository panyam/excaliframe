"""Fixtures for Confluence Forge plugin E2E tests.

These tests run against real Confluence instances, not the local playground.
Auth is via saved browser state (make confluence-login ACCOUNT=xxx).
"""

import json
import os
import uuid
from pathlib import Path

import pytest
from playwright.sync_api import Browser

from helpers.confluence import (
    load_account,
    confluence_context,
    create_page,
    delete_page,
    get_page_id,
)


# ── Fixtures directory ──────────────────────────────────────────────────

FIXTURES_DIR = Path(__file__).parent.parent / "fixtures"


def pytest_addoption(parser):
    parser.addoption(
        "--account",
        action="store",
        default=os.environ.get("E2E_CONFLUENCE_ACCOUNT"),
        help="Confluence account name from accounts.json (or E2E_CONFLUENCE_ACCOUNT)",
    )
    parser.addoption(
        "--create-page",
        action="store_true",
        default=os.environ.get("E2E_CREATE_PAGE", "").lower() in ("1", "true", "yes"),
        help="Create a fresh Confluence page for each test (default: off, uses E2E_CONFLUENCE_PAGE_URL)",
    )
    parser.addoption(
        "--keep-page",
        action="store_true",
        default=False,
        help="Don't delete test pages after tests (useful for debugging)",
    )


@pytest.fixture(scope="session")
def account(request):
    """Load the Confluence account config."""
    name = request.config.getoption("--account")
    return load_account(name)


@pytest.fixture(scope="session")
def confluence_base_url(account) -> str:
    return account["url"]


@pytest.fixture
def confluence(browser: Browser, account) -> dict:
    """Authenticated Confluence browser context + page."""
    ctx = confluence_context(browser, account)
    page = ctx.new_page()

    # Capture console logs from all frames
    logs = []
    page.on("console", lambda msg: logs.append(msg.text))

    yield {"context": ctx, "page": page, "logs": logs, "account": account}
    ctx.close()


@pytest.fixture
def test_page(request, confluence):
    """A Confluence page for testing.

    If --create-page: creates a fresh page, yields it, deletes after.
    Otherwise: uses E2E_CONFLUENCE_PAGE_URL env var (you pre-create the page).
    """
    page = confluence["page"]
    account = confluence["account"]
    base_url = account["url"]

    if request.config.getoption("--create-page"):
        title = f"E2E Test {uuid.uuid4().hex[:8]}"
        create_page(page, base_url, account["space"], title)
        page_url = page.url
        page_id = get_page_id(page)

        yield {
            "page": page,
            "page_id": page_id,
            "page_url": page_url,
            "title": title,
            "created": True,
        }

        # Cleanup unless --keep-page
        if not request.config.getoption("--keep-page") and page_id:
            delete_page(page, base_url, page_id)
    else:
        page_url = os.environ.get("E2E_CONFLUENCE_PAGE_URL")
        if not page_url:
            pytest.skip(
                "No --create-page flag and no E2E_CONFLUENCE_PAGE_URL set. "
                "Either pass --create-page or set the env var to an existing page URL."
            )

        page.goto(page_url)
        page.wait_for_load_state("networkidle")
        page_id = get_page_id(page)

        yield {
            "page": page,
            "page_id": page_id,
            "page_url": page_url,
            "title": None,
            "created": False,
        }


@pytest.fixture
def drawing_fixture():
    """Load a drawing fixture from e2e/fixtures/.

    Returns a function: call with a filename to get the JSON string.
    Looks for .json and .excalidraw files.
    """
    def _load(name: str) -> str:
        for ext in ("", ".json", ".excalidraw"):
            path = FIXTURES_DIR / f"{name}{ext}"
            if path.exists():
                return path.read_text()
        available = [f.name for f in FIXTURES_DIR.iterdir() if f.suffix in (".json", ".excalidraw")]
        raise FileNotFoundError(
            f"Fixture '{name}' not found in {FIXTURES_DIR}. Available: {available}"
        )
    return _load

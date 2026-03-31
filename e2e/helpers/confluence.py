"""Confluence helpers for Forge plugin E2E tests.

Manages auth via saved browser state, page creation/cleanup, and macro interaction.

Accounts configured in confluence/accounts.json (copy accounts.json.example).
"""

import json
import os
import re
from pathlib import Path
from playwright.sync_api import Page, BrowserContext, Browser


ACCOUNTS_FILE = Path(__file__).parent.parent / "confluence" / "accounts.json"


def load_account(name: str | None = None) -> dict:
    """Load account config from env vars or accounts.json."""
    url = os.environ.get("E2E_CONFLUENCE_URL")
    if url:
        return {
            "name": os.environ.get("E2E_CONFLUENCE_ACCOUNT", "env"),
            "url": url.rstrip("/"),
            "space": os.environ.get("E2E_CONFLUENCE_SPACE", "~me"),
            "auth_state": os.environ.get("E2E_CONFLUENCE_AUTH", ""),
        }

    if not ACCOUNTS_FILE.exists():
        raise FileNotFoundError(
            f"No E2E_CONFLUENCE_URL set and {ACCOUNTS_FILE} not found.\n"
            f"Copy accounts.json.example and fill in your details."
        )

    accounts = json.loads(ACCOUNTS_FILE.read_text())
    if name:
        acct = accounts[name]
        acct["name"] = name
        return acct

    first_name = next(iter(accounts))
    acct = accounts[first_name]
    acct["name"] = first_name
    return acct


def confluence_context(browser: Browser, account: dict) -> BrowserContext:
    """Create a browser context with saved Confluence auth state."""
    auth_path = account.get("auth_state", "")
    # Resolve relative to e2e/ dir
    full_path = Path(__file__).parent.parent / auth_path
    if not full_path.exists():
        raise FileNotFoundError(
            f"Auth state not found at '{full_path}'.\n"
            f"Run: make confluence-login ACCOUNT={account['name']}"
        )
    return browser.new_context(
        storage_state=str(full_path),
        viewport={"width": 1400, "height": 900},
    )


def create_page(page: Page, base_url: str, space: str, title: str) -> None:
    """Navigate to create a new Confluence page in the given space."""
    page.goto(f"{base_url}/wiki/spaces/{space}/pages/create")
    page.wait_for_load_state("networkidle")

    # Wait for editor
    page.locator(
        '[data-testid="ak-editor-main-toolbar"], .ProseMirror, [role="textbox"]'
    ).first.wait_for(state="visible", timeout=30_000)

    # Set page title
    title_input = page.locator(
        'textarea[data-testid="ak-editor-title-field"], '
        '[placeholder="Page title"], '
        'textarea[placeholder*="title" i]'
    ).first
    title_input.wait_for(state="visible", timeout=10_000)
    title_input.fill(title)


def insert_excalidraw_macro(page: Page) -> None:
    """Type /Excali in the editor to insert the Excalidraw macro."""
    editor_body = page.locator('.ProseMirror, [role="textbox"]').first
    editor_body.click()
    page.wait_for_timeout(500)

    page.keyboard.type("/Excali", delay=100)
    page.wait_for_timeout(1500)

    # Select from autocomplete
    page.locator(
        'button:has-text("Excalidraw"), '
        '[role="option"]:has-text("Excalidraw"), '
        '[role="menuitem"]:has-text("Excalidraw")'
    ).first.click()


def find_forge_editor_frame(page: Page, timeout: int = 30_000) -> "Frame":
    """Wait for the Forge macro editor iframe and return it.

    Forge apps load in nested iframes. We look for our editor's markers.
    """
    import time
    deadline = time.time() + timeout / 1000

    while time.time() < deadline:
        for frame in page.frames:
            url = frame.url.lower()
            if "excaliframe" in url or (
                "forge" in url and frame.locator('.excalidraw, #playground-root').count() > 0
            ):
                frame.wait_for_selector('.excalidraw', timeout=10_000)
                return frame
        page.wait_for_timeout(1000)

    urls = [f.url for f in page.frames]
    raise TimeoutError(f"Forge editor iframe not found. Frames: {urls}")


def paste_drawing_via_api(frame, drawing_json: str) -> None:
    """Load a drawing into the Excalidraw editor via its internal API."""
    frame.evaluate(
        """(jsonStr) => {
            const data = JSON.parse(jsonStr);
            const api = window.__EXCALIDRAW_API__;
            if (!api) throw new Error('Excalidraw API not available');
            api.updateScene({
                elements: data.elements || [],
                appState: data.appState || {},
            });
            if (data.files) {
                api.addFiles(Object.values(data.files));
            }
        }""",
        drawing_json,
    )


def clear_canvas(frame) -> None:
    """Delete all elements from the Excalidraw canvas."""
    frame.evaluate(
        """() => {
            const api = window.__EXCALIDRAW_API__;
            if (!api) throw new Error('Excalidraw API not available');
            const elements = api.getSceneElements().map(e => ({...e, isDeleted: true}));
            api.updateScene({ elements });
        }"""
    )


def element_count(frame) -> int:
    """Return the number of non-deleted elements."""
    return frame.evaluate(
        """() => {
            const api = window.__EXCALIDRAW_API__;
            if (!api) return -1;
            return api.getSceneElements().filter(e => !e.isDeleted).length;
        }"""
    )


def save_macro(page: Page) -> None:
    """Trigger save via Cmd+S."""
    page.keyboard.press("Meta+s")


def publish_page(page: Page) -> None:
    """Publish the Confluence page."""
    page.locator(
        'button:has-text("Publish"), '
        'button[data-testid="ak-editor-publish-button"]'
    ).first.click()
    page.wait_for_load_state("networkidle")


def get_page_id(page: Page) -> str | None:
    """Extract page ID from the current Confluence URL."""
    match = re.search(r'/pages/(\d+)', page.url)
    return match.group(1) if match else None


def get_attachments(page: Page, base_url: str, page_id: str) -> list[dict]:
    """Fetch page attachments via Confluence REST API using browser session."""
    result = page.evaluate(
        """async ([baseUrl, pageId]) => {
            const resp = await fetch(
                `${baseUrl}/wiki/api/v2/pages/${pageId}/attachments`,
                { credentials: 'include' }
            );
            if (!resp.ok) return { error: resp.status };
            return await resp.json();
        }""",
        [base_url, page_id],
    )
    if isinstance(result, dict) and "error" in result:
        return []
    return result.get("results", [])


def delete_page(page: Page, base_url: str, page_id: str) -> bool:
    """Delete a Confluence page via REST API. Returns True on success."""
    result = page.evaluate(
        """async ([baseUrl, pageId]) => {
            const resp = await fetch(
                `${baseUrl}/wiki/api/v2/pages/${pageId}`,
                { method: 'DELETE', credentials: 'include' }
            );
            return resp.ok;
        }""",
        [base_url, page_id],
    )
    return result

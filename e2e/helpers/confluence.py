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
    # Don't use networkidle — Confluence SPA never stops fetching.
    # Instead wait for the editor to actually appear.
    page.wait_for_load_state("domcontentloaded")

    # Wait for the title area — this is the first interactive element
    # Confluence editor uses various selectors across versions
    title_input = page.locator(
        '[data-testid="ak-editor-title-field"], '
        '[placeholder="Page title"], '
        'textarea[placeholder*="title" i], '
        '[contenteditable][data-placeholder*="title" i], '
        '.ak-editor-content-area textarea'
    ).first
    title_input.wait_for(state="visible", timeout=60_000)
    title_input.click()
    page.wait_for_timeout(500)
    title_input.fill(title)
    page.wait_for_timeout(300)
    # Press Enter to move cursor from title into the editor body
    page.keyboard.press("Enter")


def insert_excalidraw_macro(page: Page) -> None:
    """Type /Excali in the editor body to insert the Excalidraw macro."""
    # Move from title to body — Tab or click below the title
    # The ProseMirror editor body is the contenteditable area below the title
    editor_body = page.locator(
        '.ProseMirror[contenteditable="true"], '
        '.ak-editor-content-area [contenteditable="true"], '
        '[data-testid="ak-editor-fp-content-area"] [contenteditable="true"]'
    ).first
    editor_body.wait_for(state="visible", timeout=10_000)
    editor_body.click()
    page.wait_for_timeout(500)

    # Type the slash command
    page.keyboard.type("/Excali", delay=100)
    page.wait_for_timeout(2000)

    # Press Enter to select the first autocomplete option
    page.keyboard.press("Enter")
    page.wait_for_timeout(2000)


def find_forge_editor_frame(page: Page, logs: list[str] | None = None, timeout: int = 30_000) -> "Frame":
    """Wait for the Forge macro editor iframe and return it.

    Forge apps load in nested iframes. We look for our editor's markers.
    If logs list is provided, also captures console output from the iframe.
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
                # Inject console capture inside the iframe so we get V2 logs
                if logs is not None:
                    frame.evaluate(
                        """() => {
                            const origLog = console.log;
                            const origInfo = console.info;
                            const origWarn = console.warn;
                            window.__capturedLogs = window.__capturedLogs || [];
                            console.log = (...args) => {
                                window.__capturedLogs.push(args.join(' '));
                                origLog.apply(console, args);
                            };
                            console.info = (...args) => {
                                window.__capturedLogs.push(args.join(' '));
                                origInfo.apply(console, args);
                            };
                            console.warn = (...args) => {
                                window.__capturedLogs.push(args.join(' '));
                                origWarn.apply(console, args);
                            };
                        }"""
                    )
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


def collect_iframe_logs(frame) -> list[str]:
    """Collect console logs captured inside the Forge iframe."""
    return frame.evaluate(
        """() => {
            const logs = window.__capturedLogs || [];
            window.__capturedLogs = [];  // drain
            return logs;
        }"""
    )


def save_macro(frame, page: Page) -> None:
    """Trigger save via Cmd+S inside the Forge editor iframe."""
    # Focus must be inside the iframe for the keypress to reach our editor
    frame.locator('.excalidraw__canvas, .excalidraw, canvas').first.click()
    page.wait_for_timeout(300)
    # Send Cmd+S — frame.page gives us the keyboard for the focused frame
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

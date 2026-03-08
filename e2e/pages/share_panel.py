"""Page object for the SharePanel component."""

import re
from playwright.sync_api import Page


class SharePanel:
    def __init__(self, page: Page):
        self.page = page
        self.panel = page.locator('[data-testid="share-panel"]')
        self.peer_list = page.locator('[data-testid="peer-list"]')

    def wait_for_visible(self) -> None:
        self.panel.wait_for(state="visible", timeout=10_000)

    def start_sharing(self) -> None:
        self.panel.get_by_text("Start Sharing").click()

    def stop_sharing(self) -> None:
        self.panel.get_by_text("Stop Sharing").click()

    def disconnect(self) -> None:
        self.panel.get_by_text("Disconnect").click()

    def wait_for_connected(self) -> None:
        self.panel.get_by_text(
            re.compile(r"Sharing Active|Connected")
        ).wait_for(timeout=15_000)

    def is_sharing_active(self) -> bool:
        return self.panel.get_by_text("Sharing Active").is_visible()

    def is_connected_as_follower(self) -> bool:
        return self.panel.get_by_text("Connected", exact=True).is_visible()

    def heading_text(self) -> str:
        return self.panel.locator("h3").text_content() or ""

    def peer_count(self) -> int:
        """Count visible peer entries in the peer list."""
        return self.peer_list.locator("span.flex").count()

    def get_join_link(self) -> str:
        """Click 'Copy Join Link' and intercept the clipboard write."""
        return self.page.evaluate(
            """() => new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject('copy timeout'), 5000);
                const orig = navigator.clipboard.writeText;
                navigator.clipboard.writeText = async (text) => {
                    navigator.clipboard.writeText = orig;
                    clearTimeout(timeout);
                    resolve(text);
                };
                const btns = document.querySelectorAll('[data-testid="share-panel"] button');
                for (const b of btns) {
                    if (b.textContent.includes('Copy Join Link')) { b.click(); return; }
                }
                clearTimeout(timeout);
                reject('Copy Join Link button not found');
            })"""
        )

    def enable_encryption(self) -> None:
        self.panel.locator('input[type="checkbox"]').check()

    def is_encryption_enabled(self) -> bool:
        return self.panel.locator('input[type="checkbox"]').is_checked()

    def get_password(self) -> str:
        """Get the generated/displayed password."""
        return self.panel.locator("code").text_content() or ""

    def set_password(self, password: str) -> None:
        self.panel.locator('input[type="text"][placeholder*="password" i]').fill(password)

    def select_relay(self, label: str) -> None:
        self.panel.locator("select").select_option(label=label)

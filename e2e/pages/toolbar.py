"""Page object for the FloatingToolbar component."""

import re
from playwright.sync_api import Page


class FloatingToolbar:
    def __init__(self, page: Page):
        self.page = page

    def _gear_button(self):
        """The gear/settings toggle button."""
        # FloatingToolbar renders a button with an SVG gear icon
        # It's the only fixed-position button with the gear SVG
        return self.page.locator('button:has(svg)').filter(
            has=self.page.locator('path[d*="M9.594"]')
        ).first

    def open(self) -> None:
        self._gear_button().click()
        # Wait for the menu panel to appear
        self.page.wait_for_timeout(300)

    def close(self) -> None:
        # Click outside to dismiss
        self.page.mouse.click(0, 0)
        self.page.wait_for_timeout(300)

    def click_save(self) -> None:
        self.page.get_by_text("Save", exact=True).click()

    def click_share(self) -> None:
        """Click the Share/Collab button to show the SharePanel inline."""
        self.page.get_by_text(re.compile(r"Share|Sharing|Connected")).first.click()

    def is_collab_indicator_visible(self) -> bool:
        """Check if the indigo collab-connected dot is visible on the gear."""
        return self._gear_button().locator(".bg-indigo-500, .bg-indigo-600").is_visible()

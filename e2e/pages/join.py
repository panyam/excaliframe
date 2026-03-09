"""Page object for the join page (/join/ and /join/{code})."""

from playwright.sync_api import Page


class JoinPage:
    def __init__(self, page: Page):
        self.page = page
        self.input = page.locator("#join-input")
        self.join_btn = page.locator("#join-btn")
        self.password_section = page.locator("#password-section")
        self.password_input = page.locator("#password-input")
        self.password_join_btn = page.locator("#password-join-btn")
        self.error = page.locator("#join-error")

    def goto(self, code: str = "_") -> None:
        """Navigate to the join page. A code is required (/join/ redirects to /)."""
        self.page.goto(f"/join/{code}")
        self.input.wait_for(state="visible", timeout=10_000)

    def paste_code(self, code: str) -> None:
        self.input.fill(code)
        self.join_btn.click()

    def enter_password(self, password: str) -> None:
        self.password_section.wait_for(state="visible", timeout=10_000)
        self.password_input.fill(password)
        self.password_join_btn.click()

    def has_error(self) -> bool:
        return self.error.is_visible()

    def error_text(self) -> str:
        return self.error.text_content() or ""

    def wait_for_password(self, timeout: int = 10_000) -> None:
        """Wait for the password section to appear (async room check)."""
        self.password_section.wait_for(state="visible", timeout=timeout)

    def is_password_visible(self) -> bool:
        return self.password_section.is_visible()

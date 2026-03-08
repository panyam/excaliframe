"""Page object for the drawing detail page (/playground/{id}/)."""

from playwright.sync_api import Page


class DetailPage:
    def __init__(self, page: Page):
        self.page = page

    def goto(self, drawing_id: str) -> None:
        self.page.goto(f"/playground/{drawing_id}/")
        self.page.wait_for_load_state("domcontentloaded")

    def title(self) -> str:
        return self.page.locator("h1, h2, [data-drawing-title]").first.text_content() or ""

    def edit_button(self):
        return self.page.get_by_role("link", name="Edit")

    def click_edit(self) -> None:
        self.edit_button().click()

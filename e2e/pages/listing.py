"""Page object for the drawings listing page (/)."""

from playwright.sync_api import Page, Locator


class ListingPage:
    def __init__(self, page: Page):
        self.page = page
        self.loading = page.locator("#drawings-loading")
        self.new_drawing_btn = page.locator('a[href="#new-drawing"]')
        self.tool_modal = page.locator("#tool-modal")
        self.tool_grid = page.locator("#tool-grid")
        self.grid_wrapper = page.locator("#drawings-grid-wrapper")
        self.grid = page.locator("#drawings-grid")
        self.empty_state = page.locator("#drawings-empty-state")
        self.search_input = page.locator("#search-drawings")

    def goto(self) -> None:
        self.page.goto("/")
        self.loading.wait_for(state="hidden", timeout=15_000)

    def card_count(self) -> int:
        return self.page.locator(".entity-card").count()

    def card_by_id(self, drawing_id: str) -> Locator:
        return self.page.locator(f'[data-entity-id="{drawing_id}"]')

    def click_new_drawing(self) -> None:
        self.new_drawing_btn.click()
        self.tool_modal.wait_for(state="visible")

    def select_tool(self, tool: str) -> None:
        """Click a tool button in the new-drawing modal (e.g. 'Excalidraw', 'Mermaid')."""
        self.tool_grid.get_by_text(tool, exact=False).click()

    def search(self, query: str) -> None:
        self.search_input.fill(query)

    def delete_drawing(self, drawing_id: str) -> None:
        """Open action menu for a card and click delete."""
        card = self.card_by_id(drawing_id)
        card.locator(".entity-actions-btn").click()
        self.page.locator(f'[data-playground-delete="{drawing_id}"]').click()

    def is_empty(self) -> bool:
        return self.empty_state.is_visible()

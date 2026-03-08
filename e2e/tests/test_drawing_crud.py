"""Tests for drawing CRUD: create, list, detail, delete."""

import pytest
from pages import ListingPage, EditorPage
from helpers.seed import seed_samples, SAMPLES


class TestCreateDrawing:
    """Creating new drawings via the tool modal."""

    def test_create_excalidraw_drawing(self, seeded_page, server):
        page = seeded_page
        listing = ListingPage(page)
        listing.goto()
        listing.click_new_drawing()
        listing.select_tool("Excalidraw")

        # Should navigate to the editor with Excalidraw canvas
        editor = EditorPage(page)
        editor.wait_for_loaded()
        assert editor.is_excalidraw()

    def test_create_mermaid_drawing(self, seeded_page, server):
        page = seeded_page
        listing = ListingPage(page)
        listing.goto()
        listing.click_new_drawing()
        listing.select_tool("Mermaid")

        editor = EditorPage(page)
        editor.wait_for_loaded()
        assert editor.is_mermaid()


class TestListDrawings:
    """Listing page shows seeded drawings."""

    def test_listing_shows_seeded_drawings(self, seeded_page, server):
        page = seeded_page
        seed_samples(page, "blank_excalidraw", "flowchart_mermaid")

        listing = ListingPage(page)
        listing.goto()

        assert listing.card_count() >= 2
        assert listing.card_by_id(SAMPLES["blank_excalidraw"]["id"]).is_visible()
        assert listing.card_by_id(SAMPLES["flowchart_mermaid"]["id"]).is_visible()

    def test_empty_state_when_no_drawings(self, seeded_page, server):
        page = seeded_page
        listing = ListingPage(page)
        listing.goto()

        assert listing.is_empty()


class TestDeleteDrawing:
    """Deleting a drawing from the listing."""

    def test_delete_removes_card(self, seeded_page, server):
        page = seeded_page
        sample = seed_samples(page, "rectangle_excalidraw")["rectangle_excalidraw"]

        listing = ListingPage(page)
        listing.goto()
        assert listing.card_by_id(sample["id"]).is_visible()

        # Handle the confirm dialog
        page.on("dialog", lambda dialog: dialog.accept())
        listing.delete_drawing(sample["id"])

        # Card should disappear
        listing.card_by_id(sample["id"]).wait_for(state="hidden", timeout=5_000)

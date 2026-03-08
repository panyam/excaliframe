"""Tests for the editor page: drawing, typing, saving."""

import pytest
from pages import EditorPage
from helpers.seed import seed_samples, SAMPLES


class TestExcalidrawEditor:
    """Excalidraw canvas interactions."""

    def test_canvas_loads_with_seeded_data(self, seeded_page, server):
        """Open seeded Excalidraw drawing, canvas renders."""
        page = seeded_page
        sample = seed_samples(page, "rectangle_excalidraw")["rectangle_excalidraw"]

        editor = EditorPage(page)
        editor.goto(sample["id"])
        assert editor.is_excalidraw()

    def test_draw_on_canvas(self, seeded_page, server):
        """Draw a rectangle on blank canvas, element count increases."""
        page = seeded_page
        sample = seed_samples(page, "blank_excalidraw")["blank_excalidraw"]

        editor = EditorPage(page)
        editor.goto(sample["id"])
        editor.draw_rectangle()

        page.wait_for_timeout(500)
        count = editor.excalidraw_element_count()
        assert count > 0, f"Expected elements after drawing, got {count}"


class TestMermaidEditor:
    """Mermaid textarea interactions."""

    def test_textarea_loads_with_seeded_data(self, seeded_page, server):
        """Open seeded Mermaid drawing, textarea contains the code."""
        page = seeded_page
        sample = seed_samples(page, "flowchart_mermaid")["flowchart_mermaid"]

        editor = EditorPage(page)
        editor.goto(sample["id"])
        assert editor.is_mermaid()

        text = editor.get_mermaid_text()
        assert "Start" in text

    def test_type_mermaid_code(self, seeded_page, server):
        """Type Mermaid code into blank drawing, textarea reflects it."""
        page = seeded_page
        sample = seed_samples(page, "blank_mermaid")["blank_mermaid"]

        editor = EditorPage(page)
        editor.goto(sample["id"])
        editor.type_mermaid("graph TD\n    A --> B")

        text = editor.get_mermaid_text()
        assert "A --> B" in text


class TestSave:
    """Save functionality via keyboard shortcut."""

    def test_ctrl_s_saves(self, seeded_page, server):
        """Draw on canvas, Cmd+S triggers save, SaveToast shows 'Saved'."""
        page = seeded_page
        sample = seed_samples(page, "blank_excalidraw")["blank_excalidraw"]

        editor = EditorPage(page)
        editor.goto(sample["id"])

        editor.draw_rectangle()
        page.keyboard.press("Meta+s")
        page.get_by_text("Saved").wait_for(timeout=5_000)

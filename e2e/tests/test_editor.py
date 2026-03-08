"""Tests for the editor page: drawing, typing, saving."""

import pytest
from pages import EditorPage
from helpers.seed import seed_samples, SAMPLES


class TestExcalidrawEditor:
    """Excalidraw canvas interactions."""

    def test_canvas_loads_with_seeded_data(self, seeded_page, server):
        page = seeded_page
        sample = seed_samples(page, "rectangle_excalidraw")["rectangle_excalidraw"]

        editor = EditorPage(page)
        editor.goto(sample["id"])
        assert editor.is_excalidraw()

    def test_draw_on_canvas(self, seeded_page, server):
        page = seeded_page
        sample = seed_samples(page, "blank_excalidraw")["blank_excalidraw"]

        editor = EditorPage(page)
        editor.goto(sample["id"])
        editor.draw_rectangle()

        # Give Excalidraw a moment to register the element
        page.wait_for_timeout(500)
        count = editor.excalidraw_element_count()
        assert count > 0, f"Expected elements after drawing, got {count}"


class TestMermaidEditor:
    """Mermaid textarea interactions."""

    def test_textarea_loads_with_seeded_data(self, seeded_page, server):
        page = seeded_page
        sample = seed_samples(page, "flowchart_mermaid")["flowchart_mermaid"]

        editor = EditorPage(page)
        editor.goto(sample["id"])
        assert editor.is_mermaid()

        text = editor.get_mermaid_text()
        assert "Start" in text

    def test_type_mermaid_code(self, seeded_page, server):
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
        page = seeded_page
        sample = seed_samples(page, "blank_excalidraw")["blank_excalidraw"]

        editor = EditorPage(page)
        editor.goto(sample["id"])

        # Draw something then save
        editor.draw_rectangle()
        page.keyboard.press("Meta+s")
        # SaveToast should briefly show "Saved"
        page.get_by_text("Saved").wait_for(timeout=5_000)

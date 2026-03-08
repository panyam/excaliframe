"""Tests for peer cursor visibility during collaboration."""

import pytest
from pages import EditorPage
from helpers.seed import seed_samples


pytestmark = [pytest.mark.collab, pytest.mark.slow]


class TestCollabCursors:
    """Verify that peer cursors are visible during collaboration."""

    def _setup_collab(self, owner_page, follower_page, server) -> tuple[EditorPage, EditorPage]:
        """Seed, share, join. Returns (owner_editor, follower_editor)."""
        owner_page.goto(server["url"] + "/about/")
        sample = seed_samples(owner_page, "blank_excalidraw")["blank_excalidraw"]

        owner_editor = EditorPage(owner_page)
        owner_editor.goto(sample["id"])
        owner_editor.toolbar.open()
        owner_editor.toolbar.click_share()
        owner_editor.share_panel.wait_for_visible()
        owner_editor.share_panel.start_sharing()
        owner_editor.share_panel.wait_for_connected()

        join_link = owner_editor.share_panel.get_join_link()

        follower_page.goto(join_link)
        follower_editor = EditorPage(follower_page)
        follower_editor.wait_for_loaded()

        # Wait for peer connection to stabilize
        owner_page.wait_for_timeout(2000)

        return owner_editor, follower_editor

    def test_owner_sees_follower_cursor(self, owner, follower, server):
        owner_editor, follower_editor = self._setup_collab(
            owner["page"], follower["page"], server
        )

        # Follower moves mouse over the canvas
        canvas = follower_editor.excalidraw_canvas()
        box = canvas.bounding_box()
        assert box is not None
        follower["page"].mouse.move(box["x"] + 200, box["y"] + 200)
        follower["page"].wait_for_timeout(500)
        follower["page"].mouse.move(box["x"] + 250, box["y"] + 250)

        # Owner should see collaborator cursors in Excalidraw's collaborator map
        owner["page"].wait_for_function(
            """() => {
                const api = window.__EXCALIDRAW_API__;
                if (!api) return false;
                const state = api.getAppState();
                return state.collaborators && state.collaborators.size > 0;
            }""",
            timeout=10_000,
        )

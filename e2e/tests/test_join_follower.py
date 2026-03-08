"""Tests for the follower join flow."""

import pytest
from pages import EditorPage, JoinPage
from helpers.seed import seed_samples


pytestmark = pytest.mark.collab


class TestFollowerJoin:
    """Follower joins via join link from owner."""

    def _owner_start_sharing(self, owner_page, server) -> str:
        """Helper: seed a drawing, start sharing, return join link."""
        owner_page.goto(server["url"] + "/about/")
        sample = seed_samples(owner_page, "blank_excalidraw")["blank_excalidraw"]

        editor = EditorPage(owner_page)
        editor.goto(sample["id"])
        editor.toolbar.open()
        editor.toolbar.click_share()
        editor.share_panel.wait_for_visible()
        editor.share_panel.start_sharing()
        editor.share_panel.wait_for_connected()
        return editor.share_panel.get_join_link()

    def test_join_via_link(self, owner, follower, server):
        join_link = self._owner_start_sharing(owner["page"], server)

        # Follower navigates to the join link
        follower_page = follower["page"]
        follower_page.goto(join_link)

        # Should redirect to editor page
        editor = EditorPage(follower_page)
        editor.wait_for_loaded()
        assert editor.is_excalidraw()

    def test_join_via_paste(self, owner, follower, server):
        join_link = self._owner_start_sharing(owner["page"], server)
        # Extract just the code from the full URL
        code = join_link.split("/join/")[1]

        follower_page = follower["page"]
        join_page = JoinPage(follower_page)
        join_page.goto()
        join_page.paste_code(code)

        # Should redirect to editor
        editor = EditorPage(follower_page)
        editor.wait_for_loaded()
        assert editor.is_excalidraw()

    def test_invalid_code_shows_error(self, follower, server):
        follower_page = follower["page"]
        join_page = JoinPage(follower_page)
        join_page.goto()
        join_page.paste_code("not-a-valid-code")

        assert join_page.has_error()

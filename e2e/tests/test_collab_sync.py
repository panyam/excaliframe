"""Tests for real-time collaboration sync between two profiles."""

import pytest
from pages import EditorPage, JoinPage
from helpers.seed import seed_samples


pytestmark = [pytest.mark.collab, pytest.mark.slow]


class TestCollabSync:
    """Two-profile tests: owner and follower see each other's changes."""

    def _setup_collab(self, owner_page, follower_page, server) -> tuple[EditorPage, EditorPage]:
        """Seed drawing, owner starts sharing, follower joins. Returns both editors."""
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

        owner_page.wait_for_timeout(2000)

        return owner_editor, follower_editor

    def test_owner_draws_follower_sees(self, owner, follower, server):
        """Owner draws rectangle, follower's scene has >0 non-deleted elements."""
        owner_editor, follower_editor = self._setup_collab(
            owner["page"], follower["page"], server
        )

        owner_editor.draw_rectangle()
        owner["page"].wait_for_timeout(1000)

        follower["page"].wait_for_function(
            """() => {
                const api = window.__EXCALIDRAW_API__;
                return api && api.getSceneElements().filter(e => !e.isDeleted).length > 0;
            }""",
            timeout=10_000,
        )
        assert follower_editor.excalidraw_element_count() > 0

    def test_follower_draws_owner_sees(self, owner, follower, server):
        """Follower draws rectangle, owner's scene updates with new element."""
        owner_editor, follower_editor = self._setup_collab(
            owner["page"], follower["page"], server
        )

        follower_editor.draw_rectangle()
        follower["page"].wait_for_timeout(1000)

        owner["page"].wait_for_function(
            """() => {
                const api = window.__EXCALIDRAW_API__;
                return api && api.getSceneElements().filter(e => !e.isDeleted).length > 0;
            }""",
            timeout=10_000,
        )
        assert owner_editor.excalidraw_element_count() > 0

    def test_peer_count_updates(self, owner, follower, server):
        """Owner shares, follower joins, owner sees 2 peers in peer list."""
        owner_editor, _ = self._setup_collab(
            owner["page"], follower["page"], server
        )

        owner["page"].wait_for_timeout(1000)
        assert owner_editor.share_panel.peer_count() >= 2

    def test_stop_sharing_disconnects_follower(self, owner, follower, server):
        """Owner stops sharing, follower's share panel no longer shows 'Connected'."""
        owner_editor, follower_editor = self._setup_collab(
            owner["page"], follower["page"], server
        )

        owner_editor.share_panel.stop_sharing()
        owner["page"].wait_for_timeout(2000)

        follower_editor.toolbar.open()
        follower_editor.toolbar.click_share()
        follower_editor.share_panel.wait_for_visible()
        assert not follower_editor.share_panel.is_connected_as_follower()

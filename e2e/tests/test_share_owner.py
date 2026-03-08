"""Tests for the owner sharing flow."""

import re
import pytest
from pages import EditorPage
from helpers.seed import seed_samples


pytestmark = pytest.mark.collab


class TestOwnerSharing:
    """Owner starts sharing, sees peer list, copies join link, stops."""

    def test_start_sharing(self, owner, server):
        """Open toolbar > Share > Start Sharing > status shows 'Sharing Active' with self in peer list."""
        page = owner["page"]
        page.goto(server["url"] + "/about/")
        sample = seed_samples(page, "blank_excalidraw")["blank_excalidraw"]

        editor = EditorPage(page)
        editor.goto(sample["id"])

        editor.toolbar.open()
        editor.toolbar.click_share()
        editor.share_panel.wait_for_visible()

        editor.share_panel.start_sharing()
        editor.share_panel.wait_for_connected()

        assert editor.share_panel.is_sharing_active()
        assert editor.share_panel.peer_count() >= 1

    def test_copy_join_link(self, owner, server):
        """Start sharing, copy join link, link contains /join/ with base64url:sessionId."""
        page = owner["page"]
        page.goto(server["url"] + "/about/")
        sample = seed_samples(page, "rectangle_excalidraw")["rectangle_excalidraw"]

        editor = EditorPage(page)
        editor.goto(sample["id"])

        editor.toolbar.open()
        editor.toolbar.click_share()
        editor.share_panel.wait_for_visible()
        editor.share_panel.start_sharing()
        editor.share_panel.wait_for_connected()

        join_link = editor.share_panel.get_join_link()
        assert "/join/" in join_link
        assert ":" in join_link.split("/join/")[1]

    def test_stop_sharing(self, owner, server):
        """Start sharing then stop, panel reverts to disconnected 'Share' state."""
        page = owner["page"]
        page.goto(server["url"] + "/about/")
        sample = seed_samples(page, "blank_excalidraw")["blank_excalidraw"]

        editor = EditorPage(page)
        editor.goto(sample["id"])

        editor.toolbar.open()
        editor.toolbar.click_share()
        editor.share_panel.wait_for_visible()
        editor.share_panel.start_sharing()
        editor.share_panel.wait_for_connected()

        editor.share_panel.stop_sharing()

        editor.share_panel.panel.get_by_text("Share", exact=True).wait_for(timeout=5_000)

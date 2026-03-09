"""Cross-browser collab smoke test: Chrome owner + Firefox follower.

Validates that the collab engine works across browser engines — the protocol
layer is browser-agnostic, but WebSocket handling and crypto APIs may differ.
"""

import pytest
from pages import EditorPage
from helpers.seed import seed_samples


pytestmark = [pytest.mark.collab, pytest.mark.cross_browser, pytest.mark.slow]


class TestCrossBrowserCollab:
    """Chrome owner + Firefox follower: share, join, draw, verify sync, stop."""

    def test_cross_browser_sync(self, owner, remote_follower, server):
        """Full collab lifecycle across Chrome and Firefox."""
        owner_page = owner["page"]
        follower_page = remote_follower["page"]

        # ── Seed a blank drawing ──
        owner_page.goto(server["url"] + "/about/")
        sample = seed_samples(owner_page, "blank_excalidraw")["blank_excalidraw"]

        # ── Owner opens editor and starts sharing ──
        owner_editor = EditorPage(owner_page)
        owner_editor.goto(sample["id"])
        owner_editor.toolbar.open()
        owner_editor.toolbar.click_share()
        owner_editor.share_panel.wait_for_visible()
        owner_editor.share_panel.start_sharing()
        owner_editor.share_panel.wait_for_connected()

        join_link = owner_editor.share_panel.get_join_link()

        # ── Follower (Firefox) joins ──
        follower_page.goto(join_link)
        follower_editor = EditorPage(follower_page)
        follower_editor.wait_for_loaded()

        # Wait for scene init sync
        owner_page.wait_for_timeout(2000)

        # ── Owner draws a rectangle ──
        owner_editor.draw_rectangle(200, 200, 100, 80)
        owner_page.wait_for_timeout(2000)

        # ── Follower should see elements ──
        follower_count = follower_editor.get_element_count()
        assert follower_count > 0, "Follower (Firefox) should see owner's drawing"

        # ── Owner stops sharing ──
        owner_editor.toolbar.open()
        owner_editor.toolbar.click_share()
        owner_editor.share_panel.stop_sharing()

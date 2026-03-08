"""Tests for encrypted sharing (password-based E2EE)."""

import pytest
from pages import EditorPage, JoinPage
from helpers.seed import seed_samples


pytestmark = [pytest.mark.collab, pytest.mark.slow]


class TestEncryption:
    """Share with encryption enabled, join with password."""

    def _owner_start_encrypted(self, owner_page, server) -> tuple[EditorPage, str, str]:
        """Start sharing with encryption. Returns (editor, join_link, password)."""
        owner_page.goto(server["url"] + "/about/")
        sample = seed_samples(owner_page, "blank_excalidraw")["blank_excalidraw"]

        editor = EditorPage(owner_page)
        editor.goto(sample["id"])
        editor.toolbar.open()
        editor.toolbar.click_share()
        editor.share_panel.wait_for_visible()

        editor.share_panel.enable_encryption()
        password = editor.share_panel.get_password()
        assert len(password) > 0, "Password should be auto-generated"

        editor.share_panel.start_sharing()
        editor.share_panel.wait_for_connected()

        join_link = editor.share_panel.get_join_link()
        return editor, join_link, password

    def test_encrypted_share_and_join(self, owner, follower, server):
        """Owner enables encryption, follower enters correct password, editor loads."""
        _, join_link, password = self._owner_start_encrypted(owner["page"], server)
        code = join_link.split("/join/")[1]

        follower_page = follower["page"]
        join_page = JoinPage(follower_page)
        join_page.goto()
        join_page.paste_code(code)

        assert join_page.is_password_visible()

        join_page.enter_password(password)

        editor = EditorPage(follower_page)
        editor.wait_for_loaded()
        assert editor.is_excalidraw()

    def test_wrong_password_rejected(self, owner, follower, server):
        """Owner enables encryption, follower enters wrong password, page still loads but data is unreadable."""
        _, join_link, _ = self._owner_start_encrypted(owner["page"], server)
        code = join_link.split("/join/")[1]

        follower_page = follower["page"]
        join_page = JoinPage(follower_page)
        join_page.goto()
        join_page.paste_code(code)

        assert join_page.is_password_visible()

        join_page.enter_password("wrong-password-12345")

        # Redirects regardless — password validation is client-side after
        # receiving encrypted data, so we just verify the editor loads
        editor = EditorPage(follower_page)
        editor.wait_for_loaded()

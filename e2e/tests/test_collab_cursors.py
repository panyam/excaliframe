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

        # Wait for collab connection to fully establish
        owner_page.wait_for_timeout(2000)

        return owner_editor, follower_editor

    def test_owner_sees_follower_cursor(self, owner, follower, server):
        """Follower moves pointer on canvas, owner's Excalidraw collaborator map has >0 entries."""
        owner_editor, follower_editor = self._setup_collab(
            owner["page"], follower["page"], server
        )

        # Click canvas first to ensure the window has focus, then move pointer.
        canvas = follower_editor.excalidraw_canvas()
        canvas.click()
        follower["page"].wait_for_timeout(300)

        # Dispatch pointermove events on the Excalidraw container.
        # Playwright's mouse.move() doesn't reliably trigger Excalidraw's
        # onPointerUpdate in headless mode, so we dispatch native PointerEvents
        # via JS which bubble through React's event delegation.
        follower["page"].evaluate("""() => {
            const excal = document.querySelector('.excalidraw');
            if (!excal) return;
            const rect = excal.getBoundingClientRect();
            for (let i = 0; i < 10; i++) {
                excal.dispatchEvent(new PointerEvent('pointermove', {
                    clientX: rect.left + 100 + i * 20,
                    clientY: rect.top + 100 + i * 20,
                    bubbles: true,
                    cancelable: true,
                    pointerType: 'mouse',
                    pointerId: 1,
                }));
            }
        }""")

        follower["page"].wait_for_timeout(2000)

        owner["page"].wait_for_function(
            """() => {
                const api = window.__EXCALIDRAW_API__;
                if (!api) return false;
                const state = api.getAppState();
                return state.collaborators && state.collaborators.size > 0;
            }""",
            timeout=10_000,
        )

"""V2 attachment storage tests against real Confluence.

Tests the full save/load cycle:
1. Insert Excalidraw macro on a Confluence page
2. Paste a large drawing
3. Save → verify V2 attachment flow via console logs + REST API
4. Re-edit → verify it loads from attachment
5. Clear, paste again, save again → verify second V2 cycle

Run:
    make confluence-test ACCOUNT=personal --create-page
    make confluence-test ACCOUNT=corporate K=test_save_triggers_v2
"""

import pytest
from helpers.confluence import (
    insert_excalidraw_macro,
    find_forge_editor_frame,
    paste_drawing_via_api,
    clear_canvas,
    element_count,
    save_macro,
    publish_page,
    get_attachments,
)


class TestV2SaveLoad:
    """V2 attachment storage: save, verify, reload, re-save."""

    def test_save_triggers_v2_attachment(self, confluence, test_page, drawing_fixture):
        """Insert macro, paste drawing, save → V2 attachment created."""
        page = confluence["page"]
        logs = confluence["logs"]
        account = confluence["account"]
        base_url = account["url"]
        drawing_json = drawing_fixture("large")

        # Insert macro into the page
        insert_excalidraw_macro(page)

        # Wait for Forge editor iframe
        frame = find_forge_editor_frame(page)

        # Paste the drawing
        paste_drawing_via_api(frame, drawing_json)
        page.wait_for_timeout(1000)

        # Verify elements loaded
        count = element_count(frame)
        assert count > 0, f"Expected elements after paste, got {count}"

        # Save
        save_macro(page)
        page.wait_for_timeout(3000)  # Give V2 upload time

        # Check console logs for V2 success
        v2_logs = [l for l in logs if "[V2-FORGE]" in l]
        v2_success = any("V2 success" in l for l in v2_logs)

        assert v2_success, (
            f"Expected V2 save success in console logs.\n"
            f"V2 logs found: {v2_logs}\n"
            f"All logs ({len(logs)}): {logs[-20:]}"
        )

        # Publish the page so we can check attachments
        publish_page(page)

        # Verify attachment exists via REST API
        page_id = test_page["page_id"]
        if page_id:
            attachments = get_attachments(page, base_url, page_id)
            excaliframe_attachments = [
                a for a in attachments
                if a.get("title", "").startswith("excaliframe-")
            ]
            assert len(excaliframe_attachments) > 0, (
                f"Expected excaliframe-*.json attachment on page {page_id}.\n"
                f"Attachments found: {[a.get('title') for a in attachments]}"
            )

    def test_reload_loads_from_v2(self, confluence, test_page, drawing_fixture):
        """After V2 save, re-editing loads drawing from attachment."""
        page = confluence["page"]
        logs = confluence["logs"]
        drawing_json = drawing_fixture("large")

        # Insert and save first (setup)
        insert_excalidraw_macro(page)
        frame = find_forge_editor_frame(page)
        paste_drawing_via_api(frame, drawing_json)
        page.wait_for_timeout(500)
        original_count = element_count(frame)
        save_macro(page)
        page.wait_for_timeout(3000)
        publish_page(page)

        # Clear logs for the reload phase
        logs.clear()

        # Edit the macro again (click on it in view mode)
        page.goto(test_page["page_url"])
        page.wait_for_load_state("networkidle")

        # Click the macro to enter edit mode
        # Forge macros render as blocks — click to select, then edit
        macro_block = page.locator(
            '[data-macro-name="excalidraw-macro"], '
            '[data-testid*="macro"], '
            'iframe[data-forge]'
        ).first
        macro_block.click()
        page.wait_for_timeout(1000)

        # Look for edit button
        edit_btn = page.locator(
            'button:has-text("Edit"), '
            'button[aria-label*="edit" i]'
        ).first
        if edit_btn.is_visible():
            edit_btn.click()

        # Wait for editor to load
        frame = find_forge_editor_frame(page)

        # Check V2 load logs
        v2_load_logs = [l for l in logs if "V2 detected" in l or "V2 attachment loaded" in l]
        assert len(v2_load_logs) > 0, (
            f"Expected V2 load logs on re-edit.\n"
            f"Logs: {[l for l in logs if 'V2' in l]}"
        )

        # Verify element count matches
        reloaded_count = element_count(frame)
        assert reloaded_count == original_count, (
            f"Element count mismatch: saved {original_count}, loaded {reloaded_count}"
        )

    def test_clear_and_resave_v2(self, confluence, test_page, drawing_fixture):
        """Clear canvas, paste new drawing, save again → V2 still works."""
        page = confluence["page"]
        logs = confluence["logs"]
        drawing_json = drawing_fixture("large")

        # Setup: insert, paste, save
        insert_excalidraw_macro(page)
        frame = find_forge_editor_frame(page)
        paste_drawing_via_api(frame, drawing_json)
        page.wait_for_timeout(500)
        save_macro(page)
        page.wait_for_timeout(3000)

        # Clear logs for the resave phase
        logs.clear()

        # Clear the canvas
        clear_canvas(frame)
        page.wait_for_timeout(500)
        assert element_count(frame) == 0, "Canvas should be empty after clear"

        # Paste again
        paste_drawing_via_api(frame, drawing_json)
        page.wait_for_timeout(500)
        assert element_count(frame) > 0, "Elements should be back after paste"

        # Save again
        save_macro(page)
        page.wait_for_timeout(3000)

        # Verify V2 success again
        v2_success = any("[V2-FORGE]" in l and "V2 success" in l for l in logs)
        assert v2_success, (
            f"Expected V2 save success on resave.\n"
            f"V2 logs: {[l for l in logs if 'V2' in l]}"
        )

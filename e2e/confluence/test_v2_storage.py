"""V2 attachment storage tests against real Confluence.

Tests the full save/load cycle:
1. Insert Excalidraw macro on a Confluence page
2. Paste a large drawing
3. Save → verify V2 attachment flow via console logs + REST API
4. Re-edit → verify it loads from attachment
5. Clear, paste again, save again → verify second V2 cycle

Run:
    # Existing page (no --create-page):
    E2E_CONFLUENCE_PAGE_URL="https://..." make confluence-test-debug ACCOUNT=personal

    # Fresh page each time:
    make confluence-test-debug ACCOUNT=personal
"""

import pytest
from helpers.confluence import (
    insert_excalidraw_macro,
    find_forge_editor_frame,
    paste_drawing_via_api,
    clear_canvas,
    element_count,
    save_macro,
    collect_iframe_logs,
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
        drawing_json = drawing_fixture("a3")

        # Insert macro into the page
        insert_excalidraw_macro(page)

        # Wait for Forge editor iframe (with console capture)
        frame = find_forge_editor_frame(page, logs=logs)

        # Paste the drawing
        paste_drawing_via_api(frame, drawing_json)
        page.wait_for_timeout(1000)

        # Verify elements loaded
        count = element_count(frame)
        assert count > 0, f"Expected elements after paste, got {count}"

        # Save — focus iframe first
        save_macro(frame, page)

        # After save, the Forge editor iframe closes (view.submit() closes the config panel).
        # We need to poll for logs before the frame disappears, and also check parent page logs.
        import time
        deadline = time.time() + 30
        v2_success = False
        v2_attempted = False
        v2_failed = False
        all_v2_logs = []

        while time.time() < deadline:
            page.wait_for_timeout(1000)

            # Try to collect iframe logs (frame may have closed)
            try:
                iframe_logs = collect_iframe_logs(frame)
                all_v2_logs.extend(l for l in iframe_logs if "V2" in l or "FORGE" in l or "Save" in l)
            except Exception:
                pass  # Frame closed — expected after successful save

            # Also check parent page logs (some V2 logs bubble up)
            new_page_logs = [l for l in logs if ("V2" in l or "FORGE" in l) and l not in all_v2_logs]
            all_v2_logs.extend(new_page_logs)

            if any("V2 success" in l for l in all_v2_logs):
                v2_success = True
                break
            if any("attempting V2 upload" in l for l in all_v2_logs):
                v2_attempted = True
            if any("V2 failed" in l or "fallback to V1" in l.lower() for l in all_v2_logs):
                v2_failed = True
                break

            # If the iframe closed and we saw the upload attempt, that's success —
            # view.submit() only fires after the upload completes
            if v2_attempted:
                try:
                    frame.url  # Check if frame is still alive
                except Exception:
                    # Frame closed after upload attempt = success
                    v2_success = True
                    break

        assert not v2_failed, f"V2 save failed or fell back to V1.\nV2 logs: {all_v2_logs}"
        assert v2_success or v2_attempted, (
            f"Expected V2 save in console logs.\n"
            f"V2 logs: {all_v2_logs}"
        )

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
        drawing_json = drawing_fixture("a3")

        # Insert and save first (setup)
        insert_excalidraw_macro(page)
        frame = find_forge_editor_frame(page, logs=logs)
        paste_drawing_via_api(frame, drawing_json)
        page.wait_for_timeout(500)
        original_count = element_count(frame)
        save_macro(frame, page)
        page.wait_for_timeout(5000)

        # Navigate back to view mode to re-edit
        page.goto(test_page["page_url"])
        page.wait_for_load_state("domcontentloaded")
        page.wait_for_timeout(3000)

        # Click the macro to enter edit mode
        # Forge macros render in iframes in view mode too
        macro_block = page.locator(
            '[data-macro-name="excalidraw-macro"], '
            '[data-testid*="macro"], '
            'iframe[data-forge], '
            '[data-extension-type="com.atlassian.ecosystem"]'
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

        # Wait for editor to load with log capture
        frame = find_forge_editor_frame(page, logs=logs)
        page.wait_for_timeout(2000)

        # Collect iframe logs
        iframe_logs = collect_iframe_logs(frame)
        all_logs = logs + iframe_logs

        # Check V2 load logs
        v2_load_logs = [l for l in all_logs if "V2 detected" in l or "V2 attachment loaded" in l]
        assert len(v2_load_logs) > 0, (
            f"Expected V2 load logs on re-edit.\n"
            f"V2 logs: {[l for l in all_logs if 'V2' in l]}\n"
            f"Iframe logs: {iframe_logs[-10:]}"
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
        drawing_json = drawing_fixture("a3")

        # Setup: insert, paste, save
        insert_excalidraw_macro(page)
        frame = find_forge_editor_frame(page, logs=logs)
        paste_drawing_via_api(frame, drawing_json)
        page.wait_for_timeout(500)
        save_macro(frame, page)
        page.wait_for_timeout(5000)

        # Drain logs from setup phase
        collect_iframe_logs(frame)

        # Clear the canvas
        clear_canvas(frame)
        page.wait_for_timeout(500)
        assert element_count(frame) == 0, "Canvas should be empty after clear"

        # Paste again
        paste_drawing_via_api(frame, drawing_json)
        page.wait_for_timeout(500)
        assert element_count(frame) > 0, "Elements should be back after paste"

        # Save again
        save_macro(frame, page)
        page.wait_for_timeout(5000)

        # Collect iframe logs and verify V2
        iframe_logs = collect_iframe_logs(frame)
        all_logs = logs + iframe_logs
        v2_success = any("V2 success" in l for l in all_logs)
        assert v2_success, (
            f"Expected V2 save success on resave.\n"
            f"V2 logs: {[l for l in all_logs if 'V2' in l]}\n"
            f"Iframe logs: {iframe_logs[-10:]}"
        )

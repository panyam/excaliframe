# E2E Tests

Browser-based end-to-end tests using Python + [pytest-playwright](https://playwright.dev/python/).

## Setup

```bash
make setup          # Install Python deps + Chromium browser
```

Requires [uv](https://docs.astral.sh/uv/) and Go (for the site server).

## Running Tests

```bash
make test           # Headless (CI default)
make test-headed    # Visible browser, 500ms slow-motion
make test-debug     # Playwright Inspector — step through every action
```

Run a single test or filter by keyword:

```bash
make test K=test_create_excalidraw
make test K=encryption
```

### Skip the build step

If the site is already built, skip the `make build` during server startup:

```bash
E2E_SKIP_BUILD=1 make test
```

## Listing Tests

```bash
make list           # All tests with descriptions
make list T=collab  # Filter by substring
make describe T=encryption  # Verbose: fixtures, file locations
```

## Debugging

### Step-through mode (`PWDEBUG=1`)

Opens the **Playwright Inspector** alongside the browser. It pauses before every action (click, fill, navigate) and shows Resume / Step Over buttons.

```bash
make test-debug                    # All tests
make test-debug K=test_start_sharing  # Single test
```

### Breakpoints in code

Drop `page.pause()` anywhere in a test to open the Inspector at that exact point:

```python
def test_something(self, seeded_page, server):
    editor = EditorPage(seeded_page)
    editor.goto(sample["id"])
    seeded_page.pause()  # Inspector opens here
    editor.draw_rectangle()
```

Only works in headed mode. Remove before committing.

### Trace viewer (post-mortem)

Record a full trace (DOM snapshots, network, console) and replay after the fact:

```bash
# Record traces on failure
cd e2e && uv run pytest --browser chromium --tracing=retain-on-failure --output=test-results

# Open the trace viewer
uv run playwright show-trace test-results/.../trace.zip
```

### Screenshots and video on failure

```bash
cd e2e && uv run pytest --browser chromium \
  --screenshot=only-on-failure \
  --video=retain-on-failure \
  --output=test-results
```

## Reports

```bash
make report         # Open the HTML report from the last run
```

To generate an HTML report:

```bash
cd e2e && uv run pytest --browser chromium --html=playwright-report/index.html --self-contained-html
```

## Test Structure

```
e2e/
├── conftest.py         # Fixtures: server lifecycle, profiles, IndexedDB seeding
├── list_tests.py       # Standalone test lister (AST-based, no pytest needed)
├── pages/              # Page Object Models
│   ├── listing.py      #   / — grid, search, new drawing modal
│   ├── detail.py       #   /playground/{id}/ — preview, edit
│   ├── editor.py       #   /playground/{id}/edit — canvas/textarea, save
│   ├── join.py         #   /join/{code} — paste code, password prompt
│   ├── toolbar.py      #   FloatingToolbar — gear menu
│   └── share_panel.py  #   SharePanel — relay, encrypt, peers
├── helpers/
│   ├── seed.py         # IndexedDB seeding + sample fixture catalog
│   ├── server.py       # Go server process manager
│   └── join_code.py    # Join code encode/decode
└── tests/
    ├── test_drawing_crud.py    # Create, list, delete drawings
    ├── test_editor.py          # Draw, type, save
    ├── test_share_owner.py     # Start/stop sharing, copy join link
    ├── test_join_follower.py   # Join via link/paste, invalid code
    ├── test_collab_sync.py     # Two profiles: draw ↔ see changes
    ├── test_collab_cursors.py  # Peer cursor visibility
    └── test_encryption.py      # Password-based E2EE flow
```

## Fixtures & Seeding

Tests seed IndexedDB with pre-built sample drawings. Pick samples by name:

```python
from helpers.seed import seed_samples, SAMPLES

def test_something(self, seeded_page, server):
    samples = seed_samples(seeded_page, "rectangle_excalidraw", "flowchart_mermaid")
    editor = EditorPage(seeded_page)
    editor.goto(samples["rectangle_excalidraw"]["id"])
```

Available samples: `blank_excalidraw`, `rectangle_excalidraw`, `multi_excalidraw`, `blank_mermaid`, `flowchart_mermaid`, `sequence_mermaid`, `complex_mermaid`.

### Multi-profile collab tests

Use the `owner` and `follower` fixtures for isolated browser contexts:

```python
def test_sync(self, owner, follower, server):
    owner_page = owner["page"]
    follower_page = follower["page"]
    # Each has separate localStorage, IndexedDB, cookies, WebSocket connections
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `E2E_PORT` | `9222` | Port for the Go dev server |
| `E2E_SKIP_BUILD` | `false` | Skip `make build` before starting the server |
| `E2E_PAUSE_END` | `0` | Seconds to pause after each test so you can see the final page state. Auto-set to `3` when `--headed` is used. Set to `0` to disable. |
| `E2E_WINDOW_W` | `700` | Browser window width in headed mode (collab tests) |
| `E2E_WINDOW_H` | `800` | Browser window height in headed mode (collab tests) |
| `E2E_WINDOW_X` | `0` | X offset for the owner window (follower is placed to the right) |
| `E2E_WINDOW_Y` | `0` | Y offset for both windows |
| `PWDEBUG` | unset | Set to `1` to open Playwright Inspector |

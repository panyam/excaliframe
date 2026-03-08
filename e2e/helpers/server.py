"""Go server process manager for E2E tests."""

import os
import signal
import subprocess
import time

import httpx


SITE_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "site")


def wait_for_server(url: str, timeout: float = 60) -> None:
    """Poll until the server responds with 200."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            r = httpx.get(url, timeout=2, follow_redirects=True)
            if r.status_code < 500:
                return
        except (httpx.ConnectError, httpx.ReadTimeout):
            pass
        time.sleep(0.5)
    raise TimeoutError(f"Server at {url} did not start within {timeout}s")


def start_server(port: int = 8080, build: bool = True) -> subprocess.Popen:
    """Build site assets and start the Go dev server.

    Returns the Popen handle. Caller is responsible for stopping it.
    """
    site_dir = os.path.abspath(SITE_DIR)

    if build:
        subprocess.run(
            ["make", "build"],
            cwd=site_dir,
            check=True,
            capture_output=True,
        )

    env = {**os.environ, "PORT": str(port), "EXCALIFRAME_ENV": "dev"}
    proc = subprocess.Popen(
        ["go", "run", "."],
        cwd=site_dir,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    try:
        wait_for_server(f"http://localhost:{port}", timeout=60)
    except Exception:
        proc.terminate()
        proc.wait(timeout=5)
        raise

    return proc


def stop_server(proc: subprocess.Popen) -> None:
    """Gracefully stop the server process."""
    if proc.poll() is not None:
        return
    proc.send_signal(signal.SIGTERM)
    try:
        proc.wait(timeout=10)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait(timeout=5)

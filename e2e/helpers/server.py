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


def _kill_port(port: int) -> None:
    """Kill any process listening on the given port."""
    try:
        result = subprocess.run(
            ["lsof", "-i", f":{port}", "-t"],
            capture_output=True, text=True, timeout=5,
        )
        for pid in result.stdout.strip().split("\n"):
            if pid:
                os.kill(int(pid), signal.SIGKILL)
        time.sleep(0.5)
    except (subprocess.TimeoutExpired, ProcessLookupError, ValueError):
        pass


def start_server(port: int = 8080, build: bool = True) -> subprocess.Popen:
    """Build site assets and start the Go dev server.

    Kills any stale process on the port first to avoid serving old bundles.
    Returns the Popen handle. Caller is responsible for stopping it.
    """
    _kill_port(port)

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

    # Verify our process is actually alive (not a stale server responding)
    if proc.poll() is not None:
        stderr = proc.stderr.read().decode() if proc.stderr else ""
        raise RuntimeError(
            f"Server process exited immediately (code {proc.returncode}). "
            f"Port {port} may have been in use.\nstderr: {stderr}"
        )

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

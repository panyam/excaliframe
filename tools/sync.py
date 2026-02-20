#!/usr/bin/env python3
"""
sync.py — Sync plugin-relevant files from excaliframe to an enterprise target.

Usage (called by Makefile):
    python3 tools/sync.py sync  <target_dir> [--dry-run]
    python3 tools/sync.py diff  <target_dir>
    python3 tools/sync.py status <target_dir>
"""

import difflib
import hashlib
import json
import os
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

# ── Colors ──────────────────────────────────────────────────────────────────

GREEN = "\033[0;32m"
YELLOW = "\033[1;33m"
RED = "\033[0;31m"
CYAN = "\033[0;36m"
BOLD = "\033[1m"
NC = "\033[0m"

# ── Allowlist of files/dirs to sync ─────────────────────────────────────────

ALLOWLIST = [
    "src/",
    "scripts/",
    "manifest.yml",
    "package.json",
    "package-lock.json",
    "webpack.config.js",
    "tsconfig.json",
    "Makefile",
    ".eslintignore",
    "LICENSE",
]

# Files within allowed dirs that are build output and should be excluded
IGNORELIST = [
    "src/version.ts",
]

# ── Globals ─────────────────────────────────────────────────────────────────

SOURCE_DIR = Path(__file__).resolve().parent.parent
STATE_DIR = SOURCE_DIR / ".excal-state"


# ── Helpers ─────────────────────────────────────────────────────────────────


def die(msg: str) -> None:
    print(f"{RED}Error: {msg}{NC}", file=sys.stderr)
    sys.exit(1)


def info(msg: str) -> None:
    print(f"{GREEN}{msg}{NC}")


def warn(msg: str) -> None:
    print(f"{YELLOW}{msg}{NC}")


def header(msg: str) -> None:
    print(f"{BOLD}{CYAN}{msg}{NC}")


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def is_interactive() -> bool:
    """Check if stdin is a terminal (not piped/redirected)."""
    try:
        return os.isatty(sys.stdin.fileno())
    except Exception:
        return False


def prompt_yn(question: str) -> bool:
    """Prompt user for y/n. Returns False if non-interactive."""
    if not is_interactive():
        return False
    try:
        confirm = input(f"{question} [y/N] ").strip()
        return confirm.lower() == "y"
    except (EOFError, KeyboardInterrupt):
        print()
        return False


def validate_target(target: str, mode: str, create_ok: bool = False) -> Path:
    if not target:
        die(f"TARGET is required. Set it via 'make {mode} TARGET=/path/to/target' or in .excalrc")

    target_path = Path(target).expanduser()

    if not target_path.is_dir():
        if create_ok:
            warn(f"Target directory does not exist: {target}")
            if prompt_yn("Create it?"):
                target_path.mkdir(parents=True, exist_ok=True)
                info(f"Created {target}")
            else:
                die("Aborted — target directory does not exist")
        else:
            die(f"Target directory does not exist: {target}")

    return target_path


def build_file_list() -> list[str]:
    """Build sorted list of files from the allowlist, relative to SOURCE_DIR."""
    ignore_set = set(IGNORELIST)
    files = []
    for item in ALLOWLIST:
        if item.endswith("/"):
            dir_path = SOURCE_DIR / item
            if dir_path.is_dir():
                for f in dir_path.rglob("*"):
                    if f.is_file():
                        rel = str(f.relative_to(SOURCE_DIR))
                        if rel not in ignore_set:
                            files.append(rel)
        else:
            file_path = SOURCE_DIR / item
            if file_path.is_file() and item not in ignore_set:
                files.append(item)
    return sorted(files)


def generate_manifest(base_dir: Path, files: list[str]) -> dict[str, str]:
    """Return {relative_path: sha256} for all existing files."""
    manifest = {}
    for f in files:
        full = base_dir / f
        if full.is_file():
            manifest[f] = sha256_file(full)
    return manifest


def save_manifest(manifest: dict[str, str], path: Path) -> None:
    with open(path, "w") as fh:
        for rel, sha in sorted(manifest.items()):
            fh.write(f"{sha}  {rel}\n")


def load_manifest(path: Path) -> dict[str, str]:
    manifest = {}
    if path.is_file():
        for line in path.read_text().splitlines():
            if "  " in line:
                sha, rel = line.split("  ", 1)
                manifest[rel] = sha
    return manifest


def git_short_rev() -> str:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=SOURCE_DIR,
            stderr=subprocess.DEVNULL,
        ).decode().strip()
    except Exception:
        return "unknown"


def save_state(target: Path, files: list[str]) -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)

    src_manifest = generate_manifest(SOURCE_DIR, files)
    save_manifest(src_manifest, STATE_DIR / "source-manifest.sha")

    tgt_manifest = generate_manifest(target, files)
    save_manifest(tgt_manifest, STATE_DIR / "target-manifest.sha")

    meta = {
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source_commit": git_short_rev(),
        "file_count": len(files),
    }
    (STATE_DIR / "last-sync.json").write_text(json.dumps(meta, indent=2) + "\n")


def check_target_modifications(target: Path, files: list[str]) -> None:
    """Warn and prompt if target files were modified since last sync."""
    manifest_path = STATE_DIR / "target-manifest.sha"
    if not manifest_path.is_file():
        return  # No prior sync

    old_target = load_manifest(manifest_path)
    modified = []

    for f in files:
        full = target / f
        if full.is_file():
            current_sha = sha256_file(full)
            old_sha = old_target.get(f)
            if old_sha and old_sha != current_sha:
                modified.append(f)

    if modified:
        print()
        warn("Warning: The following files were modified in the target since last sync:")
        for f in modified:
            print(f"  {YELLOW}{f}{NC}")
        print()
        if not prompt_yn("Overwrite target changes?"):
            die("Aborted — target has local modifications. Use 'make diff' to review.")


# ── Commands ────────────────────────────────────────────────────────────────


def cmd_sync(target_str: str, commit: bool = False, force: bool = False) -> None:
    target = validate_target(target_str, "sync", create_ok=commit)

    header(f"Syncing excaliframe -> {target}")
    print()

    files = build_file_list()
    if not files:
        die("No files matched the allowlist")

    if not commit:
        info("PREVIEW — files that would be synced (pass --commit to apply):")
        print()
        for f in files:
            src = SOURCE_DIR / f
            dst = target / f
            if not dst.is_file():
                print(f"  {GREEN}+ {f}{NC}")
            elif sha256_file(src) != sha256_file(dst):
                print(f"  {YELLOW}~ {f}{NC}")
            # skip unchanged files in preview
        print()
        info(f"Total: {len(files)} files in allowlist")
        return

    if not force:
        check_target_modifications(target, files)

    # Copy files
    copied = 0
    skipped = 0
    for f in files:
        src = SOURCE_DIR / f
        dst = target / f

        # Skip if identical
        if dst.is_file() and sha256_file(src) == sha256_file(dst):
            skipped += 1
            continue

        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        print(f"  {f}")
        copied += 1

    # Delete files in target that are within allowlisted dirs but not in source
    source_set = set(files)
    deleted = 0
    for item in ALLOWLIST:
        if item.endswith("/"):
            tgt_dir = target / item
            if tgt_dir.is_dir():
                for full in tgt_dir.rglob("*"):
                    if full.is_file():
                        rel = str(full.relative_to(target))
                        if rel not in source_set:
                            full.unlink()
                            print(f"  {RED}deleted: {rel}{NC}")
                            deleted += 1

    print()
    save_state(target, files)
    info(f"Sync complete — {copied} copied, {skipped} unchanged, {deleted} deleted ({len(files)} total)")

    print()
    warn("Reminder: Run 'npm run build' in the target to regenerate static assets.")

    if (target / "manifest.yml").is_file():
        warn("Reminder: Check that app.id in target's manifest.yml is correct for the enterprise app.")


def cmd_diff(target_str: str) -> None:
    target = validate_target(target_str, "diff")

    header(f"Diff: excaliframe <-> {target}")
    print()

    files = build_file_list()

    source_only = 0
    target_only = 0
    modified = 0
    identical = 0

    for f in files:
        src = SOURCE_DIR / f
        dst = target / f

        if src.is_file() and not dst.is_file():
            print(f"{GREEN}+ [source only] {f}{NC}")
            source_only += 1
        elif not src.is_file() and dst.is_file():
            print(f"{RED}- [target only] {f}{NC}")
            target_only += 1
        elif src.is_file() and dst.is_file():
            if sha256_file(src) != sha256_file(dst):
                print(f"{YELLOW}~ [modified]    {f}{NC}")
                # Show unified diff for text files
                try:
                    src_lines = src.read_text().splitlines(keepends=True)
                    dst_lines = dst.read_text().splitlines(keepends=True)
                    diff = difflib.unified_diff(
                        src_lines, dst_lines,
                        fromfile=f"source/{f}", tofile=f"target/{f}",
                    )
                    sys.stdout.writelines(diff)
                    print()
                except (UnicodeDecodeError, ValueError):
                    print(f"  (binary file differs)")
                    print()
                modified += 1
            else:
                identical += 1

    # Check for target-only files within allowlisted dirs
    source_set = set(files)
    for item in ALLOWLIST:
        if item.endswith("/"):
            tgt_dir = target / item
            if tgt_dir.is_dir():
                for full in tgt_dir.rglob("*"):
                    if full.is_file():
                        rel = str(full.relative_to(target))
                        if rel not in source_set:
                            print(f"{RED}- [target only] {rel}{NC}")
                            target_only += 1

    print()
    print("-------------------------------------------")
    if source_only or target_only or modified:
        print(f"  {GREEN}Source only: {source_only}{NC}  "
              f"{RED}Target only: {target_only}{NC}  "
              f"{YELLOW}Modified: {modified}{NC}  "
              f"Identical: {identical}")
    else:
        info("No differences — source and target are in sync.")


def cmd_status(target_str: str) -> None:
    target = validate_target(target_str, "status")

    last_sync_path = STATE_DIR / "last-sync.json"
    if not STATE_DIR.is_dir() or not last_sync_path.is_file():
        die("No sync state found. Run 'make sync' first.")

    header(f"Sync status: excaliframe <-> {target}")
    print()

    meta = json.loads(last_sync_path.read_text())
    print(f"Last sync: {meta.get('timestamp', '?')}")
    print(f"Commit:    {meta.get('source_commit', '?')}")
    print()

    files = build_file_list()

    old_source = load_manifest(STATE_DIR / "source-manifest.sha")
    old_target = load_manifest(STATE_DIR / "target-manifest.sha")

    source_changed = []
    target_changed = []
    conflicts = []

    for f in files:
        src_modified = False
        tgt_modified = False

        # Check source side
        src_path = SOURCE_DIR / f
        if src_path.is_file():
            current_sha = sha256_file(src_path)
            old_sha = old_source.get(f)
            if old_sha and old_sha != current_sha:
                src_modified = True
            elif old_sha is None:
                src_modified = True  # New file

        # Check target side
        tgt_path = target / f
        if tgt_path.is_file():
            current_sha = sha256_file(tgt_path)
            old_sha = old_target.get(f)
            if old_sha and old_sha != current_sha:
                tgt_modified = True
            elif old_sha is None:
                tgt_modified = True  # New file

        if src_modified and tgt_modified:
            conflicts.append(f)
        elif src_modified:
            source_changed.append(f)
        elif tgt_modified:
            target_changed.append(f)

    if source_changed:
        print(f"{GREEN}Source changed ({len(source_changed)}):{NC}")
        for f in source_changed:
            print(f"  {f}")
        print()

    if target_changed:
        print(f"{YELLOW}Target changed ({len(target_changed)}):{NC}")
        for f in target_changed:
            print(f"  {f}")
        print()

    if conflicts:
        print(f"{RED}Conflicts — both sides changed ({len(conflicts)}):{NC}")
        for f in conflicts:
            print(f"  {f}")
        print()

    if not source_changed and not target_changed and not conflicts:
        info("No changes since last sync.")


# ── Main ────────────────────────────────────────────────────────────────────

def main() -> None:
    if len(sys.argv) < 2:
        die("Usage: sync.py <sync|diff|status> <target> [--commit] [--force]")

    mode = sys.argv[1]
    # Filter out flags to get positional args
    args = [a for a in sys.argv[2:] if not a.startswith("--")]
    target = args[0] if args else ""
    commit = "--commit" in sys.argv
    force = "--force" in sys.argv

    if mode == "sync":
        cmd_sync(target, commit, force)
    elif mode == "diff":
        cmd_diff(target)
    elif mode == "status":
        cmd_status(target)
    else:
        die(f"Unknown mode: {mode}. Use: sync, diff, status")


if __name__ == "__main__":
    main()

"""Join code encoding/decoding helpers."""

import base64


def encode_join_code(relay_url: str, session_id: str) -> str:
    """Encode relay URL + session ID into a join code.

    Format: base64url(relayUrl):sessionId
    """
    b64 = base64.urlsafe_b64encode(relay_url.encode()).decode().rstrip("=")
    return f"{b64}:{session_id}"


def decode_join_code(code: str) -> tuple[str, str]:
    """Decode a join code into (relay_url, session_id)."""
    colon_idx = code.index(":")
    b64 = code[:colon_idx]
    session_id = code[colon_idx + 1 :]
    # Add back padding
    padding = 4 - len(b64) % 4
    if padding != 4:
        b64 += "=" * padding
    relay_url = base64.urlsafe_b64decode(b64).decode()
    return relay_url, session_id

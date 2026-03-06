package server

import (
	"encoding/base64"
	"testing"
)

func TestDecodeJoinCode_Valid(t *testing.T) {
	relay := "wss://example.com/relay"
	b64 := base64.RawURLEncoding.EncodeToString([]byte(relay))
	code := b64 + ":sess-123"

	relayUrl, sessionId, ok := decodeJoinCode(code)
	if !ok {
		t.Fatalf("expected ok=true")
	}
	if relayUrl != relay {
		t.Errorf("relayUrl = %q, want %q", relayUrl, relay)
	}
	if sessionId != "sess-123" {
		t.Errorf("sessionId = %q, want %q", sessionId, "sess-123")
	}
}

func TestDecodeJoinCode_NoColons(t *testing.T) {
	_, _, ok := decodeJoinCode("nocolons")
	if ok {
		t.Fatal("expected ok=false for no colons")
	}
}

func TestDecodeJoinCode_EmptySessionId(t *testing.T) {
	b64 := base64.RawURLEncoding.EncodeToString([]byte("ws://localhost/relay"))
	_, _, ok := decodeJoinCode(b64 + ":")
	if ok {
		t.Fatal("expected ok=false for empty sessionId")
	}
}

func TestDecodeJoinCode_InvalidBase64(t *testing.T) {
	_, _, ok := decodeJoinCode("!!!invalid:sess1")
	if ok {
		t.Fatal("expected ok=false for invalid base64")
	}
}

package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func newTestApp(t *testing.T) *RelayApp {
	t.Helper()
	app := NewRelayApp()
	if err := app.Init(); err != nil {
		t.Fatalf("app init error: %v", err)
	}
	return app
}

func TestHealthEndpoint(t *testing.T) {
	app := newTestApp(t)
	req := httptest.NewRequest("GET", "/health", nil)
	w := httptest.NewRecorder()
	app.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var body map[string]string
	json.NewDecoder(w.Body).Decode(&body)
	if body["status"] != "ok" {
		t.Fatalf("expected status ok, got %s", body["status"])
	}
}

func TestListRoomsEndpoint_Empty(t *testing.T) {
	app := newTestApp(t)
	req := httptest.NewRequest("GET", "/api/v1/rooms", nil)
	w := httptest.NewRecorder()
	app.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var body map[string]interface{}
	json.NewDecoder(w.Body).Decode(&body)
	rooms, ok := body["rooms"].([]interface{})
	if !ok {
		t.Fatal("expected rooms array in response")
	}
	if len(rooms) != 0 {
		t.Fatalf("expected empty rooms, got %d", len(rooms))
	}
}

func TestGetRoomEndpoint_NotFound(t *testing.T) {
	app := newTestApp(t)
	req := httptest.NewRequest("GET", "/api/v1/rooms/nonexistent", nil)
	w := httptest.NewRecorder()
	app.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

func TestCORSHeaders(t *testing.T) {
	app := newTestApp(t)
	req := httptest.NewRequest("OPTIONS", "/health", nil)
	w := httptest.NewRecorder()
	app.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 for OPTIONS, got %d", w.Code)
	}
	if w.Header().Get("Access-Control-Allow-Origin") != "*" {
		t.Fatal("expected CORS Allow-Origin: *")
	}
	if w.Header().Get("Access-Control-Allow-Methods") == "" {
		t.Fatal("expected CORS Allow-Methods header")
	}
}

func TestWSEndpoint_NoUpgrade(t *testing.T) {
	app := newTestApp(t)
	// Regular GET without WebSocket upgrade header
	req := httptest.NewRequest("GET", "/ws/v1/test-session/sync", nil)
	w := httptest.NewRecorder()
	app.ServeHTTP(w, req)

	// Should fail since no WebSocket upgrade
	if w.Code == http.StatusOK {
		t.Fatal("expected non-200 for non-WS request to WS endpoint")
	}
}

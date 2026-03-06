package services

import (
	"testing"

	pb "github.com/user/excaliframe/relay/gen/go/excaliframe/v1/models"
)

func newTestClient(id, username string) *CollabClient {
	return &CollabClient{
		ClientId:   id,
		Username:   username,
		Tool:       "excalidraw",
		ClientType: "browser",
		IsActive:   true,
		SendCh:     make(chan *pb.CollabEvent, 10),
	}
}

func TestRoom_AddClient(t *testing.T) {
	room := NewCollabRoom("sess1")
	c := newTestClient("c1", "Alice")
	room.AddClient(c)

	if _, ok := room.Clients["c1"]; !ok {
		t.Fatal("expected client c1 in room")
	}
}

func TestRoom_AddClient_DuplicateOverwrites(t *testing.T) {
	room := NewCollabRoom("sess1")
	c1 := newTestClient("c1", "Alice")
	c2 := newTestClient("c1", "Bob") // same ID, different name
	room.AddClient(c1)
	room.AddClient(c2)

	if room.Clients["c1"].Username != "Bob" {
		t.Fatal("expected duplicate to overwrite with Bob")
	}
	if room.ClientCount() != 1 {
		t.Fatal("expected count 1 after duplicate add")
	}
}

func TestRoom_RemoveClient(t *testing.T) {
	room := NewCollabRoom("sess1")
	c := newTestClient("c1", "Alice")
	room.AddClient(c)
	removed := room.RemoveClient("c1")

	if removed == nil {
		t.Fatal("expected removed client to be non-nil")
	}
	if removed.ClientId != "c1" {
		t.Fatalf("expected removed client c1, got %s", removed.ClientId)
	}
	if _, ok := room.Clients["c1"]; ok {
		t.Fatal("expected client c1 to be removed from room")
	}
}

func TestRoom_RemoveClient_Unknown(t *testing.T) {
	room := NewCollabRoom("sess1")
	removed := room.RemoveClient("nonexistent")
	if removed != nil {
		t.Fatal("expected nil for unknown client removal")
	}
}

func TestRoom_GetPeerInfo(t *testing.T) {
	room := NewCollabRoom("sess1")
	room.AddClient(newTestClient("c1", "Alice"))
	room.AddClient(newTestClient("c2", "Bob"))

	peers := room.GetPeerInfo()
	if len(peers) != 2 {
		t.Fatalf("expected 2 peers, got %d", len(peers))
	}

	found := map[string]bool{}
	for _, p := range peers {
		found[p.Username] = true
		if p.ClientType != "browser" {
			t.Fatalf("expected client_type browser, got %s", p.ClientType)
		}
	}
	if !found["Alice"] || !found["Bob"] {
		t.Fatal("expected Alice and Bob in peer info")
	}
}

func TestRoom_GetPeerInfo_Empty(t *testing.T) {
	room := NewCollabRoom("sess1")
	peers := room.GetPeerInfo()
	if peers == nil {
		t.Fatal("expected non-nil empty slice, not nil")
	}
	if len(peers) != 0 {
		t.Fatalf("expected 0 peers, got %d", len(peers))
	}
}

func TestRoom_IsEmpty(t *testing.T) {
	room := NewCollabRoom("sess1")
	if !room.IsEmpty() {
		t.Fatal("expected new room to be empty")
	}
	room.AddClient(newTestClient("c1", "Alice"))
	if room.IsEmpty() {
		t.Fatal("expected room with client to not be empty")
	}
	room.RemoveClient("c1")
	if !room.IsEmpty() {
		t.Fatal("expected room after remove to be empty")
	}
}

func TestRoom_ClientCount(t *testing.T) {
	room := NewCollabRoom("sess1")
	if room.ClientCount() != 0 {
		t.Fatalf("expected 0, got %d", room.ClientCount())
	}
	room.AddClient(newTestClient("c1", "Alice"))
	if room.ClientCount() != 1 {
		t.Fatalf("expected 1, got %d", room.ClientCount())
	}
	room.AddClient(newTestClient("c2", "Bob"))
	if room.ClientCount() != 2 {
		t.Fatalf("expected 2, got %d", room.ClientCount())
	}
	room.RemoveClient("c1")
	if room.ClientCount() != 1 {
		t.Fatalf("expected 1 after remove, got %d", room.ClientCount())
	}
}

func TestRoom_BroadcastToAll(t *testing.T) {
	room := NewCollabRoom("sess1")
	c1 := newTestClient("c1", "Alice")
	c2 := newTestClient("c2", "Bob")
	room.AddClient(c1)
	room.AddClient(c2)

	event := &pb.CollabEvent{EventId: "e1"}
	room.BroadcastToAll(event)

	// Both clients should receive
	select {
	case got := <-c1.SendCh:
		if got.EventId != "e1" {
			t.Fatalf("c1: expected event e1, got %s", got.EventId)
		}
	default:
		t.Fatal("c1: expected event, got nothing")
	}
	select {
	case got := <-c2.SendCh:
		if got.EventId != "e1" {
			t.Fatalf("c2: expected event e1, got %s", got.EventId)
		}
	default:
		t.Fatal("c2: expected event, got nothing")
	}
}

func TestRoom_BroadcastExcept(t *testing.T) {
	room := NewCollabRoom("sess1")
	c1 := newTestClient("c1", "Alice")
	c2 := newTestClient("c2", "Bob")
	c3 := newTestClient("c3", "Charlie")
	room.AddClient(c1)
	room.AddClient(c2)
	room.AddClient(c3)

	event := &pb.CollabEvent{EventId: "e1"}
	room.BroadcastExcept(event, "c2")

	// c1 and c3 should receive, c2 should not
	select {
	case <-c1.SendCh:
	default:
		t.Fatal("c1 should have received event")
	}
	select {
	case <-c3.SendCh:
	default:
		t.Fatal("c3 should have received event")
	}
	select {
	case <-c2.SendCh:
		t.Fatal("c2 should NOT have received event")
	default:
		// expected
	}
}

func TestRoom_BroadcastExcept_UnknownExclude(t *testing.T) {
	room := NewCollabRoom("sess1")
	c1 := newTestClient("c1", "Alice")
	room.AddClient(c1)

	event := &pb.CollabEvent{EventId: "e1"}
	room.BroadcastExcept(event, "nonexistent")

	select {
	case <-c1.SendCh:
	default:
		t.Fatal("c1 should have received event (unknown exclude)")
	}
}

func TestRoom_BroadcastToAll_FullChannel(t *testing.T) {
	room := NewCollabRoom("sess1")
	// Create client with tiny buffer (1)
	c := &CollabClient{
		ClientId: "c1",
		Username: "Alice",
		SendCh:   make(chan *pb.CollabEvent, 1),
	}
	room.AddClient(c)

	// Fill the channel
	c.SendCh <- &pb.CollabEvent{EventId: "fill"}

	// Should NOT block (non-blocking send)
	done := make(chan bool, 1)
	go func() {
		room.BroadcastToAll(&pb.CollabEvent{EventId: "overflow"})
		done <- true
	}()

	select {
	case <-done:
		// good, didn't block
	default:
		// Give it a moment
		select {
		case <-done:
		case <-make(chan struct{}):
			t.Fatal("BroadcastToAll blocked on full channel")
		}
	}
}

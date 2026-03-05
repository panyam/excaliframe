package services

import (
	"context"
	"sync"
	"testing"

	pb "github.com/user/excaliframe/relay/gen/go/excaliframe/v1/models"
)

func TestNewCollabService(t *testing.T) {
	svc := NewCollabService()
	if svc == nil {
		t.Fatal("expected non-nil service")
	}
	if svc.rooms == nil {
		t.Fatal("expected non-nil rooms map")
	}
	if len(svc.rooms) != 0 {
		t.Fatal("expected empty rooms map")
	}
}

func TestGetOrCreateRoom(t *testing.T) {
	svc := NewCollabService()
	room := svc.GetOrCreateRoom("sess1")
	if room == nil {
		t.Fatal("expected non-nil room")
	}
	if room.SessionId != "sess1" {
		t.Fatalf("expected session ID sess1, got %s", room.SessionId)
	}

	// Second call returns same room
	room2 := svc.GetOrCreateRoom("sess1")
	if room2 != room {
		t.Fatal("expected same room instance on second call")
	}
}

func TestGetOrCreateRoom_Concurrent(t *testing.T) {
	svc := NewCollabService()
	const n = 100
	rooms := make([]*CollabRoom, n)
	var wg sync.WaitGroup
	wg.Add(n)

	for i := 0; i < n; i++ {
		go func(idx int) {
			defer wg.Done()
			rooms[idx] = svc.GetOrCreateRoom("sess1")
		}(i)
	}
	wg.Wait()

	// All should be the same instance
	for i := 1; i < n; i++ {
		if rooms[i] != rooms[0] {
			t.Fatalf("goroutine %d got a different room instance", i)
		}
	}
}

func TestJoinRoom_FirstClient(t *testing.T) {
	svc := NewCollabService()
	ctx := context.Background()

	action := &pb.CollabAction{
		Action: &pb.CollabAction_Join{
			Join: &pb.JoinRoom{
				SessionId:  "sess1",
				Username:   "Alice",
				Tool:       "excalidraw",
				ClientType: "browser",
			},
		},
	}
	event, err := svc.HandleAction(ctx, action)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if event == nil {
		t.Fatal("expected non-nil event")
	}

	rj := event.GetRoomJoined()
	if rj == nil {
		t.Fatal("expected RoomJoined event")
	}
	if rj.ClientId == "" {
		t.Fatal("expected non-empty client ID")
	}
	if rj.SessionId != "sess1" {
		t.Fatalf("expected session sess1, got %s", rj.SessionId)
	}
	// First client joins an empty room — no existing peers
	if len(rj.Peers) != 0 {
		t.Fatalf("expected 0 peers for first client, got %d", len(rj.Peers))
	}
}

func TestJoinRoom_SecondClient(t *testing.T) {
	svc := NewCollabService()
	ctx := context.Background()

	// First client joins
	action1 := &pb.CollabAction{
		Action: &pb.CollabAction_Join{
			Join: &pb.JoinRoom{
				SessionId:  "sess1",
				Username:   "Alice",
				Tool:       "excalidraw",
				ClientType: "browser",
			},
		},
	}
	event1, err := svc.HandleAction(ctx, action1)
	if err != nil {
		t.Fatalf("first join error: %v", err)
	}
	clientId1 := event1.GetRoomJoined().GetClientId()

	// Second client joins
	action2 := &pb.CollabAction{
		Action: &pb.CollabAction_Join{
			Join: &pb.JoinRoom{
				SessionId:  "sess1",
				Username:   "Bob",
				Tool:       "excalidraw",
				ClientType: "browser",
			},
		},
	}
	event2, err := svc.HandleAction(ctx, action2)
	if err != nil {
		t.Fatalf("second join error: %v", err)
	}

	rj := event2.GetRoomJoined()
	if rj == nil {
		t.Fatal("expected RoomJoined event for second client")
	}
	if len(rj.Peers) != 1 {
		t.Fatalf("expected 1 existing peer, got %d", len(rj.Peers))
	}
	if rj.Peers[0].ClientId != clientId1 {
		t.Fatalf("expected peer to be client1 (%s), got %s", clientId1, rj.Peers[0].ClientId)
	}
	if rj.Peers[0].Username != "Alice" {
		t.Fatalf("expected peer username Alice, got %s", rj.Peers[0].Username)
	}
}

func TestJoinRoom_BroadcastsPeerJoined(t *testing.T) {
	svc := NewCollabService()
	ctx := context.Background()

	// First client joins
	action1 := &pb.CollabAction{
		Action: &pb.CollabAction_Join{
			Join: &pb.JoinRoom{
				SessionId: "sess1",
				Username:  "Alice",
				Tool:      "excalidraw",
			},
		},
	}
	event1, _ := svc.HandleAction(ctx, action1)
	clientId1 := event1.GetRoomJoined().GetClientId()

	// Get client1's send channel to watch for broadcasts
	room := svc.GetOrCreateRoom("sess1")
	client1 := room.Clients[clientId1]

	// Second client joins
	action2 := &pb.CollabAction{
		Action: &pb.CollabAction_Join{
			Join: &pb.JoinRoom{
				SessionId: "sess1",
				Username:  "Bob",
				Tool:      "excalidraw",
			},
		},
	}
	svc.HandleAction(ctx, action2)

	// Client1 should receive PeerJoined broadcast
	select {
	case evt := <-client1.SendCh:
		pj := evt.GetPeerJoined()
		if pj == nil {
			t.Fatal("expected PeerJoined event")
		}
		if pj.Peer.Username != "Bob" {
			t.Fatalf("expected peer Bob, got %s", pj.Peer.Username)
		}
	default:
		t.Fatal("client1 should have received PeerJoined broadcast")
	}
}

func TestJoinRoom_MissingUsername(t *testing.T) {
	svc := NewCollabService()
	ctx := context.Background()

	action := &pb.CollabAction{
		Action: &pb.CollabAction_Join{
			Join: &pb.JoinRoom{
				SessionId: "sess1",
				Username:  "",
			},
		},
	}
	_, err := svc.HandleAction(ctx, action)
	if err == nil {
		t.Fatal("expected error for empty username")
	}
}

func TestLeaveRoom(t *testing.T) {
	svc := NewCollabService()
	ctx := context.Background()

	// Two clients join
	joinAction := func(name string) string {
		action := &pb.CollabAction{
			Action: &pb.CollabAction_Join{
				Join: &pb.JoinRoom{SessionId: "sess1", Username: name, Tool: "excalidraw"},
			},
		}
		event, _ := svc.HandleAction(ctx, action)
		return event.GetRoomJoined().GetClientId()
	}
	clientId1 := joinAction("Alice")
	clientId2 := joinAction("Bob")

	// Drain PeerJoined from client1's channel
	<-svc.GetOrCreateRoom("sess1").Clients[clientId1].SendCh

	// Client2 leaves
	leaveAction := &pb.CollabAction{
		ClientId: clientId2,
		Action: &pb.CollabAction_Leave{
			Leave: &pb.LeaveRoom{Reason: "bye"},
		},
	}
	_, err := svc.HandleAction(ctx, leaveAction)
	if err != nil {
		t.Fatalf("leave error: %v", err)
	}

	// Client1 should receive PeerLeft
	room := svc.GetOrCreateRoom("sess1")
	select {
	case evt := <-room.Clients[clientId1].SendCh:
		pl := evt.GetPeerLeft()
		if pl == nil {
			t.Fatal("expected PeerLeft event")
		}
		if pl.ClientId != clientId2 {
			t.Fatalf("expected departed client %s, got %s", clientId2, pl.ClientId)
		}
		if pl.PeerCount != 1 {
			t.Fatalf("expected peer count 1, got %d", pl.PeerCount)
		}
	default:
		t.Fatal("client1 should have received PeerLeft")
	}
}

func TestLeaveRoom_LastClientCleansUp(t *testing.T) {
	svc := NewCollabService()
	ctx := context.Background()

	action := &pb.CollabAction{
		Action: &pb.CollabAction_Join{
			Join: &pb.JoinRoom{SessionId: "sess1", Username: "Alice", Tool: "excalidraw"},
		},
	}
	event, _ := svc.HandleAction(ctx, action)
	clientId := event.GetRoomJoined().GetClientId()

	leaveAction := &pb.CollabAction{
		ClientId: clientId,
		Action: &pb.CollabAction_Leave{
			Leave: &pb.LeaveRoom{Reason: "done"},
		},
	}
	svc.HandleAction(ctx, leaveAction)

	// Room should be cleaned up
	resp, err := svc.ListRooms(ctx, &pb.ListRoomsRequest{})
	if err != nil {
		t.Fatalf("ListRooms error: %v", err)
	}
	if len(resp.Rooms) != 0 {
		t.Fatalf("expected 0 rooms after last client leaves, got %d", len(resp.Rooms))
	}
}

func TestLeaveRoom_NonexistentClient(t *testing.T) {
	svc := NewCollabService()
	ctx := context.Background()

	// Create room with one client
	action := &pb.CollabAction{
		Action: &pb.CollabAction_Join{
			Join: &pb.JoinRoom{SessionId: "sess1", Username: "Alice", Tool: "excalidraw"},
		},
	}
	svc.HandleAction(ctx, action)

	leaveAction := &pb.CollabAction{
		ClientId: "nonexistent",
		Action: &pb.CollabAction_Leave{
			Leave: &pb.LeaveRoom{Reason: "ghost"},
		},
	}
	_, err := svc.HandleAction(ctx, leaveAction)
	if err == nil {
		t.Fatal("expected error for nonexistent client leave")
	}
}

func TestPresenceUpdate(t *testing.T) {
	svc := NewCollabService()
	ctx := context.Background()

	// Two clients join
	joinAction := func(name string) string {
		action := &pb.CollabAction{
			Action: &pb.CollabAction_Join{
				Join: &pb.JoinRoom{SessionId: "sess1", Username: name, Tool: "excalidraw"},
			},
		}
		event, _ := svc.HandleAction(ctx, action)
		return event.GetRoomJoined().GetClientId()
	}
	clientId1 := joinAction("Alice")
	clientId2 := joinAction("Bob")

	// Drain PeerJoined from client1
	<-svc.GetOrCreateRoom("sess1").Clients[clientId1].SendCh

	// Client2 sends presence update
	presAction := &pb.CollabAction{
		ClientId: clientId2,
		Action: &pb.CollabAction_Presence{
			Presence: &pb.PresenceUpdate{IsActive: false, Username: "Bob"},
		},
	}
	_, err := svc.HandleAction(ctx, presAction)
	if err != nil {
		t.Fatalf("presence update error: %v", err)
	}

	// Client1 should receive presence broadcast
	room := svc.GetOrCreateRoom("sess1")
	select {
	case evt := <-room.Clients[clientId1].SendCh:
		p := evt.GetPresence()
		if p == nil {
			t.Fatal("expected PresenceUpdate event")
		}
		if p.IsActive != false {
			t.Fatal("expected IsActive=false")
		}
	default:
		t.Fatal("client1 should have received presence update")
	}
}

func TestGetRoom(t *testing.T) {
	svc := NewCollabService()
	ctx := context.Background()

	// Join a room
	action := &pb.CollabAction{
		Action: &pb.CollabAction_Join{
			Join: &pb.JoinRoom{SessionId: "sess1", Username: "Alice", Tool: "excalidraw"},
		},
	}
	svc.HandleAction(ctx, action)

	resp, err := svc.GetRoom(ctx, &pb.GetRoomRequest{SessionId: "sess1"})
	if err != nil {
		t.Fatalf("GetRoom error: %v", err)
	}
	if resp.SessionId != "sess1" {
		t.Fatalf("expected session sess1, got %s", resp.SessionId)
	}
	if len(resp.Peers) != 1 {
		t.Fatalf("expected 1 peer, got %d", len(resp.Peers))
	}
	if resp.Peers[0].Username != "Alice" {
		t.Fatalf("expected username Alice, got %s", resp.Peers[0].Username)
	}
}

func TestGetRoom_Nonexistent(t *testing.T) {
	svc := NewCollabService()
	ctx := context.Background()

	_, err := svc.GetRoom(ctx, &pb.GetRoomRequest{SessionId: "nonexistent"})
	if err == nil {
		t.Fatal("expected error for nonexistent room")
	}
}

func TestListRooms(t *testing.T) {
	svc := NewCollabService()
	ctx := context.Background()

	// Create two rooms with clients
	for _, sess := range []string{"sess1", "sess2"} {
		action := &pb.CollabAction{
			Action: &pb.CollabAction_Join{
				Join: &pb.JoinRoom{SessionId: sess, Username: "User", Tool: "excalidraw"},
			},
		}
		svc.HandleAction(ctx, action)
	}

	resp, err := svc.ListRooms(ctx, &pb.ListRoomsRequest{})
	if err != nil {
		t.Fatalf("ListRooms error: %v", err)
	}
	if len(resp.Rooms) != 2 {
		t.Fatalf("expected 2 rooms, got %d", len(resp.Rooms))
	}
}

func TestListRooms_Empty(t *testing.T) {
	svc := NewCollabService()
	ctx := context.Background()

	resp, err := svc.ListRooms(ctx, &pb.ListRoomsRequest{})
	if err != nil {
		t.Fatalf("ListRooms error: %v", err)
	}
	if resp.Rooms == nil {
		t.Fatal("expected non-nil rooms slice")
	}
	if len(resp.Rooms) != 0 {
		t.Fatalf("expected 0 rooms, got %d", len(resp.Rooms))
	}
}

func TestHandleAction_NilAction(t *testing.T) {
	svc := NewCollabService()
	ctx := context.Background()

	_, err := svc.HandleAction(ctx, &pb.CollabAction{})
	if err == nil {
		t.Fatal("expected error for empty action (no oneof set)")
	}
}

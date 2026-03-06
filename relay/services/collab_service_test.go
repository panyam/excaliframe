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

func TestJoinRoom_EmptyUsernameDefaultsToAnonymous(t *testing.T) {
	svc := NewCollabService()
	ctx := context.Background()

	action := &pb.CollabAction{
		Action: &pb.CollabAction_Join{
			Join: &pb.JoinRoom{
				SessionId: "sess1",
				Username:  "",
				Tool:      "excalidraw",
			},
		},
	}
	event, err := svc.HandleAction(ctx, action)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	rj := event.GetRoomJoined()
	if rj == nil {
		t.Fatal("expected RoomJoined event")
	}
	// Verify the client was stored with "Anonymous" username
	room := svc.GetOrCreateRoom("sess1")
	client := room.Clients[rj.ClientId]
	if client.Username != "Anonymous" {
		t.Fatalf("expected username 'Anonymous', got %s", client.Username)
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

// ─── Broadcast tests ──────────────────────────

func TestBroadcastSceneUpdate(t *testing.T) {
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

	// Client2 sends SceneUpdate
	sceneAction := &pb.CollabAction{
		ClientId: clientId2,
		Action: &pb.CollabAction_SceneUpdate{
			SceneUpdate: &pb.SceneUpdate{
				Elements: []*pb.ElementUpdate{
					{Id: "el-1", Version: 1, VersionNonce: 100, Data: `{"type":"rect"}`, Deleted: false},
				},
			},
		},
	}
	result, err := svc.HandleAction(ctx, sceneAction)
	if err != nil {
		t.Fatalf("broadcast error: %v", err)
	}
	// handleBroadcast returns nil event (no direct response)
	if result != nil {
		t.Fatal("expected nil response for broadcast action")
	}

	// Client1 should receive the SceneUpdate event
	room := svc.GetOrCreateRoom("sess1")
	select {
	case evt := <-room.Clients[clientId1].SendCh:
		su := evt.GetSceneUpdate()
		if su == nil {
			t.Fatal("expected SceneUpdate event")
		}
		if len(su.Elements) != 1 {
			t.Fatalf("expected 1 element, got %d", len(su.Elements))
		}
		if su.Elements[0].Id != "el-1" {
			t.Fatalf("expected element id el-1, got %s", su.Elements[0].Id)
		}
		if evt.FromClientId != clientId2 {
			t.Fatalf("expected fromClientId %s, got %s", clientId2, evt.FromClientId)
		}
	default:
		t.Fatal("client1 should have received SceneUpdate broadcast")
	}

	// Client2 should NOT receive its own broadcast
	select {
	case <-room.Clients[clientId2].SendCh:
		t.Fatal("client2 should NOT receive its own broadcast")
	default:
		// OK
	}
}

func TestBroadcastTextUpdate(t *testing.T) {
	svc := NewCollabService()
	ctx := context.Background()

	joinAction := func(name string) string {
		action := &pb.CollabAction{
			Action: &pb.CollabAction_Join{
				Join: &pb.JoinRoom{SessionId: "sess1", Username: name, Tool: "mermaid"},
			},
		}
		event, _ := svc.HandleAction(ctx, action)
		return event.GetRoomJoined().GetClientId()
	}
	clientId1 := joinAction("Alice")
	clientId2 := joinAction("Bob")

	<-svc.GetOrCreateRoom("sess1").Clients[clientId1].SendCh

	textAction := &pb.CollabAction{
		ClientId: clientId2,
		Action: &pb.CollabAction_TextUpdate{
			TextUpdate: &pb.TextUpdate{Text: "flowchart TD", Version: 1},
		},
	}
	_, err := svc.HandleAction(ctx, textAction)
	if err != nil {
		t.Fatalf("broadcast error: %v", err)
	}

	room := svc.GetOrCreateRoom("sess1")
	select {
	case evt := <-room.Clients[clientId1].SendCh:
		tu := evt.GetTextUpdate()
		if tu == nil {
			t.Fatal("expected TextUpdate event")
		}
		if tu.Text != "flowchart TD" {
			t.Fatalf("expected text 'flowchart TD', got %s", tu.Text)
		}
	default:
		t.Fatal("client1 should have received TextUpdate broadcast")
	}
}

func TestBroadcastSceneInitRequest(t *testing.T) {
	svc := NewCollabService()
	ctx := context.Background()

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

	<-svc.GetOrCreateRoom("sess1").Clients[clientId1].SendCh

	initReqAction := &pb.CollabAction{
		ClientId: clientId2,
		Action: &pb.CollabAction_SceneInitRequest{
			SceneInitRequest: &pb.SceneInitRequest{},
		},
	}
	_, err := svc.HandleAction(ctx, initReqAction)
	if err != nil {
		t.Fatalf("broadcast error: %v", err)
	}

	room := svc.GetOrCreateRoom("sess1")
	select {
	case evt := <-room.Clients[clientId1].SendCh:
		if evt.GetSceneInitRequest() == nil {
			t.Fatal("expected SceneInitRequest event")
		}
	default:
		t.Fatal("client1 should have received SceneInitRequest broadcast")
	}
}

func TestBroadcast_NonexistentClient(t *testing.T) {
	svc := NewCollabService()
	ctx := context.Background()

	// Join so room exists
	svc.HandleAction(ctx, &pb.CollabAction{
		Action: &pb.CollabAction_Join{
			Join: &pb.JoinRoom{SessionId: "sess1", Username: "Alice", Tool: "excalidraw"},
		},
	})

	// Try to broadcast from unknown client
	action := &pb.CollabAction{
		ClientId: "ghost",
		Action: &pb.CollabAction_SceneUpdate{
			SceneUpdate: &pb.SceneUpdate{},
		},
	}
	_, err := svc.HandleAction(ctx, action)
	if err == nil {
		t.Fatal("expected error for nonexistent client broadcast")
	}
}

func TestFindRoomForClient(t *testing.T) {
	svc := NewCollabService()
	ctx := context.Background()

	event, _ := svc.HandleAction(ctx, &pb.CollabAction{
		Action: &pb.CollabAction_Join{
			Join: &pb.JoinRoom{SessionId: "sess1", Username: "Alice", Tool: "excalidraw"},
		},
	})
	clientId := event.GetRoomJoined().GetClientId()

	room := svc.findRoomForClient(clientId)
	if room == nil {
		t.Fatal("expected to find room for client")
	}
	if room.SessionId != "sess1" {
		t.Fatalf("expected session sess1, got %s", room.SessionId)
	}

	// Unknown client
	if svc.findRoomForClient("nonexistent") != nil {
		t.Fatal("expected nil for unknown client")
	}
}

// ─── Owner lifecycle tests ──────────────────────────

func joinAsOwner(svc *CollabService, ctx context.Context, sessionId, username, browserId string) (string, error) {
	action := &pb.CollabAction{
		Action: &pb.CollabAction_Join{
			Join: &pb.JoinRoom{
				SessionId: sessionId,
				Username:  username,
				Tool:      "excalidraw",
				IsOwner:   true,
				BrowserId: browserId,
			},
		},
	}
	event, err := svc.HandleAction(ctx, action)
	if err != nil {
		return "", err
	}
	return event.GetRoomJoined().GetClientId(), nil
}

func joinAsFollower(svc *CollabService, ctx context.Context, sessionId, username, browserId string) (string, error) {
	action := &pb.CollabAction{
		Action: &pb.CollabAction_Join{
			Join: &pb.JoinRoom{
				SessionId: sessionId,
				Username:  username,
				Tool:      "excalidraw",
				IsOwner:   false,
				BrowserId: browserId,
			},
		},
	}
	event, err := svc.HandleAction(ctx, action)
	if err != nil {
		return "", err
	}
	return event.GetRoomJoined().GetClientId(), nil
}

func leaveRoom(svc *CollabService, ctx context.Context, clientId string) error {
	_, err := svc.HandleAction(ctx, &pb.CollabAction{
		ClientId: clientId,
		Action: &pb.CollabAction_Leave{
			Leave: &pb.LeaveRoom{Reason: "disconnect"},
		},
	})
	return err
}

func TestOwnerJoin_SetsOwnership(t *testing.T) {
	svc := NewCollabService()
	ctx := context.Background()

	clientId, err := joinAsOwner(svc, ctx, "sess1", "Alice", "browser-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	room := svc.GetOrCreateRoom("sess1")
	if room.OwnerClientId != clientId {
		t.Fatalf("expected OwnerClientId %s, got %s", clientId, room.OwnerClientId)
	}
	if room.OwnerBrowserId != "browser-1" {
		t.Fatalf("expected OwnerBrowserId browser-1, got %s", room.OwnerBrowserId)
	}
}

func TestOwnerJoin_RoomJoinedIncludesOwnerClientId(t *testing.T) {
	svc := NewCollabService()
	ctx := context.Background()

	ownerClientId, _ := joinAsOwner(svc, ctx, "sess1", "Alice", "browser-1")

	// Second client joins — RoomJoined should include owner_client_id
	event, err := svc.HandleAction(ctx, &pb.CollabAction{
		Action: &pb.CollabAction_Join{
			Join: &pb.JoinRoom{SessionId: "sess1", Username: "Bob", Tool: "excalidraw"},
		},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	rj := event.GetRoomJoined()
	if rj.OwnerClientId != ownerClientId {
		t.Fatalf("expected owner_client_id %s, got %s", ownerClientId, rj.OwnerClientId)
	}
}

func TestOwnerJoin_DifferentBrowserRejected(t *testing.T) {
	svc := NewCollabService()
	ctx := context.Background()

	_, err := joinAsOwner(svc, ctx, "sess1", "Alice", "browser-1")
	if err != nil {
		t.Fatalf("first owner join failed: %v", err)
	}

	// Different browser tries to claim ownership
	_, err = joinAsOwner(svc, ctx, "sess1", "Bob", "browser-2")
	if err == nil {
		t.Fatal("expected error for second owner from different browser")
	}
}

func TestOwnerJoin_SameBrowserAllowed(t *testing.T) {
	svc := NewCollabService()
	ctx := context.Background()

	_, err := joinAsOwner(svc, ctx, "sess1", "Alice", "browser-1")
	if err != nil {
		t.Fatalf("first owner join failed: %v", err)
	}

	// Same browser, second tab — should be allowed
	clientId2, err := joinAsOwner(svc, ctx, "sess1", "Alice Tab 2", "browser-1")
	if err != nil {
		t.Fatalf("same-browser second tab should be allowed: %v", err)
	}
	if clientId2 == "" {
		t.Fatal("expected valid client ID for second tab")
	}
}

func TestOwnerLeave_TransfersToSameBrowserTab(t *testing.T) {
	svc := NewCollabService()
	ctx := context.Background()

	ownerId, _ := joinAsOwner(svc, ctx, "sess1", "Alice Tab 1", "browser-1")
	tab2Id, _ := joinAsOwner(svc, ctx, "sess1", "Alice Tab 2", "browser-1")
	followerId, _ := joinAsFollower(svc, ctx, "sess1", "Bob", "browser-2")

	// Drain PeerJoined broadcasts
	room := svc.GetOrCreateRoom("sess1")
	drainCh(room.Clients[ownerId].SendCh)
	drainCh(room.Clients[tab2Id].SendCh)
	drainCh(room.Clients[followerId].SendCh)

	// Owner leaves
	leaveRoom(svc, ctx, ownerId)

	// Tab2 should receive OwnerChanged
	evt := <-room.Clients[tab2Id].SendCh
	oc := evt.GetOwnerChanged()
	if oc == nil {
		t.Fatal("expected OwnerChanged event for tab2")
	}
	if oc.NewOwnerClientId != tab2Id {
		t.Fatalf("expected new owner %s, got %s", tab2Id, oc.NewOwnerClientId)
	}

	// Follower should also receive OwnerChanged
	evt2 := <-room.Clients[followerId].SendCh
	if evt2.GetOwnerChanged() == nil {
		t.Fatal("expected OwnerChanged event for follower")
	}

	// Room should still have owner set to tab2
	if room.OwnerClientId != tab2Id {
		t.Fatalf("expected room owner to be %s, got %s", tab2Id, room.OwnerClientId)
	}
}

func TestOwnerLeave_NoSameBrowser_SessionEnded(t *testing.T) {
	svc := NewCollabService()
	ctx := context.Background()

	ownerId, _ := joinAsOwner(svc, ctx, "sess1", "Alice", "browser-1")
	followerId, _ := joinAsFollower(svc, ctx, "sess1", "Bob", "browser-2")

	// Drain PeerJoined broadcasts
	room := svc.GetOrCreateRoom("sess1")
	drainCh(room.Clients[ownerId].SendCh)
	drainCh(room.Clients[followerId].SendCh)

	// Capture follower channel before owner leaves (room.CloseAllClients will close it)
	followerCh := room.Clients[followerId].SendCh

	// Owner leaves — no same-browser client
	leaveRoom(svc, ctx, ownerId)

	// Follower should receive SessionEnded
	evt := <-followerCh
	se := evt.GetSessionEnded()
	if se == nil {
		t.Fatal("expected SessionEnded event for follower")
	}
	if se.Reason != "owner_disconnected" {
		t.Fatalf("expected reason 'owner_disconnected', got %s", se.Reason)
	}

	// Room should be removed
	resp, _ := svc.ListRooms(ctx, &pb.ListRoomsRequest{})
	if len(resp.Rooms) != 0 {
		t.Fatalf("expected 0 rooms after session ended, got %d", len(resp.Rooms))
	}
}

func TestNonOwnerLeave_NormalPeerLeftBehavior(t *testing.T) {
	svc := NewCollabService()
	ctx := context.Background()

	ownerId, _ := joinAsOwner(svc, ctx, "sess1", "Alice", "browser-1")
	followerId, _ := joinAsFollower(svc, ctx, "sess1", "Bob", "browser-2")

	room := svc.GetOrCreateRoom("sess1")
	drainCh(room.Clients[ownerId].SendCh)

	// Follower leaves — normal PeerLeft, no session end
	leaveRoom(svc, ctx, followerId)

	evt := <-room.Clients[ownerId].SendCh
	pl := evt.GetPeerLeft()
	if pl == nil {
		t.Fatal("expected PeerLeft event")
	}
	if pl.ClientId != followerId {
		t.Fatalf("expected departed client %s, got %s", followerId, pl.ClientId)
	}

	// Room should still exist with owner
	if room.OwnerClientId != ownerId {
		t.Fatalf("owner should still be %s", ownerId)
	}
}

func TestGetRoom_IncludesOwnerClientId(t *testing.T) {
	svc := NewCollabService()
	ctx := context.Background()

	ownerId, _ := joinAsOwner(svc, ctx, "sess1", "Alice", "browser-1")

	resp, err := svc.GetRoom(ctx, &pb.GetRoomRequest{SessionId: "sess1"})
	if err != nil {
		t.Fatalf("GetRoom error: %v", err)
	}
	if resp.OwnerClientId != ownerId {
		t.Fatalf("expected owner_client_id %s, got %s", ownerId, resp.OwnerClientId)
	}
}

func TestGetRoom_PeerInfoIncludesIsOwner(t *testing.T) {
	svc := NewCollabService()
	ctx := context.Background()

	joinAsOwner(svc, ctx, "sess1", "Alice", "browser-1")
	joinAsFollower(svc, ctx, "sess1", "Bob", "browser-2")

	resp, err := svc.GetRoom(ctx, &pb.GetRoomRequest{SessionId: "sess1"})
	if err != nil {
		t.Fatalf("GetRoom error: %v", err)
	}

	ownerCount := 0
	for _, p := range resp.Peers {
		if p.IsOwner {
			ownerCount++
			if p.Username != "Alice" {
				t.Fatalf("expected owner to be Alice, got %s", p.Username)
			}
		}
	}
	if ownerCount != 1 {
		t.Fatalf("expected exactly 1 owner in peers, got %d", ownerCount)
	}
}

// drainCh reads all pending messages from a channel (non-blocking).
func drainCh(ch chan *pb.CollabEvent) {
	for {
		select {
		case <-ch:
		default:
			return
		}
	}
}

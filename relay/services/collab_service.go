package services

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	pb "github.com/user/excaliframe/relay/gen/go/excaliframe/v1/models"
)

// CollabRoom holds the state for a single collaboration session.
type CollabRoom struct {
	SessionId      string
	Clients        map[string]*CollabClient
	Created        time.Time
	OwnerClientId  string
	OwnerBrowserId string
	Tool           string // "excalidraw" | "mermaid" — set from first joiner
	mu             sync.RWMutex
}

// CollabClient represents a connected peer in a room.
type CollabClient struct {
	ClientId   string
	SessionId  string
	Username   string
	Tool       string
	ClientType string
	AvatarUrl  string
	IsActive   bool
	IsOwner    bool
	BrowserId  string
	SendCh     chan *pb.CollabEvent
}

// CollabService manages rooms and peer lifecycle.
type CollabService struct {
	rooms     map[string]*CollabRoom
	hintIndex map[string]string // client_hint → sessionId (for session reuse)
	mu        sync.RWMutex
}

// NewCollabService creates a new CollabService.
func NewCollabService() *CollabService {
	return &CollabService{
		rooms:     make(map[string]*CollabRoom),
		hintIndex: make(map[string]string),
	}
}

// GetOrCreateRoom returns the room for sessionId, creating it if needed.
func (s *CollabService) GetOrCreateRoom(sessionId string) *CollabRoom {
	s.mu.Lock()
	defer s.mu.Unlock()
	room, ok := s.rooms[sessionId]
	if !ok {
		room = NewCollabRoom(sessionId)
		s.rooms[sessionId] = room
	}
	return room
}

// removeRoom removes an empty room and cleans up hint index. Caller must NOT hold s.mu.
func (s *CollabService) removeRoom(sessionId string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if room, ok := s.rooms[sessionId]; ok && room.IsEmpty() {
		delete(s.rooms, sessionId)
		// Clean up hint index entries pointing to this session
		for hint, sid := range s.hintIndex {
			if sid == sessionId {
				delete(s.hintIndex, hint)
			}
		}
	}
}

// findRoomForClient locates the room containing clientId.
// Returns nil if the client is not in any room.
func (s *CollabService) findRoomForClient(clientId string) *CollabRoom {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, r := range s.rooms {
		r.mu.RLock()
		_, ok := r.Clients[clientId]
		r.mu.RUnlock()
		if ok {
			return r
		}
	}
	return nil
}

// FindSessionByHint looks up a sessionId by client hint. Returns empty string if not found.
func (s *CollabService) FindSessionByHint(hint string) string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.hintIndex[hint]
}

// GetClientSendCh returns the broadcast channel for a client in a room.
// Returns nil if the room or client is not found.
func (s *CollabService) GetClientSendCh(sessionId, clientId string) chan *pb.CollabEvent {
	s.mu.RLock()
	room, ok := s.rooms[sessionId]
	s.mu.RUnlock()
	if !ok {
		return nil
	}
	room.mu.RLock()
	defer room.mu.RUnlock()
	if c, ok := room.Clients[clientId]; ok {
		return c.SendCh
	}
	return nil
}

// HandleAction processes a single CollabAction from a client stream.
func (s *CollabService) HandleAction(ctx context.Context, action *pb.CollabAction) (*pb.CollabEvent, error) {
	if action == nil {
		return nil, fmt.Errorf("nil action")
	}
	switch action.Action.(type) {
	case *pb.CollabAction_Join:
		return s.handleJoin(ctx, action)
	case *pb.CollabAction_Leave:
		return s.handleLeave(ctx, action)
	case *pb.CollabAction_Presence:
		return s.handlePresence(ctx, action)
	case *pb.CollabAction_SceneUpdate,
		*pb.CollabAction_CursorUpdate,
		*pb.CollabAction_TextUpdate,
		*pb.CollabAction_SceneInitRequest,
		*pb.CollabAction_SceneInitResponse:
		return s.handleBroadcast(ctx, action)
	default:
		return nil, fmt.Errorf("unknown or empty action type")
	}
}

// GetRoom returns information about a room.
func (s *CollabService) GetRoom(ctx context.Context, req *pb.GetRoomRequest) (*pb.GetRoomResponse, error) {
	s.mu.RLock()
	room, ok := s.rooms[req.GetSessionId()]
	s.mu.RUnlock()
	if !ok {
		return nil, fmt.Errorf("room not found: %s", req.GetSessionId())
	}
	return &pb.GetRoomResponse{
		SessionId:     room.SessionId,
		Peers:         room.GetPeerInfo(),
		CreatedAt:     room.Created.Unix(),
		OwnerClientId: room.OwnerClientId,
		Tool:          room.Tool,
	}, nil
}

// ListRooms returns all active rooms.
func (s *CollabService) ListRooms(ctx context.Context, req *pb.ListRoomsRequest) (*pb.ListRoomsResponse, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	rooms := make([]*pb.RoomSummary, 0, len(s.rooms))
	for _, room := range s.rooms {
		rooms = append(rooms, &pb.RoomSummary{
			SessionId: room.SessionId,
			PeerCount: int32(room.ClientCount()),
			CreatedAt: room.Created.Unix(),
		})
	}
	return &pb.ListRoomsResponse{Rooms: rooms}, nil
}

// ─── Internal handlers ──────────────────────────

func (s *CollabService) handleJoin(ctx context.Context, action *pb.CollabAction) (*pb.CollabEvent, error) {
	join := action.GetJoin()
	username := join.GetUsername()
	if username == "" {
		username = "Anonymous"
	}

	isOwner := join.GetIsOwner()
	browserId := join.GetBrowserId()
	clientHint := join.GetClientHint()
	sessionId := join.GetSessionId()

	// If no session_id provided, resolve via hint or generate a new one
	if sessionId == "" {
		if clientHint != "" {
			s.mu.RLock()
			existing, ok := s.hintIndex[clientHint]
			s.mu.RUnlock()
			if ok {
				sessionId = existing
			}
		}
		if sessionId == "" {
			sessionId = uuid.New().String()
		}
	}

	// Index the hint → sessionId mapping
	if clientHint != "" {
		s.mu.Lock()
		s.hintIndex[clientHint] = sessionId
		s.mu.Unlock()
	}

	room := s.GetOrCreateRoom(sessionId)

	// Owner validation
	if isOwner {
		room.mu.Lock()
		if room.OwnerClientId != "" && room.OwnerBrowserId != browserId {
			room.mu.Unlock()
			return nil, fmt.Errorf("room already has an owner from a different browser")
		}
		room.mu.Unlock()
	}

	// Snapshot existing peers BEFORE adding the new client
	existingPeers := room.GetPeerInfo()

	clientId := uuid.New().String()
	client := &CollabClient{
		ClientId:   clientId,
		SessionId:  sessionId,
		Username:   username,
		Tool:       join.GetTool(),
		ClientType: join.GetClientType(),
		AvatarUrl:  join.GetAvatarUrl(),
		IsActive:   true,
		IsOwner:    isOwner,
		BrowserId:  browserId,
		SendCh:     make(chan *pb.CollabEvent, 64),
	}
	room.AddClient(client)

	// Set room ownership and tool
	room.mu.Lock()
	if isOwner {
		room.OwnerClientId = clientId
		room.OwnerBrowserId = browserId
	}
	if room.Tool == "" {
		room.Tool = join.GetTool()
	}
	room.mu.Unlock()

	// Broadcast PeerJoined to existing clients
	room.BroadcastExcept(&pb.CollabEvent{
		EventId:      uuid.New().String(),
		FromClientId: clientId,
		Event: &pb.CollabEvent_PeerJoined{
			PeerJoined: &pb.PeerJoined{
				Peer: &pb.PeerInfo{
					ClientId:   clientId,
					Username:   username,
					AvatarUrl:  join.GetAvatarUrl(),
					ClientType: join.GetClientType(),
					IsActive:   true,
					IsOwner:    isOwner,
				},
			},
		},
	}, clientId)

	// Return RoomJoined to the joining client
	return &pb.CollabEvent{
		EventId: uuid.New().String(),
		Event: &pb.CollabEvent_RoomJoined{
			RoomJoined: &pb.RoomJoined{
				ClientId:      clientId,
				SessionId:     sessionId,
				Peers:         existingPeers,
				OwnerClientId: room.OwnerClientId,
			},
		},
	}, nil
}

func (s *CollabService) handleLeave(ctx context.Context, action *pb.CollabAction) (*pb.CollabEvent, error) {
	clientId := action.GetClientId()

	room := s.findRoomForClient(clientId)
	if room == nil {
		return nil, fmt.Errorf("client %s not found in any room", clientId)
	}

	// Check if the leaving client is the owner
	room.mu.RLock()
	leavingClient := room.Clients[clientId]
	isOwner := leavingClient != nil && leavingClient.IsOwner
	browserId := ""
	if leavingClient != nil {
		browserId = leavingClient.BrowserId
	}
	room.mu.RUnlock()

	room.RemoveClient(clientId)
	remainingCount := room.ClientCount()

	if isOwner && remainingCount > 0 {
		// Try to transfer ownership to a same-browser tab
		var successor *CollabClient
		if browserId != "" {
			successor = room.FindByBrowserId(browserId, clientId)
		}

		if successor != nil {
			// Transfer ownership
			room.mu.Lock()
			successor.IsOwner = true
			room.OwnerClientId = successor.ClientId
			room.mu.Unlock()

			room.BroadcastToAll(&pb.CollabEvent{
				EventId:      uuid.New().String(),
				FromClientId: clientId,
				Event: &pb.CollabEvent_OwnerChanged{
					OwnerChanged: &pb.OwnerChanged{
						NewOwnerClientId: successor.ClientId,
					},
				},
			})
		} else {
			// No same-browser successor — session dies
			room.BroadcastToAll(&pb.CollabEvent{
				EventId:      uuid.New().String(),
				FromClientId: clientId,
				Event: &pb.CollabEvent_SessionEnded{
					SessionEnded: &pb.SessionEnded{
						Reason: "owner_disconnected",
					},
				},
			})
			room.CloseAllClients()
			s.removeRoom(room.SessionId)
			return &pb.CollabEvent{
				EventId: uuid.New().String(),
				Event: &pb.CollabEvent_PeerLeft{
					PeerLeft: &pb.PeerLeft{
						ClientId:  clientId,
						PeerCount: 0,
					},
				},
			}, nil
		}
	}

	// Broadcast PeerLeft to remaining clients
	room.BroadcastToAll(&pb.CollabEvent{
		EventId:      uuid.New().String(),
		FromClientId: clientId,
		Event: &pb.CollabEvent_PeerLeft{
			PeerLeft: &pb.PeerLeft{
				ClientId:  clientId,
				Reason:    action.GetLeave().GetReason(),
				PeerCount: int32(remainingCount),
			},
		},
	})

	// Clean up empty rooms
	if remainingCount == 0 {
		s.removeRoom(room.SessionId)
	}

	return &pb.CollabEvent{
		EventId: uuid.New().String(),
		Event: &pb.CollabEvent_PeerLeft{
			PeerLeft: &pb.PeerLeft{
				ClientId:  clientId,
				PeerCount: int32(remainingCount),
			},
		},
	}, nil
}

func (s *CollabService) handlePresence(ctx context.Context, action *pb.CollabAction) (*pb.CollabEvent, error) {
	clientId := action.GetClientId()

	room := s.findRoomForClient(clientId)
	if room == nil {
		return nil, fmt.Errorf("client %s not found in any room", clientId)
	}

	// Broadcast presence to everyone except sender
	room.BroadcastExcept(&pb.CollabEvent{
		EventId:      uuid.New().String(),
		FromClientId: clientId,
		Event: &pb.CollabEvent_Presence{
			Presence: action.GetPresence(),
		},
	}, clientId)

	return nil, nil
}

// handleBroadcast is a generic handler for relay-only messages (no server-side
// state, just fan-out). Converts the action oneof to the corresponding event
// oneof and broadcasts to all peers except the sender.
func (s *CollabService) handleBroadcast(ctx context.Context, action *pb.CollabAction) (*pb.CollabEvent, error) {
	clientId := action.GetClientId()

	room := s.findRoomForClient(clientId)
	if room == nil {
		return nil, fmt.Errorf("client %s not found in any room", clientId)
	}

	event := &pb.CollabEvent{
		EventId:      uuid.New().String(),
		FromClientId: clientId,
	}

	// Convert action oneof → event oneof
	switch a := action.Action.(type) {
	case *pb.CollabAction_SceneUpdate:
		event.Event = &pb.CollabEvent_SceneUpdate{SceneUpdate: a.SceneUpdate}
	case *pb.CollabAction_CursorUpdate:
		event.Event = &pb.CollabEvent_CursorUpdate{CursorUpdate: a.CursorUpdate}
	case *pb.CollabAction_TextUpdate:
		event.Event = &pb.CollabEvent_TextUpdate{TextUpdate: a.TextUpdate}
	case *pb.CollabAction_SceneInitRequest:
		event.Event = &pb.CollabEvent_SceneInitRequest{SceneInitRequest: a.SceneInitRequest}
	case *pb.CollabAction_SceneInitResponse:
		event.Event = &pb.CollabEvent_SceneInitResponse{SceneInitResponse: a.SceneInitResponse}
	default:
		return nil, fmt.Errorf("unsupported broadcast action type")
	}

	room.BroadcastExcept(event, clientId)

	return nil, nil
}

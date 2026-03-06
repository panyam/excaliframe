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
	SessionId string
	Clients   map[string]*CollabClient
	Created   time.Time
	mu        sync.RWMutex
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
	SendCh     chan *pb.CollabEvent
}

// CollabService manages rooms and peer lifecycle.
type CollabService struct {
	rooms map[string]*CollabRoom
	mu    sync.RWMutex
}

// NewCollabService creates a new CollabService.
func NewCollabService() *CollabService {
	return &CollabService{rooms: make(map[string]*CollabRoom)}
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

// removeRoom removes an empty room. Caller must NOT hold s.mu.
func (s *CollabService) removeRoom(sessionId string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if room, ok := s.rooms[sessionId]; ok && room.IsEmpty() {
		delete(s.rooms, sessionId)
	}
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
		SessionId: room.SessionId,
		Peers:     room.GetPeerInfo(),
		CreatedAt: room.Created.Unix(),
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
	if join.GetUsername() == "" {
		return nil, fmt.Errorf("username is required")
	}

	room := s.GetOrCreateRoom(join.GetSessionId())

	// Snapshot existing peers BEFORE adding the new client
	existingPeers := room.GetPeerInfo()

	clientId := uuid.New().String()
	client := &CollabClient{
		ClientId:   clientId,
		SessionId:  join.GetSessionId(),
		Username:   join.GetUsername(),
		Tool:       join.GetTool(),
		ClientType: join.GetClientType(),
		AvatarUrl:  join.GetAvatarUrl(),
		IsActive:   true,
		SendCh:     make(chan *pb.CollabEvent, 64),
	}
	room.AddClient(client)

	// Broadcast PeerJoined to existing clients
	room.BroadcastExcept(&pb.CollabEvent{
		EventId:      uuid.New().String(),
		FromClientId: clientId,
		Event: &pb.CollabEvent_PeerJoined{
			PeerJoined: &pb.PeerJoined{
				Peer: &pb.PeerInfo{
					ClientId:   clientId,
					Username:   join.GetUsername(),
					AvatarUrl:  join.GetAvatarUrl(),
					ClientType: join.GetClientType(),
					IsActive:   true,
				},
			},
		},
	}, clientId)

	// Return RoomJoined to the joining client
	return &pb.CollabEvent{
		EventId: uuid.New().String(),
		Event: &pb.CollabEvent_RoomJoined{
			RoomJoined: &pb.RoomJoined{
				ClientId:  clientId,
				SessionId: join.GetSessionId(),
				Peers:     existingPeers,
			},
		},
	}, nil
}

func (s *CollabService) handleLeave(ctx context.Context, action *pb.CollabAction) (*pb.CollabEvent, error) {
	clientId := action.GetClientId()

	// Find the room this client is in
	s.mu.RLock()
	var room *CollabRoom
	var sessionId string
	for sid, r := range s.rooms {
		r.mu.RLock()
		if _, ok := r.Clients[clientId]; ok {
			room = r
			sessionId = sid
		}
		r.mu.RUnlock()
		if room != nil {
			break
		}
	}
	s.mu.RUnlock()

	if room == nil {
		return nil, fmt.Errorf("client %s not found in any room", clientId)
	}

	room.RemoveClient(clientId)
	remainingCount := room.ClientCount()

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
		s.removeRoom(sessionId)
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
	presence := action.GetPresence()

	// Find the room this client is in
	s.mu.RLock()
	var room *CollabRoom
	for _, r := range s.rooms {
		r.mu.RLock()
		if _, ok := r.Clients[clientId]; ok {
			room = r
		}
		r.mu.RUnlock()
		if room != nil {
			break
		}
	}
	s.mu.RUnlock()

	if room == nil {
		return nil, fmt.Errorf("client %s not found in any room", clientId)
	}

	// Broadcast presence to everyone except sender
	room.BroadcastExcept(&pb.CollabEvent{
		EventId:      uuid.New().String(),
		FromClientId: clientId,
		Event: &pb.CollabEvent_Presence{
			Presence: presence,
		},
	}, clientId)

	return nil, nil
}

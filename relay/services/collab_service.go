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
	// stub
	return nil
}

// HandleAction processes a single CollabAction from a client stream.
// It dispatches to the appropriate internal handler based on the oneof action.
// Returns the response event to send back to the caller (or nil if broadcast-only).
func (s *CollabService) HandleAction(ctx context.Context, action *pb.CollabAction) (*pb.CollabEvent, error) {
	// stub
	return nil, fmt.Errorf("not implemented")
}

// GetRoom returns information about a room (proto RPC signature).
func (s *CollabService) GetRoom(ctx context.Context, req *pb.GetRoomRequest) (*pb.GetRoomResponse, error) {
	// stub
	return nil, fmt.Errorf("not implemented")
}

// ListRooms returns all active rooms (proto RPC signature).
func (s *CollabService) ListRooms(ctx context.Context, req *pb.ListRoomsRequest) (*pb.ListRoomsResponse, error) {
	// stub
	return nil, fmt.Errorf("not implemented")
}

// ─── Internal helpers (called by HandleAction) ──────────────────

// handleJoin processes a JoinRoom action. Returns the RoomJoined event for the caller
// and broadcasts PeerJoined to existing clients.
func (s *CollabService) handleJoin(ctx context.Context, action *pb.CollabAction) (*pb.CollabEvent, error) {
	// stub
	return nil, fmt.Errorf("not implemented")
}

// handleLeave processes a LeaveRoom action. Broadcasts PeerLeft to remaining clients.
func (s *CollabService) handleLeave(ctx context.Context, action *pb.CollabAction) (*pb.CollabEvent, error) {
	// stub
	return nil, fmt.Errorf("not implemented")
}

// handlePresence processes a PresenceUpdate action. Broadcasts to room peers.
func (s *CollabService) handlePresence(ctx context.Context, action *pb.CollabAction) (*pb.CollabEvent, error) {
	// stub
	return nil, fmt.Errorf("not implemented")
}

// broadcastToRoom sends an event to all clients in a room except fromClientId.
func (s *CollabService) broadcastToRoom(sessionId, fromClientId string, event *pb.CollabEvent) error {
	// stub
	return fmt.Errorf("not implemented")
}

// ensure uuid import is used
var _ = uuid.New

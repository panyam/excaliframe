package services

import (
	"time"

	pb "github.com/user/excaliframe/relay/gen/go/excaliframe/v1/models"
)

// NewCollabRoom creates a new room with the given session ID.
func NewCollabRoom(sessionId string) *CollabRoom {
	return &CollabRoom{
		SessionId: sessionId,
		Clients:   make(map[string]*CollabClient),
		Created:   time.Now(),
	}
}

// AddClient adds a client to the room.
func (r *CollabRoom) AddClient(client *CollabClient) {
	// stub
}

// RemoveClient removes a client by ID. Returns the removed client or nil.
func (r *CollabRoom) RemoveClient(clientId string) *CollabClient {
	// stub
	return nil
}

// GetPeerInfo returns PeerInfo for all connected clients.
func (r *CollabRoom) GetPeerInfo() []*pb.PeerInfo {
	// stub
	return nil
}

// IsEmpty returns true if the room has no clients.
func (r *CollabRoom) IsEmpty() bool {
	// stub
	return true
}

// ClientCount returns the number of connected clients.
func (r *CollabRoom) ClientCount() int {
	// stub
	return 0
}

// BroadcastToAll sends an event to all clients (non-blocking).
func (r *CollabRoom) BroadcastToAll(event *pb.CollabEvent) {
	// stub
}

// BroadcastExcept sends an event to all clients except the specified one.
func (r *CollabRoom) BroadcastExcept(event *pb.CollabEvent, exceptClientId string) {
	// stub
}

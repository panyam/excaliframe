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

// CloseAllClients closes all client send channels and removes them from the room.
func (r *CollabRoom) CloseAllClients() {
	r.mu.Lock()
	defer r.mu.Unlock()
	for id, c := range r.Clients {
		close(c.SendCh)
		delete(r.Clients, id)
	}
}

// FindByBrowserId returns any client with the given browser ID,
// excluding the specified client. Returns nil if none found.
func (r *CollabRoom) FindByBrowserId(browserId string, excludeClientId string) *CollabClient {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, c := range r.Clients {
		if c.ClientId == excludeClientId {
			continue
		}
		if c.BrowserId == browserId {
			return c
		}
	}
	return nil
}

// AddClient adds a client to the room.
func (r *CollabRoom) AddClient(client *CollabClient) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.Clients[client.ClientId] = client
}

// RemoveClient removes a client by ID. Returns the removed client or nil.
func (r *CollabRoom) RemoveClient(clientId string) *CollabClient {
	r.mu.Lock()
	defer r.mu.Unlock()
	c, ok := r.Clients[clientId]
	if !ok {
		return nil
	}
	delete(r.Clients, clientId)
	return c
}

// GetPeerInfo returns PeerInfo for all connected clients.
func (r *CollabRoom) GetPeerInfo() []*pb.PeerInfo {
	r.mu.RLock()
	defer r.mu.RUnlock()
	peers := make([]*pb.PeerInfo, 0, len(r.Clients))
	for _, c := range r.Clients {
		peers = append(peers, &pb.PeerInfo{
			ClientId:   c.ClientId,
			Username:   c.Username,
			AvatarUrl:  c.AvatarUrl,
			ClientType: c.ClientType,
			IsActive:   c.IsActive,
			IsOwner:    c.IsOwner,
		})
	}
	return peers
}

// IsEmpty returns true if the room has no clients.
func (r *CollabRoom) IsEmpty() bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.Clients) == 0
}

// ClientCount returns the number of connected clients.
func (r *CollabRoom) ClientCount() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.Clients)
}

// BroadcastToAll sends an event to all clients (non-blocking).
func (r *CollabRoom) BroadcastToAll(event *pb.CollabEvent) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, c := range r.Clients {
		select {
		case c.SendCh <- event:
		default:
			// drop if channel full — non-blocking
		}
	}
}

// BroadcastExcept sends an event to all clients except the specified one.
func (r *CollabRoom) BroadcastExcept(event *pb.CollabEvent, exceptClientId string) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, c := range r.Clients {
		if c.ClientId == exceptClientId {
			continue
		}
		select {
		case c.SendCh <- event:
		default:
		}
	}
}

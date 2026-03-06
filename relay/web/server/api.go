package server

import (
	"context"
	"encoding/json"
	"log"
	"net/http"

	pb "github.com/user/excaliframe/relay/gen/go/excaliframe/v1/models"

	"github.com/panyam/servicekit/grpcws"
	gohttp "github.com/panyam/servicekit/http"
)

// ApiHandler handles HTTP requests for the relay API.
type ApiHandler struct {
	app *RelayApp
}

// NewApiHandler creates a new ApiHandler.
func NewApiHandler(app *RelayApp) *ApiHandler {
	return &ApiHandler{app: app}
}

// SetupRoutes registers all API routes on the app's mux.
func (h *ApiHandler) SetupRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /health", h.HandleHealth)
	mux.HandleFunc("GET /api/v1/rooms", h.HandleListRooms)
	mux.HandleFunc("GET /api/v1/rooms/{session_id}", h.HandleGetRoom)

	// WebSocket bidi endpoint using servicekit grpcws
	wsHandler := grpcws.NewBidiStreamHandler(
		func(ctx context.Context) (*CollabBidiStream, error) {
			return NewCollabBidiStream(ctx, h.app.Service), nil
		},
		func() *pb.CollabAction { return &pb.CollabAction{} },
	)
	mux.HandleFunc("/ws/v1/{session_id}/sync", gohttp.WSServe(wsHandler, nil))
	log.Println("Registered Collab WebSocket handler at /ws/v1/{session_id}/sync")
}

// HandleHealth returns a simple health check response.
func (h *ApiHandler) HandleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// HandleListRooms returns all active rooms.
func (h *ApiHandler) HandleListRooms(w http.ResponseWriter, r *http.Request) {
	resp, err := h.app.Service.ListRooms(r.Context(), &pb.ListRoomsRequest{})
	w.Header().Set("Content-Type", "application/json")
	if err != nil || resp == nil {
		json.NewEncoder(w).Encode(map[string]any{"rooms": []any{}})
		return
	}
	// Proto omitempty drops empty slices, so wrap to ensure "rooms" key is always present
	json.NewEncoder(w).Encode(map[string]any{"rooms": resp.GetRooms()})
}

// HandleGetRoom returns info about a specific room.
func (h *ApiHandler) HandleGetRoom(w http.ResponseWriter, r *http.Request) {
	sessionId := r.PathValue("session_id")
	resp, err := h.app.Service.GetRoom(r.Context(), &pb.GetRoomRequest{SessionId: sessionId})
	if err != nil || resp == nil {
		http.Error(w, `{"error":"room not found"}`, http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

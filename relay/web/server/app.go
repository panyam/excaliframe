package server

import (
	"net/http"

	"github.com/user/excaliframe/relay/services"
)

// RelayApp is the HTTP application for the relay server.
type RelayApp struct {
	Service *services.CollabService
	mux     *http.ServeMux
}

// NewRelayApp creates a new RelayApp.
func NewRelayApp() *RelayApp {
	return &RelayApp{
		Service: services.NewCollabService(),
		mux:     http.NewServeMux(),
	}
}

// Init sets up routes.
func (a *RelayApp) Init() error {
	h := NewApiHandler(a)
	h.SetupRoutes(a.mux)
	return nil
}

// ServeHTTP implements http.Handler.
func (a *RelayApp) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	a.mux.ServeHTTP(w, r)
}

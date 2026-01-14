package confluence

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"path/filepath"
)

// LifecyclePayload represents the Confluence Connect lifecycle request
type LifecyclePayload struct {
	ClientKey    string `json:"clientKey"`
	SharedSecret string `json:"sharedSecret"`
	BaseURL      string `json:"baseUrl"`
}

// NewHandler returns an http.Handler for all Confluence-related routes.
// The caller is responsible for mounting this at the appropriate prefix (e.g., "/confluence").
func NewHandler(distDir string) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("/atlassian-connect.json", descriptorHandler(distDir))
	mux.HandleFunc("/lifecycle/installed", installedHandler)
	mux.HandleFunc("/lifecycle/uninstalled", uninstalledHandler)

	return mux
}

// descriptorHandler serves the atlassian-connect.json file
func descriptorHandler(distDir string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Try dist/ first, then root
		paths := []string{
			filepath.Join(distDir, "atlassian-connect.json"),
			"atlassian-connect.json",
		}

		for _, path := range paths {
			if _, err := os.Stat(path); err == nil {
				w.Header().Set("Content-Type", "application/json")
				http.ServeFile(w, r, path)
				return
			}
		}

		http.Error(w, "atlassian-connect.json not found", http.StatusNotFound)
	}
}

// installedHandler handles the /lifecycle/installed webhook
func installedHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var payload LifecyclePayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		log.Printf("Failed to decode installed payload: %v", err)
		// Still return 200 - Confluence expects success
	} else {
		log.Printf("Plugin installed - clientKey: %s, baseUrl: %s", payload.ClientKey, payload.BaseURL)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// uninstalledHandler handles the /lifecycle/uninstalled webhook
func uninstalledHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var payload LifecyclePayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		log.Printf("Failed to decode uninstalled payload: %v", err)
	} else {
		log.Printf("Plugin uninstalled - clientKey: %s", payload.ClientKey)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"excaliframe/server/confluence"
	"excaliframe/server/excalidraw"
	"excaliframe/server/middleware"
)

// Config holds server configuration
type Config struct {
	Port    string
	DistDir string
}

func main() {
	config := Config{
		Port:    getEnv("PORT", "3000"),
		DistDir: getEnv("DIST_DIR", "dist"),
	}

	mux := http.NewServeMux()

	// Mount Confluence handlers at /confluence
	mux.Handle("/confluence/", http.StripPrefix("/confluence", confluence.NewHandler(config.DistDir)))

	// Mount Excalidraw handlers at /excalidraw
	mux.Handle("/excalidraw/", http.StripPrefix("/excalidraw", excalidraw.NewHandler(config.DistDir)))

	// Serve static assets (JS bundles, etc.)
	staticDir := filepath.Join(config.DistDir, "static")
	mux.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir(staticDir))))

	// Serve static images
	imagesDir := filepath.Join(config.DistDir, "images")
	mux.Handle("/images/", http.StripPrefix("/images/", http.FileServer(http.Dir(imagesDir))))

	// Serve other static files from dist/ (fallback)
	mux.Handle("/", http.FileServer(http.Dir(config.DistDir)))

	// Apply middleware
	handler := middleware.Logging(mux)

	// Start server
	addr := fmt.Sprintf("0.0.0.0:%s", config.Port)
	log.Printf("Excaliframe server starting on http://%s", addr)
	log.Printf("Dist directory: %s", config.DistDir)
	log.Printf("Descriptor: http://%s/confluence/atlassian-connect.json", addr)

	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}

// getEnv returns environment variable or default value
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

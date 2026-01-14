package excalidraw

import (
	"net/http"
	"os"
	"path/filepath"
)

// NewHandler returns an http.Handler for all Excalidraw-related routes.
// The caller is responsible for mounting this at the appropriate prefix (e.g., "/excalidraw").
func NewHandler(distDir string) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("/editor", editorHandler(distDir))
	mux.HandleFunc("/renderer", rendererHandler(distDir))

	return mux
}

// editorHandler serves the Excalidraw editor HTML
func editorHandler(distDir string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		editorPath := filepath.Join(distDir, "excalidraw", "editor.html")
		if _, err := os.Stat(editorPath); err != nil {
			http.Error(w, "Editor not found", http.StatusNotFound)
			return
		}

		http.ServeFile(w, r, editorPath)
	}
}

// rendererHandler serves the Excalidraw renderer HTML
func rendererHandler(distDir string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		rendererPath := filepath.Join(distDir, "excalidraw", "renderer.html")
		if _, err := os.Stat(rendererPath); err != nil {
			http.Error(w, "Renderer not found", http.StatusNotFound)
			return
		}

		http.ServeFile(w, r, rendererPath)
	}
}

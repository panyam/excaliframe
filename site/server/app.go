package server

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
)

// ExcaliframeApp holds app-level configuration
type ExcaliframeApp struct {
	AppName         string
	BaseURL         string
	GitHubURL       string
	GitHubIssuesURL string
	AtlassianURL    string
	SharingEnabled  bool

	// BundleManifest maps bundle directory names to their hashed entry filenames.
	// e.g. "editor" → "bundle.7a3caf9f.js"
	// Loaded at startup from static/playground/{dir}/manifest.json.
	BundleManifest map[string]string
}

// NewExcaliframeApp creates a new app context with defaults
func NewExcaliframeApp() *ExcaliframeApp {
	app := &ExcaliframeApp{
		AppName:         "Excaliframe",
		BaseURL:         "https://excaliframe.com",
		GitHubURL:       "https://github.com/panyam/excaliframe",
		GitHubIssuesURL: "https://github.com/panyam/excaliframe/issues",
		AtlassianURL:    "https://marketplace.atlassian.com/apps/", // TODO: Update with actual marketplace URL
		SharingEnabled:  os.Getenv("ENABLE_SHARING") != "",
		BundleManifest:  make(map[string]string),
	}
	app.LoadManifests("static/playground")
	return app
}

// LoadManifests reads manifest.json from each bundle directory under baseDir.
func (a *ExcaliframeApp) LoadManifests(baseDir string) {
	entries, err := os.ReadDir(baseDir)
	if err != nil {
		log.Printf("warning: cannot read bundle dir %s: %v", baseDir, err)
		return
	}
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		dir := entry.Name()
		manifestPath := filepath.Join(baseDir, dir, "manifest.json")
		data, err := os.ReadFile(manifestPath)
		if err != nil {
			// No manifest = dev mode, fall back to bundle.js
			a.BundleManifest[dir] = "bundle.js"
			continue
		}
		var manifest map[string]string
		if err := json.Unmarshal(data, &manifest); err != nil {
			log.Printf("warning: invalid manifest %s: %v", manifestPath, err)
			a.BundleManifest[dir] = "bundle.js"
			continue
		}
		if bundleFile, ok := manifest["bundle.js"]; ok {
			a.BundleManifest[dir] = bundleFile
		} else {
			a.BundleManifest[dir] = "bundle.js"
		}
		log.Printf("[BUNDLE] %s → %s", dir, a.BundleManifest[dir])
	}
}

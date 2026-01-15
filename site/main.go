package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"path/filepath"

	goal "github.com/panyam/goapplib"
	tmplr "github.com/panyam/templar"
	"excaliframe-site/server"
)

const TEMPLATES_FOLDER = "./templates"
const STATIC_FOLDER = "./static"

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	address := ":" + port

	// Create app context
	appCtx := server.NewExcaliframeApp()

	// Setup templates with SourceLoader for @goapplib/ vendored dependencies
	templates := tmplr.NewTemplateGroup()
	configPath, _ := filepath.Abs(filepath.Join(TEMPLATES_FOLDER, "templar.yaml"))
	sourceLoader, err := tmplr.NewSourceLoaderFromConfig(configPath)
	if err != nil {
		log.Printf("Warning: Could not load templar.yaml: %v. Falling back to basic loader.", err)
		templates.Loader = tmplr.NewFileSystemLoader(TEMPLATES_FOLDER)
	} else {
		templates.Loader = sourceLoader
	}
	templates.AddFuncs(goal.DefaultFuncMap())

	// Create the goal app
	app := goal.NewApp(appCtx, templates)

	// Setup routes
	mux := server.SetupRoutes(app)

	// Serve static files
	mux.Handle("/static/", http.StripPrefix("/static", http.FileServer(http.Dir(STATIC_FOLDER))))

	// Start server
	isDevMode := os.Getenv("EXCALIFRAME_ENV") != "production"
	webServer := &goal.WebAppServer{
		Address:       address,
		AllowLocalDev: isDevMode,
	}

	srvErr := make(chan error, 1)
	stopChan := make(chan bool, 1)

	go webServer.StartWithHandler(context.Background(), mux, srvErr, stopChan)

	if err := <-srvErr; err != nil && err != http.ErrServerClosed {
		log.Fatal("Server error:", err)
	}
}

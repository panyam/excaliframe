package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"

	"github.com/user/excaliframe/relay/web/server"
)

func main() {
	port := flag.Int("port", 8787, "Port to listen on")
	flag.Parse()

	app := server.NewRelayApp()
	if err := app.Init(); err != nil {
		log.Fatalf("Failed to initialize relay: %v", err)
	}

	addr := fmt.Sprintf(":%d", *port)
	log.Printf("Relay server listening on %s", addr)
	if err := http.ListenAndServe(addr, app); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}

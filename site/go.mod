module excaliframe-site

go 1.24.0

toolchain go1.24.6

require (
	github.com/panyam/goapplib v0.0.34
	github.com/panyam/templar v0.0.29
	github.com/user/excaliframe/relay v0.0.0-00010101000000-000000000000
)

replace github.com/user/excaliframe/relay => ../relay

require (
	github.com/felixge/httpsnoop v1.0.4 // indirect
	github.com/google/uuid v1.6.0 // indirect
	github.com/gorilla/websocket v1.5.0 // indirect
	github.com/panyam/gocurrent v0.0.9 // indirect
	github.com/panyam/goutils v0.1.13 // indirect
	github.com/panyam/servicekit v0.0.4 // indirect
	golang.org/x/net v0.48.0 // indirect
	golang.org/x/sys v0.39.0 // indirect
	golang.org/x/text v0.32.0 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20251222181119-0a764e51fe1b // indirect
	google.golang.org/grpc v1.79.1 // indirect
	google.golang.org/protobuf v1.36.11 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
)

// replace github.com/turnforge/turnengine v0.0.3 => ./locallinks/newstack/turnengine/

// replace github.com/panyam/protoc-gen-dal v0.0.10 => ./locallinks/newstack/protoc-gen-dal

// replace github.com/panyam/gocurrent v0.0.10 => ./locallinks/newstack/gocurrent

// replace github.com/panyam/goutils v0.1.12 => ./locallinks/newstack/goutils

// replace github.com/panyam/templar v0.0.29 => ./locallinks/newstack/templar

// replace github.com/panyam/servicekit v0.0.4 => ./locallinks/newstack/servicekit

// replace github.com/panyam/oneauth v0.0.23 => ./locallinks/newstack/oneauth

// replace github.com/panyam/goapplib v0.0.34 => ./locallinks/newstack/goapplib/main

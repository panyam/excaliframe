module excaliframe-site

go 1.24.0

toolchain go1.24.6

require (
	github.com/panyam/goapplib v0.0.31
	github.com/panyam/templar v0.0.29
)

require (
	github.com/felixge/httpsnoop v1.0.4 // indirect
	github.com/panyam/goutils v0.1.13 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
)

// replace github.com/turnforge/turnengine v0.0.3 => ./locallinks/newstack/turnengine/

// replace github.com/panyam/protoc-gen-dal v0.0.10 => ./locallinks/newstack/protoc-gen-dal

// replace github.com/panyam/gocurrent v0.0.10 => ./locallinks/newstack/gocurrent

// replace github.com/panyam/goutils v0.1.12 => ./locallinks/newstack/goutils

// replace github.com/panyam/templar v0.0.29 => ./locallinks/newstack/templar

// replace github.com/panyam/servicekit v0.0.4 => ./locallinks/newstack/servicekit

// replace github.com/panyam/oneauth v0.0.23 => ./locallinks/newstack/oneauth

replace github.com/panyam/goapplib v0.0.31 => ./locallinks/newstack/goapplib/main

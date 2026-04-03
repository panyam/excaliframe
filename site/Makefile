
NUM_LINKED_GOMODS=`cat go.mod | grep -v "^\/\/" | grep replace | wc -l | sed -e "s/ *//g"`

all: parent build run

run: resymlink
	ENABLE_SHARING=1 ENABLE_RELAY=1 EXCALIFRAME_ENV=dev go run .

parent:
	cd ../ && make build

resymlink:
	mkdir -p locallinks
	rm -Rf locallinks/*
	cd locallinks && ln -s ~/newstack

checklinks:
	@if [ x"${NUM_LINKED_GOMODS}" != "x0" ]; then	\
		echo "You are trying to deploy with symlinks. Remove them first and make sure versions exist" && false ;	\
	fi

build:
	npm run build:rspack

build-old:
	npm run build

deploy: checklinks parent build
	rm -Rf locallinks ; mkdir locallinks
	gcloud app deploy --project excaliframe --verbosity=info

prodlogs:
	gcloud app logs tail -s default --project excaliframe

clean:
	rm -Rf bin locallinks

.PHONY: all run build resymlink checklinks build build-old deploy prodlogs clean

# =============================================================================
# Security audit
# =============================================================================

# Full security audit: dependency vulns + code patterns + secrets
audit:
	@echo "=== govulncheck ==="
	govulncheck ./...
	@echo ""
	@echo "=== gosec ==="
	gosec -quiet -severity=medium ./... || true
	@echo ""
	@echo "=== gitleaks ==="
	gitleaks detect --source . -v 2>/dev/null || echo "gitleaks not installed (go install github.com/gitleaks/gitleaks/v8@latest)"
	@echo ""
	@echo "=== Audit complete ==="

.PHONY: audit

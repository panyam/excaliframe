.PHONY: help install build build-frontend build-server dev dev-watch start stop clean validate-json update-url dev-tunnel cloud-dev cloud-dev-stop cloud-start cloud-start-bg cloud-stop cloud-logs cloud-url gae-deploy gae-logs gae-browse gae-describe deploy-info

# Default target
.DEFAULT_GOAL := help

# Colors for output
GREEN := \033[0;32m
YELLOW := \033[1;33m
RED := \033[0;31m
NC := \033[0m # No Color

# Binary output
BIN_DIR := bin
SERVER_BIN := $(BIN_DIR)/server

##@ General

help: ## Display this help message
	@echo "$(GREEN)Excaliframe - Confluence Cloud Plugin for Excalidraw$(NC)"
	@echo "$(YELLOW)Go server branch - Node.js removed$(NC)"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Available targets:"
	@awk 'BEGIN {FS = ":.*##"; printf ""} /^[a-zA-Z_-]+:.*?##/ { printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2 } /^##@/ { printf "\n$(YELLOW)%s$(NC)\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Setup

install: ## Install npm dependencies (for frontend build only)
	@echo "$(GREEN)Installing npm dependencies (frontend build)...$(NC)"
	npm install

##@ Build

build: build-frontend build-server ## Build frontend and Go server
	@echo "$(GREEN)Build complete$(NC)"

build-frontend: ## Build frontend assets (webpack)
	@echo "$(GREEN)Building frontend assets...$(NC)"
	npm run build

build-server: ## Build Go server binary
	@echo "$(GREEN)Building Go server...$(NC)"
	@mkdir -p $(BIN_DIR)
	go build -o $(SERVER_BIN) .
	@echo "$(GREEN)Server binary: $(SERVER_BIN)$(NC)"

type-check: ## Run TypeScript type checking
	@echo "$(GREEN)Type checking...$(NC)"
	npm run type-check

clean: ## Remove build artifacts
	@echo "$(YELLOW)Cleaning build artifacts...$(NC)"
	rm -rf dist/ $(BIN_DIR)/
	@echo "$(GREEN)Clean complete$(NC)"

##@ Development

dev: ## Start Go server + webpack watch (run in two terminals, or use dev-all)
	@echo "$(GREEN)Starting Go server...$(NC)"
	@echo "$(YELLOW)Run 'make dev-watch' in another terminal for frontend hot rebuild$(NC)"
	@$(MAKE) build-frontend
	@DIST_DIR=dist $(SERVER_BIN) || ($(MAKE) build-server && DIST_DIR=dist $(SERVER_BIN))

dev-watch: ## Watch and rebuild frontend on changes
	@echo "$(GREEN)Watching frontend for changes...$(NC)"
	npm run dev

dev-all: build-server ## Build and run server with frontend watch (requires terminal multiplexer)
	@echo "$(GREEN)Starting dev environment...$(NC)"
	@echo "$(YELLOW)Building frontend first...$(NC)"
	@npm run build
	@echo "$(YELLOW)Starting server and watch in parallel...$(NC)"
	@trap 'kill 0' EXIT; \
		(npm run dev &) && \
		(sleep 2 && DIST_DIR=dist $(SERVER_BIN))

dev-tunnel: ## Start cloudflared tunnel (run alongside 'make dev')
	@echo "$(GREEN)Starting cloudflared tunnel...$(NC)"
	@echo "$(YELLOW)Run 'make dev' in another terminal first$(NC)"
	docker run --rm -it --network host cloudflare/cloudflared:latest tunnel --no-autoupdate --url http://localhost:3000

start: build ## Build and start production server
	@if lsof -ti:3000 > /dev/null 2>&1; then \
		echo "$(YELLOW)Port 3000 in use, stopping existing process...$(NC)"; \
		lsof -ti:3000 | xargs kill -9 2>/dev/null || true; \
		sleep 1; \
	fi
	@echo "$(GREEN)Starting Go server...$(NC)"
	DIST_DIR=dist $(SERVER_BIN)

stop: ## Stop server
	@echo "$(YELLOW)Stopping server...$(NC)"
	@if lsof -ti:3000 > /dev/null 2>&1; then \
		lsof -ti:3000 | xargs kill -9 2>/dev/null || true; \
		echo "$(GREEN)Server stopped$(NC)"; \
	else \
		echo "$(YELLOW)No process running on port 3000$(NC)"; \
	fi

##@ Confluence Cloud (Docker)

cloud-dev: ## Start dev mode with hot-reload + tunnel
	@echo "$(GREEN)Starting dev mode with tunnel...$(NC)"
	@if docker compose version > /dev/null 2>&1; then \
		docker compose -f docker-compose.dev.yml up --build; \
	else \
		docker-compose -f docker-compose.dev.yml up --build; \
	fi

cloud-dev-stop: ## Stop dev mode
	@if docker compose version > /dev/null 2>&1; then \
		docker compose -f docker-compose.dev.yml down; \
	else \
		docker-compose -f docker-compose.dev.yml down; \
	fi

cloud-start: ## Start server + tunnel (production mode)
	@echo "$(GREEN)Starting server + tunnel for Confluence Cloud...$(NC)"
	@if docker compose version > /dev/null 2>&1; then \
		docker compose -f docker-compose.cloud.yml up --build; \
	else \
		docker-compose -f docker-compose.cloud.yml up --build; \
	fi

cloud-start-bg: ## Start server + tunnel in background
	@echo "$(GREEN)Starting server + tunnel (background)...$(NC)"
	@if docker compose version > /dev/null 2>&1; then \
		docker compose -f docker-compose.cloud.yml up -d --build; \
	else \
		docker-compose -f docker-compose.cloud.yml up -d --build; \
	fi
	@echo ""
	@echo "$(YELLOW)Waiting for tunnel URL...$(NC)"
	@sleep 10
	@$(MAKE) cloud-url

cloud-stop: ## Stop cloud services
	@echo "$(YELLOW)Stopping cloud services...$(NC)"
	@if docker compose version > /dev/null 2>&1; then \
		docker compose -f docker-compose.cloud.yml down; \
	else \
		docker-compose -f docker-compose.cloud.yml down; \
	fi
	@echo "$(GREEN)Cloud services stopped$(NC)"

cloud-logs: ## View tunnel logs to get URL
	@echo "$(GREEN)Tunnel logs (look for trycloudflare.com URL)...$(NC)"
	@if docker compose version > /dev/null 2>&1; then \
		docker compose -f docker-compose.cloud.yml logs tunnel; \
	else \
		docker-compose -f docker-compose.cloud.yml logs tunnel; \
	fi

cloud-url: ## Show current tunnel URL
	@echo "$(GREEN)Current tunnel URL:$(NC)"
	@if docker compose version > /dev/null 2>&1; then \
		docker compose -f docker-compose.cloud.yml logs tunnel 2>/dev/null | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' | tail -1 || echo "$(RED)Tunnel not running or URL not found$(NC)"; \
	else \
		docker-compose -f docker-compose.cloud.yml logs tunnel 2>/dev/null | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' | tail -1 || echo "$(RED)Tunnel not running or URL not found$(NC)"; \
	fi
	@echo ""
	@echo "$(YELLOW)Install in Confluence Cloud: <tunnel-url>/confluence/atlassian-connect.json$(NC)"

##@ Deployment (Google App Engine)

GAE_PROJECT := excaliframe
GAE_URL := https://$(GAE_PROJECT).appspot.com

gae-deploy: build ## Build and deploy to Google App Engine
	@echo "$(GREEN)Deploying to Google App Engine...$(NC)"
	@echo "$(YELLOW)Project: $(GAE_PROJECT)$(NC)"
	@echo ""
	@echo "$(YELLOW)Step 1: Updating baseUrl to $(GAE_URL)...$(NC)"
	@if [[ "$$(uname)" == "Darwin" ]]; then \
		sed -i '' 's|"baseUrl": "[^"]*"|"baseUrl": "$(GAE_URL)"|g' atlassian-connect.json; \
	else \
		sed -i 's|"baseUrl": "[^"]*"|"baseUrl": "$(GAE_URL)"|g' atlassian-connect.json; \
	fi
	@cp atlassian-connect.json dist/
	@echo ""
	@echo "$(YELLOW)Step 2: Deploying to GAE...$(NC)"
	@gcloud app deploy --project=$(GAE_PROJECT) --quiet
	@echo ""
	@echo "$(GREEN)Deployed to $(GAE_URL)$(NC)"
	@echo ""
	@echo "$(YELLOW)Install in Confluence Cloud:$(NC)"
	@echo "   $(GAE_URL)/confluence/atlassian-connect.json"

gae-logs: ## View App Engine logs
	@gcloud app logs tail -s default --project=$(GAE_PROJECT)

gae-browse: ## Open App Engine app in browser
	@gcloud app browse --project=$(GAE_PROJECT)

gae-describe: ## Show App Engine deployment info
	@gcloud app describe --project=$(GAE_PROJECT)

##@ Utilities

validate-json: ## Validate atlassian-connect.json schema
	@node scripts/validate-connect-json.js

update-url: ## Update baseUrl (usage: make update-url URL=https://example.com)
	@if [ -z "$(URL)" ]; then \
		echo "$(RED)Error: URL is required$(NC)"; \
		echo "Usage: make update-url URL=https://example.com"; \
		exit 1; \
	fi
	@node scripts/update-baseurl.js $(URL)

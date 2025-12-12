.PHONY: help install build dev start stop clean validate-json update-url dev-tunnel cloud-dev cloud-dev-stop cloud-start cloud-start-bg cloud-stop cloud-logs cloud-url gae-deploy gae-logs gae-browse gae-describe deploy-info

# Default target
.DEFAULT_GOAL := help

# Colors for output
GREEN := \033[0;32m
YELLOW := \033[1;33m
RED := \033[0;31m
NC := \033[0m # No Color

##@ General

help: ## Display this help message
	@echo "$(GREEN)Excaliframe - Confluence Cloud Plugin for Excalidraw$(NC)"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Available targets:"
	@awk 'BEGIN {FS = ":.*##"; printf ""} /^[a-zA-Z_-]+:.*?##/ { printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2 } /^##@/ { printf "\n$(YELLOW)%s$(NC)\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Setup

install: ## Install npm dependencies
	@echo "$(GREEN)Installing dependencies...$(NC)"
	npm install

##@ Build

build: ## Build plugin (webpack + server + copy assets)
	@echo "$(GREEN)Building plugin...$(NC)"
	npm run build
	@echo "$(GREEN)Build complete$(NC)"

type-check: ## Run TypeScript type checking
	@echo "$(GREEN)Type checking...$(NC)"
	npm run type-check

clean: ## Remove build artifacts
	@echo "$(YELLOW)Cleaning build artifacts...$(NC)"
	rm -rf dist/
	@echo "$(GREEN)Clean complete$(NC)"

##@ Development

dev: ## Start dev server with hot reload
	@echo "$(GREEN)Starting dev server with hot reload...$(NC)"
	@echo "$(YELLOW)Changes to src/ will hot reload instantly$(NC)"
	npm run dev

dev-tunnel: ## Start cloudflared tunnel (run alongside 'make dev')
	@echo "$(GREEN)Starting cloudflared tunnel...$(NC)"
	@echo "$(YELLOW)Run 'make dev' in another terminal first$(NC)"
	docker run --rm -it --network host cloudflare/cloudflared:latest tunnel --no-autoupdate --url http://localhost:3000

start: ## Start production server locally
	@if lsof -ti:3000 > /dev/null 2>&1; then \
		echo "$(YELLOW)Port 3000 in use, stopping existing process...$(NC)"; \
		lsof -ti:3000 | xargs kill -9 2>/dev/null || true; \
		sleep 1; \
	fi
	@echo "$(GREEN)Starting plugin server...$(NC)"
	npm start

stop: ## Stop plugin server
	@echo "$(YELLOW)Stopping plugin server...$(NC)"
	@if lsof -ti:3000 > /dev/null 2>&1; then \
		lsof -ti:3000 | xargs kill -9 2>/dev/null || true; \
		echo "$(GREEN)Plugin server stopped$(NC)"; \
	else \
		echo "$(YELLOW)No process running on port 3000$(NC)"; \
	fi

##@ Confluence Cloud

cloud-dev: ## Start dev mode with hot-reload + tunnel (recommended)
	@echo "$(GREEN)Starting dev mode with hot-reload + tunnel...$(NC)"
	@echo "$(YELLOW)Changes to src/ will hot reload instantly$(NC)"
	@if docker compose version > /dev/null 2>&1; then \
		docker compose -f docker-compose.dev.yml up; \
	else \
		docker-compose -f docker-compose.dev.yml up; \
	fi

cloud-dev-stop: ## Stop dev mode
	@if docker compose version > /dev/null 2>&1; then \
		docker compose -f docker-compose.dev.yml down; \
	else \
		docker-compose -f docker-compose.dev.yml down; \
	fi

cloud-start: ## Start plugin server + tunnel (production mode)
	@echo "$(GREEN)Starting plugin + tunnel for Confluence Cloud...$(NC)"
	@if docker compose version > /dev/null 2>&1; then \
		docker compose -f docker-compose.cloud.yml up --build; \
	else \
		docker-compose -f docker-compose.cloud.yml up --build; \
	fi

cloud-start-bg: ## Start plugin server + tunnel in background
	@echo "$(GREEN)Starting plugin + tunnel (background)...$(NC)"
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

gae-deploy: ## Build and deploy to Google App Engine
	@echo "$(GREEN)Deploying to Google App Engine...$(NC)"
	@echo "$(YELLOW)Project: $(GAE_PROJECT)$(NC)"
	@echo ""
	@echo "$(YELLOW)Step 1: Building...$(NC)"
	@npm run build
	@echo ""
	@echo "$(YELLOW)Step 2: Updating baseUrl to $(GAE_URL)...$(NC)"
	@if [[ "$$(uname)" == "Darwin" ]]; then \
		sed -i '' 's|"baseUrl": "[^"]*"|"baseUrl": "$(GAE_URL)"|g' atlassian-connect.json; \
	else \
		sed -i 's|"baseUrl": "[^"]*"|"baseUrl": "$(GAE_URL)"|g' atlassian-connect.json; \
	fi
	@cp atlassian-connect.json dist/
	@echo ""
	@echo "$(YELLOW)Step 3: Deploying to GAE...$(NC)"
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

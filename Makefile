.PHONY: help install build dev start stop restart status logs logs-db test test-connectivity quick-start clean reset confluence-start confluence-stop confluence-restart confluence-status setup-dirs check-status check-port kill-port reset-db check-db check-resources

# Default target
.DEFAULT_GOAL := help

# Colors for output
GREEN := \033[0;32m
YELLOW := \033[1;33m
RED := \033[0;31m
NC := \033[0m # No Color

##@ General

help: ## Display this help message
	@echo "$(GREEN)Excalfluence - Confluence Plugin for Excalidraw$(NC)"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Available targets:"
	@awk 'BEGIN {FS = ":.*##"; printf ""} /^[a-zA-Z_-]+:.*?##/ { printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2 } /^##@/ { printf "\n$(YELLOW)%s$(NC)\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Setup

install: ## Install npm dependencies
	@echo "$(GREEN)📦 Installing dependencies...$(NC)"
	npm install

setup-dirs: ## Create data directories for persistent storage
	@echo "$(GREEN)📁 Setting up data directories...$(NC)"
	@./scripts/setup-data-dirs.sh

quick-start: setup-dirs install build confluence-start ## Complete automated setup
	@echo ""
	@echo "$(GREEN)✅ Quick start complete!$(NC)"
	@echo ""
	@echo "📝 Next steps:"
	@echo "   1. Start plugin server: $(GREEN)make start$(NC)"
	@echo "   2. Open Confluence: http://localhost:8090"
	@echo "   3. Complete setup wizard"
	@echo "   4. Get license: https://my.atlassian.com/products/index?evaluation=true"
	@echo "   5. Install plugin: Settings → Manage Apps → Upload app"
	@echo "      Use: http://host.docker.internal:3000/atlassian-connect.json"
	@echo ""
	@echo "💡 Note: Plugin server is not started automatically."
	@echo "   Run $(GREEN)make start$(NC) in a separate terminal to start it."

##@ Build

build: ## Build plugin (webpack + server)
	@echo "$(GREEN)🏗️  Building plugin...$(NC)"
	npm run build

build-webpack: ## Build webpack bundles only
	@echo "$(GREEN)🏗️  Building webpack bundles...$(NC)"
	npm run build:webpack

build-server: ## Build server TypeScript only
	@echo "$(GREEN)🏗️  Building server...$(NC)"
	npm run build:server

type-check: ## Run TypeScript type checking
	@echo "$(GREEN)🔍 Type checking...$(NC)"
	npm run type-check

##@ Development

dev: ## Start webpack in watch mode
	@echo "$(GREEN)👀 Starting webpack watch mode...$(NC)"
	npm run dev

dev-server: ## Start development server (ts-node)
	@echo "$(GREEN)🚀 Starting development server...$(NC)"
	npm run dev:server

start: ## Start production server
	@if lsof -ti:3000 > /dev/null 2>&1; then \
		echo "$(YELLOW)⚠️  Port 3000 is already in use$(NC)"; \
		echo "   Stopping existing process..."; \
		lsof -ti:3000 | xargs kill -9 2>/dev/null || true; \
		sleep 1; \
	fi
	@echo "$(GREEN)🚀 Starting production server...$(NC)"
	@npm start

stop: ## Stop plugin server
	@echo "$(YELLOW)🛑 Stopping plugin server...$(NC)"
	@if lsof -ti:3000 > /dev/null 2>&1; then \
		lsof -ti:3000 | xargs kill -9 2>/dev/null || true; \
		echo "$(GREEN)✅ Plugin server stopped$(NC)"; \
	else \
		echo "$(YELLOW)ℹ️  No process running on port 3000$(NC)"; \
	fi

##@ Confluence

confluence-start: setup-dirs ## Start PostgreSQL and Confluence Server
	@echo "$(GREEN)🐳 Starting PostgreSQL and Confluence Server...$(NC)"
	@if docker compose version > /dev/null 2>&1; then \
		docker compose pull postgres confluence; \
		docker compose up -d postgres confluence; \
	else \
		docker-compose pull postgres confluence; \
		docker-compose up -d postgres confluence; \
	fi
	@echo ""
	@echo "$(YELLOW)⏳ Waiting for services to start...$(NC)"
	@echo "   Check status: make status"
	@echo "   View logs: make logs"

confluence-stop: ## Stop PostgreSQL and Confluence Server
	@echo "$(YELLOW)🛑 Stopping Confluence services...$(NC)"
	@if docker compose version > /dev/null 2>&1; then \
		docker compose stop; \
	else \
		docker-compose stop; \
	fi
	@echo "$(GREEN)✅ Services stopped$(NC)"

confluence-restart: confluence-stop confluence-start ## Restart Confluence services

confluence-status: ## Check status of Confluence services
	@./scripts/check-status.sh

confluence-reset: ## ⚠️ Remove all Confluence data and restart
	@echo "$(RED)⚠️  WARNING: This will delete all Confluence data!$(NC)"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		if docker compose version > /dev/null 2>&1; then \
			docker compose down -v; \
		else \
			docker-compose down -v; \
		fi; \
		rm -rf data/; \
		./scripts/setup-data-dirs.sh; \
		echo "$(GREEN)✅ Data reset complete$(NC)"; \
	else \
		echo "$(YELLOW)Cancelled$(NC)"; \
	fi

reset-db: ## Reset Confluence database only (keeps containers)
	@./scripts/reset-database.sh

check-db: ## Check database status and table creation progress
	@./scripts/check-db-status.sh

check-resources: ## Check Docker Desktop resource allocation
	@./scripts/check-docker-resources.sh

##@ Logs

logs: ## View Confluence logs
	@echo "$(GREEN)📋 Confluence logs (Ctrl+C to exit)...$(NC)"
	docker logs -f confluence-server

logs-db: ## View PostgreSQL logs
	@echo "$(GREEN)📋 PostgreSQL logs (Ctrl+C to exit)...$(NC)"
	docker logs -f confluence-postgres

logs-all: ## View all logs (Confluence + PostgreSQL)
	@echo "$(GREEN)📋 All logs (Ctrl+C to exit)...$(NC)"
	@if docker compose version > /dev/null 2>&1; then \
		docker compose logs -f; \
	else \
		docker-compose logs -f; \
	fi

##@ Testing

test: test-connectivity ## Run all tests

test-connectivity: ## Test connectivity between services
	@./scripts/test-connectivity.sh

status: confluence-status ## Check status of all services (alias for confluence-status)

check-status: confluence-status ## Check status of all services (alias for confluence-status)

##@ Cleanup

clean: ## Remove build artifacts
	@echo "$(YELLOW)🧹 Cleaning build artifacts...$(NC)"
	rm -rf dist/
	@echo "$(GREEN)✅ Clean complete$(NC)"

clean-all: clean stop confluence-stop ## Clean everything except data
	@echo "$(YELLOW)🧹 Cleaning everything except data...$(NC)"
	rm -rf node_modules/
	@echo "$(GREEN)✅ Clean complete$(NC)"

reset: confluence-reset ## ⚠️ Reset everything including data (alias for confluence-reset)

##@ Utilities

update-url: ## Update baseUrl in atlassian-connect.json (usage: make update-url URL=https://example.com)
	@if [ -z "$(URL)" ]; then \
		echo "$(RED)❌ Error: URL is required$(NC)"; \
		echo "Usage: make update-url URL=https://example.com"; \
		exit 1; \
	fi
	@node scripts/update-baseurl.js $(URL)

tunnel-ngrok: ## Start ngrok tunnel
	@echo "$(GREEN)🌐 Starting ngrok tunnel...$(NC)"
	ngrok http 3000

tunnel-lt: ## Start localtunnel
	@echo "$(GREEN)🌐 Starting localtunnel...$(NC)"
	npx localtunnel --port 3000

check-port: ## Check if port 3000 is in use (usage: make check-port PORT=3000)
	@./scripts/check-port.sh $(PORT) check

kill-port: ## Kill process using port 3000 (usage: make kill-port PORT=3000)
	@echo "$(YELLOW)🛑 Killing process on port $(PORT)...$(NC)"
	@./scripts/check-port.sh $(PORT) kill || echo "$(YELLOW)No process found on port $(PORT)$(NC)"

##@ Info

info: ## Show project information
	@echo "$(GREEN)Excalfluence - Project Information$(NC)"
	@echo ""
	@echo "Confluence:"
	@echo "  URL: http://localhost:8090"
	@echo "  Status: $$(docker ps --filter name=confluence-server --format '{{.Status}}' 2>/dev/null || echo 'Not running')"
	@echo ""
	@echo "PostgreSQL:"
	@echo "  Port: 5432"
	@echo "  Status: $$(docker ps --filter name=confluence-postgres --format '{{.Status}}' 2>/dev/null || echo 'Not running')"
	@echo ""
	@echo "Plugin Server:"
	@echo "  URL: http://localhost:3000"
	@echo "  Status: $$(lsof -ti:3000 > /dev/null 2>&1 && echo 'Running' || echo 'Not running')"
	@echo ""
	@echo "Data Directories:"
	@echo "  PostgreSQL: ./data/postgres"
	@echo "  Confluence: ./data/confluence"
	@echo ""
	@echo "Database Configuration (for Confluence setup wizard):"
	@echo "  Type: PostgreSQL"
	@echo "  Hostname: postgres"
	@echo "  Port: 5432"
	@echo "  Database: confluence"
	@echo "  Username: confluence"
	@echo "  Password: confluence"
	@echo ""
	@echo "Useful Commands:"
	@echo "  make help          - Show this help"
	@echo "  make quick-start   - Complete automated setup"
	@echo "  make status        - Check service status"
	@echo "  make logs          - View Confluence logs"
	@echo ""
	@echo "$(YELLOW)Note:$(NC) PostgreSQL 'relation does not exist' errors are normal"
	@echo "      during Confluence initialization. Complete the setup wizard"
	@echo "      to create all required tables."

.PHONY: help install build playground-build dev type-check clean deploy install-app tunnel lint sync diff sync-status migrate

# Default target
.DEFAULT_GOAL := help

# Load target from .excalrc if it exists and TARGET not set on command line
-include .excalrc

# Colors for output
GREEN := \033[0;32m
YELLOW := \033[1;33m
RED := \033[0;31m
NC := \033[0m # No Color

##@ General

help: ## Display this help message
	@echo "$(GREEN)Excaliframe - Atlassian Forge App for Excalidraw$(NC)"
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

build: ## Build frontend assets for Forge
	@echo "$(GREEN)Building frontend assets...$(NC)"
	npm run build
	@echo "$(GREEN)Build output: dist/forge/$(NC)"

type-check: ## Run TypeScript type checking
	@echo "$(GREEN)Type checking...$(NC)"
	npm run type-check

clean: ## Remove build artifacts
	@echo "$(YELLOW)Cleaning build artifacts...$(NC)"
	rm -rf dist/
	@echo "$(GREEN)Clean complete$(NC)"

playground-build: ## Build playground bundle for site
	@echo "$(GREEN)Building playground assets...$(NC)"
	npx webpack --config webpack.playground.js --mode production
	@echo "$(GREEN)Build output: site/static/playground/excalidraw/$(NC)"

lint: ## Run lint checks
	@echo "$(GREEN)Running lint checks...$(NC)"
	npm run type-check

##@ Development

dev: ## Watch mode - rebuild on file changes
	@echo "$(GREEN)Starting watch mode...$(NC)"
	@echo "$(YELLOW)Run 'make tunnel' in another terminal for live testing$(NC)"
	npm run dev

tunnel: build ## Start Forge tunnel for local development
	@echo "$(GREEN)Starting Forge tunnel...$(NC)"
	@echo "$(YELLOW)Make sure you have deployed at least once first$(NC)"
	forge tunnel

##@ Deployment

deploy-dev: build ## Deploy to development environment (for your testing)
	@echo "$(GREEN)Deploying to DEVELOPMENT environment...$(NC)"
	forge deploy -e development --no-verify
	@echo ""
	@echo "$(GREEN)Development deployment complete!$(NC)"

deploy-prod: build ## Deploy to production environment (for company use)
	@echo "$(GREEN)Deploying to PRODUCTION environment...$(NC)"
	forge deploy -e production --no-verify
	@echo ""
	@echo "$(GREEN)Production deployment complete!$(NC)"
	@echo "$(YELLOW)Share with your company: they can install via 'forge install -e production'$(NC)"

deploy: deploy-dev ## Alias for deploy-dev

install-dev: ## Install dev version on a Confluence site
	@echo "$(GREEN)Installing DEVELOPMENT version...$(NC)"
	forge install -e development -p Confluence

install-prod: ## Install production version on a Confluence site
	@echo "$(GREEN)Installing PRODUCTION version...$(NC)"
	forge install -e production -p Confluence

install-app: install-dev ## Alias for install-dev

register: ## Register a new Forge app (first time only)
	@echo "$(GREEN)Registering new Forge app...$(NC)"
	forge register

##@ Forge CLI Shortcuts

logs: ## View Forge app logs
	forge logs

lint-manifest: ## Validate manifest.yml
	forge lint

environments: ## List Forge environments
	forge environment list

##@ Quick Start

setup: install register ## First-time setup: install deps + register app
	@echo "$(GREEN)Setup complete!$(NC)"
	@echo ""
	@echo "$(YELLOW)Next steps:$(NC)"
	@echo "  1. Run 'make deploy' to deploy the app"
	@echo "  2. Run 'make install-app' to install on Confluence"

quickstart: install build deploy install-app ## Full setup: install, build, deploy, and install app
	@echo "$(GREEN)Quickstart complete! App is now installed.$(NC)"

##@ Sync (Enterprise Distribution)

sync: ## Preview sync to enterprise target (add COMMIT=1 to apply, FORCE=1 to overwrite)
	@python3 tools/sync.py sync "$(TARGET)" $(if $(filter 1,$(COMMIT)),--commit) $(if $(filter 1,$(FORCE)),--force)

diff: ## Show diff between source and enterprise target
	@python3 tools/sync.py diff "$(TARGET)"

sync-status: ## Show what changed since last sync
	@python3 tools/sync.py status "$(TARGET)"

migrate: ## One-time migration: restructure enterprise target into excaliframe/ subdirectory
	@python3 tools/sync.py migrate "$(TARGET)"

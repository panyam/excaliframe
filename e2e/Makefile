.PHONY: setup test test-headed test-debug test-ipdb list describe report

.DEFAULT_GOAL := test

# Colors
GREEN := \033[0;32m
NC := \033[0m

setup: ## Install dependencies and browser (first time)
	uv sync && uv run playwright install chromium
	@echo "$(GREEN)E2E setup complete$(NC)"

test: ## Run tests headless
	uv run pytest --browser chromium $(if $(K),-k $(K))

test-headed: ## Run tests with visible browser + slow-motion
	uv run pytest --browser chromium --headed --slowmo=500 $(if $(K),-k $(K))

test-debug: ## Step-through with ipdb (drop `import ipdb; ipdb.set_trace()` in tests)
	uv run pytest --browser chromium --headed -s --slowmo=500 $(if $(K),-k $(K))

test-ipdb: ## Alias for test-debug
	$(MAKE) test-debug $(if $(K),K=$(K))

test-insp: ## Step-through with Playwright Inspector (UI)
	PWDEBUG=1 uv run pytest --browser chromium --headed $(if $(K),-k $(K))

list: ## List all tests (filter: make list T=collab)
	@uv run python list_tests.py $(T)

describe: ## Show test details (usage: make describe T=encryption)
	@uv run python list_tests.py -v $(T)

report: ## Open last HTML test report
	uv run playwright show-report playwright-report

help: ## Show this help
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*?##/ { printf "  $(GREEN)%-15s$(NC) %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

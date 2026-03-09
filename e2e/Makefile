.PHONY: setup test test-headed test-debug test-ipdb test-insp list describe report screens

.DEFAULT_GOAL := test

# Colors
GREEN := \033[0;32m
NC := \033[0m

setup: ## Install dependencies and browser (first time)
	uv sync && uv run playwright install chromium
	@echo "$(GREEN)E2E setup complete$(NC)"

test: ## Run tests headless (add X=1 to stop on first failure)
	PWDEBUG= uv run pytest --browser chromium $(if $(X),-x) $(if $(K),-k $(K))

test-headed: ## Run tests with visible browser + slow-motion (add X=1 to stop on first failure)
	uv run pytest --browser chromium --headed --slowmo=1000 $(if $(X),-x) $(if $(K),-k $(K))

test-debug: ## Step-through with ipdb, stops on first failure
	uv run pytest --browser chromium --headed -s -x --slowmo=1000 $(if $(K),-k $(K))

test-ipdb: ## Alias for test-debug
	$(MAKE) test-debug $(if $(K),K=$(K))

test-insp: ## Step-through with Playwright Inspector (UI), stops on first failure
	PWDEBUG=1 uv run pytest --browser chromium --headed -x $(if $(K),-k $(K))

list: ## List all tests (filter: make list T=collab)
	@uv run python list_tests.py $(T)

describe: ## Show test details (usage: make describe T=encryption)
	@uv run python list_tests.py -v $(T)

report: ## Open last HTML test report
	uv run playwright show-report playwright-report

screens: ## Show display origins (use with E2E_WINDOW_X/Y)
	@osascript -e 'tell application "Finder" to get bounds of window of desktop' 2>/dev/null | \
		awk -F', ' '{printf "  Desktop bounds: origin=(%s, %s) size=(%s x %s)\n  Use: E2E_WINDOW_X=%s E2E_WINDOW_Y=%s make test-debug\n", $$1, $$2, $$3-$$1, $$4-$$2, $$1, $$2}' || \
		echo "Could not detect display layout"

help: ## Show this help
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*?##/ { printf "  $(GREEN)%-15s$(NC) %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

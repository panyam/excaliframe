.PHONY: setup test test-headed test-debug test-ipdb test-insp list describe report screens \
       confluence-login confluence-test confluence-test-headed confluence-test-debug fixtures

.DEFAULT_GOAL := test

# Colors
GREEN := \033[0;32m
NC := \033[0m

setup: ## Install dependencies and browser (first time)
	uv sync && uv run playwright install chromium
	uv sync && uv run playwright install firefox
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

test-cross: ## Run cross-browser collab tests (Chrome owner + Firefox follower)
	PWDEBUG= uv run pytest --browser chromium -k "cross_browser" $(if $(X),-x)

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

# ── Confluence Forge plugin tests ─────────────────────────────────────

ACCOUNT ?= personal

confluence-login: ## Save Confluence auth state (usage: make confluence-login ACCOUNT=personal)
	@echo "Opening browser — log into Confluence, then close the browser window."
	@echo "Auth state will be saved to confluence/auth-$(ACCOUNT).json"
	uv run python -c "\
	from playwright.sync_api import sync_playwright; \
	p = sync_playwright().start(); \
	b = p.chromium.launch(headless=False); \
	ctx = b.new_context(); \
	page = ctx.new_page(); \
	import json; \
	acct = json.load(open('confluence/accounts.json')).get('$(ACCOUNT)', {}); \
	page.goto(acct.get('url', 'https://atlassian.net') + '/wiki'); \
	input('Press Enter after logging in...'); \
	ctx.storage_state(path='confluence/auth-$(ACCOUNT).json'); \
	print('Auth saved to confluence/auth-$(ACCOUNT).json'); \
	b.close(); p.stop()"

confluence-test: ## Run Confluence tests headless (ACCOUNT=personal, K=filter, X=1 stop on fail)
	uv run pytest confluence/ --browser chromium \
		--account=$(ACCOUNT) --create-page \
		$(if $(X),-x) $(if $(K),-k $(K))

confluence-test-headed: ## Run Confluence tests with visible browser
	uv run pytest confluence/ --browser chromium --headed --slowmo=500 \
		--account=$(ACCOUNT) --create-page \
		$(if $(X),-x) $(if $(K),-k $(K))

confluence-test-debug: ## Debug Confluence tests (headed, stops on fail, interactive)
	uv run pytest confluence/ --browser chromium --headed -s -x --slowmo=500 \
		--account=$(ACCOUNT) --create-page --keep-page \
		$(if $(K),-k $(K))

# ── Fixtures ─────────────────────────────────────────────────────────

fixtures: ## Generate all fixture sizes (a5-a0)
	@for size in a5 a4 a3 a2 a1 a0; do \
		uv run python fixtures/generate.py $$size; \
	done

# ── Help ─────────────────────────────────────────────────────────────

help: ## Show this help
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*?##/ { printf "  $(GREEN)%-15s$(NC) %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

# Bruno Development Makefile
# Requires: nvm with Node v22.12.0 installed
SHELL := /bin/zsh
NVM := source $$HOME/.nvm/nvm.sh && nvm use 22.12.0 &&

.PHONY: help setup install build build-deps build-web dev dev-watch clean lint test-e2e

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

setup: ## Full clean setup (rm node_modules, install, build all)
	$(NVM) npm run setup

install: ## Install dependencies only
	$(NVM) npm i --legacy-peer-deps

build-deps: ## Build all internal packages (common, query, requests, etc.)
	$(NVM) npm run build:graphql-docs && \
	npm run build:bruno-query && \
	npm run build:bruno-common && \
	npm run build:bruno-converters && \
	npm run build:bruno-requests && \
	npm run build:schema-types && \
	npm run build:bruno-filestore

build-web: ## Build the renderer app (bruno-app)
	$(NVM) npm run build:web

build: build-deps build-web ## Build deps + web app

dev: ## Start dev environment (rsbuild + electron)
	$(NVM) npm run dev

dev-watch: ## Start dev with hot reload on all packages
	$(NVM) npm run dev:watch

dev-web: ## Start only the web dev server (no electron)
	$(NVM) npm run dev:web

dev-electron: ## Start only electron (expects dev server already running)
	$(NVM) npm run dev:electron

rebuild: build-deps ## Rebuild deps and restart dev
	$(NVM) npm run dev

fix-perms: ## Fix node_modules ownership (after accidental sudo npm)
	sudo chown -R $$(whoami) node_modules .husky 2>/dev/null || true
	sudo find ./packages -name 'node_modules' -type d -maxdepth 2 -exec chown -R $$(whoami) {} + 2>/dev/null || true

clean: ## Remove all node_modules and dist folders
	find . -name 'node_modules' -type d -maxdepth 3 -exec rm -rf {} + 2>/dev/null || true
	find ./packages -name 'dist' -type d -maxdepth 3 -exec rm -rf {} + 2>/dev/null || true

lint: ## Run eslint
	$(NVM) npm run lint

lint-fix: ## Run eslint with auto-fix
	$(NVM) npm run lint:fix

test-e2e: ## Run Playwright e2e tests
	$(NVM) npm run test:e2e

build-electron-mac: ## Package electron app for macOS
	$(NVM) npm run build:electron:mac



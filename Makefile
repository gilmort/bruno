# Bruno (fork plugin-manager) — build e instalação local.
#
# Instala por SYMLINK, não por cópia: `make install` aponta
# ~/Applications/Bruno.app direto para o .app gerado em
# packages/bruno-electron/out/mac-arm64/. Testamos e o Finder/Launchpad/`open`
# tratam o link exatamente como o .app real — então depois do primeiro
# `make install`, qualquer `make package` subsequente já deixa o atalho
# atualizado sozinho, sem reinstalar nada.
SHELL := /bin/bash
ARCH := arm64
APP := packages/bruno-electron/out/mac-$(ARCH)/Bruno.app
DEST ?= $$HOME/Applications/Bruno.app

.PHONY: help deps web electron package install uninstall run clean

help: ## Mostra esta ajuda
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-12s\033[0m %s\n", $$1, $$2}'

deps: ## Builda os pacotes internos do monorepo (bruno-common, filestore, io, sqlite, ...)
	npm run build:graphql-docs
	npm run build:bruno-query
	npm run build:bruno-common
	npm run build:bruno-converters
	npm run build:bruno-requests
	npm run build:schema-types
	npm run build:bruno-filestore
	npm run build:bruno-io
	npm run build:bruno-sqlite
	npm run sandbox:bundle-libraries --workspace=packages/bruno-js

web: deps ## Builda o frontend (bruno-app) e copia pra packages/bruno-electron/web
	npm run build:web
	# electron-builder empacota packages/bruno-electron/web, não o dist/ do bruno-app —
	# sem esta cópia o .app fica sempre com o build anterior, por mais que o resto rode.
	rm -rf packages/bruno-electron/web
	mkdir packages/bruno-electron/web
	cp -r packages/bruno-app/dist/* packages/bruno-electron/web
	# Paths /static/... são absolutos e em file:// resolvem pra raiz do disco, não pro .app —
	# sem isto o JS/CSS dá 404 silencioso, o React nunca monta e a janela fica preta (sem
	# nenhum erro visível fora do DevTools). scripts/build-electron.sh faz o mesmo sed.
	sed -i '' -e 's@/static/@static/@g' packages/bruno-electron/web/*.html
	sed -i '' -e 's@/static/font@../../static/font@g' packages/bruno-electron/web/static/css/*.*.css
	find packages/bruno-electron/web -name '*.map' -type f -delete

electron: web ## Rebuilda o web e empacota o .app da arquitetura nativa (sem dmg/pkg/zip)
	# --dir pula notarização/assinatura real e os instaladores — não precisamos
	# disso para rodar localmente, só do .app em si.
	rm -rf packages/bruno-electron/out
	cd packages/bruno-electron && npx electron-builder --dir --config electron-builder-config.js --$(ARCH)
	@echo "empacotado: $(APP)"

package: electron ## Pipeline completo: pacotes internos + frontend + .app

install: ## Symlinka ~/Applications/Bruno.app para o .app gerado (atualiza sozinho a cada rebuild)
	@set -e; \
	if [ ! -d "$(APP)" ]; then echo "sem .app em $(APP) — rode 'make package' antes"; exit 1; fi; \
	dest="$(DEST)"; \
	if pgrep -f "$$dest/Contents/MacOS" >/dev/null 2>&1; then \
		echo "o app está rodando — feche-o antes"; exit 1; fi; \
	if [ -e "$$dest" ] && [ ! -L "$$dest" ]; then \
		rm -rf "$$dest.bak"; mv "$$dest" "$$dest.bak"; echo "anterior (não-link) guardado em $$dest.bak"; fi; \
	ln -sfn "$(CURDIR)/$(APP)" "$$dest"; \
	echo "symlink: $$dest -> $(CURDIR)/$(APP)"

uninstall: ## Remove o atalho de ~/Applications (nunca apaga o .app fonte)
	@dest="$(DEST)"; \
	if [ -L "$$dest" ]; then rm "$$dest"; echo "removido: $$dest"; \
	else echo "$$dest não é o symlink gerenciado por este Makefile — nada feito"; fi

run: ## Abre o app instalado
	open "$(DEST)"

clean: ## Remove o diretório de build do electron
	rm -rf packages/bruno-electron/out

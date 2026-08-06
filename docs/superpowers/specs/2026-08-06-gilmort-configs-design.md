# Gilmort Configs — Design

**Data:** 2026-08-06
**Branch base:** `masks`
**Pacotes:** `packages/bruno-app` (renderer, React+Redux), `packages/bruno-electron` (main, Electron)

## Objetivo

Adicionar ao Bruno um monitor de serviços locais por coleção:

1. Uma aba **"Gilmort Configs"** em CollectionSettings para configurar a lista de serviços monitorados (com export/import JSON).
2. Um **botão de status** no header da coleção (ao lado do seletor de environments): N quadrados com círculo verde/amarelo/vermelho por serviço.
3. Ao clicar no botão, abre uma **aba de live log** com `docker logs -f` dos containers.
4. Motor de status combinando **Docker (container up)** + **HTTP health-check**.

### Tabela de referência (caso de uso do usuário)

| Serviço | URL                                  | Status esperado                                |
|---------|--------------------------------------|------------------------------------------------|
| SPA     | GET http://localhost:3030/health/spa | 200                                            |
| BFF     | GET http://localhost:3030/health/bff | 200 `{"status":"UP"}`                          |
| BC      | GET http://localhost:3030/health/bc  | 200 `{"status":"UP"}`                          |
| ACL     | GET http://localhost:3030/health/acl | 502 (não sobe — o monitor detecta como down)   |

## Decisões (do brainstorming)

- **Fonte do status:** Docker + HTTP combinados.
- **Shape do serviço:** Nome + URL health + container + status esperado.
- **Persistência:** por coleção, no arquivo `bruno.json` (brunoConfig).
- **Polling:** contínuo enquanto a coleção está aberta (5s).
- **Live log:** `docker logs -f` dos 3 containers (spa/bff/bc), com filtro por serviço.
- **Semáforo:** verde = container up E HTTP esperado; amarelo = só um dos dois; vermelho = ambos falham.
- **JSON:** exportar e importar.
- **Arquitetura:** monitor no main process, renderer só desenha (abordagem A). Reusa os padrões existentes `system-monitor` (polling+push) e `TerminalManager` (spawn+stream). Necessário porque o CSP (`connect-src 'self'`) bloqueia HTTP a localhost no renderer.

## Restrição de arquitetura (por que tudo passa pelo main)

O CSP em `packages/bruno-electron/src/index.js:70-85` define `connect-src 'self' https://*.posthog.com`. Um `fetch('http://localhost:3030/...')` no renderer é bloqueado. **Não relaxar o CSP** — toda HTTP a localhost e todo streaming de docker passam por IPC pro main, como já é o resto do app.

---

## Seção 1 — Modelo de dados & persistência

Config no `bruno.json` (brunoConfig) da coleção, sob a chave `gilmort`:

```json
{
  "gilmort": {
    "services": [
      { "name": "SPA", "healthUrl": "http://localhost:3030/health/spa", "container": "spa", "expectedStatus": 200 },
      { "name": "BFF", "healthUrl": "http://localhost:3030/health/bff", "container": "bff", "expectedStatus": 200 },
      { "name": "BC",  "healthUrl": "http://localhost:3030/health/bc",  "container": "bc",  "expectedStatus": 200 },
      { "name": "ACL", "healthUrl": "http://localhost:3030/health/acl", "container": "acl", "expectedStatus": 502 }
    ]
  }
}
```

- `expectedStatus` resolve o caso ACL: 502 esperado → verde quando responde 502.
- **Export** = baixar `{ services: [...] }` como `gilmort-config.json`.
- **Import** = ler `.json`, validar `{ services: [...] }`, sobrescrever `services`.
- Persistência reusa o fluxo de save de brunoConfig. **Molde:** `CollectionSettings/ProxySettings` (edita brunoConfig e dispara a action de save existente).

**Campos:** `name` e `healthUrl` obrigatórios; `container` default `''`; `expectedStatus` default `200`.

---

## Seção 2 — Aba "Gilmort Configs"

Nova pasta `packages/bruno-app/src/components/CollectionSettings/GilmortConfigs/` (molde: `ProxySettings`).

Registro em `CollectionSettings/index.js` (3 pontos, chave idêntica `gilmortConfigs`):
- import do componente (bloco de imports, ~linhas 6-17);
- `case 'gilmortConfigs': return <GilmortConfigs collection={collection} />;` no `getTabPanel` (~65-98);
- `<div>` na tablist (~108-148) com `getTabClassname('gilmortConfigs')`, `onClick={() => setTab('gilmortConfigs')}`, `data-testid="collection-settings-tab-gilmortConfigs"`, label "Gilmort Configs".

Nenhuma mudança no Redux — `settingsSelectedTab` aceita qualquer string; o estilo `.tab`/`.active` casa por classe genérica.

Conteúdo da aba:
- **Tabela editável** — colunas Nome, URL health, Container, Status esperado; add/remove linha.
- **Exportar** — baixa `{ services: [...] }` como `gilmort-config.json`.
- **Importar** — file input, lê+valida+sobrescreve+salva.
- **Save** — persiste brunoConfig (mesma action do ProxySettings).

Validação no import: rejeita se não for array de objetos com `name`+`healthUrl`. `container`/`expectedStatus` caem em default.

---

## Seção 3 — Botão de status no header

Em `packages/bruno-app/src/components/RequestTabs/CollectionHeader/index.js`, botão à esquerda do `<EnvironmentSelector>` (dentro da `div.flex.flex-grow.gap-1.5.items-center.justify-end`, ~linhas 595-598), padrão `ToolHint` + `ActionIcon`.

**Visual:** componente `ServiceStatusIndicator` — N quadrados (um por serviço), cada um com círculo no meio. Sem serviços configurados, o botão não aparece.

**Semáforo (por serviço, Docker + HTTP):**
- 🟢 Verde — container up **E** HTTP retornou o `expectedStatus`.
- 🟡 Amarelo — só um dos dois bate (degradado).
- 🔴 Vermelho — container down **E** HTTP fora do esperado.
- ⚪ Cinza — ainda checando / primeira leitura.

**Tooltip (hover):** tabela por serviço com container (up/down) e HTTP (recebido vs esperado).

**Clique:** `dispatch(addTab({ uid: uuid(), collectionUid, type: 'gilmort-logs' }))` → abre a aba da Seção 5.

Fonte das cores: o push do motor (Seção 4), consumido pelo hook `useGilmortMonitor`.

---

## Seção 4 — Motor de status (main process)

Novo `packages/bruno-electron/src/ipc/gilmort-monitor.js` (molde: `app/system-monitor.js` + `ipc/system-monitor.js`).

Loop `setTimeout` auto-reagendado (5s). Por serviço da coleção ativa:
1. **HTTP** — `axios.get(healthUrl, { timeout: 3000, validateStatus: () => true })`; compara `res.status === expectedStatus`.
2. **Docker** — `docker inspect -f '{{.State.Running}}' <container>` via `child_process.execFile`; `true` = up, erro/inexistente = down. (Sem `container` configurado → passo Docker neutro.)
3. **Combina** nas 4 cores e faz push: `mainWindow.webContents.send('main:gilmort-status', { collectionUid, services: [...] })`.

**IPC:**
- `renderer:start-gilmort-monitoring` (invoke) — `{ collectionUid, services }`, começa o loop.
- `renderer:stop-gilmort-monitoring` (invoke) — para o loop.
- push contínuo em `main:gilmort-status`.

Registro em `packages/bruno-electron/src/index.js` (bloco ~460-472) e preload já expõe `invoke`/`on`.

**Renderer:** hook `useGilmortMonitor(collection)` — start ao abrir a coleção / quando `services` muda, ouve `main:gilmort-status`, guarda status local, entrega pro botão; stop no unmount.

**Cortes deliberados (ponytail):**
- **Um monitor por vez** — reinicia o loop na coleção ativa em vez de N loops paralelos. `ponytail:` teto = 1 coleção monitorada; várias simultâneas → Map de loops.
- **Docker via `docker inspect` direto**, sem SDK. Docker ausente → passo Docker = down; serviço cai pra amarelo/vermelho conforme o HTTP.

---

## Seção 5 — Aba de live log do Docker

Novo tipo de tab `gilmort-logs`, registrado:
- `RequestTabPanel/index.js` — `if (focusedTab.type === 'gilmort-logs') return <GilmortLogs collection={collection} />;`
- `RequestTabs/RequestTab/index.js` — `'gilmort-logs'` no array `specialTabs` (~162-176).
- `RequestTabs/RequestTab/SpecialTab.js` — `case 'gilmort-logs'` com `IconBrandDocker` + label "Docker Logs".
- `providers/ReduxStore/slices/tabs.js` — `'gilmort-logs'` em `nonReplaceableTabTypes` (~27-37): singleton por coleção, não-preview.

**Streaming** — novo `packages/bruno-electron/src/ipc/gilmort-logs.js` (molde: `ipc/terminal.js`):
- `gilmort-logs:start` (invoke) — `{ containers: [...] }`; um `spawn('docker', ['logs','-f','--tail','200', c])` por container; gera `sessionId`; cada linha vira `gilmort-logs:data:${sessionId}` com o nome do serviço prefixado.
- `gilmort-logs:stop` (send) — mata os processos da sessão.
- exit/erro em `gilmort-logs:exit:${sessionId}`.
- Cleanup guardado com `!sender.isDestroyed()`; kill em window close / app quit.

**Painel `GilmortLogs`** (`packages/bruno-app/src/components/GilmortLogs/`):
- Área rolável com auto-scroll; linhas prefixadas `[SPA]`/`[BFF]`/`[BC]`, coloridas por serviço.
- Filtro por serviço (checkboxes SPA/BFF/BC).
- Botões clear e pause-scroll.
- Subscreve os canais no mount, guarda unsubscribe fn, para no unmount.

**Cortes deliberados (ponytail):**
- Sem busca/regex no log (rolar + filtrar por serviço basta). `ponytail:` add regex se o volume exigir.
- ACL fora do live log (não sobe container); os 3 do monitor são spa/bff/bc.

---

## Arquivos afetados

**Novos (renderer):**
- `CollectionSettings/GilmortConfigs/index.js` (+ `StyledWrapper.js`)
- `RequestTabs/CollectionHeader/ServiceStatusIndicator/index.js` (+ `StyledWrapper.js`)
- `GilmortLogs/index.js` (+ `StyledWrapper.js`)
- `hooks/useGilmortMonitor/index.js`

**Novos (main):**
- `ipc/gilmort-monitor.js`
- `ipc/gilmort-logs.js`

**Modificados (renderer):**
- `CollectionSettings/index.js` (registrar aba)
- `RequestTabs/CollectionHeader/index.js` (botão)
- `RequestTabPanel/index.js` (render da aba de log)
- `RequestTabs/RequestTab/index.js` (`specialTabs`)
- `RequestTabs/RequestTab/SpecialTab.js` (ícone/label)
- `providers/ReduxStore/slices/tabs.js` (`nonReplaceableTabTypes`)

**Modificados (main):**
- `index.js` (registrar os 2 IPC handlers)

## Testes

- **Motor de status** (main): teste da função que combina Docker+HTTP nas 4 cores — a tabela de verdade (container up/down × HTTP esperado/não) → cor. É a lógica não-trivial; um teste cobre os 4 quadrantes + o caso ACL (502 esperado = verde).
- **Import de config:** validação rejeita JSON inválido, aceita válido, aplica defaults. Um teste.
- Segue o padrão de testes já existente nos pacotes.

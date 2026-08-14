# Sistema de plugins do Bruno — Design

**Data:** 2026-08-14
**Status:** Aprovado (design), pronto para plano de implementação
**Objetivo:** Permitir estender o Bruno com painéis de UI, itens de sidebar, botões de bottom bar e capacidades de backend **sem recompilar o app**, de forma compartilhável (pasta ou URL git).

---

## 1. Contexto e problema

Hoje o Bruno não tem conceito de plugin. Features customizadas (ex.: as features "Gilmort" — monitor de serviços, live log de docker, filesystem watcher) estão **hardcoded no core**:

- `bruno-electron/src/index.js` — `require()` no topo + `registerGilmortMonitorIpc(mainWindow, ...)` (~linha 476).
- `bruno-app/src/components/RequestTabPanel/index.js` — `if (tab.type === 'docker-logs') return <GilmortLogs/>` (~linha 275).
- Componentes React compilados no bundle webpack.

Consequência: cada feature nova exige editar o core e **recompilar**. Este design elimina isso.

### O que um plugin precisa fazer (requisitos)

1. **UI**: adicionar painéis/abas, itens de sidebar (menu lateral) e botões no bottom bar.
2. **Backend**: rodar código no main process do Electron (spawn docker, ler filesystem, sockets, APIs do SO).
3. **Hooks de request**: interceptar/transformar requests e responses (fase 2 — ver §11).

### Modelo de confiança

**Só o autor + colegas** (código revisado/confiável). Isso é uma decisão de design deliberada e **corta todo o custo de sandbox/permissões**: plugins rodam com Node completo no main process. Postura idêntica à do Obsidian: "instale apenas plugins que você revisou". A metade renderer do plugin permanece sem Node cru (ver §7).

### Distribuição

**Pasta local + URL git.** Ambos convergem para "uma pasta em `~/.bruno/plugins/`".

---

## 2. Abordagem escolhida

Avaliadas 3 formas de injetar UI num renderer webpack-bundled:

- **A (escolhida) — Bundle registrado num host global.** O host expõe `window.bruno` (React + funções `register*` + bridge). Cada plugin é um JS já buildado que chama `register(...)` ao carregar. Componentes React de verdade, poder total, aguenta painel rico (ex.: live log docker). Autor precisa de build step (esbuild com React externalizado) — aceitável para devs.
- **B — Iframe/webview + postMessage.** Isolamento total, mas item de sidebar e botão de bottom bar não cabem em iframe; ponte por mensagem para tudo fica truncada. Rejeitada.
- **C — UI declarativa (JSON).** Sem build, mas incapaz de painéis ricos. Rejeitada.

A confiança em colegas elimina o custo de segurança que tornaria A perigosa em contexto público.

### Validação por pesquisa (estado da arte)

- **Obsidian** é praticamente idêntico a A: `manifest.json` + `main.js` com deps embutidas, ciclo `onload/onunload`, modelo de confiança "só plugins revisados".
- **VS Code** valida a **ativação preguiçosa** e o `contributes` declarativo (host monta UI a partir do manifest sem rodar código do plugin).
- **Electron security** valida a postura "renderer sem Node cru; Node só no main via bridge".

Fontes: VS Code Activation Events / Contribution Points; Obsidian sample-plugin + lifecycle; Electron Security tutorial.

---

## 3. Anatomia de um plugin

Um plugin é uma **pasta** em `~/.bruno/plugins/<id>/`:

```
meu-plugin/
  manifest.json        # metadados + contribuições declarativas
  main.js              # (opcional) roda no Electron main — Node completo
  renderer.js          # (opcional) JS buildado — registra UI no window.bruno
  package.json         # deps do plugin (bundladas no build do renderer.js)
```

`manifest.json`:

```json
{
  "id": "docker-logs",
  "name": "Docker Logs",
  "version": "1.0.0",
  "main": "main.js",
  "renderer": "renderer.js",
  "contributes": {
    "panels":        [{ "id": "docker-logs",    "title": "Docker Logs" }],
    "sidebarItems":  [{ "id": "docker",         "title": "Docker", "icon": "IconBrandDocker" }],
    "bottomBarItems":[{ "id": "docker-status",  "title": "Docker" }]
  }
}
```

`contributes` é **declarativo**: informa ao host **o que existe** para montar os slots (ordenar, exibir ícone/título) **sem executar código do plugin**. O *comportamento* de cada item vem do `renderer.js`/`main.js` na ativação.

**Validação do manifest** na carga: `id` presente e único, `version` válida, campos obrigatórios. Manifest inválido → plugin ignorado com aviso (não crash).

---

## 4. Ativação preguiçosa (lazy)

Do padrão VS Code. No boot:

1. O host escaneia `~/.bruno/plugins/*`, lê e valida cada `manifest.json`.
2. Monta os **slots** de sidebar/bottom bar/painel a partir de `contributes` — **sem** carregar `main.js`/`renderer.js`.
3. O código do plugin (`activate` no main, bootstrap no renderer) só carrega no **primeiro uso** (clique no slot).

Ganho duplo: startup rápido e um plugin quebrado fica **dormente** até ser acionado — o boot do app nunca quebra por causa de plugin.

---

## 5. Loader no main process + host API

Novo módulo: `bruno-electron/src/plugins/index.js`. Registrado no boot em `index.js`, junto dos demais `register*Ipc`.

Responsabilidades:

- Escanear/validar manifests; expor `plugins:list` (devolve manifests + status para o renderer).
- Registrar o protocolo custom `bruno-plugin://` (ver §7).
- Na ativação de um plugin com `main`: `require(caminho)` em runtime e chamar `plugin.activate(hostApi)`.
- Manter, por plugin, o registro do que foi criado (handlers IPC) para teardown limpo.

### `hostApi` (exposto ao `main.js` do plugin)

```js
{
  ipc: {
    handle(channel, fn),   // registra `plugin:<id>:<channel>` (prefixo injetado pelo host)
    on(channel, fn),
    send(channel, ...args)
  },
  getMainWindow(),
  paths: { pluginDir, brunoHome },
  data: { load(), save(obj) },   // json em <pluginDir>/data.json (padrão Obsidian)
  log(...)
}
```

Ciclo de vida (main): `activate(hostApi)` / `deactivate()`. O plugin **nunca** escreve o nome de canal cru — o prefixo `plugin:<id>:` é sempre injetado pelo host (isolamento entre plugins).

Sem sandbox: `require()` direto = Node completo (é o que `gilmort-monitor` já faz hoje, só que fora do core).

---

## 6. Loader no renderer + `window.bruno` + slots

### `window.bruno` (exposto via contextBridge no preload)

Como `contextIsolation: true`, `window.bruno` **tem que** ser exposto pelo `preload.js` via `contextBridge.exposeInMainWorld` — um plugin não consegue setá-lo sozinho.

```js
window.bruno = {
  React,                                  // React do host (evita "dois Reacts")
  registerPanel(id, Component),
  registerSidebarItem({ id, title, icon, onClick | panelId }),
  registerBottomBarItem({ id, title, icon, onClick | panelId }),
  invoke(channel, ...args),               // -> window.ipcRenderer.invoke('plugin:<id>:'+channel)
  on(channel, cb),                        // idem
  data: { load(), save(obj) }
}
```

`invoke/on` reusam o `window.ipcRenderer` já exposto no preload (`preload.js:5-26`) — nenhum IPC novo, só o namespacing `plugin:<id>:`.

### Registry + wiring nos 3 slots

Um `PluginRegistry` (Redux slice ou context) guarda o que foi registrado. Os pontos de extensão passam a **ler do registry**:

- **Painel** — `RequestTabPanel/index.js`: onde hoje há `if (tab.type === 'docker-logs') return <GilmortLogs/>`, vira:
  ```js
  const P = registry.panels[tab.type];
  if (P) return <P .../>;
  ```
- **Sidebar** — `Sidebar/Sections/`: render genérico mapeando `registry.sidebarItems`.
- **Bottom bar** — `StatusBar/index.js`: render genérico mapeando `registry.bottomBarItems`.

### Bootstrap do renderer do plugin

Na ativação, o host injeta `<script src="bruno-plugin://<id>/renderer.js">`. Ao carregar, o plugin chama `window.bruno.registerPanel('docker-logs', DockerLogsPanel)` etc. O build do plugin **externaliza** `react`/`react-dom` (usa `window.bruno.React`).

---

## 7. Carregamento da UI: protocolo `bruno-plugin://` + CSP

**Risco verificado no código** (`index.js:76-91`): a CSP é `script-src 'self' data:`. Isso **bloqueia**:

- `<script src="file://~/.bruno/plugins/...">` (não é `'self'`),
- `<script>` inline (sem `'unsafe-inline'`),
- `eval()` / `new Function()` (sem `'unsafe-eval'`).

**Solução escolhida (opção 1):**

1. Registrar `protocol.registerFileProtocol('bruno-plugin', ...)` no main, servindo arquivos de `~/.bruno/plugins/`.
2. Adicionar **um token** `bruno-plugin:` ao `script-src` da CSP.

Então `<script src="bruno-plugin://<id>/renderer.js">` passa a CSP. **URLs reais** → sourcemaps e DevTools funcionam (essencial para iterar plugin sem recompilar). A mudança na CSP é cirúrgica (um token), não enfraquece o resto.

Fallback descartado (opção 2): injeção via `data:` URL (a CSP já permite `data:` em `script-src`), mas quebra sourcemap/debug e re-base64 a cada reload.

---

## 8. Ponte backend ↔ UI (IPC namespaced)

Tudo namespaced por plugin, sem colisão nem escuta cruzada:

- Plugin main: `hostApi.ipc.handle('start', fn)` → registra `plugin:<id>:start`.
- Plugin renderer: `window.bruno.invoke('start', args)` → chama `plugin:<id>:start`.
- O prefixo `plugin:<id>:` é sempre injetado pelo host; o plugin nunca escreve o canal cru.

Reusa `ipcMain` (main) e `window.ipcRenderer` (renderer) que o Bruno já usa.

**Postura de segurança (Electron):** renderer do plugin é **só UI**, zero `require`; todo Node pesado vive no `main.js` e fala com a UI pela ponte. Modelo de duas zonas do Electron respeitado.

---

## 9. Distribuição, reload e isolamento de erro

### Instalação

Ambos os caminhos terminam em uma pasta em `~/.bruno/plugins/`:

- **Pasta**: copiar/descompactar lá + reload.
- **Git URL**: tela **Settings → Plugins** com "Add from git" → reusa o `cloneGitRepository`/IPC `renderer:clone-git-repository` que já existe (`simple-git` já é dependência). Clona para `~/.bruno/plugins/<repo>/`. Zero código de git novo.

### Tela Settings → Plugins (única UI de core realmente nova)

Novo componente (análogo ao `GilmortConfigs` existente): lista plugins, toggle enable/disable, botão reload, campo "Add from git", e exibe status/erros.

### Reload de verdade (usa o teardown rastreado)

O host mantém por plugin: handlers IPC (`plugin:<id>:*`), painéis, itens de sidebar/bottom bar.

- **Disable**: `ipcMain.removeHandler(...)` dos canais do plugin, remove registros da UI, chama `deactivate()`. Slots somem na hora.
- **Reload**: disable + `webContents.reload()` (re-executa o bootstrap dos plugins do zero — evita módulo stale no renderer). Barato e limpo para poucos plugins. **Sem HMR (YAGNI).**
- **Main process**: `delete require.cache[main.js]` antes do re-require, para pegar código novo.

Fluxo alvo: editar `renderer.js` → clicar reload → ver a mudança. Sem recompilar o Bruno.

### Isolamento de erro

- Cada `activate()` (main) e bootstrap (renderer) em `try/catch`. Plugin que estoura vira status **"errored"** na tela de Plugins e é pulado; os outros carregam.
- Combinado com ativação preguiçosa (§4): plugin quebrado nem carrega até ser acionado.
- Manifest inválido → ignorado com aviso.

---

## 10. Mapa de mudanças no core

| Peça | Onde | Impacto no core |
|---|---|---|
| Loader main + `hostApi` + protocolo `bruno-plugin://` | `bruno-electron/src/plugins/` (novo) | +chamada no `index.js`; +1 token na CSP |
| `window.bruno` via contextBridge | `bruno-electron/src/preload.js` | pequeno add |
| Registry + 3 slots | `RequestTabPanel/index.js`, `Sidebar/Sections/`, `StatusBar/index.js` | trocar hardcode por leitura do registry |
| Tela Settings → Plugins | novo componente em `bruno-app` | 1 tela |
| Ponte IPC namespaced | reusa `window.ipcRenderer` / `ipcMain` | zero |
| Install git | reusa `cloneGitRepository` | zero |
| Plugin-exemplo (template) | `docs/` ou repo separado | referência para copiar |

**Prova de conceito recomendada:** migrar a feature "Docker Logs" atual para um plugin `~/.bruno/plugins/docker-logs/`, removendo o hardcode de `RequestTabPanel`/`index.js`. Valida painel + backend + bridge de ponta a ponta.

---

## 11. Fora de escopo (fase 1)

- **Hooks de request/response**: adiar para fase 2. Exigem definir pontos de intercepção no pipeline de `bruno-js`/network; desenhar depois que os slots de UI+backend estiverem provados.
- Sandbox/permissões (modelo de confiança dispensa).
- Distribuição via npm (só pasta+git).
- Marketplace/registry, versionamento/resolução de deps entre plugins, HMR.

---

## 12. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| CSP bloqueia carga do renderer.js | Protocolo `bruno-plugin://` + 1 token CSP (§7) — **verificado no código** |
| "Dois Reacts" (hooks quebram) | Plugin externaliza React; usa `window.bruno.React` |
| Plugin quebrado derruba o app | try/catch + status "errored" + ativação preguiçosa (§9) |
| Módulo stale no reload | `webContents.reload()` + `delete require.cache` (§9) |
| Colisão de canais IPC entre plugins | Namespacing `plugin:<id>:` forçado pelo host (§8) |
| Autor sem build step | Plugin-exemplo com esbuild de uma linha (React externalizado) |

---

## 13. Critérios de sucesso

1. Instalar um plugin copiando uma pasta para `~/.bruno/plugins/` e vê-lo aparecer após reload — sem recompilar o Bruno.
2. Instalar um plugin por URL git pela tela de Plugins.
3. Um plugin adiciona painel + item de sidebar + botão de bottom bar + handler de backend, tudo funcionando via bridge namespaced.
4. Editar o `renderer.js` de um plugin e ver a mudança após reload, com sourcemaps/DevTools.
5. Plugin com erro fica "errored" e isolado; o resto do app funciona normal.
6. Feature "Docker Logs" migrada para plugin, com o hardcode removido do core.

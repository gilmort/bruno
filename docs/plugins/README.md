# Bruno Plugins

This build of Bruno ships a **plugin host**: you can extend the app with UI and
behavior **without recompiling** it. Plugins are plain folders dropped into your
Bruno home directory; Bruno discovers, loads, and sandboxes them at runtime.

> This is a fork feature. It is not part of upstream `usebruno/bruno`.

- [How plugins are discovered](#how-plugins-are-discovered)
- [Anatomy of a plugin](#anatomy-of-a-plugin)
- [The `bruno-plugin://` protocol](#the-bruno-plugin-protocol)
- [Renderer API (`window.bruno` / `ctx`)](#renderer-api)
- [Extension points](#extension-points)
- [Persisting request settings (`contributes.settingsKeys`)](#persisting-request-settings)
- [Main-process API](#main-process-api)
- [Worked examples](#worked-examples)
- [Best practices](#best-practices)

---

## How plugins are discovered

At startup Bruno scans:

```
~/.bruno/plugins/<plugin-id>/
```

Each subdirectory (or **symlink** to one) that contains a valid `manifest.json`
is a plugin. Symlinks are followed, so during development you keep the source
anywhere and link it in:

```bash
ln -s ~/code/my-bruno-plugins/hello ~/.bruno/plugins/hello
```

Plugins are **lazily activated**: the manifest is read at scan time, and the
renderer/main code is loaded when the plugin is enabled (all non-disabled
plugins are enabled by default). Toggle them in **Preferences → Plugins**.

---

## Anatomy of a plugin

```
hello/
├── manifest.json      # required — identity + what the plugin contributes
├── renderer.js        # optional — runs in the renderer (the web UI)
└── main.js            # optional — runs in the Electron main process (Node)
```

### `manifest.json`

```json
{
  "id": "hello",
  "name": "Hello Plugin",
  "version": "1.0.0",
  "renderer": "renderer.js",
  "main": "main.js",
  "contributes": {
    "requestTabs": [{ "id": "hello", "label": "Hello" }],
    "settingsKeys": ["hello"]
  }
}
```

| Field                   | Required | Notes                                                        |
| ----------------------- | :------: | ------------------------------------------------------------ |
| `id`                    |    ✅    | Unique. Must match `^[a-z0-9-]+$`. Namespaces everything.    |
| `name`                  |    ✅    | Human-readable name (shown in Preferences → Plugins).        |
| `version`               |    ✅    | Semver string.                                               |
| `renderer`              |          | Entry file loaded into the web UI. Usually `renderer.js`.    |
| `main`                  |          | Entry file `require`d in the Electron main process.          |
| `contributes`           |          | Declarative contributions (see below).                       |
| `contributes.settingsKeys` |       | Settings keys this plugin stores per-request. See [below](#persisting-request-settings). |

`contributes` is free-form and passed through to the renderer; only
`settingsKeys` is interpreted by the core (to allow the key through the `.bru`/
`.yml` parser and schema).

---

## The `bruno-plugin://` protocol

The renderer file is injected as a `<script>` from a privileged, sandboxed
scheme:

```
bruno-plugin://<plugin-id>/<file>
```

It maps to `~/.bruno/plugins/<plugin-id>/<file>`. The scheme is `standard`,
`secure`, `corsEnabled`, and allowed by the app's CSP (`script-src … bruno-plugin:`),
so a plugin can also `fetch()` its own bundled assets:

```js
const res = await fetch('bruno-plugin://hello/data/list.json');
```

---

## Renderer API

Your `renderer.js` runs in the main world and registers itself with a single
entry point:

```js
window.bruno.definePlugin('hello', function (ctx) {
  // ctx is your whole API surface
  ctx.registerBottomBarItem({ id: 'hi', title: 'Say hi', icon: 'IconMoodSmile' });
});
```

`ctx` (also the value passed to `setup`) exposes:

| Member                         | What it is                                                              |
| ------------------------------ | ----------------------------------------------------------------------- |
| `ctx.React`                    | The app's React instance — build components with `ctx.React.createElement`. |
| `ctx.registerPanel`            | Register a full-tab panel component. See [extension points](#extension-points). |
| `ctx.registerSidebarItem`      | Add an item to the sidebar.                                             |
| `ctx.registerBottomBarItem`    | Add a button to the status bar.                                         |
| `ctx.registerEditorDecorator`  | Decorate CodeMirror editors (request body, response).                  |
| `ctx.registerValueMasker`      | Mask values in the JSON tree preview.                                  |
| `ctx.registerSettingsPage`     | A config page under Preferences → Plugins.                             |
| `ctx.registerRequestTab`       | Add a tab to the request pane.                                         |
| `ctx.store.getState()`         | Read the Redux state (read-only).                                      |
| `ctx.store.subscribe(cb)`      | Subscribe to store changes.                                            |
| `ctx.actions`                  | Dispatch a curated set of actions (see below).                        |
| `ctx.utils`                    | Collection helpers (see below).                                       |
| `ctx.invoke(ch, ...args)`      | Call your own main-process handler (namespaced).                      |
| `ctx.on(ch, cb)`               | Listen for messages your main process sends.                          |
| `ctx.data.load()` / `.save(o)` | Persist plugin-global JSON (in `data.json` next to your plugin).      |

### `ctx.actions`

```js
ctx.actions.sendRequest(item, collectionUid);      // run a request
ctx.actions.saveRequest(itemUid, collectionUid);   // save a request
ctx.actions.updateItemSettings({ collectionUid, itemUid, settings }); // draft a settings change
ctx.actions.mountCollection(collection);           // load a collapsed/unmounted collection
```

### `ctx.utils`

`flattenItems`, `isItemARequest`, `findCollectionByItemUid`,
`findItemInCollection`, `normalizePath`, `pathUtil`.

---

## Extension points

Every registration is namespaced by your plugin `id`, and cleaned up
automatically when the plugin is disabled/reloaded.

### 1. Editor decorator — `registerEditorDecorator(fn)`

Called for **every** CodeMirror editor on mount and whenever its value or
`readOnly` changes. Use it to add widgets/marks to the request body or response.

```js
ctx.registerEditorDecorator((editor, ctxInfo) => {
  // ctxInfo = { readOnly: boolean, mode: string }  e.g. mode 'application/ld+json'
  const isJson = String(ctxInfo.mode || '').includes('json');
  if (!isJson) return;
  // editor is a CodeMirror instance → editor.markText(from, to, { replacedWith }) ...
});
```

The core shows a **"labels"** toggle (eye icon) next to the JSON selector in the
request/response panes whenever at least one editor decorator is registered.
It flips `state.plugins.labelsHidden`; honor it in your decorator to hide/show.

### 2. Value masker — `registerValueMasker(fn)`

The JSON **tree preview** (`react-json-view`) is not a CodeMirror editor, so
decorators don't reach it. A value masker fills that gap:

```js
ctx.registerValueMasker((fieldName, value, fullPath) => {
  if (fieldName === 'statusId') return labelForStatus(value); // string label, or
  return null;                                                // falsy = don't mask
});
```

### 3. Request tab — `registerRequestTab({ id, label, Component })`

Adds a tab to the request pane (next to Params, Body, …). `Component` gets
`{ item, collection }` props.

```js
ctx.registerRequestTab({
  id: 'hello',
  label: 'Hello',
  Component: function ({ item, collection }) {
    const h = ctx.React.createElement;
    return h('div', null, 'Hello from ' + item.name);
  }
});
```

By convention the tab `id` doubles as your [settings key](#persisting-request-settings).

### 4. Settings page — `registerSettingsPage(Component)`

A config page listed under **Preferences → Plugins**. Persist with `ctx.data`.

```js
ctx.registerSettingsPage(function () {
  const h = ctx.React.createElement;
  return h('button', { onClick: () => ctx.data.save({ enabled: true }) }, 'Save');
});
```

### 5. Panel — `registerPanel(panelId, Component)`

A full-tab panel. Open it from a sidebar/bottom-bar item by dispatching a tab of
type `plugin:<id>:<panelId>`.

### 6. Sidebar item — `registerSidebarItem(item)`

### 7. Bottom-bar item — `registerBottomBarItem({ id, title, icon, panelType })`

`icon` is any [Tabler icon](https://tabler.io/icons) name (e.g. `'IconBrandDocker'`).
`panelType` (optional) opens a registered panel when clicked.

---

## Persisting request settings

To store data **per request** (in the `.bru`/`.yml` file), declare the key in
the manifest:

```json
{ "contributes": { "settingsKeys": ["hello"] } }
```

Then write to `item.settings.<key>` by drafting a settings change — Bruno's
native Save/auto-save picks it up:

```js
ctx.actions.updateItemSettings({
  collectionUid: collection.uid,
  itemUid: item.uid,
  settings: { ...currentSettings, hello: { greeting: 'hi' } }
});
```

The value must be a JSON **object/array**. The core parser and schema pass any
declared key through unchanged for both `.bru` and `.yml` collections. Reading a
plugin tab's dot indicator: the request-pane tab shows a **grey dot** when the
key has saved data and an **orange dot** when there's an unsaved draft.

> Keep separate object references per group — never store the **same object**
> under two keys, or serialization emits a circular reference.

---

## Main-process API

If your plugin needs Node (filesystem, spawning processes, network without CORS),
add a `main.js`. It is `require`d and its `activate(host)` is called:

```js
// main.js
module.exports = {
  activate(host) {
    host.ipc.handle('list', async () => require('fs').readdirSync(host.paths.pluginDir));
    host.ipc.on('ping', () => host.ipc.send('pong', Date.now()));
  },
  deactivate() { /* cleanup */ }
};
```

`host` provides:

- `host.ipc.handle(ch, fn)` / `host.ipc.on(ch, fn)` / `host.ipc.send(ch, …)` —
  all namespaced to your plugin; call them from the renderer with
  `ctx.invoke(ch, …)` and `ctx.on(ch, cb)`.
- `host.paths.pluginDir`, `host.paths.brunoHome`.
- `host.data.load()` / `host.data.save(obj)` — same `data.json` the renderer sees.
- `host.log(...)`.

---

## Worked examples

Two configurable reference plugins live in the companion repo
[`bruno-plugins`](#) and exercise every extension point:

### `json-labels` — mask ids with human-readable labels

- **`registerEditorDecorator`** ×2 (request body + response) → replaces a UUID
  in the JSON with a `🏷 label` badge; the request badge opens a dropdown to pick
  another value.
- **`registerValueMasker`** → same masking in the JSON tree preview.
- **`registerRequestTab`** (`jsonLabels`) → per-request config table (which field
  → which reference API → id/label field).
- **`registerSettingsPage`** → global defaults.
- **`contributes.settingsKeys: ["jsonLabels"]`** → persists the config in each
  request's `.bru`/`.yml`.
- Uses `ctx.actions.sendRequest` to auto-fetch the reference API, and
  `ctx.store.subscribe` to re-decorate when data arrives.

### `docker-logs` — live docker service monitor

- **`registerPanel`** → a full-tab live-log viewer.
- **`registerBottomBarItem`** / **`registerSidebarItem`** → open the panel.
- **`registerSettingsPage`** → compose file, services, health checks.
- **`main.js`** → spawns `docker compose` and streams logs to the renderer via
  `host.ipc.send`.

---

## Best practices

- **Namespace everything** with your `id`; never touch global CSS classes owned
  by the app. Inject your own `<style>` (scoped, e.g. `.myplugin-*`) and prefer
  `var(--color-brand)`, `var(--font-family-mono)`, and `rgba()` so you follow the
  active Bruno theme (light **and** dark).
- **Read state, dispatch through `ctx.actions`.** Don't reach into Redux to
  mutate — use the curated actions so drafts/undo/save keep working.
- **Guard `store.subscribe`.** It fires on every action; bail out fast and only
  do work when the slice you care about actually changed.
- **Persist through the right channel:** per-request data → `updateItemSettings`
  + a declared `settingsKey`; plugin-global data → `ctx.data`.
- **Fail soft.** A throwing decorator/masker is caught and logged, but a noisy
  one degrades the editor — keep them cheap and defensive.
- **Reload during dev:** edits to `main.js` reload on toggle; renderer changes
  load fresh on app restart.

const panels = new Map(); // panelType -> React component

export const pluginPanelRegistry = {
  set: (type, Comp) => panels.set(type, Comp),
  get: (type) => panels.get(type),
  clear: (pluginId) => {
    for (const key of panels.keys()) {
      if (key.startsWith(`plugin:${pluginId}:`)) panels.delete(key);
    }
  }
};

// 4º ponto de extensão plugins decoram o CodeEditor (ex.: mascarar valores por labels).
// Cada decorator é chamado pelo CodeEditor com (editor, ctx) no mount e quando muda valor/readOnly.
const editorDecorators = []; // { pluginId, fn }

export const pluginEditorDecorators = {
  add: (pluginId, fn) => editorDecorators.push({ pluginId, fn }),
  clear: (pluginId) => {
    for (let i = editorDecorators.length - 1; i >= 0; i--) {
      if (editorDecorators[i].pluginId === pluginId) editorDecorators.splice(i, 1);
    }
  },
  applyAll: (editor, ctx) => {
    editorDecorators.forEach((d) => {
      try { d.fn(editor, ctx); } catch (e) { console.error('[plugin editor decorator]', e); }
    });
  },
  count: () => editorDecorators.length
};

// 5º ponto de extensão: plugins mascaram valores fora do CodeMirror (ex.: preview
// em árvore do react-json-view, que não passa pelo editor).
// fn(fieldName, value, fullPath) -> label string (mascara) ou falsy (não mascara).
const valueMaskers = []; // { pluginId, fn }

export const pluginValueMaskers = {
  add: (pluginId, fn) => valueMaskers.push({ pluginId, fn }),
  clear: (pluginId) => {
    for (let i = valueMaskers.length - 1; i >= 0; i--) {
      if (valueMaskers[i].pluginId === pluginId) valueMaskers.splice(i, 1);
    }
  },
  getMask: (fieldName, value, fullPath) => {
    for (const m of valueMaskers) {
      try {
        const label = m.fn(fieldName, value, fullPath);
        if (label) return label;
      } catch (e) { console.error('[plugin value masker]', e); }
    }
    return null;
  },
  count: () => valueMaskers.length
};

// 6º ponto de extensão: cada plugin pode registrar sua própria página de config,
// exibida em Preferences > Plugins.
const settingsPages = new Map(); // pluginId -> React component

export const pluginSettingsRegistry = {
  set: (pluginId, Comp) => settingsPages.set(pluginId, Comp),
  get: (pluginId) => settingsPages.get(pluginId),
  clear: (pluginId) => settingsPages.delete(pluginId)
};

// 7º ponto de extensão: aba própria do plugin dentro do HttpRequestPane.
// Chave = `plugin:<id>:<tabId>` (mesma convenção dos panels).
const requestTabs = new Map(); // tabKey -> React component

export const pluginRequestTabRegistry = {
  set: (tabKey, Comp) => requestTabs.set(tabKey, Comp),
  get: (tabKey) => requestTabs.get(tabKey),
  clear: (pluginId) => {
    for (const key of requestTabs.keys()) {
      if (key.startsWith(`plugin:${pluginId}:`)) requestTabs.delete(key);
    }
  }
};

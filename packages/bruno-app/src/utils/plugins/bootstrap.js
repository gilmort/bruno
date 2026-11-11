import React from 'react';
import ReactDOM from 'react-dom';
import * as ReactJSXRuntime from 'react/jsx-runtime';
import { registerPluginSettingsKeys } from '@usebruno/schema';
import { pluginPanelRegistry, pluginEditorDecorators, pluginValueMaskers, pluginSettingsRegistry, pluginRequestTabRegistry } from './registry';
import { addSidebarItem, addBottomBarItem, addPanelType, addSettingsPage, addRequestTab, setHomePanel, clearRegistrations } from 'providers/ReduxStore/slices/plugins';
import { updateItemSettings } from 'providers/ReduxStore/slices/collections';
import { sendRequest, saveRequest, mountCollection } from 'providers/ReduxStore/slices/collections/actions';
import { addTab } from 'providers/ReduxStore/slices/tabs';
import { flattenItems, isItemARequest, findCollectionByItemUid, findItemInCollection } from 'utils/collections';
import pathUtil, { normalizePath } from 'utils/common/path';
import { uuid } from 'utils/common';
import CodeEditor from 'components/CodeEditor/index';

const injected = new Set();
// Contexto opcional passado a um painel via ctx.actions.openPanel (ex: qual item abrir).
// Chaveado pelo tipo `plugin:<id>:<panel>`; o painel lê com ctx.getPanelContext(tab.type).
const panelContexts = new Map();
const PANEL_CONTEXT_EVENT = 'plugin:panel-context';

export function installPluginHost(store) {
  if (window.bruno) return; // idempotente
  window.bruno = {
    // Expostos globalmente para plugins que bundlam libs React (ex: React Flow) reusarem o
    // MESMO React do host via shim — evita o problema de "dois Reacts".
    React,
    ReactDOM,
    jsxRuntime: ReactJSXRuntime,
    // Componentes do host reusáveis por plugins — evita cada plugin reimplementar (ou bundlar) o
    // que o Bruno já tem. CodeEditor = CodeMirror com busca (Cmd-F) e fold (Cmd-Y/Cmd-I).
    // `collection`/`item` são opcionais: getAllVariables retorna {} quando não há collection.
    components: { CodeEditor },
    definePlugin(id, setup) {
      const ctx = {
        React,
        registerPanel: (panelId, Comp) => {
          const type = `plugin:${id}:${panelId}`;
          pluginPanelRegistry.set(type, Comp);
          store.dispatch(addPanelType(type));
        },
        // O plugin se candidata a ser a HOME (o que aparece sem aba aberta). O host não conhece
        // id de plugin nenhum — quem se oferece é o plugin, como já faz com sidebar/bottom bar.
        registerHomePanel: (panelId) =>
          store.dispatch(setHomePanel(`plugin:${id}:${panelId}`)),
        registerSidebarItem: (item) =>
          store.dispatch(addSidebarItem({ pluginId: id, ...item })),
        registerBottomBarItem: (item) =>
          store.dispatch(addBottomBarItem({ pluginId: id, ...item })),
        registerEditorDecorator: (fn) => pluginEditorDecorators.add(id, fn),
        registerValueMasker: (fn) => pluginValueMaskers.add(id, fn),
        registerSettingsPage: (Comp) => {
          pluginSettingsRegistry.set(id, Comp);
          store.dispatch(addSettingsPage(id));
        },
        registerRequestTab: ({ id: tabId, label, Component }) => {
          const tabKey = `plugin:${id}:${tabId}`;
          pluginRequestTabRegistry.set(tabKey, Component);
          // Convenção: o id da aba é também a chave de settings do plugin.
          // Registrar aqui garante que o itemSchema aceite essa chave no Save assim que o
          // renderer carrega — sem depender do timing do manifest em usePlugins.
          registerPluginSettingsKeys([tabId]);
          store.dispatch(addRequestTab({ pluginId: id, id: tabId, label, tabKey }));
        },
        store: {
          getState: () => store.getState(),
          subscribe: (cb) => store.subscribe(cb)
        },
        actions: {
          sendRequest: (item, collectionUid) => store.dispatch(sendRequest(item, collectionUid)),
          saveRequest: (itemUid, collectionUid) => store.dispatch(saveRequest(itemUid, collectionUid)),
          updateItemSettings: (payload) => store.dispatch(updateItemSettings(payload)),
          mountCollection: (collection) => store.dispatch(mountCollection({ collectionUid: collection.uid, collectionPathname: collection.pathname, brunoConfig: collection.brunoConfig })),
          // Abre (ou re-foca) um painel do plugin como uma nova aba, opcionalmente com contexto.
          // Painéis plugin:* são deduplicados por tipo, então reabrir com outro contexto re-foca a
          // aba e dispara o evento — o painel aberto se atualiza. O painel lê via ctx.getPanelContext.
          openPanel: (panelId, context) => {
            const type = `plugin:${id}:${panelId}`;
            panelContexts.set(type, context === undefined ? null : context);
            store.dispatch(addTab({ uid: uuid(), collectionUid: null, type }));
            window.dispatchEvent(new CustomEvent(PANEL_CONTEXT_EVENT, { detail: { type, context: context === undefined ? null : context } }));
          }
        },
        getPanelContext: (type) => panelContexts.get(type),
        utils: {
          flattenItems,
          isItemARequest,
          findCollectionByItemUid,
          findItemInCollection,
          normalizePath,
          pathUtil
        },
        invoke: (ch, ...args) => window.ipcRenderer.invoke(`plugin:${id}:${ch}`, ...args),
        on: (ch, cb) => window.ipcRenderer.on(`plugin:${id}:${ch}`, cb),
        data: {
          load: () => window.ipcRenderer.invoke(`plugin:${id}:__data_load`),
          save: (obj) => window.ipcRenderer.invoke(`plugin:${id}:__data_save`, obj)
        }
      };
      try {
        setup(ctx);
      } catch (e) {
        console.error(`[plugin:${id}] setup falhou`, e);
      }
    }
  };
}

function injectScript(id, bust) {
  const script = document.createElement('script');
  script.src = `bruno-plugin://${id}/renderer.js${bust ? `?t=${bust}` : ''}`;
  script.async = true;
  script.dataset.plugin = id;
  script.onerror = () => console.error(`[plugin:${id}] falha ao carregar renderer.js`);
  document.body.appendChild(script);
}

export function activatePluginRenderer(plugin) {
  if (injected.has(plugin.id)) return;
  injected.add(plugin.id);
  injectScript(plugin.id);
}

// Remove um plugin da UI sem recarregar a janela: limpa registros do slice,
// componentes do singleton, tags de script e o guard de injeção.
export function teardownPluginRenderer(store, id) {
  store.dispatch(clearRegistrations(id));
  pluginPanelRegistry.clear(id);
  pluginEditorDecorators.clear(id);
  pluginValueMaskers.clear(id);
  pluginSettingsRegistry.clear(id);
  pluginRequestTabRegistry.clear(id);
  injected.delete(id);
  document.querySelectorAll(`script[data-plugin="${id}"]`).forEach((s) => s.remove());
}

// Reload direcionado de um plugin: teardown + re-injeta o renderer.js com
// cache-buster para o script re-executar definePlugin e re-registrar a UI.
export function reinjectPluginRenderer(store, id) {
  teardownPluginRenderer(store, id);
  injected.add(id);
  injectScript(id, Date.now());
}

import React from 'react';
import { registerPluginSettingsKeys } from '@usebruno/schema';
import { pluginPanelRegistry, pluginEditorDecorators, pluginValueMaskers, pluginSettingsRegistry, pluginRequestTabRegistry } from './registry';
import { addSidebarItem, addBottomBarItem, addPanelType, addSettingsPage, addRequestTab, clearRegistrations } from 'providers/ReduxStore/slices/plugins';
import { updateItemSettings } from 'providers/ReduxStore/slices/collections';
import { sendRequest, saveRequest, mountCollection } from 'providers/ReduxStore/slices/collections/actions';
import { flattenItems, isItemARequest, findCollectionByItemUid, findItemInCollection } from 'utils/collections';
import pathUtil, { normalizePath } from 'utils/common/path';

const injected = new Set();

export function installPluginHost(store) {
  if (window.bruno) return; // idempotente
  window.bruno = {
    definePlugin(id, setup) {
      const ctx = {
        React,
        registerPanel: (panelId, Comp) => {
          const type = `plugin:${id}:${panelId}`;
          pluginPanelRegistry.set(type, Comp);
          store.dispatch(addPanelType(type));
        },
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
          mountCollection: (collection) => store.dispatch(mountCollection({ collectionUid: collection.uid, collectionPathname: collection.pathname, brunoConfig: collection.brunoConfig }))
        },
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

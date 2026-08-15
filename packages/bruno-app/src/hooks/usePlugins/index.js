import { useEffect } from 'react';
import { useDispatch, useStore } from 'react-redux';
import { isElectron } from 'utils/common/platform';
import { registerPluginSettingsKeys } from '@usebruno/schema';
import { setPlugins } from 'providers/ReduxStore/slices/plugins';
import { installPluginHost, activatePluginRenderer, reinjectPluginRenderer, teardownPluginRenderer } from 'utils/plugins/bootstrap';

// Coleta contributes.settingsKeys dos manifests e libera essas chaves na validação.
const applySettingsKeys = (list) => {
  (list || []).forEach((p) => {
    const keys = p && p.contributes && p.contributes.settingsKeys;
    if (Array.isArray(keys)) registerPluginSettingsKeys(keys);
  });
};

const usePlugins = () => {
  const dispatch = useDispatch();
  const store = useStore();

  useEffect(() => {
    if (!isElectron()) return;
    installPluginHost(store);
    const { ipcRenderer } = window;

    const load = (list) => {
      applySettingsKeys(list);
      dispatch(setPlugins(list));
      // ativação preguiçosa mínima da fase 1: injeta o renderer de plugins não-desabilitados
      list.filter((p) => p.status !== 'disabled' && p.status !== 'errored')
        .forEach((p) => {
          ipcRenderer.invoke('renderer:activate-plugin', p.id);
          activatePluginRenderer(p);
        });
    };

    ipcRenderer.invoke('renderer:get-plugins').then(load);

    const removeUpdated = ipcRenderer.on('main:plugins-updated', (list) => {
      applySettingsKeys(list); dispatch(setPlugins(list));
    });

    // reload direcionado: re-injeta só este plugin (sem recarregar o app)
    const removeReloaded = ipcRenderer.on('main:plugin-reloaded', ({ id, plugins }) => {
      dispatch(setPlugins(plugins));
      reinjectPluginRenderer(store, id);
    });

    // enable/disable direcionado
    const removeToggled = ipcRenderer.on('main:plugin-toggled', ({ id, enabled, plugins }) => {
      dispatch(setPlugins(plugins));
      if (enabled) {
        ipcRenderer.invoke('renderer:activate-plugin', id);
        reinjectPluginRenderer(store, id);
      } else {
        teardownPluginRenderer(store, id);
      }
    });

    return () => {
      [removeUpdated, removeReloaded, removeToggled].forEach((r) => { if (typeof r === 'function') r(); });
    };
  }, []);
};

export default usePlugins;

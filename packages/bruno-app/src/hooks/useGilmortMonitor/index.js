import { useEffect, useState } from 'react';
import { loadGilmortConfig, onGilmortConfigChange } from 'utils/gilmort/config';

const useGilmortMonitor = () => {
  const [statuses, setStatuses] = useState([]);
  const [config, setConfig] = useState(loadGilmortConfig);

  useEffect(() => {
    return onGilmortConfigChange(() => setConfig(loadGilmortConfig()));
  }, []);

  const { services, pollIntervalMs, healthTimeoutMs } = config;
  const configKey = JSON.stringify({ services, pollIntervalMs, healthTimeoutMs });

  useEffect(() => {
    const { ipcRenderer } = window;
    if (!services.length) {
      ipcRenderer.invoke('renderer:stop-gilmort-monitoring');
      setStatuses([]);
      return;
    }

    const unsubscribe = ipcRenderer.on('main:gilmort-status', (payload) => {
      setStatuses(payload.services);
    });

    ipcRenderer.invoke('renderer:start-gilmort-monitoring', {
      collectionUid: 'global',
      services,
      pollIntervalMs,
      healthTimeoutMs
    });

    return () => {
      unsubscribe();
      ipcRenderer.invoke('renderer:stop-gilmort-monitoring');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configKey]);

  return { statuses, services };
};

export default useGilmortMonitor;

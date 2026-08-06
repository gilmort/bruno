import { useEffect, useState } from 'react';
import { get } from 'lodash';

const useGilmortMonitor = (collection) => {
  const [statuses, setStatuses] = useState([]);

  const services = collection?.draft?.brunoConfig
    ? get(collection, 'draft.brunoConfig.gilmort.services', [])
    : get(collection, 'brunoConfig.gilmort.services', []);

  const servicesKey = JSON.stringify(services);
  const collectionUid = collection?.uid;

  useEffect(() => {
    const { ipcRenderer } = window;
    if (!services.length) {
      ipcRenderer.invoke('renderer:stop-gilmort-monitoring');
      setStatuses([]);
      return;
    }

    const unsubscribe = ipcRenderer.on('main:gilmort-status', (payload) => {
      if (payload?.collectionUid === collectionUid) setStatuses(payload.services);
    });

    ipcRenderer.invoke('renderer:start-gilmort-monitoring', { collectionUid, services });

    return () => {
      unsubscribe();
      ipcRenderer.invoke('renderer:stop-gilmort-monitoring');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionUid, servicesKey]);

  return { statuses };
};

export default useGilmortMonitor;

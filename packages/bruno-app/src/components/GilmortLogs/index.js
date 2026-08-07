import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { IconPlayerPlay, IconPlayerStop, IconRefresh } from '@tabler/icons';
import { loadGilmortConfig } from 'utils/gilmort/config';
import StyledWrapper from './StyledWrapper';

const FOCUS_KEY = 'gilmort.focusService';

const GilmortLogs = () => {
  const config = loadGilmortConfig();
  const services = config.services;
  const composePath = config.composePath;

  // Only services with a container can be tailed via docker logs.
  const containers = services.filter((s) => s.container).map((s) => s.container);
  const containerToName = Object.fromEntries(services.filter((s) => s.container).map((s) => [s.container, s.name]));
  const nameToContainer = Object.fromEntries(services.filter((s) => s.container).map((s) => [s.name, s.container]));

  // A button click may request focus on a single service (written to sessionStorage).
  const focusedName = (() => {
    try {
      return sessionStorage.getItem(FOCUS_KEY) || '';
    } catch (_) {
      return '';
    }
  })();

  const initialEnabled = () =>
    Object.fromEntries(
      containers.map((c) => [c, focusedName ? containerToName[c] === focusedName : true])
    );

  const [lines, setLines] = useState([]);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [autoScroll, setAutoScroll] = useState(true);
  const [busy, setBusy] = useState(false);
  const areaRef = useRef(null);
  const sessionRef = useRef(null);

  useEffect(() => {
    const { ipcRenderer } = window;
    let unsubscribe = () => {};
    let cancelled = false;

    ipcRenderer.invoke('gilmort-logs:start', { containers }).then((sessionId) => {
      if (!sessionId) return;
      if (cancelled) {
        ipcRenderer.send('gilmort-logs:stop', sessionId);
        return;
      }
      sessionRef.current = sessionId;
      unsubscribe = ipcRenderer.on(`gilmort-logs:data:${sessionId}`, ({ service, line }) => {
        setLines((prev) => [...prev.slice(-2000), { service, line }]);
      });
    });

    return () => {
      cancelled = true;
      unsubscribe();
      if (sessionRef.current) ipcRenderer.send('gilmort-logs:stop', sessionRef.current);
      try {
        sessionStorage.removeItem(FOCUS_KEY);
      } catch (_) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(containers)]);

  useEffect(() => {
    if (autoScroll && areaRef.current) areaRef.current.scrollTop = areaRef.current.scrollHeight;
  }, [lines, autoScroll]);

  const compose = async (action) => {
    const { ipcRenderer } = window;
    setBusy(true);
    const r = await ipcRenderer.invoke('renderer:gilmort-compose', { action, cwd: composePath });
    setBusy(false);
    if (r.success) toast.success(`make ${action} ok`);
    else toast.error(r.error || `make ${action} falhou`);
  };

  const container = async (action, name) => {
    const { ipcRenderer } = window;
    const c = nameToContainer[name];
    if (!c) return;
    setBusy(true);
    const r = await ipcRenderer.invoke('renderer:gilmort-container', { action, container: c });
    setBusy(false);
    if (r.success) toast.success(`${name}: ${action} ok`);
    else toast.error(r.error || `${name}: ${action} falhou`);
  };

  const visible = lines.filter((l) => enabled[l.service]);

  return (
    <StyledWrapper>
      <div className="toolbar">
        <div className="group">
          <span className="lbl">Compose:</span>
          <button className="ctl" disabled={busy || !composePath} title="make up" onClick={() => compose('up')}>
            <IconPlayerPlay size={14} strokeWidth={1.5} /> up
          </button>
          <button className="ctl" disabled={busy || !composePath} title="make down" onClick={() => compose('down')}>
            <IconPlayerStop size={14} strokeWidth={1.5} /> down
          </button>
          <button className="ctl" disabled={busy || !composePath} title="make down && make up" onClick={() => compose('restart')}>
            <IconRefresh size={14} strokeWidth={1.5} /> restart
          </button>
          {!composePath && <span className="hint">configure o caminho do qa-compose nas Gilmort Configs</span>}
        </div>
      </div>

      <div className="filters">
        {services.filter((s) => s.container).map((s) => (
          <div className="svc-row" key={s.name}>
            <label>
              <input
                type="checkbox"
                checked={!!enabled[s.container]}
                onChange={(e) => setEnabled((p) => ({ ...p, [s.container]: e.target.checked }))}
              />
              {s.name}
            </label>
            <button className="ctl xs" disabled={busy} title="docker start" onClick={() => container('start', s.name)}><IconPlayerPlay size={12} strokeWidth={1.5} /></button>
            <button className="ctl xs" disabled={busy} title="docker stop" onClick={() => container('stop', s.name)}><IconPlayerStop size={12} strokeWidth={1.5} /></button>
            <button className="ctl xs" disabled={busy} title="docker restart" onClick={() => container('restart', s.name)}><IconRefresh size={12} strokeWidth={1.5} /></button>
          </div>
        ))}
        <label className="ml-auto flex items-center gap-1 text-xs">
          <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} /> auto-scroll
        </label>
        <button className="ctl" onClick={() => setLines([])}>clear</button>
      </div>

      <div className="log-area" ref={areaRef}>
        {containers.length === 0 && <div className="text-xs text-muted">Nenhum serviço com container configurado.</div>}
        {visible.map((l, i) => {
          const name = containerToName[l.service] || l.service;
          return (
            <span className={`log-line svc-${name}`} key={i}>[{name}] {l.line}</span>
          );
        })}
      </div>
    </StyledWrapper>
  );
};

export default GilmortLogs;

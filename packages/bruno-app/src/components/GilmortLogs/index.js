import React, { useEffect, useRef, useState } from 'react';
import { get } from 'lodash';
import StyledWrapper from './StyledWrapper';

const GilmortLogs = ({ collection }) => {
  const services = collection?.draft?.brunoConfig
    ? get(collection, 'draft.brunoConfig.gilmort.services', [])
    : get(collection, 'brunoConfig.gilmort.services', []);

  // Only services with a container can be tailed via docker logs.
  const containers = services.filter((s) => s.container).map((s) => s.container);

  const [lines, setLines] = useState([]);
  const [enabled, setEnabled] = useState(() => Object.fromEntries(containers.map((c) => [c, true])));
  const [autoScroll, setAutoScroll] = useState(true);
  const areaRef = useRef(null);
  const sessionRef = useRef(null);

  useEffect(() => {
    const { ipcRenderer } = window;
    let unsubscribe = () => {};
    let cancelled = false;

    ipcRenderer.invoke('gilmort-logs:start', { containers }).then((sessionId) => {
      if (!sessionId) return;
      if (cancelled) {
        // desmontou antes de resolver: encerra a sessão que o main já criou
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(containers)]);

  useEffect(() => {
    if (autoScroll && areaRef.current) areaRef.current.scrollTop = areaRef.current.scrollHeight;
  }, [lines, autoScroll]);

  const visible = lines.filter((l) => enabled[l.service]);

  return (
    <StyledWrapper>
      <div className="flex gap-3 items-center p-2 border-b">
        {containers.map((c) => (
          <label key={c} className="flex items-center gap-1 text-xs">
            <input type="checkbox" checked={!!enabled[c]} onChange={(e) => setEnabled((p) => ({ ...p, [c]: e.target.checked }))} />
            {c}
          </label>
        ))}
        <label className="flex items-center gap-1 text-xs ml-auto">
          <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} /> auto-scroll
        </label>
        <button className="btn btn-sm" onClick={() => setLines([])}>clear</button>
      </div>
      <div className="log-area" ref={areaRef}>
        {containers.length === 0 && <div className="text-xs text-muted">Nenhum serviço com container configurado.</div>}
        {visible.map((l, i) => (
          <span className={`log-line svc-${l.service}`} key={i}>[{l.service}] {l.line}</span>
        ))}
      </div>
    </StyledWrapper>
  );
};

export default GilmortLogs;

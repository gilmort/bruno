import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { IconTrash, IconPlus, IconDownload, IconUpload, IconDatabaseImport } from '@tabler/icons';
import { flattenItems, isItemARequest } from 'utils/collections';
import Button from 'ui/Button';
import { parseGilmortConfig, normalizeService, loadGilmortConfig, saveGilmortConfig, DEFAULTS } from 'utils/gilmort/config';
import StyledWrapper from './StyledWrapper';

const emptyService = { name: '', healthUrl: '', container: '', expectedStatus: 200 };

// Build service entries from a collection's HTTP requests (the masterdata lists).
const seedFromCollection = (collection) => {
  const items = flattenItems(collection?.items || []);
  return items
    .filter((it) => isItemARequest(it) && it.request?.url)
    .map((it) => ({ name: it.name, healthUrl: it.request.url, container: '', expectedStatus: 200 }));
};

const GilmortConfigs = ({ collection }) => {
  const [config, setConfig] = useState(loadGilmortConfig);
  const { services, composePath, healthTimeoutMs, pollIntervalMs } = config;

  const patch = (updates) => setConfig((prev) => ({ ...prev, ...updates }));

  const setField = (i, field, value) => {
    patch({ services: services.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)) });
  };
  const addRow = () => patch({ services: [...services, { ...emptyService }] });
  const removeRow = (i) => patch({ services: services.filter((_, idx) => idx !== i) });

  const handleSeed = () => {
    const seeded = seedFromCollection(collection);
    if (!seeded.length) {
      toast.error('Nenhum request HTTP encontrado nesta coleção');
      return;
    }
    const existing = new Set(services.map((s) => s.name));
    const merged = [...services, ...seeded.filter((s) => !existing.has(s.name))];
    patch({ services: merged });
    toast.success(`${merged.length - services.length} serviço(s) adicionado(s) da coleção`);
  };

  const handleSave = () => {
    try {
      saveGilmortConfig(config);
      toast.success('Gilmort config saved');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleExport = () => {
    const clean = parseGilmortConfig(config);
    const blob = new Blob([JSON.stringify(clean, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gilmort-config.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseGilmortConfig(JSON.parse(reader.result));
        setConfig(parsed);
        saveGilmortConfig(parsed);
        toast.success('Gilmort config imported');
      } catch (err) {
        toast.error(err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <StyledWrapper className="h-full w-full">
      <div className="text-xs mb-4 text-muted">Config global (compartilhada por todas as coleções) — monitora health-check HTTP + container Docker.</div>

      <div className="settings-grid mb-4">
        <label>Caminho do qa-compose (Makefile)</label>
        <input
          value={composePath}
          placeholder="/Users/você/projects/qa-compose"
          onChange={(e) => patch({ composePath: e.target.value })}
        />
        <label>Health check timeout (ms)</label>
        <input
          type="number"
          value={healthTimeoutMs}
          placeholder={DEFAULTS.healthTimeoutMs}
          onChange={(e) => patch({ healthTimeoutMs: Number(e.target.value) })}
        />
        <label>Intervalo de polling (ms)</label>
        <input
          type="number"
          value={pollIntervalMs}
          placeholder={DEFAULTS.pollIntervalMs}
          onChange={(e) => patch({ pollIntervalMs: Number(e.target.value) })}
        />
      </div>

      <table>
        <thead>
          <tr><th>Nome</th><th>URL health</th><th>Container</th><th>Status esperado</th><th></th></tr>
        </thead>
        <tbody>
          {services.map((s, i) => (
            <tr key={i}>
              <td><input value={s.name} onChange={(e) => setField(i, 'name', e.target.value)} /></td>
              <td><input value={s.healthUrl} onChange={(e) => setField(i, 'healthUrl', e.target.value)} /></td>
              <td><input value={s.container || ''} onChange={(e) => setField(i, 'container', e.target.value)} /></td>
              <td><input type="number" value={s.expectedStatus ?? 200} onChange={(e) => setField(i, 'expectedStatus', Number(e.target.value))} /></td>
              <td><button onClick={() => removeRow(i)} aria-label="remove"><IconTrash size={16} strokeWidth={1.5} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex gap-2 mt-3">
        <Button size="sm" onClick={addRow}><IconPlus size={14} strokeWidth={1.5} /> Add</Button>
        <Button size="sm" onClick={handleSeed}><IconDatabaseImport size={14} strokeWidth={1.5} /> Seed da coleção</Button>
        <Button size="sm" onClick={handleExport}><IconDownload size={14} strokeWidth={1.5} /> Export</Button>
        <label className="btn btn-sm cursor-pointer flex items-center gap-1">
          <IconUpload size={14} strokeWidth={1.5} /> Import
          <input type="file" accept="application/json" className="hidden" onChange={handleImport} />
        </label>
      </div>

      <div className="mt-6">
        <Button type="submit" size="sm" onClick={handleSave}>Save</Button>
      </div>
    </StyledWrapper>
  );
};

export default GilmortConfigs;

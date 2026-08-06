import React from 'react';
import { get } from 'lodash';
import { useDispatch } from 'react-redux';
import toast from 'react-hot-toast';
import { IconTrash, IconPlus, IconDownload, IconUpload } from '@tabler/icons';
import Button from 'ui/Button';
import { updateCollectionGilmort } from 'providers/ReduxStore/slices/collections';
import { saveCollectionSettings } from 'providers/ReduxStore/slices/collections/actions';
import { parseGilmortConfig, normalizeService } from 'utils/gilmort/config';
import StyledWrapper from './StyledWrapper';

const emptyService = { name: '', healthUrl: '', container: '', expectedStatus: 200 };

const GilmortConfigs = ({ collection }) => {
  const dispatch = useDispatch();

  const services = collection.draft?.brunoConfig
    ? get(collection, 'draft.brunoConfig.gilmort.services', [])
    : get(collection, 'brunoConfig.gilmort.services', []);

  const update = (nextServices) => {
    dispatch(updateCollectionGilmort({ collectionUid: collection.uid, gilmort: { services: nextServices } }));
  };

  const setField = (i, field, value) => {
    const next = services.map((s, idx) => (idx === i ? { ...s, [field]: value } : s));
    update(next);
  };
  const addRow = () => update([...services, { ...emptyService }]);
  const removeRow = (i) => update(services.filter((_, idx) => idx !== i));
  const handleSave = () => dispatch(saveCollectionSettings(collection.uid));

  const handleExport = () => {
    const blob = new Blob([JSON.stringify({ services: services.map(normalizeService) }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gilmort-config.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseGilmortConfig(JSON.parse(reader.result));
        update(parsed.services);
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
      <div className="text-xs mb-4 text-muted">Serviços monitorados desta coleção (health-check HTTP + container Docker).</div>
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

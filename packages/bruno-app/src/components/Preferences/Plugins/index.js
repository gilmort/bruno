import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { IconReload, IconBrandGit, IconSettings, IconChevronDown, IconChevronRight } from '@tabler/icons';
import { pluginSettingsRegistry } from 'utils/plugins/registry';

const Plugins = () => {
  const plugins = useSelector((state) => state.plugins.manifests);
  const settingsPageIds = useSelector((state) => state.plugins.settingsPageIds);
  const [gitUrl, setGitUrl] = useState('');
  const [expanded, setExpanded] = useState(null);

  const setEnabled = (id, enabled) => window.ipcRenderer.invoke('renderer:set-plugin-enabled', { id, enabled });
  const reload = (id) => window.ipcRenderer.invoke('renderer:reload-plugin', id);
  const installFromGit = () => {
    if (!gitUrl.trim()) return;
    window.ipcRenderer.invoke('renderer:install-plugin-from-git', { url: gitUrl.trim() }).then(() => setGitUrl(''));
  };

  return (
    <div className="flex flex-col w-full">
      <div className="flex items-center gap-2 mb-4">
        <input
          className="flex-1 border px-2 py-1 rounded"
          placeholder="https://github.com/user/meu-plugin.git"
          value={gitUrl}
          onChange={(e) => setGitUrl(e.target.value)}
        />
        <button className="btn btn-sm btn-secondary flex items-center gap-1" onClick={installFromGit}>
          <IconBrandGit size={16} /> Add from git
        </button>
      </div>

      {plugins.length === 0 && <div className="text-muted">Nenhum plugin em ~/.bruno/plugins</div>}

      {plugins.map((p) => {
        const hasSettings = settingsPageIds.includes(p.id);
        const isExpanded = expanded === p.id;
        const SettingsPage = hasSettings ? pluginSettingsRegistry.get(p.id) : null;
        return (
          <div key={p.id} className="border-b">
            <div className="flex items-center justify-between py-2">
              <div>
                <div className="font-medium">{p.name} <span className="text-muted">v{p.version}</span></div>
                <div className={`text-xs ${p.status === 'errored' ? 'text-red-500' : 'text-muted'}`}>
                  {p.status}{p.error ? `: ${p.error}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {hasSettings && (
                  <button
                    className="flex items-center gap-1"
                    onClick={() => setExpanded(isExpanded ? null : p.id)}
                    aria-label="Configure"
                  >
                    {isExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                    <IconSettings size={16} />
                  </button>
                )}
                <button className="flex items-center gap-1" onClick={() => reload(p.id)} aria-label="Reload">
                  <IconReload size={16} />
                </button>
                <input
                  type="checkbox"
                  checked={p.status !== 'disabled'}
                  onChange={(e) => setEnabled(p.id, e.target.checked)}
                  aria-label="Enabled"
                />
              </div>
            </div>
            {isExpanded && SettingsPage && (
              <div className="pb-4 ps-2">
                <SettingsPage />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default Plugins;

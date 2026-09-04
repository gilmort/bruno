import React, { useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import * as TablerIcons from '@tabler/icons';
import { uuid } from 'utils/common';
import SidebarSection from 'components/Sidebar/SidebarSection';
import { addTab } from 'providers/ReduxStore/slices/tabs';

const iconFor = (name) => TablerIcons[name] || TablerIcons.IconPuzzle;

const PluginSidebarSection = () => {
  const dispatch = useDispatch();
  const items = useSelector((state) => state.plugins.sidebarItems);
  const manifests = useSelector((state) => state.plugins.manifests);

  // Agrupa os itens por plugin, preservando a ordem de registro.
  const groups = useMemo(() => {
    const byPlugin = new Map();
    for (const item of items) {
      if (!byPlugin.has(item.pluginId)) byPlugin.set(item.pluginId, []);
      byPlugin.get(item.pluginId).push(item);
    }
    return [...byPlugin.entries()];
  }, [items]);

  if (!items.length) return null;

  const openPanel = (item) =>
    item.panelType && dispatch(addTab({ uid: uuid(), collectionUid: null, type: item.panelType }));

  return (
    <>
      {groups.map(([pluginId, group]) => {
        // Uma página → clique único abre direto (leaf). Várias → pasta que expande.
        if (group.length === 1) {
          const item = group[0];
          return (
            <SidebarSection
              key={`plugin-${pluginId}-${item.id}`}
              id={`plugin-${pluginId}-${item.id}`}
              title={item.title}
              icon={iconFor(item.icon)}
              onActivate={() => openPanel(item)}
            />
          );
        }
        const name = (manifests.find((m) => m.id === pluginId) || {}).name || pluginId;
        return (
          <SidebarSection key={`plugin-${pluginId}`} id={`plugin-${pluginId}`} title={name} icon={iconFor(group[0].icon)}>
            {group.map((item) => (
              <div key={item.id} className="px-2 py-1 cursor-pointer" onClick={() => openPanel(item)}>
                {item.title}
              </div>
            ))}
          </SidebarSection>
        );
      })}
    </>
  );
};

export default PluginSidebarSection;

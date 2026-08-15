import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import * as TablerIcons from '@tabler/icons';
import { uuid } from 'utils/common';
import SidebarSection from 'components/Sidebar/SidebarSection';
import { addTab } from 'providers/ReduxStore/slices/tabs';

const PluginSidebarSection = () => {
  const dispatch = useDispatch();
  const items = useSelector((state) => state.plugins.sidebarItems);
  if (!items.length) return null;
  return (
    <>
      {items.map((item) => {
        const Icon = TablerIcons[item.icon] || TablerIcons.IconPuzzle;
        return (
          <SidebarSection key={`${item.pluginId}:${item.id}`} id={`plugin-${item.pluginId}-${item.id}`} title={item.title} icon={Icon}>
            <div
              className="px-2 py-1 cursor-pointer"
              onClick={() => item.panelType && dispatch(addTab({ uid: uuid(), collectionUid: null, type: item.panelType }))}
            >
              {item.title}
            </div>
          </SidebarSection>
        );
      })}
    </>
  );
};

export default PluginSidebarSection;

// packages/bruno-app/src/providers/ReduxStore/slices/plugins.spec.js
import reducer, { setPlugins, addSidebarItem, addPanelType, clearRegistrations } from './plugins';

const init = () => reducer(undefined, { type: '@@INIT' });

describe('plugins slice', () => {
  it('setPlugins guarda manifests e statuses', () => {
    const s = reducer(init(), setPlugins([{ id: 'a', name: 'A', status: 'inactive', contributes: {} }]));
    expect(s.manifests).toHaveLength(1);
    expect(s.statuses.a).toBe('inactive');
  });

  it('addSidebarItem acumula sem duplicar por id', () => {
    let s = reducer(init(), addSidebarItem({ pluginId: 'a', id: 'x', title: 'X', panelType: 'plugin:a:x' }));
    s = reducer(s, addSidebarItem({ pluginId: 'a', id: 'x', title: 'X', panelType: 'plugin:a:x' }));
    expect(s.sidebarItems).toHaveLength(1);
  });

  it('addPanelType registra o tipo', () => {
    const s = reducer(init(), addPanelType('plugin:a:main'));
    expect(s.panelTypes).toContain('plugin:a:main');
  });

  it('clearRegistrations remove tudo do plugin', () => {
    let s = init();
    s = reducer(s, addSidebarItem({ pluginId: 'a', id: 'x', title: 'X', panelType: 'plugin:a:x' }));
    s = reducer(s, addPanelType('plugin:a:x'));
    s = reducer(s, clearRegistrations('a'));
    expect(s.sidebarItems).toHaveLength(0);
    expect(s.panelTypes).toHaveLength(0);
  });
});

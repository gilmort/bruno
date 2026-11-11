// packages/bruno-app/src/providers/ReduxStore/slices/plugins.spec.js
import reducer, { setPlugins, addSidebarItem, addPanelType, setHomePanel, clearRegistrations } from './plugins';

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

  it('setHomePanel: o PRIMEIRO a registrar vence e clearRegistrations solta a home', () => {
    // Home é um lugar só. Dois plugins disputando viraria corrida de ordem de carga — e a home
    // mudaria de dono entre um start e outro sem ninguém mexer em nada.
    let s = reducer(init(), setHomePanel('plugin:a:dash'));
    expect(s.homePanel).toBe('plugin:a:dash');
    s = reducer(s, setHomePanel('plugin:b:outro'));
    expect(s.homePanel).toBe('plugin:a:dash');
    // descarregar OUTRO plugin não pode roubar a home de quem a tem
    s = reducer(s, clearRegistrations('b'));
    expect(s.homePanel).toBe('plugin:a:dash');
    // descarregar o DONO solta, senão a home aponta para um componente que não existe mais
    s = reducer(s, clearRegistrations('a'));
    expect(s.homePanel).toBeNull();
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

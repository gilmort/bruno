// packages/bruno-app/src/providers/ReduxStore/slices/plugins.js
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  manifests: [],
  statuses: {},
  sidebarItems: [],
  bottomBarItems: [],
  panelTypes: [],
  settingsPageIds: [],
  requestTabs: [],
  // Toggle global de visibilidade dos labels de valor (plugins que registram
  // registerValueMasker/registerEditorDecorator). Controlado pelo olho no ResponsePane.
  labelsHidden: false
};

export const pluginsSlice = createSlice({
  name: 'plugins',
  initialState,
  reducers: {
    setPlugins: (state, action) => {
      state.manifests = action.payload;
      state.statuses = {};
      action.payload.forEach((p) => { state.statuses[p.id] = p.status; });
    },
    addSidebarItem: (state, action) => {
      const exists = state.sidebarItems.some(
        (i) => i.pluginId === action.payload.pluginId && i.id === action.payload.id
      );
      if (!exists) state.sidebarItems.push(action.payload);
    },
    addBottomBarItem: (state, action) => {
      const exists = state.bottomBarItems.some(
        (i) => i.pluginId === action.payload.pluginId && i.id === action.payload.id
      );
      if (!exists) state.bottomBarItems.push(action.payload);
    },
    addPanelType: (state, action) => {
      if (!state.panelTypes.includes(action.payload)) state.panelTypes.push(action.payload);
    },
    addSettingsPage: (state, action) => {
      if (!state.settingsPageIds.includes(action.payload)) state.settingsPageIds.push(action.payload);
    },
    addRequestTab: (state, action) => {
      const exists = state.requestTabs.some(
        (t) => t.pluginId === action.payload.pluginId && t.id === action.payload.id
      );
      if (!exists) state.requestTabs.push(action.payload);
    },
    setLabelsHidden: (state, action) => {
      state.labelsHidden = !!action.payload;
    },
    clearRegistrations: (state, action) => {
      const pluginId = action.payload;
      state.sidebarItems = state.sidebarItems.filter((i) => i.pluginId !== pluginId);
      state.bottomBarItems = state.bottomBarItems.filter((i) => i.pluginId !== pluginId);
      state.panelTypes = state.panelTypes.filter((t) => !t.startsWith(`plugin:${pluginId}:`));
      state.settingsPageIds = state.settingsPageIds.filter((id) => id !== pluginId);
      state.requestTabs = state.requestTabs.filter((t) => t.pluginId !== pluginId);
    }
  }
});

export const { setPlugins, addSidebarItem, addBottomBarItem, addPanelType, addSettingsPage, addRequestTab, setLabelsHidden, clearRegistrations }
  = pluginsSlice.actions;

export default pluginsSlice.reducer;

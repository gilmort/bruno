import { useSelector } from 'react-redux';

// MODO HOME: o dashboard registrado por um plugin (`registerHomePanel`) ocupa a tela quando não há
// trabalho de verdade em andamento. "Trabalho de verdade" NÃO inclui as abas Overview/Environments
// que o Bruno cria sozinho ao abrir o workspace padrão — toda inicialização já nasce com uma delas
// focada (workspaces/actions.js, switchWorkspace), então gatear só em `!activeTabUid` faz o modo
// home nunca aparecer: sempre há uma aba "ativa", só que sintética.
//
// A MESMA fórmula decide duas coisas em componentes diferentes (a topbar em AppTitleBar e o
// conteúdo principal em pages/Bruno) — extraída para cá porque tê-la duplicada é o que gera telas
// meio-normais-meio-home: a topbar destrava e o conteúdo não acompanha, ou vice-versa.
const SYNTHETIC_TAB_TYPES = new Set(['workspaceOverview', 'workspaceEnvironments']);

export const useIsHomeMode = () => {
  const sidebarCollapsed = useSelector((state) => state.app.sidebarCollapsed);
  const homePanelType = useSelector((state) => state.plugins.homePanel);
  const activeTabUid = useSelector((state) => state.tabs.activeTabUid);
  const activeTab = useSelector((state) => state.tabs.tabs.find((t) => t.uid === state.tabs.activeTabUid));
  const isSyntheticTab = !activeTabUid || SYNTHETIC_TAB_TYPES.has(activeTab?.type);

  return sidebarCollapsed && isSyntheticTab && !!homePanelType;
};

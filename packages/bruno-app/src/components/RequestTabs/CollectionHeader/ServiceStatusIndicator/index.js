import React from 'react';
import { useDispatch } from 'react-redux';
import { addTab } from 'providers/ReduxStore/slices/tabs';
import { uuid } from 'utils/common';
import ToolHint from 'components/ToolHint';
import useGilmortMonitor from 'hooks/useGilmortMonitor';
import StyledWrapper from './StyledWrapper';

const ServiceStatusIndicator = ({ collection }) => {
  const dispatch = useDispatch();
  const { statuses, services } = useGilmortMonitor();

  if (!services || !services.length) return null;

  const statusOf = (name) => statuses.find((s) => s.name === name)?.status || 'gray';

  const openLogs = (serviceName) => {
    try {
      sessionStorage.setItem('gilmort.focusService', serviceName || '');
    } catch (_) {}
    dispatch(addTab({ uid: uuid(), collectionUid: collection.uid, type: 'gilmort-logs' }));
  };

  const tooltipOf = (s) => {
    const st = statuses.find((x) => x.name === s.name);
    const container = st?.containerUp == null ? 'n/a' : st.containerUp ? 'up' : 'down';
    const http = st?.httpStatus == null ? 'no-resp' : st.httpStatus;
    return `${s.name}: container ${container}, http ${http} (exp ${s.expectedStatus ?? 200})`;
  };

  return (
    <StyledWrapper data-testid="gilmort-status">
      {services.map((s, i) => (
        <ToolHint key={i} text={tooltipOf(s)} toolhintId={`GilmortStatus-${s.name}-${i}`} place="bottom">
          <button className={`svc-btn ${statusOf(s.name)}`} onClick={() => openLogs(s.name)}>
            {String(s.name).slice(0, 8)}
          </button>
        </ToolHint>
      ))}
    </StyledWrapper>
  );
};

export default ServiceStatusIndicator;

import React from 'react';
import { useDispatch } from 'react-redux';
import { addTab } from 'providers/ReduxStore/slices/tabs';
import { uuid } from 'utils/common';
import ToolHint from 'components/ToolHint';
import useGilmortMonitor from 'hooks/useGilmortMonitor';
import StyledWrapper from './StyledWrapper';

const ServiceStatusIndicator = ({ collection }) => {
  const dispatch = useDispatch();
  const { statuses } = useGilmortMonitor(collection);

  const services = collection?.draft?.brunoConfig
    ? collection?.draft?.brunoConfig?.gilmort?.services
    : collection?.brunoConfig?.gilmort?.services;

  if (!services || !services.length) return null;

  const statusOf = (name) => statuses.find((s) => s.name === name)?.status || 'gray';

  const openLogs = () => {
    dispatch(addTab({ uid: uuid(), collectionUid: collection.uid, type: 'gilmort-logs' }));
  };

  const tooltip = services
    .map((s) => {
      const st = statuses.find((x) => x.name === s.name);
      const container = st?.containerUp == null ? 'n/a' : st.containerUp ? 'up' : 'down';
      const http = st?.httpStatus == null ? 'no-resp' : st.httpStatus;
      return `${s.name}: container ${container}, http ${http} (exp ${s.expectedStatus ?? 200})`;
    })
    .join('\n');

  return (
    <ToolHint text={tooltip} toolhintId="GilmortStatusToolhintId" place="bottom">
      <StyledWrapper onClick={openLogs} data-testid="gilmort-status">
        {services.map((s, i) => (
          <div className="svc-box" key={i}>
            <div className={`svc-dot ${statusOf(s.name)}`} />
          </div>
        ))}
      </StyledWrapper>
    </ToolHint>
  );
};

export default ServiceStatusIndicator;

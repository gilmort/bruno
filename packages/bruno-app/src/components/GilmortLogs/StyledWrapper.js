import styled from 'styled-components';

const StyledWrapper = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;

  .log-area {
    flex: 1;
    overflow: auto;
    font-family: monospace;
    font-size: 12px;
    padding: 8px;
    white-space: pre-wrap;
  }
  .log-line { display: block; }
  .svc-SPA { color: #22c55e; }
  .svc-BFF { color: #3b82f6; }
  .svc-BC  { color: #eab308; }
`;

export default StyledWrapper;

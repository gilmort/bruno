import styled from 'styled-components';

const StyledWrapper = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;

  .toolbar, .filters {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 8px;
    border-bottom: 1px solid ${(props) => props.theme.colors.text.subtext0};
    flex-wrap: wrap;
  }

  .group { display: flex; align-items: center; gap: 6px; }
  .lbl { font-size: 12px; color: ${(props) => props.theme.colors.text.muted}; }
  .hint { font-size: 11px; color: ${(props) => props.theme.colors.text.muted}; font-style: italic; }

  .svc-row {
    display: flex;
    align-items: center;
    gap: 3px;
    label { display: flex; align-items: center; gap: 4px; font-size: 12px; margin-right: 2px; }
  }

  .ctl {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px 7px;
    font-size: 11px;
    border: 1px solid ${(props) => props.theme.colors.text.subtext0};
    border-radius: 3px;
    background: transparent;
    cursor: pointer;

    &.xs { padding: 2px 4px; }
    &:hover:not(:disabled) { border-color: ${(props) => props.theme.colors.text.muted}; }
    &:disabled { opacity: 0.4; cursor: default; }
  }

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
  .svc-ACL { color: #a855f7; }
`;

export default StyledWrapper;

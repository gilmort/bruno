import styled from 'styled-components';

const StyledWrapper = styled.span`
  .masked-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 12px;
    font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
    background-color: ${(props) => props.theme.background?.surface0 || props.theme.colors?.bg?.muted || '#e2e8f0'};
    color: ${(props) => props.theme.colors?.text?.muted || '#475569'};
    cursor: pointer;
    position: relative;
    white-space: nowrap;

    .badge-icon {
      font-size: 10px;
    }
  }

  .masked-tooltip {
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    z-index: 9999;
    background-color: ${(props) => props.theme.tooltip?.bg || props.theme.modal?.body?.bg || '#1e293b'};
    color: ${(props) => props.theme.tooltip?.text || '#f1f5f9'};
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 11px;
    font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: 8px;

    /* Invisible bridge to cover the gap between badge and tooltip */
    &::before {
      content: '';
      position: absolute;
      bottom: -8px;
      left: 0;
      right: 0;
      height: 8px;
    }

    .uuid-text {
      user-select: all;
    }

    .copy-btn {
      padding: 2px 6px;
      border-radius: 3px;
      border: 1px solid ${(props) => props.theme.input?.border || '#64748b'};
      background: transparent;
      color: inherit;
      cursor: pointer;
      font-size: 10px;
      white-space: nowrap;

      &:hover {
        background-color: ${(props) => props.theme.colors?.bg?.muted || 'rgba(255,255,255,0.1)'};
      }
    }
  }
`;

export default StyledWrapper;



import styled from 'styled-components';

const COLORS = { green: '#22c55e', yellow: '#eab308', red: '#ef4444', gray: '#9ca3af' };

const StyledWrapper = styled.div`
  display: flex;
  gap: 4px;
  align-items: center;

  .svc-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 34px;
    max-width: 64px;
    padding: 1px 6px;
    border: 1px solid ${(props) => props.theme.colors.text.subtext0};
    border-radius: 3px;
    background: transparent;
    font-size: 11px;
    font-weight: 700;
    line-height: 1.4;
    letter-spacing: 0.02em;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    &:hover {
      border-color: ${(props) => props.theme.colors.text.muted};
    }
  }
  .green { color: ${COLORS.green}; }
  .yellow { color: ${COLORS.yellow}; }
  .red { color: ${COLORS.red}; }
  .gray { color: ${COLORS.gray}; }
`;

export default StyledWrapper;

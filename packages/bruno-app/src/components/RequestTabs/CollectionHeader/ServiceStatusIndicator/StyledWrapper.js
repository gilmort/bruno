import styled from 'styled-components';

const COLORS = { green: '#22c55e', yellow: '#eab308', red: '#ef4444', gray: '#9ca3af' };

const StyledWrapper = styled.div`
  display: flex;
  gap: 3px;
  align-items: center;
  cursor: pointer;

  .svc-box {
    width: 14px;
    height: 14px;
    border: 1px solid ${(props) => props.theme.colors.text.subtext0};
    border-radius: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .svc-dot { width: 6px; height: 6px; border-radius: 50%; }
  .green { background: ${COLORS.green}; }
  .yellow { background: ${COLORS.yellow}; }
  .red { background: ${COLORS.red}; }
  .gray { background: ${COLORS.gray}; }
`;

export default StyledWrapper;

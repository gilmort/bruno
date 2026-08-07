import styled from 'styled-components';

const StyledWrapper = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 6px;
  border-radius: 4px;
  cursor: pointer;
  color: ${(props) => props.theme.colors?.text?.muted || props.theme.dropdown?.iconColor};
  transition: all 0.15s ease;
  white-space: nowrap;

  &:hover {
    background-color: ${(props) => props.theme.dropdown?.hoverBg || props.theme.workspace?.button?.bg};
    color: ${(props) => props.theme.text};
  }

  &.active {
    color: ${(props) => props.theme.colors?.text?.green || '#22c55e'};
  }

  &.disabled {
    opacity: 0.4;
    pointer-events: none;
  }

  .mask-label {
    font-size: 11px;
    line-height: 1;
  }
`;

export default StyledWrapper;




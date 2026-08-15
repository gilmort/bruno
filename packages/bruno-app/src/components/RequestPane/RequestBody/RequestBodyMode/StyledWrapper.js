import styled from 'styled-components';

const Wrapper = styled.div`
  font-size: ${(props) => props.theme.font.size.base};
  white-space: nowrap;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-end;

  .body-mode-selector {
    background: transparent;
    border-radius: 3px;

    .selected-body-mode {
      color: ${(props) => props.theme.primary.text};
    }
  }

  .caret {
    color: rgb(140, 140, 140);
    fill: rgb(140, 140, 140);
  }
`;

export default Wrapper;

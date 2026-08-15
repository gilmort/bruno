import styled from 'styled-components';

const StyledWrapper = styled.div`
  .caret {
    color: ${(props) => props.theme.app.collection.toolbar.environmentSelector.caret};
    fill: ${(props) => props.theme.app.collection.toolbar.environmentSelector.caret};
  }

  .button-dropdown-button {
    /* look plano igual ao seletor de body do request: sem borda/fundo, texto primário */
    color: ${(props) => props.theme.primary.text};
    border-color: transparent !important;
    background: transparent !important;
    padding-left: 0.75rem;
    padding-right: 0.25rem;
  }

  .dropdown-divider {
    background-color: ${(props) => props.theme.dropdown.separator};
    height: 1px;
    margin: 4px 0;
  }

  .active {
    color: ${(props) => props.theme.primary.text};
  }

  .icon-muted {
    color: ${(props) => props.theme.colors.text.muted};
  }

  .preview-response-tab-label {
    color: ${(props) => props.theme.colors.text.muted};
  }
`;

export default StyledWrapper;

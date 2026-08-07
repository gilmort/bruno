import styled from 'styled-components';

const StyledWrapper = styled.div`
  max-width: 900px;

  .masks-table {
    width: 100%;
    border-collapse: collapse;

    th {
      text-align: left;
      padding: 8px 6px;
      font-size: 12px;
      font-weight: 600;
      color: ${(props) => props.theme.colors?.text?.muted || '#64748b'};
      border-bottom: 1px solid ${(props) => props.theme.input?.border || '#e2e8f0'};
    }

    td {
      padding: 4px 6px;
      vertical-align: top;
    }
  }

  .textbox {
    width: 100%;
    border: 1px solid ${(props) => props.theme.input?.border || '#ccc'};
    padding: 0.25rem 0.45rem;
    border-radius: 3px;
    font-size: 13px;
    background-color: ${(props) => props.theme.input?.bg || '#fff'};
    color: ${(props) => props.theme.text};
    outline: none;
    transition: border-color ease-in-out 0.1s;

    &:focus {
      border: solid 1px ${(props) => props.theme.input?.focusBorder || '#3b82f6'} !important;
    }

    &.error {
      border-color: ${(props) => props.theme.colors?.text?.danger || '#ef4444'} !important;
    }
  }

  .error-text {
    color: ${(props) => props.theme.colors?.text?.danger || '#ef4444'};
    font-size: 11px;
    margin-top: 2px;
  }

  .btn-add-row {
    margin-top: 12px;
  }

  .btn-remove {
    color: ${(props) => props.theme.colors?.text?.danger || '#ef4444'};
    cursor: pointer;
    padding: 4px;

    &:hover {
      opacity: 0.7;
    }
  }

  .btn-test {
    color: ${(props) => props.theme.textLink || '#3b82f6'};
    cursor: pointer;
    padding: 4px;
    font-size: 12px;

    &:hover {
      opacity: 0.7;
    }
  }

  .test-result {
    padding: 8px;
    margin-top: 4px;
    border-radius: 4px;
    font-size: 12px;
    background-color: ${(props) => props.theme.background?.surface0 || props.theme.colors?.bg?.muted || '#f1f5f9'};

    .test-error {
      color: ${(props) => props.theme.colors?.text?.danger || '#ef4444'};
    }

    .test-success {
      color: ${(props) => props.theme.colors?.text?.green || '#22c55e'};
    }
  }

  .actions-cell {
    display: flex;
    align-items: center;
    gap: 4px;
    padding-top: 6px;
  }

  .request-path-cell {
    position: relative;
  }

  .autocomplete-dropdown {
    position: absolute;
    top: 100%;
    left: 6px;
    right: 6px;
    z-index: 50;
    max-height: 200px;
    overflow-y: auto;
    background-color: ${(props) => props.theme.input?.bg || '#fff'};
    border: 1px solid ${(props) => props.theme.input?.border || '#ccc'};
    border-top: none;
    border-radius: 0 0 4px 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .autocomplete-item {
    padding: 6px 10px;
    font-size: 12px;
    cursor: pointer;
    color: ${(props) => props.theme.text};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    &:hover,
    &.highlighted {
      background-color: ${(props) => props.theme.background?.surface0 || props.theme.colors?.bg?.muted || '#f1f5f9'};
    }
  }
`;

export default StyledWrapper;





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
    max-height: 150px;
    overflow-y: auto;
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
    left: 0;
    z-index: 50;
    min-width: 400px;
    max-height: 240px;
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
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;

    &:hover,
    &.highlighted {
      background-color: ${(props) => props.theme.background?.surface0 || props.theme.colors?.bg?.muted || '#f1f5f9'};
    }
  }

  .autocomplete-path {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }

  .autocomplete-collection {
    font-size: 10px;
    color: ${(props) => props.theme.colors?.text?.muted || '#94a3b8'};
    background-color: ${(props) => props.theme.background?.surface0 || props.theme.colors?.bg?.muted || '#f1f5f9'};
    padding: 1px 6px;
    border-radius: 3px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .test-loading {
    color: ${(props) => props.theme.textLink || '#3b82f6'};
    font-style: italic;
  }

  .json-config-panel {
    margin-top: 12px;
    border: 1px solid ${(props) => props.theme.input?.border || '#ccc'};
    border-radius: 6px;
    overflow: hidden;
  }

  .json-config-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background-color: ${(props) => props.theme.background?.surface0 || props.theme.colors?.bg?.muted || '#f1f5f9'};
    border-bottom: 1px solid ${(props) => props.theme.input?.border || '#ccc'};
  }

  .json-config-title {
    font-size: 12px;
    font-weight: 600;
    color: ${(props) => props.theme.colors?.text?.muted || '#64748b'};
  }

  .btn-copy-json {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 10px;
    font-size: 12px;
    border-radius: 4px;
    cursor: pointer;
    border: 1px solid ${(props) => props.theme.input?.border || '#ccc'};
    background-color: transparent;
    color: ${(props) => props.theme.text};
    transition: all 0.15s ease;

    &:hover {
      background-color: ${(props) => props.theme.background?.surface0 || props.theme.colors?.bg?.muted || '#f1f5f9'};
    }
  }

  .json-config-textarea {
    width: 100%;
    min-height: 120px;
    max-height: 300px;
    padding: 12px;
    font-size: 12px;
    font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
    line-height: 1.5;
    border: none;
    outline: none;
    resize: vertical;
    background-color: ${(props) => props.theme.input?.bg || '#fff'};
    color: ${(props) => props.theme.text};
  }

  .json-config-hint {
    padding: 6px 12px;
    font-size: 11px;
    color: ${(props) => props.theme.colors?.text?.muted || '#94a3b8'};
    border-top: 1px solid ${(props) => props.theme.input?.border || '#ccc'};
    background-color: ${(props) => props.theme.background?.surface0 || props.theme.colors?.bg?.muted || '#f1f5f9'};
  }
`;

export default StyledWrapper;


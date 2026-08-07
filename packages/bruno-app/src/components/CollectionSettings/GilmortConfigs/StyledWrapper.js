import styled from 'styled-components';

const StyledWrapper = styled.div`
  .settings-grid {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 8px 12px;
    align-items: center;
    max-width: 640px;

    label {
      font-size: 12px;
      color: ${(props) => props.theme.colors.text.muted};
    }
    input {
      background: transparent;
      border: 1px solid ${(props) => props.theme.colors.text.subtext0};
      border-radius: 3px;
      padding: 3px 6px;
      font-size: 12px;
    }
  }

  table {
    width: 100%;
    border-collapse: collapse;
    td, th { padding: 4px 8px; text-align: left; }
    input { width: 100%; background: transparent; }
  }
`;

export default StyledWrapper;

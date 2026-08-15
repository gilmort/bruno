import React, { useCallback, useState } from 'react';
import { useSelector } from 'react-redux';
import ReactJson from 'react-json-view';
import ErrorBanner from 'ui/ErrorBanner';
import { pluginValueMaskers } from 'utils/plugins/registry';

// Badge genérico pro texto que um plugin retorna via registerValueMasker (ex.:
// um masker devolve um label legível pro valor; um masker de segredo
// devolveria algo como "••••••••"). Hover revela o valor original + copiar —
// porta components/MaskedValue do core (removido na migração), sem acoplar
// este componente a nenhum plugin específico.
const MaskedBadge = ({ label, originalValue }) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', cursor: 'pointer' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => {
        setOpen(false); setCopied(false);
      }}
    >
      <span style={{
        padding: '1px 6px', borderRadius: 4, fontSize: 12,
        background: 'rgba(127,127,127,.2)', whiteSpace: 'nowrap'
      }}
      >
        {label}
      </span>
      {open && (
        <span style={{
          position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)',
          zIndex: 20, background: '#1e293b', color: '#f1f5f9', borderRadius: 6, padding: '6px 8px',
          fontSize: 11, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 8
        }}
        >
          <span style={{ userSelect: 'all' }}>{originalValue}</span>
          <button
            type="button"
            style={{ border: '1px solid #64748b', background: 'transparent', color: 'inherit', borderRadius: 3, padding: '1px 5px', fontSize: 11 }}
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(originalValue).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              });
            }}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </span>
      )}
    </span>
  );
};

const JsonPreview = ({ data, displayedTheme }) => {
  const labelsHidden = useSelector((state) => state.plugins.labelsHidden);
  // Plugins (ex.: json-response-labels) só decoram o CodeMirror via registerEditorDecorator,
  // que não cobre esta árvore do react-json-view. registerValueMasker fecha essa lacuna.
  // O olho no ResponsePane liga/desliga via labelsHidden.
  const valueRenderer = useCallback((valueAsString, value, ...keyPath) => {
    if (labelsHidden || typeof value !== 'string' || !pluginValueMaskers.count()) return valueAsString;
    const fieldName = keyPath[0];
    const fullPath = [...keyPath].reverse().join('.');
    const label = pluginValueMaskers.getMask(fieldName, value, fullPath);
    return label ? <MaskedBadge label={label} originalValue={value} /> : valueAsString;
  }, [labelsHidden]);

  // Helper function to validate and parse JSON data
  const validateJsonData = (data) => {
    // If data is already an object or array, use it directly
    if (typeof data === 'object' && data !== null) {
      return { data, error: null };
    }

    // If data is a string, try to parse it
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        return { data: parsed, error: null };
      } catch (e) {
        return { data: null, error: `Invalid JSON format: ${e.message}` };
      }
    }

    // For other types, return error
    return { data: null, error: 'Invalid input. Expected a JSON object, array, or valid JSON string.' };
  };

  // Validate and parse JSON data
  const jsonData = validateJsonData(data);

  // Show error if parsing failed
  if (jsonData.error) {
    return <ErrorBanner errors={[{ title: 'Cannot preview as JSON', message: jsonData.error }]} />;
  }

  // Validate that data can be rendered as JSON tree
  if (jsonData.data === null || jsonData.data === undefined) {
    return <ErrorBanner errors={[{ title: 'Cannot preview as JSON', message: 'Data is null or undefined. Expected a valid JSON object or array.' }]} />;
  }

  if (typeof jsonData.data !== 'object') {
    return <ErrorBanner errors={[{ title: 'Cannot preview as JSON', message: 'Data cannot be rendered as a JSON tree. Expected a JSON object or array.' }]} />;
  }

  return (
    <ReactJson
      src={jsonData.data}
      theme={displayedTheme === 'light' ? 'rjv-default' : 'monokai'}
      collapsed={1}
      displayDataTypes={false}
      displayObjectSize={true}
      enableClipboard={true}
      name={false}
      valueRenderer={valueRenderer}
      style={{
        backgroundColor: 'transparent',
        fontSize: '12px',
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
        padding: '16px'
      }}
    />
  );
};

export default JsonPreview;

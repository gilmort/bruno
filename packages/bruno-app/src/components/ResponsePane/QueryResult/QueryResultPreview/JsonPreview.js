import React, { useCallback } from 'react';
import ReactJson from 'react-json-view';
import ErrorBanner from 'ui/ErrorBanner';
import MaskedValue from 'components/MaskedValue';

const JsonPreview = ({ data, displayedTheme, getMask, maskEnabled = true }) => {
  const valueRenderer = useCallback((valueAsString, value, ...keyPath) => {
    if (!maskEnabled || !getMask || typeof value !== 'string') {
      return valueAsString;
    }
    const fieldName = keyPath[0];
    // keyPath is reversed (leaf-first), e.g. ['planStageNameId', 0, 'stages']
    // Build the full dot-path: 'stages.0.planStageNameId'
    const fullPath = [...keyPath].reverse().join('.');
    const label = getMask(fieldName, value, fullPath);
    if (label) {
      return <MaskedValue label={label} originalUuid={value} />;
    }
    return valueAsString;
  }, [getMask, maskEnabled]);

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

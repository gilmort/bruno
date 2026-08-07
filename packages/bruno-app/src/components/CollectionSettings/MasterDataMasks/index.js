import React, { useState } from 'react';
import get from 'lodash/get';
import { useDispatch } from 'react-redux';
import { updateCollectionMasterDataMasks } from 'providers/ReduxStore/slices/collections';
import { saveCollectionSettings } from 'providers/ReduxStore/slices/collections/actions';
import { IconTrash, IconPlayerPlay, IconPlus } from '@tabler/icons';
import StyledWrapper from './StyledWrapper';

/**
 * Converts the stored masks object into an array of row objects
 * for the editable table.
 *
 * @param {object} masks - The masterDataMasks config object.
 * @returns {Array} Array of { fieldName, endpoint, idField, labelField }.
 */
const masksToRows = (masks) => {
  if (!masks || typeof masks !== 'object') return [];
  return Object.entries(masks).map(([fieldName, config]) => ({
    fieldName,
    endpoint: config.endpoint || '',
    idField: config.idField || 'id',
    labelField: config.labelField || 'description'
  }));
};

/**
 * Settings panel for configuring master data mask endpoints.
 * Each row maps a JSON field name to an API endpoint that returns
 * the human-readable labels for UUID values.
 *
 * @param {object} props
 * @param {object} props.collection - The collection object.
 */
const MasterDataMasks = ({ collection }) => {
  const dispatch = useDispatch();
  const [testResults, setTestResults] = useState({});

  // Initialize local rows from the persisted config (runs once per mount)
  const [rows, setRows] = useState(() => {
    const saved = get(collection, 'brunoConfig.masterDataMasks', {});
    return masksToRows(saved);
  });

  const handleFieldChange = (index, field, value) => {
    const updated = [...rows];
    updated[index] = { ...updated[index], [field]: value };
    setRows(updated);
  };

  const handleAddRow = () => {
    setRows((prev) => [
      ...prev,
      { fieldName: '', endpoint: '', idField: 'id', labelField: 'description' }
    ]);
  };

  const handleRemoveRow = (index) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const newMasks = {};
    rows.forEach((row) => {
      const key = row.fieldName.trim();
      if (key) {
        newMasks[key] = {
          endpoint: row.endpoint,
          idField: row.idField || 'id',
          labelField: row.labelField || 'description'
        };
      }
    });
    dispatch(
      updateCollectionMasterDataMasks({
        collectionUid: collection.uid,
        masterDataMasks: newMasks
      })
    );
    // saveCollectionSettings reads from draft and persists to disk
    setTimeout(() => {
      dispatch(saveCollectionSettings(collection.uid));
    }, 0);
  };

  const handleTestEndpoint = async (index) => {
    const row = rows[index];
    if (!row.endpoint) {
      setTestResults((prev) => ({ ...prev, [index]: { error: 'No endpoint URL specified' } }));
      return;
    }

    setTestResults((prev) => ({ ...prev, [index]: { loading: true } }));

    try {
      const res = await fetch(row.endpoint);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      const items = Array.isArray(data) ? data : [];
      const samples = items.slice(0, 3).map((item) => ({
        id: item[row.idField || 'id'],
        label: item[row.labelField || 'description']
      }));

      setTestResults((prev) => ({
        ...prev,
        [index]: {
          success: true,
          count: items.length,
          samples
        }
      }));
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [index]: { error: err.message }
      }));
    }
  };

  // Check for duplicate field names
  const fieldNames = rows.map((r) => r.fieldName.trim()).filter(Boolean);
  const duplicates = fieldNames.filter((name, i) => fieldNames.indexOf(name) !== i);
  const hasDuplicates = duplicates.length > 0;

  return (
    <StyledWrapper data-testid="master-data-masks-table">
      <h3 className="text-sm font-semibold mb-2">Master Data Masks</h3>
      <p className="text-xs mb-4 muted">
        Configure fields whose UUID values will be replaced with human-readable labels.
        Run the referenced request first, then its cached response will be used for masking.
      </p>

      {rows.length > 0 && (
        <table className="masks-table">
          <thead>
            <tr>
              <th>Field Name</th>
              <th>Request Path</th>
              <th>ID Field</th>
              <th>Masked Description</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const isDuplicate = duplicates.includes(row.fieldName.trim());
              const result = testResults[index];

              return (
                <React.Fragment key={index}>
                  <tr>
                    <td>
                      <input
                        className={`textbox ${isDuplicate ? 'error' : ''}`}
                        type="text"
                        value={row.fieldName}
                        placeholder="e.g. categoryId"
                        onChange={(e) => handleFieldChange(index, 'fieldName', e.target.value)}
                      />
                      {isDuplicate && <div className="error-text">Duplicate field name</div>}
                    </td>
                    <td>
                      <input
                        className="textbox"
                        type="text"
                        value={row.endpoint}
                        placeholder="e.g. master-data/plan-types"
                        onChange={(e) => handleFieldChange(index, 'endpoint', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="textbox"
                        type="text"
                        value={row.idField}
                        placeholder="id"
                        onChange={(e) => handleFieldChange(index, 'idField', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="textbox"
                        type="text"
                        value={row.labelField}
                        placeholder="description"
                        onChange={(e) => handleFieldChange(index, 'labelField', e.target.value)}
                      />
                    </td>
                    <td>
                      <div className="actions-cell">
                        <span
                          className="btn-test"
                          onClick={() => handleTestEndpoint(index)}
                          title="Test endpoint"
                          data-testid="master-data-masks-test-btn"
                        >
                          <IconPlayerPlay size={16} strokeWidth={1.5} />
                        </span>
                        <span
                          className="btn-remove"
                          onClick={() => handleRemoveRow(index)}
                          title="Remove row"
                        >
                          <IconTrash size={16} strokeWidth={1.5} />
                        </span>
                      </div>
                    </td>
                  </tr>
                  {result && !result.loading && (
                    <tr>
                      <td colSpan={5}>
                        <div className="test-result">
                          {result.error ? (
                            <span className="test-error">Error: {result.error}</span>
                          ) : (
                            <div className="test-success">
                              <div>{result.count} records found</div>
                              {result.samples?.map((s, i) => (
                                <div key={i} className="text-xs mt-1">
                                  {String(s.id)} → {String(s.label)}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      )}

      <div className="flex items-center gap-3 mt-4">
        <button
          className="btn btn-sm btn-secondary"
          onClick={handleAddRow}
          data-testid="master-data-masks-add-row"
        >
          <IconPlus size={14} strokeWidth={1.5} className="mr-1 inline" />
          Add Field
        </button>
        <button
          className="btn btn-sm btn-close"
          onClick={handleSave}
          disabled={hasDuplicates}
          data-testid="master-data-masks-save-btn"
        >
          Save
        </button>
      </div>
    </StyledWrapper>
  );
};

export default MasterDataMasks;









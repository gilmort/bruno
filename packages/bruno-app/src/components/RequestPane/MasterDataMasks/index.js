import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import get from 'lodash/get';
import { useDispatch, useSelector } from 'react-redux';
import { updateItemSettings } from 'providers/ReduxStore/slices/collections';
import { saveRequest, sendRequest } from 'providers/ReduxStore/slices/collections/actions';
import { flattenItems, isItemARequest, findCollectionByItemUid, findItemInCollection } from 'utils/collections';
import { IconTrash, IconPlayerPlay, IconPlus, IconCode, IconCopy, IconCheck } from '@tabler/icons';
import StyledWrapper from './StyledWrapper';
import pathUtil from 'utils/common/path';
import { normalizePath } from 'utils/common/path';

/**
 * Converts the stored masks object into an array of row objects.
 */
const masksToRows = (masks) => {
  if (!masks || typeof masks !== 'object') return [];
  return Object.entries(masks).map(([fieldName, config]) => ({
    fieldName,
    requestPath: config.requestPath || '',
    idField: config.idField || 'id',
    labelField: config.labelField || 'description'
  }));
};

/**
 * Builds a list of all request items across all loaded collections,
 * with their relative path from the owning collection root and a
 * label indicating which collection they belong to.
 *
 * @param {Array} collections - All loaded collections from Redux.
 * @param {string} currentCollectionUid - UID of the current collection.
 * @returns {Array<{ relPath: string, absPath: string, collectionName: string, isExternal: boolean, item: object }>}
 */
const getAllRequestPaths = (collections, currentCollectionUid) => {
  const results = [];
  for (const col of collections) {
    if (!col || !col.items) continue;
    const allItems = flattenItems(col.items || []);
    const colRoot = normalizePath(col.pathname || '');
    const isExternal = col.uid !== currentCollectionUid;

    allItems
      .filter((item) => isItemARequest(item) && item.pathname)
      .forEach((item) => {
        const abs = normalizePath(item.pathname);
        let rel = abs;
        if (rel.startsWith(colRoot)) {
          rel = rel.slice(colRoot.length);
        }
        rel = rel.replace(/^\/+/, '').replace(/\.bru$/, '');
        results.push({
          relPath: rel,
          absPath: abs,
          collectionName: col.name || '',
          isExternal,
          item
        });
      });
  }
  return results;
};

/**
 * Finds a request item by absolute path, relative path (with ..),
 * or path relative to collection root.
 *
 * - Absolute paths (start with /) are searched across ALL loaded collections.
 * - Relative paths with .. are resolved from the current item's directory
 *   and searched across all collections.
 * - Simple relative paths are searched within the current collection only.
 *
 * @param {Array} collections - All loaded collections from Redux.
 * @param {object} collection - The current collection object.
 * @param {string} requestPath - The path entered by the user.
 * @param {object|null} currentItem - The current request item (for resolving .. paths).
 * @returns {object|null} The matching item or null.
 */
const findItemByPath = (collections, collection, requestPath, currentItem) => {
  if (!collection || !requestPath || !collection.pathname) return null;

  const collectionRoot = normalizePath(collection.pathname);
  const trimmedInput = normalizePath(requestPath).replace(/\.bru$/, '');

  // Gather all items across all collections for absolute / .. lookups
  const getAllItems = () => {
    const items = [];
    for (const col of collections) {
      if (!col || !col.items) continue;
      flattenItems(col.items || []).forEach((it) => {
        if (isItemARequest(it) && it.pathname) items.push(it);
      });
    }
    return items;
  };

  // 1) Absolute path: starts with /  — search ALL collections
  if (trimmedInput.startsWith('/')) {
    return getAllItems().find((it) =>
      normalizePath(it.pathname).replace(/\.bru$/, '') === trimmedInput
    ) || null;
  }

  // 2) Relative path with .. or ./  — resolve from current item dir, search ALL collections
  if (trimmedInput.startsWith('..') || trimmedInput.startsWith('./')) {
    const baseDir = currentItem?.pathname
      ? pathUtil.dirname(normalizePath(currentItem.pathname))
      : collectionRoot;
    const resolved = normalizePath(pathUtil.resolve(baseDir, trimmedInput));

    return getAllItems().find((it) =>
      normalizePath(it.pathname).replace(/\.bru$/, '') === resolved
    ) || null;
  }

  // 3) Simple relative path — search within current collection only
  const localItems = flattenItems(collection.items || []);
  return localItems.find((it) => {
    if (!isItemARequest(it) || !it.pathname) return false;
    let rel = normalizePath(it.pathname);
    if (rel.startsWith(collectionRoot)) {
      rel = rel.slice(collectionRoot.length);
    }
    rel = rel.replace(/^\/+/, '').replace(/\.bru$/, '');
    return rel === trimmedInput;
  }) || null;
};

/**
 * Settings panel for configuring master data masks per request.
 * Each row maps a JSON field name to a Bruno request whose response
 * provides the human-readable labels for UUID values.
 *
 * @param {object} props
 * @param {object} props.item - The request item object.
 * @param {object} props.collection - The collection object.
 */
const MasterDataMasks = ({ item, collection }) => {
  const dispatch = useDispatch();
  const collections = useSelector((state) => state.collections.collections);
  const collectionsRef = useRef(collections);
  collectionsRef.current = collections;
  const [testResults, setTestResults] = useState({});
  const [showJsonConfig, setShowJsonConfig] = useState(false);
  const [jsonCopied, setJsonCopied] = useState(false);

  const [rows, setRows] = useState(() => {
    const saved = item.draft
      ? get(item, 'draft.settings.masterDataMasks', {})
      : get(item, 'settings.masterDataMasks', {});
    return masksToRows(saved);
  });

  // Autocomplete state
  const [activeAutocomplete, setActiveAutocomplete] = useState(null);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const autocompleteRef = useRef(null);

  // Build full list of request paths across all collections
  const allRequestPaths = useMemo(
    () => getAllRequestPaths(collections, collection.uid),
    [collections, collection.uid]
  );

  // Filter suggestions based on the current input
  const suggestions = useMemo(() => {
    if (activeAutocomplete === null) return [];
    const query = (rows[activeAutocomplete]?.requestPath || '').toLowerCase().trim();
    if (!query) {
      // Show current collection items first, then external
      return allRequestPaths
        .sort((a, b) => (a.isExternal === b.isExternal ? 0 : a.isExternal ? 1 : -1))
        .slice(0, 25);
    }
    return allRequestPaths.filter((entry) =>
      entry.relPath.toLowerCase().includes(query)
      || entry.absPath.toLowerCase().includes(query)
    ).slice(0, 25);
  }, [activeAutocomplete, rows, allRequestPaths]);

  // Close autocomplete on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(e.target)) {
        setActiveAutocomplete(null);
        setHighlightIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFieldChange = (index, field, value) => {
    const updated = [...rows];
    updated[index] = { ...updated[index], [field]: value };
    setRows(updated);
  };

  const handleRequestPathChange = (index, value) => {
    handleFieldChange(index, 'requestPath', value);
    setActiveAutocomplete(index);
    setHighlightIndex(-1);
  };

  const handleSelectSuggestion = (index, entry) => {
    // For external collections, use the absolute path so it can be resolved
    const value = entry.isExternal ? entry.absPath.replace(/\.bru$/, '') : entry.relPath;
    handleFieldChange(index, 'requestPath', value);
    setActiveAutocomplete(null);
    setHighlightIndex(-1);
  };

  const handleKeyDown = useCallback((e, index) => {
    if (activeAutocomplete !== index || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && highlightIndex >= 0) {
      e.preventDefault();
      handleSelectSuggestion(index, suggestions[highlightIndex]);
    } else if (e.key === 'Escape') {
      setActiveAutocomplete(null);
      setHighlightIndex(-1);
    }
  }, [activeAutocomplete, suggestions, highlightIndex]);

  const handleAddRow = () => {
    setRows((prev) => [
      ...prev,
      { fieldName: '', requestPath: '', idField: 'id', labelField: 'description' }
    ]);
  };

  const handleRemoveRow = (index) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
    if (activeAutocomplete === index) {
      setActiveAutocomplete(null);
    }
  };

  const handleSave = () => {
    const newMasks = {};
    rows.forEach((row) => {
      const key = row.fieldName.trim();
      if (key) {
        newMasks[key] = {
          requestPath: row.requestPath,
          idField: row.idField || 'id',
          labelField: row.labelField || 'description'
        };
      }
    });

    const currentSettings = item.draft
      ? get(item, 'draft.settings', {})
      : get(item, 'settings', {});

    dispatch(
      updateItemSettings({
        collectionUid: collection.uid,
        itemUid: item.uid,
        settings: { ...currentSettings, masterDataMasks: newMasks }
      })
    );

    setTimeout(() => {
      dispatch(saveRequest(item.uid, collection.uid));
    }, 0);
  };

  /**
   * Extracts an array from a parsed JSON response.
   * Handles bare arrays, common wrapper patterns like { data: [...] },
   * { results: [...] }, { items: [...] }, { content: [...] }, etc.,
   * and single-object responses (wraps them in an array).
   */
  const extractArray = (data) => {
    // If data is a string, try to parse it as JSON first
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (_) {
        return null;
      }
    }
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object') {
      // Try common wrapper keys
      for (const key of ['data', 'results', 'items', 'content', 'records', 'rows', 'list', 'entries', 'values']) {
        if (Array.isArray(data[key])) return data[key];
      }
      // Fallback: pick the first property that is an array
      for (const key of Object.keys(data)) {
        if (Array.isArray(data[key])) return data[key];
      }
      // Last resort: treat a single object as a one-element array
      return [data];
    }
    return null;
  };

  /**
   * Parses the response dataBuffer from a request item.
   * @returns {{ count: number, samples: Array }|null}
   */
  const parseResponseData = (refItem, row) => {
    if (!refItem?.response) return null;

    // Prefer the already-parsed response data when available
    let data = refItem.response.data;

    if (data === undefined || data === null) {
      const buf = refItem.response.dataBuffer;
      if (!buf) return null;

      let raw;
      try {
        if (typeof buf === 'string') {
          // dataBuffer may be base64 or raw JSON — try base64 first
          try {
            raw = Buffer.from(buf, 'base64').toString('utf-8');
          } catch (_) {
            raw = buf;
          }
          // If decoding base64 produced garbage, fall back to raw string
          if (raw && raw.charAt(0) !== '[' && raw.charAt(0) !== '{') {
            raw = buf;
          }
        } else if (buf instanceof Uint8Array || Array.isArray(buf)) {
          raw = new TextDecoder().decode(new Uint8Array(buf));
        } else if (typeof Buffer !== 'undefined') {
          raw = Buffer.from(buf).toString('utf-8');
        }
      } catch (_) {
        return null;
      }
      if (!raw) return null;
      try {
        data = JSON.parse(raw);
      } catch (_) {
        return null;
      }
    }

    // If data is a string (e.g. double-encoded JSON), parse again
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (_) {
        return null;
      }
    }

    const items = extractArray(data);
    if (!items || items.length === 0) return null;
    const samples = items.map((r) => ({
      id: r[row.idField || 'id'],
      label: r[row.labelField || 'description']
    }));
    return { count: items.length, samples };
  };

  const handleTestRequest = async (index) => {
    const row = rows[index];
    if (!row.requestPath) {
      setTestResults((prev) => ({ ...prev, [index]: { error: 'No request path specified' } }));
      return;
    }

    const refItem = findItemByPath(collections, collection, row.requestPath, item);
    if (!refItem) {
      setTestResults((prev) => ({ ...prev, [index]: { error: `Request "${row.requestPath}" not found in any loaded collection` } }));
      return;
    }

    // Try using cached response first
    try {
      const parsed = parseResponseData(refItem, row);
      if (parsed) {
        setTestResults((prev) => ({ ...prev, [index]: { success: true, ...parsed } }));
        return;
      }
    } catch (err) {
      // Cached data is invalid, fall through to run the request
    }

    // No cached response — run the referenced request in the current environment
    setTestResults((prev) => ({ ...prev, [index]: { loading: true, message: 'Running request…' } }));

    try {
      const ownerCollection = findCollectionByItemUid(collections, refItem.uid);
      if (!ownerCollection) {
        setTestResults((prev) => ({ ...prev, [index]: { error: 'Could not determine collection for this request' } }));
        return;
      }

      const refItemUid = refItem.uid;
      const ownerCollectionUid = ownerCollection.uid;

      await dispatch(sendRequest(refItem, ownerCollectionUid));

      // After sendRequest resolves, Redux store has the response.
      // Look up the item by UID for reliability, retry to allow re-render.
      const tryParse = (attemptsLeft) => {
        try {
          const freshCollections = collectionsRef.current;
          const freshOwnerCol = freshCollections.find((c) => c.uid === ownerCollectionUid);
          const freshItem = freshOwnerCol
            ? findItemInCollection(freshOwnerCol, refItemUid)
            : null;

          if (!freshItem?.response) {
            if (attemptsLeft > 0) {
              setTimeout(() => tryParse(attemptsLeft - 1), 800);
              return;
            }
            setTestResults((prev) => ({ ...prev, [index]: { error: 'No response captured. Try running the referenced request manually first.' } }));
            return;
          }

          // Check for error responses (failed requests, auth errors, etc.)
          if (freshItem.response.isError || freshItem.response.error) {
            const errMsg = freshItem.response.error || 'Request failed';
            setTestResults((prev) => ({
              ...prev,
              [index]: { error: `Referenced request failed: ${errMsg}. Run it manually to fix auth/connection issues.` }
            }));
            return;
          }

          const parsed = parseResponseData(freshItem, row);
          if (parsed) {
            setTestResults((prev) => ({ ...prev, [index]: { success: true, ...parsed } }));
          } else if (attemptsLeft > 0) {
            setTimeout(() => tryParse(attemptsLeft - 1), 800);
          } else {
            const resp = freshItem.response;
            const dataType = resp.data === null ? 'null' : typeof resp.data;
            const hasBuf = !!resp.dataBuffer;
            setTestResults((prev) => ({
              ...prev,
              [index]: {
                error: `Could not extract data (type: ${dataType}, buffer: ${hasBuf}, status: ${resp.status || 'unknown'}). Check that the response is a JSON array or object.`
              }
            }));
          }
        } catch (err) {
          if (attemptsLeft > 0) {
            setTimeout(() => tryParse(attemptsLeft - 1), 800);
          } else {
            setTestResults((prev) => ({ ...prev, [index]: { error: `Parse error: ${err.message}` } }));
          }
        }
      };
      setTimeout(() => tryParse(4), 600);
    } catch (err) {
      setTestResults((prev) => ({ ...prev, [index]: { error: `Request failed: ${err.message || err}` } }));
    }
  };

  /**
   * Builds a shareable JSON config from the current rows.
   */
  const getShareableJson = useCallback(() => {
    const config = {};
    rows.forEach((row) => {
      const key = row.fieldName.trim();
      if (key) {
        config[key] = {
          requestPath: row.requestPath,
          idField: row.idField || 'id',
          labelField: row.labelField || 'description'
        };
      }
    });
    return JSON.stringify(config, null, 2);
  }, [rows]);

  const handleCopyJson = () => {
    navigator.clipboard.writeText(getShareableJson()).then(() => {
      setJsonCopied(true);
      setTimeout(() => setJsonCopied(false), 2000);
    });
  };

  const handleImportJson = (jsonStr) => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return;
      }
      setRows(masksToRows(parsed));
      setShowJsonConfig(false);
    } catch (_) {
      // ignore invalid JSON
    }
  };

  const fieldNames = rows.map((r) => r.fieldName.trim()).filter(Boolean);
  const duplicates = fieldNames.filter((name, i) => fieldNames.indexOf(name) !== i);
  const hasDuplicates = duplicates.length > 0;

  return (
    <StyledWrapper data-testid="master-data-masks-table">
      <h3 className="text-sm font-semibold mb-2">Master Data Masks</h3>
      <p className="text-xs mb-4 muted">
        Map response fields to Bruno requests whose responses provide human-readable labels.
        Use dot-notation (e.g. stages.planStageNameId) to target nested fields — dot-paths
        take priority over generic field names. Click the play button to preview the mapping.
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
                        placeholder="e.g. categoryId or stages.planStageNameId"
                        onChange={(e) => handleFieldChange(index, 'fieldName', e.target.value)}
                      />
                      {isDuplicate && <div className="error-text">Duplicate field name</div>}
                    </td>
                    <td className="request-path-cell" ref={activeAutocomplete === index ? autocompleteRef : null}>
                      <input
                        className="textbox"
                        type="text"
                        value={row.requestPath}
                        placeholder="e.g. master-data/plan-types"
                        data-testid="master-data-masks-request-path"
                        onChange={(e) => handleRequestPathChange(index, e.target.value)}
                        onFocus={() => {
                          setActiveAutocomplete(index);
                          setHighlightIndex(-1);
                        }}
                        onKeyDown={(e) => handleKeyDown(e, index)}
                      />
                      {activeAutocomplete === index && suggestions.length > 0 && (
                        <div className="autocomplete-dropdown" data-testid="master-data-masks-autocomplete">
                          {suggestions.map((entry, sIdx) => (
                            <div
                              key={entry.absPath}
                              className={`autocomplete-item ${sIdx === highlightIndex ? 'highlighted' : ''}`}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleSelectSuggestion(index, entry);
                              }}
                              onMouseEnter={() => setHighlightIndex(sIdx)}
                            >
                              <span className="autocomplete-path">{entry.relPath}</span>
                              {entry.isExternal && (
                                <span className="autocomplete-collection">{entry.collectionName}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
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
                          onClick={() => handleTestRequest(index)}
                          title="Preview response data"
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
                  {result && (
                    <tr>
                      <td colSpan={5}>
                        <div className="test-result">
                          {result.loading ? (
                            <span className="test-loading">{result.message || 'Running…'}</span>
                          ) : result.error ? (
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
        <button
          className={`btn btn-sm ${showJsonConfig ? 'btn-secondary' : 'btn-close'}`}
          onClick={() => setShowJsonConfig((prev) => !prev)}
          title="Show shareable JSON config"
          data-testid="master-data-masks-json-btn"
        >
          <IconCode size={14} strokeWidth={1.5} className="mr-1 inline" />
          JSON
        </button>
      </div>

      {showJsonConfig && (
        <div className="json-config-panel" data-testid="master-data-masks-json-panel">
          <div className="json-config-header">
            <span className="json-config-title">Shareable JSON Config</span>
            <button
              className="btn-copy-json"
              onClick={handleCopyJson}
              title={jsonCopied ? 'Copied!' : 'Copy to clipboard'}
              data-testid="master-data-masks-copy-json"
            >
              {jsonCopied
                ? <><IconCheck size={14} strokeWidth={1.5} /> Copied</>
                : <><IconCopy size={14} strokeWidth={1.5} /> Copy</>}
            </button>
          </div>
          <textarea
            className="json-config-textarea"
            value={getShareableJson()}
            onChange={(e) => handleImportJson(e.target.value)}
            spellCheck={false}
            data-testid="master-data-masks-json-textarea"
          />
          <p className="json-config-hint">
            Copy this JSON to share with teammates, or paste a config to import it.
          </p>
        </div>
      )}
    </StyledWrapper>
  );
};

export default MasterDataMasks;

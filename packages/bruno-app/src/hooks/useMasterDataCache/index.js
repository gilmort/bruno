import { useState, useRef, useCallback, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { flattenItems, isItemARequest, findCollectionByItemUid } from 'utils/collections';
import { sendRequest } from 'providers/ReduxStore/slices/collections/actions';
import pathUtil from 'utils/common/path';
import { normalizePath } from 'utils/common/path';

/**
 * Finds a request item by absolute path, relative path (with ..),
 * or path relative to collection root.
 *
 * - Absolute paths and .. paths search across ALL loaded collections.
 * - Simple relative paths search within the current collection only.
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

  const getAllItems = () => {
    const items = [];
    for (const col of (collections || [])) {
      if (!col || !col.items) continue;
      flattenItems(col.items || []).forEach((it) => {
        if (isItemARequest(it) && it.pathname) items.push(it);
      });
    }
    return items;
  };

  // 1) Absolute path — search ALL collections
  if (trimmedInput.startsWith('/')) {
    return getAllItems().find((it) =>
      normalizePath(it.pathname).replace(/\.bru$/, '') === trimmedInput
    ) || null;
  }

  // 2) Relative path with .. or ./ — resolve from current item dir, search ALL collections
  if (trimmedInput.startsWith('..') || trimmedInput.startsWith('./')) {
    const baseDir = currentItem?.pathname
      ? pathUtil.dirname(normalizePath(currentItem.pathname))
      : collectionRoot;
    const resolved = normalizePath(pathUtil.resolve(baseDir, trimmedInput));

    return getAllItems().find((it) =>
      normalizePath(it.pathname).replace(/\.bru$/, '') === resolved
    ) || null;
  }

  // 3) Simple relative path — current collection only
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
 * Extracts an array from a parsed JSON response.
 * Handles bare arrays and common wrapper patterns like { data: [...] }.
 */
const extractArray = (data) => {
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch (_) { return null; }
  }
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    for (const key of ['data', 'results', 'items', 'content', 'records', 'rows', 'list', 'entries', 'values']) {
      if (Array.isArray(data[key])) return data[key];
    }
    for (const key of Object.keys(data)) {
      if (Array.isArray(data[key])) return data[key];
    }
  }
  return null;
};

/**
 * Decodes a base64 string to UTF-8.
 * Uses Buffer when available, falls back to atob + TextDecoder.
 */
const decodeBase64 = (str) => {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'base64').toString('utf-8');
  }
  if (typeof atob === 'function') {
    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  }
  return null;
};

/**
 * Parses the response body of a collection item as JSON array.
 *
 * @param {object} item - The collection item with a response.
 * @returns {Array|null} Parsed array or null.
 */
const parseResponseAsArray = (item) => {
  if (!item || !item.response) return null;
  // Skip error responses
  if (item.response.isError || item.response.error) return null;

  try {
    // Prefer already-parsed response data when available
    let data = item.response.data;

    if (data === undefined || data === null || data === '') {
      const buf = item.response.dataBuffer;
      if (!buf) return null;

      let raw = null;
      if (typeof buf === 'string') {
        try {
          raw = decodeBase64(buf);
        } catch (_) {
          raw = null;
        }
        // If decoded base64 doesn't look like JSON, treat buf as raw JSON string
        if (!raw || (raw.charAt(0) !== '[' && raw.charAt(0) !== '{')) {
          raw = buf;
        }
      } else if (buf instanceof Uint8Array || Array.isArray(buf)) {
        raw = new TextDecoder().decode(new Uint8Array(buf));
      } else if (typeof Buffer !== 'undefined') {
        raw = Buffer.from(buf).toString('utf-8');
      }
      if (!raw) return null;

      data = JSON.parse(raw);
    }

    // Handle double-encoded strings
    if (typeof data === 'string') {
      data = JSON.parse(data);
    }

    return extractArray(data);
  } catch (e) {
    console.warn('[MasterDataCache] Failed to parse response for', item.name || item.pathname, e);
    return null;
  }
};

/**
 * Normalizes a JSON path by stripping array indices,
 * so "stages.0.planStageNameId" matches config "stages.planStageNameId".
 */
const normalizeDotPath = (path) => {
  if (!path) return '';
  return path.split('.').filter((seg) => !/^\d+$/.test(seg)).join('.');
};

/**
 * Custom hook that reads master data from referenced Bruno request responses
 * and provides a `getMask` function for looking up human-readable labels.
 *
 * Supports:
 * - Dot-path field names (e.g. "stages.planStageNameId") → match specific nested path (high priority)
 * - Simple field names (e.g. "planTypeId") → match at any depth (low priority)
 * - Cross-collection lookups for absolute and relative (..) paths.
 * - Auto-fetching referenced requests when their response is missing.
 *
 * @param {object} masterDataMasks - Config object keyed by field name with
 *   { requestPath, idField, labelField } per entry.
 * @param {object} collection - The full collection object (with items and responses).
 * @param {object|null} currentItem - The current request item (for resolving relative paths).
 * @returns {{ getMask: Function, isLoading: boolean, error: string|null, refresh: Function }}
 */
const useMasterDataCache = (masterDataMasks, collection, currentItem) => {
  const dispatch = useDispatch();
  const collections = useSelector((state) => state.collections.collections);

  // Stable refs for values used inside buildCache to avoid dependency churn
  const collectionRef = useRef(collection);
  collectionRef.current = collection;
  const collectionUidRef = useRef(collection?.uid);
  collectionUidRef.current = collection?.uid;
  const currentItemRef = useRef(currentItem);
  currentItemRef.current = currentItem;

  // Cache stores two maps: pathMasks (dot-path keys) and genericMasks (simple field name keys)
  const cacheRef = useRef({ pathMasks: new Map(), genericMasks: new Map() });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  // Incremented on every cache rebuild so getMask reference changes → triggers ReactJson re-render
  const [cacheVersion, setCacheVersion] = useState(0);
  // Incremented after auto-fetch completes to force a rebuild
  const [rebuildTrigger, setRebuildTrigger] = useState(0);
  // Track which requests we've already tried to auto-fetch to avoid infinite loops
  const fetchedRef = useRef(new Set());

  // Track the main request's response identity to detect new responses
  const responseId = currentItem?.response?.dataBuffer
    ? String(currentItem.response.status) + ':' + String(currentItem.response.duration)
    : null;

  const buildCache = useCallback(() => {
    if (!masterDataMasks || typeof masterDataMasks !== 'object' || Object.keys(masterDataMasks).length === 0) {
      cacheRef.current = { pathMasks: new Map(), genericMasks: new Map() };
      return;
    }

    setIsLoading(true);
    setError(null);

    // Use the fresh collection from the selector so relative-path lookups
    // find items with the latest response data.
    const freshCollection = collections.find((c) => c.uid === collectionUidRef.current) || collectionRef.current;

    const pathMasks = new Map();
    const genericMasks = new Map();
    const leafConflicts = new Set(); // leaf names shared by multiple dot-path configs
    const errors = [];
    const missingResponses = []; // refs that need auto-fetch

    for (const [fieldName, config] of Object.entries(masterDataMasks)) {
      try {
        const { requestPath, idField = 'id', labelField = 'description' } = config;
        if (!requestPath) continue;

        const refItem = findItemByPath(collections, freshCollection, requestPath, currentItemRef.current);
        if (!refItem) {
          errors.push(`${fieldName}: request "${requestPath}" not found`);
          continue;
        }

        const items = parseResponseAsArray(refItem);
        if (!items) {
          // Track this as needing auto-fetch
          if (!fetchedRef.current.has(refItem.uid)) {
            missingResponses.push(refItem);
          }
          errors.push(`${fieldName}: no response data — run the request first`);
          continue;
        }

        const fieldMap = new Map();
        items.forEach((row) => {
          const id = row[idField];
          const label = row[labelField];
          if (id !== undefined && id !== null && label !== undefined && label !== null) {
            fieldMap.set(String(id), String(label));
          }
        });

        if (fieldMap.size === 0) {
          errors.push(`${fieldName}: 0 mappings found (idField="${idField}", labelField="${labelField}")`);
          continue;
        }

        // Dot-path keys go to pathMasks, simple names go to genericMasks
        if (fieldName.includes('.')) {
          const normalizedPath = normalizeDotPath(fieldName);
          pathMasks.set(normalizedPath, fieldMap);

          // Track leaf field name — only register as generic fallback if unambiguous
          // e.g. "offer.nameId" and "require.nameId" both have leaf "nameId"
          // → don't register generic fallback since it would be ambiguous
          const leafField = fieldName.split('.').pop();
          if (leafField) {
            if (!genericMasks.has(leafField) && !leafConflicts.has(leafField)) {
              genericMasks.set(leafField, fieldMap);
            } else if (genericMasks.has(leafField)) {
              // Multiple dot-paths share the same leaf — remove generic fallback
              genericMasks.delete(leafField);
              leafConflicts.add(leafField);
            }
          }
        } else {
          genericMasks.set(fieldName, fieldMap);
        }
      } catch (err) {
        console.error(`[MasterDataCache] Error for field "${fieldName}":`, err);
        errors.push(`${fieldName}: ${err.message}`);
      }
    }

    cacheRef.current = { pathMasks, genericMasks };
    setCacheVersion((v) => v + 1);
    setIsLoading(false);

    if (errors.length > 0) {
      console.warn('[MasterDataCache] Errors:', errors);
      setError(errors.join('; '));
    }

    // Auto-fetch referenced requests that don't have responses yet
    if (missingResponses.length > 0) {
      const fetchPromises = missingResponses.map((refItem) => {
        fetchedRef.current.add(refItem.uid);
        const ownerCol = findCollectionByItemUid(collections, refItem.uid);
        if (!ownerCol) {
          console.warn('[MasterDataCache] Could not find owner collection for', refItem.name || refItem.pathname);
          fetchedRef.current.delete(refItem.uid);
          return Promise.resolve();
        }
        return dispatch(sendRequest(refItem, ownerCol.uid)).catch((err) => {
          console.warn('[MasterDataCache] Auto-fetch failed for', refItem.name || refItem.pathname, err?.message || err);
          // Remove from fetched set so it can be retried on next rebuild
          fetchedRef.current.delete(refItem.uid);
        });
      });

      // After all fetches settle, trigger an explicit rebuild
      Promise.allSettled(fetchPromises).then(() => {
        setTimeout(() => {
          setRebuildTrigger((v) => v + 1);
        }, 300);
      });
    }
  }, [masterDataMasks, collection?.uid, currentItem?.uid, currentItem?.response, collections, dispatch]);

  // Rebuild cache when config, collections, or main response changes
  useEffect(() => {
    try {
      buildCache();
    } catch (e) {
      console.error('[MasterDataCache] buildCache error:', e);
    }
  }, [buildCache, responseId, rebuildTrigger]);

  // Reset fetched tracking when the mask config changes
  useEffect(() => {
    fetchedRef.current = new Set();
  }, [masterDataMasks]);

  /**
   * Look up a human-readable label for a given field name and UUID value.
   *
   * @param {string} fieldName - The immediate JSON field name (e.g. "planStageNameId").
   * @param {string} uuid - The string value to look up.
   * @param {string} [fullPath] - Optional dot-path from root (e.g. "stages.0.planStageNameId").
   *   Dot-path matches take priority over generic field name matches.
   * @returns {string|null} The label or null if not found.
   */
  const getMask = useCallback((fieldName, uuid, fullPath) => {
    const { pathMasks, genericMasks } = cacheRef.current;
    const uuidStr = String(uuid);

    // 1) Try dot-path match (highest priority)
    if (fullPath && pathMasks.size > 0) {
      const normalized = normalizeDotPath(fullPath);

      // 1a) Exact match
      const exactMap = pathMasks.get(normalized);
      if (exactMap) {
        const label = exactMap.get(uuidStr);
        if (label) return label;
      }

      // 1b) Suffix match: config "offer.nameId" matches path "stages.offer.nameId"
      //     This supports configs that specify a partial path from any depth.
      for (const [configPath, pathMap] of pathMasks) {
        if (normalized.endsWith('.' + configPath) || normalized === configPath) {
          const label = pathMap.get(uuidStr);
          if (label) return label;
        }
      }
    }

    // 2) Try generic field name match (simple names without dots)
    const genericMap = genericMasks.get(fieldName);
    if (genericMap) {
      const label = genericMap.get(uuidStr) || null;
      if (label) return label;
    }

    return null;
  }, [cacheVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => {
    fetchedRef.current = new Set();
    buildCache();
  }, [buildCache]);

  return { getMask, isLoading, error, refresh };
};

export default useMasterDataCache;


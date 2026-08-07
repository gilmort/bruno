/**
 * Collects all string values from a JSON object/array along with their
 * dot-path and the immediate field name.
 *
 * @param {*} obj - The parsed JSON value.
 * @param {string[]} pathParts - Current path segments.
 * @param {Array} results - Accumulator for { fieldName, value, fullPath }.
 */
const collectStringValues = (obj, pathParts, results) => {
  if (obj === null || obj === undefined) return;

  if (Array.isArray(obj)) {
    obj.forEach((item, idx) => {
      collectStringValues(item, [...pathParts, String(idx)], results);
    });
  } else if (typeof obj === 'object') {
    for (const [key, val] of Object.entries(obj)) {
      const newPath = [...pathParts, key];
      if (typeof val === 'string') {
        results.push({ fieldName: key, value: val, fullPath: newPath.join('.') });
      } else {
        collectStringValues(val, newPath, results);
      }
    }
  }
};

/**
 * Applies master data masks to a CodeMirror instance by replacing UUID values
 * in JSON key-value pairs with human-readable labels.
 * Supports nested fields via dot-path matching.
 *
 * @param {object} cm - CodeMirror editor instance.
 * @param {Function} getMask - Function(fieldName, uuid, fullPath?) → label or null.
 * @param {boolean} enabled - Whether masking is enabled.
 */
const applyMasterDataMasks = (cm, getMask, enabled) => {
  try {
    clearMasterDataMasks(cm);

    if (!enabled || !getMask) {
      return;
    }

    // Try to parse the full editor content as JSON
    let parsed;
    try {
      parsed = JSON.parse(cm.getValue());
    } catch (e) {
    // Not valid JSON — fall back to line-by-line regex for top-level fields
      applyMasterDataMasksRegex(cm, getMask);
      return;
    }

    // Collect all string values with their paths
    const entries = [];
    collectStringValues(parsed, [], entries);

    // For each string value, check if it should be masked
    const toMask = [];
    for (const { fieldName, value, fullPath } of entries) {
      const label = getMask(fieldName, value, fullPath);
      if (label) {
        toMask.push({ fieldName, value, label });
      }
    }

    if (toMask.length === 0) return;

    // Now find the text positions in the editor using per-line regex
    const marks = [];
    const keyValueRegex = /"(\w+)"\s*:\s*"([^"]+)"/g;
    const lineCount = cm.lineCount();

    // Build a lookup: key+value → label (use the first match for duplicates)
    const maskLookup = new Map();
    for (const { fieldName, value, label } of toMask) {
      const lookupKey = `${fieldName}\0${value}`;
      if (!maskLookup.has(lookupKey)) {
        maskLookup.set(lookupKey, label);
      }
    }

    for (let i = 0; i < lineCount; i++) {
      const line = cm.getLine(i);
      if (!line) continue;

      let match;
      keyValueRegex.lastIndex = 0;

      while ((match = keyValueRegex.exec(line)) !== null) {
        const key = match[1];
        const value = match[2];
        const lookupKey = `${key}\0${value}`;
        const label = maskLookup.get(lookupKey);

        if (label) {
          const valueStart = match.index + match[0].indexOf(`"${value}"`);
          const valueEnd = valueStart + value.length + 2;

          const from = { line: i, ch: valueStart };
          const to = { line: i, ch: valueEnd };

          const widget = document.createElement('span');
          widget.className = 'cm-master-data-badge';
          widget.textContent = `🏷 ${label}`;
          widget.dataset.originalUuid = value;
          widget.title = value;

          widget.addEventListener('mouseenter', (e) => {
            showBadgeTooltip(e.target, value);
          });
          widget.addEventListener('mouseleave', () => {
            hideBadgeTooltip();
          });

          const mark = cm.markText(from, to, {
            replacedWith: widget,
            handleMouseEvents: true
          });

          marks.push(mark);
        }
      }
    }

    cm._masterDataMarks = marks;
  } catch (e) {
    console.error('[MasterDataMask] applyMasterDataMasks error:', e);
  }
};

/**
 * Fallback: apply masks using line-by-line regex (no path context).
 * Used when editor content isn't valid JSON.
 */
const applyMasterDataMasksRegex = (cm, getMask) => {
  const marks = [];
  const lineCount = cm.lineCount();
  const keyValueRegex = /"(\w+)"\s*:\s*"([^"]+)"/g;

  for (let i = 0; i < lineCount; i++) {
    const line = cm.getLine(i);
    if (!line) continue;

    let match;
    keyValueRegex.lastIndex = 0;

    while ((match = keyValueRegex.exec(line)) !== null) {
      const key = match[1];
      const value = match[2];
      const label = getMask(key, value);

      if (label) {
        const valueStart = match.index + match[0].indexOf(`"${value}"`);
        const valueEnd = valueStart + value.length + 2;

        const from = { line: i, ch: valueStart };
        const to = { line: i, ch: valueEnd };

        const widget = document.createElement('span');
        widget.className = 'cm-master-data-badge';
        widget.textContent = `🏷 ${label}`;
        widget.dataset.originalUuid = value;
        widget.title = value;

        widget.addEventListener('mouseenter', (e) => {
          showBadgeTooltip(e.target, value);
        });
        widget.addEventListener('mouseleave', () => {
          hideBadgeTooltip();
        });

        const mark = cm.markText(from, to, {
          replacedWith: widget,
          handleMouseEvents: true
        });

        marks.push(mark);
      }
    }
  }

  cm._masterDataMarks = marks;
};

/**
 * Clears all master data mask marks from a CodeMirror instance.
 *
 * @param {object} cm - CodeMirror editor instance.
 */
const clearMasterDataMasks = (cm) => {
  if (cm._masterDataMarks && Array.isArray(cm._masterDataMarks)) {
    cm._masterDataMarks.forEach((mark) => {
      try {
        mark.clear();
      } catch (e) {
        // Mark may already be cleared
      }
    });
  }
  cm._masterDataMarks = [];
};

let activeTooltip = null;
let tooltipHideTimeout = null;

/**
 * Shows a tooltip with the original UUID and a copy button.
 * @param {HTMLElement} target - The badge element.
 * @param {string} uuid - The original UUID.
 */
const showBadgeTooltip = (target, uuid) => {
  clearTimeout(tooltipHideTimeout);

  // If tooltip already showing for this target, just keep it
  if (activeTooltip) {
    return;
  }

  const tooltip = document.createElement('div');
  tooltip.className = 'cm-master-data-tooltip';
  tooltip.dataset.testid = 'masked-uuid-tooltip';

  const uuidSpan = document.createElement('span');
  uuidSpan.textContent = uuid;
  uuidSpan.style.userSelect = 'all';

  const copyBtn = document.createElement('button');
  copyBtn.textContent = 'Copy';
  copyBtn.className = 'cm-master-data-tooltip-copy';
  copyBtn.dataset.testid = 'masked-uuid-copy-btn';
  copyBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(uuid).then(() => {
      copyBtn.textContent = 'Copied!';
      setTimeout(() => {
        if (copyBtn.textContent === 'Copied!') {
          copyBtn.textContent = 'Copy';
        }
      }, 1500);
    });
  });

  tooltip.appendChild(uuidSpan);
  tooltip.appendChild(copyBtn);

  const rect = target.getBoundingClientRect();
  tooltip.style.position = 'fixed';
  tooltip.style.left = `${rect.left + rect.width / 2}px`;
  tooltip.style.top = `${rect.top - 4}px`;
  tooltip.style.transform = 'translate(-50%, -100%)';
  tooltip.style.zIndex = '9999';

  tooltip.addEventListener('mouseenter', () => {
    clearTimeout(tooltipHideTimeout);
  });
  tooltip.addEventListener('mouseleave', () => {
    hideBadgeTooltip();
  });

  document.body.appendChild(tooltip);
  activeTooltip = tooltip;
};

/**
 * Hides the active badge tooltip after a short delay.
 */
const hideBadgeTooltip = () => {
  clearTimeout(tooltipHideTimeout);
  tooltipHideTimeout = setTimeout(() => {
    if (activeTooltip && activeTooltip.parentNode) {
      activeTooltip.parentNode.removeChild(activeTooltip);
    }
    activeTooltip = null;
  }, 300);
};

export { applyMasterDataMasks, clearMasterDataMasks };

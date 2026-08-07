import React, { useState, useCallback, useRef } from 'react';
import StyledWrapper from './StyledWrapper';

/**
 * A badge component that displays a human-readable label in place of a UUID.
 * Hovering reveals the original UUID in a tooltip with a copy button.
 *
 * @param {object} props
 * @param {string} props.label - The human-readable label to display.
 * @param {string} props.originalUuid - The original UUID value.
 */
const MaskedValue = ({ label, originalUuid }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [copied, setCopied] = useState(false);
  const hideTimeout = useRef(null);

  const handleMouseEnter = useCallback(() => {
    clearTimeout(hideTimeout.current);
    setShowTooltip(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    hideTimeout.current = setTimeout(() => {
      setShowTooltip(false);
      setCopied(false);
    }, 200);
  }, []);

  const handleCopy = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    navigator.clipboard.writeText(originalUuid).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [originalUuid]);

  return (
    <StyledWrapper>
      <span
        className="masked-badge"
        data-testid="masked-uuid-badge"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <span className="badge-icon">🏷</span>
        {label}
        {showTooltip && (
          <span
            className="masked-tooltip"
            data-testid="masked-uuid-tooltip"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <span className="uuid-text">{originalUuid}</span>
            <button
              className="copy-btn"
              data-testid="masked-uuid-copy-btn"
              onClick={handleCopy}
              type="button"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </span>
        )}
      </span>
    </StyledWrapper>
  );
};

export default MaskedValue;

import { applyMasterDataMasks, clearMasterDataMasks } from 'utils/codemirror/masterDataMask';

// Mock CodeMirror instance
const createMockCm = (lines = []) => {
  const marks = [];
  return {
    getViewport: () => ({ from: 0, to: lines.length }),
    getLine: (i) => lines[i] || '',
    markText: jest.fn((from, to, opts) => {
      const mark = {
        from,
        to,
        opts,
        clear: jest.fn()
      };
      marks.push(mark);
      return mark;
    }),
    _masterDataMarks: [],
    _marks: marks
  };
};

describe('masterDataMask', () => {
  describe('applyMasterDataMasks', () => {
    it('should create marks for matching JSON key-value pairs', () => {
      const lines = [
        '{',
        '  "categoryId": "uuid-abc-123",',
        '  "name": "Test Item"',
        '}'
      ];
      const cm = createMockCm(lines);
      const getMask = jest.fn((field, value) => {
        if (field === 'categoryId' && value === 'uuid-abc-123') {
          return 'Electronics';
        }
        return null;
      });

      applyMasterDataMasks(cm, getMask, true);

      expect(cm.markText).toHaveBeenCalledTimes(1);
      expect(cm.markText).toHaveBeenCalledWith(
        expect.objectContaining({ line: 1 }),
        expect.objectContaining({ line: 1 }),
        expect.objectContaining({ replacedWith: expect.any(HTMLSpanElement) })
      );

      const widget = cm.markText.mock.calls[0][2].replacedWith;
      expect(widget.textContent).toContain('Electronics');
      expect(widget.className).toBe('cm-master-data-badge');
    });

    it('should not create marks for non-matching keys', () => {
      const lines = [
        '{',
        '  "name": "Test Item",',
        '  "description": "Some description"',
        '}'
      ];
      const cm = createMockCm(lines);
      const getMask = jest.fn(() => null);

      applyMasterDataMasks(cm, getMask, true);

      expect(cm.markText).not.toHaveBeenCalled();
    });

    it('should do nothing when enabled is false', () => {
      const lines = ['{ "categoryId": "uuid-abc-123" }'];
      const cm = createMockCm(lines);
      const getMask = jest.fn(() => 'Electronics');

      applyMasterDataMasks(cm, getMask, false);

      expect(cm.markText).not.toHaveBeenCalled();
      expect(getMask).not.toHaveBeenCalled();
    });

    it('should do nothing when getMask is null', () => {
      const lines = ['{ "categoryId": "uuid-abc-123" }'];
      const cm = createMockCm(lines);

      applyMasterDataMasks(cm, null, true);

      expect(cm.markText).not.toHaveBeenCalled();
    });

    it('should only mask string values', () => {
      const lines = [
        '{',
        '  "count": 42,',
        '  "categoryId": "uuid-abc-123"',
        '}'
      ];
      const cm = createMockCm(lines);
      const getMask = jest.fn((field, value) => {
        if (field === 'categoryId') return 'Electronics';
        return null;
      });

      applyMasterDataMasks(cm, getMask, true);

      // count: 42 should not be matched by the regex (no quotes around value)
      // Only categoryId should be matched
      expect(cm.markText).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearMasterDataMasks', () => {
    it('should clear all marks', () => {
      const cm = createMockCm([]);
      const mark1 = { clear: jest.fn() };
      const mark2 = { clear: jest.fn() };
      cm._masterDataMarks = [mark1, mark2];

      clearMasterDataMasks(cm);

      expect(mark1.clear).toHaveBeenCalled();
      expect(mark2.clear).toHaveBeenCalled();
      expect(cm._masterDataMarks).toEqual([]);
    });

    it('should handle empty marks array', () => {
      const cm = createMockCm([]);
      cm._masterDataMarks = [];

      expect(() => clearMasterDataMasks(cm)).not.toThrow();
      expect(cm._masterDataMarks).toEqual([]);
    });

    it('should handle undefined marks array', () => {
      const cm = createMockCm([]);
      cm._masterDataMarks = undefined;

      expect(() => clearMasterDataMasks(cm)).not.toThrow();
      expect(cm._masterDataMarks).toEqual([]);
    });
  });
});


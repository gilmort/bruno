import React from 'react';
import { render, act } from '@testing-library/react';
import CodeEditor from './index';
import { ThemeProvider } from 'styled-components';
import themes from 'themes/index';

jest.mock('codemirror', () => {
  const codemirror = require('test-utils/mocks/codemirror');
  return codemirror;
});

const MOCK_THEME = themes.dark;

const setupEditorState = (editor, { value, cursorPosition }) => {
  editor._currentValue = value;
  editor.getCursor.mockReturnValue({ line: 0, ch: cursorPosition });
  editor.getRange.mockImplementation((from, to) => {
    if (from.line === 0 && from.ch === 0 && to.line === 0 && to.ch === cursorPosition) {
      return value;
    }
    return editor._currentValue.slice(from.ch, to.ch);
  });

  editor.state = {
    completionActive: null
  };
};

const setupEditorWithRef = () => {
  const ref = React.createRef();
  const { rerender } = render(
    <ThemeProvider theme={MOCK_THEME}>
      <CodeEditor ref={ref} />
    </ThemeProvider>
  );
  return { ref, rerender };
};

describe('CodeEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  // Plugins usam o CodeEditor via window.bruno.components e não têm collection/item.
  // getAllVariables retorna {} quando não há collection — este teste guarda esse contrato.
  it('mounts without collection/item (plugin usage)', () => {
    const { ref } = setupEditorWithRef();
    expect(ref.current.editor).toBeTruthy();
  });
});

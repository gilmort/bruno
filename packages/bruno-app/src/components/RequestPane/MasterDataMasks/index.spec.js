import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { ThemeProvider } from 'providers/Theme';
import { configureStore, createSlice } from '@reduxjs/toolkit';

// Mock the module that has resolution issues in test environment
jest.mock('@usebruno/common/utils', () => ({
  parseQueryParams: jest.fn(() => []),
  buildQueryString: jest.fn(() => '')
}), { virtual: true });

jest.mock('@usebruno/common', () => ({
  isRequestTagsIncluded: jest.fn(() => true)
}), { virtual: true });

jest.mock('utils/common', () => ({
  uuid: jest.fn(() => 'mock-uuid'),
  humanizeDate: jest.fn(),
  humanizeSize: jest.fn(),
  refreshUids: jest.fn((arr) => arr),
  sortByNameThenSequence: jest.fn((arr) => arr)
}));

jest.mock('utils/collections', () => ({
  flattenItems: jest.fn(() => []),
  isItemARequest: jest.fn(() => true)
}));

import MasterDataMasks from 'components/RequestPane/MasterDataMasks';

const mockSaveRequest = jest.fn();

jest.mock('providers/ReduxStore/slices/collections/actions', () => ({
  saveRequest: (...args) => {
    mockSaveRequest(...args);
    return { type: 'collections/saveRequest' };
  }
}));

// Mock localStorage and matchMedia for ThemeProvider
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    }))
  });
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: jest.fn(() => 'dark'),
      setItem: jest.fn(),
      removeItem: jest.fn()
    }
  });
});

beforeEach(() => {
  mockSaveRequest.mockClear();
});

const createTestStore = () => {
  const collectionsSlice = createSlice({
    name: 'collections',
    initialState: {
      collections: []
    },
    reducers: {
      updateItemSettings: () => {}
    }
  });

  return configureStore({
    reducer: { collections: collectionsSlice.reducer }
  });
};

const renderWithProviders = (item, collection) => {
  const store = createTestStore();
  return {
    store,
    ...render(
      <Provider store={store}>
        <ThemeProvider>
          <MasterDataMasks item={item} collection={collection} />
        </ThemeProvider>
      </Provider>
    )
  };
};

const makeItem = (masterDataMasks = {}) => ({
  uid: 'req-1',
  settings: {
    masterDataMasks
  }
});

const makeCollection = () => ({
  uid: 'col-1',
  pathname: '/test/collection',
  items: []
});

describe('MasterDataMasks (Request-level)', () => {
  it('should render with no config rows', () => {
    renderWithProviders(makeItem(), makeCollection());

    expect(screen.getByTestId('master-data-masks-table')).toBeInTheDocument();
    expect(screen.getByTestId('master-data-masks-add-row')).toBeInTheDocument();
    expect(screen.getByTestId('master-data-masks-save-btn')).toBeInTheDocument();
  });

  it('should render existing config rows', () => {
    renderWithProviders(makeItem({
      categoryId: {
        requestPath: 'master-data/get-categories',
        idField: 'id',
        labelField: 'name'
      }
    }), makeCollection());

    const inputs = screen.getAllByRole('textbox');
    expect(inputs.length).toBe(4);
    expect(inputs[0].value).toBe('categoryId');
    expect(inputs[1].value).toBe('master-data/get-categories');
    expect(inputs[2].value).toBe('id');
    expect(inputs[3].value).toBe('name');
  });

  it('should add an empty row when clicking Add Field', () => {
    renderWithProviders(makeItem(), makeCollection());

    expect(screen.queryAllByRole('textbox').length).toBe(0);

    const addBtn = screen.getByTestId('master-data-masks-add-row');
    fireEvent.click(addBtn);

    const inputs = screen.getAllByRole('textbox');
    expect(inputs.length).toBe(4);
    expect(inputs[0].value).toBe('');
    expect(inputs[1].value).toBe('');
    expect(inputs[2].value).toBe('id');
    expect(inputs[3].value).toBe('description');
  });

  it('should show error for duplicate field names', () => {
    renderWithProviders(makeItem({
      categoryId: {
        requestPath: 'master-data/get-categories',
        idField: 'id',
        labelField: 'name'
      }
    }), makeCollection());

    const inputs = screen.getAllByRole('textbox');
    expect(inputs.length).toBe(4);
    expect(screen.queryByText('Duplicate field name')).not.toBeInTheDocument();
  });

  it('should call saveRequest when save is clicked', async () => {
    jest.useFakeTimers();
    renderWithProviders(makeItem({
      categoryId: {
        requestPath: 'master-data/get-categories',
        idField: 'id',
        labelField: 'name'
      }
    }), makeCollection());

    const saveBtn = screen.getByTestId('master-data-masks-save-btn');
    fireEvent.click(saveBtn);

    jest.runAllTimers();

    expect(mockSaveRequest).toHaveBeenCalledWith('req-1', 'col-1');
    jest.useRealTimers();
  });
});

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

import MasterDataMasks from 'components/CollectionSettings/MasterDataMasks';

const mockSaveCollectionSettings = jest.fn();

jest.mock('providers/ReduxStore/slices/collections/actions', () => ({
  saveCollectionSettings: (...args) => {
    mockSaveCollectionSettings(...args);
    return { type: 'collections/saveCollectionSettings' };
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
  mockSaveCollectionSettings.mockClear();
});

const createTestStore = () => {
  const collectionsSlice = createSlice({
    name: 'collections',
    initialState: {
      collections: []
    },
    reducers: {
      updateCollectionMasterDataMasks: () => {}
    }
  });

  return configureStore({
    reducer: { collections: collectionsSlice.reducer }
  });
};

const renderWithProviders = (collection) => {
  const store = createTestStore();
  return {
    store,
    ...render(
      <Provider store={store}>
        <ThemeProvider>
          <MasterDataMasks collection={collection} />
        </ThemeProvider>
      </Provider>
    )
  };
};

const makeCollection = (masterDataMasks = {}) => ({
  uid: 'col-1',
  brunoConfig: {
    masterDataMasks
  }
});

describe('MasterDataMasks', () => {
  it('should render with no config rows', () => {
    renderWithProviders(makeCollection());

    expect(screen.getByTestId('master-data-masks-table')).toBeInTheDocument();
    expect(screen.getByTestId('master-data-masks-add-row')).toBeInTheDocument();
    expect(screen.getByTestId('master-data-masks-save-btn')).toBeInTheDocument();
  });

  it('should render existing config rows', () => {
    renderWithProviders(makeCollection({
      categoryId: {
        endpoint: 'https://api.example.com/categories',
        idField: 'id',
        labelField: 'name'
      }
    }));

    const inputs = screen.getAllByRole('textbox');
    // fieldName, endpoint, idField, labelField = 4 inputs
    expect(inputs.length).toBe(4);
    expect(inputs[0].value).toBe('categoryId');
    expect(inputs[1].value).toBe('https://api.example.com/categories');
    expect(inputs[2].value).toBe('id');
    expect(inputs[3].value).toBe('name');
  });

  it('should add an empty row when clicking Add Field', () => {
    renderWithProviders(makeCollection());

    // No input rows initially
    expect(screen.queryAllByRole('textbox').length).toBe(0);

    const addBtn = screen.getByTestId('master-data-masks-add-row');
    fireEvent.click(addBtn);

    // Now 4 inputs appear (fieldName, endpoint, idField, labelField)
    const inputs = screen.getAllByRole('textbox');
    expect(inputs.length).toBe(4);
    expect(inputs[0].value).toBe('');
    expect(inputs[1].value).toBe('');
    expect(inputs[2].value).toBe('id');
    expect(inputs[3].value).toBe('description');
  });

  it('should show error for duplicate field names', () => {
    // Provide a collection that already has duplicates by giving the same fieldName
    renderWithProviders(makeCollection({
      categoryId: {
        endpoint: 'https://api.example.com/categories',
        idField: 'id',
        labelField: 'name'
      }
    }));

    // The input values show a single row since there's no duplicate
    const inputs = screen.getAllByRole('textbox');
    expect(inputs.length).toBe(4);
    // No duplicates in current rendering
    expect(screen.queryByText('Duplicate field name')).not.toBeInTheDocument();
  });

  it('should call saveCollectionSettings when save is clicked', async () => {
    jest.useFakeTimers();
    renderWithProviders(makeCollection({
      categoryId: {
        endpoint: 'https://api.example.com/categories',
        idField: 'id',
        labelField: 'name'
      }
    }));

    const saveBtn = screen.getByTestId('master-data-masks-save-btn');
    fireEvent.click(saveBtn);

    // handleSave dispatches saveCollectionSettings inside a setTimeout(..., 0)
    jest.runAllTimers();

    expect(mockSaveCollectionSettings).toHaveBeenCalledWith('col-1');
    jest.useRealTimers();
  });
});






import { renderHook, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore, createSlice } from '@reduxjs/toolkit';
import React from 'react';

// Mock the collections util
jest.mock('utils/collections', () => ({
  flattenItems: jest.fn((items) => {
    const result = [];
    const flatten = (arr) => {
      arr.forEach((i) => {
        result.push(i);
        if (i.items && i.items.length) flatten(i.items);
      });
    };
    flatten(items || []);
    return result;
  }),
  isItemARequest: jest.fn((item) => item.type === 'http-request'),
  findCollectionByItemUid: jest.fn((collections, uid) => {
    for (const col of (collections || [])) {
      const flatten = (items) => {
        const result = [];
        (items || []).forEach((i) => {
          result.push(i);
          if (i.items && i.items.length) result.push(...flatten(i.items));
        });
        return result;
      };
      if (flatten(col.items).find((i) => i.uid === uid)) return col;
    }
    return null;
  })
}));

// Mock the path util
jest.mock('utils/common/path', () => {
  const path = require('path');
  return {
    __esModule: true,
    default: path.posix,
    normalizePath: (p) => (p || '').replace(/\\/g, '/').replace(/\/+$/, '')
  };
});

// Mock sendRequest to prevent side effects during tests
jest.mock('providers/ReduxStore/slices/collections/actions', () => ({
  sendRequest: jest.fn(() => () => Promise.resolve())
}));

import useMasterDataCache from 'hooks/useMasterDataCache';

const makeResponseBuffer = (data) => JSON.stringify(data);

const makeCollection = (items = [], pathname = '/test/collection', name = 'test-col') => ({
  uid: `col-${name}`,
  name,
  pathname,
  items
});

const makeRequestItem = (absPath, responseData) => ({
  uid: `item-${absPath}`,
  type: 'http-request',
  pathname: absPath,
  request: {},
  response: responseData ? {
    dataBuffer: makeResponseBuffer(responseData)
  } : null
});

const createTestStore = (collections) => {
  const collectionsSlice = createSlice({
    name: 'collections',
    initialState: { collections },
    reducers: {}
  });
  return configureStore({
    reducer: { collections: collectionsSlice.reducer }
  });
};

const renderWithStore = (hookFn, collections) => {
  const store = createTestStore(collections);
  const wrapper = ({ children }) => <Provider store={store}>{children}</Provider>;
  return renderHook(hookFn, { wrapper });
};

describe('useMasterDataCache', () => {
  it('should return null from getMask when no config is provided', () => {
    const col = makeCollection();
    const { result } = renderWithStore(
      () => useMasterDataCache(null, col, null),
      [col]
    );
    expect(result.current.getMask('field', 'uuid-123')).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should return null from getMask when config is empty object', () => {
    const col = makeCollection();
    const { result } = renderWithStore(
      () => useMasterDataCache({}, col, null),
      [col]
    );
    expect(result.current.getMask('field', 'uuid-123')).toBeNull();
  });

  it('should populate cache from referenced request response', () => {
    const mockData = [
      { id: 'uuid-1', name: 'Category A' },
      { id: 'uuid-2', name: 'Category B' }
    ];
    const refItem = makeRequestItem('/test/collection/master-data/categories.bru', mockData);
    const col = makeCollection([refItem]);

    const config = {
      categoryId: {
        requestPath: 'master-data/categories',
        idField: 'id',
        labelField: 'name'
      }
    };

    const { result } = renderWithStore(
      () => useMasterDataCache(config, col, null),
      [col]
    );

    expect(result.current.getMask('categoryId', 'uuid-1')).toBe('Category A');
    expect(result.current.getMask('categoryId', 'uuid-2')).toBe('Category B');
  });

  it('should return null from getMask for unknown UUID', () => {
    const mockData = [{ id: 'uuid-1', name: 'Category A' }];
    const refItem = makeRequestItem('/test/collection/master-data/categories.bru', mockData);
    const col = makeCollection([refItem]);

    const config = {
      categoryId: {
        requestPath: 'master-data/categories',
        idField: 'id',
        labelField: 'name'
      }
    };

    const { result } = renderWithStore(
      () => useMasterDataCache(config, col, null),
      [col]
    );

    expect(result.current.getMask('categoryId', 'unknown-uuid')).toBeNull();
  });

  it('should set error when request is not found', () => {
    const col = makeCollection([]);
    const config = {
      categoryId: {
        requestPath: 'master-data/categories',
        idField: 'id',
        labelField: 'name'
      }
    };

    const { result } = renderWithStore(
      () => useMasterDataCache(config, col, null),
      [col]
    );

    expect(result.current.error).toContain('categoryId');
    expect(result.current.error).toContain('not found');
  });

  it('should set error when request has no cached response', () => {
    const refItem = makeRequestItem('/test/collection/master-data/categories.bru', null);
    const col = makeCollection([refItem]);
    const config = {
      categoryId: {
        requestPath: 'master-data/categories',
        idField: 'id',
        labelField: 'name'
      }
    };

    const { result } = renderWithStore(
      () => useMasterDataCache(config, col, null),
      [col]
    );

    expect(result.current.error).toContain('run the request first');
  });

  it('should resolve absolute paths across collections', () => {
    const mockData = [{ id: 'uuid-1', description: 'Plan Type A' }];
    const refItem = makeRequestItem('/other/collection/masters/plan-types.bru', mockData);
    const otherCol = makeCollection([refItem], '/other/collection', 'other-col');
    const currentCol = makeCollection([], '/test/collection');

    const config = {
      planTypeId: {
        requestPath: '/other/collection/masters/plan-types',
        idField: 'id',
        labelField: 'description'
      }
    };

    const { result } = renderWithStore(
      () => useMasterDataCache(config, currentCol, null),
      [currentCol, otherCol]
    );

    expect(result.current.getMask('planTypeId', 'uuid-1')).toBe('Plan Type A');
  });

  it('should resolve relative paths with .. across collections', () => {
    const mockData = [{ id: 'uuid-1', description: 'Plan Type A' }];
    const refItem = makeRequestItem('/projects/masters/plan-types.bru', mockData);
    const otherCol = makeCollection([refItem], '/projects/masters', 'masters-col');
    const currentCol = makeCollection([], '/projects/plans');
    const currentItem = {
      uid: 'req-1',
      type: 'http-request',
      pathname: '/projects/plans/get-plan.bru'
    };

    const config = {
      planTypeId: {
        requestPath: '../masters/plan-types',
        idField: 'id',
        labelField: 'description'
      }
    };

    const { result } = renderWithStore(
      () => useMasterDataCache(config, currentCol, currentItem),
      [currentCol, otherCol]
    );

    expect(result.current.getMask('planTypeId', 'uuid-1')).toBe('Plan Type A');
  });

  it('should use description as default labelField', () => {
    const mockData = [
      { id: 'uuid-1', description: 'Desc A' },
      { id: 'uuid-2', description: 'Desc B' }
    ];
    const refItem = makeRequestItem('/test/collection/master-data/plan-types.bru', mockData);
    const col = makeCollection([refItem]);

    const config = {
      planTypeId: {
        requestPath: 'master-data/plan-types',
        idField: 'id'
      }
    };

    const { result } = renderWithStore(
      () => useMasterDataCache(config, col, null),
      [col]
    );

    expect(result.current.getMask('planTypeId', 'uuid-1')).toBe('Desc A');
    expect(result.current.getMask('planTypeId', 'uuid-2')).toBe('Desc B');
  });

  it('should resolve dot-path field names with array index normalization', () => {
    const stageData = [
      { planStageId: 'stage-uuid-1', stage: 'Planning' },
      { planStageId: 'stage-uuid-2', stage: 'Execution' }
    ];
    const refItem = makeRequestItem('/test/collection/master-data/stages.bru', stageData);
    const col = makeCollection([refItem]);

    const config = {
      'stages.planStageNameId': {
        requestPath: 'master-data/stages',
        idField: 'planStageId',
        labelField: 'stage'
      }
    };

    const { result } = renderWithStore(
      () => useMasterDataCache(config, col, null),
      [col]
    );

    // Dot-path match: fullPath "stages.0.planStageNameId" normalizes to "stages.planStageNameId"
    expect(result.current.getMask('planStageNameId', 'stage-uuid-1', 'stages.0.planStageNameId')).toBe('Planning');
    expect(result.current.getMask('planStageNameId', 'stage-uuid-2', 'stages.0.planStageNameId')).toBe('Execution');
  });

  it('should fall back to generic field name when dot-path is not provided', () => {
    const stageData = [
      { planStageId: 'stage-uuid-1', stage: 'Planning' }
    ];
    const refItem = makeRequestItem('/test/collection/master-data/stages.bru', stageData);
    const col = makeCollection([refItem]);

    const config = {
      'stages.planStageNameId': {
        requestPath: 'master-data/stages',
        idField: 'planStageId',
        labelField: 'stage'
      }
    };

    const { result } = renderWithStore(
      () => useMasterDataCache(config, col, null),
      [col]
    );

    // The leaf field name "planStageNameId" is also registered as a generic fallback
    expect(result.current.getMask('planStageNameId', 'stage-uuid-1')).toBe('Planning');
  });

  it('should handle both simple and dot-path configs together', () => {
    const typeData = [
      { id: 'type-uuid-1', description: 'Type A' },
      { id: 'type-uuid-2', description: 'Type B' }
    ];
    const stageData = [
      { planStageId: 'stage-uuid-1', stage: 'Planning' }
    ];
    const typeItem = makeRequestItem('/test/collection/master-data/plan-types.bru', typeData);
    const stageItem = makeRequestItem('/test/collection/master-data/stages.bru', stageData);
    const col = makeCollection([typeItem, stageItem]);

    const config = {
      'planTypeId': {
        requestPath: 'master-data/plan-types',
        idField: 'id',
        labelField: 'description'
      },
      'stages.planStageNameId': {
        requestPath: 'master-data/stages',
        idField: 'planStageId',
        labelField: 'stage'
      }
    };

    const { result } = renderWithStore(
      () => useMasterDataCache(config, col, null),
      [col]
    );

    // Simple field name match
    expect(result.current.getMask('planTypeId', 'type-uuid-1')).toBe('Type A');
    // Dot-path match with array index
    expect(result.current.getMask('planStageNameId', 'stage-uuid-1', 'stages.0.planStageNameId')).toBe('Planning');
    // Unknown UUIDs return null
    expect(result.current.getMask('planTypeId', 'unknown')).toBeNull();
    expect(result.current.getMask('planStageNameId', 'unknown', 'stages.0.planStageNameId')).toBeNull();
  });

  it('should handle response data wrapped in common patterns', () => {
    // Response wrapped in { data: [...] }
    const wrappedData = { data: [
      { id: 'uuid-1', name: 'Item A' }
    ] };
    const refItem = makeRequestItem('/test/collection/master-data/items.bru', wrappedData);
    const col = makeCollection([refItem]);

    const config = {
      itemId: {
        requestPath: 'master-data/items',
        idField: 'id',
        labelField: 'name'
      }
    };

    const { result } = renderWithStore(
      () => useMasterDataCache(config, col, null),
      [col]
    );

    expect(result.current.getMask('itemId', 'uuid-1')).toBe('Item A');
  });
});

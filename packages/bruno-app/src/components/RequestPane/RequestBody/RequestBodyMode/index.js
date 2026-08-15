import React, { useMemo, useCallback } from 'react';
import get from 'lodash/get';
import {
  IconCaretDown,
  IconForms,
  IconBraces,
  IconCode,
  IconFileText,
  IconDatabase,
  IconFile,
  IconX,
  IconEye,
  IconEyeOff
} from '@tabler/icons';
import MenuDropdown from 'ui/MenuDropdown';
import { useDispatch, useSelector } from 'react-redux';
import { updateRequestBodyMode } from 'providers/ReduxStore/slices/collections';
import { setLabelsHidden } from 'providers/ReduxStore/slices/plugins';
import { pluginEditorDecorators } from 'utils/plugins/registry';
import { humanizeRequestBodyMode } from 'utils/collections';
import StyledWrapper from './StyledWrapper';
import { updateRequestBody } from 'providers/ReduxStore/slices/collections/index';
import { toastError } from 'utils/common/error';
import { prettifyJsonString } from 'utils/common/index';
import xmlFormat from 'xml-formatter';

const DEFAULT_MODES = [
  {
    name: 'Form',
    options: [
      { id: 'multipartForm', label: 'Multipart Form', leftSection: IconForms },
      { id: 'formUrlEncoded', label: 'Form URL Encoded', leftSection: IconForms }
    ]
  },
  {
    name: 'Raw',
    options: [
      { id: 'json', label: 'JSON', leftSection: IconBraces },
      { id: 'xml', label: 'XML', leftSection: IconCode },
      { id: 'text', label: 'TEXT', leftSection: IconFileText },
      { id: 'sparql', label: 'SPARQL', leftSection: IconDatabase }
    ]
  },
  {
    name: 'Other',
    options: [
      { id: 'file', label: 'File / Binary', leftSection: IconFile },
      { id: 'none', label: 'No Body', leftSection: IconX }
    ]
  }
];

const RequestBodyMode = ({ item, collection }) => {
  const dispatch = useDispatch();
  const labelsHidden = useSelector((state) => state.plugins.labelsHidden);
  const body = item.draft ? get(item, 'draft.request.body') : get(item, 'request.body');
  const bodyMode = body?.mode;
  // Genérico: mostra o toggle de labels quando algum plugin registrou um editor
  // decorator (ex.: mascara valores no body JSON) e o body é JSON. Sem acoplar a
  // nenhuma chave de plugin específica.
  const showLabelsToggle = bodyMode === 'json' && pluginEditorDecorators.count() > 0;

  const onModeChange = useCallback((value) => {
    dispatch(
      updateRequestBodyMode({
        itemUid: item.uid,
        collectionUid: collection.uid,
        mode: value
      })
    );
  }, [dispatch, item.uid, collection.uid]);

  const onPrettify = () => {
    if (body?.json && bodyMode === 'json') {
      try {
        const prettyBodyJson = prettifyJsonString(body.json);
        dispatch(
          updateRequestBody({
            content: prettyBodyJson,
            itemUid: item.uid,
            collectionUid: collection.uid
          })
        );
      } catch (e) {
        toastError(new Error('Unable to prettify. Invalid JSON format.'));
      }
    } else if (body?.xml && bodyMode === 'xml') {
      try {
        const prettyBodyXML = xmlFormat(body.xml, { collapseContent: true });
        dispatch(
          updateRequestBody({
            content: prettyBodyXML,
            itemUid: item.uid,
            collectionUid: collection.uid
          })
        );
      } catch (e) {
        toastError(new Error('Unable to prettify. Invalid XML format.'));
      }
    }
  };

  const menuItems = useMemo(() => {
    return DEFAULT_MODES.map((group) => ({
      ...group,
      options: group.options.map((option) => ({
        ...option,
        onClick: () => onModeChange(option.id)
      }))
    }));
  }, [onModeChange]);

  return (
    <StyledWrapper>
      {showLabelsToggle && (
        <button
          type="button"
          className="flex items-center gap-0.5 h-[16px] rounded border px-1 text-[11px] leading-none cursor-pointer select-none transition-colors"
          style={
            labelsHidden
              ? { borderColor: 'rgba(127,127,127,.28)' }
              : { borderColor: 'rgba(142,68,173,.55)', backgroundColor: 'rgba(142,68,173,.14)', color: '#8e44ad' }
          }
          title={labelsHidden ? 'Show labels' : 'Hide labels'}
          aria-label={labelsHidden ? 'Show labels' : 'Hide labels'}
          onClick={() => dispatch(setLabelsHidden(!labelsHidden))}
        >
          {labelsHidden ? <IconEyeOff size={10} strokeWidth={1.5} /> : <IconEye size={10} strokeWidth={1.5} />}
          <span>labels</span>
        </button>
      )}
      <div className="inline-flex items-center cursor-pointer body-mode-selector" data-testid="request-body-mode-selector">
        <MenuDropdown
          items={menuItems}
          placement="bottom-end"
          selectedItemId={bodyMode}
          showGroupDividers={false}
          groupStyle="select"
        >
          <div className="flex items-center justify-center pl-3 py-1 select-none selected-body-mode">
            {humanizeRequestBodyMode(bodyMode)} <IconCaretDown className="caret ml-1" size={14} strokeWidth={2} />
          </div>
        </MenuDropdown>
      </div>
      {(bodyMode === 'json' || bodyMode === 'xml') && (
        <button className="ml-2" onClick={onPrettify}>
          Prettify
        </button>
      )}
    </StyledWrapper>
  );
};
export default RequestBodyMode;

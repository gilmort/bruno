import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { IconEye, IconEyeOff } from '@tabler/icons';
import { useDispatch, useSelector } from 'react-redux';
import find from 'lodash/find';
import get from 'lodash/get';
import { updateMasterDataMaskEnabled } from 'providers/ReduxStore/slices/tabs';
import StyledWrapper from './StyledWrapper';

const ResponseMaskToggle = forwardRef(({ item }, ref) => {
  const dispatch = useDispatch();
  const tabs = useSelector((state) => state.tabs.tabs);
  const activeTabUid = useSelector((state) => state.tabs.activeTabUid);
  const focusedTab = find(tabs, (t) => t.uid === activeTabUid);
  const elementRef = useRef(null);

  const masterDataMasks = item?.draft
    ? get(item, 'draft.settings.masterDataMasks', null)
    : get(item, 'settings.masterDataMasks', null);
  const hasConfig = masterDataMasks && typeof masterDataMasks === 'object' && Object.keys(masterDataMasks).length > 0;
  const isEnabled = focusedTab?.masterDataMaskEnabled !== false;
  const isDisabled = !hasConfig;

  const handleClick = () => {
    if (!focusedTab || isDisabled) return;
    dispatch(
      updateMasterDataMaskEnabled({
        uid: focusedTab.uid,
        enabled: !isEnabled
      })
    );
  };

  useImperativeHandle(ref, () => ({
    click: () => {
      if (!isDisabled) {
        handleClick();
      }
    },
    isDisabled
  }), [isDisabled, isEnabled, focusedTab]);

  return (
    <StyledWrapper
      ref={elementRef}
      className={`mask-toggle ${isDisabled ? 'disabled' : ''} ${isEnabled ? 'active' : ''}`}
      onClick={handleClick}
      title={isEnabled ? 'Disable master data masks' : 'Enable master data masks'}
      data-testid="response-mask-toggle-btn"
    >
      {isEnabled ? <IconEyeOff size={14} strokeWidth={1.5} /> : <IconEye size={14} strokeWidth={1.5} />}
      <span className="mask-label">masterdata</span>
    </StyledWrapper>
  );
});

ResponseMaskToggle.displayName = 'ResponseMaskToggle';

export default ResponseMaskToggle;

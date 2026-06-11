import React from 'react';
import TimePickerDropdown, { type TimePickerDropdownProps } from './time-picker-dropdown.component';

const withScope = (scope: string) => {
  const ScopedTimePicker: React.FC<TimePickerDropdownProps> = (props) => {
    return <TimePickerDropdown {...props} id={`${scope}-${props.id}`} />;
  };

  ScopedTimePicker.displayName = `${scope}TimePickerDropdown`;
  return ScopedTimePicker;
};

export const SupportiveCareTimePickerDropdown = withScope('supportive-care');
export const BabyTimePickerDropdown = withScope('baby');
export const WomanTimePickerDropdown = withScope('woman');
export const ContractionsTimePickerDropdown = withScope('contractions');
export const LabourProgressTimePickerDropdown = withScope('labour-progress');
export const MedicationTimePickerDropdown = withScope('medication');
export const SharedDecisionTimePickerDropdown = withScope('shared-decision');
export const AdmissionDetailsTimePickerDropdown = withScope('admission-details');

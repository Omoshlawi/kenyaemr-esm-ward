import React from 'react';
import { TextArea, FormGroup } from '@carbon/react';
import {
  buildAssessmentPrefillFromAlerts,
  parseAssessmentValue,
  serializeAssessmentLines,
  type SharedDecisionAlertItem,
} from '../alert-rules';
import styles from '../partography-data-form.scss';

export type SharedDecisionAssessmentFieldProps = {
  id: string;
  labelText: string;
  value: string;
  onChange: (value: string) => void;
  alertItems?: SharedDecisionAlertItem[];
  disabled?: boolean;
  invalid?: boolean;
  invalidText?: string;
  placeholder?: string;
};

const SharedDecisionAssessmentField: React.FC<SharedDecisionAssessmentFieldProps> = ({
  id,
  labelText,
  value,
  onChange,
  alertItems = [],
  disabled = false,
  invalid = false,
  invalidText,
  placeholder,
}) => {
  const structuredLabels = React.useMemo(
    () =>
      buildAssessmentPrefillFromAlerts(alertItems)
        .split('\n')
        .map((line) => {
          const colonIndex = line.indexOf(':');
          return colonIndex === -1 ? line.trim() : line.slice(0, colonIndex).trim();
        })
        .filter(Boolean),
    [alertItems],
  );

  const useStructuredEditor = structuredLabels.length > 0;
  const lines = React.useMemo(() => parseAssessmentValue(value), [value]);

  const handleCommentChange = React.useCallback(
    (index: number, comment: string) => {
      const nextLines = [...lines];
      if (!nextLines[index]) {
        return;
      }

      nextLines[index] = { ...nextLines[index], comment };
      onChange(serializeAssessmentLines(nextLines));
    },
    [lines, onChange],
  );

  if (!useStructuredEditor) {
    return (
      <TextArea
        id={id}
        labelText={labelText}
        placeholder={placeholder}
        rows={6}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        invalid={invalid}
        invalidText={invalidText}
      />
    );
  }

  const displayLines = lines.length > 0 ? lines : structuredLabels.map((label) => ({ label, comment: '' }));

  return (
    <FormGroup legendText={labelText} invalid={invalid}>
      <div
        id={id}
        className={styles.assessmentEditor}
        aria-invalid={invalid}
        aria-disabled={disabled}
        data-testid="shared-decision-assessment-editor">
        {displayLines.map((line, index) => (
          <div key={`${line.label}-${index}`} className={styles.assessmentLine}>
            <span className={styles.assessmentAlertLabel} aria-hidden="true">
              {line.label}:
            </span>
            <input
              type="text"
              className={styles.assessmentUserInput}
              value={line.comment}
              disabled={disabled}
              aria-label={line.label}
              onChange={(event) => handleCommentChange(index, event.target.value)}
            />
          </div>
        ))}
      </div>
      {invalid && invalidText ? <div className={styles.errorText}>{invalidText}</div> : null}
    </FormGroup>
  );
};

export default SharedDecisionAssessmentField;

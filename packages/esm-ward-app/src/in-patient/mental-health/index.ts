import { getAsyncLifecycle } from '@openmrs/esm-framework';
import { moduleName } from '../../constant';

const options = {
  featureName: 'ward',
  moduleName,
};

// t("admissionNotes", "Admission Notes")
export const admissionNotes = getAsyncLifecycle(() => import('./admission-notes.component'), options);
// t("inpatientReview", "Inpatient Review")
export const inpatientReview = getAsyncLifecycle(() => import('./inpatient-review.component'), options);
// t("mentalHealthScreeningTools", "Mental Health Screening Tools")
export const mentalHealthScreeningTools = getAsyncLifecycle(
  () => import('./mental-health-screening-tools.component'),
  options,
);

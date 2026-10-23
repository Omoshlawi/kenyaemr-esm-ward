import { getAsyncLifecycle } from '@openmrs/esm-framework';
import { moduleName } from '../../constant';

const options = {
  featureName: 'ward',
  moduleName,
};

// t("cif", "CIF")
export const caseIdentificationFinding = getAsyncLifecycle(
  () => import('./case-identification-finding.component'),
  options,
);

// t("contactListing", "Contact listing")
export const contactListing = getAsyncLifecycle(() => import('./contact-list/contact-listing.component'), options);
// t("caseFollowup", "Followup")
export const caseFollowUp = getAsyncLifecycle(() => import('./case-followup.component'), options);

export const addContactFormWorkspace = getAsyncLifecycle(() => import('./contact-list/add-contact-form.workspace'), options);

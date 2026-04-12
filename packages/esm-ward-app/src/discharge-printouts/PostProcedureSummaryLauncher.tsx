// PostProcedureSummaryLauncher.tsx
import React, { type FC } from 'react';
import { useEncounterDetails } from '../hooks/useIpdDischargeEncounter';
import { InlineLoading } from '@carbon/react';
import PostProcedureSummary from './post-operation-summary';

type Props = {
  encounterUuid: string;
  patient: { uuid: string; openmrsId: string; name: string };
};

const PostProcedureSummaryLauncher: FC<Props> = ({ encounterUuid, patient }) => {
  const { encounter, isLoading } = useEncounterDetails(encounterUuid);
  if (isLoading) return <InlineLoading />;
  if (!encounter?.visit?.uuid) return null;
  return <PostProcedureSummary visitUuid={encounter.visit.uuid} patient={patient} />;
};

export default PostProcedureSummaryLauncher;

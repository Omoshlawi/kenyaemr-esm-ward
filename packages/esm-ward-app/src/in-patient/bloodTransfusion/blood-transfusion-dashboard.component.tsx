import React, { type FC } from 'react';
import BloodTransfusionChart from './components/blood-transfusion-chart.component';

type BloodTransfusionDashboardProps = {
  patientUuid: string;
};

const BloodTransfusionDashboard: FC<BloodTransfusionDashboardProps> = ({ patientUuid }) => {
  if (!patientUuid) {
    return null;
  }
  return <BloodTransfusionChart patientUuid={patientUuid} />;
};

export default BloodTransfusionDashboard;

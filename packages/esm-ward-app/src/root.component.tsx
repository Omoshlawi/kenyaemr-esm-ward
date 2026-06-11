import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import WardView from './ward-view/ward-view.component';
import HomePageComponent from './home/home-page.component';
import { GlobalCdsAlertProvider } from './in-patient/labourCareGuide/global-cds-alerts/global-cds-alert-context';
import GlobalCdsAlertDisplay from './in-patient/labourCareGuide/global-cds-alerts/global-cds-alert-display.component';

const Root: React.FC = () => {
  // t('wards', 'Wards')
  const wardViewBasename = globalThis.getOpenmrsSpaBase() + 'home/ward';

  return (
    <main>
      <GlobalCdsAlertProvider>
        <BrowserRouter basename={wardViewBasename}>
          <GlobalCdsAlertDisplay />
          <Routes>
            <Route path="/" element={<HomePageComponent />} />
            <Route path="/:locationUuid" element={<WardView />} />
          </Routes>
        </BrowserRouter>
      </GlobalCdsAlertProvider>
    </main>
  );
};

export default Root;

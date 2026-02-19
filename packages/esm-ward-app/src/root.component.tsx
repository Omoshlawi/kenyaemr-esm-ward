import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import WardView from './ward-view/ward-view.component';
import HomePageComponent from './home/home-page.component';

const Root: React.FC = () => {
  // t('wards', 'Wards')
  const wardViewBasename = globalThis.getOpenmrsSpaBase() + 'home/ward';

  return (
    <main>
      <BrowserRouter basename={wardViewBasename}>
        <Routes>
          <Route path="/" element={<HomePageComponent />} />
          <Route path="/:locationUuid" element={<WardView />} />
        </Routes>
      </BrowserRouter>
    </main>
  );
};

export default Root;

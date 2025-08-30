// Original relative path: src/App.jsx

// src/App.jsx

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import LendingRecordDetails from './pages/LendingRecordDetails';
import Inventory from './pages/Inventory';
import NewLending from './pages/NewLending';
import Contractors from './pages/Contractors';
import ContractorDetails from './pages/ContractorDetails';
import CurrentlyHeldStock from './pages/CurrentlyHeldStock'; // NEW
import TotalIssuedHistory from './pages/TotalIssuedHistory.jsx'; // NEW

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/new-lending" element={<NewLending />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/contractors" element={<Contractors />} />
          <Route path="/contractor/:contractorId" element={<ContractorDetails />} />
          <Route path="/lending-record/:recordId" element={<LendingRecordDetails />} />
          <Route path="/reports/currently-held" element={<CurrentlyHeldStock />} /> {/* NEW */}
          <Route path="/reports/total-issued" element={<TotalIssuedHistory />} /> {/* NEW */}
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
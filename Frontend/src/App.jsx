// Original relative path: src/App.jsx

// src/App.jsx

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Contractors from './pages/Contractors';
import ContractorDetails from './pages/ContractorDetails';
import NewOrder from './pages/NewOrder';
import OrderDetails from './pages/OrderDetails';
import ClosedDeals from './pages/ClosedDeals';
import PendingOrders from './pages/PendingOrders';
import CompleteOrder from './pages/CompleteOrder'; // Import the new component

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/contractors" element={<Contractors />} />
          <Route path="/contractor/:contractorId" element={<ContractorDetails />} />
          <Route path="/new-order" element={<NewOrder />} />
          <Route path="/order/:orderId" element={<OrderDetails />} />
          <Route path="/order/:orderId/complete" element={<CompleteOrder />} /> {/* ADDED: Route for completing an order */}
          <Route path="/pending-orders" element={<PendingOrders />} />
          <Route path="/closed-deals" element={<ClosedDeals />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
// Original relative path: src/components/Header.jsx

import React from 'react';
import { Link } from 'react-router-dom';
import { FaWarehouse, FaClipboardList, FaUsers, FaChartPie } from 'react-icons/fa'; // MODIFIED

const Header = () => {
  return (
    <header className="app-header">
      <div className="logo">
        <Link to="/">Carpet Master</Link>
      </div>
      <nav>
        <Link to="/" className="nav-link">
          <FaClipboardList />
          <span>Dashboard</span>
        </Link>
         <Link to="/contractors" className="nav-link">
          <FaUsers />
          <span>Contractors</span>
        </Link>
        <Link to="/inventory" className="nav-link">
          <FaWarehouse />
          <span>Inventory</span>
        </Link>
        {/* --- THIS IS THE FIX --- */}
        <div className="nav-dropdown">
          <div className="nav-link">
            <FaChartPie />
            <span>Reports</span>
          </div>
          <div className="dropdown-content">
            <Link to="/reports/currently-held">Currently Held Stock</Link>
            <Link to="/reports/total-issued">Total Issued History</Link>
          </div>
        </div>
      </nav>
    </header>
  );
};

export default Header;
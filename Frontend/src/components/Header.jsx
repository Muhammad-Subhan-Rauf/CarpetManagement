// Original relative path: src/components/Header.jsx

import React from 'react';
import { Link } from 'react-router-dom';
import { FaWarehouse, FaClipboardList, FaUsers, FaCheckDouble, FaHourglassHalf } from 'react-icons/fa';

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
        {/* --- ADDED "Pending Orders" LINK --- */}
        <Link to="/pending-orders" className="nav-link">
          <FaHourglassHalf />
          <span>Pending Orders</span>
        </Link>
         <Link to="/contractors" className="nav-link">
          <FaUsers />
          <span>Contractors</span>
        </Link>
        <Link to="/inventory" className="nav-link">
          <FaWarehouse />
          <span>Inventory</span>
        </Link>
        <Link to="/closed-deals" className="nav-link">
          <FaCheckDouble />
          <span>Closed Deals</span>
        </Link>
      </nav>
    </header>
  );
};

export default Header;
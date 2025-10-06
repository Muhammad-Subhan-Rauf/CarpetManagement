// Original relative path: src/components/Header.jsx

// Original relative path: src/components/Header.jsx

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FaWarehouse, FaClipboardList, FaUsers, FaCheckDouble, FaHourglassHalf } from 'react-icons/fa';
import { getApiPort, setApiPort } from '../services/api';

const Header = () => {
  const [port, setPort] = useState(getApiPort());

  const handlePortChange = (e) => {
    setPort(e.target.value);
  };

  const handleSetPort = (e) => {
    e.preventDefault();
    setApiPort(port);
    alert(`Backend port has been set to ${port}.`);
  };

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
      <div className="port-config">
        <form onSubmit={handleSetPort} className="port-form">
          <label htmlFor="port-input">BE Port:</label>
          <input
            id="port-input"
            type="number"
            value={port}
            onChange={handlePortChange}
            className="port-input"
            style={{ width: '60px', marginLeft: '5px' }}
          />
          <button type="submit" className="button-small" style={{ marginLeft: '5px' }}>Set</button>
        </form>
      </div>
    </header>
  );
};

export default Header;
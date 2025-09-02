// Original relative path: src/pages/PendingOrders.jsx

// src/pages/PendingOrders.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getOrders } from '../services/api';
import Card from '../components/Card';

const PendingOrders = () => {
    const [pendingOrders, setPendingOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // State for all search/filter inputs
    const [designNumberSearch, setDesignNumberSearch] = useState('');
    const [shadeCardSearch, setShadeCardSearch] = useState('');
    const [qualitySearch, setQualitySearch] = useState('');

    const fetchPendingOrders = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getOrders('open', designNumberSearch, shadeCardSearch, qualitySearch);
            setPendingOrders(data);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [designNumberSearch, shadeCardSearch, qualitySearch]);

    useEffect(() => {
        fetchPendingOrders();
    }, [fetchPendingOrders]);

    const handleSearch = (e) => {
        e.preventDefault();
        fetchPendingOrders();
    };

    return (
        <div>
            <h1>Pending Orders</h1>
            
            <Card>
                <form onSubmit={handleSearch} className="search-form-grid">
                    <div className="form-group">
                        <label>Design Number</label>
                        <input
                            type="text"
                            value={designNumberSearch}
                            onChange={(e) => setDesignNumberSearch(e.target.value)}
                            placeholder="Search by design..."
                        />
                    </div>
                    <div className="form-group">
                        <label>Shade Card</label>
                        <input
                            type="text"
                            value={shadeCardSearch}
                            onChange={(e) => setShadeCardSearch(e.target.value)}
                            placeholder="Search by shade..."
                        />
                    </div>
                     <div className="form-group">
                        <label>Quality</label>
                        <input
                            type="text"
                            value={qualitySearch}
                            onChange={(e) => setQualitySearch(e.target.value)}
                            placeholder="Filter by quality..."
                        />
                    </div>
                    <button type="submit" className="button">Search</button>
                </form>
            </Card>

            <Card>
                {loading && <div>Loading pending orders...</div>}
                {error && <div style={{ color: 'red' }}>Error: {error}</div>}
                {!loading && !error && (
                    pendingOrders.length > 0 ? (
                        <table className="styled-table">
                            <thead>
                                <tr>
                                    <th>Design Number</th>
                                    <th>Shade Card</th>
                                    <th>Size</th>
                                    <th>Quality</th>
                                    <th>Contractor</th>
                                    <th>Date Issued</th>
                                    <th>Date Due</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pendingOrders.map(order => (
                                    <tr key={order.OrderID}>
                                        <td>{order.DesignNumber}</td>
                                        <td>{order.ShadeCard}</td>
                                        <td>{order.Size || '-'}</td>
                                        <td>{order.Quality || '-'}</td>
                                        <td>{order.ContractorName}</td>
                                        <td>{order.DateIssued}</td>
                                        <td>{order.DateDue}</td>
                                        <td>
                                            <Link to={`/order/${order.OrderID}`} className="button-small">
                                                View Details
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <p>No pending orders found for the current search criteria.</p>
                    )
                )}
            </Card>
        </div>
    );
};

export default PendingOrders;
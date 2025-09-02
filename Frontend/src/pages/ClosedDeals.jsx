// Original relative path: src/pages/ClosedDeals.jsx

// src/pages/ClosedDeals.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getOrders } from '../services/api';
import Card from '../components/Card';

const ClosedDeals = () => {
    const [closedOrders, setClosedOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // ADDED: State for all search/filter inputs
    const [designNumberSearch, setDesignNumberSearch] = useState('');
    const [shadeCardSearch, setShadeCardSearch] = useState('');
    const [qualitySearch, setQualitySearch] = useState('');

    // MODIFIED: useCallback now depends on all search terms
    const fetchClosedOrders = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getOrders('closed', designNumberSearch, shadeCardSearch, qualitySearch);
            setClosedOrders(data);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [designNumberSearch, shadeCardSearch, qualitySearch]);

    useEffect(() => {
        fetchClosedOrders();
    }, [fetchClosedOrders]);
    
    const handleSearch = (e) => {
        e.preventDefault();
        fetchClosedOrders();
    };

    return (
        <div>
            <h1>Closed Deals (Completed Carpets)</h1>
            
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
                {loading && <div>Loading closed deals...</div>}
                {error && <div style={{ color: 'red' }}>Error: {error}</div>}
                {!loading && !error && (
                    closedOrders.length > 0 ? (
                        <table className="styled-table">
                            <thead>
                                <tr>
                                    <th>Design Number</th>
                                    <th>Shade Card</th>
                                    <th>Size</th>
                                    <th>Quality</th>
                                    <th>Contractor</th>
                                    <th>Date Completed</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {closedOrders.map(order => (
                                    <tr key={order.OrderID}>
                                        <td>{order.DesignNumber}</td>
                                        <td>{order.ShadeCard}</td>
                                        <td>{order.Size || '-'}</td>
                                        <td>{order.Quality || '-'}</td>
                                        <td>{order.ContractorName}</td>
                                        <td>{order.DateCompleted}</td>
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
                        <p>No completed orders found for the current search criteria.</p>
                    )
                )}
            </Card>
        </div>
    );
};

export default ClosedDeals;
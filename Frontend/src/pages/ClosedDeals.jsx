// Original relative path: src/pages/ClosedDeals.jsx

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getOrders } from '../services/api';
import Card from '../components/Card';

const ClosedDeals = () => {
    const [closedOrders, setClosedOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchClosedOrders = async () => {
            try {
                setLoading(true);
                // Fetch orders with status 'closed'
                const data = await getOrders('closed');
                setClosedOrders(data);
                setError(null);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchClosedOrders();
    }, []);

    if (loading) return <div>Loading closed deals...</div>;
    if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;

    return (
        <div>
            <h1>Closed Deals (Completed Carpets)</h1>
            <Card>
                {closedOrders.length > 0 ? (
                    <table className="styled-table">
                        <thead>
                            <tr>
                                <th>Design Number</th>
                                <th>Contractor</th>
                                <th>Date Completed</th>
                                <th>Payment Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {closedOrders.map(order => (
                                <tr key={order.OrderID}>
                                    <td>{order.DesignNumber}</td>
                                    <td>{order.ContractorName}</td>
                                    <td>{order.DateCompleted}</td>
                                    <td>
                                        {order.AmountPending > 0.01 ? (
                                            <span className="status-badge status-Open">Payment Pending</span>
                                        ) : (
                                            <span className="status-badge status-Closed">Paid</span>
                                        )}
                                    </td>
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
                    <p>No completed orders found.</p>
                )}
            </Card>
        </div>
    );
};

export default ClosedDeals;
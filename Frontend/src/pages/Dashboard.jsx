// Original relative path: src/pages/Dashboard.jsx

// src/pages/Dashboard.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getOrders } from '../services/api';
import Card from '../components/Card';

const Dashboard = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [openOrders, setOpenOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const ordersData = await getOrders('open'); 
                setOpenOrders(ordersData);
                setError(null);
            } catch (err) {
                setError(err.message);
                console.error("Failed to fetch dashboard data:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const filteredOrders = useMemo(() => {
        return openOrders.filter(order =>
            order.ContractorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.DesignNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (order.Notes && order.Notes.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [searchTerm, openOrders]);

    if (loading) return <div>Loading dashboard...</div>;
    if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;

    return (
        <div>
            <div className="page-header-actions">
                <h1>Open Orders</h1>
                <Link to="/new-order" className="button">Create New Carpet Order</Link>
            </div>
            <div className="search-bar">
                <input
                    type="text"
                    placeholder="Search by Contractor, Design Number, or Notes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <div className="record-list">
                {filteredOrders.length > 0 ? filteredOrders.map(order => (
                    <Card key={order.OrderID}>
                        <div className="record-summary">
                            <div>
                                <h3>{order.DesignNumber} ({order.Size || 'No size'})</h3>
                                <p><strong>Contractor:</strong> {order.ContractorName}</p>
                                <p><strong>Quality:</strong> {order.Quality || 'N/A'}</p>
                                <p><strong>Issued on:</strong> {order.DateIssued}</p>
                                <p><strong>Notes:</strong> {order.Notes || 'N/A'}</p>
                            </div>
                            <Link to={`/order/${order.OrderID}`} className="button">
                                View Details
                            </Link>
                        </div>
                    </Card>
                )) : <p>No open orders found.</p>}
            </div>
        </div>
    );
};

export default Dashboard;
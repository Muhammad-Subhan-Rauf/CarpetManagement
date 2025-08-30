// src/pages/Dashboard.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getLentRecords } from '../services/api';
import Card from '../components/Card';

const Dashboard = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [allRecords, setAllRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const recordsData = await getLentRecords();
                setAllRecords(recordsData);
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

    const filteredRecords = useMemo(() => {
        return allRecords.filter(record =>
            record.ContractorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (record.Notes && record.Notes.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [searchTerm, allRecords]);

    if (loading) return <div>Loading dashboard...</div>;
    if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;

    return (
        <div>
            <div className="page-header-actions">
                <h1>Lending Records Dashboard</h1>
                <Link to="/new-lending" className="button">Lend Stock to Contractor</Link>
            </div>
            <div className="search-bar">
                <input
                    type="text"
                    placeholder="Search by Contractor Name or Notes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <div className="record-list">
                {filteredRecords.length > 0 ? filteredRecords.map(record => (
                    <Card key={record.LentRecordID}>
                        <div className="record-summary">
                            <div>
                                <h3>{record.ContractorName}</h3>
                                <p><strong>Lent on:</strong> {record.DateIssued}</p>
                                <p><strong>Notes:</strong> {record.Notes || 'N/A'}</p>
                                <p><strong>Status:</strong> {record.Status}</p>
                            </div>
                            <Link to={`/lending-record/${record.LentRecordID}`} className="button">
                                View Details
                            </Link>
                        </div>
                    </Card>
                )) : <p>No lending records found.</p>}
            </div>
        </div>
    );
};

export default Dashboard;
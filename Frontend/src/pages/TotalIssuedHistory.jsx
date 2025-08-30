// Original relative path: src/pages/TotalIssuedHistory.jsx

// src/pages/TotalIssuedHistory.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { getTotalIssuedHistoryReport } from '../services/api';
import Card from '../components/Card';

const TotalIssuedHistory = () => {
    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const data = await getTotalIssuedHistoryReport();
                setReportData(data);
                setError(null);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const filteredData = useMemo(() => {
        if (!searchTerm) return reportData;
        return reportData.filter(contractor =>
            contractor.ContractorName.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [searchTerm, reportData]);

    if (loading) return <div>Loading report...</div>;
    if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;

    return (
        <div>
            <h1>Report: Total Stock Issued to Contractors (All Time)</h1>
            <p>This report shows the total cumulative weight of each stock type ever issued to a contractor.</p>
            
            <div className="search-bar" style={{ margin: '1rem 0' }}>
                <input
                    type="text"
                    placeholder="Search by Contractor Name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {filteredData.length > 0 ? (
                filteredData.map(contractor => (
                    <Card key={contractor.ContractorID} title={contractor.ContractorName}>
                        <table className="styled-table">
                            <thead>
                                <tr>
                                    <th>Stock Type</th>
                                    <th>Quality</th>
                                    <th>Color/Shade</th>
                                    <th>Total Weight Issued (kg)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {contractor.IssuedHistory.map((stock, index) => (
                                    <tr key={index}>
                                        <td>{stock.Type}</td>
                                        <td>{stock.Quality}</td>
                                        <td>{stock.ColorShadeNumber || '-'}</td>
                                        <td>{stock.TotalIssuedKg.toFixed(3)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Card>
                ))
            ) : (
                <p>No stock has ever been issued, or no contractors match your search.</p>
            )}
        </div>
    );
};

export default TotalIssuedHistory;
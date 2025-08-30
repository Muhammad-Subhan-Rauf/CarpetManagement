// Original relative path: src/pages/CurrentlyHeldStock.jsx

// src/pages/CurrentlyHeldStock.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { getCurrentlyHeldStockReport } from '../services/api';
import Card from '../components/Card';

const CurrentlyHeldStock = () => {
    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const data = await getCurrentlyHeldStockReport();
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
            <h1>Report: Stock Currently Held by Contractors</h1>
            <p>This report shows the net amount of stock each contractor holds from all 'Open' lending records.</p>

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
                                    <th>Net Weight Held (kg)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {contractor.HeldStock.map((stock, index) => (
                                    <tr key={index}>
                                        <td>{stock.Type}</td>
                                        <td>{stock.Quality}</td>
                                        <td>{stock.ColorShadeNumber || '-'}</td>
                                        <td>{stock.NetWeightKg.toFixed(3)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Card>
                ))
            ) : (
                <p>No contractors currently hold any stock, or none match your search.</p>
            )}
        </div>
    );
};

export default CurrentlyHeldStock;
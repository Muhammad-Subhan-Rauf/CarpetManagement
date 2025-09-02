// Original relative path: src/pages/ContractorDetails.jsx

// src/pages/ContractorDetails.jsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getContractorDetails, addGeneralPayment } from '../services/api';
import Card from '../components/Card';
import Modal from '../components/Modal';

const ContractorDetails = () => {
    const { contractorId } = useParams();
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('summary');
    
    // State for filtering
    const [qualityFilter, setQualityFilter] = useState('');
    
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentNotes, setPaymentNotes] = useState('');

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getContractorDetails(contractorId);
            setDetails(data);
            setError(null);
        } catch (err) { setError(err.message); } 
        finally { setLoading(false); }
    }, [contractorId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleMakePayment = async (e) => {
        e.preventDefault();
        const amount = parseFloat(paymentAmount);
        if (isNaN(amount) || amount <= 0) return alert("Invalid amount");
        try {
            await addGeneralPayment({
                contractor_id: contractorId,
                amount: amount,
                notes: paymentNotes
            });
            alert("Payment recorded!");
            setIsPaymentModalOpen(false);
            setPaymentAmount('');
            setPaymentNotes('');
            fetchData(); // Refresh data
        } catch(err) { alert(`Error making payment: ${err.message}`); }
    };

    // Memoized filtering logic
    const filteredData = useMemo(() => {
        if (!details) return null;
        if (!qualityFilter) return details;

        const filteredOrders = details.orders.filter(o => o.Quality && o.Quality.toLowerCase().includes(qualityFilter.toLowerCase()));
        const filteredOrderIds = new Set(filteredOrders.map(o => o.OrderID));
        
        const filteredTransactions = details.transactions.filter(t => filteredOrderIds.has(t.OrderID));
        const filteredPayments = details.payments.filter(p => !p.OrderID || filteredOrderIds.has(p.OrderID)); // Keep general payments

        return {
            ...details,
            orders: filteredOrders,
            transactions: filteredTransactions,
            payments: filteredPayments,
        };
    }, [details, qualityFilter]);
    
    if (loading) return <div>Loading contractor details...</div>;
    if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;
    if (!filteredData) return <h2>Contractor not found.</h2>;

    const { contractor, financial_summary, orders, transactions, payments, currently_held_stock } = filteredData;

    return (
        <div>
            <Link to="/contractors" className="back-link">← All Contractors</Link>
            <h1>Ledger for: {contractor.Name}</h1>
            <p>{contractor.ContactInfo}</p>
            
            <div className="details-grid-3-col">
                <Card title="Overall Financial Summary">
                    <div className="financial-item"><span>Total Value of Stock Issued:</span> <span>Rs {financial_summary.total_value_issued.toFixed(2)}</span></div>
                    <div className="financial-item negative"><span>(-) Total Value of Stock Returned:</span> <span>Rs {financial_summary.total_value_returned.toFixed(2)}</span></div>
                    <hr/>
                    <div className="financial-item total"><span>Net Work Value:</span> <span>Rs {financial_summary.net_work_value.toFixed(2)}</span></div>
                    <hr/>
                    <div className="financial-item"><span>Total Paid to Contractor:</span> <span>Rs {financial_summary.total_paid.toFixed(2)}</span></div>
                    <div className="financial-item pending"><span>Final Balance (Owed by you):</span> <span>Rs {financial_summary.final_balance_owed.toFixed(2)}</span></div>
                    <div style={{marginTop: '1.5rem'}}><button className="button" onClick={() => setIsPaymentModalOpen(true)}>Make a General Payment</button></div>
                </Card>

                <Card title="Currently Held Stock (Open Orders)">
                    {currently_held_stock.length > 0 ? (
                        <table className="styled-table-small">
                            <thead><tr><th>Stock</th><th>Net Weight (kg)</th></tr></thead>
                            <tbody>{currently_held_stock.map((s, i) => (<tr key={i}><td>{s.Type} ({s.Quality})</td><td>{s.NetWeightKg.toFixed(3)}</td></tr>))}</tbody>
                        </table>
                    ) : <p>No stock currently held.</p>}
                </Card>
                
                 <Card title="Order History">
                    {orders.length > 0 ? (
                        <table className="styled-table-small">
                            <thead><tr><th>Design # / Size</th><th>Quality</th><th>Status</th><th>Action</th></tr></thead>
                            <tbody>{orders.map(o => (<tr key={o.OrderID}>
                                <td><strong>{o.DesignNumber}</strong><br/><small>{o.Size} / {o.ShadeCard}</small></td>
                                <td>{o.Quality}</td>
                                <td><span className={`status-badge status-${o.Status}`}>{o.Status}</span></td>
                                <td><Link to={`/order/${o.OrderID}`} className="button-small">View</Link></td>
                            </tr>))}</tbody>
                        </table>
                    ) : <p>No orders found for this filter.</p>}
                </Card>
            </div>
            
            <Card title="Complete Transaction History">
                 <div className="filter-bar">
                    <div className="form-group">
                        <label>Filter by Quality</label>
                        <input type="text" value={qualityFilter} onChange={(e) => setQualityFilter(e.target.value)} placeholder="e.g., 60x60" />
                    </div>
                </div>
                <div className="tabs">
                    <button className={`tab ${activeTab === 'summary' ? 'active' : ''}`} onClick={() => setActiveTab('summary')}>Payment History</button>
                    <button className={`tab ${activeTab === 'issued' ? 'active' : ''}`} onClick={() => setActiveTab('issued')}>Stock Issued</button>
                    <button className={`tab ${activeTab === 'returned' ? 'active' : ''}`} onClick={() => setActiveTab('returned')}>Stock Returned</button>
                </div>
                {activeTab === 'summary' && ( <table className="styled-table"><thead><tr><th>Date</th><th>Amount (Rs)</th><th>Notes</th><th>Order ID</th></tr></thead><tbody>{payments.map(p => <tr key={p.PaymentID}><td>{p.PaymentDate}</td><td>{p.Amount.toFixed(2)}</td><td>{p.Notes || '-'}</td><td>{p.OrderID || 'General'}</td></tr>)}</tbody></table>)}
                {activeTab === 'issued' && (<table className="styled-table"><thead><tr><th>Order ID</th><th>Description</th><th>Weight (kg)</th><th>Value</th></tr></thead><tbody>{transactions.filter(t=>t.TransactionType === 'Issued').map(t => <tr key={t.TransactionID}><td>{t.OrderID}</td><td>{t.Type} ({t.Quality})</td><td>{t.WeightKg.toFixed(3)}</td><td>Rs {(t.WeightKg * t.PricePerKgAtTimeOfTransaction).toFixed(2)}</td></tr>)}</tbody></table>)}
                {activeTab === 'returned' && (<table className="styled-table"><thead><tr><th>Order ID</th><th>Description</th><th>Weight (kg)</th><th>Value</th><th>Notes</th></tr></thead><tbody>{transactions.filter(t=>t.TransactionType === 'Returned').map(t => <tr key={t.TransactionID}><td>{t.OrderID}</td><td>{t.Type} ({t.Quality})</td><td>{t.WeightKg.toFixed(3)}</td><td>Rs {(t.WeightKg * t.PricePerKgAtTimeOfTransaction).toFixed(2)}</td><td>{t.Notes}</td></tr>)}</tbody></table>)}
            </Card>

            <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title={`Pay ${contractor.Name}`}>
                <form onSubmit={handleMakePayment}>
                    <div className="form-group"><label>Amount (Rs)</label><input type="number" step="0.01" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} required autoFocus /></div>
                    <div className="form-group"><label>Notes</label><input type="text" value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} placeholder="e.g., Eid bonus, advance" /></div>
                    <div className="modal-footer"><button type="button" className="button-secondary" onClick={() => setIsPaymentModalOpen(false)}>Cancel</button><button type="submit" className="button">Record Payment</button></div>
                </form>
            </Modal>
        </div>
    );
};

export default ContractorDetails;
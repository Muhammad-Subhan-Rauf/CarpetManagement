// Original relative path: pages/ContractorDetails.jsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getContractorDetails, addGeneralPayment } from '../services/api';
import Card from '../components/Card';
import Modal from '../components/Modal';

// --- ADDED: Helper function to format dates to PKT ---
const formatToPkt = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleString('en-US', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};


const ContractorDetails = () => {
    const { contractorId } = useParams();
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('summary');
    
    // State for filtering
    const [qualityFilter, setQualityFilter] = useState('all');
    
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

    const uniqueQualities = useMemo(() => {
        if (!details?.summary_by_carpet_quality) return [];
        // Extract the 'quality' key from each object in the array
        const qualities = details.summary_by_carpet_quality.map(s => s.quality);
        return [...new Set(qualities)];
    }, [details]);

    // NEW, SIMPLIFIED LOGIC
    const displayedSummary = useMemo(() => {
        if (!details) return {};
        
        // If 'all' is selected, return the pre-calculated overall summary
        if (qualityFilter === 'all') {
            return {
                ...details.overall_summary,
                // Add fields to match the structure for consistent display
                total_wages: details.overall_summary.total_order_wages,
                deductions: details.overall_summary.total_deductions,
                payments: details.overall_summary.total_paid,
                balance_owed: details.overall_summary.final_balance_owed,
                net_stock_value: details.overall_summary.net_stock_value
            };
        }
        
        // Find the specific quality summary from the backend's calculation
        const qualityData = details.summary_by_carpet_quality.find(s => s.quality === qualityFilter);
        
        // Return it, or a zeroed-out object if not found
        return qualityData || { total_wages: 0, net_stock_value: 0, deductions: 0, payments: 0, balance_owed: 0 };

    }, [qualityFilter, details]);


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
    
    if (loading) return <div>Loading contractor details...</div>;
    if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;
    if (!details) return <h2>Contractor not found.</h2>;

    const { contractor, orders, transactions, payments, currently_held_stock } = details;

    return (
        <div>
            <Link to="/contractors" className="back-link">← All Contractors</Link>
            <h1>Ledger for: {contractor.Name}</h1>
            <p>{contractor.ContactInfo}</p>
            
            <div className="details-grid-3-col">
                <Card title="Financial Summary">
                     <div className="form-group" style={{ marginBottom: '1rem' }}>
                        <label>Filter by Carpet Quality</label>
                        <select value={qualityFilter} onChange={e => setQualityFilter(e.target.value)} style={{ width: '100%', padding: '8px', marginTop: '4px' }}>
                            <option value="all">Overall Summary</option>
                            {uniqueQualities.map(q => <option key={q} value={q}>{q}</option>)}
                        </select>
                    </div>

                    <div className="financial-item"><span>Total Wages from Orders:</span> <span>Rs {displayedSummary.total_wages?.toFixed(2) || '0.00'}</span></div>
                    <div className="financial-item negative"><span>(-) Net Value of Stock Used:</span> <span>Rs {displayedSummary.net_stock_value?.toFixed(2) || '0.00'}</span></div>
                    <div className="financial-item negative"><span>(-) Total Deductions:</span> <span>Rs {displayedSummary.deductions?.toFixed(2) || '0.00'}</span></div>
                    <hr/>
                    <div className="financial-item total">
                        <span>Net Payable Amount:</span> 
                        <span>Rs {( (displayedSummary.total_wages || 0) - (displayedSummary.net_stock_value || 0) - (displayedSummary.deductions || 0) ).toFixed(2)}</span>
                    </div>
                    <hr/>
                    <div className="financial-item"><span>Total Paid:</span> <span>Rs {displayedSummary.payments?.toFixed(2) || '0.00'}</span></div>
                    <div className="financial-item pending"><span>Final Balance:</span> <span>Rs {displayedSummary.balance_owed?.toFixed(2) || '0.00'}</span></div>
                    <div style={{marginTop: '1.5rem'}}><button className="button" onClick={() => setIsPaymentModalOpen(true)}>Make a General Payment</button></div>
                </Card>

                <Card title="Currently Held Stock (Open Orders)">
                    {currently_held_stock.length > 0 ? (
                        <table className="styled-table-small">
                            <thead><tr><th>Stock</th><th>Net Weight (kg)</th></tr></thead>
                            <tbody>{currently_held_stock.map((s, i) => (<tr key={i}><td>{s.Type} ({s.Quality}) {s.ColorShadeNumber && `- ${s.ColorShadeNumber}`}</td><td>{s.NetWeightKg.toFixed(3)}</td></tr>))}</tbody>
                        </table>
                    ) : <p>No stock currently held.</p>}
                </Card>
                
                 <Card title="Summary by Carpet Quality">
                    {details.summary_by_carpet_quality.length > 0 ? (
                        <table className="styled-table-small">
                            <thead><tr><th>Quality</th><th>Balance</th></tr></thead>
                            <tbody>{details.summary_by_carpet_quality.map(s => (<tr key={s.quality}>
                                <td>{s.quality}</td>
                                <td>Rs {s.balance_owed.toFixed(2)}</td>
                            </tr>))}</tbody>
                        </table>
                    ) : <p>No orders with quality found.</p>}
                </Card>
            </div>
            
            <Card title="Complete Transaction History">
                 <div className="tabs">
                    <button className={`tab ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => setActiveTab('orders')}>Order History</button>
                    <button className={`tab ${activeTab === 'payments' ? 'active' : ''}`} onClick={() => setActiveTab('payments')}>Payment History</button>
                    <button className={`tab ${activeTab === 'transactions' ? 'active' : ''}`} onClick={() => setActiveTab('transactions')}>Stock Ledger</button>
                </div>
                {activeTab === 'orders' && (<table className="styled-table"><thead><tr><th>Design #</th><th>Quality</th><th>Wage</th><th>Status</th><th>Action</th></tr></thead><tbody>{orders.map(o => (<tr key={o.OrderID}><td>{o.DesignNumber}</td><td>{o.Quality}</td><td>Rs {o.Wage?.toFixed(2) || '0.00'}</td><td><span className={`status-badge status-${o.Status}`}>{o.Status}</span></td><td><Link to={`/order/${o.OrderID}`} className="button-small">View</Link></td></tr>))}</tbody></table>)}
                {activeTab === 'payments' && ( <table className="styled-table"><thead><tr>
                    {/* MODIFIED: Changed header to "Date & Time (PKT)" */}
                    <th>Date & Time (PKT)</th>
                    <th>Amount (Rs)</th><th>Notes</th><th>Order ID</th></tr></thead><tbody>{payments.map(p => <tr key={p.PaymentID}>
                        {/* MODIFIED: Format the date string to PKT */}
                        <td>{formatToPkt(p.PaymentDate)}</td>
                        <td>{p.Amount.toFixed(2)}</td><td>{p.Notes || '-'}</td><td>{p.OrderID || 'General'}</td></tr>)}</tbody></table>)}
                {activeTab === 'transactions' && (
                    <table className="styled-table">
                        {/* MODIFIED: Changed header to "Date & Time (PKT)" */}
                        <thead><tr><th>Date & Time (PKT)</th><th>Order ID</th><th>Type</th><th>Description</th><th>Weight</th><th>Value</th><th>Notes</th></tr></thead>
                        <tbody>{transactions.map(t => (
                            <tr key={t.TransactionID}>
                                {/* MODIFIED: Format the date string to PKT */}
                                <td>{formatToPkt(t.TransactionDate)}</td>
                                <td>{t.OrderID}</td>
                                <td><span className={`status-badge status-${t.TransactionType}`}>{t.TransactionType}</span></td>
                                <td>{t.Type} ({t.StockQuality}) {t.ColorShadeNumber && `- ${t.ColorShadeNumber}`}</td>
                                <td>{t.WeightKg.toFixed(3)}kg</td>
                                <td>Rs {(t.WeightKg * t.PricePerKgAtTimeOfTransaction).toFixed(2)}</td>
                                <td>{t.Notes || '-'}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                )}
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
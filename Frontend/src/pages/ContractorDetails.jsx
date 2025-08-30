
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getContractorDetails, addPayment } from '../services/api';
import Card from '../components/Card';
import Modal from '../components/Modal';

const ContractorDetails = () => {
    const { contractorId } = useParams();
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('summary');
    
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentNotes, setPaymentNotes] = useState('');

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getContractorDetails(contractorId);
            setDetails(data);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [contractorId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleMakePayment = async (e) => {
        e.preventDefault();
        const amount = parseFloat(paymentAmount);
        if (isNaN(amount) || amount <= 0) return alert("Invalid amount");
        try {
            await addPayment({
                contractor_id: contractorId,
                amount: amount,
                notes: paymentNotes
            });
            alert("Payment recorded!");
            setIsPaymentModalOpen(false);
            setPaymentAmount('');
            setPaymentNotes('');
            fetchData(); // Refresh data
        } catch(err) {
            alert(`Error making payment: ${err.message}`);
        }
    };
    
    if (loading) return <div>Loading contractor details...</div>;
    if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;
    if (!details) return <h2>Contractor not found.</h2>;

    const { contractor, financial_summary, lent_records, transactions, payments, currently_held_stock, total_issued_history } = details;

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
                    <div className="financial-item pending"><span>Final Balance Owed to Contractor:</span> <span>Rs {financial_summary.final_balance_owed.toFixed(2)}</span></div>
                    <div style={{marginTop: '1.5rem'}}>
                        <button className="button" onClick={() => setIsPaymentModalOpen(true)}>Make a General Payment</button>
                    </div>
                </Card>

                <Card title="Currently Held Stock (from Open Records)">
                    {currently_held_stock.length > 0 ? (
                        <table className="styled-table-small">
                            <thead><tr><th>Stock</th><th>Net Weight (kg)</th></tr></thead>
                            <tbody>{currently_held_stock.map((s, i) => (
                                <tr key={i}>
                                    <td>{s.Type} ({s.Quality}) {s.ColorShadeNumber && `- ${s.ColorShadeNumber}`}</td>
                                    <td>{s.NetWeightKg.toFixed(3)}</td>
                                </tr>
                            ))}</tbody>
                        </table>
                    ) : <p>No stock currently held.</p>}
                </Card>
                
                <Card title="Total Stock Issued (All Time)">
                    {total_issued_history.length > 0 ? (
                         <table className="styled-table-small">
                            <thead><tr><th>Stock</th><th>Total Issued (kg)</th></tr></thead>
                            <tbody>{total_issued_history.map((s, i) => (
                                <tr key={i}>
                                    <td>{s.Type} ({s.Quality}) {s.ColorShadeNumber && `- ${s.ColorShadeNumber}`}</td>
                                    <td>{s.TotalIssuedKg.toFixed(3)}</td>
                                </tr>
                            ))}</tbody>
                        </table>
                    ) : <p>No stock has ever been issued.</p>}
                </Card>
            </div>

            <Card title="Lending History">
                {lent_records.length > 0 ? (
                    <table className="styled-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Stock Quality</th>
                                <th>Amount Owed</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>{lent_records.map(r => (
                            <tr key={r.LentRecordID}>
                                <td>{r.DateIssued}</td>
                                <td>{r.Qualities}</td>
                                <td>Rs {r.AmountOwed.toFixed(2)}</td>
                                <td><span className={`status-badge status-${r.Status}`}>{r.Status}</span></td>
                                <td><Link to={`/lending-record/${r.LentRecordID}`} className="button-small">View</Link></td>
                            </tr>
                        ))}</tbody>
                    </table>
                ) : <p>No stock has been lent to this contractor yet.</p>}
            </Card>
            
            <Card title="Complete Transaction History">
                <div className="tabs">
                    <button className={`tab ${activeTab === 'summary' ? 'active' : ''}`} onClick={() => setActiveTab('summary')}>Payment History</button>
                    <button className={`tab ${activeTab === 'issued' ? 'active' : ''}`} onClick={() => setActiveTab('issued')}>Stock Issued</button>
                    <button className={`tab ${activeTab === 'returned' ? 'active' : ''}`} onClick={() => setActiveTab('returned')}>Stock Returned</button>
                </div>
                {activeTab === 'summary' && (
                     <table className="styled-table">
                        <thead><tr><th>Date</th><th>Amount (Rs)</th><th>Notes</th><th>Record ID</th></tr></thead>
                        <tbody>{payments.map(p => <tr key={p.PaymentID}><td>{p.PaymentDate}</td><td>{p.Amount.toFixed(2)}</td><td>{p.Notes || '-'}</td><td>{p.LentRecordID || 'General'}</td></tr>)}</tbody>
                    </table>
                )}
                 {activeTab === 'issued' && (
                    <table className="styled-table">
                        <thead><tr><th>Record ID</th><th>Description</th><th>Weight (kg)</th><th>Value</th></tr></thead>
                        <tbody>{transactions.filter(t=>t.TransactionType === 'Issued').map(t => <tr key={t.TransactionID}><td>{t.LentRecordID}</td><td>{t.Type} ({t.Quality})</td><td>{t.WeightKg.toFixed(3)}</td><td>Rs {(t.WeightKg * t.PricePerKgAtTimeOfTransaction).toFixed(2)}</td></tr>)}</tbody>
                    </table>
                )}
                 {activeTab === 'returned' && (
                    <table className="styled-table">
                        <thead><tr><th>Record ID</th><th>Description</th><th>Weight (kg)</th><th>Value</th><th>Notes</th></tr></thead>
                        <tbody>{transactions.filter(t=>t.TransactionType === 'Returned').map(t => <tr key={t.TransactionID}><td>{t.LentRecordID}</td><td>{t.Type} ({t.Quality})</td><td>{t.WeightKg.toFixed(3)}</td><td>Rs {(t.WeightKg * t.PricePerKgAtTimeOfTransaction).toFixed(2)}</td><td>{t.Notes}</td></tr>)}</tbody>
                    </table>
                )}
            </Card>

            <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title={`Pay ${contractor.Name}`}>
                <form onSubmit={handleMakePayment}>
                    <div className="form-group"><label>Amount (Rs)</label><input type="number" step="0.01" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} required autoFocus /></div>
                    <div className="form-group"><label>Notes</label><input type="text" value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} placeholder="e.g., Eid bonus" /></div>
                    <div className="modal-footer">
                        <button type="button" className="button-secondary" onClick={() => setIsPaymentModalOpen(false)}>Cancel</button>
                        <button type="submit" className="button">Record Payment</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default ContractorDetails;
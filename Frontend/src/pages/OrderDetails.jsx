// src/pages/OrderDetails.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getOrderById, getOrderFinancials, getOrderTransactions, getOrderPayments, addPaymentToOrder, returnStockForOrder, getContractors, reassignOrder } from '../services/api';
import Card from '../components/Card';
import Modal from '../components/Modal';

const OrderDetails = () => {
    const { orderId } = useParams();
    const [order, setOrder] = useState(null);
    const [financials, setFinancials] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentNotes, setPaymentNotes] = useState('');

    const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
    const [reassignData, setReassignData] = useState({ new_contractor_id: '', reason: '' });
    const [allContractors, setAllContractors] = useState([]);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [ord, fin, trans, pay] = await Promise.all([
                getOrderById(orderId), getOrderFinancials(orderId),
                getOrderTransactions(orderId), getOrderPayments(orderId)
            ]);
            setOrder(ord); setFinancials(fin);
            setTransactions(trans); setPayments(pay);
            if (ord.Status === 'Open') {
                const contractors = await getContractors();
                setAllContractors(contractors.filter(c => c.ContractorID !== ord.ContractorID));
            }
        } catch (err) { setError(err.message); } 
        finally { setLoading(false); }
    }, [orderId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const { issuedTransactions, returnedTransactions } = useMemo(() => ({
        issuedTransactions: transactions.filter(t => t.TransactionType === 'Issued'),
        returnedTransactions: transactions.filter(t => t.TransactionType === 'Returned'),
    }), [transactions]);
    
    const handleMakePayment = async (e) => {
        e.preventDefault();
        try {
            await addPaymentToOrder({ order_id: orderId, contractor_id: order.ContractorID, amount: parseFloat(paymentAmount), notes: paymentNotes });
            alert("Payment recorded!");
            setIsPaymentModalOpen(false); setPaymentAmount(''); setPaymentNotes('');
            fetchData();
        } catch(err) { alert(`Error making payment: ${err.message}`); }
    };

    const handleReassign = async (e) => {
        e.preventDefault();
        if (!reassignData.new_contractor_id || !reassignData.reason) {
            return alert("Please select a new contractor and provide a reason.");
        }
        try {
            await reassignOrder(orderId, reassignData);
            alert("Order has been reassigned successfully.");
            setIsReassignModalOpen(false);
            fetchData();
        } catch (err) {
            alert(`Error reassigning order: ${err.message}`);
        }
    };

    if (loading) return <div>Loading details...</div>;
    if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;
    if (!order || !financials) return <h2>Order not found.</h2>;

    return (
        <div>
            <div className="page-header-actions">
                <Link to="/" className="back-link">← Back to Dashboard</Link>
                <div>
                    {order.Status === 'Open' && (<button className="button-secondary" onClick={() => setIsReassignModalOpen(true)}>Change Contractor</button>)}
                    {order.Status === 'Open' && (<Link to={`/order/${orderId}/complete`} className="button">Complete Order</Link>)}
                </div>
            </div>
            <h1>Order: {order.DesignNumber}</h1>
            <p>
                <strong>Contractor:</strong> <Link to={`/contractor/${order.ContractorID}`}>{order.ContractorName}</Link> | 
                <strong> Quality:</strong> {order.Quality || 'N/A'} |
                <strong> Status:</strong> <span className={`status-badge status-${order.Status}`}>{order.Status}</span>
            </p>
            
            <div className="details-grid">
                <Card title="Financials">
                    <div className="financial-item"><span>Agreed Wage:</span> <span>Rs {financials.OrderWage.toFixed(2)}</span></div>
                    <div className="financial-item negative"><span>(-) Net Stock Value:</span> <span>Rs {financials.NetStockValue.toFixed(2)}</span></div>
                    <div className="financial-item negative"><span>(-) Deductions:</span> <span>Rs {financials.TotalDeductions.toFixed(2)}</span></div>
                    <div className="financial-item negative"><span>(+) Overdue Fine:</span> <span>Rs {financials.TotalFine.toFixed(2)}</span></div>
                    <hr/><div className="financial-item total"><span>Net Billable Amount:</span> <span>Rs {(financials.OrderWage - financials.NetStockValue - financials.TotalDeductions).toFixed(2)}</span></div><hr/>
                    <div className="financial-item"><span>Total Paid:</span> <span>Rs {financials.AmountPaid.toFixed(2)}</span></div>
                    <div className="financial-item pending"><span>CURRENTLY PENDING:</span> <span>Rs {financials.AmountPending.toFixed(2)}</span></div>
                    {financials.AmountPending > 0.01 && (<div style={{marginTop: '1.5rem'}}><button className="button" style={{width: '100%'}} onClick={() => setIsPaymentModalOpen(true)}>Make a Payment</button></div>)}
                </Card>
                <Card title="Payment History">
                     {payments.length > 0 ? (<table className="styled-table-small"><thead><tr><th>Date</th><th>Amount</th><th>Notes</th></tr></thead><tbody>{payments.map(p=><tr key={p.PaymentID}><td>{p.PaymentDate}</td><td>{p.Amount.toFixed(2)}</td><td>{p.Notes || '-'}</td></tr>)}</tbody></table>) : <p>No payments recorded.</p>}
                </Card>
                <Card title="Stock Issued">
                    <table className="styled-table-small"><thead><tr><th>Desc.</th><th>Weight</th><th>Value</th></tr></thead><tbody>
                        {issuedTransactions.map(t=><tr key={t.TransactionID}><td>{t.Type} ({t.Quality}) {t.ColorShadeNumber && `- ${t.ColorShadeNumber}`}</td><td>{t.WeightKg.toFixed(3)}kg</td><td>Rs {(t.WeightKg * t.PricePerKgAtTimeOfTransaction).toFixed(2)}</td></tr>)}
                    </tbody></table>
                </Card>
                <Card title="Stock Returned">
                     {returnedTransactions.length > 0 ? (<table className="styled-table-small"><thead><tr><th>Desc.</th><th>Weight</th><th>Value</th><th>Notes</th></tr></thead><tbody>
                        {returnedTransactions.map(t=><tr key={t.TransactionID}><td>{t.Type} ({t.Quality}) {t.ColorShadeNumber && `- ${t.ColorShadeNumber}`}</td><td>{t.WeightKg.toFixed(3)}kg</td><td>Rs {(t.WeightKg * t.PricePerKgAtTimeOfTransaction).toFixed(2)}</td><td>{t.Notes}</td></tr>)}
                    </tbody></table>) : <p>No stock returned yet.</p>}
                </Card>
            </div>

            <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title={`Pay against Order #${orderId}`}>
                <form onSubmit={handleMakePayment}><p>Pending Amount: <strong>Rs {financials.AmountPending.toFixed(2)}</strong></p><div className="form-group"><label>Amount (Rs)</label><input type="number" step="0.01" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} required autoFocus /></div><div className="form-group"><label>Notes</label><input type="text" value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} /></div><div className="modal-footer"><button type="button" className="button-secondary" onClick={() => setIsPaymentModalOpen(false)}>Cancel</button><button type="submit" className="button">Record Payment</button></div></form>
            </Modal>
            
            <Modal isOpen={isReassignModalOpen} onClose={() => setIsReassignModalOpen(false)} title="Reassign Contractor">
                <form onSubmit={handleReassign}>
                    <div className="form-group">
                        <label>Current Contractor</label>
                        <input type="text" value={order.ContractorName} disabled />
                    </div>
                    <div className="form-group">
                        <label>New Contractor</label>
                        <select value={reassignData.new_contractor_id} onChange={e => setReassignData(p => ({...p, new_contractor_id: e.target.value}))} required>
                            <option value="" disabled>-- Select --</option>
                            {allContractors.map(c => <option key={c.ContractorID} value={c.ContractorID}>{c.Name}</option>)}
                        </select>
                    </div>
                     <div className="form-group">
                        <label>Reason for Change</label>
                        <textarea value={reassignData.reason} onChange={e => setReassignData(p => ({...p, reason: e.target.value}))} required />
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="button-secondary" onClick={() => setIsReassignModalOpen(false)}>Cancel</button>
                        <button type="submit" className="button">Confirm Reassignment</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default OrderDetails;
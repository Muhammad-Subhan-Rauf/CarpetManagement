// Original relative path: src/pages/OrderDetails.jsx

// src/pages/OrderDetails.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getOrderById, getOrderFinancials, getOrderTransactions, getOrderPayments, addPaymentToOrder, completeOrder } from '../services/api';
import Card from '../components/Card';
import Modal from '../components/Modal';

const CompleteOrderModal = ({ isOpen, onClose, order, transactions, onConfirm }) => {
    const [reconciliation, setReconciliation] = useState({});
    const [finalPayment, setFinalPayment] = useState('');
    const [completionDate, setCompletionDate] = useState(new Date().toISOString().split('T')[0]);

    const outstandingStock = useMemo(() => {
        const summary = {};
        if (transactions) {
            transactions.forEach(t => {
                if (!summary[t.StockID]) {
                    summary[t.StockID] = { ...t, net_issued_weight: 0 };
                }
                summary[t.StockID].net_issued_weight += (t.TransactionType === 'Issued' ? t.WeightKg : -t.WeightKg);
            });
        }
        return Object.values(summary).filter(s => s.net_issued_weight > 0.001);
    }, [transactions]);


    const handleReconChange = (stockId, field, value) => {
        setReconciliation(prev => ({
            ...prev,
            [stockId]: { ...prev[stockId], [field]: value }
        }));
    };
    
    const handleSubmit = () => {
        onConfirm({ 
            dateCompleted: completionDate,
            reconciliation: Object.entries(reconciliation).map(([stockId, weights]) => ({ 
                StockID: parseInt(stockId), 
                weight_returned: parseFloat(weights.weight_returned) || 0,
                weight_kept: parseFloat(weights.weight_kept) || 0
            })),
            final_payment: parseFloat(finalPayment) || 0
        });
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Complete Order: ${order.DesignNumber}`}>
            <div className="form-group">
                <label>Carpet Delivery Date</label>
                <input type="date" value={completionDate} onChange={e => setCompletionDate(e.target.value)} />
            </div>
            <div className="form-group">
                <h4>Reconcile Materials</h4>
                <p>Enter weight returned to inventory and any weight the contractor kept.</p>
                {outstandingStock.map(t => (
                    <div key={t.StockID} className="reconciliation-item">
                        <strong>{t.Type} ({t.Quality})</strong>
                        <small>Outstanding: {t.net_issued_weight.toFixed(3)}kg</small>
                        <div className="form-group-inline">
                            <label>Returned (kg)</label>
                            <input type="number" step="0.001" placeholder="Goes to inventory"
                                   onChange={(e) => handleReconChange(t.StockID, 'weight_returned', e.target.value)} />
                        </div>
                         <div className="form-group-inline">
                            <label>Kept (kg)</label>
                            <input type="number" step="0.001" placeholder="Deducted from pay"
                                   onChange={(e) => handleReconChange(t.StockID, 'weight_kept', e.target.value)} />
                        </div>
                    </div>
                ))}
            </div>
            <hr />
            <div className="form-group">
                <label>Make Final Payment</label>
                <input type="number" step="0.01" value={finalPayment} onChange={e => setFinalPayment(e.target.value)} placeholder="Enter final payment amount"/>
            </div>
            <div className="modal-footer">
                <button type="button" className="button-secondary" onClick={onClose}>Cancel</button>
                <button type="button" className="button" onClick={handleSubmit}>Confirm Completion</button>
            </div>
        </Modal>
    );
};


const OrderDetails = () => {
    const { orderId } = useParams();
    const [order, setOrder] = useState(null);
    const [financials, setFinancials] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentNotes, setPaymentNotes] = useState('');

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [orderData, finData, transData, payData] = await Promise.all([
                getOrderById(orderId),
                getOrderFinancials(orderId),
                getOrderTransactions(orderId),
                getOrderPayments(orderId)
            ]);
            setOrder(orderData);
            setFinancials(finData);
            setTransactions(transData);
            setPayments(payData);
        } catch (err) { setError(err.message); } 
        finally { setLoading(false); }
    }, [orderId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const { issuedTransactions, returnedTransactions } = useMemo(() => ({
        issuedTransactions: transactions.filter(t => t.TransactionType === 'Issued'),
        returnedTransactions: transactions.filter(t => t.TransactionType === 'Returned'),
    }), [transactions]);

    const handleConfirmCompletion = async (payload) => {
        try {
            await completeOrder(orderId, payload);
            alert("Order has been successfully closed!");
            setIsCompleteModalOpen(false);
            fetchData(); // Refresh all data
        } catch (err) {
            alert(`Error closing order: ${err.message}`);
        }
    };
    
    const handleMakePayment = async (e) => {
        e.preventDefault();
        const amount = parseFloat(paymentAmount);
        if (isNaN(amount) || amount <= 0) return alert("Invalid amount.");

        try {
            await addPaymentToOrder(orderId, order.ContractorID, amount, paymentNotes);
            alert("Payment recorded!");
            setIsPaymentModalOpen(false);
            setPaymentAmount('');
            setPaymentNotes('');
            fetchData(); // Refresh data
        } catch(err) {
            alert(`Error making payment: ${err.message}`);
        }
    };

    if (loading) return <div>Loading details...</div>;
    if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;
    if (!order || !financials) return <h2>Order not found.</h2>;

    return (
        <div>
            <div className="page-header-actions">
                <Link to="/" className="back-link">← Back to Dashboard</Link>
                {order.Status === 'Open' && (
                    <button className="button" onClick={() => setIsCompleteModalOpen(true)}>Receive Carpet & Complete Order</button>
                )}
            </div>
            <h1>Order: {order.DesignNumber}</h1>
            <p>
                <strong>Contractor:</strong> <Link to={`/contractor/${order.ContractorID}`}>{order.ContractorName}</Link> | 
                <strong> Status:</strong> <span className={`status-badge status-${order.Status}`}>{order.Status}</span>
            </p>
            
            <div className="details-grid">
                <Card title="Financials">
                    <div className="financial-item"><span>Value of Stock Issued:</span> <span>Rs {financials.IssuedValue.toFixed(2)}</span></div>
                    <div className="financial-item negative"><span>(-) Value of Stock Returned:</span> <span>Rs {financials.ReturnedValue.toFixed(2)}</span></div>
                    <div className="financial-item negative"><span>(+) Overdue Fine:</span> <span>Rs {financials.TotalFine.toFixed(2)}</span></div>
                    <hr/><div className="financial-item total"><span>Net Billable Amount:</span> <span>Rs {(financials.NetValue + financials.TotalFine).toFixed(2)}</span></div><hr/>
                    <div className="financial-item"><span>Total Paid:</span> <span>Rs {financials.AmountPaid.toFixed(2)}</span></div>
                    <div className="financial-item pending"><span>CURRENTLY PENDING:</span> <span>Rs {financials.AmountPending.toFixed(2)}</span></div>
                    
                    {/* --- THIS IS THE FIX --- */}
                    {/* The button now ONLY checks if there is a pending amount, regardless of order status. */}
                    {financials.AmountPending > 0.01 && (
                        <div style={{marginTop: '1.5rem', borderTop: '1px solid #eee', paddingTop: '1.5rem'}}>
                            <button className="button" style={{width: '100%'}} onClick={() => setIsPaymentModalOpen(true)}>Make a Payment</button>
                        </div>
                    )}
                </Card>
                <Card title="Payment History">
                     {payments.length > 0 ? (
                        <table className="styled-table"><thead><tr><th>Date</th><th>Amount</th><th>Notes</th></tr></thead>
                        <tbody>{payments.map(p=><tr key={p.PaymentID}><td>{p.PaymentDate}</td><td>{p.Amount.toFixed(2)}</td><td>{p.Notes || '-'}</td></tr>)}</tbody>
                        </table>
                    ) : <p>No payments recorded for this order.</p>}
                </Card>
                <Card title="Stock Issued">
                    <table className="styled-table"><thead><tr><th>Desc.</th><th>Weight</th><th>Value</th></tr></thead><tbody>
                        {issuedTransactions.map(t=><tr key={t.TransactionID}><td>{t.Type} ({t.Quality})</td><td>{t.WeightKg.toFixed(3)}kg</td><td>Rs {(t.WeightKg * t.PricePerKgAtTimeOfTransaction).toFixed(2)}</td></tr>)}
                    </tbody></table>
                </Card>
                <Card title="Stock Returned">
                     <table className="styled-table"><thead><tr><th>Desc.</th><th>Weight</th><th>Value</th><th>Notes</th></tr></thead><tbody>
                        {returnedTransactions.map(t=><tr key={t.TransactionID}><td>{t.Type} ({t.Quality})</td><td>{t.WeightKg.toFixed(3)}kg</td><td>Rs {(t.WeightKg * t.PricePerKgAtTimeOfTransaction).toFixed(2)}</td><td>{t.Notes}</td></tr>)}
                    </tbody></table>
                </Card>
            </div>
            
            <CompleteOrderModal 
                isOpen={isCompleteModalOpen}
                onClose={() => setIsCompleteModalOpen(false)}
                order={order}
                transactions={transactions}
                onConfirm={handleConfirmCompletion}
            />

            <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title={`Pay against Order #${orderId}`}>
                <form onSubmit={handleMakePayment}>
                    <p>Pending Amount: <strong>Rs {financials.AmountPending.toFixed(2)}</strong></p>
                    <div className="form-group"><label>Amount (Rs)</label><input type="number" step="0.01" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} required autoFocus /></div>
                    <div className="form-group"><label>Notes</label><input type="text" value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} placeholder="e.g., Partial payment" /></div>
                    <div className="modal-footer"><button type="button" className="button-secondary" onClick={() => setIsPaymentModalOpen(false)}>Cancel</button><button type="submit" className="button">Record Payment</button></div>
                </form>
            </Modal>
        </div>
    );
};

export default OrderDetails;
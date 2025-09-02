// Original relative path: src/pages/OrderDetails.jsx

// src/pages/OrderDetails.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getOrderById, getOrderFinancials, getOrderTransactions, getOrderPayments, addPaymentToOrder, returnStockForOrder, getStockItems } from '../services/api';
import Card from '../components/Card';
import Modal from '../components/Modal';

const OrderDetails = () => {
    const { orderId } = useParams();
    const navigate = useNavigate();
    const [order, setOrder] = useState(null);
    const [financials, setFinancials] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentNotes, setPaymentNotes] = useState('');

    // State for post-closure stock return
    const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
    const [stockToReturn, setStockToReturn] = useState({ stockId: '', weight: ''});

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [orderData, finData, transData, payData] = await Promise.all([
                getOrderById(orderId), getOrderFinancials(orderId),
                getOrderTransactions(orderId), getOrderPayments(orderId)
            ]);
            setOrder(orderData); setFinancials(finData);
            setTransactions(transData); setPayments(payData);
        } catch (err) { setError(err.message); } 
        finally { setLoading(false); }
    }, [orderId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const issuedStockItems = useMemo(() => {
        const unique = new Map();
        transactions.filter(t => t.TransactionType === 'Issued').forEach(t => {
            if(!unique.has(t.StockID)) unique.set(t.StockID, t);
        });
        return Array.from(unique.values());
    }, [transactions]);

    const { issuedTransactions, returnedTransactions, returnedStockSummary } = useMemo(() => {
        const returned = transactions.filter(t => t.TransactionType === 'Returned');
        const summary = {};
        returned.forEach(t => {
            const key = `${t.Type}-${t.Quality}`;
            if(!summary[key]) summary[key] = { ...t, totalReturned: 0};
            summary[key].totalReturned += t.WeightKg;
        });
        return {
            issuedTransactions: transactions.filter(t => t.TransactionType === 'Issued'),
            returnedTransactions: returned,
            returnedStockSummary: Object.values(summary)
        }
    }, [transactions]);
    
    const handleMakePayment = async (e) => {
        e.preventDefault();
        const amount = parseFloat(paymentAmount);
        if (isNaN(amount) || amount <= 0) return alert("Invalid amount.");
        try {
            await addPaymentToOrder({ order_id: orderId, contractor_id: order.ContractorID, amount, notes: paymentNotes });
            alert("Payment recorded!");
            setIsPaymentModalOpen(false); setPaymentAmount(''); setPaymentNotes('');
            fetchData();
        } catch(err) { alert(`Error making payment: ${err.message}`); }
    };
    
    const handleReturnStock = async (e) => {
        e.preventDefault();
        const weight = parseFloat(stockToReturn.weight);
        const stockId = parseInt(stockToReturn.stockId);
        if(!stockId || isNaN(weight) || weight <= 0) return alert('Invalid stock or weight');
        try {
            await returnStockForOrder(orderId, stockId, weight);
            alert("Stock returned and accounts adjusted.");
            setIsReturnModalOpen(false); setStockToReturn({ stockId: '', weight: ''});
            fetchData();
        } catch (err) { alert(`Error returning stock: ${err.message}`); }
    }

    if (loading) return <div>Loading details...</div>;
    if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;
    if (!order || !financials) return <h2>Order not found.</h2>;

    return (
        <div>
            <div className="page-header-actions">
                <Link to="/" className="back-link">← Back to Dashboard</Link>
                <div>
                    {order.Status === 'Closed' && (<button className="button-secondary" onClick={() => setIsReturnModalOpen(true)}>Return Stock</button>)}
                    {order.Status === 'Open' && (<Link to={`/order/${orderId}/complete`} className="button">Receive Carpet & Complete Order</Link>)}
                </div>
            </div>
            <h1>Order: {order.DesignNumber}</h1>
            <p>
                <strong>Contractor:</strong> <Link to={`/contractor/${order.ContractorID}`}>{order.ContractorName}</Link> | 
                <strong> Size:</strong> {order.Size || 'N/A'} | 
                <strong> Quality:</strong> {order.Quality || 'N/A'} |
                <strong> Status:</strong> <span className={`status-badge status-${order.Status}`}>{order.Status}</span>
            </p>
            
            <div className="details-grid">
                <Card title="Financials">
                    <div className="financial-item"><span>Initial Wage Base:</span> <span>Rs {financials.InitialWageBase.toFixed(2)}</span></div>
                    <div className="financial-item negative"><span>(-) Value of Returned Stock:</span> <span>Rs {financials.ReturnedValue.toFixed(2)}</span></div>
                    <div className="financial-item negative"><span>(-) Deductions:</span> <span>Rs {financials.TotalDeductions.toFixed(2)}</span></div>
                    <div className="financial-item negative"><span>(+) Overdue Fine:</span> <span>Rs {financials.TotalFine.toFixed(2)}</span></div>
                    <hr/><div className="financial-item total"><span>Net Billable Amount:</span> <span>Rs {financials.NetValue.toFixed(2)}</span></div><hr/>
                    <div className="financial-item"><span>Total Paid:</span> <span>Rs {financials.AmountPaid.toFixed(2)}</span></div>
                    <div className="financial-item pending"><span>CURRENTLY PENDING:</span> <span>Rs {financials.AmountPending.toFixed(2)}</span></div>
                    {financials.AmountPending > 0.01 && (<div style={{marginTop: '1.5rem'}}><button className="button" style={{width: '100%'}} onClick={() => setIsPaymentModalOpen(true)}>Make a Payment</button></div>)}
                </Card>
                <Card title="Payment History">
                     {payments.length > 0 ? (<table className="styled-table-small"><thead><tr><th>Date</th><th>Amount</th><th>Notes</th></tr></thead><tbody>{payments.map(p=><tr key={p.PaymentID}><td>{p.PaymentDate}</td><td>{p.Amount.toFixed(2)}</td><td>{p.Notes || '-'}</td></tr>)}</tbody></table>) : <p>No payments recorded for this order.</p>}
                </Card>
                <Card title="Stock Issued Summary">
                    <table className="styled-table-small"><thead><tr><th>Desc.</th><th>Weight Issued</th><th>Value</th></tr></thead><tbody>
                        {issuedTransactions.map(t=><tr key={t.TransactionID}><td>{t.Type} ({t.Quality})</td><td>{t.WeightKg.toFixed(3)}kg</td><td>Rs {(t.WeightKg * t.PricePerKgAtTimeOfTransaction).toFixed(2)}</td></tr>)}
                    </tbody></table>
                </Card>
                <Card title="Stock Returned Summary">
                     {returnedTransactions.length > 0 ? (<table className="styled-table-small"><thead><tr><th>Desc.</th><th>Total Weight Returned</th><th>Value</th></tr></thead><tbody>
                        {returnedStockSummary.map((t, i)=><tr key={i}><td>{t.Type} ({t.Quality})</td><td>{t.totalReturned.toFixed(3)}kg</td><td>Rs {(t.totalReturned * t.PricePerKgAtTimeOfTransaction).toFixed(2)}</td></tr>)}
                    </tbody></table>) : <p>No stock has been returned yet.</p>}
                </Card>
            </div>

            <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title={`Pay against Order #${orderId}`}>
                <form onSubmit={handleMakePayment}><p>Pending Amount: <strong>Rs {financials.AmountPending.toFixed(2)}</strong></p><div className="form-group"><label>Amount (Rs)</label><input type="number" step="0.01" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} required autoFocus /></div><div className="form-group"><label>Notes</label><input type="text" value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} placeholder="e.g., Partial payment" /></div><div className="modal-footer"><button type="button" className="button-secondary" onClick={() => setIsPaymentModalOpen(false)}>Cancel</button><button type="submit" className="button">Record Payment</button></div></form>
            </Modal>

            <Modal isOpen={isReturnModalOpen} onClose={() => setIsReturnModalOpen(false)} title="Return Stock (Post-Closure)">
                <form onSubmit={handleReturnStock}><p>Returning stock will credit the contractor's account for its value.</p>
                    <div className="form-group"><label>Select Stock to Return</label>
                        <select value={stockToReturn.stockId} onChange={e => setStockToReturn(p => ({...p, stockId: e.target.value}))} required>
                            <option value="" disabled>-- Select originally issued stock --</option>
                            {issuedStockItems.map(s => <option key={s.StockID} value={s.StockID}>{s.Type} ({s.Quality})</option>)}
                        </select>
                    </div>
                    <div className="form-group"><label>Weight to Return (kg)</label><input type="number" step="0.001" value={stockToReturn.weight} onChange={e => setStockToReturn(p => ({...p, weight: e.target.value}))} required /></div>
                    <div className="modal-footer"><button type="button" className="button-secondary" onClick={() => setIsReturnModalOpen(false)}>Cancel</button><button type="submit" className="button">Confirm Return</button></div>
                </form>
            </Modal>
        </div>
    );
};

export default OrderDetails;
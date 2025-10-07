// Original relative path: pages/OrderDetails.jsx

// src/pages/OrderDetails.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
    getOrderById, getOrderFinancials, getOrderTransactions, getOrderPayments, 
    addPaymentToOrder, getContractors, reassignOrder,
    getStockItems, issueStockToOrder
} from '../services/api';
import Card from '../components/Card';
import Modal from '../components/Modal';

// --- MODIFIED: Helper component for relative timestamps now formats tooltip to PKT ---
const RelativeTimestamp = ({ date, referenceDate }) => {
  const getRelativeDays = (dateStr, referenceDateStr) => {
    if (!dateStr || !referenceDateStr) return null;
    const date = new Date(dateStr);
    // FIXED: Corrected the constructor from new 'Date' to new Date
    const reference = new Date(referenceDateStr);
    
    // Reset time to compare dates only
    date.setHours(0, 0, 0, 0);
    reference.setHours(0, 0, 0, 0);

    const diffTime = date - reference;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const fullTimestamp = new Date(date).toLocaleString('en-US', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const relativeDays = getRelativeDays(date, referenceDate);
  let displayText = fullTimestamp;

  if (relativeDays !== null) {
    if (relativeDays === 0) {
      displayText = 'On issuance day';
    } else if (relativeDays > 0) {
      displayText = `${relativeDays} day${relativeDays > 1 ? 's' : ''} later`;
    } else {
      displayText = `${Math.abs(relativeDays)} day${Math.abs(relativeDays) > 1 ? 's' : ''} prior`;
    }
  }

  return (
    <span title={`PKT: ${fullTimestamp}`}>
      {displayText}
    </span>
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

    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentNotes, setPaymentNotes] = useState('');

    const [isIssueStockModalOpen, setIsIssueStockModalOpen] = useState(false);
    const [availableStock, setAvailableStock] = useState([]);
    const [stockToAdd, setStockToAdd] = useState({ stock_id: '', weight: '' });

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

    const openIssueStockModal = async () => {
        if (order?.Quality) {
            try {
                const stock = await getStockItems(order.Quality);
                setAvailableStock(stock);
                setIsIssueStockModalOpen(true);
            } catch (err) {
                alert(`Error fetching stock: ${err.message}`);
            }
        } else {
            alert("Cannot issue stock: Order quality is not defined.");
        }
    };

    const handleIssueStock = async (e) => {
        e.preventDefault();
        if (!stockToAdd.stock_id || !stockToAdd.weight || parseFloat(stockToAdd.weight) <= 0) {
            return alert("Please select a stock item and enter a valid, positive weight.");
        }
        try {
            await issueStockToOrder(orderId, stockToAdd);
            alert("Stock issued successfully!");
            setIsIssueStockModalOpen(false);
            setStockToAdd({ stock_id: '', weight: '' });
            fetchData(); 
        } catch (err) {
            alert(`Error issuing stock: ${err.message}`);
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
                    {order.Status === 'Open' && (<button className="button-secondary" style={{marginLeft: '10px'}} onClick={openIssueStockModal}>Issue More Stock</button>)}
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
                    
                    {/* MODIFIED: Allow payment on any open order to enable advance payments */}
                    {order.Status === 'Open' && (<div style={{marginTop: '1.5rem'}}><button className="button" style={{width: '100%'}} onClick={() => setIsPaymentModalOpen(true)}>Make a Payment</button></div>)}
                </Card>
                <Card title="Payment History">
                     {payments.length > 0 ? (<table className="styled-table-small">
                        {/* MODIFIED: Header changed to "Date" */}
                        <thead><tr><th>Date</th><th>Amount</th><th>Notes</th></tr></thead>
                        <tbody>{payments.map(p=><tr key={p.PaymentID}>
                            {/* MODIFIED: Use RelativeTimestamp component */}
                            <td><RelativeTimestamp date={p.PaymentDate} referenceDate={order.DateIssued} /></td>
                            <td>{p.Amount.toFixed(2)}</td><td>{p.Notes || '-'}</td></tr>)}</tbody>
                        </table>) : <p>No payments recorded.</p>}
                </Card>
                <Card title="Stock Issued">
                    <table className="styled-table-small">
                        {/* MODIFIED: Header changed to "Date" */}
                        <thead><tr><th>Date</th><th>Desc.</th><th>Weight</th><th>Value</th></tr></thead>
                        <tbody>
                            {issuedTransactions.map(t=><tr key={t.TransactionID}>
                                {/* MODIFIED: Use RelativeTimestamp component */}
                                <td><RelativeTimestamp date={t.TransactionDate} referenceDate={order.DateIssued} /></td>
                                <td>{t.Type} ({t.Quality}) {t.ColorShadeNumber && `- ${t.ColorShadeNumber}`}</td>
                                <td>{t.WeightKg.toFixed(3)}kg</td>
                                <td>Rs {(t.WeightKg * t.PricePerKgAtTimeOfTransaction).toFixed(2)}</td>
                            </tr>)}
                        </tbody>
                    </table>
                </Card>
                <Card title="Stock Returned">
                     {returnedTransactions.length > 0 ? (<table className="styled-table-small">
                        {/* MODIFIED: Header changed to "Date" */}
                        <thead><tr><th>Date</th><th>Desc.</th><th>Weight</th><th>Value</th><th>Notes</th></tr></thead>
                        <tbody>
                        {returnedTransactions.map(t=><tr key={t.TransactionID}>
                            {/* MODIFIED: Use RelativeTimestamp component */}
                            <td><RelativeTimestamp date={t.TransactionDate} referenceDate={order.DateIssued} /></td>
                            <td>{t.Type} ({t.Quality}) {t.ColorShadeNumber && `- ${t.ColorShadeNumber}`}</td>
                            <td>{t.WeightKg.toFixed(3)}kg</td><td>Rs {(t.WeightKg * t.PricePerKgAtTimeOfTransaction).toFixed(2)}</td><td>{t.Notes}</td></tr>)}
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

            <Modal isOpen={isIssueStockModalOpen} onClose={() => setIsIssueStockModalOpen(false)} title="Issue More Stock to Order">
                <form onSubmit={handleIssueStock}>
                    <div className="form-group">
                        <label>Stock Item</label>
                        <select 
                            value={stockToAdd.stock_id} 
                            onChange={e => setStockToAdd(p => ({...p, stock_id: e.target.value}))}
                            required
                        >
                            <option value="" disabled>-- Select Available Stock --</option>
                            {availableStock.map(s => (
                                <option key={s.StockID} value={s.StockID} disabled={s.QuantityInStockKg <= 0}>
                                    {s.Type} ({s.Quality}) {s.ColorShadeNumber && `- ${s.ColorShadeNumber}`} - {s.QuantityInStockKg.toFixed(3)}kg available
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Weight to Issue (kg)</label>
                        <input type="number" step="0.001" value={stockToAdd.weight} onChange={e => setStockToAdd(p => ({...p, weight: e.target.value}))} required />
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="button-secondary" onClick={() => setIsIssueStockModalOpen(false)}>Cancel</button>
                        <button type="submit" className="button">Issue Stock</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default OrderDetails;
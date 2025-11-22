import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
    getOrderById, getOrderFinancials, getOrderTransactions, getOrderPayments, 
    addPaymentToOrder, getContractors, reassignOrder,
    getStockItems, issueStockToOrder,
    updatePayment, deletePayment,
    updateStockTransaction, deleteStockTransaction
} from '../services/api';
import Card from '../components/Card';
import Modal from '../components/Modal';
import { FaEdit, FaTrash } from 'react-icons/fa';

// ... (RelativeTimestamp component remains unchanged) ...
const RelativeTimestamp = ({ date, referenceDate }) => {
  // ... existing code ...
  const getRelativeDays = (dateStr, referenceDateStr) => {
    if (!dateStr || !referenceDateStr) return null;
    const date = new Date(dateStr.replace(' ', 'T') + 'Z');
    const reference = new Date(referenceDateStr.replace(' ', 'T') + 'Z');
    date.setHours(0, 0, 0, 0);
    reference.setHours(0, 0, 0, 0);
    const diffTime = date - reference;
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  };
  const fullTimestamp = new Date(date).toLocaleString('en-US', {
    timeZone: 'Asia/Karachi',
    year: 'numeric', month: 'short', day: '2-digit', hour: 'numeric', minute: '2-digit', hour12: true,
  });
  const relativeDays = getRelativeDays(date, referenceDate);
  let displayText = fullTimestamp;
  if (relativeDays !== null) {
    if (relativeDays === 0) displayText = 'On issuance day';
    else if (relativeDays > 0) displayText = `${relativeDays} day${relativeDays > 1 ? 's' : ''} later`;
    else displayText = `${Math.abs(relativeDays)} day${Math.abs(relativeDays) > 1 ? 's' : ''} prior`;
  }
  return <span title={`PKT: ${fullTimestamp}`}>{displayText}</span>;
};

const OrderDetails = () => {
    const { orderId } = useParams();
    const [order, setOrder] = useState(null);
    const [financials, setFinancials] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showRelativeDates, setShowRelativeDates] = useState(true);

    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentNotes, setPaymentNotes] = useState('');
    
    const [isEditPaymentModalOpen, setIsEditPaymentModalOpen] = useState(false);
    const [editingPayment, setEditingPayment] = useState(null);
    const [isEditStockModalOpen, setIsEditStockModalOpen] = useState(false);
    const [editingStock, setEditingStock] = useState(null);

    const [isIssueStockModalOpen, setIsIssueStockModalOpen] = useState(false);
    const [availableStock, setAvailableStock] = useState([]);
    
    // ADDED: Search state for the modal
    const [stockSearch, setStockSearch] = useState({ type: '', quality: '', color: '' });

    const [stockToAdd, setStockToAdd] = useState({ 
        stock_id: '', 
        weight: '', 
        transaction_date: new Date().toISOString().split('T')[0] 
    });

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

    // ... (Helper functions: formatAbsoluteDate, formatDimension remain unchanged) ...
    const formatAbsoluteDate = (date) => new Date(date.replace(' ', 'T') + 'Z').toLocaleString('en-US', { timeZone: 'Asia/Karachi', year: 'numeric', month: 'short', day: '2-digit', hour: 'numeric', minute: '2-digit', hour12: true });
    const formatDimension = (decimalVal) => {
        if (!decimalVal) return "0'0\"";
        const val = parseFloat(decimalVal);
        if (isNaN(val)) return "0'0\"";
        let feet = Math.floor(val);
        let inches = Math.round((val - feet) * 12);
        if (inches === 12) { feet += 1; inches = 0; }
        return `${feet}'${inches}"`;
    };

    const { issuedTransactions, returnedTransactions } = useMemo(() => ({
        issuedTransactions: transactions.filter(t => t.TransactionType === 'Issued'),
        returnedTransactions: transactions.filter(t => t.TransactionType === 'Returned'),
    }), [transactions]);
    
    // ... (Payment and Edit/Delete Handlers remain unchanged) ...
    const handleMakePayment = async (e) => { e.preventDefault(); try { await addPaymentToOrder({ order_id: orderId, contractor_id: order.ContractorID, amount: parseFloat(paymentAmount), notes: paymentNotes }); alert("Payment recorded!"); setIsPaymentModalOpen(false); setPaymentAmount(''); setPaymentNotes(''); fetchData(); } catch(err) { alert(`Error making payment: ${err.message}`); } };
    const openEditPaymentModal = (p) => { setEditingPayment({ ...p, PaymentDate: p.PaymentDate.split(' ')[0] }); setIsEditPaymentModalOpen(true); };
    const handleUpdatePayment = async (e) => { e.preventDefault(); try { await updatePayment(editingPayment.PaymentID, { amount: editingPayment.Amount, payment_date: editingPayment.PaymentDate, notes: editingPayment.Notes }); alert("Payment updated!"); setIsEditPaymentModalOpen(false); fetchData(); } catch (err) { alert(`Error updating payment: ${err.message}`); } };
    const handleDeletePayment = async (id) => { if (window.confirm("Delete payment?")) { try { await deletePayment(id); alert("Deleted."); fetchData(); } catch (err) { alert(`Error: ${err.message}`); } } };
    const openEditStockModal = (t) => { setEditingStock({ ...t, TransactionDate: t.TransactionDate.split(' ')[0] }); setIsEditStockModalOpen(true); };
    const handleUpdateStock = async (e) => { e.preventDefault(); try { await updateStockTransaction(editingStock.TransactionID, { weight: editingStock.WeightKg, date: editingStock.TransactionDate }); alert("Updated!"); setIsEditStockModalOpen(false); fetchData(); } catch (err) { alert(`Error: ${err.message}`); } };
    const handleDeleteStock = async (id) => { if (window.confirm("Delete transaction?")) { try { await deleteStockTransaction(id); alert("Deleted."); fetchData(); } catch (err) { alert(`Error: ${err.message}`); } } };
    const handleReassign = async (e) => { e.preventDefault(); try { await reassignOrder(orderId, reassignData); alert("Reassigned."); setIsReassignModalOpen(false); fetchData(); } catch (err) { alert(`Error: ${err.message}`); } };

    // --- MODIFIED: Stock Issuance Logic ---

    // Function to fetch stock based on search terms
    const searchStock = async (e) => {
        if(e) e.preventDefault();
        try {
            const params = {};
            if (stockSearch.type) params.search_type = stockSearch.type;
            if (stockSearch.quality) params.search_quality = stockSearch.quality;
            if (stockSearch.color) params.search_color = stockSearch.color;
            
            const stock = await getStockItems(params);
            setAvailableStock(stock);
        } catch (err) {
            console.error(err);
        }
    };

    const openIssueStockModal = async () => {
        // Initial fetch with no filters (or could pre-fill quality if desired, but user wants search)
        // Let's pre-fill the search with the Order Quality to be helpful, but allow changing it.
        setStockSearch({ type: '', quality: order.Quality || '', color: '' });
        
        try {
            // Fetch based on the initial pre-fill
            const stock = await getStockItems({ search_quality: order.Quality || '' });
            setAvailableStock(stock);
            setIsIssueStockModalOpen(true);
        } catch (err) {
            alert(`Error fetching stock: ${err.message}`);
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
            setStockToAdd({ stock_id: '', weight: '', transaction_date: new Date().toISOString().split('T')[0] });
            fetchData(); 
        } catch (err) {
            alert(`Error issuing stock: ${err.message}`);
        }
    };

    if (loading) return <div>Loading details...</div>;
    if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;
    if (!order || !financials) return <h2>Order not found.</h2>;

    const length = order.Length ? parseFloat(order.Length) : 0;
    const width = order.Width ? parseFloat(order.Width) : 0;
    const area = (length * width);
    const rate = order.PricePerSqFt ? parseFloat(order.PricePerSqFt) : 0;
    const exactBaseWage = area * rate;

    return (
        <div>
             {/* ... (Header and Details Grid remain identical) ... */}
            <div className="page-header-actions">
                <Link to="/" className="back-link">← Back to Dashboard</Link>
                <div>
                    {order.Status === 'Open' && (<button className="button-secondary" onClick={() => setIsReassignModalOpen(true)}>Change Contractor</button>)}
                    {order.Status === 'Open' && (<button className="button-secondary" style={{marginLeft: '10px'}} onClick={openIssueStockModal}>Issue More Stock</button>)}
                    <button className="button-secondary" style={{marginLeft: '10px'}} onClick={() => setShowRelativeDates(prev => !prev)}>
                        Toggle Dates
                    </button>
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
                    {(length > 0 && width > 0 && rate > 0) && (
                        <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #eee' }}>
                            <div className="financial-item">
                                <span style={{color: '#666'}}>Dimensions:</span> 
                                <span>{formatDimension(length)} x {formatDimension(width)} = <strong>{area.toFixed(2)} sq.ft</strong></span>
                            </div>
                            <div className="financial-item"><span style={{color: '#666'}}>Rate:</span> <span>Rs {rate.toFixed(2)} / sq.ft</span></div>
                            <div className="financial-item"><span><strong>Exact Wage (Calculated):</strong></span> <span><strong>Rs {exactBaseWage.toFixed(2)}</strong></span></div>
                        </div>
                    )}
                    <div className="financial-item"><span>Agreed Wage (Final):</span> <span>Rs {financials.OrderWage.toFixed(2)}</span></div>
                    <div className="financial-item negative"><span>(-) Net Stock Value:</span> <span>Rs {financials.NetStockValue.toFixed(2)}</span></div>
                    <div className="financial-item negative"><span>(-) Deductions:</span> <span>Rs {financials.TotalDeductions.toFixed(2)}</span></div>
                    <div className="financial-item negative"><span>(+) Overdue Fine:</span> <span>Rs {financials.TotalFine.toFixed(2)}</span></div>
                    <hr/><div className="financial-item total"><span>Net Billable Amount:</span> <span>Rs {(financials.OrderWage - financials.NetStockValue - financials.TotalDeductions).toFixed(2)}</span></div><hr/>
                    <div className="financial-item"><span>Total Paid:</span> <span>Rs {financials.AmountPaid.toFixed(2)}</span></div>
                    <div className="financial-item pending"><span>CURRENTLY PENDING:</span> <span>Rs {financials.AmountPending.toFixed(2)}</span></div>
                    {order.Status === 'Open' && (<div style={{marginTop: '1.5rem'}}><button className="button" style={{width: '100%'}} onClick={() => setIsPaymentModalOpen(true)}>Make a Payment</button></div>)}
                </Card>
                <Card title="Payment History">
                     {payments.length > 0 ? (<table className="styled-table-small">
                        <thead><tr><th>Date</th><th>Amount</th><th>Notes</th><th>Actions</th></tr></thead>
                        <tbody>{payments.map(p=><tr key={p.PaymentID}>
                            <td>{showRelativeDates ? <RelativeTimestamp date={p.PaymentDate} referenceDate={order.DateIssued} /> : formatAbsoluteDate(p.PaymentDate)}</td>
                            <td>{p.Amount.toFixed(2)}</td><td>{p.Notes || '-'}</td>
                            <td><button className="button-icon" onClick={() => openEditPaymentModal(p)}><FaEdit/></button><button className="button-icon-danger" onClick={() => handleDeletePayment(p.PaymentID)}><FaTrash/></button></td>
                            </tr>)}</tbody>
                        </table>) : <p>No payments recorded.</p>}
                </Card>
                <Card title="Stock Issued">
                    <table className="styled-table-small">
                        <thead><tr><th>Date</th><th>Desc.</th><th>Weight</th><th>Value</th><th>Actions</th></tr></thead>
                        <tbody>{issuedTransactions.map(t=><tr key={t.TransactionID}>
                                <td>{showRelativeDates ? <RelativeTimestamp date={t.TransactionDate} referenceDate={order.DateIssued} /> : formatAbsoluteDate(t.TransactionDate)}</td>
                                <td>{t.Type} ({t.Quality}) {t.ColorShadeNumber && `- ${t.ColorShadeNumber}`}</td>
                                <td>{t.WeightKg.toFixed(3)}kg</td><td>Rs {(t.WeightKg * t.PricePerKgAtTimeOfTransaction).toFixed(2)}</td>
                                <td>{order.Status === 'Open' && <><button className="button-icon" onClick={() => openEditStockModal(t)}><FaEdit/></button><button className="button-icon-danger" onClick={() => handleDeleteStock(t.TransactionID)}><FaTrash/></button></>}</td>
                            </tr>)}</tbody>
                    </table>
                </Card>
                <Card title="Stock Returned">
                     {returnedTransactions.length > 0 ? (<table className="styled-table-small">
                        <thead><tr><th>Date</th><th>Desc.</th><th>Weight</th><th>Value</th><th>Notes</th><th>Actions</th></tr></thead>
                        <tbody>{returnedTransactions.map(t=><tr key={t.TransactionID}>
                            <td>{showRelativeDates ? <RelativeTimestamp date={t.TransactionDate} referenceDate={order.DateIssued} /> : formatAbsoluteDate(t.TransactionDate)}</td>
                            <td>{t.Type} ({t.Quality}) {t.ColorShadeNumber && `- ${t.ColorShadeNumber}`}</td>
                            <td>{t.WeightKg.toFixed(3)}kg</td><td>Rs {(t.WeightKg * t.PricePerKgAtTimeOfTransaction).toFixed(2)}</td><td>{t.Notes}</td>
                            <td>{order.Status === 'Open' && <><button className="button-icon" onClick={() => openEditStockModal(t)}><FaEdit/></button><button className="button-icon-danger" onClick={() => handleDeleteStock(t.TransactionID)}><FaTrash/></button></>}</td>
                        </tr>)}</tbody></table>) : <p>No stock returned yet.</p>}
                </Card>
            </div>

            {/* ... (Payment/Reassign/Edit Modals remain unchanged) ... */}
            <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title={`Pay against Order #${orderId}`}>
                <form onSubmit={handleMakePayment}><p>Pending Amount: <strong>Rs {financials.AmountPending.toFixed(2)}</strong></p><div className="form-group"><label>Amount (Rs)</label><input type="number" step="0.01" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} required autoFocus /></div><div className="form-group"><label>Notes</label><input type="text" value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} /></div><div className="modal-footer"><button type="button" className="button-secondary" onClick={() => setIsPaymentModalOpen(false)}>Cancel</button><button type="submit" className="button">Record Payment</button></div></form>
            </Modal>
            <Modal isOpen={isEditPaymentModalOpen} onClose={() => setIsEditPaymentModalOpen(false)} title="Edit Payment"><form onSubmit={handleUpdatePayment}><div className="form-group"><label>Amount (Rs)</label><input type="number" step="0.01" value={editingPayment?.Amount} onChange={e => setEditingPayment(p => ({ ...p, Amount: e.target.value }))} required /></div><div className="form-group"><label>Payment Date</label><input type="date" value={editingPayment?.PaymentDate} onChange={e => setEditingPayment(p => ({ ...p, PaymentDate: e.target.value }))} required /></div><div className="form-group"><label>Notes</label><input type="text" value={editingPayment?.Notes || ''} onChange={e => setEditingPayment(p => ({ ...p, Notes: e.target.value }))} /></div><div className="modal-footer"><button type="button" className="button-secondary" onClick={() => setIsEditPaymentModalOpen(false)}>Cancel</button><button type="submit" className="button">Save Changes</button></div></form></Modal>
            <Modal isOpen={isEditStockModalOpen} onClose={() => setIsEditStockModalOpen(false)} title="Edit Stock Transaction"><form onSubmit={handleUpdateStock}><p><strong>Item:</strong> {editingStock?.Type} ({editingStock?.Quality})</p><div className="form-group"><label>Weight (kg)</label><input type="number" step="0.001" value={editingStock?.WeightKg} onChange={e => setEditingStock(s => ({...s, WeightKg: e.target.value}))} required /></div><div className="form-group"><label>Transaction Date</label><input type="date" value={editingStock?.TransactionDate} onChange={e => setEditingStock(s => ({...s, TransactionDate: e.target.value}))} required /></div><div className="modal-footer"><button type="button" className="button-secondary" onClick={() => setIsEditStockModalOpen(false)}>Cancel</button><button type="submit" className="button">Save Changes</button></div></form></Modal>
            <Modal isOpen={isReassignModalOpen} onClose={() => setIsReassignModalOpen(false)} title="Reassign Contractor"><form onSubmit={handleReassign}><div className="form-group"><label>Current Contractor</label><input type="text" value={order.ContractorName} disabled /></div><div className="form-group"><label>New Contractor</label><select value={reassignData.new_contractor_id} onChange={e => setReassignData(p => ({...p, new_contractor_id: e.target.value}))} required><option value="" disabled>-- Select --</option>{allContractors.map(c => <option key={c.ContractorID} value={c.ContractorID}>{c.Name}</option>)}</select></div><div className="form-group"><label>Reason for Change</label><textarea value={reassignData.reason} onChange={e => setReassignData(p => ({...p, reason: e.target.value}))} required /></div><div className="modal-footer"><button type="button" className="button-secondary" onClick={() => setIsReassignModalOpen(false)}>Cancel</button><button type="submit" className="button">Confirm Reassignment</button></div></form></Modal>

            {/* --- MODIFIED: Issue Stock Modal with Search --- */}
            <Modal isOpen={isIssueStockModalOpen} onClose={() => setIsIssueStockModalOpen(false)} title="Issue More Stock to Order">
                <div style={{ marginBottom: '15px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                    <h4>Search Inventory</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '5px', marginBottom: '5px' }}>
                        <input type="text" placeholder="Type (e.g. Wool)" value={stockSearch.type} onChange={e => setStockSearch(p => ({...p, type: e.target.value}))} />
                        <input type="text" placeholder="Quality (e.g. 60x60)" value={stockSearch.quality} onChange={e => setStockSearch(p => ({...p, quality: e.target.value}))} />
                        <input type="text" placeholder="Color/Shade" value={stockSearch.color} onChange={e => setStockSearch(p => ({...p, color: e.target.value}))} />
                    </div>
                    <button type="button" className="button-small" onClick={searchStock}>Search</button>
                </div>

                <form onSubmit={handleIssueStock}>
                    <div className="form-group">
                        <label>Select Stock Item</label>
                        <select 
                            value={stockToAdd.stock_id} 
                            onChange={e => setStockToAdd(p => ({...p, stock_id: e.target.value}))}
                            required
                        >
                            <option value="" disabled>-- Select from Search Results --</option>
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
                    <div className="form-group">
                        <label>Date of Issuance</label>
                        <input type="date" value={stockToAdd.transaction_date} onChange={e => setStockToAdd(p => ({...p, transaction_date: e.target.value}))} required />
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
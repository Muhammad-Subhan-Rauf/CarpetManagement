// src/pages/LendingRecordDetails.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getLentRecordById, getRecordFinancials, getRecordTransactions, getPaymentsByRecord, addPayment, closeLendingRecord, updateLentRecord } from '../services/api';
import Card from '../components/Card';
import Modal from '../components/Modal';
import { FaEdit } from 'react-icons/fa';

// --- Close Record Modal Component (unchanged) ---
const CloseRecordModal = ({ isOpen, onClose, record, issuedTransactions, financials, onConfirm }) => {
    const [reconciliation, setReconciliation] = useState({});
    const [finalPayment, setFinalPayment] = useState('');

    useEffect(() => {
        if (isOpen) {
            const initialData = {};
            issuedTransactions.forEach(t => {
                initialData[t.StockID] = { weight_returned: '', weight_kept: '' };
            });
            setReconciliation(initialData);
            setFinalPayment('');
        }
    }, [isOpen, issuedTransactions]);

    const handleReconChange = (stockId, field, value) => {
        setReconciliation(prev => ({
            ...prev,
            [stockId]: { ...prev[stockId], [field]: value }
        }));
    };
    
    const { reconciliationValue, finalAmountDue } = useMemo(() => {
        let totalValue = 0;
        if (issuedTransactions && financials) {
            for (const item of issuedTransactions) {
                const reconData = reconciliation[item.StockID];
                if (reconData) {
                    const returnedWeight = parseFloat(reconData.weight_returned) || 0;
                    const keptWeight = parseFloat(reconData.weight_kept) || 0;
                    totalValue += (returnedWeight + keptWeight) * item.PricePerKgAtTimeOfTransaction;
                }
            }
        }
        const finalDue = (financials?.AmountPending || 0) - totalValue;
        return { reconciliationValue: totalValue, finalAmountDue: finalDue };
    }, [reconciliation, issuedTransactions, financials]);


    const handleSubmit = () => {
        for (const t of issuedTransactions) {
            const recon = reconciliation[t.StockID];
            if (recon) {
                const totalReturned = (parseFloat(recon.weight_returned) || 0) + (parseFloat(recon.weight_kept) || 0);
                if (totalReturned > t.total_issued_weight + 0.0001) {
                    alert(`Error for ${t.Type} (${t.Quality}): Cannot reconcile ${totalReturned.toFixed(3)}kg. Only ${t.total_issued_weight.toFixed(3)}kg is outstanding.`);
                    return;
                }
            }
        }
        onConfirm({ 
            reconciliation: Object.entries(reconciliation).map(([stockId, weights]) => ({ 
                StockID: parseInt(stockId), 
                weight_returned: parseFloat(weights.weight_returned) || 0,
                weight_kept: parseFloat(weights.weight_kept) || 0
            })),
            final_payment: parseFloat(finalPayment) || 0
        });
    };

    if (!isOpen || !financials) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Close Record #${record.LentRecordID}`}>
            <div className="form-group">
                <h4>Reconcile Materials</h4>
                <p>Enter the weight returned to inventory and any weight the contractor kept.</p>
                {issuedTransactions.map(t => (
                    <div key={t.StockID} className="reconciliation-item">
                        <strong>{t.Type} ({t.Quality})</strong>
                        <small>Outstanding: {t.total_issued_weight.toFixed(3)}kg</small>
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
            <div className="financial-summary-review">
                <h4>Final Settlement</h4>
                <div className="financial-item"><span>Currently Pending:</span> <span>Rs {financials.AmountPending.toFixed(2)}</span></div>
                <div className="financial-item negative"><span>(-) Value of Reconciled Stock:</span> <span>Rs {reconciliationValue.toFixed(2)}</span></div>
                <div className="financial-item total"><span>Final Amount Due:</span> <span>Rs {finalAmountDue.toFixed(2)}</span></div>
            </div>
            <hr />
            <div className="form-group">
                <label>Make Final Payment</label>
                <input type="number" step="0.01" value={finalPayment} onChange={e => setFinalPayment(e.target.value)} placeholder={`Enter ${finalAmountDue.toFixed(2)}`}/>
            </div>
            <div className="modal-footer">
                <button type="button" className="button-secondary" onClick={onClose}>Cancel</button>
                <button type="button" className="button" onClick={handleSubmit}>Confirm and Close Record</button>
            </div>
        </Modal>
    );
};


const LendingRecordDetails = () => {
    const { recordId } = useParams();
    const [record, setRecord] = useState(null);
    const [financials, setFinancials] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
    const [isEditingDueDate, setIsEditingDueDate] = useState(false);
    const [newDueDate, setNewDueDate] = useState('');

    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentNotes, setPaymentNotes] = useState('');

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [recordData, finData, transData, payData] = await Promise.all([
                getLentRecordById(recordId),
                getRecordFinancials(recordId),
                getRecordTransactions(recordId),
                getPaymentsByRecord(recordId)
            ]);
            setRecord(recordData);
            setFinancials(finData);
            setTransactions(transData);
            setPayments(payData);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [recordId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const { issuedTransactions, returnedTransactions, issuedStockSummary } = useMemo(() => {
        const issued = transactions.filter(t => t.TransactionType === 'Issued');
        const returned = transactions.filter(t => t.TransactionType === 'Returned');
        
        const summary = {};
        issued.forEach(t => {
            if (!summary[t.StockID]) {
                summary[t.StockID] = { ...t, total_issued_weight: 0 };
            }
            summary[t.StockID].total_issued_weight += t.WeightKg;
        });
        
        returned.forEach(t => {
            if (summary[t.StockID]) {
                summary[t.StockID].total_issued_weight -= t.WeightKg;
            }
        });

        return {
            issuedTransactions: issued,
            returnedTransactions: returned,
            issuedStockSummary: Object.values(summary)
        }
    }, [transactions]);
    
    const handleConfirmClose = async (payload) => {
        try {
            await closeLendingRecord(recordId, payload);
            alert("Record has been successfully closed and paid off!");
            setIsCloseModalOpen(false);
            fetchData();
        } catch (err) {
            alert(`Error closing record: ${err.message}`);
        }
    };
    
    const handleMakePayment = async (e) => {
        e.preventDefault();
        const amount = parseFloat(paymentAmount);
        if (isNaN(amount) || amount <= 0) return alert("Please enter a valid payment amount.");

        try {
            await addPayment({
                contractor_id: record.ContractorID,
                record_id: recordId,
                amount: amount,
                notes: paymentNotes
            });
            alert("Payment recorded successfully!");
            setIsPaymentModalOpen(false);
            setPaymentAmount('');
            setPaymentNotes('');
            fetchData();
        } catch (err) {
            alert(`Error recording payment: ${err.message}`);
        }
    };

    const handleUpdateDueDate = async () => {
        if (!newDueDate) return alert("Please select a valid date.");
        try {
            await updateLentRecord(recordId, { DateDue: newDueDate });
            alert("Due date updated successfully!");
            setIsEditingDueDate(false);
            fetchData();
        } catch (err) {
            alert(`Failed to update due date: ${err.message}`);
        }
    };

    if (loading) return <div>Loading details...</div>;
    if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;
    if (!record || !financials) return <h2>Record not found.</h2>;

    return (
        <div>
            <div className="page-header-actions">
                <Link to="/" className="back-link">← Back to Dashboard</Link>
                {record.Status === 'Open' && (
                    <button className="button" onClick={() => setIsCloseModalOpen(true)}>Receive Carpet & Close Record</button>
                )}
            </div>
            <h1>Lending Record for {record.ContractorName}</h1>
            <p>
                <strong>Lent on:</strong> {record.DateIssued} | 
                <strong> Due on: </strong> 
                {isEditingDueDate ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)} />
                        <button className='button-small' onClick={handleUpdateDueDate}>Save</button>
                        <button className='button-small button-secondary' onClick={() => setIsEditingDueDate(false)}>Cancel</button>
                    </span>
                ) : ( record.Status === 'Open' ? (
                    <>
                        {record.DateDue || 'N/A'}
                        <button title="Edit Due Date" className="button-icon-small" onClick={() => { setNewDueDate(record.DateDue || ''); setIsEditingDueDate(true); }}>
                            <FaEdit />
                        </button>
                    </>
                ) : (record.DateDue || 'N/A')
                )}
                | <strong>Penalty/Day:</strong> Rs {record.PenaltyPerDay.toFixed(2)}
                | <strong>Status:</strong> <span className={`status-badge status-${record.Status}`}>{record.Status}</span>
                | <Link to={`/contractor/${record.ContractorID}`}>View Contractor's Full Ledger</Link>
            </p>
            
            <div className="details-grid">
                <Card title="Financials for this Record">
                    <div className="financial-item"><span>Value of Stock Issued:</span> <span>Rs {financials.IssuedValue.toFixed(2)}</span></div>
                    <div className="financial-item negative"><span>(-) Value of Stock Returned:</span> <span>Rs {financials.ReturnedValue.toFixed(2)}</span></div>
                    <div className="financial-item negative"><span>(+) Overdue Fine:</span> <span>Rs {financials.TotalFine.toFixed(2)}</span></div>
                    <hr/><div className="financial-item total"><span>Net Billable Amount:</span> <span>Rs {(financials.NetValue + financials.TotalFine).toFixed(2)}</span></div><hr/>
                    <div className="financial-item"><span>Total Paid:</span> <span>Rs {financials.AmountPaid.toFixed(2)}</span></div>
                    <div className="financial-item pending"><span>CURRENTLY PENDING:</span> <span>Rs {financials.AmountPending.toFixed(2)}</span></div>
                    
                    {/* --- THIS IS THE FIX --- */}
                    {/* The button now ONLY checks if there is a pending amount. */}
                    {financials.AmountPending > 0.001 && (
                        <div style={{marginTop: '1.5rem', borderTop: '1px solid #eee', paddingTop: '1.5rem'}}>
                            <button className="button" style={{width: '100%'}} onClick={() => setIsPaymentModalOpen(true)}>Make a Payment</button>
                        </div>
                    )}
                </Card>
                <Card title="Payment History for this Record">
                    {payments.length > 0 ? (
                        <table className="styled-table"><thead><tr><th>Date</th><th>Amount (Rs)</th><th>Notes</th></tr></thead>
                        <tbody>{payments.map(p=><tr key={p.PaymentID}><td>{p.PaymentDate}</td><td>{p.Amount.toFixed(2)}</td><td>{p.Notes || '-'}</td></tr>)}</tbody>
                        </table>
                    ) : <p>No payments specific to this record.</p>}
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
            
            <CloseRecordModal 
                isOpen={isCloseModalOpen}
                onClose={() => setIsCloseModalOpen(false)}
                record={record}
                issuedTransactions={issuedStockSummary}
                financials={financials}
                onConfirm={handleConfirmClose}
            />

            <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title={`Pay against Record #${recordId}`}>
                <form onSubmit={handleMakePayment}>
                    <p>Pending Amount: <strong>Rs {financials.AmountPending.toFixed(2)}</strong></p>
                    <div className="form-group">
                        <label>Amount (Rs)</label>
                        <input type="number" step="0.01" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} required autoFocus />
                    </div>
                    <div className="form-group">
                        <label>Notes</label>
                        <input type="text" value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} placeholder="e.g., Partial payment" />
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="button-secondary" onClick={() => setIsPaymentModalOpen(false)}>Cancel</button>
                        <button type="submit" className="button">Record Payment</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default LendingRecordDetails;
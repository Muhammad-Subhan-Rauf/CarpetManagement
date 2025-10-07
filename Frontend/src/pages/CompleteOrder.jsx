// Original relative path: pages/CompleteOrder.jsx

// Original relative path: src/pages/CompleteOrder.jsx

// src/pages/CompleteOrder.jsx

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getOrderById, getOrderTransactions, getOrderFinancials, completeOrder } from '../services/api';
import Card from '../components/Card';

const CompleteOrder = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  
  const [order, setOrder] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [financials, setFinancials] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Form state
  const [completionDate, setCompletionDate] = useState(new Date().toISOString().split('T')[0]);
  const [finalWage, setFinalWage] = useState('');
  const [finalDimensions, setFinalDimensions] = useState({ length: '', width: '' });
  const [pricePerSqFt, setPricePerSqFt] = useState('');
  const [deductions, setDeductions] = useState([]);
  const [newDeduction, setNewDeduction] = useState({ reason: '', amount: '' });
  const [reconciliation, setReconciliation] = useState({});

  const _parseDimension = useCallback((dimVal) => {
    if (!dimVal || parseFloat(dimVal) === 0) return 0.0;
    try {
        const dimFloat = parseFloat(dimVal);
        const feet = Math.trunc(dimFloat);
        const inches = Math.round((dimFloat - feet) * 100);
        return feet + (inches / 12.0);
    } catch (e) {
        return 0.0;
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [orderData, transData, finData] = await Promise.all([
        getOrderById(orderId), getOrderTransactions(orderId), getOrderFinancials(orderId)
      ]);
      setOrder(orderData);
      setTransactions(transData);
      setFinancials(finData);
      
      const initialWage = orderData.Wage || (orderData.Length * orderData.Width * orderData.PricePerSqFt) || 0;
      setFinalWage(initialWage.toFixed(2));

      // Pre-fill final dimensions with the order's original dimensions
      setFinalDimensions({ length: orderData.Length || '', width: orderData.Width || '' });
      setPricePerSqFt(orderData.PricePerSqFt || '');

      const initialRecon = {};
      transData.filter(t => t.TransactionType === 'Issued')
        .forEach(t => {
            if(!initialRecon[t.StockID]) {
                initialRecon[t.StockID] = { ...t, weight_returned: '', weight_kept: ''};
            }
        });
      setReconciliation(initialRecon);

    } catch(err) { setError(err.message); } 
    finally { setLoading(false); }
  }, [orderId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-calculate wage when dimensions or price changes
  useEffect(() => {
    const length = _parseDimension(finalDimensions.length);
    const width = _parseDimension(finalDimensions.width);
    const ppsqft = parseFloat(pricePerSqFt) || 0;

    if (length > 0 && width > 0 && ppsqft > 0) {
        const calculatedWage = length * width * ppsqft;
        setFinalWage(calculatedWage.toFixed(2));
    }
  }, [finalDimensions.length, finalDimensions.width, pricePerSqFt, _parseDimension]);

  // NEW: Memoized calculation for the final area
  const finalArea = useMemo(() => {
    const length = _parseDimension(finalDimensions.length);
    const width = _parseDimension(finalDimensions.width);
    if (length > 0 && width > 0) {
        return (length * width).toFixed(2);
    }
    return '0.00';
  }, [finalDimensions.length, finalDimensions.width, _parseDimension]);
  
  const outstandingStock = useMemo(() => {
    const stockMap = new Map();
    transactions.forEach(t => {
        const currentWeight = stockMap.get(t.StockID)?.net_weight || 0;
        const weightChange = t.TransactionType === 'Issued' ? t.WeightKg : -t.WeightKg;
        stockMap.set(t.StockID, {...t, net_weight: currentWeight + weightChange });
    });
    return Array.from(stockMap.values()).filter(s => s.net_weight > 0.001);
  }, [transactions]);

  const handleReconChange = (stockId, field, value) => {
    setReconciliation(prev => ({...prev, [stockId]: {...prev[stockId], [field]: value }}));
  };

  const addDeduction = () => {
    if(!newDeduction.reason || !newDeduction.amount || parseFloat(newDeduction.amount) <= 0) return;
    setDeductions(prev => [...prev, {reason: newDeduction.reason, amount: parseFloat(newDeduction.amount)}]);
    setNewDeduction({ reason: '', amount: '' });
  };
  
  const financialSummary = useMemo(() => {
    if (!financials || !order) return {};
    let reconciledStockValue = 0;
    for (const stockId in reconciliation) {
        const item = reconciliation[stockId];
        const returned = parseFloat(item.weight_returned) || 0;
        const kept = parseFloat(item.weight_kept) || 0;
        reconciledStockValue += (returned + kept) * item.PricePerKgAtTimeOfTransaction;
    }
    const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);
    const wage = parseFloat(finalWage) || 0;
    const netStockValue = financials.IssuedValue - reconciledStockValue;
    const pendingAmount = wage - netStockValue - totalDeductions - financials.AmountPaid;

    return { reconciledStockValue, totalDeductions, wage, netStockValue, pendingAmount };
  }, [finalWage, reconciliation, deductions, order, financials]);

  const handleConfirmCompletion = async () => {
    // Validation
    for (const stock of outstandingStock) {
        const recon = reconciliation[stock.StockID];
        const returned = parseFloat(recon.weight_returned) || 0;
        const kept = parseFloat(recon.weight_kept) || 0;
        if (returned + kept > stock.net_weight + 0.001) {
            alert(`Reconciliation error for ${stock.Type}: Cannot account for ${returned+kept}kg, only ${stock.net_weight.toFixed(3)}kg is outstanding.`);
            return;
        }
    }

    const payload = {
      dateCompleted: completionDate,
      finalWage: parseFloat(finalWage) || 0,
      finalLength: finalDimensions.length,
      finalWidth: finalDimensions.width,
      pricePerSqFt: parseFloat(pricePerSqFt) || 0,
      reconciliation: Object.values(reconciliation).map(s => ({ 
        StockID: s.StockID, 
        weight_returned: parseFloat(s.weight_returned) || 0,
        weight_kept: parseFloat(s.weight_kept) || 0,
      })),
      deductions: deductions,
    };

    try {
      await completeOrder(orderId, payload);
      alert("Order completion confirmed!");
      navigate(`/order/${orderId}`);
    } catch (err) { alert(`Error completing order: ${err.message}`); }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;
  if (!order || !financials) return <h2>Order data could not be loaded.</h2>;

  return (
    <div>
      <Link to={`/order/${orderId}`} className="back-link">← Cancel and go back</Link>
      <h1>Complete Order: {order.DesignNumber}</h1>
      <div className="details-grid">
        <div>
          <Card title="1. Finalize Details">
            <div className="form-group"><label>Carpet Delivery Date</label><input type="date" value={completionDate} onChange={(e) => setCompletionDate(e.target.value)} /></div>
            
            <div className="form-grid-2">
              <div className="form-group">
                <label>Final Length</label>
                <input type="number" step="0.01" value={finalDimensions.length} 
                       onChange={e => setFinalDimensions(p => ({...p, length: e.target.value}))} 
                       placeholder="e.g., 7.11 for 7ft 11in" />
              </div>
              <div className="form-group">
                <label>Final Width</label>
                <input type="number" step="0.01" value={finalDimensions.width} 
                       onChange={e => setFinalDimensions(p => ({...p, width: e.target.value}))} 
                       placeholder="e.g., 8.02 for 8ft 2in" />
              </div>
            </div>

            {/* ADDED: Display for final calculated area */}
            <div className="form-group">
                <label>Final Area (Sq. Ft.)</label>
                <input type="text" value={`${finalArea} sq. ft.`} disabled />
            </div>

            <div className="form-group">
              <label>Final Price Per Sq Ft (Rs)</label>
              <input type="number" step="0.01" value={pricePerSqFt}
                     onChange={e => setPricePerSqFt(e.target.value)}
                     placeholder="Price per square foot" />
            </div>

            <div className="form-group"><label>Final Agreed Wage (Rs)</label><input type="number" step="0.01" value={finalWage} onChange={(e) => setFinalWage(e.target.value)} placeholder="Calculated or overridden wage" /></div>
          </Card>
          <Card title="2. Reconcile Stock">
            {outstandingStock.length > 0 ? outstandingStock.map(stock => (
                <div key={stock.StockID} className="reconciliation-item">
                    <strong>{stock.Type} ({stock.Quality}) {stock.ColorShadeNumber && `- ${stock.ColorShadeNumber}`}</strong>
                    <small>Outstanding: {stock.net_weight.toFixed(3)}kg</small>
                    <div className="form-group-inline"><label>Returned (kg)</label><input type="number" step="0.001" placeholder="To inventory" value={reconciliation[stock.StockID]?.weight_returned || ''} onChange={(e) => handleReconChange(stock.StockID, 'weight_returned', e.target.value)} /></div>
                    <div className="form-group-inline"><label>Kept (kg)</label><input type="number" step="0.001" placeholder="By contractor" value={reconciliation[stock.StockID]?.weight_kept || ''} onChange={(e) => handleReconChange(stock.StockID, 'weight_kept', e.target.value)} /></div>
                </div>
            )) : <p>All issued stock has been accounted for.</p>}
          </Card>
           <Card title="3. Add Deductions (Optional)">
             <div className="stock-issue-form">
                <div className="form-group"><label>Reason</label><input type="text" value={newDeduction.reason} onChange={(e)=>setNewDeduction(p=>({...p, reason: e.target.value}))}/></div>
                <div className="form-group"><label>Amount</label><input type="number" step="0.01" value={newDeduction.amount} onChange={(e)=>setNewDeduction(p=>({...p, amount: e.target.value}))}/></div>
                <button type="button" className="button" onClick={addDeduction}>Add</button>
             </div>
           </Card>
        </div>
        <div>
          <Card title="4. Review and Confirm">
            <div className="financial-summary-review">
              <h3>Final Payout Calculation</h3>
              <div className="financial-item total"><span>Final Wage Payable:</span> <span>Rs {financialSummary.wage?.toFixed(2)}</span></div>
              <div className="financial-item negative"><span>(-) Net Stock Value:</span> <span>Rs {financialSummary.netStockValue?.toFixed(2)}</span></div>
              
              {/* Display added deductions */}
              {deductions.length > 0 && deductions.map((d, i) => (
                  <div key={i} className="financial-item negative small-text">
                      <span>(-) {d.reason}</span>
                      <span>Rs {d.amount.toFixed(2)}</span>
                  </div>
              ))}

              <div className="financial-item negative"><span>(-) Total Deductions:</span> <span>Rs {financialSummary.totalDeductions?.toFixed(2)}</span></div>

              <hr/>
              <div className="financial-item total"><span>Total Payable Amount:</span> <span>Rs {(financialSummary.wage - financialSummary.netStockValue - financialSummary.totalDeductions)?.toFixed(2)}</span></div>
              <hr/>
              <div className="financial-item"><span>Previously Paid:</span> <span>Rs {financials.AmountPaid?.toFixed(2)}</span></div>
              <hr />
              <div className="financial-item pending"><span>Final Pending Amount:</span> <span>Rs {financialSummary.pendingAmount?.toFixed(2)}</span></div>
              <div className="step-navigation"><button className="button" onClick={handleConfirmCompletion} style={{width: '100%'}}>Confirm Completion</button></div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CompleteOrder;
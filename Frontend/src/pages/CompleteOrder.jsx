// Original relative path: Frontend/src/pages/CompleteOrder.jsx

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
  
  // --- MODIFIED: Split state for final dimensions ---
  const [finalDimensions, setFinalDimensions] = useState({ 
      lengthFt: '', lengthIn: '', 
      widthFt: '', widthIn: '' 
  });
  
  const [pricePerSqFt, setPricePerSqFt] = useState('');
  const [deductions, setDeductions] = useState([]);
  const [newDeduction, setNewDeduction] = useState({ reason: '', amount: '' });
  const [reconciliation, setReconciliation] = useState({});

  // Helper: Convert decimal feet to feet and inches
  const decimalToFtIn = (decimalVal) => {
      if (!decimalVal) return { ft: '', in: '' };
      let feet = Math.floor(decimalVal);
      let inches = Math.round((decimalVal - feet) * 12);
      if (inches === 12) {
          feet += 1;
          inches = 0;
      }
      return { ft: feet, in: inches };
  };

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

      // --- MODIFIED: Pre-fill dimensions by converting decimal back to ft/in ---
      const l = decimalToFtIn(orderData.Length);
      const w = decimalToFtIn(orderData.Width);
      
      setFinalDimensions({ 
          lengthFt: l.ft, lengthIn: l.in,
          widthFt: w.ft, widthIn: w.in 
      });

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

  // --- MODIFIED: Auto-calculate wage using the separate inputs ---
  useEffect(() => {
    const lFt = parseFloat(finalDimensions.lengthFt) || 0;
    const lIn = parseFloat(finalDimensions.lengthIn) || 0;
    const wFt = parseFloat(finalDimensions.widthFt) || 0;
    const wIn = parseFloat(finalDimensions.widthIn) || 0;
    const ppsqft = parseFloat(pricePerSqFt) || 0;

    // decimal = ft + in/12
    const lDecimal = lFt + (lIn / 12);
    const wDecimal = wFt + (wIn / 12);

    if (lDecimal > 0 && wDecimal > 0 && ppsqft > 0) {
        const calculatedWage = lDecimal * wDecimal * ppsqft;
        setFinalWage(calculatedWage.toFixed(2));
    }
  }, [finalDimensions, pricePerSqFt]);

  // --- MODIFIED: Memoized final area calculation ---
  const finalArea = useMemo(() => {
    const lFt = parseFloat(finalDimensions.lengthFt) || 0;
    const lIn = parseFloat(finalDimensions.lengthIn) || 0;
    const wFt = parseFloat(finalDimensions.widthFt) || 0;
    const wIn = parseFloat(finalDimensions.widthIn) || 0;
    
    const lDecimal = lFt + (lIn / 12);
    const wDecimal = wFt + (wIn / 12);
    
    if (lDecimal > 0 && wDecimal > 0) {
        return (lDecimal * wDecimal).toFixed(2);
    }
    return '0.00';
  }, [finalDimensions]);
  
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

  // --- MODIFIED: Update handler for dimension inputs ---
  const handleDimChange = (e) => {
      const { name, value } = e.target;
      setFinalDimensions(prev => ({ ...prev, [name]: value }));
  };

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

    // --- MODIFIED: Construct Feet.Inches strings for the backend ---
    const finalLengthStr = `${finalDimensions.lengthFt || '0'}.${finalDimensions.lengthIn || '0'}`;
    const finalWidthStr = `${finalDimensions.widthFt || '0'}.${finalDimensions.widthIn || '0'}`;

    const payload = {
      dateCompleted: completionDate,
      finalWage: parseFloat(finalWage) || 0,
      finalLength: finalLengthStr,
      finalWidth: finalWidthStr,
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
               {/* --- MODIFIED: Split Inputs for Final Length --- */}
              <div className="form-group">
                <label>Final Length</label>
                <div style={{display: 'flex', gap: '5px'}}>
                    <input type="number" placeholder="Ft" name="lengthFt" value={finalDimensions.lengthFt} onChange={handleDimChange} style={{flex: 1}} />
                    <input type="number" placeholder="In" name="lengthIn" value={finalDimensions.lengthIn} onChange={handleDimChange} style={{flex: 1}} />
                </div>
              </div>
               {/* --- MODIFIED: Split Inputs for Final Width --- */}
              <div className="form-group">
                <label>Final Width</label>
                <div style={{display: 'flex', gap: '5px'}}>
                    <input type="number" placeholder="Ft" name="widthFt" value={finalDimensions.widthFt} onChange={handleDimChange} style={{flex: 1}} />
                    <input type="number" placeholder="In" name="widthIn" value={finalDimensions.widthIn} onChange={handleDimChange} style={{flex: 1}} />
                </div>
              </div>
            </div>

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
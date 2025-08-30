// src/pages/CompleteOrder.jsx

import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getOrderById, getOrderTransactions, getOrderFinancials, completeOrder } from '../services/api';
import Card from '../components/Card';
import { FaTrash } from 'react-icons/fa';

const CompleteOrder = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  
  // --- Data from API ---
  const [order, setOrder] = useState(null);
  const [issuedTransactions, setIssuedTransactions] = useState([]);
  const [financials, setFinancials] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [orderData, transactionsData, financialsData] = await Promise.all([
          getOrderById(orderId),
          getOrderTransactions(orderId),
          getOrderFinancials(orderId)
        ]);
        setOrder(orderData);
        setIssuedTransactions(transactionsData.filter(t => t.TransactionType === 'Issued'));
        setFinancials(financialsData);
      } catch(err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [orderId]);

  // --- State for the completion form ---
  const [completionDate, setCompletionDate] = useState(new Date().toISOString().split('T')[0]);
  const [returnedStock, setReturnedStock] = useState([]);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [stockToReturn, setStockToReturn] = useState({ stockId: '', weight: '' });

  const uniqueIssuedStockItems = useMemo(() => {
    const unique = new Map();
    issuedTransactions.forEach(t => {
        if (!unique.has(t.StockID)) {
            unique.set(t.StockID, t);
        }
    });
    return Array.from(unique.values());
  }, [issuedTransactions]);

  const handleReturnStockChange = (e) => {
    const { name, value } = e.target;
    setStockToReturn(prev => ({ ...prev, [name]: value }));
  };

  const addStockToReturnList = () => {
    if (!stockToReturn.stockId || !stockToReturn.weight || parseFloat(stockToReturn.weight) <= 0) return;
    
    const stockId = parseInt(stockToReturn.stockId);
    const returnWeight = parseFloat(stockToReturn.weight);

    const issuedStockForThisItem = issuedTransactions.filter(t => t.StockID === stockId);
    if (issuedStockForThisItem.length === 0) return alert("Error: This stock was not issued.");

    const totalIssuedWeight = issuedStockForThisItem.reduce((sum, t) => sum + t.WeightKg, 0);
    const alreadyReturnedWeight = returnedStock.filter(s => s.StockID === stockId).reduce((sum, s) => sum + s.weight, 0);

    if (returnWeight + alreadyReturnedWeight > totalIssuedWeight) {
        return alert(`Cannot return ${returnWeight}kg. Only ${(totalIssuedWeight - alreadyReturnedWeight).toFixed(3)}kg outstanding.`);
    }

    const stockInfo = issuedStockForThisItem[0];
    setReturnedStock(prev => [...prev, {
        StockID: stockId, Type: stockInfo.Type, Quality: stockInfo.Quality,
        ColorShadeNumber: stockInfo.ColorShadeNumber, IdentifyingNumber: stockInfo.IdentifyingNumber,
        weight: returnWeight, PricePerKgAtTimeOfTransaction: stockInfo.PricePerKgAtTimeOfTransaction
    }]);
    setStockToReturn({ stockId: '', weight: '' });
  };
  
  const removeReturnedStock = (index) => setReturnedStock(prev => prev.filter((_, i) => i !== index));

  const financialSummary = useMemo(() => {
    if (!financials || !order) return {};
    const returnedStockValue = returnedStock.reduce((sum, t) => sum + (t.weight * t.PricePerKgAtTimeOfTransaction), 0);
    const daysDelayed = Math.max(0, (new Date(completionDate) - new Date(order.DateDue)) / (1000 * 60 * 60 * 24));
    const totalFine = daysDelayed * order.PenaltyPerDay;
    const finalWagePayable = financials.InitialWageBase - returnedStockValue - totalFine;
    const newPayment = parseFloat(paymentAmount) || 0;
    const amountPending = finalWagePayable - financials.AmountPaid - newPayment;

    return { returnedStockValue, daysDelayed, totalFine, finalWagePayable, newPayment, amountPending };
  }, [completionDate, returnedStock, paymentAmount, order, financials]);

  const handleConfirmCompletion = async () => {
    const payload = {
      dateCompleted: completionDate,
      newPaymentAmount: parseFloat(paymentAmount) || 0,
      returnedStock: returnedStock.map(s => ({ StockID: s.StockID, WeightKg: s.weight })),
    };

    try {
      await completeOrder(orderId, payload);
      alert("Order completion confirmed! You will now be redirected.");
      navigate(`/order/${orderId}`);
    } catch (err) {
      alert(`Error completing order: ${err.message}`);
    }
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
          <Card title="1. Set Completion Details">
            <div className="form-group"><label>Carpet Delivery Date</label><input type="date" value={completionDate} onChange={(e) => setCompletionDate(e.target.value)} /></div>
            <div className="form-group"><label>Payment Made Now</label><input type="number" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="e.g., 200.00" /></div>
          </Card>
          <Card title="2. Record Returned Stock">
            <div className="stock-issue-form">
              <div className="form-group"><label>Select Stock</label>
                <select name="stockId" value={stockToReturn.stockId} onChange={handleReturnStockChange}>
                  <option value="" disabled>-- Select stock --</option>
                  {uniqueIssuedStockItems.map(t => <option key={t.StockID} value={t.StockID}>
                      {t.Type} ({t.Quality}) {t.ColorShadeNumber && `- ${t.ColorShadeNumber}`} {t.IdentifyingNumber && `[${t.IdentifyingNumber}]`}
                  </option>)}
                </select>
              </div>
              <div className="form-group"><label>Weight (kg)</label><input type="number" step="0.001" name="weight" value={stockToReturn.weight} onChange={handleReturnStockChange} /></div>
              <button type="button" className="button" onClick={addStockToReturnList}>Add</button>
            </div><hr/>
            {returnedStock.length > 0 && <table className="styled-table"><thead><tr><th>Description</th><th>Weight (kg)</th><th>Action</th></tr></thead>
                <tbody>{returnedStock.map((s, index) => (<tr key={index}>
                    <td>
                        {s.Type} ({s.Quality})<br/>
                        <small style={{color: '#555'}}>Shade: {s.ColorShadeNumber || 'N/A'}, ID: {s.IdentifyingNumber || 'N/A'}</small>
                    </td>
                    <td>{s.weight.toFixed(3)}</td>
                    <td><button onClick={() => removeReturnedStock(index)} className="button-icon-danger"><FaTrash/></button></td>
                </tr>))}</tbody></table>}
          </Card>
        </div>
        <div>
          <Card title="3. Review and Confirm">
            <div className="financial-summary-review">
              <h3>Final Wage Calculation</h3>
              <div className="financial-item"><span>Initial Wage Base:</span> <span>Rs {financials.InitialWageBase?.toFixed(2)}</span></div>
              <div className="financial-item negative"><span>(-) Value of Returned Stock:</span> <span>Rs {financialSummary.returnedStockValue?.toFixed(2)}</span></div>
              <div className="financial-item negative"><span>(-) Delay Fine ({financialSummary.daysDelayed?.toFixed(0)} days):</span> <span>Rs {financialSummary.totalFine?.toFixed(2)}</span></div><hr/>
              <div className="financial-item total"><span>Final Wage Payable:</span> <span>Rs {financialSummary.finalWagePayable?.toFixed(2)}</span></div><hr/>
              <div className="financial-item"><span>Previously Paid:</span> <span>Rs {financials.AmountPaid?.toFixed(2)}</span></div>
              <div className="financial-item"><span>New Payment:</span> <span>Rs {financialSummary.newPayment?.toFixed(2)}</span></div><hr />
              <div className="financial-item pending"><span>Final Pending Amount:</span> <span>Rs {financialSummary.amountPending?.toFixed(2)}</span></div>
              <div className="step-navigation"><button className="button" onClick={handleConfirmCompletion} style={{width: '100%'}}>Confirm Completion</button></div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CompleteOrder;
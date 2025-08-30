// src/pages/OrderDetails.jsx

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getOrderById, getOrderFinancials, getOrderTransactions, getOrderPayments, addPaymentToOrder } from '../services/api';
import Card from '../components/Card';

const OrderDetails = () => {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [financials, setFinancials] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [payments, setPayments] = useState([]); // State for payments
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [orderData, financialsData, transactionsData, paymentsData] = await Promise.all([
        getOrderById(orderId),
        getOrderFinancials(orderId),
        getOrderTransactions(orderId),
        getOrderPayments(orderId), // Fetch payments
      ]);
      setOrder(orderData);
      setFinancials(financialsData);
      setTransactions(transactionsData);
      setPayments(paymentsData); // Set payments state
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error("Failed to fetch order details:", err);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleMakePayment = async () => {
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      alert('Please enter a valid positive payment amount.');
      return;
    }
    if (amount > financials.AmountPending) {
      if (!window.confirm(`This payment (Rs ${amount.toFixed(2)}) is greater than the pending amount (Rs ${financials.AmountPending.toFixed(2)}). Do you want to continue?`)) {
        return;
      }
    }
    setIsSubmittingPayment(true);
    try {
      await addPaymentToOrder(orderId, amount, paymentNotes);
      alert('Payment added successfully!');
      setPaymentAmount('');
      setPaymentNotes('');
      fetchData(); // Refetch all data to show updated financials and payment list
    } catch (err) {
      alert(`Payment failed: ${err.message}`);
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const { issuedTransactions, returnedTransactions } = useMemo(() => {
    return {
      issuedTransactions: transactions.filter(t => t.TransactionType === 'Issued'),
      returnedTransactions: transactions.filter(t => t.TransactionType === 'Returned'),
    };
  }, [transactions]);

  if (loading) return <div>Loading order details...</div>;
  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;
  if (!order || !financials) return <h2>Order not found!</h2>;

  return (
    <div>
      <div className="page-header-actions">
        <Link to="/" className="back-link">← Back to Dashboard</Link>
        {!order.DateCompleted && (
          <Link to={`/order/${order.OrderID}/complete`} className="button">
            Complete This Order
          </Link>
        )}
      </div>

      <h1>Order Details: {order.DesignNumber}</h1>
      
      <div className="details-grid">
        <Card title="Order & Contractor Info">
          <p><strong>Design / Shade Card:</strong> {order.DesignNumber} / {order.ShadeCard}</p>
          <p><strong>Contractor:</strong> {order.ContractorName}</p>
          <p><strong>Carpet Quality:</strong> {order.Quality}</p>
          <p><strong>Carpet Size:</strong> {order.Size}</p>
          <p><strong>Date Issued:</strong> {order.DateIssued}</p>
          <p><strong>Date Due:</strong> {order.DateDue}</p>
          <p><strong>Date Completed:</strong> {order.DateCompleted || 'Not Completed'}</p>
        </Card>

        <Card title="Financial Summary">
            <div className="financial-item"><span>Initial Wage Base:</span> <span>Rs {financials.InitialWageBase.toFixed(2)}</span></div>
            <div className="financial-item negative"><span>(-) Value of Returned Stock:</span> <span>Rs {financials.ReturnedStockValue.toFixed(2)}</span></div>
            <div className="financial-item negative"><span>(-) Delay Fine:</span> <span>Rs {financials.TotalFine.toFixed(2)}</span></div>
            <hr/>
            <div className="financial-item total"><span>Final Wage Payable:</span> <span>Rs {financials.FinalWagePayable.toFixed(2)}</span></div>
            <hr/>
            <div className="financial-item"><span>Amount Paid:</span> <span>Rs {financials.AmountPaid.toFixed(2)}</span></div>
            <div className="financial-item pending"><span>Amount Pending:</span> <span>Rs {financials.AmountPending.toFixed(2)}</span></div>

            {!order.DateCompleted && financials.AmountPending > 0 && (
              <div className="payment-form" style={{marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem'}}>
                <div className="form-group">
                  <label>Make a Payment</label>
                  <input 
                    type="number"
                    step="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder={`Enter amount to pay`}
                    disabled={isSubmittingPayment}
                  />
                </div>
                 <div className="form-group">
                  <label>Payment Notes (Optional)</label>
                  <input 
                    type="text"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    placeholder={`e.g., Advance for Eid`}
                    disabled={isSubmittingPayment}
                  />
                </div>
                <button className="button" onClick={handleMakePayment} disabled={isSubmittingPayment || !paymentAmount}>
                  {isSubmittingPayment ? 'Processing...' : 'Add Payment'}
                </button>
              </div>
            )}
        </Card>

        <Card title="Payment History">
          {payments.length > 0 ? (
            <table className="styled-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount (Rs)</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.PaymentID}>
                    <td>{p.PaymentDate}</td>
                    <td>{p.Amount.toFixed(2)}</td>
                    <td>{p.Notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No payments have been made for this order yet.</p>
          )}
        </Card>
        
        <Card title="Stock Issued">
          <table className="styled-table">
            <thead><tr><th>Description</th><th>Weight (kg)</th><th>Price/kg</th><th>Value</th></tr></thead>
            <tbody>
              {issuedTransactions.map(t => (
                <tr key={t.TransactionID}>
                  <td>
                    {t.Type} ({t.Quality})<br/>
                    <small style={{color: '#555'}}>Shade: {t.ColorShadeNumber || 'N/A'}, ID: {t.IdentifyingNumber || 'N/A'}</small>
                  </td>
                  <td>{t.WeightKg.toFixed(3)}</td>
                  <td>Rs {t.PricePerKgAtTimeOfTransaction.toFixed(2)}</td>
                  <td>Rs {(t.WeightKg * t.PricePerKgAtTimeOfTransaction).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        
        <Card title="Stock Returned">
           {returnedTransactions.length > 0 ? (
            <table className="styled-table">
              <thead><tr><th>Description</th><th>Weight (kg)</th><th>Price/kg</th><th>Value Deducted</th></tr></thead>
              <tbody>
                {returnedTransactions.map(t => (
                   <tr key={t.TransactionID}>
                    <td>
                      {t.Type} ({t.Quality})<br/>
                      <small style={{color: '#555'}}>Shade: {t.ColorShadeNumber || 'N/A'}, ID: {t.IdentifyingNumber || 'N/A'}</small>
                    </td>
                    <td>{t.WeightKg.toFixed(3)}</td>
                    <td>Rs {t.PricePerKgAtTimeOfTransaction.toFixed(2)}</td>
                    <td>Rs {(t.WeightKg * t.PricePerKgAtTimeOfTransaction).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
           ) : <p>No stock was returned for this order.</p>}
        </Card>
      </div>
    </div>
  );
};

export default OrderDetails;
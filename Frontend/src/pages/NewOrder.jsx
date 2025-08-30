// src/pages/NewOrder.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getContractors, getStockItems, createOrder, addContractor } from '../services/api';
import Card from '../components/Card';
import Modal from '../components/Modal';
import { FaTrash } from 'react-icons/fa';

const NewOrder = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [contractors, setContractors] = useState([]);
  const [allInventory, setAllInventory] = useState([]);
  const [loading, setLoading] = useState(true);

  // State for the new contractor modal
  const [isContractorModalOpen, setIsContractorModalOpen] = useState(false);
  const [newContractor, setNewContractor] = useState({ Name: '', ContactInfo: '' });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [contractorsData, inventoryData] = await Promise.all([getContractors(), getStockItems()]);
      setContractors(contractorsData);
      setAllInventory(inventoryData);
    } catch (error) {
      alert(`Failed to load initial data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const [orderData, setOrderData] = useState({
    ContractorID: '', Quality: '', Size: '', DesignNumber: '',
    ShadeCard: '', DateIssued: new Date().toISOString().split('T')[0],
    DateDue: '', PenaltyPerDay: '0',
  });

  const [issuedStock, setIssuedStock] = useState([]);
  const [stockToAdd, setStockToAdd] = useState({ StockID: '', weight: '' });

  const handleOrderDataChange = (e) => {
    const { name, value } = e.target;
    setOrderData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleNewContractorChange = (e) => {
    const { name, value } = e.target;
    setNewContractor(prev => ({ ...prev, [name]: value }));
  };

  const handleAddNewContractor = async (e) => {
    e.preventDefault();
    if (!newContractor.Name.trim()) {
        alert('Contractor name is required.');
        return;
    }
    try {
        await addContractor(newContractor);
        alert('Contractor added successfully!');
        closeContractorModal();
        fetchData(); // Refetch all data to update the contractor list
    } catch (error) {
        alert(`Failed to add contractor: ${error.message}`);
    }
  };

  const closeContractorModal = () => {
    setIsContractorModalOpen(false);
    setNewContractor({ Name: '', ContactInfo: '' });
  }

  const handleStockFormChange = (e) => {
    const { name, value } = e.target;
    setStockToAdd(prev => ({ ...prev, [name]: value }));
  };

  const handleAddStockToOrder = () => {
    if (!stockToAdd.StockID || !stockToAdd.weight || parseFloat(stockToAdd.weight) <= 0) {
      alert('Please select a stock item and enter a valid weight.');
      return;
    }
    const stockItem = allInventory.find(i => i.StockID === parseInt(stockToAdd.StockID));
    const weight = parseFloat(stockToAdd.weight);

    const alreadyIssuedWeight = issuedStock
      .filter(s => s.StockID === stockItem.StockID)
      .reduce((sum, s) => sum + s.WeightKg, 0);

    if (weight + alreadyIssuedWeight > stockItem.QuantityInStockKg) {
      alert(`Cannot issue ${weight}kg. Only ${stockItem.QuantityInStockKg - alreadyIssuedWeight}kg of ${stockItem.Type} (${stockItem.Quality}) available.`);
      return;
    }

    setIssuedStock(prev => [...prev, {
        StockID: stockItem.StockID, Type: stockItem.Type, Quality: stockItem.Quality,
        ColorShadeNumber: stockItem.ColorShadeNumber, IdentifyingNumber: stockItem.IdentifyingNumber,
        WeightKg: weight, PricePerKgAtTimeOfTransaction: stockItem.CurrentPricePerKg,
    }]);
    setStockToAdd({ StockID: '', weight: '' });
  };

  const removeStockItem = (index) => setIssuedStock(prev => prev.filter((_, i) => i !== index));

  const handleCreateOrder = async () => {
    const payload = {
      ...orderData,
      transactions: issuedStock.map(s => ({ StockID: s.StockID, WeightKg: s.WeightKg })),
    };
    try {
      const result = await createOrder(payload);
      alert(`Order for ${orderData.DesignNumber} created successfully! Order ID: ${result.OrderID}`);
      navigate('/');
    } catch (error) {
      alert(`Failed to create order: ${error.message}`);
    }
  };

  if (loading) return <div>Loading form data...</div>;

  return (
    <div>
      <Link to="/" className="back-link">← Cancel and go to Dashboard</Link>
      <h1>Create New Order</h1>
      
      {step === 1 && (
        <Card title="Step 1: Enter Order Details">
          <div className="form-group">
            <label>Select Contractor</label>
            <div style={{ display: 'flex', gap: '10px' }}>
                <select name="ContractorID" value={orderData.ContractorID} onChange={handleOrderDataChange} required style={{ flexGrow: 1 }}>
                <option value="" disabled>-- Select a Contractor --</option>
                {contractors.map(c => <option key={c.ContractorID} value={c.ContractorID}>{c.Name}</option>)}
                </select>
                <button type="button" className="button-small" onClick={() => setIsContractorModalOpen(true)}>+ Add New</button>
            </div>
          </div>
          <div className="form-group"><label>Design Number</label><input type="text" name="DesignNumber" value={orderData.DesignNumber} onChange={handleOrderDataChange} /></div>
          <div className="form-group"><label>Shade Card</label><input type="text" name="ShadeCard" value={orderData.ShadeCard} onChange={handleOrderDataChange} /></div>
          <div className="form-group"><label>Carpet Quality</label><input type="text" name="Quality" value={orderData.Quality} onChange={handleOrderDataChange} /></div>
          <div className="form-group"><label>Carpet Size</label><input type="text" name="Size" value={orderData.Size} onChange={handleOrderDataChange} /></div>
          <div className="form-group"><label>Date Issued</label><input type="date" name="DateIssued" value={orderData.DateIssued} onChange={handleOrderDataChange} /></div>
          <div className="form-group"><label>Date Due</label><input type="date" name="DateDue" value={orderData.DateDue} onChange={handleOrderDataChange} /></div>
          <div className="form-group"><label>Penalty per Day (Rs)</label><input type="number" name="PenaltyPerDay" value={orderData.PenaltyPerDay} onChange={handleOrderDataChange} /></div>
          <div className="step-navigation"><button className="button" onClick={() => setStep(2)} disabled={!orderData.ContractorID || !orderData.DateDue || !orderData.DesignNumber}>Next: Issue Stock</button></div>
        </Card>
      )}

      {step === 2 && (
        <Card title="Step 2: Issue Stock from Inventory">
          <div className="stock-issue-form">
            <div className="form-group">
              <label>Select Stock Item</label>
              <select name="StockID" value={stockToAdd.StockID} onChange={handleStockFormChange}>
                <option value="" disabled>-- Select Stock --</option>
                {allInventory.map(i => <option key={i.StockID} value={i.StockID}>
                  {i.Type} ({i.Quality}) {i.ColorShadeNumber && `- ${i.ColorShadeNumber}`} {i.IdentifyingNumber && `[${i.IdentifyingNumber}]`} - {i.QuantityInStockKg.toFixed(3)}kg available
                </option>)}
              </select>
            </div>
            <div className="form-group"><label>Weight to Issue (kg)</label><input type="number" step="0.001" name="weight" value={stockToAdd.weight} onChange={handleStockFormChange} /></div>
            <button type="button" className="button" onClick={handleAddStockToOrder}>Add Stock</button>
          </div>
          <hr/>
          <h3>Stock to be Issued</h3>
          {issuedStock.length > 0 ? (
            <table className="styled-table">
              <thead><tr><th>Description</th><th>Weight (kg)</th><th>Price/kg</th><th>Action</th></tr></thead>
              <tbody>{issuedStock.map((s, index) => (<tr key={index}>
                    <td>
                      {s.Type} ({s.Quality})<br />
                      <small style={{color: '#555'}}>Shade: {s.ColorShadeNumber || 'N/A'}, ID: {s.IdentifyingNumber || 'N/A'}</small>
                    </td>
                    <td>{s.WeightKg.toFixed(3)}</td><td>Rs {s.PricePerKgAtTimeOfTransaction.toFixed(2)}</td>
                    <td><button onClick={() => removeStockItem(index)} className="button-icon-danger"><FaTrash/></button></td>
                  </tr>))}</tbody>
            </table>) : <p>No stock added yet.</p>}
          <div className="step-navigation">
            <button className="button-secondary" onClick={() => setStep(1)}>Back</button>
            <button className="button" onClick={() => setStep(3)} disabled={issuedStock.length === 0}>Next: Review</button>
          </div>
        </Card>
      )}
      
      {step === 3 && (
        <Card title="Step 3: Review and Confirm Order">
            <div className="review-section">
              <h4>Contractor & Carpet Details</h4>
              <p><strong>Contractor:</strong> {contractors.find(c => c.ContractorID === parseInt(orderData.ContractorID))?.Name}</p>
              <p><strong>Design:</strong> {orderData.DesignNumber} / {orderData.ShadeCard}</p>
              <p><strong>Dates:</strong> Issued on {orderData.DateIssued}, Due by {orderData.DateDue}</p>
            </div><hr/>
            <div className="review-section">
              <h4>Stock to be Issued</h4>
              <table className="styled-table"><thead><tr><th>Description</th><th>Weight</th><th>Price/kg</th><th>Value</th></tr></thead>
                <tbody>
                  {issuedStock.map((s, index) => (<tr key={index}>
                      <td>
                        {s.Type} ({s.Quality})<br />
                        <small style={{color: '#555'}}>Shade: {s.ColorShadeNumber || 'N/A'}, ID: {s.IdentifyingNumber || 'N/A'}</small>
                      </td>
                      <td>{s.WeightKg.toFixed(3)}</td><td>Rs {s.PricePerKgAtTimeOfTransaction.toFixed(2)}</td>
                      <td>Rs {(s.WeightKg * s.PricePerKgAtTimeOfTransaction).toFixed(2)}</td>
                    </tr>))}
                  <tr><td colSpan="3" style={{textAlign:'right', fontWeight:'bold'}}>Total Initial Wage Base</td>
                    <td style={{fontWeight:'bold'}}>Rs {issuedStock.reduce((sum, s) => sum + (s.WeightKg * s.PricePerKgAtTimeOfTransaction), 0).toFixed(2)}</td>
                  </tr></tbody>
              </table>
            </div>
          <div className="step-navigation">
            <button className="button-secondary" onClick={() => setStep(2)}>Back</button>
            <button className="button" onClick={handleCreateOrder}>Create Order</button>
          </div>
        </Card>
      )}

      {/* --- Add New Contractor Modal --- */}
      <Modal isOpen={isContractorModalOpen} onClose={closeContractorModal} title="Add New Contractor">
        <form onSubmit={handleAddNewContractor}>
          <div className="form-group">
            <label>Contractor Name</label>
            <input type="text" name="Name" value={newContractor.Name} onChange={handleNewContractorChange} required autoFocus />
          </div>
          <div className="form-group">
            <label>Contact Info (Optional)</label>
            <input type="text" name="ContactInfo" value={newContractor.ContactInfo} onChange={handleNewContractorChange} />
          </div>
          <div className="modal-footer">
            <button type="button" className="button-secondary" onClick={closeContractorModal}>Cancel</button>
            <button type="submit" className="button">Save Contractor</button>
          </div>
        </form>
      </Modal>

    </div>
  );
};

export default NewOrder;
// Original relative path: src/pages/NewOrder.jsx

// Original relative path: pages/NewOrder.jsx

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
  const [availableInventory, setAvailableInventory] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isContractorModalOpen, setIsContractorModalOpen] = useState(false);
  const [newContractor, setNewContractor] = useState({ Name: '', ContactInfo: '' });

  const fetchInitialData = useCallback(async () => {
    try {
      setLoading(true);
      const contractorsData = await getContractors();
      setContractors(contractorsData);
    } catch (error) {
      alert(`Failed to load contractors: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);
  
  const fetchStockForQuality = useCallback(async (quality) => {
    if (!quality) {
        setAvailableInventory([]);
        return;
    }
    try {
        const inventoryData = await getStockItems(quality);
        setAvailableInventory(inventoryData);
    } catch (error) {
        alert(`Failed to load stock for quality ${quality}: ${error.message}`);
        setAvailableInventory([]);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);
  
  const [orderData, setOrderData] = useState({
    ContractorID: '', Quality: '', Size: '', DesignNumber: '',
    ShadeCard: '', DateIssued: new Date().toISOString().split('T')[0],
    DateDue: '', PenaltyPerDay: '0', Notes: '',
    Length: '', Width: '', PricePerSqFt: '',
  });

  const [issuedStock, setIssuedStock] = useState([]);
  const [stockToAdd, setStockToAdd] = useState({ StockID: '', weight: '' });

  const handleOrderDataChange = (e) => {
    const { name, value } = e.target;
    setOrderData(prev => ({ ...prev, [name]: value }));
    if (name === 'Quality') {
        fetchStockForQuality(value);
    }
  };
  
  const handleStockFormChange = (e) => {
    const { name, value } = e.target;
    setStockToAdd(prev => ({ ...prev, [name]: value }));
  };

  const handleAddNewContractor = async (e) => {
    e.preventDefault();
    try {
        await addContractor(newContractor);
        alert('Contractor added successfully!');
        setIsContractorModalOpen(false);
        setNewContractor({ Name: '', ContactInfo: '' });
        fetchInitialData();
    } catch (error) { alert(`Failed to add contractor: ${error.message}`); }
  };

  const handleAddStockToOrder = () => {
    const stockItem = availableInventory.find(i => i.StockID === parseInt(stockToAdd.StockID));
    const weight = parseFloat(stockToAdd.weight);
    if (!stockItem || !weight || weight <= 0) return alert('Invalid stock or weight.');

    const alreadyIssued = issuedStock.filter(s => s.StockID === stockItem.StockID).reduce((sum, s) => sum + s.WeightKg, 0);
    if (weight + alreadyIssued > stockItem.QuantityInStockKg) return alert(`Not enough stock. Available: ${(stockItem.QuantityInStockKg - alreadyIssued).toFixed(3)}kg`);
    
    setIssuedStock(prev => [...prev, { ...stockItem, WeightKg: weight }]);
    setStockToAdd({ StockID: '', weight: '' });
  };
  
  const removeStockItem = (index) => setIssuedStock(prev => prev.filter((_, i) => i !== index));

  const handleCreateOrder = async () => {
    // Create a mutable copy of the order data
    const finalOrderData = { ...orderData };

    // FIXED: Auto-generate the "Size" string if Length and Width are provided
    if (finalOrderData.Length && finalOrderData.Width) {
      finalOrderData.Size = `${finalOrderData.Width}x${finalOrderData.Length}`;
    }

    const payload = {
      ...finalOrderData,
      transactions: issuedStock.map(s => ({ StockID: s.StockID, WeightKg: s.WeightKg })),
    };
    
    try {
      const result = await createOrder(payload);
      alert(`Order created successfully! Order ID: ${result.OrderID}`);
      navigate('/');
    } catch (error) {
      alert(`Failed to create order: ${error.message}`);
    }
  };

  if (loading) return <div>Loading form data...</div>;

  return (
    <div>
      <Link to="/" className="back-link">← Cancel</Link>
      <h1>Create New Order</h1>
      
      {step === 1 && (
        <Card title="Step 1: Order & Wage Details">
          <div className="form-group"><label>Contractor</label>
            <div style={{display: 'flex', gap: '10px'}}><select name="ContractorID" value={orderData.ContractorID} onChange={handleOrderDataChange} required style={{flexGrow: 1}}><option value="" disabled>-- Select --</option>{contractors.map(c => <option key={c.ContractorID} value={c.ContractorID}>{c.Name}</option>)}</select><button type="button" className="button-small" onClick={()=>setIsContractorModalOpen(true)}>+ Add New</button></div>
          </div>
          <div className="form-grid-3">
            <div className="form-group"><label>Design Number*</label><input type="text" name="DesignNumber" value={orderData.DesignNumber} onChange={handleOrderDataChange}/></div>
            <div className="form-group"><label>Shade Card</label><input type="text" name="ShadeCard" value={orderData.ShadeCard} onChange={handleOrderDataChange}/></div>
            <div className="form-group"><label>Carpet Quality*</label><input type="text" name="Quality" value={orderData.Quality} onChange={handleOrderDataChange} placeholder="e.g. 60x60" /></div>
          </div>
          <hr/>
          <h4>Wage Calculation</h4>
          <div className="form-grid-3">
            <div className="form-group"><label>Length (ft)</label><input type="number" step="0.01" name="Length" value={orderData.Length} onChange={handleOrderDataChange} placeholder="e.g. 7.11" /></div>
            <div className="form-group"><label>Width (ft)</label><input type="number" step="0.01" name="Width" value={orderData.Width} onChange={handleOrderDataChange} placeholder="e.g. 8.02" /></div>
            <div className="form-group"><label>Price Per Sq.Ft (Rs)</label><input type="number" name="PricePerSqFt" value={orderData.PricePerSqFt} onChange={handleOrderDataChange} /></div>
          </div>
          <div className="form-group"><label>Calculated Wage</label><input type="text" value={`Rs ${(orderData.Length * orderData.Width * orderData.PricePerSqFt || 0).toFixed(2)}`} disabled /></div>
          <hr/>
          <div className="form-grid-2">
            <div className="form-group"><label>Date Issued</label><input type="date" name="DateIssued" value={orderData.DateIssued} onChange={handleOrderDataChange}/></div>
            <div className="form-group"><label>Date Due</label><input type="date" name="DateDue" value={orderData.DateDue} onChange={handleOrderDataChange}/></div>
          </div>
          <div className="step-navigation"><button className="button" onClick={() => setStep(2)} disabled={!orderData.ContractorID || !orderData.DesignNumber || !orderData.Quality}>Next: Issue Stock</button></div>
        </Card>
      )}

      {step === 2 && (
        <Card title={`Step 2: Issue Stock (Quality: ${orderData.Quality})`}>
          <div className="stock-issue-form">
            <div className="form-group"><label>Select Stock</label>
              <select name="StockID" value={stockToAdd.StockID} onChange={handleStockFormChange}>
                <option value="" disabled>-- Select Stock --</option>
                {availableInventory.length > 0 ? availableInventory.map(i => <option key={i.StockID} value={i.StockID} disabled={i.QuantityInStockKg <= 0}>{i.Type} ({i.Quality}) - {i.QuantityInStockKg.toFixed(3)}kg available</option>) : <option disabled>No stock found for this quality</option>}
              </select>
            </div>
            <div className="form-group"><label>Weight (kg)</label><input type="number" step="0.001" name="weight" value={stockToAdd.weight} onChange={handleStockFormChange}/></div>
            <button type="button" className="button" onClick={handleAddStockToOrder}>Add Stock</button>
          </div><hr/>
          <h3>Stock to be Issued</h3>
          {issuedStock.length > 0 ? (<table className="styled-table"><thead><tr><th>Desc.</th><th>Weight</th><th>Action</th></tr></thead><tbody>{issuedStock.map((s,i)=>(<tr key={i}><td>{s.Type} ({s.Quality})</td><td>{s.WeightKg.toFixed(3)}kg</td><td><button onClick={()=>removeStockItem(i)} className="button-icon-danger"><FaTrash/></button></td></tr>))}</tbody></table>) : <p>No stock added yet.</p>}
          <div className="step-navigation"><button className="button-secondary" onClick={()=>setStep(1)}>Back</button><button className="button" onClick={()=>setStep(3)} disabled={issuedStock.length===0}>Next: Review</button></div>
        </Card>
      )}
      
      {step === 3 && (
        <Card title="Step 3: Review and Confirm">
            <h4>Details</h4>
            <p><strong>Contractor:</strong> {contractors.find(c=>c.ContractorID===parseInt(orderData.ContractorID))?.Name}</p>
            <p><strong>Wage:</strong> Rs {(orderData.Length * orderData.Width * orderData.PricePerSqFt || 0).toFixed(2)}</p>
            <hr/><h4>Stock to be Issued</h4>
            <table className="styled-table"><thead><tr><th>Desc.</th><th>Weight</th><th>Value</th></tr></thead><tbody>
                {issuedStock.map((s,i)=>(<tr key={i}><td>{s.Type} ({s.Quality})</td><td>{s.WeightKg.toFixed(3)}</td><td>Rs {(s.WeightKg * s.CurrentPricePerKg).toFixed(2)}</td></tr>))}
                <tr><td colSpan="2" style={{textAlign:'right',fontWeight:'bold'}}>Total Stock Value</td><td style={{fontWeight:'bold'}}>Rs {issuedStock.reduce((sum,s) => sum + (s.WeightKg * s.CurrentPricePerKg), 0).toFixed(2)}</td></tr>
            </tbody></table>
          <div className="step-navigation"><button className="button-secondary" onClick={()=>setStep(2)}>Back</button><button className="button" onClick={handleCreateOrder}>Confirm & Create Order</button></div>
        </Card>
      )}

      <Modal isOpen={isContractorModalOpen} onClose={() => setIsContractorModalOpen(false)} title="Add New Contractor">
        <form onSubmit={handleAddNewContractor}><div className="form-group"><label>Name</label><input type="text" name="Name" value={newContractor.Name} onChange={(e)=>setNewContractor(p=>({...p, Name:e.target.value}))} required autoFocus /></div><div className="form-group"><label>Contact</label><input type="text" name="ContactInfo" value={newContractor.ContactInfo} onChange={(e)=>setNewContractor(p=>({...p, ContactInfo:e.target.value}))}/></div><div className="modal-footer"><button type="button" className="button-secondary" onClick={()=>setIsContractorModalOpen(false)}>Cancel</button><button type="submit" className="button">Save</button></div></form>
      </Modal>
    </div>
  );
};

export default NewOrder;
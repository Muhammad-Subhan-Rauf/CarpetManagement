// Original relative path: Frontend/src/pages/NewOrder.jsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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

  // --- ADDED: Separate state for split dimension inputs ---
  const [dimensions, setDimensions] = useState({
      lengthFt: '',
      lengthIn: '',
      widthFt: '',
      widthIn: ''
  });

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
        const inventoryData = await getStockItems({ quality });
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
    PricePerSqFt: '',
  });

  const [issuedStock, setIssuedStock] = useState([]);
  const [stockToAdd, setStockToAdd] = useState({ StockID: '', weight: '', date: new Date().toISOString().split('T')[0] });

  const handleOrderDataChange = (e) => {
    const { name, value } = e.target;
    setOrderData(prev => ({ ...prev, [name]: value }));
    if (name === 'Quality') {
        fetchStockForQuality(value);
    }
  };
  
  // --- ADDED: Handler for dimension changes ---
  const handleDimensionChange = (e) => {
      const { name, value } = e.target;
      setDimensions(prev => ({ ...prev, [name]: value }));
  };
  
  // --- ADDED: Calculate Wage live based on separate feet/inch inputs ---
  const calculatedWage = useMemo(() => {
      const lFt = parseFloat(dimensions.lengthFt) || 0;
      const lIn = parseFloat(dimensions.lengthIn) || 0;
      const wFt = parseFloat(dimensions.widthFt) || 0;
      const wIn = parseFloat(dimensions.widthIn) || 0;
      const price = parseFloat(orderData.PricePerSqFt) || 0;

      // Decimal feet = Feet + (Inches / 12)
      const decimalLength = lFt + (lIn / 12);
      const decimalWidth = wFt + (wIn / 12);
      
      return (decimalLength * decimalWidth * price).toFixed(2);
  }, [dimensions, orderData.PricePerSqFt]);

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
    
    setIssuedStock(prev => [...prev, { ...stockItem, WeightKg: weight, TransactionDate: stockToAdd.date }]);
    setStockToAdd({ StockID: '', weight: '', date: new Date().toISOString().split('T')[0] });
  };
  
  const removeStockItem = (index) => setIssuedStock(prev => prev.filter((_, i) => i !== index));

  const handleCreateOrder = async () => {
    // --- MODIFIED: Construct the "Feet.Inches" strings and Size string ---
    const lengthStr = `${dimensions.lengthFt || '0'}.${dimensions.lengthIn || '0'}`;
    const widthStr = `${dimensions.widthFt || '0'}.${dimensions.widthIn || '0'}`;
    const sizeStr = `${dimensions.widthFt || 0}'${dimensions.widthIn || 0}" x ${dimensions.lengthFt || 0}'${dimensions.lengthIn || 0}"`;

    const payload = {
      ...orderData,
      Length: lengthStr,
      Width: widthStr,
      Size: sizeStr,
      transactions: issuedStock.map(s => ({ 
          StockID: s.StockID, 
          WeightKg: s.WeightKg,
          transaction_date: s.TransactionDate
      })),
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
          <h4>Wage Calculation (Dimensions)</h4>
          <div className="form-grid-3">
            {/* --- MODIFIED: Split inputs for Length --- */}
            <div className="form-group">
                <label>Length</label>
                <div style={{display: 'flex', gap: '5px'}}>
                    <input type="number" placeholder="Ft" name="lengthFt" value={dimensions.lengthFt} onChange={handleDimensionChange} style={{flex: 1}} />
                    <input type="number" placeholder="In" name="lengthIn" value={dimensions.lengthIn} onChange={handleDimensionChange} style={{flex: 1}} />
                </div>
            </div>
             {/* --- MODIFIED: Split inputs for Width --- */}
            <div className="form-group">
                <label>Width</label>
                <div style={{display: 'flex', gap: '5px'}}>
                    <input type="number" placeholder="Ft" name="widthFt" value={dimensions.widthFt} onChange={handleDimensionChange} style={{flex: 1}} />
                    <input type="number" placeholder="In" name="widthIn" value={dimensions.widthIn} onChange={handleDimensionChange} style={{flex: 1}} />
                </div>
            </div>
            <div className="form-group"><label>Price Per Sq.Ft (Rs)</label><input type="number" name="PricePerSqFt" value={orderData.PricePerSqFt} onChange={handleOrderDataChange} /></div>
          </div>
          <div className="form-group"><label>Calculated Wage</label><input type="text" value={`Rs ${calculatedWage}`} disabled /></div>
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
          <div className="stock-issue-form form-grid-3">
            <div className="form-group"><label>Select Stock</label>
              <select name="StockID" value={stockToAdd.StockID} onChange={handleStockFormChange}>
                <option value="" disabled>-- Select Stock --</option>
                {availableInventory.length > 0 ? availableInventory.map(i => (
                  <option key={i.StockID} value={i.StockID} disabled={i.QuantityInStockKg <= 0}>
                    {i.Type} ({i.Quality}) {i.ColorShadeNumber && `- ${i.ColorShadeNumber}`} - {i.QuantityInStockKg.toFixed(3)}kg available
                  </option>
                )) : (
                  <option disabled>No stock found for this quality</option>
                )}
              </select>
            </div>
            <div className="form-group"><label>Weight (kg)</label><input type="number" step="0.001" name="weight" value={stockToAdd.weight} onChange={handleStockFormChange}/></div>
            <div className="form-group"><label>Date</label><input type="date" name="date" value={stockToAdd.date} onChange={handleStockFormChange}/></div>
            
            <div style={{ gridColumn: 'span 3' }}>
              <button type="button" className="button" onClick={handleAddStockToOrder}>Add Stock to Order</button>
            </div>
          </div><hr/>

          <h3>Stock to be Issued</h3>
          {issuedStock.length > 0 ? (<table className="styled-table"><thead><tr><th>Date</th><th>Desc.</th><th>Weight</th><th>Action</th></tr></thead><tbody>{issuedStock.map((s,i)=>(<tr key={i}><td>{s.TransactionDate}</td><td>{s.Type} ({s.Quality}) {s.ColorShadeNumber && `- ${s.ColorShadeNumber}`}</td><td>{s.WeightKg.toFixed(3)}kg</td><td><button onClick={()=>removeStockItem(i)} className="button-icon-danger"><FaTrash/></button></td></tr>))}</tbody></table>) : <p>No stock added yet.</p>}
          <div className="step-navigation"><button className="button-secondary" onClick={()=>setStep(1)}>Back</button><button className="button" onClick={()=>setStep(3)} disabled={issuedStock.length===0}>Next: Review</button></div>
        </Card>
      )}
      
      {step === 3 && (
        <Card title="Step 3: Review and Confirm">
            <h4>Details</h4>
            <p><strong>Contractor:</strong> {contractors.find(c=>c.ContractorID===parseInt(orderData.ContractorID))?.Name}</p>
            <p><strong>Dimensions:</strong> {dimensions.lengthFt}'{dimensions.lengthIn}" x {dimensions.widthFt}'{dimensions.widthIn}"</p>
            <p><strong>Wage:</strong> Rs {calculatedWage}</p>
            <hr/><h4>Stock to be Issued</h4>
            <table className="styled-table"><thead><tr><th>Date</th><th>Desc.</th><th>Weight</th><th>Value</th></tr></thead><tbody>
                {issuedStock.map((s,i)=>(<tr key={i}><td>{s.TransactionDate}</td><td>{s.Type} ({s.Quality}) {s.ColorShadeNumber && `- ${s.ColorShadeNumber}`}</td><td>{s.WeightKg.toFixed(3)}</td><td>Rs {(s.WeightKg * s.CurrentPricePerKg).toFixed(2)}</td></tr>))}
                <tr><td colSpan="3" style={{textAlign:'right',fontWeight:'bold'}}>Total Stock Value</td><td style={{fontWeight:'bold'}}>Rs {issuedStock.reduce((sum,s) => sum + (s.WeightKg * s.CurrentPricePerKg), 0).toFixed(2)}</td></tr>
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
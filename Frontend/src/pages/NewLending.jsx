// src/pages/NewLending.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getContractors, getStockItems, createLendingRecord, addContractor } from '../services/api';
import Card from '../components/Card';
import Modal from '../components/Modal';
import { FaTrash } from 'react-icons/fa';

const NewLending = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [contractors, setContractors] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [loading, setLoading] = useState(true);

    const [isContractorModalOpen, setIsContractorModalOpen] = useState(false);
    const [newContractor, setNewContractor] = useState({ Name: '', ContactInfo: '' });

    const [lendingData, setLendingData] = useState({
        ContractorID: '',
        DateIssued: new Date().toISOString().split('T')[0],
        DateDue: '',
        PenaltyPerDay: '0',
        Notes: '',
    });
    const [issuedStock, setIssuedStock] = useState([]);
    const [stockToAdd, setStockToAdd] = useState({ StockID: '', weight: '' });

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [cData, iData] = await Promise.all([getContractors(), getStockItems()]);
            setContractors(cData);
            setInventory(iData);
        } catch (error) {
            alert(`Failed to load data: ${error.message}`);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleDataChange = (e) => setLendingData({ ...lendingData, [e.target.name]: e.target.value });
    const handleNewContractorChange = (e) => setNewContractor({ ...newContractor, [e.target.name]: e.target.value });

    const handleAddNewContractor = async (e) => {
        e.preventDefault();
        try {
            await addContractor(newContractor);
            alert('Contractor added!');
            setIsContractorModalOpen(false);
            setNewContractor({ Name: '', ContactInfo: '' });
            fetchData();
        } catch (error) {
            alert(`Failed to add contractor: ${error.message}`);
        }
    };

    const handleStockFormChange = (e) => setStockToAdd({ ...stockToAdd, [e.target.name]: e.target.value });

    const handleAddStockToLending = () => {
        const stockItem = inventory.find(i => i.StockID === parseInt(stockToAdd.StockID));
        const weight = parseFloat(stockToAdd.weight);
        if (!stockItem || !weight || weight <= 0) return alert('Select stock and enter a valid weight.');

        const alreadyIssued = issuedStock.filter(s => s.StockID === stockItem.StockID).reduce((sum, s) => sum + s.WeightKg, 0);
        if (weight + alreadyIssued > stockItem.QuantityInStockKg) return alert(`Not enough stock. Available: ${(stockItem.QuantityInStockKg - alreadyIssued).toFixed(3)}kg`);
        
        setIssuedStock(prev => [...prev, {
            ...stockItem,
            WeightKg: weight,
            PricePerKgAtTimeOfTransaction: stockItem.CurrentPricePerKg
        }]);
        setStockToAdd({ StockID: '', weight: '' });
    };
    
    const removeStockItem = (index) => setIssuedStock(prev => prev.filter((_, i) => i !== index));

    const handleCreateLendingRecord = async () => {
        const payload = {
            ...lendingData,
            transactions: issuedStock.map(s => ({ StockID: s.StockID, WeightKg: s.WeightKg })),
        };
        try {
            const result = await createLendingRecord(payload);
            alert(`Lending Record created successfully! ID: ${result.LentRecordID}`);
            navigate('/');
        } catch (error) {
            alert(`Failed to create record: ${error.message}`);
        }
    };

    if (loading) return <div>Loading form...</div>;

    return (
        <div>
            <Link to="/" className="back-link">← Cancel</Link>
            <h1>Lend Stock to Contractor</h1>
            
            {step === 1 && (
                <Card title="Step 1: Select Contractor & Date">
                    <div className="form-group"><label>Contractor</label>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <select name="ContractorID" value={lendingData.ContractorID} onChange={handleDataChange} required style={{ flexGrow: 1 }}>
                                <option value="" disabled>-- Select --</option>
                                {contractors.map(c => <option key={c.ContractorID} value={c.ContractorID}>{c.Name}</option>)}
                            </select>
                            <button type="button" className="button-small" onClick={() => setIsContractorModalOpen(true)}>+ Add New</button>
                        </div>
                    </div>
                    <div className="form-group"><label>Date Issued</label><input type="date" name="DateIssued" value={lendingData.DateIssued} onChange={handleDataChange} /></div>
                    <div className="form-group"><label>Date Due (Optional)</label><input type="date" name="DateDue" value={lendingData.DateDue} onChange={handleDataChange} /></div>
                    <div className="form-group"><label>Penalty per Day (Rs)</label><input type="number" step="0.01" name="PenaltyPerDay" value={lendingData.PenaltyPerDay} onChange={handleDataChange} /></div>
                    <div className="form-group"><label>Notes (Optional)</label><textarea name="Notes" value={lendingData.Notes} onChange={handleDataChange}></textarea></div>
                    <div className="step-navigation"><button className="button" onClick={() => setStep(2)} disabled={!lendingData.ContractorID}>Next: Issue Stock</button></div>
                </Card>
            )}

            {step === 2 && (
                <Card title="Step 2: Issue Stock from Inventory">
                    <div className="form-group"><label>Stock Item</label>
                        <select name="StockID" value={stockToAdd.StockID} onChange={handleStockFormChange}>
                            <option value="" disabled>-- Select Stock --</option>
                            {inventory.map(i => <option key={i.StockID} value={i.StockID} disabled={i.QuantityInStockKg <= 0}>
                                {i.Type} ({i.Quality}) {i.ColorShadeNumber && `- ${i.ColorShadeNumber}`} - {i.QuantityInStockKg.toFixed(3)}kg available
                            </option>)}
                        </select>
                    </div>
                    <div className="form-group"><label>Weight (kg)</label><input type="number" step="0.001" name="weight" value={stockToAdd.weight} onChange={handleStockFormChange} /></div>
                    <button type="button" className="button" onClick={handleAddStockToLending}>Add Stock</button>
                    <hr/>
                    <h3>Stock to be Issued</h3>
                    {issuedStock.length > 0 ? (
                        <table className="styled-table"><thead><tr><th>Desc.</th><th>Weight</th><th>Action</th></tr></thead>
                        <tbody>{issuedStock.map((s, i) => (<tr key={i}><td>{s.Type} ({s.Quality}) {s.ColorShadeNumber && `- ${s.ColorShadeNumber}`}</td><td>{s.WeightKg.toFixed(3)}kg</td><td><button onClick={() => removeStockItem(i)} className="button-icon-danger"><FaTrash/></button></td></tr>))}</tbody>
                        </table>
                    ) : <p>No stock added yet.</p>}
                    <div className="step-navigation"><button className="button-secondary" onClick={() => setStep(1)}>Back</button><button className="button" onClick={() => setStep(3)} disabled={issuedStock.length === 0}>Next: Review</button></div>
                </Card>
            )}
            
            {step === 3 && (
                <Card title="Step 3: Review and Confirm">
                    <h4>Details</h4>
                    <p><strong>Contractor:</strong> {contractors.find(c => c.ContractorID === parseInt(lendingData.ContractorID))?.Name}</p>
                    <p><strong>Date:</strong> {lendingData.DateIssued}</p>
                    <p><strong>Due Date:</strong> {lendingData.DateDue || 'N/A'}</p>
                    <p><strong>Penalty:</strong> Rs {parseFloat(lendingData.PenaltyPerDay).toFixed(2)} per day</p>
                    <p><strong>Notes:</strong> {lendingData.Notes || 'N/A'}</p>
                    <hr/><h4>Stock to be Issued</h4>
                    <table className="styled-table"><thead><tr><th>Desc.</th><th>Weight</th><th>Value</th></tr></thead><tbody>
                        {issuedStock.map((s, i) => (<tr key={i}><td>{s.Type} ({s.Quality}) {s.ColorShadeNumber && `- ${s.ColorShadeNumber}`}</td><td>{s.WeightKg.toFixed(3)}</td><td>Rs {(s.WeightKg * s.PricePerKgAtTimeOfTransaction).toFixed(2)}</td></tr>))}
                        <tr><td colSpan="2" style={{textAlign:'right', fontWeight:'bold'}}>Total Value</td><td style={{fontWeight:'bold'}}>Rs {issuedStock.reduce((sum, s) => sum + (s.WeightKg * s.PricePerKgAtTimeOfTransaction), 0).toFixed(2)}</td></tr>
                    </tbody></table>
                    <div className="step-navigation"><button className="button-secondary" onClick={() => setStep(2)}>Back</button><button className="button" onClick={handleCreateLendingRecord}>Confirm & Create Record</button></div>
                </Card>
            )}

            <Modal isOpen={isContractorModalOpen} onClose={() => setIsContractorModalOpen(false)} title="Add New Contractor">
                <form onSubmit={handleAddNewContractor}><div className="form-group"><label>Name</label><input type="text" name="Name" value={newContractor.Name} onChange={handleNewContractorChange} required autoFocus /></div><div className="form-group"><label>Contact Info</label><input type="text" name="ContactInfo" value={newContractor.ContactInfo} onChange={handleNewContractorChange} /></div><div className="modal-footer"><button type="button" className="button-secondary" onClick={() => setIsContractorModalOpen(false)}>Cancel</button><button type="submit" className="button">Save</button></div></form>
            </Modal>
        </div>
    );
};

export default NewLending;
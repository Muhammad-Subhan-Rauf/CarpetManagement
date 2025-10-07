// Original relative path: pages/Inventory.jsx

// src/pages/Inventory.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { getStockItems, addStockItem, updateStockItem } from '../services/api';
import Card from '../components/Card';
import Modal from '../components/Modal';

const Inventory = () => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isNewStockModalOpen, setIsNewStockModalOpen] = useState(false);
  const [newStock, setNewStock] = useState({ Type: '', Quality: '', ColorShadeNumber: '', CurrentPricePerKg: '', QuantityInStockKg: '' });

  const [isAddQuantityModalOpen, setIsAddQuantityModalOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState(null);
  const [quantityToAdd, setQuantityToAdd] = useState('');

  const fetchInventory = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getStockItems();
      setInventory(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const handleNewStockChange = (e) => {
    setNewStock(prevState => ({ ...prevState, [e.target.name]: e.target.value }));
  };

  const handleAddNewStock = async (e) => {
    e.preventDefault();
    try {
      await addStockItem(newStock);
      alert('Stock item added!');
      closeModals();
      fetchInventory();
    } catch (err) {
      alert(`Error adding stock: ${err.message}`);
    }
  };

  const openAddQuantityModal = (stockItem) => {
    setSelectedStock(stockItem);
    setIsAddQuantityModalOpen(true);
  };

  const handleAddQuantity = async (e) => {
    e.preventDefault();
    const amount = parseFloat(quantityToAdd);
    if (isNaN(amount) || amount <= 0) return alert('Please enter a valid positive number.');
    try {
      await updateStockItem(selectedStock.StockID, { add_quantity: amount });
      alert('Quantity added!');
      closeModals();
      fetchInventory();
    } catch (err) {
      alert(`Error updating quantity: ${err.message}`);
    }
  };

  const closeModals = () => {
    setIsNewStockModalOpen(false);
    setIsAddQuantityModalOpen(false);
    setNewStock({ Type: '', Quality: '', ColorShadeNumber: '', CurrentPricePerKg: '', QuantityInStockKg: '' });
    setSelectedStock(null);
    setQuantityToAdd('');
  };
  
  if (loading) return <div>Loading inventory...</div>;
  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;

  return (
    <div>
      <div className="page-header-actions">
        <h1>Inventory Management</h1>
        <button onClick={() => setIsNewStockModalOpen(true)} className="button">Add New Stock Type</button>
      </div>
      <Card>
        <table className="styled-table">
          <thead>
            <tr>
              <th>Stock ID</th><th>Type</th><th>Quality</th><th>Color/Shade #</th><th>Price/Kg (Rs)</th><th>In Stock (Kg)</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {inventory.map(item => (
              <tr key={item.StockID}>
                <td>{item.StockID}</td><td>{item.Type}</td><td>{item.Quality}</td><td>{item.ColorShadeNumber || '-'}</td><td>{item.CurrentPricePerKg.toFixed(2)}</td><td>{item.QuantityInStockKg.toFixed(3)}</td>
                <td><button className="button-small" onClick={() => openAddQuantityModal(item)}>Add Quantity</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal isOpen={isNewStockModalOpen} onClose={closeModals} title="Add New Stock Type">
        <form onSubmit={handleAddNewStock}>
          <div className="form-group"><label>Stock Type*</label><input type="text" name="Type" value={newStock.Type} onChange={handleNewStockChange} required /></div>
          <div className="form-group"><label>Quality*</label><input type="text" name="Quality" value={newStock.Quality} onChange={handleNewStockChange} required /></div>
          <div className="form-group"><label>Color/Shade Number</label><input type="text" name="ColorShadeNumber" value={newStock.ColorShadeNumber} onChange={handleNewStockChange} /></div>
          <div className="form-group"><label>Price per Kg*</label><input type="number" step="0.01" name="CurrentPricePerKg" value={newStock.CurrentPricePerKg} onChange={handleNewStockChange} required /></div>
          <div className="form-group"><label>Initial Quantity*</label><input type="number" step="0.001" name="QuantityInStockKg" value={newStock.QuantityInStockKg} onChange={handleNewStockChange} required /></div>
          <div className="modal-footer"><button type="button" className="button-secondary" onClick={closeModals}>Cancel</button><button type="submit" className="button">Save Stock</button></div>
        </form>
      </Modal>

      <Modal isOpen={isAddQuantityModalOpen} onClose={closeModals} title={`Add Quantity to ${selectedStock?.Type} (${selectedStock?.Quality}) ${selectedStock?.ColorShadeNumber || ''}`}>
        <form onSubmit={handleAddQuantity}>
           <p>Current Quantity: <strong>{selectedStock?.QuantityInStockKg.toFixed(3)} kg</strong></p>
           <div className="form-group"><label>Quantity to Add (Kg)</label><input type="number" step="0.001" value={quantityToAdd} onChange={(e) => setQuantityToAdd(e.target.value)} required autoFocus /></div>
           <div className="modal-footer"><button type="button" className="button-secondary" onClick={closeModals}>Cancel</button><button type="submit" className="button">Add to Stock</button></div>
        </form>
      </Modal>
    </div>
  );
};

export default Inventory;
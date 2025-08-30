// src/pages/Contractors.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getContractors, addContractor } from '../services/api';
import Card from '../components/Card';
import Modal from '../components/Modal';

const Contractors = () => {
    const [contractors, setContractors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newContractor, setNewContractor] = useState({ Name: '', ContactInfo: '' });

    const fetchContractors = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getContractors();
            setContractors(data);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchContractors();
    }, [fetchContractors]);

    const handleInputChange = (e) => {
        setNewContractor({ ...newContractor, [e.target.name]: e.target.value });
    };

    const handleAddContractor = async (e) => {
        e.preventDefault();
        if (!newContractor.Name.trim()) return alert("Name is required.");
        try {
            await addContractor(newContractor);
            alert('Contractor added successfully!');
            setIsModalOpen(false);
            setNewContractor({ Name: '', ContactInfo: '' });
            fetchContractors(); // Refresh the list
        } catch (err) {
            alert(`Error adding contractor: ${err.message}`);
        }
    };

    if (loading) return <div>Loading contractors...</div>;
    if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;

    return (
        <div>
            <div className="page-header-actions">
                <h1>Contractors</h1>
                <button className="button" onClick={() => setIsModalOpen(true)}>Add New Contractor</button>
            </div>
            <Card>
                <table className="styled-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Contact Info</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {contractors.map(c => (
                            <tr key={c.ContractorID}>
                                <td>{c.Name}</td>
                                <td>{c.ContactInfo || '-'}</td>
                                <td>
                                    <Link to={`/contractor/${c.ContractorID}`} className="button-small">
                                        View Book
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add New Contractor">
                <form onSubmit={handleAddContractor}>
                    <div className="form-group"><label>Name*</label><input type="text" name="Name" value={newContractor.Name} onChange={handleInputChange} required autoFocus /></div>
                    <div className="form-group"><label>Contact Info</label><input type="text" name="ContactInfo" value={newContractor.ContactInfo} onChange={handleInputChange} /></div>
                    <div className="modal-footer">
                        <button type="button" className="button-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                        <button type="submit" className="button">Save</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Contractors;
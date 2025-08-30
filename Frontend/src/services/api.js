// Original relative path: src/services/api.js

// src/services/api.js

const API_BASE_URL = 'http://127.0.0.1:5001/api';

async function fetchApi(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const config = {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'An unknown error occurred' }));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    if (response.status === 204 || response.headers.get('Content-Length') === '0') {
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error(`API call to ${endpoint} failed:`, error);
    throw error;
  }
}

// Contractor APIs
export const getContractors = () => fetchApi('/contractors');
export const addContractor = (data) => fetchApi('/contractors', { method: 'POST', body: JSON.stringify(data) });
export const getContractorDetails = (contractorId) => fetchApi(`/contractors/${contractorId}`);

// Stock APIs
export const getStockItems = () => fetchApi('/stock_items');
export const addStockItem = (data) => fetchApi('/stock_items', { method: 'POST', body: JSON.stringify(data) });
export const updateStockItem = (stockId, data) => fetchApi(`/stock_items/${stockId}`, { method: 'PUT', body: JSON.stringify(data) });

// Lending Record APIs
export const getLentRecords = () => fetchApi('/lent-records');
export const getLentRecordById = (recordId) => fetchApi(`/lent-records/${recordId}`);
export const createLendingRecord = (data) => fetchApi('/lent-records', { method: 'POST', body: JSON.stringify(data) });
export const updateLentRecord = (recordId, data) => fetchApi(`/lent-records/${recordId}`, { method: 'PUT', body: JSON.stringify(data) });
export const getRecordTransactions = (recordId) => fetchApi(`/lent-records/${recordId}/transactions`);
export const getRecordFinancials = (recordId) => fetchApi(`/lent-records/${recordId}/financials`);
export const returnStock = (recordId, returned_stock) => fetchApi(`/lent-records/${recordId}/return-stock`, { method: 'POST', body: JSON.stringify({ returned_stock }) });
export const closeLendingRecord = (recordId, data) => fetchApi(`/lent-records/${recordId}/close`, { method: 'POST', body: JSON.stringify(data) });

// Payment API
export const addPayment = (data) => fetchApi(`/payments`, { method: 'POST', body: JSON.stringify(data) });
export const getPaymentsByRecord = (recordId) => fetchApi(`/lent-records/${recordId}/payments`);

// Report APIs -- NEW
export const getCurrentlyHeldStockReport = () => fetchApi('/stock-reports/currently-held');
export const getTotalIssuedHistoryReport = () => fetchApi('/stock-reports/issue-history');
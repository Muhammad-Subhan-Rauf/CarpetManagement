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

// Order APIs
// MODIFIED: Function now accepts search and filter parameters
export const getOrders = (status, designNumber = '', shadeCard = '', quality = '') => {
  const params = new URLSearchParams({
    status: status || '',
    design_number: designNumber,
    shade_card: shadeCard,
    quality: quality,
  });
  return fetchApi(`/orders?${params.toString()}`);
};
export const getOrderById = (orderId) => fetchApi(`/orders/${orderId}`);
export const createOrder = (data) => fetchApi('/orders', { method: 'POST', body: JSON.stringify(data) });
export const completeOrder = (orderId, data) => fetchApi(`/orders/${orderId}/complete`, { method: 'POST', body: JSON.stringify(data) });
export const getOrderTransactions = (orderId) => fetchApi(`/orders/${orderId}/transactions`);
export const getOrderFinancials = (orderId) => fetchApi(`/orders/${orderId}/financials`);
export const getOrderPayments = (orderId) => fetchApi(`/orders/${orderId}/payments`);

// NEW: API call for returning stock on a closed order
export const returnStockForOrder = (orderId, stock_id, weight) => fetchApi(`/orders/${orderId}/return-stock`, {
    method: 'POST',
    body: JSON.stringify({ stock_id, weight })
});


// General Payment API (not tied to a specific order/record)
// Correctly points to the dedicated /payments endpoint now
export const addGeneralPayment = (data) => fetchApi('/payments', { method: 'POST', body: JSON.stringify(data) });

// Specific Payment API for adding payment to an order
export const addPaymentToOrder = (data) => fetchApi('/payments', { method: 'POST', body: JSON.stringify(data) });
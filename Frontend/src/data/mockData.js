// This file mimics your SQL database tables.
// We'll use these arrays to power the frontend until you build your API.

export const contractors = [
  { id: 1, name: "Rajesh Kumar", contactInfo: "123-456-7890" },
  { id:2, name: "Sita Sharma", contactInfo: "987-654-3210" },
];

export const inventory = [
  { id: 1, type: "Wool", quality: "A-Grade", pricePerKg: 50.00, quantityInKg: 245.5 },
  { id: 2, type: "Silk", quality: "Mulberry", pricePerKg: 80.00, quantityInKg: 147.0 },
  { id: 3, type: "Tani", quality: "Standard", pricePerKg: 35.00, quantityInKg: 500.0 },
  { id: 4, type: "Butka", quality: "Zari Mix", pricePerKg: 120.00, quantityInKg: 75.0 },
];

export const orders = [
  {
    id: 101,
    contractorId: 1, // Rajesh Kumar
    quality: "60x60",
    size: "8x10 ft",
    designNumber: "DK-105",
    shadeCard: "552233",
    dateIssued: "2023-10-01",
    dateDue: "2023-11-01",
    dateCompleted: "2023-11-06", // 5 days late
    penaltyPerDay: 5.00,
    amountPaid: 100.00,
  },
  {
    id: 102,
    contractorId: 2, // Sita Sharma
    quality: "50x50",
    size: "5x8 ft",
    designNumber: "SS-021",
    shadeCard: "112255",
    dateIssued: "2023-10-15",
    dateDue: "2023-11-15",
    dateCompleted: "2023-11-14", // On time
    penaltyPerDay: 10.00,
    amountPaid: 0.00,
  },
];

export const orderTransactions = [
  // Transactions for Order 101 (Rajesh Kumar's Carpet)
  { transactionId: 1, orderId: 101, stockId: 1, type: 'Issued', weightKg: 5.0, priceAtTransaction: 50.00 },
  { transactionId: 2, orderId: 101, stockId: 2, type: 'Issued', weightKg: 5.0, priceAtTransaction: 80.00 },
  { transactionId: 3, orderId: 101, stockId: 2, type: 'Returned', weightKg: 3.0, priceAtTransaction: 80.00 },

  // Transactions for Order 102 (Sita Sharma's Carpet)
  { transactionId: 4, orderId: 102, stockId: 1, type: 'Issued', weightKg: 3.0, priceAtTransaction: 50.00 },
  { transactionId: 5, orderId: 102, stockId: 3, type: 'Issued', weightKg: 4.0, priceAtTransaction: 35.00 },
];
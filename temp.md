### **Question 1: Access Link Utilization**

**a) Without Web Cache:**

The access link utilization is **1.067**.

*   **Calculation:** `(18 requests/sec * 115,000 bits/request) / 1,940,000 bits/sec = 1.067`

**b) With 35% Web Cache Hit Rate:**

The access link utilization is **0.6935**.

*   **Calculation:** `(18 requests/sec * (1 - 0.35) * 115,000 bits/request) / 1,940,000 bits/sec = 0.6935`

---

### **Question 2: File Distribution Time**

The following table shows the minimum distribution times in **seconds**.

| N (Peers) | u (Peer Upload Rate) | Client-Server Time (s) | P2P Time (s) |
| :--- | :--- | :--- | :--- |
| **1** | 1, 2, or 5 Mbps | 4,000 | 4,000 |
| **50** | 1 Mbps | 60,000 | 17,143 |
| | 2 Mbps | 60,000 | 10,000 |
| | 5 Mbps | 60,000 | 4,444 |
| **100** | 1 Mbps | 120,000 | 20,000 |
| | 2 Mbps | 120,000 | 10,909 |
| | 5 Mbps | 120,000 | 4,615 |
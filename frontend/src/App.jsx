import { useState, useEffect } from 'react';

export default function App() {
  const [receipts, setReceipts] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  
  const [formData, setFormData] = useState({
    type: 'buy', 
    total: '',
    rate_type: 19,
    description: '',
    comment: '', // --- NEW: Added comment to state ---
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetch('http://localhost:5000/api/receipts')
      .then(res => res.json())
      .then(data => setReceipts(data))
      .catch(err => console.error("Make sure Python is running!", err));
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsScanning(true);
    const formDataToSend = new FormData();
    formDataToSend.append('file', file);

    try {
      const response = await fetch('http://localhost:5000/api/upload', {
        method: 'POST',
        body: formDataToSend,
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setFormData({
          ...formData,
          type: 'buy', 
          total: data.total,
          rate_type: data.rate_type,
          date: data.date,
          description: data.description,
          comment: '' // Leaves the comment blank so she can type the shop name manually
        });
      } else {
        alert('Scan failed: ' + data.error);
      }
    } catch (error) {
      alert('Error connecting to scanner. Is the Python terminal running?');
    }
    setIsScanning(false);
    e.target.value = ''; 
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const response = await fetch('http://localhost:5000/api/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    const newReceipt = await response.json();
    if (response.ok) {
      setReceipts([...receipts, newReceipt]);
      // --- NEW: Resets the comment box after saving ---
      setFormData({ ...formData, total: '', description: '', comment: '' }); 
    }
  };

  const handleExport = () => {
    fetch('http://localhost:5000/api/export')
      .then(res => res.json())
      .then(data => alert(data.message || data.error));
  };

  const taxCollected = receipts.filter(r => r.type === 'sell').reduce((sum, r) => sum + r.tax_amount, 0);
  const taxPaid = receipts.filter(r => r.type === 'buy').reduce((sum, r) => sum + r.tax_amount, 0);
  const finalTaxDue = taxCollected - taxPaid;

  return (
    <div style={{ padding: '24px', fontFamily: 'Arial, sans-serif', maxWidth: '1400px', margin: '0 auto', color: 'white' }}>
      <h2>Dad's Business Tax Dashboard</h2>
      
      <div style={{ display: 'flex', gap: '20px', marginBottom: '24px' }}>
        <div style={{ padding: '16px', border: '1px solid #444', borderRadius: '8px', flex: 1, backgroundColor: '#1e293b' }}>
          <h3 style={{ fontSize: '16px', color: '#94a3b8' }}>Tax Collected from Sales</h3>
          <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#f87171' }}>+ {taxCollected.toFixed(2)} €</p>
        </div>
        <div style={{ padding: '16px', border: '1px solid #444', borderRadius: '8px', flex: 1, backgroundColor: '#1e293b' }}>
          <h3 style={{ fontSize: '16px', color: '#94a3b8' }}>Tax Paid on Buys</h3>
          <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#60a5fa' }}>- {taxPaid.toFixed(2)} €</p>
        </div>
        <div style={{ padding: '16px', border: '2px solid #4ade80', borderRadius: '8px', flex: 1, backgroundColor: '#14532d' }}>
          <h3 style={{ fontSize: '16px', color: '#4ade80' }}>Final Tax He Gotta Pay</h3>
          <p style={{ fontSize: '28px', fontWeight: 'bold', color: 'white' }}>{finalTaxDue.toFixed(2)} €</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2.5fr', gap: '24px' }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div style={{ padding: '16px', border: '1px dashed #666', borderRadius: '8px', backgroundColor: '#222' }}>
            <h3>📷 Auto-Scan Receipt</h3>
            <input type="file" accept="image/*,application/pdf" onChange={handleFileUpload} style={{ marginTop: '8px' }} />
            {isScanning && <p style={{ color: '#60a5fa', marginTop: '8px', fontWeight: 'bold' }}>Scanning image... hold up.</p>}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', border: '1px solid #444', borderRadius: '8px', backgroundColor: '#222' }}>
            <h3>Log New Transaction</h3>

            <label style={{ fontWeight: 'bold', color: '#fbbf24' }}>Transaction Type</label>
            <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} style={{ padding: '8px', border: '2px solid #fbbf24', backgroundColor: '#333', color: 'white', borderRadius: '4px' }}>
              <option value="buy">BUYING (Business Supply)</option>
              <option value="sell">SELLING (Customer Payment)</option>
            </select>

            <label>Date</label>
            <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required style={{ padding: '8px', borderRadius: '4px', border: 'none' }}/>
            
            <label>Description</label>
            <input type="text" value={formData.description} placeholder="What was it?" onChange={e => setFormData({...formData, description: e.target.value})} required style={{ padding: '8px', borderRadius: '4px', border: 'none' }}/>
            
            {/* --- NEW: SHOP / COMMENT INPUT --- */}
            <label>Shop / Comment (Optional)</label>
            <input type="text" value={formData.comment} placeholder="e.g., Aldi, Amazon..." onChange={e => setFormData({...formData, comment: e.target.value})} style={{ padding: '8px', borderRadius: '4px', border: 'none' }}/>

            <label>Total Amount (€)</label>
            <input type="number" step="0.01" value={formData.total} placeholder="0.00" onChange={e => setFormData({...formData, total: e.target.value})} required style={{ padding: '8px', borderRadius: '4px', border: 'none' }}/>
            
            <label>Tax Rate</label>
            <select value={formData.rate_type} onChange={e => setFormData({...formData, rate_type: parseInt(e.target.value)})} style={{ padding: '8px', borderRadius: '4px', border: 'none' }}>
              <option value={19}>Standard (19%)</option>
              <option value={7}>Water Only (7%)</option>
            </select>
            
            <button type="submit" style={{ padding: '12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', marginTop: '8px' }}>
              Calculate & Save
            </button>
          </form>
        </div>

        <div style={{ border: '1px solid #444', borderRadius: '8px', padding: '16px', backgroundColor: '#222', height: 'fit-content', overflowX: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3>Logged Items</h3>
            <button onClick={handleExport} style={{ padding: '8px 12px', background: '#22c55e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Export to Excel</button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #555' }}>
                <th style={{ padding: '8px' }}>Type</th>
                <th style={{ padding: '8px' }}>Date</th>
                <th style={{ padding: '8px' }}>Item</th>
                
                {/* --- NEW: TABLE HEADER --- */}
                <th style={{ padding: '8px' }}>Shop / Comment</th>

                <th style={{ padding: '8px' }}>Gross (€)</th>
                <th style={{ padding: '8px' }}>Net (€)</th>
                <th style={{ padding: '8px' }}>Tax Rate</th>
                <th style={{ padding: '8px' }}>Tax (€)</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid #444', backgroundColor: r.type === 'sell' ? '#451a1a' : '#172554' }}>
                  <td style={{ padding: '8px', fontWeight: 'bold', color: r.type === 'sell' ? '#f87171' : '#60a5fa' }}>
                    {r.type.toUpperCase()}
                  </td>
                  <td style={{ padding: '8px' }}>{r.date}</td>
                  <td style={{ padding: '8px' }}>{r.description}</td>
                  
                  {/* --- NEW: TABLE DATA --- */}
                  <td style={{ padding: '8px', fontStyle: 'italic', color: '#ccc' }}>{r.comment || '-'}</td>
                  
                  <td style={{ padding: '8px' }}>{r.total.toFixed(2)}</td>
                  <td style={{ padding: '8px', color: '#aaa' }}>{r.net.toFixed(2)}</td>
                  <td style={{ padding: '8px' }}>{r.tax_rate}%</td>
                  <td style={{ padding: '8px', fontWeight: 'bold' }}>{r.tax_amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
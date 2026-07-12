fetch('https://qrin.web.id/api/create-transaksi', { 
  method: 'POST', 
  headers: { 'Content-Type': 'application/json' }, 
  body: JSON.stringify({ 
    token_qrin: 'dummy_token_123456789', 
    payment_method: 'qris', 
    request_payload: { no_ref_merchant: 'INV-123', amount_value: 10000, amount_currency: 'IDR', product_details: '["Test"]', validity: '60' } 
  }) 
}).then(r=>r.json()).then(console.log);

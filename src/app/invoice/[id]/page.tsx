import { prisma } from '@/server/db/client';
import { notFound } from 'next/navigation';
import PrintButton from './PrintButton';
import Link from 'next/link';

export const metadata = {
  title: 'Invoice',
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
}

export default async function PublicInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const rawInvoice = await prisma.invoice.findUnique({
    where: { invoiceNumber: id },
    include: {
      user: {
        include: { profile: true, area: true }
      },
      payments: { take: 1 },
      manualPayments: { take: 1 },
    }
  });

  if (!rawInvoice) notFound();

  const companyRaw = await prisma.company.findFirst();

  // Create inv object mimicking the API response
  const inv: any = {};
  
  inv.company = {
    name: companyRaw?.name || 'EugineBill',
    address: companyRaw?.address || '',
    phone: companyRaw?.phone || '',
    email: companyRaw?.email || '',
    logo: companyRaw?.logo || '',
    poweredBy: 'EugineBill',
    bankAccounts: (() => {
      try {
        if (!companyRaw?.bankAccounts) return [];
        const raw = companyRaw.bankAccounts as any;
        return (Array.isArray(raw) ? raw : JSON.parse(raw));
      } catch { return []; }
    })()
  };

  inv.customer = {
    name: rawInvoice.user?.name || 'Pelanggan',
    customerId: rawInvoice.user?.customerId || '',
    phone: rawInvoice.user?.phone || '',
    address: rawInvoice.user?.address || '',
  };

  const paidVia = (() => {
    if (!rawInvoice.paidAt) return null;
    if (rawInvoice.payments?.length > 0) return 'gateway';
    if (rawInvoice.manualPayments?.length > 0) return 'transfer';
    return 'admin';
  })();

  inv.invoice = {
    number: rawInvoice.invoiceNumber,
    date: new Date(rawInvoice.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }),
    dueDate: new Date(rawInvoice.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }),
    paidAt: rawInvoice.paidAt ? new Date(rawInvoice.paidAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }) : null,
    status: rawInvoice.status,
  };

  inv.paidVia = paidVia;
  inv.paymentLink = rawInvoice.paymentLink || (rawInvoice.paymentToken ? `/pay/${rawInvoice.paymentToken}` : '');

  const baseAmt = rawInvoice.baseAmount ?? rawInvoice.amount;
  const taxRateNum = rawInvoice.taxRate ? Number(rawInvoice.taxRate) : 0;
  const taxAmt = taxRateNum > 0 ? rawInvoice.amount - baseAmt : 0;

  inv.tax = {
    hasTax: taxRateNum > 0,
    taxRate: taxRateNum,
    baseAmount: baseAmt,
    taxAmount: taxAmt
  };

  let items = [];
  if (rawInvoice.type === 'INSTALLATION') {
    items.push({ description: 'Biaya Pemasangan', quantity: 1, price: rawInvoice.amount, total: rawInvoice.amount });
  } else if (rawInvoice.type === 'TOPUP') {
    items.push({ description: 'Top Up Saldo', quantity: 1, price: rawInvoice.amount, total: rawInvoice.amount });
  } else {
    items.push({ 
      description: `Langganan Internet (${new Date(rawInvoice.dueDate).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}) - ${rawInvoice.user?.profile?.name || 'Paket Internet'}`, 
      quantity: 1, 
      price: baseAmt, 
      total: baseAmt 
    });
  }

  inv.items = items;

  inv.additionalFees = (() => {
    try {
      if (!rawInvoice.additionalFees) return [];
      const raw = rawInvoice.additionalFees as any;
      return (Array.isArray(raw) ? raw : JSON.parse(raw));
    } catch { return []; }
  })();

  inv.amountFormatted = formatCurrency(rawInvoice.amount);

  const fmtCurr = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        * { box-sizing: border-box; }
        body { font-family: "Inter", "Segoe UI", Arial, sans-serif; font-size: 12px; color: #1e293b; margin: 0; padding: 24px 24px 80px; background: #f8fafc; }
        .sheet { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.04); max-width: 900px; margin: 0 auto; }
        .topbar { height: 6px; background: linear-gradient(90deg, #3b82f6, #60a5fa, #93c5fd); }
        .content { padding: 40px 48px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; gap: 24px; }
        .brand-wrap { display: flex; align-items: center; gap: 16px; flex: 1; min-width: 0; }
        .header-right { text-align: right; flex-shrink: 0; }
        .logo-box { flex-shrink: 0; width: 72px; height: 72px; border-radius: 12px; background: #fff; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; padding: 8px; overflow: hidden; }
        .company-name { font-size: 20px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
        .company-sub { color: #64748b; font-size: 12px; line-height: 1.5; }
        .inv-title { font-size: 28px; font-weight: 800; color: #0f172a; letter-spacing: 1.5px; line-height: 1.2; margin-bottom: 8px; }
        .inv-number { font-size: 14px; font-weight: 600; color: #3b82f6; margin-bottom: 12px; }
        .status-badge { display: inline-block; padding: 6px 14px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
        .paid-badge { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
        .pending-badge { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
        .divider { border: none; border-top: 1px solid #e2e8f0; margin: 24px 0; }
        .thin-divider { border: none; border-top: 1px dashed #e2e8f0; margin: 16px 0; }
        .section-title { font-weight: 700; font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
        .bill-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px; }
        .meta-card { background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 12px; padding: 20px; }
        .info-row { margin-bottom: 6px; }
        .info-label { color: #64748b; font-weight: 500; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
        th { background: #f8fafc; color: #475569; padding: 12px 16px; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e2e8f0; }
        td { padding: 14px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #334155; }
        .td-right { text-align: right; }
        .total-row td { font-weight: 700; font-size: 15px; color: #0f172a; background: #f8fafc; border-top: 2px solid #cbd5e1; }
        .actions-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 32px 0 16px; }
        .payment-card { padding: 24px; border-radius: 16px; border: 1px solid #e2e8f0; background: #fff; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03); }
        .payment-card-title { font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
        .payment-link { display: block; margin-top: 16px; padding: 14px 20px; border-radius: 8px; background: #f8fafc; border: 1px solid #e2e8f0; color: #334155; text-decoration: none; font-size: 13px; font-family: monospace; word-break: break-all; transition: all 0.2s; }
        .payment-link:hover { border-color: #cbd5e1; background: #f1f5f9; }
        .payment-cta { display: inline-flex; align-items: center; justify-content: center; width: 100%; margin-top: 16px; padding: 14px 24px; border-radius: 8px; background: #0f172a; color: #fff; text-decoration: none; font-size: 14px; font-weight: 600; transition: background 0.2s; }
        .payment-cta:hover { background: #1e293b; }
        .paid-stamp { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px 32px; border: 3px solid #22c55e; border-radius: 16px; text-align: center; width: fit-content; margin: 0 auto; background: #f0fdf4; }
        .paid-stamp-text { font-size: 24px; font-weight: 800; color: #16a34a; letter-spacing: 4px; }
        .paid-stamp-sub { font-size: 12px; color: #15803d; font-weight: 500; margin-top: 6px; }
        .footer { margin-top: 48px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #f1f5f9; padding-top: 24px; }
        .action-bar { position: fixed; bottom: 0; left: 0; right: 0; display: flex; gap: 16px; padding: 20px 32px; background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(12px); border-top: 1px solid #e2e8f0; box-shadow: 0 -4px 30px rgba(0,0,0,0.06); z-index: 100; justify-content: center; }
        .action-bar-inner { display: flex; gap: 16px; width: 100%; max-width: 900px; }
        .btn-print { flex: 1; padding: 14px; background: #fff; color: #0f172a; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
        .btn-print:hover { background: #f8fafc; border-color: #94a3b8; }
        .btn-pay { flex: 1; padding: 14px; background: #3b82f6; color: #fff; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; text-decoration: none; text-align: center; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); }
        .btn-pay:hover { background: #2563eb; transform: translateY(-1px); box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4); }
        
        @media print {
          @page { size: A4; margin: 10mm; }
          html, body { width: 100% !important; max-width: 100% !important; margin: 0 !important; padding: 0 !important; }
          body { background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .topbar { display: none !important; }
          .sheet { border: none !important; border-radius: 0 !important; box-shadow: none !important; overflow: visible !important; max-width: 100% !important; width: 100% !important; margin: 0 !important; }
          .content { padding: 6mm 8mm !important; }
          .header-right { padding-top: 0 !important; overflow: visible !important; }
          .inv-title { overflow: visible !important; padding-top: 0 !important; line-height: 1.3 !important; }
          .inv-number { overflow: visible !important; line-height: 1.4 !important; }
          .inv-title { font-size: 20px; }
          .inv-number { font-size: 12px; }
          .bill-grid { grid-template-columns: 1fr; gap: 12px; margin-bottom: 20px; }
          .meta-card { padding: 12px 14px; border-radius: 8px; border: 1px solid #e2e8f0; background: #f8fafc; }
          .actions-grid { display: block; margin: 0; }
          .payment-card { display: none; }
          table { font-size: 11px; margin-bottom: 20px; }
          th, td { padding: 8px 10px; }
          .paid-stamp-text { font-size: 20px; }
          .paid-stamp { padding: 12px 24px; border-width: 2px; }
        }
        @media (max-width: 640px) {
          body { padding: 12px 12px 100px !important; }
          .sheet { border-radius: 12px !important; }
          .content { padding: 24px !important; }
          .header { flex-direction: column; gap: 16px; }
          .header-right { text-align: left; }
          .inv-title { font-size: 24px; }
          .bill-grid { grid-template-columns: 1fr; gap: 16px; }
          .actions-grid { grid-template-columns: 1fr; gap: 16px; }
          .action-bar { padding: 16px; max-width: 100%; }
        }
      ` }} />
      <div className="sheet">
        <div className="topbar"></div>
        <div className="content">
          <div className="header">
            <div className="brand-wrap">
              {inv.company.logo && <div className="logo-box"><img src={inv.company.logo} style={{maxHeight: '58px', maxWidth: '58px', width: 'auto', objectFit: 'contain'}} alt="Logo" /></div>}
              <div>
                <div className="company-name">{inv.company.name}</div>
                <div className="company-sub">
                  {inv.company.address && <><span dangerouslySetInnerHTML={{__html: inv.company.address}} /><br/></>}
                  {inv.company.phone && <>Telp: {inv.company.phone}<br/></>}
                  {inv.company.email}
                </div>
              </div>
            </div>
            <div className="header-right">
              <div className="inv-title">INVOICE</div>
              <div className="inv-number">{inv.invoice.number}</div>
              <div>
                {inv.invoice.status === 'PAID' ? 
                  <span className="status-badge paid-badge">&#10003; SUDAH BAYAR</span> : 
                  <span className="status-badge pending-badge">BELUM BAYAR</span>
                }
              </div>
            </div>
          </div>
          <hr className="divider" />
          
          <div className="bill-grid">
            <div className="meta-card">
              <div className="section-title">Dari</div>
              <div className="info-row"><strong>{inv.company.name}</strong></div>
              {inv.company.address && <div className="info-row">{inv.company.address}</div>}
              {inv.company.phone && <div className="info-row">Telp: {inv.company.phone}</div>}
            </div>
            <div className="meta-card">
              <div className="section-title">Kepada</div>
              <div className="info-row"><strong>{inv.customer.name}</strong></div>
              {inv.customer.customerId && <div className="info-row"><span className="info-label">ID Pelanggan: </span>{inv.customer.customerId}</div>}
              {inv.customer.phone && <div className="info-row"><span className="info-label">Telp: </span>{inv.customer.phone}</div>}
              {inv.customer.address && <div className="info-row"><span className="info-label">Alamat: </span>{inv.customer.address}</div>}
            </div>
          </div>

          <div className="bill-grid">
            <div className="meta-card">
              <div className="section-title">Detail Invoice</div>
              <div className="info-row"><span className="info-label">No Invoice: </span><strong>{inv.invoice.number}</strong></div>
              <div className="info-row"><span className="info-label">Tanggal: </span>{inv.invoice.date}</div>
              <div className="info-row"><span className="info-label">Jatuh Tempo: </span>{inv.invoice.dueDate}</div>
              {inv.invoice.paidAt && <div className="info-row"><span className="info-label">Tgl Bayar: </span>{inv.invoice.paidAt}</div>}
            </div>
            <div className="meta-card">
              <div className="section-title">Status Pembayaran</div>
              <div className="info-row"><span className="info-label">Status: </span><strong>{inv.invoice.status === 'PAID' ? '✓ LUNAS' : inv.invoice.status === 'OVERDUE' ? '⚠️ TERLAMBAT' : '⏳ BELUM BAYAR'}</strong></div>
              {inv.invoice.paidAt && (
                <>
                  <div className="info-row"><span className="info-label">Dibayar pada: </span>{inv.invoice.paidAt}</div>
                  <div className="info-row"><span className="info-label">Via: </span>{inv.paidVia === 'gateway' ? 'Payment Gateway' : inv.paidVia === 'transfer' ? 'Transfer Manual' : 'Dikonfirmasi Admin'}</div>
                </>
              )}
            </div>
          </div>

          <div className="section-title">Rincian Layanan</div>
          <table>
            <thead><tr><th>Deskripsi</th><th style={{width:'60px',textAlign:'center'}}>Qty</th><th style={{width:'130px',textAlign:'right'}}>Harga</th><th style={{width:'130px',textAlign:'right'}}>Total</th></tr></thead>
            <tbody>
              {inv.items.map((item: any, i: number) => (
                <tr key={i}><td>{item.description}</td><td style={{textAlign:'center'}}>{item.quantity}</td><td className="td-right">{fmtCurr(item.price)}</td><td className="td-right">{fmtCurr(item.total)}</td></tr>
              ))}
              {inv.additionalFees && inv.additionalFees.map((fee: any, i: number) => (
                <tr key={'fee'+i}><td>{fee.name}</td><td style={{textAlign:'center'}}>1</td><td className="td-right">{fmtCurr(fee.amount)}</td><td className="td-right">{fmtCurr(fee.amount)}</td></tr>
              ))}
              {inv.tax.hasTax && (
                <>
                  <tr style={{background:'#f9fafb'}}><td colSpan={3} style={{textAlign:'right',fontSize:'11px',color:'#555',padding:'5px 10px'}}>Subtotal</td><td className="td-right" style={{color:'#555',fontSize:'11px',padding:'5px 10px'}}>{fmtCurr(inv.tax.baseAmount)}</td></tr>
                  <tr style={{background:'#fffbeb'}}><td colSpan={3} style={{textAlign:'right',fontSize:'11px',color:'#d97706',padding:'5px 10px'}}>PPN {inv.tax.taxRate}%</td><td className="td-right" style={{color:'#d97706',fontSize:'11px',padding:'5px 10px'}}>{fmtCurr(inv.tax.taxAmount)}</td></tr>
                </>
              )}
              <tr className="total-row"><td colSpan={3} className="td-right">TOTAL</td><td className="td-right">{inv.amountFormatted}</td></tr>
            </tbody>
          </table>

          {!inv.invoice.paidAt && inv.paymentLink && (
            <div className="actions-grid">
              <div className="payment-card">
                <div className="payment-card-title">Link Pembayaran Online</div>
                <p className="payment-note">Pelanggan dapat membuka link berikut untuk melakukan pembayaran langsung.</p>
                <Link className="payment-cta" href={inv.paymentLink}>Buka Halaman Bayar</Link>
              </div>
              <div className="payment-card">
                <div className="payment-card-title">Petunjuk Pembayaran</div>
                <p className="payment-note">Gunakan link pembayaran online di samping atau transfer manual ke rekening perusahaan di bawah.</p>
              </div>
            </div>
          )}

          {inv.invoice.paidAt ? (
            <div className="paid-stamp"><div className="paid-stamp-text">LUNAS</div><div className="paid-stamp-sub">Dibayar pada {inv.invoice.paidAt}</div></div>
          ) : (
            inv.company.bankAccounts && inv.company.bankAccounts.length > 0 && (
              <div style={{margin:'18px 0',padding:'16px',border:'1px solid #6ee7b7',borderRadius:'8px',background:'#f0fdfa'}}>
                <div className="section-title" style={{marginBottom:'10px'}}>Pembayaran Manual</div>
                <p style={{margin:'0 0 12px',fontSize:'11px',color:'#555'}}>Transfer ke salah satu rekening berikut sebelum jatuh tempo:</p>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))',gap:'10px'}}>
                  {inv.company.bankAccounts.map((ba: any, i: number) => (
                    <div key={i} style={{border:'1px solid #0d948840',borderRadius:'8px',padding:'10px 14px',background:'#fff'}}>
                      <div style={{fontWeight:'bold',fontSize:'12px',color:'#0d9488',marginBottom:'4px'}}>{ba.bankName}</div>
                      <div style={{fontSize:'14px',fontWeight:'bold',letterSpacing:'1px'}}>{ba.accountNumber}</div>
                      <div style={{fontSize:'11px',color:'#555',marginTop:'2px'}}>a/n {ba.accountName}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}

          <div className="footer">Terima kasih atas kepercayaan Anda &mdash; {inv.company.name}</div>
        </div>
      </div>
      
      <div className="action-bar no-print flex justify-center w-full bg-white border-t border-gray-200 p-4 fixed bottom-0 left-0 gap-3 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] z-[100]">
        <Link href="/" className="px-6 py-2.5 rounded-xl border border-gray-300 font-bold text-gray-700 bg-white hover:bg-gray-50 flex items-center gap-2">
          Kembali
        </Link>
        <PrintButton />
      </div>
      <div className="h-24 print:hidden"></div>
    </>
  );
}

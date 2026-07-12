import fs
import re

def main():
    admin_path = 'src/app/admin/invoices/page.tsx'
    with open(admin_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    start_str = "win.document.write(`<!DOCTYPE html><html><head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"><title>Invoice ${inv.invoice.number}</title>"
    start_idx = content.find(start_str)
    if start_idx == -1:
        print("Not found")
        return
        
    start_idx += len(start_str)
    end_idx = content.find("</body></html>`);", start_idx)
    html_content = content[start_idx:end_idx]
    
    # Extract style block
    style_start = html_content.find("<style>") + len("<style>")
    style_end = html_content.find("</style>")
    style_block = html_content[style_start:style_end].strip()
    
    # Replace body padding
    style_block = style_block.replace("body { font-family: \"Segoe UI\", Arial, sans-serif; font-size: 11px; color: #1f2937; margin: 0; padding: 24px 24px 80px; background: #f8fafc; }", "body { font-family: \"Segoe UI\", Arial, sans-serif; font-size: 11px; color: #1f2937; margin: 0; padding: 24px 24px 80px; background: #f8fafc; }")
    
    # Wrap it nicely in next.js format
    new_page = f"""import {{ prisma }} from '@/server/db/client';
import {{ notFound }} from 'next/navigation';
import PrintButton from './PrintButton';
import Link from 'next/link';
import {{ ExternalLink }} from 'lucide-react';

export const metadata = {{
  title: 'Invoice',
}};

function formatCurrency(amount: number) {{
  return new Intl.NumberFormat('id-ID', {{ style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }}).format(amount);
}}

export default async function PublicInvoicePage({{ params }}: {{ params: Promise<{{ id: string }}> }}) {{
  const {{ id }} = await params;
  
  const rawInvoice = await prisma.invoice.findUnique({{
    where: {{ invoiceNumber: id }},
    include: {{
      user: {{
        include: {{ profile: true, area: true }}
      }},
      payments: {{ take: 1 }},
      manualPayments: {{ take: 1 }},
    }}
  }});

  if (!rawInvoice) notFound();

  const companyRaw = await prisma.company.findFirst();

  // Create inv object mimicking the API response
  const inv: any = {{}};
  
  inv.company = {{
    name: companyRaw?.name || 'EugineBill',
    address: companyRaw?.address || '',
    phone: companyRaw?.phone || '',
    email: companyRaw?.email || '',
    logo: companyRaw?.logo || '',
    poweredBy: 'EugineBill',
    bankAccounts: (() => {{
      try {{
        if (!companyRaw?.bankAccounts) return [];
        const raw = companyRaw.bankAccounts as any;
        return (Array.isArray(raw) ? raw : JSON.parse(raw));
      }} catch {{ return []; }}
    }})()
  }};

  inv.customer = {{
    name: rawInvoice.user?.name || 'Pelanggan',
    customerId: rawInvoice.user?.customerId || '',
    phone: rawInvoice.user?.phone || '',
    username: rawInvoice.user?.username || '',
    area: rawInvoice.user?.area?.name || '',
  }};

  const paidVia = (() => {{
    if (!rawInvoice.paidAt) return null;
    if (rawInvoice.payments?.length > 0) return 'gateway';
    if (rawInvoice.manualPayments?.length > 0) return 'transfer';
    return 'admin';
  }})();

  inv.invoice = {{
    number: rawInvoice.invoiceNumber,
    date: new Date(rawInvoice.createdAt).toLocaleDateString('id-ID', {{ day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }}),
    dueDate: new Date(rawInvoice.dueDate).toLocaleDateString('id-ID', {{ day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }}),
    paidAt: rawInvoice.paidAt ? new Date(rawInvoice.paidAt).toLocaleDateString('id-ID', {{ day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }}) : null,
    status: rawInvoice.status,
  }};

  inv.paidVia = paidVia;
  inv.paymentLink = rawInvoice.paymentToken ? `/pay-manual?token=${{rawInvoice.paymentToken}}` : '';

  const baseAmt = rawInvoice.baseAmount ?? rawInvoice.amount;
  const taxRateNum = rawInvoice.taxRate ? Number(rawInvoice.taxRate) : 0;
  const taxAmt = taxRateNum > 0 ? rawInvoice.amount - baseAmt : 0;

  inv.tax = {{
    hasTax: taxRateNum > 0,
    taxRate: taxRateNum,
    baseAmount: baseAmt,
    taxAmount: taxAmt
  }};

  let items = [];
  if (rawInvoice.type === 'INSTALLATION') {{
    items.push({{ description: 'Biaya Pemasangan', quantity: 1, price: rawInvoice.amount, total: rawInvoice.amount }});
  }} else if (rawInvoice.type === 'TOPUP') {{
    items.push({{ description: 'Top Up Saldo', quantity: 1, price: rawInvoice.amount, total: rawInvoice.amount }});
  }} else {{
    items.push({{ 
      description: `Langganan Internet (${{new Date(rawInvoice.dueDate).toLocaleDateString('id-ID', {{ month: 'long', year: 'numeric' }})}}) - ${{rawInvoice.user?.profile?.name || 'Paket Internet'}}`, 
      quantity: 1, 
      price: baseAmt, 
      total: baseAmt 
    }});
  }}

  inv.items = items;

  inv.additionalFees = (() => {{
    try {{
      if (!rawInvoice.additionalFees) return [];
      const raw = rawInvoice.additionalFees as any;
      return (Array.isArray(raw) ? raw : JSON.parse(raw));
    }} catch {{ return []; }}
  }})();

  inv.amountFormatted = formatCurrency(rawInvoice.amount);

  const fmtCurr = (n: number) => new Intl.NumberFormat('id-ID', {{ style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }}).format(n);

  return (
    <>
      <style dangerouslySetInnerHTML={{{{ __html: `{style_block}` }}}} />
      <div className="sheet">
        <div className="topbar"></div>
        <div className="content">
          <div className="header">
            <div className="brand-wrap">
              {{inv.company.logo && <div className="logo-box"><img src={{inv.company.logo}} style={{{{maxHeight: '58px', maxWidth: '58px', width: 'auto', objectFit: 'contain'}}}} alt="Logo" /></div>}}
              <div>
                <div className="company-name">{{inv.company.name}}</div>
                <div className="company-sub">
                  {{inv.company.address && <><span dangerouslySetInnerHTML={{{{__html: inv.company.address}}}} /><br/></>}}
                  {{inv.company.phone && <>Telp: {{inv.company.phone}}<br/></>}}
                  {{inv.company.email}}
                </div>
              </div>
            </div>
            <div className="header-right">
              <div className="inv-title">INVOICE</div>
              <div className="inv-number">{{inv.invoice.number}}</div>
              <div>
                {{inv.invoice.status === 'PAID' ? 
                  <span className="status-badge paid-badge">&#10003; SUDAH BAYAR</span> : 
                  <span className="status-badge pending-badge">BELUM BAYAR</span>
                }}
              </div>
            </div>
          </div>
          <hr className="divider" />
          
          <div className="bill-grid">
            <div className="meta-card">
              <div className="section-title">Dari</div>
              <div className="info-row"><strong>{{inv.company.name}}</strong></div>
              {{inv.company.address && <div className="info-row">{{inv.company.address}}</div>}}
              {{inv.company.phone && <div className="info-row">Telp: {{inv.company.phone}}</div>}}
            </div>
            <div className="meta-card">
              <div className="section-title">Kepada</div>
              <div className="info-row"><strong>{{inv.customer.name}}</strong></div>
              {{inv.customer.customerId && <div className="info-row"><span className="info-label">ID Pelanggan: </span>{{inv.customer.customerId}}</div>}}
              {{inv.customer.phone && <div className="info-row"><span className="info-label">Telp: </span>{{inv.customer.phone}}</div>}}
              {{inv.customer.username && <div className="info-row"><span className="info-label">Username: </span>{{inv.customer.username}}</div>}}
              {{inv.customer.area && <div className="info-row"><span className="info-label">Area: </span>{{inv.customer.area}}</div>}}
            </div>
          </div>

          <div className="bill-grid">
            <div className="meta-card">
              <div className="section-title">Detail Invoice</div>
              <div className="info-row"><span className="info-label">No Invoice: </span><strong>{{inv.invoice.number}}</strong></div>
              <div className="info-row"><span className="info-label">Tanggal: </span>{{inv.invoice.date}}</div>
              <div className="info-row"><span className="info-label">Jatuh Tempo: </span>{{inv.invoice.dueDate}}</div>
              {{inv.invoice.paidAt && <div className="info-row"><span className="info-label">Tgl Bayar: </span>{{inv.invoice.paidAt}}</div>}}
            </div>
            <div className="meta-card">
              <div className="section-title">Status Pembayaran</div>
              <div className="info-row"><span className="info-label">Status: </span><strong>{{inv.invoice.status === 'PAID' ? '✓ LUNAS' : inv.invoice.status === 'OVERDUE' ? '⚠️ TERLAMBAT' : '⏳ BELUM BAYAR'}}</strong></div>
              {{inv.invoice.paidAt && (
                <>
                  <div className="info-row"><span className="info-label">Dibayar pada: </span>{{inv.invoice.paidAt}}</div>
                  <div className="info-row"><span className="info-label">Via: </span>{{inv.paidVia === 'gateway' ? 'Payment Gateway' : inv.paidVia === 'transfer' ? 'Transfer Manual' : 'Dikonfirmasi Admin'}}</div>
                </>
              )}}
            </div>
          </div>

          <div className="section-title">Rincian Layanan</div>
          <table>
            <thead><tr><th>Deskripsi</th><th style={{{{width:'60px',textAlign:'center'}}}}>Qty</th><th style={{{{width:'130px',textAlign:'right'}}}}>Harga</th><th style={{{{width:'130px',textAlign:'right'}}}}>Total</th></tr></thead>
            <tbody>
              {{inv.items.map((item: any, i: number) => (
                <tr key={{i}}><td>{{item.description}}</td><td style={{{{textAlign:'center'}}}}>{{item.quantity}}</td><td className="td-right">{{fmtCurr(item.price)}}</td><td className="td-right">{{fmtCurr(item.total)}}</td></tr>
              ))}}
              {{inv.additionalFees && inv.additionalFees.map((fee: any, i: number) => (
                <tr key={{'fee'+i}}><td>{{fee.name}}</td><td style={{{{textAlign:'center'}}}}>1</td><td className="td-right">{{fmtCurr(fee.amount)}}</td><td className="td-right">{{fmtCurr(fee.amount)}}</td></tr>
              ))}}
              {{inv.tax.hasTax && (
                <>
                  <tr style={{{{background:'#f9fafb'}}}}><td colSpan={{3}} style={{{{textAlign:'right',fontSize:'11px',color:'#555',padding:'5px 10px'}}}}>Subtotal</td><td className="td-right" style={{{{color:'#555',fontSize:'11px',padding:'5px 10px'}}}}>{{fmtCurr(inv.tax.baseAmount)}}</td></tr>
                  <tr style={{{{background:'#fffbeb'}}}}><td colSpan={{3}} style={{{{textAlign:'right',fontSize:'11px',color:'#d97706',padding:'5px 10px'}}}}>PPN {{inv.tax.taxRate}}%</td><td className="td-right" style={{{{color:'#d97706',fontSize:'11px',padding:'5px 10px'}}}}>{{fmtCurr(inv.tax.taxAmount)}}</td></tr>
                </>
              )}}
              <tr className="total-row"><td colSpan={{3}} className="td-right">TOTAL</td><td className="td-right">{{inv.amountFormatted}}</td></tr>
            </tbody>
          </table>

          {{!inv.invoice.paidAt && inv.paymentLink && (
            <div className="actions-grid">
              <div className="payment-card">
                <div className="payment-card-title">Link Pembayaran Online</div>
                <p className="payment-note">Pelanggan dapat membuka link berikut untuk melakukan pembayaran langsung.</p>
                <Link className="payment-cta" href={{inv.paymentLink}}>Buka Halaman Bayar</Link>
              </div>
              <div className="payment-card">
                <div className="payment-card-title">Petunjuk Pembayaran</div>
                <p className="payment-note">Gunakan link pembayaran online di samping atau transfer manual ke rekening perusahaan di bawah.</p>
              </div>
            </div>
          )}}

          {{inv.invoice.paidAt ? (
            <div className="paid-stamp"><div className="paid-stamp-text">LUNAS</div><div className="paid-stamp-sub">Dibayar pada {{inv.invoice.paidAt}}</div></div>
          ) : (
            inv.company.bankAccounts && inv.company.bankAccounts.length > 0 && (
              <div style={{{{margin:'18px 0',padding:'16px',border:'1px solid #6ee7b7',borderRadius:'8px',background:'#f0fdfa'}}}}>
                <div className="section-title" style={{{{marginBottom:'10px'}}}}>Pembayaran Manual</div>
                <p style={{{{margin:'0 0 12px',fontSize:'11px',color:'#555'}}}}>Transfer ke salah satu rekening berikut sebelum jatuh tempo:</p>
                <div style={{{{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))',gap:'10px'}}}}>
                  {{inv.company.bankAccounts.map((ba: any, i: number) => (
                    <div key={{i}} style={{{{border:'1px solid #0d948840',borderRadius:'8px',padding:'10px 14px',background:'#fff'}}}}>
                      <div style={{{{fontWeight:'bold',fontSize:'12px',color:'#0d9488',marginBottom:'4px'}}}}>{{ba.bankName}}</div>
                      <div style={{{{fontSize:'14px',fontWeight:'bold',letterSpacing:'1px'}}}}>{ba.accountNumber}</div>
                      <div style={{{{fontSize:'11px',color:'#555',marginTop:'2px'}}}}>a/n {{ba.accountName}}</div>
                    </div>
                  ))}}
                </div>
              </div>
            )
          )}}

          <div className="footer">Terima kasih atas kepercayaan Anda &mdash; {{inv.company.name}}</div>
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
}}
"""
    with open('src/app/invoice/[id]/page.tsx', 'w', encoding='utf-8') as f:
        f.write(new_page)

if __name__ == "__main__":
    main()

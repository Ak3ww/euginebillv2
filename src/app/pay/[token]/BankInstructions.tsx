import React from 'react';

export function BankInstructions({ bankName, vaNumber }: { bankName: string, vaNumber: string }) {
  const bank = (bankName || '').toLowerCase();
  
  if (bank.includes('bri')) {
    return (
      <div className="text-left text-sm text-slate-600 space-y-4">
        <div>
          <p className="font-bold text-slate-800">ATM BRI</p>
          <ol className="list-decimal pl-4 mt-1 space-y-1">
            <li>Masukkan kartu ATM dan PIN Anda</li>
            <li>Pilih menu <b>Transaksi Lain</b> atau menu serupa</li>
            <li>Pilih <b>Pembayaran</b>, lalu <b>Lainnya</b></li>
            <li>Pilih <b>BRIVA</b></li>
            <li>Masukkan Nomor Pembayaran <b>({vaNumber})</b></li>
            <li>Masukkan jumlah pembayaran sesuai tagihan</li>
            <li>Konfirmasi pembayaran dan simpan struk</li>
          </ol>
        </div>
        <div>
          <p className="font-bold text-slate-800">Mobile Banking BRI (BRIMO)</p>
          <ol className="list-decimal pl-4 mt-1 space-y-1">
            <li>Buka aplikasi BRImo dan login</li>
            <li>Pilih menu <b>Pembayaran</b></li>
            <li>Pilih <b>BRIVA</b></li>
            <li>Masukkan Nomor Pembayaran <b>({vaNumber})</b></li>
            <li>Masukkan jumlah pembayaran dan konfirmasi</li>
          </ol>
        </div>
      </div>
    );
  }

  if (bank.includes('bni')) {
    return (
      <div className="text-left text-sm text-slate-600 space-y-4">
        <div>
          <p className="font-bold text-slate-800">ATM BNI</p>
          <ol className="list-decimal pl-4 mt-1 space-y-1">
            <li>Masukkan kartu ATM dan PIN Anda</li>
            <li>Pilih menu <b>Transaksi Lainnya</b></li>
            <li>Pilih <b>Pembayaran</b>, lalu <b>Virtual Account Billing</b></li>
            <li>Masukkan Nomor Pembayaran <b>({vaNumber})</b></li>
            <li>Konfirmasi pembayaran dan ikuti petunjuk selanjutnya</li>
          </ol>
        </div>
        <div>
          <p className="font-bold text-slate-800">Mobile Banking BNI</p>
          <ol className="list-decimal pl-4 mt-1 space-y-1">
            <li>Buka aplikasi BNI Mobile Banking dan login</li>
            <li>Pilih menu <b>Transfer</b> &gt; <b>Virtual Account Billing</b></li>
            <li>Pilih Rekening debet &gt; klik <b>Input Baru</b></li>
            <li>Masukkan nomor virtual account <b>({vaNumber})</b></li>
            <li>Klik Selanjutnya dan konfirmasi</li>
          </ol>
        </div>
      </div>
    );
  }

  if (bank.includes('bsi')) {
    return (
      <div className="text-left text-sm text-slate-600 space-y-4">
        <div>
          <p className="font-bold text-slate-800">BSI Mobile</p>
          <ol className="list-decimal pl-4 mt-1 space-y-1">
            <li>Login ke aplikasi BSI Mobile</li>
            <li>Pilih menu <b>Transfer</b> &gt; <b>Virtual Account Billing</b></li>
            <li>Masukkan Nomor Pembayaran <b>({vaNumber})</b> pada menu Input Baru</li>
            <li>Layar akan menampilkan total tagihan, konfirmasi pembayaran</li>
          </ol>
        </div>
      </div>
    );
  }

  if (bank.includes('mandiri')) {
    return (
      <div className="text-left text-sm text-slate-600 space-y-4">
        <div>
          <p className="font-bold text-slate-800">Livin' by Mandiri</p>
          <ol className="list-decimal pl-4 mt-1 space-y-1">
            <li>Login ke aplikasi Livin' by Mandiri</li>
            <li>Pilih menu <b>Pembayaran Baru</b> dan kemudian <b>Multi Payment</b></li>
            <li>Pilih penyedia jasa <b>Finpay</b></li>
            <li>Masukkan Nomor Pembayaran <b>({vaNumber})</b> dan nominal</li>
            <li>Konfirmasi transaksi dengan PIN Anda</li>
          </ol>
        </div>
      </div>
    );
  }
  
  if (bank.includes('permata')) {
    return (
      <div className="text-left text-sm text-slate-600 space-y-4">
        <div>
          <p className="font-bold text-slate-800">PermataMobile X</p>
          <ol className="list-decimal pl-4 mt-1 space-y-1">
            <li>Buka aplikasi PermataMobile X dan login</li>
            <li>Pilih menu <b>Bayar Tagihan</b> &gt; <b>Virtual Account</b></li>
            <li>Masukkan Nomor Pembayaran <b>({vaNumber})</b></li>
            <li>Pilih rekening sumber dana dan konfirmasi pembayaran</li>
          </ol>
        </div>
      </div>
    );
  }

  if (bank.includes('maybank')) {
    return (
      <div className="text-left text-sm text-slate-600 space-y-4">
        <div>
          <p className="font-bold text-slate-800">M2U ID (Maybank)</p>
          <ol className="list-decimal pl-4 mt-1 space-y-1">
            <li>Buka aplikasi M2U ID dan login</li>
            <li>Pilih menu <b>Pembayaran</b> &gt; <b>Maybank Virtual Account</b></li>
            <li>Masukkan Nomor Pembayaran <b>({vaNumber})</b></li>
            <li>Masukkan Jumlah Transfer lalu konfirmasi</li>
          </ol>
        </div>
      </div>
    );
  }

  if (bank.includes('alfamart') || bank.includes('indomaret')) {
    return (
      <div className="text-left text-sm text-slate-600 space-y-4">
        <div>
          <p className="font-bold text-slate-800">Pembayaran di Gerai {bank.includes('alfa') ? 'Alfamart' : 'Indomaret'}</p>
          <ol className="list-decimal pl-4 mt-1 space-y-1">
            <li>Pergi ke gerai {bank.includes('alfa') ? 'Alfamart' : 'Indomaret'} terdekat</li>
            <li>Informasikan ke Kasir ingin membayar menggunakan <b>Payment Code Finpay / Pronpay</b></li>
            <li>Berikan Nomor Kode Bayar <b>({vaNumber})</b></li>
            <li>Lakukan pembayaran sesuai nominal tagihan</li>
          </ol>
        </div>
      </div>
    );
  }

  // Fallback generic
  return (
    <div className="text-left text-sm text-slate-600">
      <p>Gunakan nomor Virtual Account <b>{vaNumber}</b> untuk melakukan transfer dari ATM, Internet Banking, atau Mobile Banking bank terkait.</p>
    </div>
  );
}

import React from 'react';

export function BankInstructions({ bankName, vaNumber }: { bankName: string, vaNumber: string }) {
  const rawBank = (bankName || '').toLowerCase();
  let bank = rawBank;
  if (rawBank === 'bc' || rawBank === 'bca') bank = 'bca';
  if (rawBank === 'm2' || rawBank === 'mandiri') bank = 'mandiri';
  if (rawBank === 'i1' || rawBank === 'bni') bank = 'bni';
  if (rawBank === 'bv' || rawBank === 'bsi') bank = 'bsi';
  if (rawBank === 'br' || rawBank === 'briv' || rawBank === 'briva' || rawBank === 'bri') bank = 'bri';

  let content = null;

  if (bank.includes('bca')) {
    content = (
      <div className="text-left text-sm text-neutral-600 space-y-4">
        <div>
          <p className="font-bold text-neutral-800">ATM BCA</p>
          <ol className="list-decimal pl-4 mt-1 space-y-1">
            <li>Masukkan kartu ATM dan PIN Anda</li>
            <li>Pilih menu <b>Transaksi Lainnya</b></li>
            <li>Pilih <b>Transfer</b> &gt; <b>ke Rekening BCA Virtual Account</b></li>
            <li>Masukkan Nomor Pembayaran <b>({vaNumber})</b></li>
            <li>Masukkan jumlah pembayaran sesuai tagihan</li>
            <li>Konfirmasi pembayaran dan simpan struk</li>
          </ol>
        </div>
        <div>
          <p className="font-bold text-neutral-800">m-BCA (BCA Mobile)</p>
          <ol className="list-decimal pl-4 mt-1 space-y-1">
            <li>Buka aplikasi BCA Mobile dan login</li>
            <li>Pilih menu <b>m-Transfer</b></li>
            <li>Pilih <b>BCA Virtual Account</b></li>
            <li>Masukkan Nomor Pembayaran <b>({vaNumber})</b></li>
            <li>Masukkan jumlah pembayaran dan konfirmasi dengan PIN</li>
          </ol>
        </div>
      </div>
    );
  } else if (bank.includes('bri')) {
    content = (
      <div className="text-left text-sm text-neutral-600 space-y-4">
        <div>
          <p className="font-bold text-neutral-800">ATM BRI</p>
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
          <p className="font-bold text-neutral-800">Mobile Banking BRI (BRIMO)</p>
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
  } else if (bank.includes('bni')) {
    content = (
      <div className="text-left text-sm text-neutral-600 space-y-4">
        <div>
          <p className="font-bold text-neutral-800">ATM BNI</p>
          <ol className="list-decimal pl-4 mt-1 space-y-1">
            <li>Masukkan kartu ATM dan PIN Anda</li>
            <li>Pilih menu <b>Transaksi Lainnya</b></li>
            <li>Pilih <b>Pembayaran</b>, lalu <b>Virtual Account Billing</b></li>
            <li>Masukkan Nomor Pembayaran <b>({vaNumber})</b></li>
            <li>Konfirmasi pembayaran dan ikuti petunjuk selanjutnya</li>
          </ol>
        </div>
        <div>
          <p className="font-bold text-neutral-800">Mobile Banking BNI</p>
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
  } else if (bank.includes('bsi')) {
    content = (
      <div className="text-left text-sm text-neutral-600 space-y-4">
        <div>
          <p className="font-bold text-neutral-800">BSI Mobile</p>
          <ol className="list-decimal pl-4 mt-1 space-y-1">
            <li>Login ke aplikasi BSI Mobile</li>
            <li>Pilih menu <b>Transfer</b> &gt; <b>Virtual Account Billing</b></li>
            <li>Masukkan Nomor Pembayaran <b>({vaNumber})</b> pada menu Input Baru</li>
            <li>Layar akan menampilkan total tagihan, konfirmasi pembayaran</li>
          </ol>
        </div>
      </div>
    );
  } else if (bank.includes('mandiri')) {
    content = (
      <div className="text-left text-sm text-neutral-600 space-y-4">
        <div>
          <p className="font-bold text-neutral-800">Livin' by Mandiri</p>
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
  } else if (bank.includes('permata')) {
    content = (
      <div className="text-left text-sm text-neutral-600 space-y-4">
        <div>
          <p className="font-bold text-neutral-800">PermataMobile X</p>
          <ol className="list-decimal pl-4 mt-1 space-y-1">
            <li>Buka aplikasi PermataMobile X dan login</li>
            <li>Pilih menu <b>Bayar Tagihan</b> &gt; <b>Virtual Account</b></li>
            <li>Masukkan Nomor Pembayaran <b>({vaNumber})</b></li>
            <li>Pilih rekening sumber dana dan konfirmasi pembayaran</li>
          </ol>
        </div>
      </div>
    );
  } else if (bank.includes('maybank')) {
    content = (
      <div className="text-left text-sm text-neutral-600 space-y-4">
        <div>
          <p className="font-bold text-neutral-800">M2U ID (Maybank)</p>
          <ol className="list-decimal pl-4 mt-1 space-y-1">
            <li>Buka aplikasi M2U ID dan login</li>
            <li>Pilih menu <b>Pembayaran</b> &gt; <b>Maybank Virtual Account</b></li>
            <li>Masukkan Nomor Pembayaran <b>({vaNumber})</b></li>
            <li>Masukkan Jumlah Transfer lalu konfirmasi</li>
          </ol>
        </div>
      </div>
    );
  } else if (bank.includes('alfamart') || bank.includes('indomaret')) {
    content = (
      <div className="text-left text-sm text-neutral-600 space-y-4">
        <div>
          <p className="font-bold text-neutral-800">Pembayaran di Gerai {bank.includes('alfa') ? 'Alfamart' : 'Indomaret'}</p>
          <ol className="list-decimal pl-4 mt-1 space-y-1">
            <li>Pergi ke gerai {bank.includes('alfa') ? 'Alfamart' : 'Indomaret'} terdekat</li>
            <li>Informasikan ke Kasir ingin membayar menggunakan <b>Payment Code Finpay / Pronpay</b></li>
            <li>Berikan Nomor Kode Bayar <b>({vaNumber})</b></li>
            <li>Lakukan pembayaran sesuai nominal tagihan</li>
          </ol>
        </div>
      </div>
    );
  } else {
    content = (
      <div className="text-left text-sm text-neutral-600">
        <p>Gunakan nomor Virtual Account <b>{vaNumber}</b> untuk melakukan transfer dari ATM, Internet Banking, atau Mobile Banking bank terkait.</p>
      </div>
    );
  }

  return (
    <details className="group">
      <summary className="text-sm font-bold text-neutral-800 cursor-pointer list-none flex items-center justify-between outline-none">
        Lihat Cara Pembayaran
        <span className="transition group-open:rotate-180">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </span>
      </summary>
      <div className="mt-4 border-t border-neutral-100 pt-4">
        {content}
      </div>
    </details>
  );
}

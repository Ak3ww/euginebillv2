import React, { useState } from 'react';
import { Copy, Check, ChevronDown, Store, Building2, Smartphone, CreditCard } from 'lucide-react';

interface BankInstructionsProps {
  bankName: string;
  vaNumber: string;
}

export function BankInstructions({ bankName, vaNumber }: BankInstructionsProps) {
  const [copied, setCopied] = useState(false);
  const rawBank = (bankName || '').toLowerCase().trim();

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(vaNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Detection flags for different payment channels
  const isAlfamart = rawBank.includes('alfa') || rawBank.includes('alfamart') || rawBank.includes('alfamidi') || rawBank.includes('lawson') || rawBank.includes('dandan');
  const isIndomaret = rawBank.includes('indo') || rawBank.includes('indomaret') || rawBank.includes('indomart') || rawBank.includes('ceriamart');
  const isRetail = isAlfamart || isIndomaret || rawBank.includes('finpay') || rawBank.includes('pronpay') || rawBank.includes('retail') || rawBank.includes('cstore');

  const isBca = rawBank.includes('bca') || rawBank === 'bc';
  const isBri = rawBank.includes('bri') || rawBank === 'br' || rawBank === 'briva';
  const isBni = rawBank.includes('bni') || rawBank === 'i1';
  const isMandiri = rawBank.includes('mandiri') || rawBank === 'm2' || rawBank.includes('livin');
  const isBsi = rawBank.includes('bsi') || rawBank === 'bv';
  const isPermata = rawBank.includes('permata');
  const isCimb = rawBank.includes('cimb') || rawBank.includes('niaga');
  const isMaybank = rawBank.includes('maybank') || rawBank.includes('m2u');

  let outletTitle = 'Gerai Retail';
  if (isAlfamart) outletTitle = 'Alfamart / Alfamidi / Lawson';
  if (isIndomaret) outletTitle = 'Indomaret / Ceriamart';

  return (
    <details className="group bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden transition-all" open>
      <summary className="px-4 sm:px-5 py-3.5 sm:py-4 cursor-pointer list-none flex items-center justify-between outline-none bg-slate-50/60 hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-2.5">
          {isRetail ? (
            <div className="w-7 h-7 rounded-lg bg-blue-100 text-[#002c60] flex items-center justify-center shrink-0 font-bold">
              <Store className="w-4 h-4" />
            </div>
          ) : (
            <div className="w-7 h-7 rounded-lg bg-blue-100 text-[#002c60] flex items-center justify-center shrink-0 font-bold">
              <Building2 className="w-4 h-4" />
            </div>
          )}
          <span className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
            Petunjuk Cara Pembayaran
          </span>
        </div>
        <span className="transition-transform duration-200 group-open:rotate-180 text-slate-500">
          <ChevronDown className="w-5 h-5" />
        </span>
      </summary>

      <div className="p-4 sm:p-5 border-t border-slate-200 space-y-4 text-left">
        {/* Highlight Payment Code / VA Box with Copy Button */}
        <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <span className="text-xs font-semibold text-slate-600 block">
              {isRetail ? 'Kode Pembayaran Kasir' : 'Nomor Virtual Account'}
            </span>
            <span className="font-mono text-base sm:text-lg font-extrabold text-[#002c60] tracking-wider">
              {vaNumber}
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#002c60] hover:bg-[#003b82] text-white text-xs font-bold rounded-lg shadow-xs transition-colors self-start sm:self-center"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Tersalin' : 'Salin Kode'}
          </button>
        </div>

        {/* 1. GERAI RETAIL (ALFAMART / INDOMARET / FINPAY / PRONPAY) */}
        {isRetail && (
          <div className="space-y-4">
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#002c60] bg-blue-100/70 px-2 py-0.5 rounded">
                  {outletTitle}
                </span>
              </div>
              <ol className="space-y-2.5">
                <li className="flex items-start gap-3 text-xs sm:text-sm text-slate-700 leading-relaxed">
                  <span className="w-5 h-5 rounded-full bg-[#002c60] text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <span>
                    Kunjungi gerai <b>{outletTitle}</b> terdekat.
                  </span>
                </li>
                <li className="flex items-start gap-3 text-xs sm:text-sm text-slate-700 leading-relaxed">
                  <span className="w-5 h-5 rounded-full bg-[#002c60] text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <span>
                    Sampaikan kepada kasir bahwa Anda ingin melakukan pembayaran merchant <b>Finpay</b> atau <b>Pronpay</b> (Pembayaran Tagihan Online).
                  </span>
                </li>
                <li className="flex items-start gap-3 text-xs sm:text-sm text-slate-700 leading-relaxed">
                  <span className="w-5 h-5 rounded-full bg-[#002c60] text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <span>
                    Tunjukkan atau sebutkan Kode Pembayaran: <b className="font-mono text-[#002c60] bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">{vaNumber}</b> kepada kasir.
                  </span>
                </li>
                <li className="flex items-start gap-3 text-xs sm:text-sm text-slate-700 leading-relaxed">
                  <span className="w-5 h-5 rounded-full bg-[#002c60] text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    4
                  </span>
                  <span>
                    Kasir akan memverifikasi nama pelanggan dan total nominal tagihan. Pastikan rincian telah sesuai.
                  </span>
                </li>
                <li className="flex items-start gap-3 text-xs sm:text-sm text-slate-700 leading-relaxed">
                  <span className="w-5 h-5 rounded-full bg-[#002c60] text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    5
                  </span>
                  <span>
                    Lakukan pembayaran kepada kasir secara tunai atau menggunakan kartu debit.
                  </span>
                </li>
                <li className="flex items-start gap-3 text-xs sm:text-sm text-slate-700 leading-relaxed">
                  <span className="w-5 h-5 rounded-full bg-[#002c60] text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    6
                  </span>
                  <span>
                    Simpan struk cetak pembayaran resmi dari kasir sebagai bukti transaksi yang sah.
                  </span>
                </li>
              </ol>
            </div>
          </div>
        )}

        {/* 2. BCA VIRTUAL ACCOUNT */}
        {isBca && (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs sm:text-sm font-bold text-slate-900">m-BCA (BCA Mobile)</p>
              <ol className="space-y-2 text-xs sm:text-sm text-slate-700">
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-800 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                  <span>Buka aplikasi BCA Mobile dan pilih menu <b>m-BCA</b>.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-800 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                  <span>Pilih menu <b>m-Transfer</b> &gt; <b>BCA Virtual Account</b>.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-800 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                  <span>Masukkan Nomor Virtual Account <b>{vaNumber}</b> lalu klik <b>Send</b>.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-800 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">4</span>
                  <span>Pastikan nama dan nominal tagihan telah sesuai, lalu konfirmasi dengan PIN m-BCA Anda.</span>
                </li>
              </ol>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100">
              <p className="text-xs sm:text-sm font-bold text-slate-900">ATM BCA</p>
              <ol className="space-y-2 text-xs sm:text-sm text-slate-700">
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-800 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                  <span>Masukkan kartu ATM dan PIN BCA Anda.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-800 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                  <span>Pilih menu <b>Transaksi Lainnya</b> &gt; <b>Transfer</b> &gt; <b>ke Rekening BCA Virtual Account</b>.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-800 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                  <span>Masukkan Nomor Virtual Account <b>{vaNumber}</b> dan ikuti instruksi hingga selesai.</span>
                </li>
              </ol>
            </div>
          </div>
        )}

        {/* 3. BRI VIRTUAL ACCOUNT (BRIVA) */}
        {isBri && (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs sm:text-sm font-bold text-slate-900">BRImo (Mobile Banking BRI)</p>
              <ol className="space-y-2 text-xs sm:text-sm text-slate-700">
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-800 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                  <span>Login ke aplikasi <b>BRImo</b>.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-800 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                  <span>Pilih menu <b>Tagihan</b> &gt; <b>BRIVA</b>.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-800 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                  <span>Pilih <b>Pembayaran Baru</b> dan masukkan Nomor Pembayaran <b>{vaNumber}</b>.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-800 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">4</span>
                  <span>Periksa rincian tagihan, lalu masukkan PIN BRImo untuk menyelesaikan transaksi.</span>
                </li>
              </ol>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100">
              <p className="text-xs sm:text-sm font-bold text-slate-900">ATM BRI</p>
              <ol className="space-y-2 text-xs sm:text-sm text-slate-700">
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-800 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                  <span>Masukkan kartu ATM dan PIN Anda di mesin ATM BRI.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-800 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                  <span>Pilih <b>Transaksi Lain</b> &gt; <b>Pembayaran</b> &gt; <b>Lainnya</b> &gt; <b>BRIVA</b>.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-800 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                  <span>Masukkan Nomor Pembayaran <b>{vaNumber}</b> dan konfirmasi pembayaran.</span>
                </li>
              </ol>
            </div>
          </div>
        )}

        {/* 4. BNI VIRTUAL ACCOUNT */}
        {isBni && (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs sm:text-sm font-bold text-slate-900">BNI Mobile Banking</p>
              <ol className="space-y-2 text-xs sm:text-sm text-slate-700">
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-800 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                  <span>Login ke <b>BNI Mobile Banking</b>.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-800 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                  <span>Pilih menu <b>Transfer</b> &gt; <b>Virtual Account Billing</b>.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-800 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                  <span>Pilih tab <b>Input Baru</b> dan masukkan Nomor VA <b>{vaNumber}</b>.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-800 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">4</span>
                  <span>Konfirmasi rincian tagihan dan masukkan Password Transaksi Anda.</span>
                </li>
              </ol>
            </div>
          </div>
        )}

        {/* 5. MANDIRI VIRTUAL ACCOUNT */}
        {isMandiri && (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs sm:text-sm font-bold text-slate-900">Livin' by Mandiri (Kuning)</p>
              <ol className="space-y-2 text-xs sm:text-sm text-slate-700">
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-800 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                  <span>Login ke aplikasi <b>Livin' by Mandiri</b>.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-800 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                  <span>Pilih menu <b>Bayar</b> &gt; cari penyedia jasa <b>Virtual Account / Finpay</b>.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-800 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                  <span>Masukkan Nomor Pembayaran <b>{vaNumber}</b> lalu klik <b>Lanjutkan</b>.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-800 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">4</span>
                  <span>Pastikan data pembayaran benar dan konfirmasi dengan PIN Livin' Anda.</span>
                </li>
              </ol>
            </div>
          </div>
        )}

        {/* 6. BSI VIRTUAL ACCOUNT */}
        {isBsi && (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs sm:text-sm font-bold text-slate-900">BSI Mobile</p>
              <ol className="space-y-2 text-xs sm:text-sm text-slate-700">
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-800 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                  <span>Buka dan login ke aplikasi <b>BSI Mobile</b>.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-800 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                  <span>Pilih menu <b>Bayar</b> &gt; <b>Virtual Account Billing</b>.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-800 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                  <span>Masukkan Nomor Virtual Account <b>{vaNumber}</b> lalu konfirmasi.</span>
                </li>
              </ol>
            </div>
          </div>
        )}

        {/* 7. PERMATA & BANK LAINNYA */}
        {isPermata && (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs sm:text-sm font-bold text-slate-900">PermataMobile X</p>
              <ol className="space-y-2 text-xs sm:text-sm text-slate-700">
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-800 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                  <span>Login ke aplikasi <b>PermataMobile X</b>.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-800 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                  <span>Pilih <b>Bayar Tagihan</b> &gt; <b>Virtual Account</b>.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-800 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                  <span>Masukkan Nomor Pembayaran <b>{vaNumber}</b> dan selesaikan transaksi.</span>
                </li>
              </ol>
            </div>
          </div>
        )}

        {/* 8. FALLBACK UNTUK SEMUA BANK / ATM BERSAMA */}
        {!isRetail && !isBca && !isBri && !isBni && !isMandiri && !isBsi && !isPermata && (
          <div className="space-y-3 text-xs sm:text-sm text-slate-700 leading-relaxed">
            <p className="font-semibold text-slate-900">
              Transfer Antar Bank / ATM Bersama / Prima:
            </p>
            <ol className="space-y-2">
              <li className="flex items-start gap-2.5">
                <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-800 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                <span>Buka aplikasi m-Banking atau ATM bank pilihan Anda.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-800 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                <span>Pilih menu <b>Transfer Antar Bank</b> atau <b>Virtual Account</b>.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-800 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                <span>Masukkan Nomor Rekening / Virtual Account <b>{vaNumber}</b>.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-800 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">4</span>
                <span>Pastikan nominal pembayaran sesuai dengan total tagihan dan konfirmasi.</span>
              </li>
            </ol>
          </div>
        )}
      </div>
    </details>
  );
}

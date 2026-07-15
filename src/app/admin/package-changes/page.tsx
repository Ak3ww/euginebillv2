'use client';

import { useState, useEffect } from 'react';
import {
  Check, X, Loader2, AlertCircle, Clock, Package,
  ArrowRight, ShieldCheck, RefreshCw, Calendar, User, Phone, Hash
} from 'lucide-react';
import { showSuccess, showError, showConfirm } from '@/lib/sweetalert';
import { formatWIB } from '@/lib/timezone';
import { useTranslation } from '@/hooks/useTranslation';

interface Profile {
  id: string;
  name: string;
  price: number;
}

interface CustomerUser {
  id: string;
  name: string;
  username: string;
  phone: string;
  customerId: string | null;
  expiredAt: string | null;
}

interface PackageChangeRequest {
  id: string;
  userId: string;
  oldProfileId: string;
  newProfileId: string;
  status: string;
  createdAt: string;
  user: CustomerUser;
  oldProfile: Profile;
  newProfile: Profile;
}

export default function AdminPackageChangesPage() {
  const { t } = useTranslation();
  const [requests, setRequests] = useState<PackageChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/package-changes');
      const data = await res.json();
      if (data.success) {
        setRequests(data.requests || []);
      } else {
        showError(data.error || 'Gagal mengambil data pengajuan');
      }
    } catch (e) {
      showError('Gagal menghubungi server');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (requestId: string, action: 'APPROVED' | 'REJECTED') => {
    const isApprove = action === 'APPROVED';
    const actionText = isApprove ? 'menyetujui' : 'menolak';
    const confirmTitle = isApprove ? 'Setujui Pengajuan?' : 'Tolak Pengajuan?';
    const confirmText = isApprove
      ? 'Invoice prorata akan otomatis dibuat dan dikirim ke nomor WhatsApp pelanggan.'
      : 'Pengajuan ganti paket ini akan ditolak dan dibatalkan.';

    const confirmed = await showConfirm(
      confirmTitle,
      confirmText,
      isApprove ? 'Ya, Setujui' : 'Ya, Tolak',
      'Batal'
    );

    if (!confirmed) return;

    setProcessingId(requestId);
    try {
      const res = await fetch('/api/admin/package-changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action })
      });
      const data = await res.json();

      if (data.success) {
        showSuccess(
          isApprove 
            ? `Pengajuan disetujui! Invoice ${data.invoice?.invoiceNumber} berhasil terbit.`
            : 'Pengajuan berhasil ditolak.',
          'Berhasil!'
        );
        fetchRequests();
      } else {
        showError(data.error || `Gagal ${actionText} pengajuan`);
      }
    } catch (e) {
      showError('Gagal menghubungi server');
    } finally {
      setProcessingId(null);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Persetujuan Ganti Paket</h1>
          <p className="text-xs text-neutral-400 mt-1">Daftar pengajuan upgrade dan downgrade paket internet dari pelanggan portal mandiri.</p>
        </div>
        <button
          onClick={fetchRequests}
          disabled={loading}
          className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 text-white font-semibold text-xs px-4 py-2.5 rounded-lg hover:bg-neutral-800 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Segarkan Data
        </button>
      </div>

      {/* Main List */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-red-500" />
            <p className="text-sm text-neutral-400 font-semibold">Memuat daftar pengajuan...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="w-16 h-16 bg-neutral-950 border border-neutral-800 text-neutral-600 rounded-full flex items-center justify-center mb-4">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-white">Tidak Ada Pengajuan Pending</h3>
            <p className="text-xs text-neutral-400 mt-1 max-w-sm">Semua pengajuan perubahan paket layanan dari pelanggan telah diproses.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-950/40 text-neutral-400 font-bold uppercase tracking-wider">
                  <th className="p-4">Pelanggan</th>
                  <th className="p-4">Paket Lama</th>
                  <th className="p-4">Paket Baru</th>
                  <th className="p-4">Tanggal Pengajuan</th>
                  <th className="p-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {requests.map((req) => {
                  const isUpgrade = req.newProfile.price > req.oldProfile.price;

                  return (
                    <tr key={req.id} className="hover:bg-neutral-950/20 transition-colors">
                      {/* Customer info */}
                      <td className="p-4">
                        <div className="flex flex-col gap-1">
                          <span className="font-bold text-sm text-white">{req.user.name}</span>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-400">
                            {req.user.customerId && <span className="flex items-center gap-1 font-semibold"><Hash className="w-3 h-3 text-red-500" /> {req.user.customerId}</span>}
                            <span className="flex items-center gap-1"><User className="w-3 h-3 text-neutral-400" /> {req.user.username}</span>
                            <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-neutral-400" /> {req.user.phone}</span>
                          </div>
                        </div>
                      </td>

                      {/* Old package */}
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-neutral-200">{req.oldProfile.name}</span>
                          <span className="text-[11px] text-neutral-500 mt-0.5">{formatCurrency(req.oldProfile.price)}/bln</span>
                        </div>
                      </td>

                      {/* New package */}
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <ArrowRight className="w-3.5 h-3.5 text-neutral-500 mr-1" />
                          <div className="flex flex-col">
                            <span className="font-bold text-white">{req.newProfile.name}</span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] text-neutral-400">{formatCurrency(req.newProfile.price)}/bln</span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                                isUpgrade 
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
                              }`}>
                                {isUpgrade ? 'Upgrade' : 'Downgrade'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Request date */}
                      <td className="p-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-neutral-300 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-neutral-500" /> {formatWIB(req.createdAt).split(' ')[0]}
                          </span>
                          <span className="text-[10px] text-neutral-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {formatWIB(req.createdAt).split(' ')[1]} WIB
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleAction(req.id, 'REJECTED')}
                            disabled={processingId !== null}
                            className="bg-neutral-950 hover:bg-red-950 border border-neutral-800 hover:border-red-900 text-neutral-300 hover:text-red-400 rounded-lg p-2.5 transition-all disabled:opacity-50"
                            title="Tolak Pengajuan"
                          >
                            {processingId === req.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <X className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleAction(req.id, 'APPROVED')}
                            disabled={processingId !== null}
                            className="bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-2.5 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-red-900/10 transition-all disabled:opacity-50"
                            title="Setujui Pengajuan"
                          >
                            {processingId === req.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                            Setujui
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

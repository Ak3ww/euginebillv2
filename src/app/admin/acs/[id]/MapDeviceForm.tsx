'use client';

import { useState } from 'react';
import { useToast } from '@/components/cyberpunk/CyberToast';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function MapDeviceForm({
  deviceId,
  currentUserId,
  users
}: {
  deviceId: string;
  currentUserId: string | null;
  users: { id: string; name: string; username: string }[];
}) {
  const { addToast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(currentUserId || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`/api/acs/${deviceId}/map`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pppoeUserId: selectedUser || null }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        addToast({ type: 'success', title: 'Berhasil', description: 'Perangkat berhasil dipetakan' });
        router.refresh();
      } else {
        throw new Error(data.error || 'Gagal memetakan perangkat');
      }
    } catch (e: any) {
      addToast({ type: 'error', title: 'Error', description: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 mt-4">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Pilih Pelanggan PPPoE</label>
        <select
          value={selectedUser}
          onChange={(e) => setSelectedUser(e.target.value)}
          className="bg-background border border-border rounded p-2 text-sm"
          disabled={loading}
        >
          <option value="">-- Tidak Dipetakan --</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} ({u.username})
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full flex justify-center items-center gap-2 bg-primary text-primary-foreground p-2 rounded text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        Simpan Pemetaan
      </button>
    </form>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from '@/hooks/useTranslation';
import { useToast } from '@/components/cyberpunk/CyberToast';
import { ArrowLeft, Send, CheckCircle, MapPin, Navigation, Loader2 } from 'lucide-react';
import { CyberCard } from '@/components/cyberpunk/CyberCard';
import { CyberButton } from '@/components/cyberpunk/CyberButton';

interface Category {
  id: string;
  name: string;
  color: string;
}

export default function CreateTicketPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { addToast } = useToast();
  const toastError = (msg: string) => addToast({ type: 'error', title: 'Gagal', description: msg, duration: 8000 });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [ticketNumber, setTicketNumber] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    categoryId: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    locationTag: '',
    latitude: '',
    longitude: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchCategories();
    loadCustomerData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const loadCustomerData = () => {
    const token = localStorage.getItem('customer_token');
    const userData = localStorage.getItem('customer_user');
    
    if (!token || !userData) {
      router.push('/customer/login');
      return;
    }
    
    try {
      const user = JSON.parse(userData);
      setFormData(prev => ({
        ...prev,
        customerName: user.name || user.username,
        customerPhone: user.phone || '',
        customerEmail: user.email || '',
      }));
    } catch (error) {
      router.push('/customer/login');
    }
  };

  const fetchCategories = async () => {
    try {
      const token = localStorage.getItem('customer_token');
      const res = await fetch('/api/tickets/categories?isActive=true', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.subject.trim()) {
      newErrors.subject = t('ticket.subjectRequired');
    }

    if (!formData.description.trim()) {
      newErrors.description = t('ticket.descriptionRequired');
    } else if (formData.description.trim().length < 10) {
      newErrors.description = t('ticket.descriptionTooShort');
    }

    if (!formData.customerName.trim()) {
      newErrors.customerName = t('ticket.nameRequired');
    }

    if (!formData.customerPhone.trim()) {
      newErrors.customerPhone = t('ticket.phoneRequired');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const [gpsLoading, setGpsLoading] = useState(false);

  const handleGetGPS = () => {
    if (!navigator.geolocation) {
      toastError('Browser tidak mendukung GPS');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData(prev => ({
          ...prev,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }));
        setGpsLoading(false);
      },
      () => {
        toastError('Gagal mendapatkan lokasi GPS. Pastikan izin lokasi diaktifkan.');
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    try {
      // Get customer ID from session
      const userData = localStorage.getItem('customer_user');
      let customerId = null;
      if (userData) {
        try {
          const user = JSON.parse(userData);
          customerId = user.id;
        } catch (error) {
          console.error('Failed to parse user data:', error);
        }
      }

      // Build description with optional location info
      let finalDescription = formData.description;
      if (formData.locationTag || (formData.latitude && formData.longitude)) {
        finalDescription += '\n\n---';
        if (formData.locationTag) {
          finalDescription += `\n📍 Lokasi: ${formData.locationTag}`;
        }
        if (formData.latitude && formData.longitude) {
          finalDescription += `\n🌐 Koordinat: ${formData.latitude}, ${formData.longitude}`;
          finalDescription += `\n🗺️ Maps: https://maps.google.com/?q=${formData.latitude},${formData.longitude}`;
        }
      }

      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          description: finalDescription,
          customerId, // Link ticket to customer
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setTicketNumber(data.ticketNumber);
        setSuccess(true);
        setTimeout(() => {
          router.push(`/customer/tickets/${data.id}`);
        }, 3000);
      } else {
        const error = await res.json();
        toastError(error.error || t('ticket.createFailed'));
      }
    } catch (error) {
      console.error('Failed to create ticket:', error);
      toastError(t('ticket.createFailed'));
    } finally {
      setLoading(false);
    }
  };



  return (
    <main className="max-w-[1280px] mx-auto px-4 md:px-8 py-6 pb-32 md:pb-8">
      <button
        onClick={() => router.push('/customer/tickets')}
        className="flex items-center gap-1.5 text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors font-mono text-[10px] uppercase tracking-wider font-bold mb-6"
      >
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
        Kembali ke Tiket
      </button>

      {success ? (
        <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-[var(--radius-lg)] p-6 shadow-sm max-w-md mx-auto text-center py-12">
          <div className="w-16 h-16 rounded-full bg-[var(--color-success-bg,oklch(95%_0.04_145))] text-[var(--color-success,oklch(60%_0.14_145))] flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-display font-semibold text-[var(--color-ink)] mb-2">Tiket Berhasil Dibuat!</h2>
          <p className="text-sm font-body text-[var(--color-ink-2)] mb-1">Nomor tiket Anda:</p>
          <p className="font-mono text-lg font-bold text-[var(--color-accent)] mb-6">{ticketNumber}</p>
          <button
            onClick={() => router.push('/customer/tickets')}
            className="bg-[var(--color-accent)] text-[var(--color-accent-ink)] hover:opacity-90 px-4 py-3 rounded-[var(--radius-sm)] font-mono text-[10px] uppercase font-bold tracking-wider w-full"
          >
            Lihat Tiket Saya
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          <div className="md:col-span-8">
            <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-[var(--radius-lg)] p-6 shadow-sm">
              <h2 className="text-2xl font-display font-semibold text-[var(--color-ink)] mb-6">Buat Tiket Bantuan</h2>
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                {/* Subject */}
                <div>
                  <label className="block text-xs font-mono text-[var(--color-muted)] uppercase tracking-wider mb-2">Subjek <span className="text-[var(--color-error)]">*</span></label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={e => setFormData({ ...formData, subject: e.target.value })}
                    className={`w-full bg-[var(--color-paper)] border rounded-[var(--radius-sm)] px-4 py-2.5 text-sm text-[var(--color-ink)] outline-none transition-all font-mono ${errors.subject ? 'border-[var(--color-error)] focus:border-[var(--color-error)] focus:ring-1 focus:ring-[var(--color-error)]/20' : 'border-[var(--color-rule)] focus:border-[var(--color-focus)] focus:ring-1 focus:ring-[var(--color-focus)]/20'}`}
                    placeholder="Deskripsikan masalah Anda secara singkat"
                    maxLength={200}
                  />
                  {errors.subject && <p className="text-[var(--color-error)] text-xs mt-1">{errors.subject}</p>}
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-mono text-[var(--color-muted)] uppercase tracking-wider mb-2">Kategori</label>
                  <select
                    value={formData.categoryId}
                    onChange={e => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-[var(--radius-sm)] px-4 py-2.5 text-sm font-mono text-[var(--color-ink)] outline-none transition-all focus:border-[var(--color-focus)] focus:ring-1 focus:ring-[var(--color-focus)]/20 uppercase"
                  >
                    <option value="">-- Pilih kategori --</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-mono text-[var(--color-muted)] uppercase tracking-wider mb-2">Deskripsi <span className="text-[var(--color-error)]">*</span></label>
                  <textarea
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className={`w-full bg-[var(--color-paper)] border rounded-[var(--radius-sm)] px-4 py-2.5 text-sm text-[var(--color-ink)] outline-none transition-all font-mono min-h-[120px] resize-y ${errors.description ? 'border-[var(--color-error)] focus:border-[var(--color-error)] focus:ring-1 focus:ring-[var(--color-error)]/20' : 'border-[var(--color-rule)] focus:border-[var(--color-focus)] focus:ring-1 focus:ring-[var(--color-focus)]/20'}`}
                    placeholder="Jelaskan masalah secara detail: kapan mulai terjadi, apa yang sudah dicoba, dll."
                    rows={5}
                  />
                  {errors.description && <p className="text-[var(--color-error)] text-xs mt-1">{errors.description}</p>}
                </div>

                {/* Location */}
                <div>
                  <label className="block text-xs font-mono text-[var(--color-muted)] uppercase tracking-wider mb-2">Lokasi (Opsional)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formData.locationTag}
                      onChange={e => setFormData({ ...formData, locationTag: e.target.value })}
                      className="w-full bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-[var(--radius-sm)] px-4 py-2.5 text-sm text-[var(--color-ink)] outline-none transition-all font-mono focus:border-[var(--color-focus)] focus:ring-1 focus:ring-[var(--color-focus)]/20 flex-1"
                      placeholder="Masukkan alamat atau nama lokasi"
                    />
                    <button
                      type="button"
                      onClick={handleGetGPS}
                      disabled={gpsLoading}
                      className="bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-[var(--color-ink)] hover:bg-[var(--color-paper-3)] px-4 py-2.5 rounded-[var(--radius-sm)] font-mono text-[10px] uppercase font-bold tracking-wider whitespace-nowrap flex items-center gap-2"
                    >
                      {gpsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
                      GPS
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="bg-[var(--color-accent)] text-[var(--color-accent-ink)] hover:opacity-90 px-4 py-3 rounded-[var(--radius-sm)] font-mono text-[10px] uppercase font-bold tracking-wider w-full mt-2 flex items-center justify-center gap-2"
                >
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Mengirim...</>
                    : <><Send className="w-4 h-4" /> Kirim Tiket</>}
                </button>
              </form>
            </div>
          </div>

          {/* Info sidebar */}
          <div className="md:col-span-4">
            <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-[var(--radius-lg)] p-6 shadow-sm">
              <h3 className="text-sm font-display font-semibold text-[var(--color-ink)] mb-4">Tips Membuat Tiket</h3>
              <ul className="flex flex-col gap-3">
                {[
                  'Jelaskan masalah sejelas mungkin',
                  'Sebutkan kapan masalah pertama kali muncul',
                  'Lampirkan foto jika diperlukan',
                  'Pastikan nomor telepon Anda aktif',
                ].map((tip, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">{i+1}</span>
                    <span className="text-sm font-body text-[var(--color-ink-2)]">{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}



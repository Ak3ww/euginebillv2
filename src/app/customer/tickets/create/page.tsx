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

  if (success) {
    return (
      <div className="flex items-center justify-center p-4 py-12 animate-in fade-in duration-700">
        <div className="p-8 max-w-md w-full text-center bg-paper border border-rule rounded-[10px] shadow-sm">
          <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-display font-medium text-ink mb-2">
            {t('ticket.ticketCreated')}
          </h2>
          <p className="text-[10px] font-mono text-muted uppercase tracking-wider mb-4">
            {t('ticket.ticketNumberIs')}:
          </p>
          <div className="bg-green-500/10 border border-green-500/20 rounded p-4 mb-6">
            <span className="text-xl font-mono font-bold text-green-600 tracking-wider">
              #{ticketNumber}
            </span>
          </div>
          <p className="text-[10px] font-mono text-muted uppercase tracking-widest mb-6">
            {t('ticket.whatsappNotificationSent')}
          </p>
          <p className="text-xs font-mono font-bold text-accent animate-pulse">
            {t('ticket.redirectingToTicket')}...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto space-y-6 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex items-center gap-4 pb-4 border-b border-rule">
        <Link
          href="/customer/tickets"
          className="text-muted hover:text-ink transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl lg:text-2xl font-display font-medium text-ink">
            {t('ticket.createTicket')}
          </h1>
          <p className="text-[10px] font-mono text-muted uppercase mt-1">
            {t('ticket.createTicketDescription')}
          </p>
        </div>
      </div>

      <div className="bg-paper border border-rule rounded-[10px] shadow-sm p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Customer Name */}
          <div>
            <label className="block text-[10px] font-mono text-muted uppercase tracking-wider mb-2">
              {t('ticket.customerName')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.customerName}
              onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
              className={`w-full bg-paper border rounded-[6px] px-4 py-2.5 text-sm text-ink outline-none transition-all font-mono ${
                errors.customerName ? 'border-red-500/50 focus:border-red-500 focus:ring-1 focus:ring-red-500/20' : 'border-rule focus:border-accent/50 focus:ring-1 focus:ring-accent/20'
              }`}
              placeholder={t('ticket.enterYourName')}
            />
            {errors.customerName && (
              <p className="text-[10px] font-mono text-red-500 uppercase mt-1.5">{errors.customerName}</p>
            )}
          </div>

          {/* Customer Phone */}
          <div>
            <label className="block text-[10px] font-mono text-muted uppercase tracking-wider mb-2">
              {t('ticket.customerPhone')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.customerPhone}
              onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
              className={`w-full bg-paper border rounded-[6px] px-4 py-2.5 text-sm text-ink outline-none transition-all font-mono ${
                errors.customerPhone ? 'border-red-500/50 focus:border-red-500 focus:ring-1 focus:ring-red-500/20' : 'border-rule focus:border-accent/50 focus:ring-1 focus:ring-accent/20'
              }`}
              placeholder="+62..."
            />
            {errors.customerPhone && (
              <p className="text-[10px] font-mono text-red-500 uppercase mt-1.5">{errors.customerPhone}</p>
            )}
          </div>

          {/* Customer Email */}
          <div>
            <label className="block text-[10px] font-mono text-muted uppercase tracking-wider mb-2">
              {t('ticket.customerEmail')}
            </label>
            <input
              type="email"
              value={formData.customerEmail}
              onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
              className="w-full bg-paper border border-rule rounded-[6px] px-4 py-2.5 text-sm text-ink outline-none transition-all font-mono focus:border-accent/50 focus:ring-1 focus:ring-accent/20"
              placeholder="name@domain.com"
            />
          </div>

          {/* Subject */}
          <div>
            <label className="block text-[10px] font-mono text-muted uppercase tracking-wider mb-2">
              {t('ticket.subject')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              className={`w-full bg-paper border rounded-[6px] px-4 py-2.5 text-sm text-ink outline-none transition-all font-mono ${
                errors.subject ? 'border-red-500/50 focus:border-red-500 focus:ring-1 focus:ring-red-500/20' : 'border-rule focus:border-accent/50 focus:ring-1 focus:ring-accent/20'
              }`}
              placeholder={t('ticket.subjectPlaceholder')}
            />
            {errors.subject && (
              <p className="text-[10px] font-mono text-red-500 uppercase mt-1.5">{errors.subject}</p>
            )}
          </div>

          {/* Category */}
          <div>
            <label className="block text-[10px] font-mono text-muted uppercase tracking-wider mb-2">
              {t('ticket.category')}
            </label>
            <select
              value={formData.categoryId}
              onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              className="w-full bg-paper border border-rule rounded-[6px] px-4 py-2.5 text-sm font-mono text-ink outline-none transition-all focus:border-accent/50 focus:ring-1 focus:ring-accent/20 uppercase"
            >
              <option value="">{t('ticket.selectCategory')}</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] font-mono text-muted uppercase tracking-wider mb-2">
              {t('ticket.description')} <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={6}
              className={`w-full bg-paper border rounded-[6px] px-4 py-2.5 text-sm text-ink outline-none transition-all font-mono resize-none ${
                errors.description ? 'border-red-500/50 focus:border-red-500 focus:ring-1 focus:ring-red-500/20' : 'border-rule focus:border-accent/50 focus:ring-1 focus:ring-accent/20'
              }`}
              placeholder={t('ticket.descriptionPlaceholder')}
            />
            {errors.description && (
              <p className="text-[10px] font-mono text-red-500 uppercase mt-1.5">{errors.description}</p>
            )}
            <p className="text-[9px] font-mono text-muted uppercase mt-1.5 tracking-widest">
              {t('ticket.minCharacters')}: 10
            </p>
          </div>

          {/* Location Tag */}
          <div>
            <label className="block text-[10px] font-mono text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <MapPin size={12} />
              LOKASI / ALAMAT RUMAH
            </label>
            <input
              type="text"
              value={formData.locationTag}
              onChange={(e) => setFormData({ ...formData, locationTag: e.target.value })}
              className="w-full bg-paper border border-rule rounded-[6px] px-4 py-2.5 text-sm text-ink outline-none transition-all font-mono focus:border-accent/50 focus:ring-1 focus:ring-accent/20"
              placeholder="Contoh: Jl. Merdeka No. 10..."
            />
            <div className="flex items-center gap-3 mt-3">
              <button
                type="button"
                onClick={handleGetGPS}
                disabled={gpsLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-paper border border-rule hover:border-accent/50 text-[10px] font-mono font-bold text-ink rounded-[6px] transition-colors disabled:opacity-50 uppercase tracking-wider"
              >
                {gpsLoading ? (
                  <><Loader2 size={12} className="animate-spin" /> MENDAPATKAN LOKASI…</>
                ) : (
                  <><Navigation size={12} /> AMBIL KOORDINAT GPS</>
                )}
              </button>
              {formData.latitude && formData.longitude && (
                <span className="text-[10px] font-mono font-bold text-green-600 uppercase">
                  📍 {formData.latitude}, {formData.longitude}
                </span>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-3 pt-4 border-t border-rule mt-6">
            <Link href="/customer/tickets">
              <button
                type="button"
                className="px-6 py-2 bg-paper border border-rule hover:bg-muted/5 text-ink text-[11px] font-mono font-bold rounded-[6px] transition-colors uppercase tracking-wider"
              >
                {t('ticket.cancel')}
              </button>
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2 bg-accent hover:bg-accent-hover text-paper text-[11px] font-mono font-bold rounded-[6px] transition-colors disabled:opacity-50 uppercase tracking-wider"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  {t('ticket.creating')}...
                </>
              ) : (
                <>
                  <Send size={14} />
                  {t('ticket.submitTicket')}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}



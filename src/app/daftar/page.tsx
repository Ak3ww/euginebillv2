'use client';

import { useEffect, useState } from 'react';
import { useToast, CyberToastProvider } from '@/components/cyberpunk/CyberToast';
import { UserPlus, Loader2, Wifi, CheckCircle, MapPin, Phone, Mail, Home, Package, FileText, Gift, CreditCard, Camera, X, Map } from 'lucide-react';
import MapPicker from '@/components/MapPicker';
import { CameraPhotoInput } from '@/components/CameraPhotoInput';
import TestimonialsSection from '@/components/TestimonialsSection';

export const dynamic = 'force-dynamic';

interface Profile {
  id: string;
  name: string;
  price: number;
  downloadSpeed: number;
  uploadSpeed: number;
  description: string | null;
}

interface Area {
  id: string;
  name: string;
}

function DaftarPageInner() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [companyName, setCompanyName] = useState('EugineBill RADIUS');
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [poweredBy, setPoweredBy] = useState('EugineBill RADIUS');

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    areaId: '',
    profileId: '',
    notes: '',
    referralCode: '',
    idCardNumber: '',
    latitude: null as number | null,
    longitude: null as number | null,
  });
  const [idCardPhoto, setIdCardPhoto] = useState<string>('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);

  const { addToast } = useToast();

  useEffect(() => {
    loadCompanyName();
    loadProfiles();
    loadAreas();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) setFormData(prev => ({ ...prev, referralCode: ref.toUpperCase() }));
  }, []);

  const loadCompanyName = async () => {
    try {
      const res = await fetch('/api/public/company');
      const data = await res.json();
      if (data.success && data.company.name) setCompanyName(data.company.name);
      if (data.success && data.company.logo) setCompanyLogo(data.company.logo);
      if (data.success && data.company.poweredBy) setPoweredBy(data.company.poweredBy);
    } catch (error) { console.error('Load company error:', error); }
  };

  const loadProfiles = async () => {
    try {
      const res = await fetch('/api/public/profiles');
      const data = await res.json();
      setProfiles(data.profiles || []);
    } catch (error) { console.error('Failed to load profiles:', error); }
    finally { setLoading(false); }
  };

  const loadAreas = async () => {
    try {
      const res = await fetch('/api/public/areas');
      const data = await res.json();
      setAreas(data.areas || []);
    } catch (error) { console.error('Failed to load areas:', error); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone || !formData.address || !formData.profileId) {
      addToast({ type: 'error', title: 'Form Tidak Lengkap', description: 'Mohon lengkapi semua field yang wajib diisi' });
      return;
    }
    if (!formData.latitude || !formData.longitude) {
      addToast({ type: 'error', title: 'Lokasi Diperlukan', description: 'Mohon pilih lokasi GPS Anda di peta' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, idCardPhoto }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
      } else {
        addToast({ type: 'error', title: 'Gagal', description: data.error || 'Gagal mengirim pendaftaran' });
      }
    } catch (error) {
      addToast({ type: 'error', title: 'Error', description: 'Gagal mengirim pendaftaran' });
    } finally {
      setSubmitting(false);
    }
  };

  const selectedProfile = profiles.find((p) => p.id === formData.profileId);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Loader2 className="w-12 h-12 animate-spin text-[#002c60]" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-md w-full text-center shadow-lg">
          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-200">
            <CheckCircle className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-[#002c60] mb-2">
            Pendaftaran Berhasil!
          </h2>
          <p className="text-sm text-slate-600 mb-6">
            Terima kasih telah mendaftar. Tim teknisi kami akan segera menghubungi Anda melalui WhatsApp untuk mengonfirmasi jadwal pemasangan.
          </p>
          <button
            onClick={() => {
              setSuccess(false);
              setFormData({ name: '', phone: '', email: '', address: '', areaId: '', profileId: '', notes: '', referralCode: '', idCardNumber: '', latitude: null, longitude: null });
              setIdCardPhoto('');
            }}
            className="w-full px-4 py-3 bg-[#002c60] hover:bg-[#1b437c] text-white text-sm font-semibold rounded-xl transition-all shadow-sm"
          >
            Daftar Kembali
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          {companyLogo ? (
            <div className="flex justify-center mb-3">
              <img src={companyLogo} alt={companyName} className="h-16 max-w-[220px] object-contain drop-shadow-sm" />
            </div>
          ) : (
            <div className="inline-flex items-center justify-center w-14 h-14 bg-[#002c60] text-white rounded-2xl shadow-md mb-3">
              <Wifi className="w-7 h-7" />
            </div>
          )}
          <h1 className="text-2xl font-extrabold text-[#002c60]">
            {companyName}
          </h1>
          <p className="text-sm text-slate-500 mt-1">Formulir Pendaftaran Layanan Internet</p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 pb-4 mb-5 border-b border-slate-100">
            <div className="p-2 bg-[#002c60]/10 text-[#002c60] rounded-xl">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Formulir Pendaftaran Baru</h2>
              <p className="text-xs text-slate-500">Lengkapi data di bawah ini untuk memesan layanan</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Personal Info Section */}
            <div className="space-y-4">
              <p className="text-xs font-bold text-[#002c60] uppercase tracking-wider flex items-center gap-2">
                <span className="w-4 h-[2px] bg-[#002c60]"></span>
                Informasi Pelanggan
              </p>

              {/* Name */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1.5">
                  <UserPlus className="w-3.5 h-3.5 text-[#002c60]" />
                  Nama Lengkap <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Nama lengkap Anda sesuai KTP"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:border-[#002c60] focus:ring-2 focus:ring-[#002c60]/20 transition-all outline-none"
                  required
                />
              </div>

              {/* Phone */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1.5">
                  <Phone className="w-3.5 h-3.5 text-[#002c60]" />
                  Nomor WhatsApp <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  placeholder="Contoh: 081234567890"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:border-[#002c60] focus:ring-2 focus:ring-[#002c60]/20 transition-all outline-none"
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">Nomor aktif untuk konfirmasi pemasangan</p>
              </div>

              {/* Email */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1.5">
                  <Mail className="w-3.5 h-3.5 text-[#002c60]" />
                  Email (Opsional)
                </label>
                <input
                  type="email"
                  placeholder="email@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:border-[#002c60] focus:ring-2 focus:ring-[#002c60]/20 transition-all outline-none"
                />
              </div>

              {/* Address */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1.5">
                  <Home className="w-3.5 h-3.5 text-[#002c60]" />
                  Alamat Lengkap Pemasangan <span className="text-rose-500">*</span>
                </label>
                <textarea
                  placeholder="Nama jalan, nomor rumah, RT/RW, kelurahan, kecamatan"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:border-[#002c60] focus:ring-2 focus:ring-[#002c60]/20 transition-all outline-none resize-none"
                  rows={2}
                  required
                />
              </div>

              {/* Area */}
              {areas.length > 0 && (
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1.5">
                    <Map className="w-3.5 h-3.5 text-[#002c60]" />
                    Wilayah / Area Layanan
                  </label>
                  <select
                    value={formData.areaId}
                    onChange={(e) => setFormData({ ...formData, areaId: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-800 focus:border-[#002c60] focus:ring-2 focus:ring-[#002c60]/20 transition-all outline-none cursor-pointer font-medium"
                  >
                    <option value="">-- Pilih Wilayah / Area Layanan --</option>
                    {areas.map((area) => (
                      <option key={area.id} value={area.id}>{area.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* GPS Location */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#002c60]" />
                  Lokasi GPS Pemasangan <span className="text-rose-500">*</span>
                </label>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    {/* Auto GPS Button */}
                    <button
                      type="button"
                      onClick={async () => {
                        if (!navigator.geolocation) {
                          addToast({ type: 'error', title: 'GPS Tidak Didukung', description: 'Browser Anda tidak mendukung GPS' });
                          return;
                        }

                        setSubmitting(true);
                        navigator.geolocation.getCurrentPosition(
                          (position) => {
                            setFormData({
                              ...formData,
                              latitude: position.coords.latitude,
                              longitude: position.coords.longitude,
                            });
                            addToast({ type: 'success', title: 'Berhasil!', description: 'Lokasi GPS berhasil didapatkan' });
                            setSubmitting(false);
                          },
                          (error) => {
                            let errorMsg = 'Gagal mendapatkan lokasi GPS';
                            if (error.code === 1) errorMsg = 'Akses lokasi ditolak. Mohon aktifkan izin lokasi di browser Anda.';
                            else if (error.code === 2) errorMsg = 'Lokasi tidak tersedia';
                            else if (error.code === 3) errorMsg = 'Timeout mendapatkan lokasi';
                            addToast({ type: 'error', title: 'GPS Error', description: errorMsg });
                            setSubmitting(false);
                          },
                          {
                            enableHighAccuracy: true,
                            timeout: 10000,
                            maximumAge: 0,
                          }
                        );
                      }}
                      disabled={submitting}
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold bg-[#002c60] hover:bg-[#1b437c] disabled:bg-slate-300 !text-white rounded-xl transition-all shadow-xs"
                    >
                      {submitting ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> <span className="!text-white">Mengambil...</span></>
                      ) : (
                        <><MapPin className="w-3.5 h-3.5 text-white" /> <span className="!text-white">GPS Otomatis</span></>
                      )}
                    </button>

                    {/* Manual GPS Button */}
                    <button
                      type="button"
                      onClick={() => setMapPickerOpen(true)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 rounded-xl transition-all"
                    >
                      <Map className="w-3.5 h-3.5 text-[#002c60]" /> Pilih di Peta
                    </button>
                  </div>

                  {formData.latitude && formData.longitude && (
                    <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl">
                      <p className="text-xs text-emerald-800 font-semibold flex items-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                        Lokasi GPS Terdeteksi
                      </p>
                      <p className="text-[11px] text-slate-600 mt-1 font-mono">
                        Koordinat: {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Package Selection Section */}
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <p className="text-xs font-bold text-[#002c60] uppercase tracking-wider flex items-center gap-2">
                <span className="w-4 h-[2px] bg-[#002c60]"></span>
                Pilihan Paket Internet
              </p>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1.5">
                  <Package className="w-3.5 h-3.5 text-[#002c60]" />
                  Paket Langganan <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.profileId}
                  onChange={(e) => setFormData({ ...formData, profileId: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-800 focus:border-[#002c60] focus:ring-2 focus:ring-[#002c60]/20 transition-all outline-none cursor-pointer font-medium"
                  required
                >
                  <option value="">-- Pilih Paket Internet --</option>
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name} - {formatCurrency(profile.price)}/bulan
                    </option>
                  ))}
                </select>
              </div>

              {selectedProfile && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <h4 className="text-xs font-bold text-[#002c60] mb-2 uppercase tracking-wide">Ringkasan Paket</h4>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Nama Paket:</span>
                      <span className="font-semibold text-slate-800">{selectedProfile.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Biaya Langganan:</span>
                      <span className="font-bold text-emerald-600 text-sm">{formatCurrency(selectedProfile.price)}/bulan</span>
                    </div>
                    {selectedProfile.description && (
                      <p className="pt-2 border-t border-slate-200 text-slate-600 text-xs">{selectedProfile.description}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ID Card Section */}
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <p className="text-xs font-bold text-[#002c60] uppercase tracking-wider flex items-center gap-2">
                <span className="w-4 h-[2px] bg-[#002c60]"></span>
                Dokumen Pendukung (Opsional)
              </p>

              {/* KTP Number */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-[#002c60]" />
                  Nomor KTP (16 Digit)
                </label>
                <input
                  type="text"
                  placeholder="320xxxxxxxxxxxxx"
                  value={formData.idCardNumber}
                  onChange={(e) => setFormData({ ...formData, idCardNumber: e.target.value.replace(/\D/g, '').slice(0, 16) })}
                  maxLength={16}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:border-[#002c60] focus:ring-2 focus:ring-[#002c60]/20 transition-all outline-none font-mono tracking-wider"
                />
              </div>

              {/* KTP Photo */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1.5">
                  <Camera className="w-3.5 h-3.5 text-[#002c60]" />
                  Foto Identitas / KTP
                </label>
                <CameraPhotoInput
                  photoUrl={idCardPhoto}
                  onRemove={() => setIdCardPhoto('')}
                  uploading={uploadingPhoto}
                  onUploadFile={async (file) => {
                    setUploadingPhoto(true);
                    try {
                      const fd = new FormData();
                      fd.append('file', file);
                      const res = await fetch('/api/public/upload-registration', { method: 'POST', body: fd });
                      const data = await res.json();
                      if (data.success) {
                        setIdCardPhoto(data.url);
                        return data.url;
                      }
                      addToast({ type: 'error', title: 'Upload Gagal', description: data.error || 'Gagal upload foto KTP' });
                      return null;
                    } catch {
                      addToast({ type: 'error', title: 'Upload Gagal', description: 'Gagal upload foto KTP' });
                      return null;
                    } finally {
                      setUploadingPhoto(false);
                    }
                  }}
                  onGpsCapture={(lat, lng) => setFormData(prev => ({ ...prev, latitude: lat, longitude: lng }))}
                  theme="light"
                  hint="Format JPG/PNG, maksimal 3MB"
                  previewClassName="h-32"
                />
              </div>
            </div>

            {/* Notes & Referral */}
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#002c60]" />
                  Catatan Tambahan (Opsional)
                </label>
                <textarea
                  placeholder="Catatan khusus atau acuan patokan rumah"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:border-[#002c60] focus:ring-2 focus:ring-[#002c60]/20 transition-all outline-none resize-none"
                  rows={2}
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1.5">
                  <Gift className="w-3.5 h-3.5 text-[#002c60]" />
                  Kode Referral (Jika Ada)
                </label>
                <input
                  type="text"
                  placeholder="Masukkan kode referral"
                  value={formData.referralCode}
                  onChange={(e) => setFormData({ ...formData, referralCode: e.target.value.toUpperCase() })}
                  maxLength={10}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:border-[#002c60] focus:ring-2 focus:ring-[#002c60]/20 transition-all outline-none font-mono uppercase tracking-wider"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-[#002c60] hover:bg-[#1b437c] disabled:bg-slate-300 !text-white text-sm font-bold rounded-xl transition-all shadow-md hover:shadow-lg mt-6"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin text-white" /> <span className="!text-white">Mengirim Pendaftaran...</span></>
              ) : (
                <><UserPlus className="w-4 h-4 text-white" /> <span className="!text-white">Kirim Pendaftaran Sekarang</span></>
              )}
            </button>

            <p className="text-[11px] text-center text-slate-400 mt-2">
              Dengan mengirimkan formulir ini, Anda menyetujui ketentuan pemesanan layanan.
            </p>
          </form>
        </div>

        {/* Testimonials Section */}
        <TestimonialsSection />

        {/* Footer */}
        <p className="text-center text-xs text-slate-400">
          Powered by <span className="font-semibold text-slate-600">{poweredBy}</span>
        </p>
      </div>

      <MapPicker
        isOpen={mapPickerOpen}
        onClose={() => setMapPickerOpen(false)}
        onSelect={(lat, lng) => {
          setFormData({ ...formData, latitude: lat, longitude: lng });
          setMapPickerOpen(false);
        }}
        initialLat={formData.latitude || undefined}
        initialLng={formData.longitude || undefined}
      />
    </div>
  );
}

export default function DaftarPage() {
  return (
    <CyberToastProvider>
      <DaftarPageInner />
    </CyberToastProvider>
  );
}

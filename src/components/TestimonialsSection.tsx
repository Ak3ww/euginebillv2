'use client'

import { Star, Quote, MapPin, CheckCircle, User, Sparkles } from 'lucide-react'

interface Testimonial {
  id: string
  name: string
  gender: 'male' | 'female'
  plan: string
  role: string
  location: string
  quote: string
  rating: number
  avatarBg: string
  badgeBg: string
}

const testimonials: Testimonial[] = [
  {
    id: '1',
    name: 'Budi Santoso',
    gender: 'male',
    plan: '30 Mbps',
    role: 'Pelanggan Rumahan',
    location: 'Puri Nirwana 3, Karadenan',
    quote:
      'Internet stabil banget, nonton YouTube dan streaming 4K tidak pernah buffering. Harganya juga sangat terjangkau untuk kualitas segini!',
    rating: 5,
    avatarBg: 'bg-gradient-to-br from-[#002c60] to-[#1b437c] text-white',
    badgeBg: 'bg-[#002c60]/10 text-[#002c60]',
  },
  {
    id: '2',
    name: 'Siti Rahayu',
    gender: 'female',
    plan: '50 Mbps',
    role: 'Pemilik Warung',
    location: 'Kampung Pisang, Karadenan',
    quote:
      'Koneksi bisnis warung saya sekarang jadi lebih lancar. Bisa terima transfer, upload foto menu tanpa masalah. Tim teknisinya juga ramah dan cepat!',
    rating: 5,
    avatarBg: 'bg-gradient-to-br from-rose-500 to-pink-600 text-white',
    badgeBg: 'bg-rose-50 text-rose-700 border border-rose-200/60',
  },
  {
    id: '3',
    name: 'Doni Pratama',
    gender: 'male',
    plan: '30 Mbps',
    role: 'Mahasiswa',
    location: 'Kampung Muara Beres',
    quote:
      'Gaming online makin seru! Ping rendah, koneksi stabil. Belajar online via Zoom juga tidak pernah putus. Recommended banget buat anak kos!',
    rating: 5,
    avatarBg: 'bg-gradient-to-br from-[#0284c7] to-[#002c60] text-white',
    badgeBg: 'bg-sky-50 text-sky-700 border border-sky-200/60',
  },
  {
    id: '4',
    name: 'Rina Kusuma',
    gender: 'female',
    plan: '20 Mbps',
    role: 'Ibu Rumah Tangga',
    location: 'Puri Nirwana 3, Karadenan',
    quote:
      'Pasangnya gampang, teknisinya datang tepat waktu dan sangat sopan. Anak-anak sekarang bisa belajar online dengan lancar dari rumah. Terima kasih!',
    rating: 5,
    avatarBg: 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white',
    badgeBg: 'bg-emerald-50 text-emerald-700 border border-emerald-200/60',
  },
  {
    id: '5',
    name: 'Hendra Wijaya',
    gender: 'male',
    plan: '50 Mbps',
    role: 'Work From Home',
    location: 'Sukahati, Cibinong',
    quote:
      'Kerja dari rumah jadi tenang tanpa takut koneksi putus pas meeting penting. Response tim support WhatsApp-nya juga gercep banget saat ada kendala!',
    rating: 5,
    avatarBg: 'bg-gradient-to-br from-indigo-600 to-[#002c60] text-white',
    badgeBg: 'bg-indigo-50 text-indigo-700 border border-indigo-200/60',
  },
  {
    id: '6',
    name: 'Dewi Astuti',
    gender: 'female',
    plan: '20 Mbps',
    role: 'Usaha Rumahan',
    location: 'Kampung Pisang, Karadenan',
    quote:
      'Sangat membantu usaha jualan online saya. Live streaming jualan di TikTok lancar jaya, pelanggan juga tidak pernah komplain soal koneksi!',
    rating: 5,
    avatarBg: 'bg-gradient-to-br from-fuchsia-500 to-purple-600 text-white',
    badgeBg: 'bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200/60',
  },
]

export default function TestimonialsSection() {
  return (
    <section className="py-14 px-4 sm:px-6 lg:px-8 bg-slate-50/70 border-t border-slate-100">
      <div className="max-w-6xl mx-auto space-y-10">
        {/* Section Header */}
        <div className="text-center space-y-2.5 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-[#002c60]/10 text-[#002c60] text-xs font-semibold rounded-full uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            Ulasan Pelanggan Setia
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#002c60] tracking-tight">
            Apa Kata Pelanggan Kami?
          </h2>
          <p className="text-sm text-slate-600">
            Kepuasan pelanggan adalah prioritas utama kami di seluruh wilayah Karadenan, Muara Beres, dan Cibinong.
          </p>
        </div>

        {/* Testimonials Grid (3 columns on large screens, 2 on medium) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((item) => {
            const initials = item.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .slice(0, 2)

            return (
              <div
                key={item.id}
                className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between space-y-4 group hover:-translate-y-0.5"
              >
                {/* Rating & Quote Icon */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {Array.from({ length: item.rating }).map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <Quote className="w-6 h-6 text-[#002c60]/15 group-hover:text-[#002c60]/30 transition-colors" />
                </div>

                {/* Quote Text */}
                <p className="text-sm text-slate-700 leading-relaxed italic font-medium">
                  &ldquo;{item.quote}&rdquo;
                </p>

                {/* User Info & Plan Badge */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {/* Notion-Style Avatar Initials with Gender-Appropriate Palette */}
                    <div className="relative">
                      <div
                        className={`w-10 h-10 rounded-full ${item.avatarBg} font-bold text-xs tracking-wider flex items-center justify-center shadow-sm flex-shrink-0`}
                      >
                        {initials}
                      </div>
                      {/* Gender-Indicator Dot */}
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-bold text-white ${
                          item.gender === 'female' ? 'bg-pink-500' : 'bg-blue-600'
                        }`}
                        title={item.gender === 'female' ? 'Pelanggan Wanita' : 'Pelanggan Pria'}
                      >
                        ✓
                      </span>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-[#002c60] flex items-center gap-1">
                        {item.name}
                      </h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <span>{item.role}</span>
                      </p>
                      <p className="text-[11px] text-slate-600 font-medium flex items-center gap-0.5 mt-0.5">
                        <MapPin className="w-3 h-3 text-[#002c60]" />
                        {item.location}
                      </p>
                    </div>
                  </div>

                  {/* Plan Badge */}
                  <span className={`px-2 py-1 text-[11px] font-extrabold rounded-lg font-mono flex-shrink-0 ${item.badgeBg}`}>
                    {item.plan}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

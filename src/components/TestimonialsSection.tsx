'use client'

import { Star, Quote, MapPin, CheckCircle } from 'lucide-react'

interface Testimonial {
  id: string
  name: string
  plan: string
  role: string
  location: string
  quote: string
  rating: number
  avatarBg: string
}

const testimonials: Testimonial[] = [
  {
    id: '1',
    name: 'Budi Santoso',
    plan: '30 Mbps',
    role: 'Pelanggan Rumahan',
    location: 'Puri Nirwana 3, Karadenan',
    quote:
      'Internet stabil banget, nonton YouTube dan streaming 4K tidak pernah buffering. Harganya juga sangat terjangkau untuk kualitas segini!',
    rating: 5,
    avatarBg: 'bg-gradient-to-br from-[#002c60] to-[#1b437c]',
  },
  {
    id: '2',
    name: 'Siti Rahayu',
    plan: '50 Mbps',
    role: 'Pemilik Warung',
    location: 'Kampung Pisang, Karadenan',
    quote:
      'Koneksi bisnis warung saya sekarang jadi lebih lancar. Bisa terima transfer, upload foto menu tanpa masalah. Tim teknisinya juga ramah dan cepat!',
    rating: 5,
    avatarBg: 'bg-gradient-to-br from-[#1b437c] to-[#0891b2]',
  },
  {
    id: '3',
    name: 'Doni Pratama',
    plan: '30 Mbps',
    role: 'Mahasiswa',
    location: 'Kampung Muara Beres',
    quote:
      'Gaming online makin seru! Ping rendah, koneksi stabil. Belajar online via Zoom juga tidak pernah putus. Recommended banget buat anak kos!',
    rating: 5,
    avatarBg: 'bg-gradient-to-br from-[#0284c7] to-[#002c60]',
  },
  {
    id: '4',
    name: 'Rina Kusuma',
    plan: '20 Mbps',
    role: 'Ibu Rumah Tangga',
    location: 'Puri Nirwana 3, Karadenan',
    quote:
      'Pasangnya gampang, teknisinya datang tepat waktu dan sangat sopan. Anak-anak sekarang bisa belajar online dengan lancar dari rumah. Terima kasih!',
    rating: 5,
    avatarBg: 'bg-gradient-to-br from-[#002c60] to-[#0d9488]',
  },
]

export default function TestimonialsSection() {
  return (
    <section className="py-12 px-4 sm:px-6 lg:px-8 bg-slate-50/60 border-t border-slate-100">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Section Header */}
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#002c60]/10 text-[#002c60] text-xs font-semibold rounded-full uppercase tracking-wider">
            <CheckCircle className="w-3.5 h-3.5" />
            Ulasan Pelanggan
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#002c60] tracking-tight">
            Apa Kata Pelanggan Kami?
          </h2>
          <p className="text-sm text-slate-600">
            Kepuasan pelanggan adalah prioritas utama kami.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {testimonials.map((item) => {
            const initials = item.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .slice(0, 2)

            return (
              <div
                key={item.id}
                className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between space-y-4 group"
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
                    {/* Avatar Initials */}
                    <div
                      className={`w-10 h-10 rounded-full ${item.avatarBg} text-white font-bold text-sm flex items-center justify-center shadow-sm flex-shrink-0`}
                    >
                      {initials}
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-[#002c60]">{item.name}</h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <span>{item.role}</span>
                        <span>&middot;</span>
                        <span className="flex items-center gap-0.5 text-slate-600 font-medium">
                          <MapPin className="w-3 h-3 text-[#002c60]" />
                          {item.location}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Plan Badge */}
                  <span className="px-2.5 py-1 bg-[#002c60]/10 text-[#002c60] text-xs font-extrabold rounded-lg font-mono flex-shrink-0">
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

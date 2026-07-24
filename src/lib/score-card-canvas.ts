/**
 * Dynamic HTML5 Canvas Score Card Generator
 * EugineBill V2.0 — High-DPI Score Card Image Exporter
 */

import { PerformanceRating } from './geo-utils';

export interface ScoreCardDetails {
  spkId: string;
  customerName: string;
  issueType: string;
  technicianName?: string;
  rating: PerformanceRating;
}

/**
 * Renders a high-resolution (800x1000) score card onto a Canvas element
 * Returns PNG Data URL for downloading or sharing as image
 */
export function generateScoreCardCanvas(details: ScoreCardDetails): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const width = 800;
    const height = 1000;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      resolve('');
      return;
    }

    // 1. Background Gradient (Oceanic Blue Enterprise Dark Theme)
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, '#001738');
    bgGradient.addColorStop(0.5, '#002c60');
    bgGradient.addColorStop(1, '#001229');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // 2. Cyberpunk Grid & Glow Accents
    ctx.strokeStyle = 'rgba(27, 67, 124, 0.25)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Outer Neon Hairline Border
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, width - 40, height - 40);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.strokeRect(28, 28, width - 56, height - 56);

    // 3. Header Title: EUGINEBILL SPEEDRUNNER
    ctx.fillStyle = '#10B981'; // Emerald
    ctx.font = '900 16px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('⚡ EUGINEBILL TECHNICIAN PERFORMANCE CARD', width / 2, 70);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 32px "Hanken Grotesk", sans-serif';
    ctx.fillText('LAPORAN HASIL PEKERJAAN SPK', width / 2, 115);

    // Divider Line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(60, 140);
    ctx.lineTo(740, 140);
    ctx.stroke();

    // 4. Rank Badge Box
    ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 2;
    ctx.roundRect(width / 2 - 180, 165, 360, 50, 25);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#34D399';
    ctx.font = '900 22px "JetBrains Mono", monospace';
    ctx.fillText(details.rating.badge.toUpperCase(), width / 2, 198);

    // Rank Title
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 28px "Hanken Grotesk", sans-serif';
    ctx.fillText(details.rating.rankTitle, width / 2, 255);

    // 5. Star Rating
    const stars = '⭐'.repeat(details.rating.stars);
    ctx.font = '32px sans-serif';
    ctx.fillText(stars, width / 2, 305);

    // 6. Huge Score Box
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    ctx.roundRect(100, 335, 600, 160, 20);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#9CA3AF';
    ctx.font = '600 14px "JetBrains Mono", monospace';
    ctx.fillText('SKOR PERFORMA EFISIENSI', width / 2, 370);

    ctx.fillStyle = '#10B981';
    ctx.font = '900 80px "JetBrains Mono", monospace';
    ctx.fillText(`${details.rating.score}`, width / 2 - 25, 455);

    ctx.fillStyle = '#9CA3AF';
    ctx.font = '700 24px "JetBrains Mono", monospace';
    ctx.fillText('/ 100', width / 2 + 85, 455);

    // 7. Work Order Info Box
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.roundRect(100, 520, 600, 140, 16);
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#9CA3AF';
    ctx.font = '600 14px "JetBrains Mono", monospace';
    ctx.fillText('ID SPK:', 130, 560);
    ctx.fillText('PELANGGAN:', 130, 600);
    ctx.fillText('PEKERJAAN:', 130, 640);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 16px "JetBrains Mono", monospace';
    ctx.fillText(`#${details.spkId.slice(-8).toUpperCase()}`, 250, 560);
    ctx.fillText(details.customerName, 250, 600);
    ctx.fillText(details.issueType.replace('_', ' '), 250, 640);

    // 8. Stats Grid (Duration, HQ Distance, ODP Distance)
    const drawStatBox = (x: number, y: number, w: number, h: number, label: string, val: string, icon: string) => {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.roundRect(x, y, w, h, 12);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#9CA3AF';
      ctx.font = '600 12px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${icon} ${label}`, x + 16, y + 30);

      ctx.fillStyle = '#F3F4F6';
      ctx.font = '700 18px "JetBrains Mono", monospace';
      ctx.fillText(val, x + 16, y + 65);
    };

    drawStatBox(100, 680, 290, 85, 'DURASI PENGERJAAN', details.rating.formattedDuration, '⏱️');
    drawStatBox(410, 680, 290, 85, 'JARAK HQ -> RUMAH', `${details.rating.distOfficeToCustomerKm} KM`, '🚗');
    drawStatBox(100, 780, 600, 85, 'ESTIMASI KABEL ODP -> RUMAH', `${details.rating.distOdpToCustomerMeters} Meter`, '🔌');

    // 9. Footer Banner
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '600 12px "JetBrains Mono", monospace';
    ctx.fillText('EUGINEBILL V2.0 — HIGH SPEED FIBER OPTIC BROADBAND', width / 2, 920);

    ctx.fillStyle = '#10B981';
    ctx.font = '700 14px "JetBrains Mono", monospace';
    ctx.fillText('www.euginebill.net', width / 2, 945);

    // Convert Canvas to PNG Data URL
    resolve(canvas.toDataURL('image/png'));
  });
}

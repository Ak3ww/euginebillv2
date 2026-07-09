'use client';

import { useState } from 'react';
import { Upload, FileSpreadsheet, Download, ChevronLeft, AlertCircle, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/components/cyberpunk/CyberToast';
import { useRouter } from 'next/navigation';

export default function ImportCustomerExcelPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<{ total: number, success: number, failed: number, errors: string[] } | null>(null);
  const { addToast } = useToast();
  const router = useRouter();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = e.target.files[0];
      if (selected.name.endsWith('.xlsx') || selected.name.endsWith('.xls')) {
        setFile(selected);
        setResults(null);
      } else {
        addToast({ type: 'error', title: 'Format Tidak Valid', description: 'Harap unggah file Excel (.xlsx atau .xls)' });
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setResults(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/admin/customers/import-excel', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setResults(data);
        if (data.failed === 0) {
          addToast({ type: 'success', title: 'Import Berhasil', description: `${data.success} pelanggan berhasil diimport.` });
        } else {
          addToast({ type: 'warning', title: 'Import Selesai dengan Error', description: `${data.success} berhasil, ${data.failed} gagal.` });
        }
      } else {
        throw new Error(data.error || 'Terjadi kesalahan saat memproses file');
      }
    } catch (e: any) {
      addToast({ type: 'error', title: 'Import Gagal', description: e.message });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/customers" className="p-2 bg-muted hover:bg-muted/80 rounded-full transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Import Pelanggan via Excel</h1>
            <p className="text-muted-foreground mt-1">Migrasi massal data pelanggan dengan mudah dan cepat.</p>
          </div>
        </div>
        <a 
          href="/api/admin/customers/download-template" 
          download
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg font-medium transition-colors border border-primary/20"
        >
          <Download className="w-4 h-4" />
          Download Template
        </a>
      </div>

      <div className="bg-card border border-border rounded-xl p-8 shadow-sm">
        <div 
          className="border-2 border-dashed border-border hover:border-primary/50 transition-colors rounded-xl p-12 flex flex-col items-center justify-center text-center cursor-pointer relative"
        >
          <input 
            type="file" 
            accept=".xlsx, .xls"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={uploading}
          />
          
          {file ? (
            <div className="space-y-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <FileSpreadsheet className="w-8 h-8 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-lg">{file.name}</p>
                <p className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
              <p className="text-xs text-primary pt-2">Klik atau drag untuk mengganti file</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                <Upload className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-lg">Pilih atau Tarik File Excel</p>
                <p className="text-sm text-muted-foreground mt-1">Gunakan template yang disediakan untuk format yang sesuai</p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 flex justify-end gap-3">
          <Link 
            href="/admin/customers"
            className="px-5 py-2.5 rounded-lg font-medium bg-muted hover:bg-muted/80 text-foreground transition-colors"
          >
            Batal
          </Link>
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="px-5 py-2.5 rounded-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {uploading ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Memproses...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Mulai Import
              </>
            )}
          </button>
        </div>
      </div>

      {results && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="p-6 border-b border-border bg-muted/30 flex items-center justify-between">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              Laporan Hasil Import
            </h3>
            <div className="flex gap-4 text-sm font-medium">
              <span className="text-blue-500">Total: {results.total}</span>
              <span className="text-green-500">Berhasil: {results.success}</span>
              <span className="text-red-500">Gagal: {results.failed}</span>
            </div>
          </div>
          
          {results.errors.length > 0 ? (
            <div className="p-0">
              <div className="px-6 py-4 bg-red-500/10 border-b border-red-500/20 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-red-500 mb-2">Terdapat beberapa baris yang gagal diimport:</h4>
                  <ul className="space-y-1.5 list-disc list-inside text-sm text-red-500/90">
                    {results.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="px-6 py-8 flex flex-col items-center justify-center text-center bg-green-500/5">
              <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
              <h4 className="font-semibold text-lg text-green-500">Semua Data Berhasil Diimport!</h4>
              <p className="text-sm text-green-500/80 mt-1">Seluruh data pelanggan dari file Excel telah tersimpan di sistem.</p>
              <button 
                onClick={() => router.push('/admin/customers')}
                className="mt-6 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
              >
                Lihat Daftar Pelanggan
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

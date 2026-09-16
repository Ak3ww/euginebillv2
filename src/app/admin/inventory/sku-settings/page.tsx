'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Layers,
  Barcode,
  Plus,
  Pencil,
  Trash2,
  Search,
  CheckCircle2,
  XCircle,
  Tag,
  Loader2,
  RefreshCw,
  SlidersHorizontal,
  Check,
  Building2,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/cyberpunk/CyberToast';
import {
  SimpleModal,
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalFooter,
  ModalInput,
  ModalLabel,
  ModalButton,
} from '@/components/cyberpunk';

interface SkuCategory {
  id: string;
  code: string;
  label: string;
  isActive: boolean;
  sortOrder: number;
  _count?: { subCategories: number };
}

interface SkuSubCategory {
  id: string;
  categoryCode: string;
  code: string;
  label: string;
  requiresBrand: boolean;
  isActive: boolean;
}

export default function SkuSettingsPage() {
  const { addToast, confirm } = useToast();

  const [activeTab, setActiveTab] = useState<'categories' | 'subcategories'>('categories');
  const [categories, setCategories] = useState<SkuCategory[]>([]);
  const [subcategories, setSubcategories] = useState<SkuSubCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [subLoading, setSubLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryCode, setSelectedCategoryCode] = useState<string>('ALL');

  // Category Modal State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<SkuCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState({
    code: '',
    label: '',
    sortOrder: 0,
    isActive: true,
  });

  // SubCategory Modal State
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [editingSubCategory, setEditingSubCategory] = useState<SkuSubCategory | null>(null);
  const [subCategoryForm, setSubCategoryForm] = useState({
    categoryCode: '',
    code: '',
    label: '',
    requiresBrand: true,
    isActive: true,
  });

  // Load categories
  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/sku-settings/categories');
      const data = await res.json();
      if (data.success) {
        setCategories(data.categories || []);
      } else {
        addToast({ type: 'error', title: 'Gagal', description: data.error || 'Gagal memuat kategori' });
      }
    } catch (e: any) {
      addToast({ type: 'error', title: 'Error', description: e.message || 'Koneksi gagal' });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  // Load subcategories
  const loadSubcategories = useCallback(async (catCode = 'ALL') => {
    setSubLoading(true);
    try {
      if (catCode === 'ALL') {
        // Fetch all categories and aggregate
        const res = await fetch('/api/admin/sku-settings/categories');
        const data = await res.json();
        if (data.success && data.categories) {
          const allSubs: SkuSubCategory[] = [];
          for (const cat of data.categories) {
            const subRes = await fetch(`/api/admin/sku-settings/categories/${cat.code}/subcategories`);
            const subData = await subRes.json();
            if (subData.success && subData.subcategories) {
              allSubs.push(...subData.subcategories);
            }
          }
          setSubcategories(allSubs);
        }
      } else {
        const res = await fetch(`/api/admin/sku-settings/categories/${catCode}/subcategories`);
        const data = await res.json();
        if (data.success) {
          setSubcategories(data.subcategories || []);
        }
      }
    } catch (e: any) {
      console.error('Error loading subcategories:', e);
    } finally {
      setSubLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    if (activeTab === 'subcategories') {
      loadSubcategories(selectedCategoryCode);
    }
  }, [activeTab, selectedCategoryCode, loadSubcategories]);

  // Save Category
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCategory) {
        // Update
        const res = await fetch(`/api/admin/sku-settings/categories/${editingCategory.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            label: categoryForm.label,
            sortOrder: categoryForm.sortOrder,
            isActive: categoryForm.isActive,
          }),
        });
        const data = await res.json();
        if (data.success) {
          addToast({ type: 'success', title: 'Berhasil', description: 'Kategori SKU berhasil diperbarui' });
          setIsCategoryModalOpen(false);
          loadCategories();
        } else {
          addToast({ type: 'error', title: 'Gagal', description: data.error });
        }
      } else {
        // Create
        const res = await fetch('/api/admin/sku-settings/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(categoryForm),
        });
        const data = await res.json();
        if (data.success) {
          addToast({ type: 'success', title: 'Berhasil', description: data.message });
          setIsCategoryModalOpen(false);
          loadCategories();
        } else {
          addToast({ type: 'error', title: 'Gagal', description: data.error });
        }
      }
    } catch (e: any) {
      addToast({ type: 'error', title: 'Error', description: e.message || 'Gagal menyimpan kategori' });
    }
  };

  // Delete Category
  const handleDeleteCategory = async (cat: SkuCategory) => {
    const ok = await confirm({
      title: 'Hapus Kategori SKU',
      message: `Yakin ingin menghapus kategori "${cat.code} - ${cat.label}"?`,
      confirmText: 'Ya, Hapus',
      cancelText: 'Batal',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/admin/sku-settings/categories/${cat.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        addToast({ type: 'success', title: 'Berhasil', description: data.message });
        loadCategories();
      } else {
        addToast({ type: 'error', title: 'Gagal', description: data.error });
      }
    } catch (e: any) {
      addToast({ type: 'error', title: 'Error', description: e.message || 'Gagal menghapus' });
    }
  };

  // Save SubCategory
  const handleSaveSubCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingSubCategory) {
        // Update
        const res = await fetch(`/api/admin/sku-settings/subcategories/${editingSubCategory.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            label: subCategoryForm.label,
            requiresBrand: subCategoryForm.requiresBrand,
            isActive: subCategoryForm.isActive,
          }),
        });
        const data = await res.json();
        if (data.success) {
          addToast({ type: 'success', title: 'Berhasil', description: 'Sub-kategori berhasil diperbarui' });
          setIsSubModalOpen(false);
          loadSubcategories(selectedCategoryCode);
        } else {
          addToast({ type: 'error', title: 'Gagal', description: data.error });
        }
      } else {
        // Create
        const res = await fetch(`/api/admin/sku-settings/categories/${subCategoryForm.categoryCode}/subcategories`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subCategoryForm),
        });
        const data = await res.json();
        if (data.success) {
          addToast({ type: 'success', title: 'Berhasil', description: data.message });
          setIsSubModalOpen(false);
          loadSubcategories(selectedCategoryCode);
          loadCategories(); // update counts
        } else {
          addToast({ type: 'error', title: 'Gagal', description: data.error });
        }
      }
    } catch (e: any) {
      addToast({ type: 'error', title: 'Error', description: e.message || 'Gagal menyimpan sub-kategori' });
    }
  };

  // Delete SubCategory
  const handleDeleteSubCategory = async (sub: SkuSubCategory) => {
    const ok = await confirm({
      title: 'Hapus Sub-Kategori SKU',
      message: `Yakin ingin menghapus sub-kategori "${sub.code} - ${sub.label}"?`,
      confirmText: 'Ya, Hapus',
      cancelText: 'Batal',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/admin/sku-settings/subcategories/${sub.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        addToast({ type: 'success', title: 'Berhasil', description: data.message });
        loadSubcategories(selectedCategoryCode);
        loadCategories();
      } else {
        addToast({ type: 'error', title: 'Gagal', description: data.error });
      }
    } catch (e: any) {
      addToast({ type: 'error', title: 'Error', description: e.message || 'Gagal menghapus' });
    }
  };

  // Filtered lists
  const filteredCategories = categories.filter((c) =>
    c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSubcategories = subcategories.filter((s) => {
    const matchesSearch =
      s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.categoryCode.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Barcode className="w-5 h-5 text-primary" />
            Setting Kamus SKU Inventori
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Kelola kamus kategori dan sub-kategori untuk auto-generator SKU barang baku EMG secara dinamis tanpa sentuh kode program.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'categories' ? (
            <Button
              size="sm"
              onClick={() => {
                setEditingCategory(null);
                setCategoryForm({ code: '', label: '', sortOrder: categories.length + 1, isActive: true });
                setIsCategoryModalOpen(true);
              }}
              className="gap-1.5 text-xs font-semibold"
            >
              <Plus className="w-4 h-4" />
              Tambah Kategori
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => {
                setEditingSubCategory(null);
                setSubCategoryForm({
                  categoryCode: selectedCategoryCode !== 'ALL' ? selectedCategoryCode : categories[0]?.code || 'HW',
                  code: '',
                  label: '',
                  requiresBrand: true,
                  isActive: true,
                });
                setIsSubModalOpen(true);
              }}
              className="gap-1.5 text-xs font-semibold"
            >
              <Plus className="w-4 h-4" />
              Tambah Sub-Kategori
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <button
          onClick={() => setActiveTab('categories')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
            activeTab === 'categories'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Kategori Induk ({categories.length})
        </button>

        <button
          onClick={() => setActiveTab('subcategories')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
            activeTab === 'subcategories'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <Tag className="w-3.5 h-3.5" />
          Sub-Kategori ({subcategories.length})
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border">
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder={activeTab === 'categories' ? 'Cari kode / label kategori...' : 'Cari kode / label sub-kategori...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {activeTab === 'subcategories' && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Filter Kategori:</span>
            <select
              value={selectedCategoryCode}
              onChange={(e) => setSelectedCategoryCode(e.target.value)}
              className="text-xs py-1.5 px-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">Semua Kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.code}>
                  {c.code} — {c.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => (activeTab === 'categories' ? loadCategories() : loadSubcategories(selectedCategoryCode))}
          className="text-xs gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${(loading || subLoading) ? 'animate-spin' : ''}`} />
          Segarkan
        </Button>
      </div>

      {/* Tab 1: Categories Table */}
      {activeTab === 'categories' && (
        <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">Memuat kamus kategori...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b border-border text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Kode</th>
                    <th className="px-4 py-3 font-semibold">Label Kategori</th>
                    <th className="px-4 py-3 font-semibold text-center">Urutan</th>
                    <th className="px-4 py-3 font-semibold text-center">Sub-Kategori</th>
                    <th className="px-4 py-3 font-semibold text-center">Status</th>
                    <th className="px-4 py-3 font-semibold text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredCategories.map((cat) => (
                    <tr key={cat.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-foreground">
                        <span className="px-2 py-0.5 rounded bg-muted border border-border">
                          {cat.code}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">{cat.label}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{cat.sortOrder}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary">
                          {cat._count?.subCategories || 0} sub-tipe
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {cat.isActive ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                            <XCircle className="w-3.5 h-3.5" />
                            Nonaktif
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setEditingCategory(cat);
                              setCategoryForm({
                                code: cat.code,
                                label: cat.label,
                                sortOrder: cat.sortOrder,
                                isActive: cat.isActive,
                              });
                              setIsCategoryModalOpen(true);
                            }}
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                            title="Edit Kategori"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(cat)}
                            className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500"
                            title="Hapus Kategori"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredCategories.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        Tidak ada kategori SKU ditemukan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Subcategories Table */}
      {activeTab === 'subcategories' && (
        <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
          {subLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">Memuat sub-kategori...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b border-border text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Kategori Induk</th>
                    <th className="px-4 py-3 font-semibold">Kode Sub</th>
                    <th className="px-4 py-3 font-semibold">Label Sub-Kategori</th>
                    <th className="px-4 py-3 font-semibold text-center">Aturan Merek</th>
                    <th className="px-4 py-3 font-semibold text-center">Status</th>
                    <th className="px-4 py-3 font-semibold text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredSubcategories.map((sub) => (
                    <tr key={sub.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded font-mono text-[11px] font-bold bg-primary/10 text-primary">
                          {sub.categoryCode}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-foreground">
                        <span className="px-2 py-0.5 rounded bg-muted border border-border">
                          {sub.code}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">{sub.label}</td>
                      <td className="px-4 py-3 text-center">
                        {sub.requiresBrand ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            Wajib Merek
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground border border-border">
                            Generic / Spek
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {sub.isActive ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                            <XCircle className="w-3.5 h-3.5" />
                            Nonaktif
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setEditingSubCategory(sub);
                              setSubCategoryForm({
                                categoryCode: sub.categoryCode,
                                code: sub.code,
                                label: sub.label,
                                requiresBrand: sub.requiresBrand,
                                isActive: sub.isActive,
                              });
                              setIsSubModalOpen(true);
                            }}
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                            title="Edit Sub-Kategori"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteSubCategory(sub)}
                            className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500"
                            title="Hapus Sub-Kategori"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredSubcategories.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        Tidak ada sub-kategori SKU ditemukan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Category Add/Edit Modal */}
      <SimpleModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        size="md"
      >
        <ModalHeader>
          <ModalTitle>
            {editingCategory ? `Edit Kategori SKU: ${editingCategory.code}` : 'Tambah Kategori SKU Baru'}
          </ModalTitle>
        </ModalHeader>
        <form onSubmit={handleSaveCategory}>
          <ModalBody className="space-y-4">
            <div>
              <ModalLabel required>Kode Kategori (2-5 Karakter)</ModalLabel>
              <ModalInput
                type="text"
                placeholder="Contoh: HW, CPE, PAS, CAB"
                value={categoryForm.code}
                disabled={!!editingCategory}
                onChange={(e) => setCategoryForm({ ...categoryForm, code: e.target.value.toUpperCase() })}
                required
                className="font-mono text-xs uppercase"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Kode baku SKU EMG (misal HW untuk Hardware, CAB untuk Kabel).
              </p>
            </div>

            <div>
              <ModalLabel required>Nama Label Kategori</ModalLabel>
              <ModalInput
                type="text"
                placeholder="Contoh: Hardware Utama"
                value={categoryForm.label}
                onChange={(e) => setCategoryForm({ ...categoryForm, label: e.target.value })}
                required
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <ModalLabel>Urutan Tampil</ModalLabel>
                <ModalInput
                  type="number"
                  value={categoryForm.sortOrder}
                  onChange={(e) => setCategoryForm({ ...categoryForm, sortOrder: parseInt(e.target.value) || 0 })}
                  className="text-xs"
                />
              </div>

              <div className="flex flex-col justify-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground">
                  <input
                    type="checkbox"
                    checked={categoryForm.isActive}
                    onChange={(e) => setCategoryForm({ ...categoryForm, isActive: e.target.checked })}
                    className="w-4 h-4 rounded text-primary focus:ring-primary border-border"
                  />
                  Status Aktif
                </label>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <ModalButton type="button" variant="secondary" onClick={() => setIsCategoryModalOpen(false)}>
              Batal
            </ModalButton>
            <ModalButton type="submit" variant="primary">
              Simpan Kategori
            </ModalButton>
          </ModalFooter>
        </form>
      </SimpleModal>

      {/* SubCategory Add/Edit Modal */}
      <SimpleModal
        isOpen={isSubModalOpen}
        onClose={() => setIsSubModalOpen(false)}
        size="md"
      >
        <ModalHeader>
          <ModalTitle>
            {editingSubCategory ? `Edit Sub-Kategori SKU: ${editingSubCategory.code}` : 'Tambah Sub-Kategori SKU'}
          </ModalTitle>
        </ModalHeader>
        <form onSubmit={handleSaveSubCategory}>
          <ModalBody className="space-y-4">
            <div>
              <ModalLabel required>Kategori Induk</ModalLabel>
              <select
                value={subCategoryForm.categoryCode}
                disabled={!!editingSubCategory}
                onChange={(e) => setSubCategoryForm({ ...subCategoryForm, categoryCode: e.target.value })}
                required
                className="w-full text-xs py-2 px-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.code}>
                    {c.code} — {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <ModalLabel required>Kode Sub-Kategori (2-5 Karakter)</ModalLabel>
              <ModalInput
                type="text"
                placeholder="Contoh: ONT, OLT, DRP, TIE, TAP"
                value={subCategoryForm.code}
                disabled={!!editingSubCategory}
                onChange={(e) => setSubCategoryForm({ ...subCategoryForm, code: e.target.value.toUpperCase() })}
                required
                className="font-mono text-xs uppercase"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Singkatan sub-kategori dalam format SKU (misal: EMG-CPE-<strong>ONT</strong>-ZTE-F609V9).
              </p>
            </div>

            <div>
              <ModalLabel required>Nama Label Sub-Kategori</ModalLabel>
              <ModalInput
                type="text"
                placeholder="Contoh: Modem / ONT / ONU"
                value={subCategoryForm.label}
                onChange={(e) => setSubCategoryForm({ ...subCategoryForm, label: e.target.value })}
                required
                className="text-xs"
              />
            </div>

            <div className="p-3 bg-muted/40 rounded-lg border border-border space-y-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={subCategoryForm.requiresBrand}
                  onChange={(e) => setSubCategoryForm({ ...subCategoryForm, requiresBrand: e.target.checked })}
                  className="w-4 h-4 rounded text-primary focus:ring-primary border-border"
                />
                Barang Biasanya Bermerek (Branded)
              </label>
              <p className="text-[10px] text-muted-foreground">
                Jika dicentang, wizard tambah barang akan secara default menanyakan <strong>Merek (Brand)</strong> dan <strong>Model/Tipe</strong> (contoh: ZTE F609). Jika tidak, wizard akan menanyakan <strong>Spesifikasi</strong> (contoh: 16P, 60MM).
              </p>
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={subCategoryForm.isActive}
                  onChange={(e) => setSubCategoryForm({ ...subCategoryForm, isActive: e.target.checked })}
                  className="w-4 h-4 rounded text-primary focus:ring-primary border-border"
                />
                Status Aktif
              </label>
            </div>
          </ModalBody>
          <ModalFooter>
            <ModalButton type="button" variant="secondary" onClick={() => setIsSubModalOpen(false)}>
              Batal
            </ModalButton>
            <ModalButton type="submit" variant="primary">
              Simpan Sub-Kategori
            </ModalButton>
          </ModalFooter>
        </form>
      </SimpleModal>
    </div>
  );
}

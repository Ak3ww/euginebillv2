'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  FileText, Plus, Eye, Ban, RefreshCw, Loader2,
  ChevronLeft, ChevronRight, Search, Settings2,
  Trash2, Edit2, Check, ArrowLeft, BookOpen,
  ClipboardList, LayoutTemplate,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ─── Types ────────────────────────────────────────────────────────────────────

type DocStatus = 'DRAFT' | 'ISSUED' | 'VOID';
type DocCategory = 'MOU' | 'FAK' | 'KWT' | 'SJ' | 'BAST' | 'SPK';

interface FieldSchema {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'date' | 'number' | 'select';
  options?: string[];
  required?: boolean;
  autoFill?: boolean; // e.g. nomor_dokumen
}

interface DocumentTemplate {
  id: string;
  category: string;
  name: string;
  bodyHtml: string;
  fieldsSchema: FieldSchema[];
  isActive: boolean;
  _count?: { documents: number };
}

interface GeneratedDocument {
  id: string;
  category: string;
  documentNumber: string | null;
  status: DocStatus;
  issuedAt: string | null;
  createdAt: string;
  createdBy: string | null;
  relatedEntity: string | null;
  template: { id: string; name: string; category: string };
}

const DEPT_OPTIONS = ['RW01', 'RW14', 'RW15', 'RW16', 'RW06', 'RW07', 'HO', 'LOG', 'BILL'];
const CATEGORIES: DocCategory[] = ['MOU', 'FAK', 'KWT', 'SJ', 'BAST', 'SPK'];

const CATEGORY_LABELS: Record<string, string> = {
  MOU: 'MOU — Perjanjian',
  FAK: 'FAK — Invoice',
  KWT: 'KWT — Kwitansi',
  SJ: 'SJ — Surat Jalan',
  BAST: 'BAST — Serah Terima',
  SPK: 'SPK — Surat Perintah',
};

function statusBadge(status: DocStatus) {
  const map: Record<DocStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
    ISSUED: { label: 'Terbit', variant: 'default' },
    DRAFT: { label: 'Draft', variant: 'secondary' },
    VOID: { label: 'Void', variant: 'destructive' },
  };
  const m = map[status] || map.DRAFT;
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  return (
    <div className="space-y-6 p-6">
      {/* Top Module Navigation */}
      <div className="flex items-center gap-2 border-b border-border pb-3 overflow-x-auto text-xs font-medium">
        <Link
          href="/admin/invoices"
          className="px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          Tagihan Bulanan PPPoE
        </Link>
        <Link
          href="/admin/manual-invoices"
          className="px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          Invoice Manual
        </Link>
        <Link
          href="/admin/documents"
          className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary font-semibold border border-primary/20 transition-colors flex items-center gap-1.5"
        >
          <FileText className="w-3.5 h-3.5" />
          Document Maker (MOU, BAST, SPK, SJ, KWT)
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dokumen Perusahaan</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Buat, terbitkan, dan kelola dokumen resmi perusahaan
        </p>
      </div>

      <Tabs defaultValue="issued">
        <TabsList className="border-b border-border w-full justify-start rounded-none h-auto p-0 bg-transparent gap-0">
          {[
            { value: 'issued', icon: <ClipboardList className="w-4 h-4" />, label: 'Dokumen Terbit' },
            { value: 'create', icon: <Plus className="w-4 h-4" />, label: 'Buat Dokumen' },
            { value: 'templates', icon: <LayoutTemplate className="w-4 h-4" />, label: 'Kelola Template' },
          ].map(tab => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="flex items-center gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 text-sm font-medium"
            >
              {tab.icon}
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="issued" className="pt-4">
          <IssuedDocumentsTab />
        </TabsContent>
        <TabsContent value="create" className="pt-4">
          <CreateDocumentTab />
        </TabsContent>
        <TabsContent value="templates" className="pt-4">
          <TemplatesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Tab 1: Issued Documents ──────────────────────────────────────────────────

function IssuedDocumentsTab() {
  const [docs, setDocs] = useState<GeneratedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [voidModal, setVoidModal] = useState<GeneratedDocument | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<GeneratedDocument | null>(null);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (category !== 'all') params.set('category', category);
      if (status !== 'all') params.set('status', status);
      const res = await fetch(`/api/documents?${params}`);
      const data = await res.json();
      setDocs(data.documents || []);
      setTotalPages(data.totalPages || 1);
    } finally {
      setLoading(false);
    }
  }, [page, search, category, status]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  async function handleVoid() {
    if (!voidModal || !voidReason.trim()) return;
    setVoiding(true);
    try {
      const res = await fetch(`/api/documents/${voidModal.id}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: voidReason }),
      });
      if (res.ok) {
        setVoidModal(null);
        setVoidReason('');
        fetchDocs();
      }
    } finally {
      setVoiding(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cari nomor dokumen..."
            className="pl-9"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Select value={category} onValueChange={v => { setCategory(v); setPage(1); }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Semua kategori" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Kategori</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={v => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Semua status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            <SelectItem value="ISSUED">Terbit</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="VOID">Void</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={fetchDocs}><RefreshCw className="w-4 h-4" /></Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center items-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nomor Dokumen</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tanggal Terbit</TableHead>
                  <TableHead>Dibuat Oleh</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {docs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                      Belum ada dokumen
                    </TableCell>
                  </TableRow>
                ) : docs.map(doc => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-mono text-sm font-medium">{doc.documentNumber || '—'}</TableCell>
                    <TableCell><Badge variant="outline">{doc.category}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{doc.template?.name || '—'}</TableCell>
                    <TableCell>{statusBadge(doc.status)}</TableCell>
                    <TableCell className="text-sm">{formatDate(doc.issuedAt)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{doc.createdBy || '—'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => setPreviewDoc(doc)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        {doc.status === 'ISSUED' && (
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setVoidModal(doc)}>
                            <Ban className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground">Hal {page} / {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Void Modal */}
      <Dialog open={!!voidModal} onOpenChange={o => { if (!o) setVoidModal(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Batalkan Dokumen</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Nomor <span className="font-mono font-medium text-foreground">{voidModal?.documentNumber}</span> akan ditandai VOID.
            Nomor ini tidak akan bisa dipakai ulang.
          </p>
          <div className="space-y-2">
            <Label>Alasan pembatalan <span className="text-destructive">*</span></Label>
            <Textarea
              placeholder="Tuliskan alasan pembatalan..."
              value={voidReason}
              onChange={e => setVoidReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidModal(null)}>Batal</Button>
            <Button variant="destructive" onClick={handleVoid} disabled={voiding || !voidReason.trim()}>
              {voiding ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Batalkan Dokumen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      <Dialog open={!!previewDoc} onOpenChange={o => { if (!o) setPreviewDoc(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-mono">{previewDoc?.documentNumber}</DialogTitle>
          </DialogHeader>
          <div className="text-sm space-y-1">
            <p><span className="text-muted-foreground">Kategori:</span> {previewDoc?.category}</p>
            <p><span className="text-muted-foreground">Template:</span> {previewDoc?.template?.name}</p>
            <p><span className="text-muted-foreground">Status:</span> {previewDoc?.status}</p>
            <p><span className="text-muted-foreground">Tanggal Terbit:</span> {formatDate(previewDoc?.issuedAt || null)}</p>
          </div>
          {previewDoc && (previewDoc as any).dataJson?._renderedHtml && (
            <div
              className="border rounded-md p-4 bg-muted/30 text-sm max-h-96 overflow-auto whitespace-pre-wrap font-mono"
              dangerouslySetInnerHTML={{ __html: (previewDoc as any).dataJson._renderedHtml }}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewDoc(null)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Tab 2: Create Document (Wizard) ─────────────────────────────────────────

function CreateDocumentTab() {
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [selectedCategory, setSelectedCategory] = useState<DocCategory | null>(null);
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [dept, setDept] = useState('HO');
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewNumber, setPreviewNumber] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [issuedResult, setIssuedResult] = useState<{ documentNumber: string; documentId: string } | null>(null);

  async function loadTemplates(cat: DocCategory) {
    setLoadingTemplates(true);
    try {
      const res = await fetch(`/api/documents/templates?category=${cat}`);
      const data = await res.json();
      setTemplates((data.templates || []).filter((t: DocumentTemplate) => t.isActive));
    } finally {
      setLoadingTemplates(false);
    }
  }

  async function doPreview() {
    if (!selectedTemplate) return;
    setPreviewing(true);
    try {
      const res = await fetch('/api/documents/generate/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: selectedTemplate.id, dataJson: formData, dept }),
      });
      const data = await res.json();
      setPreviewHtml(data.previewHtml || '');
      setPreviewNumber(data.previewNumber || '');
      setWizardStep(4);
    } finally {
      setPreviewing(false);
    }
  }

  async function doIssue() {
    if (!selectedTemplate) return;
    setIssuing(true);
    try {
      const res = await fetch('/api/documents/generate/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: selectedTemplate.id, dataJson: formData, dept }),
      });
      const data = await res.json();
      if (data.success) {
        setIssuedResult({ documentNumber: data.documentNumber, documentId: data.document?.id });
        setWizardStep(5);
      }
    } finally {
      setIssuing(false);
    }
  }

  function resetWizard() {
    setWizardStep(1);
    setSelectedCategory(null);
    setTemplates([]);
    setSelectedTemplate(null);
    setFormData({});
    setDept('HO');
    setPreviewHtml('');
    setPreviewNumber('');
    setIssuedResult(null);
  }

  // Step 1: Choose category
  if (wizardStep === 1) {
    return (
      <div className="space-y-4 max-w-2xl">
        <p className="text-sm text-muted-foreground">Pilih kategori dokumen yang akan dibuat</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => {
                setSelectedCategory(cat);
                loadTemplates(cat);
                setWizardStep(2);
              }}
              className="border border-border rounded-lg p-4 text-left hover:border-primary hover:bg-muted/30 transition-colors"
            >
              <p className="font-semibold text-sm">{cat}</p>
              <p className="text-xs text-muted-foreground mt-1">{CATEGORY_LABELS[cat]}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Step 2: Choose template
  if (wizardStep === 2) {
    return (
      <div className="space-y-4 max-w-2xl">
        <Button variant="ghost" size="sm" onClick={() => setWizardStep(1)} className="gap-1">
          <ArrowLeft className="w-4 h-4" /> Kembali
        </Button>
        <p className="text-sm text-muted-foreground">Pilih template untuk kategori <strong>{selectedCategory}</strong></p>
        {loadingTemplates ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : templates.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">
            Belum ada template untuk kategori ini. Buat template di tab &quot;Kelola Template&quot; terlebih dahulu.
          </CardContent></Card>
        ) : (
          <div className="space-y-2">
            {templates.map(tpl => (
              <button
                key={tpl.id}
                onClick={() => { setSelectedTemplate(tpl); setFormData({}); setWizardStep(3); }}
                className="w-full border border-border rounded-lg p-4 text-left hover:border-primary hover:bg-muted/30 transition-colors"
              >
                <p className="font-medium text-sm">{tpl.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{tpl._count?.documents || 0} dokumen terbit</p>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Step 3: Fill form
  if (wizardStep === 3 && selectedTemplate) {
    const fields = (selectedTemplate.fieldsSchema || []).filter((f: FieldSchema) => !f.autoFill && f.key !== 'nomor_dokumen');
    return (
      <div className="space-y-4 max-w-lg">
        <Button variant="ghost" size="sm" onClick={() => setWizardStep(2)} className="gap-1">
          <ArrowLeft className="w-4 h-4" /> Kembali
        </Button>
        <div>
          <p className="font-medium">{selectedTemplate.name}</p>
          <p className="text-sm text-muted-foreground">Isi data dokumen</p>
        </div>

        <div className="space-y-4">
          {/* DEPT field for categories that need it */}
          {['MOU', 'FAK', 'BAST'].includes(selectedCategory || '') && (
            <div className="space-y-1.5">
              <Label>Kode Wilayah / Divisi</Label>
              <Select value={dept} onValueChange={setDept}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEPT_OPTIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {fields.map((field: FieldSchema) => (
            <div key={field.key} className="space-y-1.5">
              <Label htmlFor={field.key}>{field.label}{field.required && <span className="text-destructive ml-1">*</span>}</Label>
              {field.type === 'textarea' ? (
                <Textarea
                  id={field.key}
                  value={formData[field.key] || ''}
                  onChange={e => setFormData(p => ({ ...p, [field.key]: e.target.value }))}
                  rows={3}
                />
              ) : field.type === 'select' && field.options ? (
                <Select value={formData[field.key] || ''} onValueChange={v => setFormData(p => ({ ...p, [field.key]: v }))}>
                  <SelectTrigger><SelectValue placeholder="Pilih..." /></SelectTrigger>
                  <SelectContent>
                    {field.options.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id={field.key}
                  type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                  value={formData[field.key] || ''}
                  onChange={e => setFormData(p => ({ ...p, [field.key]: e.target.value }))}
                />
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={doPreview} disabled={previewing} className="gap-2">
            {previewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
            Preview Dokumen
          </Button>
        </div>
      </div>
    );
  }

  // Step 4: Preview
  if (wizardStep === 4) {
    return (
      <div className="space-y-4 max-w-2xl">
        <Button variant="ghost" size="sm" onClick={() => setWizardStep(3)} className="gap-1">
          <ArrowLeft className="w-4 h-4" /> Kembali
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pratinjau Dokumen</CardTitle>
            <CardDescription>
              Nomor yang akan terbit: <span className="font-mono font-semibold text-foreground">{previewNumber}</span>
              <span className="ml-2 text-xs text-amber-600">(nomor belum dikonsumsi)</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="border rounded p-4 bg-white text-sm min-h-32 whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ __html: previewHtml || '<p class="text-gray-400">Tidak ada isi preview</p>' }}
            />
          </CardContent>
        </Card>
        <Button onClick={doIssue} disabled={issuing} className="gap-2">
          {issuing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Terbitkan Dokumen
        </Button>
      </div>
    );
  }

  // Step 5: Success
  if (wizardStep === 5 && issuedResult) {
    return (
      <div className="max-w-md space-y-4">
        <Card className="border-green-200 bg-green-50/30">
          <CardContent className="pt-6 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <Check className="w-6 h-6 text-green-600" />
            </div>
            <p className="font-semibold">Dokumen Berhasil Diterbitkan</p>
            <p className="font-mono text-lg font-bold text-primary">{issuedResult.documentNumber}</p>
            <p className="text-sm text-muted-foreground">Nomor telah dikonsumsi dan dicatat di sistem</p>
          </CardContent>
        </Card>
        <Button variant="outline" onClick={resetWizard} className="w-full gap-2">
          <Plus className="w-4 h-4" /> Buat Dokumen Baru
        </Button>
      </div>
    );
  }

  return null;
}

// ─── Tab 3: Templates ─────────────────────────────────────────────────────────

function TemplatesTab() {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DocumentTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    category: 'MOU',
    name: '',
    bodyHtml: '',
    fieldsSchema: '[]',
  });
  const [formError, setFormError] = useState('');

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/documents/templates');
      const data = await res.json();
      setTemplates(data.templates || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  function openCreate() {
    setEditingTemplate(null);
    setForm({ category: 'MOU', name: '', bodyHtml: '', fieldsSchema: '[]' });
    setFormError('');
    setShowForm(true);
  }

  function openEdit(tpl: DocumentTemplate) {
    setEditingTemplate(tpl);
    setForm({
      category: tpl.category,
      name: tpl.name,
      bodyHtml: tpl.bodyHtml,
      fieldsSchema: JSON.stringify(tpl.fieldsSchema || [], null, 2),
    });
    setFormError('');
    setShowForm(true);
  }

  async function saveTemplate() {
    setFormError('');
    let parsedSchema: any;
    try { parsedSchema = JSON.parse(form.fieldsSchema); } catch {
      setFormError('fieldsSchema harus JSON array yang valid');
      return;
    }

    setSaving(true);
    try {
      const url = editingTemplate ? `/api/documents/templates/${editingTemplate.id}` : '/api/documents/templates';
      const method = editingTemplate ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, fieldsSchema: parsedSchema }),
      });
      if (res.ok) {
        setShowForm(false);
        fetchTemplates();
      } else {
        const d = await res.json();
        setFormError(d.error || 'Gagal menyimpan template');
      }
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(tpl: DocumentTemplate) {
    await fetch(`/api/documents/templates/${tpl.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !tpl.isActive }),
    });
    fetchTemplates();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{templates.length} template tersimpan</p>
        <Button size="sm" onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" /> Tambah Template
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Template</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dokumen Terbit</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                      Belum ada template. Klik &quot;Tambah Template&quot; untuk memulai.
                    </TableCell>
                  </TableRow>
                ) : templates.map(tpl => (
                  <TableRow key={tpl.id}>
                    <TableCell className="font-medium text-sm">{tpl.name}</TableCell>
                    <TableCell><Badge variant="outline">{tpl.category}</Badge></TableCell>
                    <TableCell>
                      {tpl.isActive
                        ? <Badge variant="default">Aktif</Badge>
                        : <Badge variant="secondary">Nonaktif</Badge>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{tpl._count?.documents || 0}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(tpl)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => toggleActive(tpl)}>
                          {tpl.isActive ? <Ban className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={o => { if (!o) setShowForm(false); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Template' : 'Tambah Template'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Kategori</Label>
                <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Nama Template</Label>
                <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Contoh: Template MOU Pemasangan RW" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Isi Dokumen (HTML/teks dengan placeholder)</Label>
              <p className="text-xs text-muted-foreground">Gunakan <code className="bg-muted px-1 rounded">{'{{nama_field}}'}</code> sebagai placeholder. <code className="bg-muted px-1 rounded">{'{{nomor_dokumen}}'}</code> diisi otomatis.</p>
              <Textarea
                value={form.bodyHtml}
                onChange={e => setForm(p => ({ ...p, bodyHtml: e.target.value }))}
                rows={10}
                className="font-mono text-sm"
                placeholder={'No. {{nomor_dokumen}}\nPada hari {{hari}}, {{tanggal}}...\n'}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Field Schema (JSON Array)</Label>
              <p className="text-xs text-muted-foreground">
                Format: <code className="bg-muted px-1 rounded text-xs">{`[{"key":"nama","label":"Nama","type":"text","required":true}]`}</code>
              </p>
              <Textarea
                value={form.fieldsSchema}
                onChange={e => setForm(p => ({ ...p, fieldsSchema: e.target.value }))}
                rows={6}
                className="font-mono text-xs"
              />
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Batal</Button>
            <Button onClick={saveTemplate} disabled={saving || !form.name || !form.bodyHtml}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editingTemplate ? 'Simpan Perubahan' : 'Buat Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

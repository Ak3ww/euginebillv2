'use client';

import { useState, useEffect } from 'react';
import { showSuccess, showError, showConfirm } from '@/lib/sweetalert';
import { Plus, Edit2, Trash2, Eye, X, RefreshCw, FileCode } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { renderVoucherTemplate } from '@/lib/utils/templateRenderer';
import {
  SimpleModal,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalBody,
  ModalFooter,
  ModalInput,
  ModalTextarea,
  ModalLabel,
  ModalButton,
} from '@/components/cyberpunk';

const DEFAULT_CARD_TEMPLATE = `{include file="rad-template-header.tpl"}
<style>
@media (max-width: 640px) {
  .voucher-preview-container { display: flex !important; flex-direction: column !important; padding: 0 8px !important; gap: 10px !important; }
  .voucher-card { display: block !important; width: calc(100% - 16px) !important; max-width: none !important; margin: 0 auto 10px auto !important; }
}
@media (min-width: 641px) and (max-width: 1024px) {
  .voucher-card { width: calc(50% - 12px) !important; }
}
@media (min-width: 1025px) {
  .voucher-card { width: 220px !important; }
}
@media print {
  body { margin: 0; padding: 4mm; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  .voucher-card { break-inside: avoid; page-break-inside: avoid; }
}
</style>
{foreach $v as $vs}
{if $vs['code'] eq $vs['secret']}
<div class="voucher-card" style="display: inline-block; width: 220px; min-height: 120px; border: 1.5px solid #002c60; border-radius: 6px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 4px; padding: 0; vertical-align: top; background: #fff; page-break-inside: avoid; box-sizing: border-box; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
  <div style="background: #002c60; color: #fff; padding: 5px 8px; font-size: 11px; font-weight: 700; display: flex; justify-content: space-between; align-items: center; border-radius: 4px 4px 0 0;">
    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px;">{$vs['router_name']}</span>
    <span style="font-size: 9px; background: rgba(255,255,255,0.2); padding: 1px 5px; border-radius: 3px; font-weight: 600;">HOTSPOT</span>
  </div>
  <div style="padding: 6px 8px; display: flex; gap: 6px; align-items: center;">
    <div style="flex: 1; min-width: 0;">
      <div style="color: #64748b; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Kode Voucher</div>
      <div style="font-family: 'Courier New', Courier, monospace; font-size: 15px; font-weight: 800; color: #002c60; line-height: 1.2; word-break: break-all; margin: 2px 0 4px 0; letter-spacing: 0.5px;">{$vs['code']}</div>
      <div style="font-size: 9px; color: #334155; line-height: 1.3;">
        <div><strong>Masa Aktif:</strong> {$vs['validity']}</div>
        <div><strong>Kuota:</strong> {$vs['quota']}</div>
      </div>
    </div>
    <div style="flex-shrink: 0; text-align: center;">
      <div style="width: 68px; height: 68px; display: flex; align-items: center; justify-content: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 2px;">
        {$vs['qrcode']}
      </div>
      <div style="font-size: 7.5px; color: #64748b; margin-top: 2px; font-weight: 600;">Scan utk Konek</div>
    </div>
  </div>
  <div style="border-top: 1px dashed #cbd5e1; padding: 4px 8px; font-size: 10px; font-weight: 700; color: #002c60; background: #f8fafc; display: flex; justify-content: space-between; align-items: center;">
    <span>{$_c['currency_code']}. {number_format($vs['total'], 0, ',', '.')}</span>
    <span style="font-size: 8px; color: #94a3b8; font-weight: normal;">{$vs['dns_name']}</span>
  </div>
</div>
{else}
<div class="voucher-card" style="display: inline-block; width: 220px; min-height: 120px; border: 1.5px solid #002c60; border-radius: 6px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 4px; padding: 0; vertical-align: top; background: #fff; page-break-inside: avoid; box-sizing: border-box; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
  <div style="background: #002c60; color: #fff; padding: 5px 8px; font-size: 11px; font-weight: 700; display: flex; justify-content: space-between; align-items: center; border-radius: 4px 4px 0 0;">
    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px;">{$vs['router_name']}</span>
    <span style="font-size: 9px; background: rgba(255,255,255,0.2); padding: 1px 5px; border-radius: 3px; font-weight: 600;">HOTSPOT</span>
  </div>
  <div style="padding: 6px 8px; display: flex; gap: 6px; align-items: center;">
    <div style="flex: 1; min-width: 0;">
      <div style="display: flex; gap: 4px; margin-bottom: 2px;">
        <div style="flex: 1;">
          <div style="color: #64748b; font-size: 8px; font-weight: 600; text-transform: uppercase;">User</div>
          <div style="font-family: 'Courier New', Courier, monospace; font-size: 11px; font-weight: 800; color: #002c60; word-break: break-all;">{$vs['code']}</div>
        </div>
        <div style="flex: 1;">
          <div style="color: #64748b; font-size: 8px; font-weight: 600; text-transform: uppercase;">Pass</div>
          <div style="font-family: 'Courier New', Courier, monospace; font-size: 11px; font-weight: 800; color: #002c60; word-break: break-all;">{$vs['secret']}</div>
        </div>
      </div>
      <div style="font-size: 9px; color: #334155; line-height: 1.3;">
        <div><strong>Masa Aktif:</strong> {$vs['validity']}</div>
        <div><strong>Kuota:</strong> {$vs['quota']}</div>
      </div>
    </div>
    <div style="flex-shrink: 0; text-align: center;">
      <div style="width: 68px; height: 68px; display: flex; align-items: center; justify-content: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 2px;">
        {$vs['qrcode']}
      </div>
      <div style="font-size: 7.5px; color: #64748b; margin-top: 2px; font-weight: 600;">Scan utk Konek</div>
    </div>
  </div>
  <div style="border-top: 1px dashed #cbd5e1; padding: 4px 8px; font-size: 10px; font-weight: 700; color: #002c60; background: #f8fafc; display: flex; justify-content: space-between; align-items: center;">
    <span>{$_c['currency_code']}. {number_format($vs['total'], 0, ',', '.')}</span>
    <span style="font-size: 8px; color: #94a3b8; font-weight: normal;">{$vs['dns_name']}</span>
  </div>
</div>
{/if}
{/foreach}
{include file="rad-template-footer.tpl"}`;

const THERMAL_TEMPLATE = `{include file="rad-template-header.tpl"}
<style>
@media print {
  @page { margin: 0; size: auto; }
  body { margin: 0; padding: 2mm; width: 100%; }
  .thermal-ticket { page-break-after: always; break-after: page; }
}
</style>
{foreach $v as $vs}
<div class="thermal-ticket" style="width: 200px; margin: 0 auto 16px auto; padding: 8px 4px; font-family: 'Courier New', Courier, monospace; text-align: center; color: #000; background: #fff; box-sizing: border-box;">
  <div style="font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px;">{$vs['router_name']}</div>
  <div style="font-size: 10px; font-weight: 600; margin-top: 2px;">HOTSPOT VOUCHER</div>
  <div style="border-bottom: 1px dashed #000; margin: 6px 0;"></div>
  
  <div style="font-size: 11px; margin: 2px 0;"><strong>{$vs['validity']}</strong> | <strong>{$vs['quota']}</strong></div>
  <div style="font-size: 13px; font-weight: 900; margin: 4px 0;">{$_c['currency_code']}. {number_format($vs['total'], 0, ',', '.')}</div>
  
  <div style="margin: 8px auto; display: flex; justify-content: center; align-items: center;">
    <div style="padding: 4px; border: 1px solid #000; display: inline-block;">
      {$vs['qrcode']}
    </div>
  </div>
  <div style="font-size: 9px; font-weight: bold; margin-bottom: 6px;">SCAN LANGSUNG KONEK</div>
  
  {if $vs['code'] eq $vs['secret']}
  <div style="border: 1px solid #000; padding: 4px 6px; margin: 4px 0; background: #f4f4f4;">
    <div style="font-size: 8px; text-transform: uppercase;">Kode Voucher:</div>
    <div style="font-size: 15px; font-weight: 900; letter-spacing: 1px; word-break: break-all;">{$vs['code']}</div>
  </div>
  {else}
  <div style="border: 1px solid #000; padding: 4px 6px; margin: 4px 0; background: #f4f4f4; text-align: left;">
    <div style="font-size: 9px;"><strong>User:</strong> <span style="font-size: 12px; font-weight: 900;">{$vs['code']}</span></div>
    <div style="font-size: 9px;"><strong>Pass:</strong> <span style="font-size: 12px; font-weight: 900;">{$vs['secret']}</span></div>
  </div>
  {/if}

  <div style="border-bottom: 1px dashed #000; margin: 6px 0;"></div>
  <div style="font-size: 8px; line-height: 1.3; text-align: left; padding: 0 4px;">
    1. Hubungkan ke Wi-Fi Hotspot<br/>
    2. Scan QR Code di atas dengan kamera HP<br/>
    Atau buka browser: <strong>{$vs['dns_name']}</strong>
  </div>
  <div style="border-bottom: 1px dashed #000; margin: 6px 0;"></div>
  <div style="font-size: 9px; font-weight: 600;">Terima Kasih</div>
</div>
{/foreach}
{include file="rad-template-footer.tpl"}`;

const DEFAULT_TEMPLATE = DEFAULT_CARD_TEMPLATE;

interface VoucherTemplate {
  id: string;
  name: string;
  htmlTemplate: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function VoucherTemplatesPage() {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<VoucherTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<VoucherTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    htmlTemplate: DEFAULT_TEMPLATE,
    isDefault: false,
    isActive: true
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/voucher-templates');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingTemplate ? `/api/voucher-templates/${editingTemplate.id}` : '/api/voucher-templates';
      const method = editingTemplate ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        await showSuccess(editingTemplate ? t('common.updated') : t('common.created'));
        await fetchTemplates();
        handleCloseDialog();
      } else {
        const error = await res.json();
        await showError(error.error || t('common.failed'));
      }
    } catch (error) {
      await showError(t('hotspot.failedSaveTemplate'));
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await showConfirm(t('common.deleteConfirm'));
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/voucher-templates/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await showSuccess(t('hotspot.templateDeleted'));
        await fetchTemplates();
      } else {
        const error = await res.json();
        await showError(error.error || t('common.failed'));
      }
    } catch (error) {
      await showError(t('hotspot.failedDeleteTemplate'));
    }
  };

  const handleEdit = (template: VoucherTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      htmlTemplate: template.htmlTemplate,
      isDefault: template.isDefault,
      isActive: template.isActive
    });
    setShowDialog(true);
  };

  const handleAdd = () => {
    setEditingTemplate(null);
    setFormData({ name: '', htmlTemplate: DEFAULT_TEMPLATE, isDefault: false, isActive: true });
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingTemplate(null);
  };

  const sampleVouchers = [
    {
      code: 'DEMO1234',
      secret: 'DEMO1234',
      total: 10000,
      profile: {
        name: '3 Jam',
        validityValue: 3,
        validityUnit: 'HOURS',
        usageQuota: 5 * 1024 * 1024 * 1024, // 5GB
        usageDuration: 180 // 3 hours
      },
      router: { name: 'Router Cibinong', shortname: 'CBG', dnsName: 'wifi.euginemediagroup.com' },
      dnsName: 'wifi.euginemediagroup.com'
    },
    {
      code: 'USER5678',
      secret: 'PASS9999',
      total: 25000,
      profile: {
        name: '1 Hari',
        validityValue: 1,
        validityUnit: 'DAYS',
        usageQuota: 10 * 1024 * 1024 * 1024, // 10GB
        usageDuration: 1440 // 24 hours
      },
      router: { name: 'Router Cibinong', shortname: 'CBG', dnsName: 'wifi.euginemediagroup.com' },
      dnsName: 'wifi.euginemediagroup.com'
    }
  ];

  const previewHtml = renderVoucherTemplate(
    formData.htmlTemplate,
    sampleVouchers,
    { currencyCode: 'Rp', companyName: 'Router Cibinong', dnsName: 'wifi.euginemediagroup.com' }
  );

  return (
    <div className="bg-background relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#bc13fe]/20 rounded-full blur-3xl"></div>
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-[#00f7ff]/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-[#ff44cc]/20 rounded-full blur-3xl"></div>
        <div className="hidden dark:block absolute inset-0 bg-[linear-gradient(rgba(188,19,254,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(188,19,254,0.03)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
      </div>
      <div className="relative z-10 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-[#00f7ff] dark:via-white dark:to-[#ff44cc] dark:drop-shadow-[0_0_30px_rgba(0,247,255,0.5)] flex items-center gap-2">
              <FileCode className="w-5 h-5 text-[#00f7ff]" />
              {t('hotspot.templateTitle')}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">{t('hotspot.templateSubtitle')}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchTemplates}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-card border border-border rounded-md hover:bg-muted"
              title="Perbarui Data"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleAdd}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-white rounded-md hover:bg-primary/90"
            >
              <Plus className="w-3.5 h-3.5" />
              {t('hotspot.addTemplate')}
            </button>
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="block md:hidden space-y-3">
          {loading ? (
            <div className="text-center py-8 text-xs text-muted-foreground">{t('common.loading')}</div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-xs">{t('hotspot.noTemplates')}</div>
          ) : (
            templates.map((template) => (
              <div key={template.id} className="bg-card/80 backdrop-blur-xl rounded-xl border border-[#bc13fe]/20 p-3">
                <div className="flex items-start justify-between mb-2">
                  <div className="font-medium text-sm text-foreground">{template.name}</div>
                  <div className="flex items-center gap-1">
                    {template.isDefault && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/20 text-primary">
                        {t('common.default')}
                      </span>
                    )}
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${template.isActive ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                      {template.isActive ? t('common.active') : t('common.inactive')}
                    </span>
                  </div>
                </div>
                <div className="flex justify-end gap-1 border-t border-border pt-2">
                  <button onClick={() => handleEdit(template)} className="p-2 text-primary hover:bg-primary/10 rounded" title="Edit Template">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(template.id)} className="p-2 text-destructive hover:bg-destructive/10 rounded" title="Hapus Template">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Table - Desktop */}
        {loading ? (
          <div className="hidden md:block text-center py-8 text-xs text-muted-foreground">{t('common.loading')}</div>
        ) : (
          <div className="hidden md:block bg-card rounded-lg border border-border overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase">{t('common.name')}</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase">{t('common.status')}</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase">{t('common.default')}</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {templates.map((template) => (
                  <tr key={template.id} className="hover:bg-muted">
                    <td className="px-3 py-2">
                      <span className="font-medium text-xs text-foreground">{template.name}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${template.isActive
                          ? 'bg-success/10 text-success'
                          : 'bg-muted text-muted-foreground'
                        }`}>
                        {template.isActive ? t('common.active') : t('common.inactive')}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {template.isDefault && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/20 text-primary dark:text-primary">
                          {t('common.default')}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleEdit(template)}
                          className="p-1 text-primary hover:bg-primary/10 rounded"
                          title="Edit Template"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(template.id)}
                          className="p-1 text-destructive hover:bg-destructive/10 rounded"
                          title="Hapus Template"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {templates.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground text-xs">
                      {t('hotspot.noTemplates')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Add/Edit Dialog */}
        <SimpleModal isOpen={showDialog} onClose={handleCloseDialog} size="xl">
          <ModalHeader>
            <ModalTitle>{editingTemplate ? t('hotspot.editTemplate') : t('hotspot.addTemplate')}</ModalTitle>
            <ModalDescription>{t('hotspot.configureTemplate')}</ModalDescription>
          </ModalHeader>
          <form onSubmit={handleSubmit}>
            <ModalBody className="space-y-4">
              <div>
                <ModalLabel required>{t('hotspot.templateName')}</ModalLabel>
                <ModalInput type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required placeholder="e.g., Default Card" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <ModalLabel className="mb-0">{t('hotspot.htmlTemplate')}</ModalLabel>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">Muat Preset:</span>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, htmlTemplate: DEFAULT_CARD_TEMPLATE })}
                      className="px-2 py-0.5 text-[10px] font-medium bg-muted hover:bg-muted/80 rounded border border-border text-foreground transition-colors"
                    >
                      Card + QR Auto-Login
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, htmlTemplate: THERMAL_TEMPLATE })}
                      className="px-2 py-0.5 text-[10px] font-medium bg-muted hover:bg-muted/80 rounded border border-border text-foreground transition-colors"
                    >
                      Struk Kasir Thermal
                    </button>
                  </div>
                </div>
                <ModalTextarea value={formData.htmlTemplate} onChange={(e) => setFormData({ ...formData, htmlTemplate: e.target.value })} required rows={12} className="font-mono text-[10px]" placeholder="Enter HTML template..." />
                <div className="text-[9px] text-muted-foreground mt-1.5 space-y-0.5">
                  <div>Variabel: <code className="text-primary font-mono">{"{$vs['code']}"}</code>, <code className="text-primary font-mono">{"{$vs['secret']}"}</code>, <code className="text-primary font-mono">{"{$vs['qrcode']}"}</code> (QR Scan Konek), <code className="text-primary font-mono">{"{$vs['login_url']}"}</code>, <code className="text-primary font-mono">{"{$vs['dns_name']}"}</code>, <code className="text-primary font-mono">{"{$vs['total']}"}</code>, <code className="text-primary font-mono">{"{$vs['validity']}"}</code>, <code className="text-primary font-mono">{"{$vs['quota']}"}</code></div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formData.isDefault} onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })} className="rounded border-[#bc13fe]/50 bg-background dark:bg-[#0a0520] accent-brand-500 dark:accent-[#00f7ff] w-3.5 h-3.5" />
                  <span className="text-xs text-foreground">{t('hotspot.setDefault')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formData.isActive} onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })} className="rounded border-[#bc13fe]/50 bg-background dark:bg-[#0a0520] accent-brand-500 dark:accent-[#00f7ff] w-3.5 h-3.5" />
                  <span className="text-xs text-foreground">{t('common.active')}</span>
                </label>
              </div>
            </ModalBody>
            <ModalFooter className="justify-between">
              <button type="button" onClick={() => setShowPreview(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#00f7ff] border border-[#00f7ff]/50 rounded-lg hover:bg-[#00f7ff]/10 transition-all">
                <Eye className="w-3.5 h-3.5" /> {t('hotspot.previewTemplate')}
              </button>
              <div className="flex gap-2">
                <ModalButton type="button" variant="secondary" onClick={handleCloseDialog}>{t('common.cancel')}</ModalButton>
                <ModalButton type="submit" variant="primary">{editingTemplate ? t('common.update') : t('common.create')}</ModalButton>
              </div>
            </ModalFooter>
          </form>
        </SimpleModal>

        {/* Preview Dialog */}
        <SimpleModal isOpen={showPreview} onClose={() => setShowPreview(false)} size="md">
          <ModalHeader>
            <ModalTitle>{t('hotspot.previewTemplate')}</ModalTitle>
          </ModalHeader>
          <ModalBody className="p-4 overflow-y-auto">
            <div style={{ display: 'flex', justifyContent: 'center', maxHeight: '65vh', overflowY: 'auto' }}>
              <div
                style={{
                  background: '#fff',
                  borderRadius: '8px',
                  padding: '12px',
                  width: '100%',
                  maxWidth: '380px',
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  overflowX: 'hidden',
                }}
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          </ModalBody>
          <ModalFooter className="justify-center">
            <ModalButton variant="secondary" onClick={() => setShowPreview(false)}>{t('common.close')}</ModalButton>
          </ModalFooter>
        </SimpleModal>
      </div>
    </div>
  );
}

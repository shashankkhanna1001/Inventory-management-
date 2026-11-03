import { useState, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  X,
  Upload,
  Download,
  FileSpreadsheet,
  AlertTriangle,
  Ban,
  Shield,
  ArrowLeftRight,
  CheckCircle2,
  Package,
  History,
  FileText,
  Trash2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  useInventory,
  useInventoryMutations,
  type InventoryFilters,
  type InventoryInput,
} from '@/hooks/use-inventory.js';
import type { InventoryItem, InventoryStatus, BulkUploadItem, BulkUploadResult } from '@/types/api.js';
import { useUserRole } from '@/context/user-role-context.js';
import { AssignDeviceModal } from './assign-device-modal.js';
import { DeviceTrackingModal } from './device-tracking-modal.js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.js';
import { Button } from '@/components/ui/button.js';
import { Badge } from '@/components/ui/badge.js';
import { Spinner } from '@/components/ui/spinner.js';
import { ErrorState } from '@/components/ui/error-state.js';
import { EmptyState } from '@/components/ui/empty-state.js';

const brands = ['Itel', 'Tecno', 'Infinix', 'Oraimo', 'Villaon', 'Other'] as const;
const sampleTypes = ['PRO', 'PRO-1', 'PR1', 'PR1-1', 'PR2', 'PIR', 'MPR'] as const;

const emptyForm: InventoryInput & {
  sampleReceivedDate?: string;
  dateOfReceipt?: string;
  employeeId?: string;
  assignedTo?: string;
} = {
  brand: 'Other',
  deviceModel: '',
  sampleHwType: 'PRO',
  imei1: '',
  imei2: '',
  serialNumber: '',
  vcId: '',
  color: '',
  storageRam: '',
  assignedDate: new Date().toISOString().slice(0, 10),
  warehouseLocation: 'Main Warehouse',
  inventoryHolder: 'IT Stock',
  remarks: '',
  status: 'Inactive',
  sampleReceivedDate: new Date().toISOString().slice(0, 10),
  dateOfReceipt: new Date().toISOString().slice(0, 10),
  employeeId: '',
  assignedTo: '',
};

type FormProps = { item?: InventoryItem; onClose: () => void };

function Field({
  label,
  required,
  children,
  wide = false,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`space-y-1 text-sm ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="font-medium">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </span>
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  type = 'text',
  required = false,
  maxLength,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
}) {
  return (
    <input
      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
      value={value}
      type={type}
      required={required}
      maxLength={maxLength}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function InventoryForm({ item, onClose }: FormProps) {
  const [form, setForm] = useState(item ? { ...item } : emptyForm);
  const { create, update } = useInventoryMutations();
  const mutation = item ? update : create;

  const set = (name: string, value: string | InventoryStatus) =>
    setForm((current) => ({ ...current, [name]: value }));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (item) {
      update.mutate({ id: item.itemId, input: form }, { onSuccess: onClose });
    } else {
      create.mutate(form as InventoryInput, { onSuccess: onClose });
    }
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <Card className="max-h-[92vh] w-full max-w-3xl overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle>{item ? 'Edit Device Record' : 'Register New Device'}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {item
                ? 'Controlled amendment. Note that deletions are strictly prohibited by compliance policy.'
                : 'Enter all mandatory device attributes and unique identifiers.'}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close form">
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <Field label="Brand" required>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.brand}
                required
                onChange={(e) => set('brand', e.target.value)}
              >
                {brands.map((brand) => (
                  <option key={brand}>{brand}</option>
                ))}
              </select>
            </Field>

            <Field label="Device Model" required>
              <TextInput
                value={form.deviceModel}
                required
                placeholder="e.g. Camon 30 Premier 5G"
                onChange={(val) => set('deviceModel', val)}
              />
            </Field>

            <Field label="Sample / HW Type" required>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.sampleHwType}
                required
                onChange={(e) => set('sampleHwType', e.target.value)}
              >
                {sampleTypes.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </Field>

            <Field label="IMEI1 (15 digits)" required>
              <TextInput
                value={form.imei1}
                required
                maxLength={15}
                placeholder="356789012345678"
                onChange={(val) => set('imei1', val)}
              />
            </Field>

            <Field label="IMEI2 (Optional)">
              <TextInput
                value={form.imei2 || ''}
                maxLength={15}
                placeholder="Optional second IMEI"
                onChange={(val) => set('imei2', val)}
              />
            </Field>

            <Field label="VC ID">
              <TextInput
                value={form.vcId || ''}
                placeholder="e.g. VC-88910"
                onChange={(val) => set('vcId', val)}
              />
            </Field>

            <Field label="Serial Number">
              <TextInput
                value={form.serialNumber || ''}
                placeholder="SN..."
                onChange={(val) => set('serialNumber', val)}
              />
            </Field>

            <Field label="Color">
              <TextInput
                value={form.color || ''}
                placeholder="e.g. Iceland Blue"
                onChange={(val) => set('color', val)}
              />
            </Field>

            <Field label="Storage / RAM Variant">
              <TextInput
                value={form.storageRam || ''}
                placeholder="e.g. 12GB / 256GB"
                onChange={(val) => set('storageRam', val)}
              />
            </Field>

            <Field label="Assigned Date" required>
              <TextInput
                type="date"
                value={form.assignedDate}
                required
                onChange={(val) => set('assignedDate', val)}
              />
            </Field>

            <Field label="Warehouse / Location" required>
              <TextInput
                value={form.warehouseLocation}
                required
                placeholder="e.g. Main Hub A-1"
                onChange={(val) => set('warehouseLocation', val)}
              />
            </Field>

            <Field label="Inventory Holder" required>
              <TextInput
                value={form.inventoryHolder}
                required
                placeholder="e.g. IT Stock or Employee Name"
                onChange={(val) => set('inventoryHolder', val)}
              />
            </Field>

            <Field label="Status">
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.status}
                onChange={(e) => set('status', e.target.value as InventoryStatus)}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive / Available</option>
              </select>
            </Field>

            <Field label="Remarks Section" wide>
              <textarea
                className="min-h-20 w-full rounded-md border border-input bg-background p-3 text-sm"
                value={form.remarks || ''}
                placeholder="Optional notes, condition, or sample provenance..."
                onChange={(e) => set('remarks', e.target.value)}
              />
            </Field>

            {mutation.isError && (
              <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive sm:col-span-2">
                {mutation.error instanceof Error ? mutation.error.message : 'Could not save device.'}
              </div>
            )}

            <div className="flex justify-end gap-2 sm:col-span-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Spinner size="sm" className="mr-1" />}
                Save Device
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// Universal cell text extractor preserving 15-digit numeric strings & ISO dates
function formatCellString(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  if (typeof val === 'number') {
    if (Number.isInteger(val)) {
      return BigInt(val).toString();
    }
    return val.toString();
  }
  if (typeof val === 'string') return val.trim().replace(/^"|"$/g, '');
  return String(val).trim();
}

function normalizeHeader(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const FIELD_ALIASES: Record<keyof BulkUploadItem, string[]> = {
  brand: ['brand', 'make', 'oem', 'manufacturer'],
  deviceModel: ['devicemodel', 'model', 'modelname', 'phonemodel'],
  sampleHwType: ['samplehwtype', 'sampletype', 'hwtype', 'hwstage', 'stagetype', 'samplehwstage'],
  sampleReceivedDate: ['samplereceiveddate', 'receiveddate', 'samplereceiptdate', 'receptiondate'],
  vcId: ['vcid', 'vcno', 'vcnumber', 'vccode'],
  imei1: ['imei1', 'imei', 'imeino1', 'imei1no', 'firstimei', 'primaryimei'],
  imei2: ['imei2', 'imeino2', 'imei2no', 'secondimei', 'secondaryimei'],
  color: ['color', 'colour', 'shade'],
  storageRam: ['storageram', 'storageramvariant', 'ramrom', 'romram', 'memory', 'variant'],
  dateOfReceipt: ['dateofreceipt', 'receiptdate', 'inwarddate'],
  warehouseLocation: ['warehouselocation', 'warehouse', 'location', 'storagehub', 'hub'],
  assignedTo: ['assignedto', 'assignee', 'employeename', 'holder', 'currentuser', 'assignedemployee'],
  employeeId: ['employeeid', 'empid', 'staffid', 'empcode'],
  assignedDate: ['assigneddate', 'allocationdate', 'dateassigned', 'issueat', 'issuedate'],
  remarks: ['remarks', 'remarkssection', 'notes', 'comments', 'purpose', 'description'],
  serialNumber: ['serialnumber', 'sn', 'serial', 'serialno'],
  inventoryHolder: ['inventoryholder', 'stockholder', 'custodian'],
  status: ['status'],
};

function BulkUploadModal({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [csvText, setCsvText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedFileSize, setUploadedFileSize] = useState<string | null>(null);
  const [parsedItems, setParsedItems] = useState<BulkUploadItem[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [uploadResult, setUploadResult] = useState<BulkUploadResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { bulkUpload } = useInventoryMutations();
  const { user, role } = useUserRole();

  const standardHeaders = [
    'Brand',
    'Device Model',
    'Sample/HW Type',
    'Sample Received Date',
    'VC ID',
    'IMEI1',
    'IMEI2',
    'Color',
    'Storage/RAM Variant',
    'Date of Receipt',
    'Warehouse/Location',
    'Assigned To (Employee Name)',
    'Employee ID',
    'Assigned Date',
    'Remarks Section',
  ];

  const sampleRows = [
    [
      'Tecno',
      'Camon 30 Premier',
      'PRO',
      '2026-10-15',
      'VC-10291',
      '356789012345671',
      '',
      'Alps White',
      '12GB/512GB',
      '2026-10-15',
      'Warehouse A',
      'John Doe',
      'EMP-QA-01',
      '2026-10-16',
      'Standard testing unit',
    ],
    [
      'Infinix',
      'Note 40 Pro+',
      'PR1',
      '2026-10-14',
      'VC-10292',
      '867123456789012',
      '',
      'Obsidian Black',
      '8GB/256GB',
      '2026-10-14',
      'Warehouse B',
      '',
      'EMP-DEV-02',
      '2026-10-16',
      'Camera benchmarking sample',
    ],
  ];

  const downloadExcelTemplate = () => {
    const wb = XLSX.utils.book_new();
    const wsData = [standardHeaders, ...sampleRows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths
    ws['!cols'] = standardHeaders.map((header) => ({
      wch: Math.max(header.length + 4, 16),
    }));

    XLSX.utils.book_append_sheet(wb, ws, 'Inventory Import');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'inventory_bulk_upload_template.xlsx');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadCsvTemplate = () => {
    const csvContent = [standardHeaders.join(','), ...sampleRows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'inventory_bulk_upload_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const parseWorkbookData = (workbook: XLSX.WorkBook, fileName: string) => {
    setParseErrors([]);
    setUploadResult(null);

    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      setParseErrors([`Spreadsheet "${fileName}" contains no worksheets.`]);
      setParsedItems([]);
      return;
    }

    const sheet = workbook.Sheets[firstSheetName];
    if (!sheet) {
      setParseErrors([`Failed to read active worksheet in "${fileName}".`]);
      setParsedItems([]);
      return;
    }

    const rawData: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      raw: true,
    });

    if (rawData.length < 2) {
      setParseErrors([
        `File "${fileName}" does not contain data. Please include a header row and at least one device record.`,
      ]);
      setParsedItems([]);
      return;
    }

    // Locate first non-empty header row
    let headerRowIdx = 0;
    while (
      headerRowIdx < rawData.length &&
      (!rawData[headerRowIdx] || (rawData[headerRowIdx] as unknown[]).length === 0)
    ) {
      headerRowIdx++;
    }

    const rawHeaders = ((rawData[headerRowIdx] as unknown[]) || []).map(formatCellString);
    const normHeaders = rawHeaders.map(normalizeHeader);

    // Build column map from header aliases
    const colMap: Partial<Record<keyof BulkUploadItem, number>> = {};
    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      const idx = normHeaders.findIndex((h) =>
        aliases.some((alias) => h === alias || h.includes(alias)),
      );
      if (idx !== -1) {
        colMap[field as keyof BulkUploadItem] = idx;
      }
    }

    // Fall back to positional standard order if Model or IMEI not matched by alias
    const fallbackToPositional = colMap.deviceModel === undefined || colMap.imei1 === undefined;

    const items: BulkUploadItem[] = [];
    const errors: string[] = [];

    for (let r = headerRowIdx + 1; r < rawData.length; r++) {
      const row = rawData[r];
      if (!row || !Array.isArray(row)) continue;
      const rowStrings = row.map(formatCellString);
      // Skip completely blank rows
      if (rowStrings.every((val) => val === '')) continue;

      const getVal = (field: keyof BulkUploadItem, fallbackPos: number): string => {
        if (!fallbackToPositional && colMap[field] !== undefined) {
          return rowStrings[colMap[field]!] || '';
        }
        return rowStrings[fallbackPos] || '';
      };

      const brand = getVal('brand', 0) || 'Other';
      const deviceModel = getVal('deviceModel', 1);
      const sampleHwType = getVal('sampleHwType', 2) || 'PRO';
      const sampleReceivedDate = getVal('sampleReceivedDate', 3);
      const vcId = getVal('vcId', 4);
      let imei1 = getVal('imei1', 5);
      // Clean non-digits if present
      const cleanImei = imei1.replace(/\D/g, '');
      if (cleanImei.length === 15) {
        imei1 = cleanImei;
      }
      const imei2 = getVal('imei2', 6);
      const color = getVal('color', 7);
      const storageRam = getVal('storageRam', 8);
      const dateOfReceipt = getVal('dateOfReceipt', 9);
      const warehouseLocation = getVal('warehouseLocation', 10) || 'Main Warehouse';
      const assignedTo = getVal('assignedTo', 11);
      const employeeId = getVal('employeeId', 12);
      const assignedDate = getVal('assignedDate', 13) || new Date().toISOString().slice(0, 10);
      const remarks = getVal('remarks', 14);

      const rowNumber = r + 1;
      if (!deviceModel) {
        errors.push(`Row ${rowNumber}: Device Model is required.`);
      }
      if (!imei1 || !/^\d{15}$/.test(imei1)) {
        errors.push(`Row ${rowNumber}: IMEI1 '${imei1}' is invalid. Must be exactly 15 digits.`);
      }

      items.push({
        brand,
        deviceModel,
        sampleHwType,
        sampleReceivedDate,
        vcId,
        imei1,
        imei2,
        color,
        storageRam,
        dateOfReceipt,
        warehouseLocation,
        assignedTo,
        employeeId,
        assignedDate,
        remarks,
        status: 'Active',
      });
    }

    setParsedItems(items);
    setParseErrors(errors);
  };

  const processFile = (file: File) => {
    const sizeKB = (file.size / 1024).toFixed(1);
    setUploadedFileName(file.name);
    setUploadedFileSize(`${sizeKB} KB`);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
        parseWorkbookData(workbook, file.name);
      } catch (err) {
        setParseErrors([
          `Failed to parse spreadsheet "${file.name}": ${err instanceof Error ? err.message : String(err)}`,
        ]);
        setParsedItems([]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const clearUploadedFile = () => {
    setUploadedFileName(null);
    setUploadedFileSize(null);
    setParsedItems([]);
    setParseErrors([]);
    setUploadResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const parseCsvText = (text: string) => {
    setParseErrors([]);
    setUploadResult(null);
    const lines = text.trim().split(/\r\n|\n/).filter((l) => l.trim().length > 0);
    if (lines.length <= 1) {
      setParseErrors(['CSV data must contain a header row and at least one device record.']);
      setParsedItems([]);
      return;
    }

    const items: BulkUploadItem[] = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i]!.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
      if (row.length < 5) continue;

      const brand = row[0] || 'Other';
      const deviceModel = row[1] || '';
      const sampleHwType = row[2] || 'PRO';
      const sampleReceivedDate = row[3] || '';
      const vcId = row[4] || '';
      const imei1 = row[5] || '';
      const imei2 = row[6] || '';
      const color = row[7] || '';
      const storageRam = row[8] || '';
      const dateOfReceipt = row[9] || '';
      const warehouseLocation = row[10] || 'Main Warehouse';
      const assignedTo = row[11] || '';
      const employeeId = row[12] || '';
      const assignedDate = row[13] || new Date().toISOString().slice(0, 10);
      const remarks = row[14] || '';

      if (!deviceModel) {
        errors.push(`Row ${i}: Device Model is required.`);
      }
      if (!imei1 || !/^\d{15}$/.test(imei1)) {
        errors.push(`Row ${i}: IMEI1 '${imei1}' is invalid. Must be exactly 15 digits.`);
      }

      items.push({
        brand,
        deviceModel,
        sampleHwType,
        sampleReceivedDate,
        vcId,
        imei1,
        imei2,
        color,
        storageRam,
        dateOfReceipt,
        warehouseLocation,
        assignedTo,
        employeeId,
        assignedDate,
        remarks,
        status: 'Active',
      });
    }

    setParsedItems(items);
    setParseErrors(errors);
  };

  const handleExecuteUpload = () => {
    if (parsedItems.length === 0) return;
    bulkUpload.mutate(
      {
        items: parsedItems,
        actorId: user.email,
        actorRole: role,
      },
      {
        onSuccess: (data) => {
          setUploadResult(data);
        },
      },
    );
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <Card className="max-h-[92vh] w-full max-w-4xl overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              Bulk Inventory Upload (Excel & CSV)
            </CardTitle>
            <CardDescription>
              Batch import devices via Excel (.xlsx, .xls) or CSV spreadsheets with duplicate checkpoints for IMEI1, IMEI2, and VC ID.
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Instructions & Template Downloads */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 p-3 text-xs">
            <div className="max-w-xl">
              <p className="font-semibold text-foreground">Standard 15 Fields Structure:</p>
              <p className="text-muted-foreground mt-0.5 leading-relaxed">
                Brand, Device Model, Sample/HW Type, Sample Received Date, VC ID, IMEI1 (15 digits), IMEI2, Color, Storage/RAM Variant, Date of Receipt, Warehouse/Location, Assigned To, Employee ID, Assigned Date, Remarks Section.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={downloadExcelTemplate}
                className="gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                Download Excel (.xlsx)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadCsvTemplate}
                className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <Download className="h-3.5 w-3.5" />
                CSV Template
              </Button>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          {!uploadResult && (
            <div className="flex items-center border-b text-xs font-medium">
              <button
                type="button"
                onClick={() => setActiveTab('upload')}
                className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
                  activeTab === 'upload'
                    ? 'border-primary text-primary font-semibold'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <FileSpreadsheet className="h-4 w-4" />
                Upload Spreadsheet File (.xlsx, .xls, .csv)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('paste')}
                className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
                  activeTab === 'paste'
                    ? 'border-primary text-primary font-semibold'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <FileText className="h-4 w-4" />
                Paste Raw CSV / Text
              </button>
            </div>
          )}

          {/* Upload / Drag-and-Drop Area */}
          {!uploadResult && activeTab === 'upload' && (
            <div className="space-y-3">
              <input
                type="file"
                ref={fileInputRef}
                accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                className="hidden"
                onChange={handleFileInputChange}
              />

              {!uploadedFileName ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) processFile(file);
                  }}
                  className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-all cursor-pointer ${
                    isDragging
                      ? 'border-primary bg-primary/5 scale-[0.99]'
                      : 'border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/30'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="rounded-full bg-emerald-500/10 p-2.5 text-emerald-600">
                      <FileSpreadsheet className="h-6 w-6" />
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    Click to browse or drag and drop your spreadsheet
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Supports native Microsoft Excel (<strong>.xlsx</strong>, <strong>.xls</strong>) and standard <strong>.csv</strong> files
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 gap-2 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Select Excel / CSV File
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3.5">
                  <div className="flex items-center gap-3">
                    <div className="rounded-md bg-emerald-500/10 p-2 text-emerald-600">
                      <FileSpreadsheet className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground flex items-center gap-2">
                        {uploadedFileName}
                        <Badge variant="outline" className="text-[10px] font-normal">
                          {uploadedFileSize}
                        </Badge>
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {parsedItems.length} valid device entries parsed
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs h-7"
                    >
                      Change File
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearUploadedFile}
                      className="text-xs h-7 text-muted-foreground hover:text-destructive"
                      title="Remove file"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Paste Raw CSV Area */}
          {!uploadResult && activeTab === 'paste' && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Paste comma-separated values including header row:
              </p>
              <textarea
                className="font-mono text-xs w-full h-36 rounded-md border border-input bg-background p-3 focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Brand,Device Model,Sample/HW Type,Sample Received Date,VC ID,IMEI1,IMEI2..."
                value={csvText}
                onChange={(e) => {
                  setCsvText(e.target.value);
                  parseCsvText(e.target.value);
                }}
              />
            </div>
          )}

          {/* Validation Warnings */}
          {parseErrors.length > 0 && (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" />
                Validation Warnings ({parseErrors.length}):
              </p>
              <ul className="list-disc pl-5 space-y-0.5 max-h-28 overflow-y-auto">
                {parseErrors.slice(0, 8).map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
                {parseErrors.length > 8 && (
                  <li className="italic">...and {parseErrors.length - 8} more warnings</li>
                )}
              </ul>
            </div>
          )}

          {/* Upload Results Summary (Pillar 1 Checkpoint Report) */}
          {uploadResult && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border bg-muted/20 p-3 text-center">
                  <p className="text-xs uppercase text-muted-foreground">Total Processed</p>
                  <p className="text-2xl font-bold mt-1">{uploadResult.totalProcessed}</p>
                </div>
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
                  <p className="text-xs uppercase text-emerald-700 font-semibold">Imported Successfully</p>
                  <p className="text-2xl font-bold mt-1 text-emerald-700">{uploadResult.importedCount}</p>
                </div>
                <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 text-center">
                  <p className="text-xs uppercase text-rose-700 font-semibold">Blocked by Duplicate Checkpoint</p>
                  <p className="text-2xl font-bold mt-1 text-rose-700">{uploadResult.blockedCount}</p>
                </div>
              </div>

              {uploadResult.blockedCount > 0 && (
                <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-4 space-y-2">
                  <h4 className="text-xs font-semibold text-rose-900 dark:text-rose-200 flex items-center gap-1.5">
                    <Ban className="h-4 w-4" />
                    Blocked Duplicate Entries (Logged to Audit Trail):
                  </h4>
                  <div className="divide-y text-xs text-rose-800 dark:text-rose-300 max-h-36 overflow-y-auto">
                    {uploadResult.blocked.map((b, idx) => (
                      <div key={idx} className="py-1.5 flex items-center justify-between">
                        <span>{b.reason}</span>
                        <Badge variant="destructive" className="text-[10px]">BLOCKED</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Staged Items Preview Table */}
          {!uploadResult && parsedItems.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold">Preview Staged Entries ({parsedItems.length}):</p>
                <span className="text-[11px] text-muted-foreground">
                  Duplicate checkpoints will prevent existing IMEI1, IMEI2, and VC ID from importing.
                </span>
              </div>
              <div className="max-h-48 overflow-y-auto rounded-md border text-xs">
                <table className="w-full text-left">
                  <thead className="border-b bg-muted/40 uppercase text-muted-foreground sticky top-0 bg-background">
                    <tr>
                      <th className="px-3 py-2 font-medium">#</th>
                      <th className="px-3 py-2 font-medium">Brand</th>
                      <th className="px-3 py-2 font-medium">Model</th>
                      <th className="px-3 py-2 font-medium">IMEI1</th>
                      <th className="px-3 py-2 font-medium">VC ID</th>
                      <th className="px-3 py-2 font-medium">Holder / Assigned To</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {parsedItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-muted/20">
                        <td className="px-3 py-1.5 text-muted-foreground font-mono text-[11px]">{idx + 1}</td>
                        <td className="px-3 py-1.5">{item.brand}</td>
                        <td className="px-3 py-1.5 font-medium">{item.deviceModel}</td>
                        <td className="px-3 py-1.5 font-mono text-primary font-semibold">{item.imei1}</td>
                        <td className="px-3 py-1.5">{item.vcId || '—'}</td>
                        <td className="px-3 py-1.5">{item.assignedTo || item.inventoryHolder || 'IT Stock'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button variant="outline" onClick={onClose} size="sm">
              {uploadResult ? 'Done' : 'Cancel'}
            </Button>
            {!uploadResult && (
              <Button
                size="sm"
                disabled={parsedItems.length === 0 || bulkUpload.isPending}
                onClick={handleExecuteUpload}
                className="gap-1.5"
              >
                {bulkUpload.isPending && <Spinner size="sm" className="mr-1" />}
                Validate & Import ({parsedItems.length} Devices)
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const columns = [
  'Brand',
  'Device Model',
  'Sample / HW Type',
  'IMEI1',
  'IMEI2',
  'Serial Number',
  'Assigned Date',
  'Warehouse / Location',
  'Inventory Holder',
  'Status',
];

export function InventoryPage() {
  const [filters, setFilters] = useState<InventoryFilters>({
    page: 1,
    pageSize: 10,
    search: '',
    brand: '',
    status: 'Inactive', // By default, show available in-stock devices
  });
  const [formItem, setFormItem] = useState<InventoryItem | null | undefined>(undefined);
  const [assigningDevice, setAssigningDevice] = useState<InventoryItem | null>(null);
  const [trackingDevice, setTrackingDevice] = useState<string | null>(null);
  const [showBulkUpload, setShowBulkUpload] = useState(false);

  const { data, isLoading, isError, error } = useInventory(filters);
  const { deactivate } = useInventoryMutations();
  const { role } = useUserRole();

  const updateFilter = <K extends keyof InventoryFilters>(name: K, value: InventoryFilters[K]) =>
    setFilters((current) => ({ ...current, [name]: value, ...(name !== 'page' && { page: 1 }) }));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Device Inventory</h2>
          <p className="text-muted-foreground text-sm">
            Catalog of tracked mobile hardware. Deletions restricted by compliance policy.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Bulk Upload (Admin & TL) */}
          {(role === 'Admin' || role === 'TL') && (
            <Button variant="outline" size="sm" onClick={() => setShowBulkUpload(true)} className="gap-2">
              <Upload className="h-4 w-4" />
              Bulk Upload
            </Button>
          )}
          {/* Add Device (Admin only) */}
          {role === 'Admin' && (
            <Button size="sm" onClick={() => setFormItem(null)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Add Device
            </Button>
          )}
        </div>
      </div>

      {/* Compliance Alert Note (Pillar 3 & 7) */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground flex items-center justify-between">
        <span className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>
            <strong>Audit Policy Active:</strong> Hard deletion is strictly disabled. Entries can be amended with justification or marked as Inactive.
          </span>
        </span>
        <Badge variant="outline" className="text-[10px]">Zero-Deletion Enabled</Badge>
      </div>

      {/* Stats Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat title="Total devices" value={data?.total ?? '—'} />
        <Stat title="Assigned devices" value={data?.activeCount ?? '—'} />
        <Stat title="Available devices" value={data?.inactiveCount ?? '—'} />
        <Stat
          title="Brands represented"
          value={data ? Object.keys(data.totalByBrand).length : '—'}
        />
      </div>

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b pb-3">
        <button
          type="button"
          onClick={() => updateFilter('status', 'Inactive')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
            filters.status === 'Inactive'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'border bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground'
          }`}
        >
          <CheckCircle2 className="h-4 w-4" />
          <span>Available in Stock (Unassigned)</span>
          <Badge
            variant={filters.status === 'Inactive' ? 'outline' : 'secondary'}
            className="text-[10px] ml-1"
          >
            {data?.inactiveCount ?? 0}
          </Badge>
        </button>

        <button
          type="button"
          onClick={() => updateFilter('status', 'Active')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
            filters.status === 'Active'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'border bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground'
          }`}
        >
          <ArrowLeftRight className="h-4 w-4" />
          <span>Currently Assigned</span>
          <Badge
            variant={filters.status === 'Active' ? 'outline' : 'secondary'}
            className="text-[10px] ml-1"
          >
            {data?.activeCount ?? 0}
          </Badge>
        </button>

        <button
          type="button"
          onClick={() => updateFilter('status', '')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
            filters.status === ''
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'border bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground'
          }`}
        >
          <Package className="h-4 w-4" />
          <span>All Master Inventory</span>
          <Badge
            variant={filters.status === '' ? 'outline' : 'secondary'}
            className="text-[10px] ml-1"
          >
            {data?.total ?? 0}
          </Badge>
        </button>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardContent className="flex flex-wrap gap-3 pt-6">
          <label className="relative min-w-64 flex-1">
            <span className="sr-only">Search devices</span>
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm"
              placeholder="Search brand, model, IMEI, serial, VC ID, location, holder"
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
            />
          </label>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Filter brand"
            value={filters.brand}
            onChange={(e) => updateFilter('brand', e.target.value)}
          >
            <option value="">All brands</option>
            {brands.map((brand) => (
              <option key={brand}>{brand}</option>
            ))}
          </select>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Filter status"
            value={filters.status}
            onChange={(e) => updateFilter('status', e.target.value as InventoryStatus | '')}
          >
            <option value="">All statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </CardContent>
      </Card>

      {/* Inventory Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-12">
              <Spinner />
            </div>
          ) : isError ? (
            <div className="p-6">
              <ErrorState
                message={error instanceof Error ? error.message : 'Unable to load devices.'}
              />
            </div>
          ) : data?.records.length === 0 ? (
            <div className="p-6">
              <EmptyState title="No devices found" description="Add a device or adjust your filters." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px] text-left text-sm">
                <thead className="border-b bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    {columns.map((column) => (
                      <th className="px-4 py-3 font-medium" key={column}>
                        {column}
                      </th>
                    ))}
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data?.records.map((item) => (
                    <tr key={item.itemId} className="hover:bg-muted/30">
                      <td className="px-4 py-3">{item.brand}</td>
                      <td className="px-4 py-3 font-medium">{item.deviceModel}</td>
                      <td className="px-4 py-3">{item.sampleHwType}</td>
                      <td className="px-4 py-3 font-mono text-xs">{item.imei1}</td>
                      <td className="px-4 py-3 font-mono text-xs">{item.imei2 || '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs">{item.serialNumber || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.assignedDate}</td>
                      <td className="px-4 py-3">{item.warehouseLocation}</td>
                      <td className="px-4 py-3">{item.inventoryHolder}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={item.status === 'Active' ? 'success' : 'secondary'}
                          className={
                            item.status === 'Inactive'
                              ? 'border border-emerald-300 dark:border-emerald-800 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 font-medium'
                              : 'font-medium'
                          }
                        >
                          {item.status === 'Inactive' ? 'In Stock (Available)' : 'Assigned (In Use)'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1.5 items-center">
                          {/* Custody Trail button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7 gap-1 text-primary hover:text-primary hover:bg-primary/10"
                            title="Inspect complete device custody trail"
                            onClick={() => setTrackingDevice(item.itemId || item.imei1)}
                          >
                            <History className="h-3 w-3" />
                            Custody
                          </Button>

                          {/* Assign button for Available in Stock devices (Admin & TL) */}
                          {item.status === 'Inactive' && (role === 'Admin' || role === 'TL') && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-7 gap-1 border-primary/30 text-primary hover:bg-primary/10 font-semibold"
                              onClick={() => setAssigningDevice(item)}
                            >
                              <ArrowLeftRight className="h-3 w-3" />
                              Assign
                            </Button>
                          )}

                          {role === 'Admin' ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs h-7"
                                onClick={() => setFormItem(item)}
                              >
                                Edit
                              </Button>
                              {item.status === 'Active' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs h-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => {
                                    if (window.confirm(`Deactivate "${item.deviceModel}"?`)) {
                                      deactivate.mutate(item.itemId);
                                    }
                                  }}
                                >
                                  Deactivate
                                </Button>
                              )}
                            </>
                          ) : role !== 'TL' && item.status !== 'Inactive' ? (
                            <span className="text-xs text-muted-foreground italic">In possession</span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
        <div className="flex items-center justify-between border-t p-4 text-sm text-muted-foreground">
          <span>{data ? `${data.total} device${data.total === 1 ? '' : 's'}` : ''}</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!data || filters.page <= 1}
              onClick={() => updateFilter('page', filters.page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span>
              Page {filters.page} of {data?.totalPages ?? '—'}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!data || filters.page >= data.totalPages}
              onClick={() => updateFilter('page', filters.page + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Edit/Add Form Modal */}
      {formItem !== undefined && (
        <InventoryForm item={formItem ?? undefined} onClose={() => setFormItem(undefined)} />
      )}

      {/* Assign Device to Person Modal */}
      {assigningDevice && (
        <AssignDeviceModal
          item={assigningDevice}
          onClose={() => setAssigningDevice(null)}
        />
      )}

      {/* Bulk Upload Modal */}
      {showBulkUpload && <BulkUploadModal onClose={() => setShowBulkUpload(false)} />}

      {/* Device Custody Tracking Modal */}
      {trackingDevice && (
        <DeviceTrackingModal
          deviceIdentifier={trackingDevice}
          onClose={() => setTrackingDevice(null)}
        />
      )}
    </div>
  );
}

function Stat({ title, value }: { title: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground">{title}</p>
      </CardContent>
    </Card>
  );
}

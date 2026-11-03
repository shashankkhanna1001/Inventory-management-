import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  RotateCcw,
  Search,
  X,
  Download,
  Share2,
  User,
  Shield,
  Smartphone,
  History,
  CheckCircle2,
  Camera,
  Trash2,
  Eye,
  AlertCircle,
  ZoomIn,
} from 'lucide-react';
import {
  useAssignments,
  useAssignmentMutations,
  type AssignmentFilters,
  type CreateAssignmentInput,
} from '@/hooks/use-assignments.js';
import { useInventory } from '@/hooks/use-inventory.js';
import { apiClient } from '@/lib/api-client.js';
import type { Assignment, AssignmentStatus, AuthUser, PhotoRecord, PhotoLabel } from '@/types/api.js';
import { useUserRole } from '@/context/user-role-context.js';
import { useAuth } from '@/context/auth-context.js';
import { useDownloadReport } from '@/hooks/use-audit.js';
import { DeviceTrackingModal } from '../inventory/device-tracking-modal.js';
import { cn } from '@/lib/utils.js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.js';
import { Button } from '@/components/ui/button.js';
import { Badge } from '@/components/ui/badge.js';
import { Spinner } from '@/components/ui/spinner.js';
import { ErrorState } from '@/components/ui/error-state.js';
import { EmptyState } from '@/components/ui/empty-state.js';

const emptyForm: CreateAssignmentInput = {
  itemId: '',
  itemName: '',
  employeeId: '',
  employeeName: '',
  assignedAt: new Date().toISOString().slice(0, 10),
  returnedAt: '',
  notes: '',
  status: 'Active',
};

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
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

async function processPhotoFile(file: File, label: PhotoLabel): Promise<PhotoRecord> {
  const maxBytes = 5 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error(
      `File "${file.name}" is ${(file.size / (1024 * 1024)).toFixed(2)} MB. Maximum allowed photo size is 5 MB.`,
    );
  }

  if (!file.type.match(/^image\/(jpeg|jpg|png|webp)$/i)) {
    throw new Error(`File "${file.name}" is not a supported format. Please upload JPG, PNG, or WEBP image.`);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to decode image data.'));
      img.onload = () => {
        const maxDim = 1600;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable.'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const outputMime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const dataUri = canvas.toDataURL(outputMime, 0.85);
        const sizeBytes = Math.round((dataUri.length * 3) / 4);

        if (sizeBytes > maxBytes) {
          reject(new Error('Optimized photo exceeds 5 MB. Please upload a smaller image.'));
          return;
        }

        resolve({
          label,
          mimeType: outputMime,
          sizeBytes,
          dataUri,
          capturedAt: new Date().toISOString(),
        });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

const PHOTO_SLOTS: Array<{ label: PhotoLabel; name: string; required: boolean; hint: string }> = [
  { label: 'front', name: 'Front of Device', required: true, hint: 'Screen, front glass, active display & front bezels' },
  { label: 'back', name: 'Back of Device', required: true, hint: 'Rear cover, camera module, serial number & IMEI' },
  { label: 'extra_1', name: 'Side / Edges (Optional)', required: false, hint: 'SIM tray, volume buttons & ports' },
  { label: 'extra_2', name: 'Accessories / Box (Optional)', required: false, hint: 'Charger, data cable, packaging or case' },
];

function PhotoUploadSection({
  title = 'Device Condition Photos',
  subtitle = 'Front and Back photos of the device are mandatory for chain-of-custody verification (under 5 MB each).',
  photos,
  onChange,
  error,
}: {
  title?: string;
  subtitle?: string;
  photos: PhotoRecord[];
  onChange: (photos: PhotoRecord[]) => void;
  error?: string | null;
}) {
  const [processingLabel, setProcessingLabel] = useState<PhotoLabel | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<PhotoRecord | null>(null);

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const hasFront = photos.some((p) => p.label === 'front');
  const hasBack = photos.some((p) => p.label === 'back');

  const handleFileChange = async (label: PhotoLabel, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setLocalError(null);
    setProcessingLabel(label);

    try {
      const processed = await processPhotoFile(file, label);
      const updated = photos.filter((p) => p.label !== label);
      onChange([...updated, processed]);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to process photo.');
    } finally {
      setProcessingLabel(null);
    }
  };

  const handleRemove = (label: PhotoLabel) => {
    onChange(photos.filter((p) => p.label !== label));
  };

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
        <div>
          <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Camera className="h-4 w-4 text-primary" />
            {title}
          </h4>
          <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {hasFront && hasBack ? (
            <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              Front &amp; Back Verified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              <AlertCircle className="h-3 w-3 text-amber-600" />
              Front &amp; Back Required
            </span>
          )}
        </div>
      </div>

      {(error || localError) && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error || localError}</span>
        </div>
      )}

      {/* Grid of Photo Slots */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {PHOTO_SLOTS.map((slot) => {
          const currentPhoto = photos.find((p) => p.label === slot.label);
          const isProcessing = processingLabel === slot.label;

          return (
            <div
              key={slot.label}
              className={cn(
                'relative flex flex-col rounded-lg border p-2.5 transition-all',
                currentPhoto
                  ? 'border-emerald-200/80 bg-emerald-50/20 dark:border-emerald-900 dark:bg-emerald-950/10'
                  : slot.required
                  ? 'border-amber-200 bg-amber-50/10 dark:border-amber-900/50 dark:bg-amber-950/5'
                  : 'border-border/60 bg-background/50',
              )}
            >
              <div className="flex items-center justify-between gap-1 mb-2">
                <span className="text-xs font-medium text-foreground flex items-center gap-1">
                  {slot.name}
                  {slot.required && <span className="text-destructive font-bold">*</span>}
                </span>
                {currentPhoto ? (
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-emerald-100/60 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700"
                  >
                    ✓ Attached
                  </Badge>
                ) : slot.required ? (
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-amber-100/60 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700"
                  >
                    Mandatory
                  </Badge>
                ) : (
                  <span className="text-[10px] text-muted-foreground">Optional</span>
                )}
              </div>

              {/* Hidden file input */}
              <input
                ref={(el) => {
                  fileInputRefs.current[slot.label] = el;
                }}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => void handleFileChange(slot.label, e)}
              />

              {currentPhoto ? (
                <div className="space-y-2">
                  <div className="relative group rounded-md overflow-hidden border bg-black/5 aspect-video flex items-center justify-center">
                    <img
                      src={currentPhoto.dataUri}
                      alt={slot.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-7 px-2 text-xs gap-1"
                        onClick={() => setPreviewPhoto(currentPhoto)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Preview
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        className="h-7 px-2 text-xs gap-1"
                        onClick={() => handleRemove(slot.label)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-muted-foreground px-0.5">
                    <span>Size: {(currentPhoto.sizeBytes / 1024).toFixed(0)} KB (&lt; 5 MB)</span>
                    <button
                      type="button"
                      className="text-primary hover:underline text-[10px]"
                      onClick={() => fileInputRefs.current[slot.label]?.click()}
                    >
                      Change Photo
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => fileInputRefs.current[slot.label]?.click()}
                  className={cn(
                    'flex flex-col items-center justify-center rounded-md border-2 border-dashed p-4 text-center cursor-pointer transition-colors aspect-video',
                    slot.required
                      ? 'border-amber-300 hover:border-amber-400 bg-amber-500/5 hover:bg-amber-500/10 dark:border-amber-800'
                      : 'border-border hover:border-primary/50 hover:bg-muted/30',
                  )}
                >
                  {isProcessing ? (
                    <div className="flex flex-col items-center gap-1.5">
                      <Spinner size="sm" />
                      <span className="text-[11px] text-muted-foreground">Compressing &lt; 5 MB...</span>
                    </div>
                  ) : (
                    <>
                      <Camera className="h-6 w-6 text-muted-foreground/70 mb-1" />
                      <span className="text-xs font-medium text-foreground">
                        {slot.required ? `Click to upload ${slot.name}` : `Upload ${slot.name}`}
                      </span>
                      <span className="text-[10px] text-muted-foreground mt-0.5">
                        Max 5 MB • JPG, PNG, WEBP
                      </span>
                    </>
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Full-view Lightbox Modal */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
          onClick={() => setPreviewPhoto(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-3xl overflow-hidden rounded-lg bg-background p-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-2 px-1">
              <span className="text-sm font-semibold capitalize">
                {previewPhoto.label.replace('_', ' ')} Photo Preview
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full"
                onClick={() => setPreviewPhoto(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-2 flex items-center justify-center max-h-[75vh]">
              <img
                src={previewPhoto.dataUri}
                alt="Enlarged view"
                className="max-h-[70vh] w-auto rounded object-contain"
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-2 px-1">
              <span>Size: {(previewPhoto.sizeBytes / 1024).toFixed(0)} KB (Limit: 5 MB)</span>
              <span>Captured: {previewPhoto.capturedAt.slice(0, 19).replace('T', ' ')}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PhotoGalleryModal({
  assignment,
  onClose,
}: {
  assignment: Assignment;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'all' | 'assignment' | 'return'>('all');
  const [zoomPhoto, setZoomPhoto] = useState<PhotoRecord | null>(null);

  const asgnPhotos = assignment.assignmentPhotos || [];
  const retPhotos = assignment.returnPhotos || [];

  const displayedPhotos: Array<{ photo: PhotoRecord; context: 'Assignment' | 'Return' }> = [];
  if (activeTab === 'all' || activeTab === 'assignment') {
    asgnPhotos.forEach((p) => displayedPhotos.push({ photo: p, context: 'Assignment' }));
  }
  if (activeTab === 'all' || activeTab === 'return') {
    retPhotos.forEach((p) => displayedPhotos.push({ photo: p, context: 'Return' }));
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
    >
      <Card className="max-h-[92vh] w-full max-w-2xl overflow-y-auto shadow-2xl">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Camera className="h-5 w-5 text-primary" />
              Device Condition Photos — {assignment.itemName}
            </CardTitle>
            <CardDescription className="text-xs">
              IMEI/ID: <span className="font-mono">{assignment.itemId}</span> • Custodian: <strong>{assignment.employeeName}</strong>
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {/* Tab Filter */}
          <div className="flex items-center gap-1 border-b pb-2 text-xs">
            <Button
              type="button"
              variant={activeTab === 'all' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setActiveTab('all')}
            >
              All Photos ({asgnPhotos.length + retPhotos.length})
            </Button>
            <Button
              type="button"
              variant={activeTab === 'assignment' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setActiveTab('assignment')}
            >
              Assignment Photos ({asgnPhotos.length})
            </Button>
            <Button
              type="button"
              variant={activeTab === 'return' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setActiveTab('return')}
            >
              Return Photos ({retPhotos.length})
            </Button>
          </div>

          {displayedPhotos.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-xs">
              <Camera className="h-8 w-8 mx-auto mb-2 opacity-40" />
              No condition photos available for this category.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {displayedPhotos.map(({ photo, context }, idx) => (
                <div
                  key={`${context}-${photo.label}-${idx}`}
                  className="group rounded-lg border bg-card p-2.5 space-y-2 shadow-xs hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold capitalize flex items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[9px] px-1.5 py-0',
                          context === 'Assignment'
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
                        )}
                      >
                        {context}
                      </Badge>
                      {photo.label.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {(photo.sizeBytes / 1024).toFixed(0)} KB
                    </span>
                  </div>

                  <div
                    className="relative overflow-hidden rounded-md border aspect-video cursor-pointer bg-black/5"
                    onClick={() => setZoomPhoto(photo)}
                  >
                    <img
                      src={photo.dataUri}
                      alt={`${context} ${photo.label}`}
                      className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-200"
                    />
                    <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 text-white text-xs font-medium">
                      <ZoomIn className="h-4 w-4" />
                      <span>Click to enlarge</span>
                    </div>
                  </div>

                  <p className="text-[10px] text-muted-foreground text-right">
                    Captured: {photo.capturedAt ? photo.capturedAt.slice(0, 19).replace('T', ' ') : '—'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Full zoom */}
      {zoomPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4"
          onClick={() => setZoomPhoto(null)}
        >
          <div
            className="relative max-h-[92vh] max-w-4xl overflow-hidden rounded-lg bg-background p-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-2 px-1">
              <span className="text-sm font-semibold capitalize">
                {zoomPhoto.label.replace('_', ' ')} View
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full"
                onClick={() => setZoomPhoto(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-2 flex items-center justify-center max-h-[75vh]">
              <img
                src={zoomPhoto.dataUri}
                alt="Zoomed device photo"
                className="max-h-[72vh] w-auto rounded object-contain"
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-2 px-1">
              <span>Size: {(zoomPhoto.sizeBytes / 1024).toFixed(0)} KB (under 5 MB limit)</span>
              <span>Timestamp: {zoomPhoto.capturedAt}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AssignmentForm({
  assignment,
  onClose,
}: {
  assignment?: Assignment;
  onClose: () => void;
}) {
  const [form, setForm] = useState<CreateAssignmentInput>(
    assignment
      ? {
          itemId: assignment.itemId,
          itemName: assignment.itemName,
          employeeId: assignment.employeeId,
          employeeName: assignment.employeeName,
          assignedAt: assignment.assignedAt,
          returnedAt: assignment.returnedAt || '',
          notes: assignment.notes || '',
          status: assignment.status,
        }
      : emptyForm,
  );

  const [selectedStockId, setSelectedStockId] = useState<string>('');
  const [selectedEmpCode, setSelectedEmpCode] = useState<string>('');
  const [assignmentPhotos, setAssignmentPhotos] = useState<PhotoRecord[]>(assignment?.assignmentPhotos || []);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Fetch available devices from stock (only when creating new assignment)
  const { data: stockData, isLoading: stockLoading } = useInventory({
    page: 1,
    pageSize: 100,
    search: '',
    brand: '',
    status: 'Inactive',
  });
  const availableStock = stockData?.records ?? [];

  // Fetch team members / employees (only when creating new assignment)
  const { data: teamMembers, isLoading: teamLoading } = useQuery<AuthUser[]>({
    queryKey: ['team-members'],
    queryFn: () => apiClient.get<AuthUser[]>('/auth/team-members'),
    enabled: !assignment,
  });

  const { create, update } = useAssignmentMutations();
  const mutation = assignment ? update : create;

  const set = (name: keyof CreateAssignmentInput, value: string | AssignmentStatus) =>
    setForm((current) => ({ ...current, [name]: value }));

  const handleStockSelect = (val: string) => {
    setSelectedStockId(val);
    if (!val || val === '__MANUAL__') return;
    const found = availableStock.find((item) => (item.imei1 || item.itemId) === val);
    if (found) {
      set('itemName', `${found.brand} ${found.deviceModel}`);
      set('itemId', found.imei1 || found.itemId);
    }
  };

  const handleEmpSelect = (val: string) => {
    setSelectedEmpCode(val);
    if (!val || val === '__MANUAL__') return;
    const found = (teamMembers ?? []).find((m) => m.empCode === val);
    if (found) {
      set('employeeName', found.name);
      set('employeeId', found.email || found.empCode);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setPhotoError(null);

    if (!assignment) {
      const hasFront = assignmentPhotos.some((p) => p.label === 'front');
      const hasBack = assignmentPhotos.some((p) => p.label === 'back');
      if (!hasFront || !hasBack) {
        setPhotoError('Mandatory photos required: Both Front and Back photos of the device must be uploaded before assigning.');
        return;
      }
    }

    if (assignment) {
      update.mutate({ id: assignment.id, input: form }, { onSuccess: onClose });
    } else {
      create.mutate({ ...form, assignmentPhotos }, { onSuccess: onClose });
    }
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <Card className="max-h-[92vh] w-full max-w-xl overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle>{assignment ? 'Edit Assignment' : 'Assign Device'}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {assignment
                ? 'Controlled amendment. Deletion is restricted by compliance policy.'
                : 'Directly allocate hardware to an employee.'}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            {!assignment && (
              <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Smartphone className="h-3.5 w-3.5 text-primary" />
                      Quick Pick: Available In-Stock Device
                    </span>
                    {stockLoading && <Spinner size="sm" />}
                  </div>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
                    value={selectedStockId}
                    onChange={(e) => handleStockSelect(e.target.value)}
                  >
                    <option value="">-- Choose from available inventory ({availableStock.length} in stock) --</option>
                    {availableStock.map((d) => (
                      <option key={d.itemId} value={d.imei1 || d.itemId}>
                        {d.brand} {d.deviceModel} (IMEI: {d.imei1 || d.itemId}) • Loc: {d.warehouseLocation}
                      </option>
                    ))}
                    <option value="__MANUAL__">Enter device manually below</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-primary" />
                      Quick Pick: Employee / Assignee
                    </span>
                    {teamLoading && <Spinner size="sm" />}
                  </div>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
                    value={selectedEmpCode}
                    onChange={(e) => handleEmpSelect(e.target.value)}
                  >
                    <option value="">-- Choose team member / employee --</option>
                    {(teamMembers ?? []).map((m) => (
                      <option key={m.id} value={m.empCode}>
                        {m.name} — {m.email} ({m.team})
                      </option>
                    ))}
                    <option value="__MANUAL__">Enter employee manually below</option>
                  </select>
                </div>
              </div>
            )}

            <Field label="Device Model / Name" required>
              <TextInput
                value={form.itemName}
                required
                placeholder="e.g. Tecno Camon 30 Premier"
                onChange={(val) => set('itemName', val)}
              />
            </Field>

            <Field label="Item Identifier (IMEI1 or Serial Number)" required>
              <TextInput
                value={form.itemId}
                required
                placeholder="356789012345678"
                onChange={(val) => set('itemId', val)}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                System prevents assigning any device currently in active possession.
              </p>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Employee Name" required>
                <TextInput
                  value={form.employeeName}
                  required
                  placeholder="e.g. Garima Bhatt"
                  onChange={(val) => set('employeeName', val)}
                />
              </Field>
              <Field label="Employee ID / Email" required>
                <TextInput
                  value={form.employeeId}
                  required
                  placeholder="garima.bhatt@transsion.com"
                  onChange={(val) => set('employeeId', val)}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Assigned Date" required>
                <TextInput
                  type="date"
                  value={form.assignedAt}
                  required
                  onChange={(val) => set('assignedAt', val)}
                />
              </Field>
              <Field label="Assignment Status">
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.status}
                  onChange={(e) => set('status', e.target.value as AssignmentStatus)}
                >
                  <option value="Active">Active</option>
                  <option value="Returned">Returned</option>
                </select>
              </Field>
            </div>

            <Field label="Notes / Purpose" wide>
              <textarea
                className="min-h-20 w-full rounded-md border border-input bg-background p-2.5 text-sm"
                value={form.notes || ''}
                placeholder="Project allocation, QA sprint, accessories included..."
                onChange={(e) => set('notes', e.target.value)}
              />
            </Field>

            {!assignment && (
              <PhotoUploadSection
                title="Device Checkout Condition Photos"
                subtitle="Front and Back photos of the device are mandatory for chain-of-custody verification (under 5 MB each)."
                photos={assignmentPhotos}
                onChange={setAssignmentPhotos}
                error={photoError}
              />
            )}

            {mutation.isError && (
              <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                {mutation.error instanceof Error ? mutation.error.message : 'Could not save assignment.'}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Spinner size="sm" className="mr-1" />}
                Save Assignment
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function ReturnModal({
  assignment,
  onClose,
}: {
  assignment: Assignment;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [returnedAt, setReturnedAt] = useState(new Date().toISOString().slice(0, 10));
  const [returnedBy, setReturnedBy] = useState(assignment.employeeName || '');
  const [returnedTo, setReturnedTo] = useState(
    user?.name ? `${user.name} (${user.role})` : 'IT Admin (Admin)',
  );
  const [returnLocation, setReturnLocation] = useState('Main Warehouse');
  const [returnCondition, setReturnCondition] = useState('Good / Fully Functional');
  const [notes, setNotes] = useState('');
  const [returnPhotos, setReturnPhotos] = useState<PhotoRecord[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const { returnAssignment } = useAssignmentMutations();

  const handleReturn = (e: React.FormEvent) => {
    e.preventDefault();
    setPhotoError(null);

    const hasFront = returnPhotos.some((p) => p.label === 'front');
    const hasBack = returnPhotos.some((p) => p.label === 'back');
    if (!hasFront || !hasBack) {
      setPhotoError('Mandatory photos required: Both Front and Back photos of the device must be captured upon return.');
      return;
    }

    returnAssignment.mutate(
      {
        id: assignment.id,
        input: {
          returnedAt,
          returnedBy,
          returnedTo,
          returnLocation,
          returnCondition,
          notes: notes ? `${assignment.notes ? assignment.notes + ' | ' : ''}Return: ${notes}` : assignment.notes,
          returnPhotos,
        },
      },
      { onSuccess: onClose },
    );
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <Card className="max-h-[92vh] w-full max-w-lg overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-primary" />
              Check-in Returned Device & Update Custody
            </CardTitle>
            <CardDescription>
              Validate custody handover of <strong>{assignment.itemName}</strong> back into IT Inventory.
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleReturn} className="space-y-4">
            <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1">
              <p><strong>Device:</strong> {assignment.itemName} ({assignment.itemId})</p>
              <p>
                <strong>Assigned On:</strong> {assignment.assignedAt} • <strong>Current Custodian:</strong> {assignment.employeeName}
              </p>
              {assignment.assignedFrom && (
                <p className="text-muted-foreground"><strong>Original Source:</strong> {assignment.assignedFrom}</p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Returned By (Engineer)" required>
                <TextInput
                  value={returnedBy}
                  required
                  placeholder="e.g. Employee Name"
                  onChange={setReturnedBy}
                />
              </Field>
              <Field label="Returned To (Receiver)" required>
                <TextInput
                  value={returnedTo}
                  required
                  placeholder="e.g. Admin or TL name"
                  onChange={setReturnedTo}
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Return Date" required>
                <TextInput
                  type="date"
                  value={returnedAt}
                  required
                  onChange={setReturnedAt}
                />
              </Field>
              <Field label="Restock Location" required>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={returnLocation}
                  onChange={(e) => setReturnLocation(e.target.value)}
                >
                  <option value="Main Warehouse">Main Warehouse</option>
                  <option value="WH-1 (Main Hub)">WH-1 (Main Hub)</option>
                  <option value="QA Lab Benches">QA Lab Benches</option>
                  <option value="IT Stock Storage">IT Stock Storage</option>
                  <option value="Device Testing Rack">Device Testing Rack</option>
                </select>
              </Field>
            </div>

            <Field label="Physical & Functional Condition" required>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={returnCondition}
                onChange={(e) => setReturnCondition(e.target.value)}
              >
                <option value="Good / Fully Functional">Good / Fully Functional</option>
                <option value="Pristine / Like New">Pristine / Like New</option>
                <option value="Minor Cosmetic Scratches">Minor Cosmetic Scratches</option>
                <option value="Damaged / Broken Screen or Body">Damaged / Broken Screen or Body</option>
                <option value="Firmware / Brick Issue">Firmware / Brick Issue</option>
              </select>
            </Field>

            <Field label="Inspection Notes / Handover Remarks">
              <textarea
                className="min-h-16 w-full rounded-md border border-input bg-background p-2.5 text-sm"
                value={notes}
                placeholder="Accessories returned (charger, cable, box), screen condition, firmware status..."
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>

            <PhotoUploadSection
              title="Return Condition Photos (Mandatory)"
              subtitle="Front and Back photos of the returned device are mandatory to verify physical return condition (under 5 MB)."
              photos={returnPhotos}
              onChange={setReturnPhotos}
              error={photoError}
            />

            {returnAssignment.isError && (
              <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                {returnAssignment.error instanceof Error ? returnAssignment.error.message : 'Could not process return.'}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={returnAssignment.isPending}>
                {returnAssignment.isPending && <Spinner size="sm" className="mr-1" />}
                Confirm Return & Re-stock
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function ReallocationModal({
  assignment,
  onClose,
}: {
  assignment: Assignment;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [selectedEmpCode, setSelectedEmpCode] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [employeeEmail, setEmployeeEmail] = useState('');
  const [assignedAt, setAssignedAt] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState(`Reallocated after return from ${assignment.employeeName}`);
  const [assignmentPhotos, setAssignmentPhotos] = useState<PhotoRecord[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const { create } = useAssignmentMutations();

  // Fetch employees for dropdown
  const { data: teamMembers, isLoading: teamLoading } = useQuery<AuthUser[]>({
    queryKey: ['team-members'],
    queryFn: () => apiClient.get<AuthUser[]>('/auth/team-members'),
  });

  const handleSelectEmployee = (val: string) => {
    setSelectedEmpCode(val);
    if (!val || val === '__MANUAL__') {
      if (val === '__MANUAL__') {
        setEmployeeName('');
        setEmployeeEmail('');
      }
      return;
    }
    const found = (teamMembers ?? []).find((m) => m.empCode === val || m.id === val);
    if (found) {
      setEmployeeName(found.name);
      setEmployeeEmail(found.email);
    }
  };

  const handleReallocate = (e: React.FormEvent) => {
    e.preventDefault();
    setPhotoError(null);

    if (!employeeName.trim() || !employeeEmail.trim()) {
      alert('Please select an employee or enter their name and email address.');
      return;
    }

    const hasFront = assignmentPhotos.some((p) => p.label === 'front');
    const hasBack = assignmentPhotos.some((p) => p.label === 'back');
    if (!hasFront || !hasBack) {
      setPhotoError('Mandatory photos required: Both Front and Back photos of the device must be uploaded for reallocation.');
      return;
    }

    create.mutate(
      {
        itemId: assignment.itemId,
        itemName: assignment.itemName,
        employeeName: employeeName.trim(),
        employeeId: employeeEmail.trim(),
        assignedAt,
        returnedAt: '',
        notes: notes.trim(),
        status: 'Active',
        assignedFrom: assignment.assignedFrom || 'IT Stock',
        assignedBy: user ? `${user.name} (${user.empCode})` : 'System Admin',
        assignedByRole: user?.role || 'Admin',
        assignmentPhotos,
      },
      { onSuccess: onClose },
    );
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <Card className="max-h-[92vh] w-full max-w-lg overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5 text-primary" />
              Reallocate Returned Device
            </CardTitle>
            <CardDescription>
              Assign returned device <strong>{assignment.itemName}</strong> ({assignment.itemId}) to an employee.
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleReallocate} className="space-y-4">
            {/* Employee Dropdown Selection */}
            <div className="space-y-1.5 rounded-lg border bg-muted/20 p-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-primary" />
                  Select Employee (Assignee) <span className="text-destructive">*</span>
                </label>
                {teamLoading && <Spinner size="sm" />}
              </div>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={selectedEmpCode}
                onChange={(e) => handleSelectEmployee(e.target.value)}
              >
                <option value="">-- Choose employee from directory ({teamMembers?.length ?? 0} members) --</option>
                {(teamMembers ?? []).map((m) => (
                  <option key={m.id} value={m.empCode}>
                    {m.name} — {m.email} ({m.team})
                  </option>
                ))}
                <option value="__MANUAL__">Manual Entry / Other Assignee...</option>
              </select>
              <p className="text-[11px] text-muted-foreground">
                Selecting an employee automatically fills their name and official email address below.
              </p>
            </div>

            {/* Employee Name & Email */}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Assignee Full Name" required>
                <TextInput
                  value={employeeName}
                  required
                  placeholder="e.g. Harshit Bhatnagar"
                  onChange={setEmployeeName}
                />
              </Field>

              <Field label="Assignee Email Address" required>
                <TextInput
                  type="email"
                  value={employeeEmail}
                  required
                  placeholder="harshit.bhatnagar@transsion.com"
                  onChange={setEmployeeEmail}
                />
              </Field>
            </div>

            <Field label="Reallocation Date" required>
              <TextInput
                type="date"
                value={assignedAt}
                required
                onChange={setAssignedAt}
              />
            </Field>

            <Field label="Notes / Purpose">
              <textarea
                className="min-h-20 w-full rounded-md border border-input bg-background p-2.5 text-sm"
                value={notes}
                placeholder="Reason for reallocation, lab testing, sprint assignment..."
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>

            <PhotoUploadSection
              title="Reallocation Checkout Photos (Mandatory)"
              subtitle="Front and Back photos of the device are mandatory when reassigning (under 5 MB)."
              photos={assignmentPhotos}
              onChange={setAssignmentPhotos}
              error={photoError}
            />

            {create.isError && (
              <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                {create.error instanceof Error ? create.error.message : 'Could not reallocate device.'}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={create.isPending || !employeeName.trim() || !employeeEmail.trim()}>
                {create.isPending && <Spinner size="sm" className="mr-1" />}
                Confirm Reallocation
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export function AssignmentsPage() {
  const [filters, setFilters] = useState<AssignmentFilters>({
    page: 1,
    pageSize: 10,
    search: '',
    status: '',
  });

  const [formItem, setFormItem] = useState<Assignment | null | undefined>(undefined);
  const [returningItem, setReturningItem] = useState<Assignment | null>(null);
  const [reallocatingItem, setReallocatingItem] = useState<Assignment | null>(null);
  const [trackingItem, setTrackingItem] = useState<string | null>(null);
  const [viewingPhotosAssignment, setViewingPhotosAssignment] = useState<Assignment | null>(null);
  const [showMyDevicesOnly, setShowMyDevicesOnly] = useState(false);

  const { data, isLoading, isError, error } = useAssignments(filters);
  const { role, user } = useUserRole();
  const { downloadAssignmentsUrl } = useDownloadReport();

  const updateFilter = <K extends keyof AssignmentFilters>(name: K, value: AssignmentFilters[K]) =>
    setFilters((current) => ({
      ...current,
      [name]: value,
      ...(name !== 'page' && { page: 1 }),
    }));

  const records = data?.records || [];
  const displayedRecords = showMyDevicesOnly
    ? records.filter(
        (a) =>
          a.employeeId.toLowerCase() === user.email.toLowerCase() ||
          a.employeeId.toLowerCase() === (user.employeeId || '').toLowerCase(),
      )
    : records;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Smartphone className="h-6 w-6 text-primary" />
            {role === 'Employee' ? 'My Assigned Devices' : 'Device Assignments & Tracking'}
          </h2>
          <p className="text-muted-foreground text-sm">
            {role === 'Employee'
              ? `Hardware currently registered in your custody (${user.name} • ${user.employeeId || user.email})`
              : 'Track hardware allocations, enforce return validation, and manage safe reallocation.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {role === 'Employee' ? (
            <Link to="/requests">
              <Button size="sm" className="gap-1.5 shadow-xs">
                <Plus className="h-4 w-4" />
                Request New Device
              </Button>
            </Link>
          ) : (
            <>
              {/* Employee / Self Filter Tab for TL / Admin */}
              <Button
                variant={showMyDevicesOnly ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowMyDevicesOnly((prev) => !prev)}
                className="text-xs gap-1.5"
              >
                <User className="h-3.5 w-3.5" />
                {showMyDevicesOnly ? 'Showing My Assignments' : 'Filter My Assignments'}
              </Button>

              <Button size="sm" onClick={() => setFormItem(null)} className="gap-1.5 shadow-xs">
                <Plus className="h-4 w-4" />
                New Assignment
              </Button>
            </>
          )}

          {/* Export CSV Button (Pillar 4) */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(downloadAssignmentsUrl(), '_blank')}
            className="gap-1.5 text-xs"
          >
            <Download className="h-3.5 w-3.5" />
            Export Details (CSV)
          </Button>
        </div>
      </div>

      {/* Compliance Note */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground flex items-center justify-between">
        <span className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>
            <strong>Reallocation Integrity Policy:</strong> Devices in active possession cannot be reassigned until returned. Deletions are strictly prohibited.
          </span>
        </span>
        <Badge variant="outline" className="text-[10px]">Zero-Deletion Policy</Badge>
      </div>

      {/* Stat Cards */}
      {role === 'Employee' ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            title="Devices in My Possession"
            value={data?.activeCount ?? 0}
            subtitle="Active hardware registered under your name"
            highlight
          />
          <StatCard
            title="Historically Returned"
            value={data?.returnedCount ?? 0}
            subtitle="Units checked back into IT inventory"
          />
          <StatCard
            title="Total Assignment History"
            value={data?.total ?? 0}
            subtitle="Complete lifecycle custody trail"
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total Assignments" value={data?.total ?? '—'} />
          <StatCard title="Currently Active" value={data?.activeCount ?? '—'} />
          <StatCard title="Returned & In Stock" value={data?.returnedCount ?? '—'} />
          <StatCard
            title="Active Allocations"
            value={data ? `${data.activeCount} devices` : '—'}
          />
        </div>
      )}

      {/* Filter Bar */}
      <Card>
        <CardContent className="flex flex-wrap gap-3 pt-6">
          <label className="relative min-w-64 flex-1">
            <span className="sr-only">Search assignments</span>
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm"
              placeholder="Search device name, IMEI, employee name, or employee ID"
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
            />
          </label>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Filter status"
            value={filters.status}
            onChange={(e) => updateFilter('status', e.target.value as AssignmentStatus | '')}
          >
            <option value="">All statuses</option>
            <option value="Active">Active</option>
            <option value="Returned">Returned</option>
          </select>
        </CardContent>
      </Card>

      {/* Assignments Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-12">
              <Spinner />
            </div>
          ) : isError ? (
            <div className="p-6">
              <ErrorState
                message={error instanceof Error ? error.message : 'Unable to load assignments.'}
              />
            </div>
          ) : displayedRecords.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<Smartphone className="h-8 w-8 text-muted-foreground/50" />}
                title={role === 'Employee' ? 'No devices registered under your name' : 'No assignments found'}
                description={
                  role === 'Employee'
                    ? 'You do not have any devices currently registered in your custody. Submit an equipment request to receive testing hardware.'
                    : showMyDevicesOnly
                    ? 'No devices are currently assigned to your account.'
                    : 'Assign equipment to an employee to get started.'
                }
                action={
                  role === 'Employee' ? (
                    <Link to="/requests" className="mt-2">
                      <Button size="sm" className="gap-1.5 shadow-xs">
                        <Plus className="h-4 w-4" />
                        Submit Equipment Request
                      </Button>
                    </Link>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Device Name</th>
                    <th className="px-4 py-3 font-medium">Item Identifier (IMEI)</th>
                    <th className="px-4 py-3 font-medium">Assigned To</th>
                    <th className="px-4 py-3 font-medium">Employee ID</th>
                    <th className="px-4 py-3 font-medium">Assigned Date</th>
                    <th className="px-4 py-3 font-medium">Returned Date</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Condition Photos</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {displayedRecords.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{item.itemName}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.itemId}</td>
                      <td className="px-4 py-3">{item.employeeName}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.employeeId}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.assignedAt}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.returnedAt || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 items-start">
                          <Badge variant={item.status === 'Active' ? 'success' : 'secondary'}>
                            {item.status}
                          </Badge>
                          {item.status === 'Returned' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded px-1.5 py-0.5" title="Device has been checked in and is stored in Device Inventory stock">
                              <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600" />
                              Stored in Stock
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {((item.assignmentPhotos?.length || 0) + (item.returnPhotos?.length || 0)) > 0 ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1.5 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/50"
                            onClick={() => setViewingPhotosAssignment(item)}
                          >
                            <Camera className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                            <span>
                              {(item.assignmentPhotos?.length || 0) + (item.returnPhotos?.length || 0)} Photo{((item.assignmentPhotos?.length || 0) + (item.returnPhotos?.length || 0)) === 1 ? '' : 's'}
                            </span>
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground/60 italic">No photos</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Custody Trail Button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7 gap-1 text-primary hover:text-primary hover:bg-primary/10"
                            title="Inspect complete device custody trail"
                            onClick={() => setTrackingItem(item.itemId)}
                          >
                            <History className="h-3 w-3" />
                            Custody
                          </Button>

                          {/* Return Button: visible if Active (to Assignee, TL, or Admin) */}
                          {item.status === 'Active' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-7 gap-1"
                              onClick={() => setReturningItem(item)}
                            >
                              <RotateCcw className="h-3 w-3" />
                              Return
                            </Button>
                          )}

                          {/* Reallocate Button: visible if Returned (to TL or Admin) */}
                          {item.status === 'Returned' && (role === 'TL' || role === 'Admin') && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-7 gap-1 text-primary hover:bg-primary/5"
                              onClick={() => setReallocatingItem(item)}
                            >
                              <Share2 className="h-3 w-3" />
                              Reallocate
                            </Button>
                          )}

                          {role === 'Admin' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs h-7"
                              onClick={() => setFormItem(item)}
                            >
                              Edit
                            </Button>
                          )}
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
          <span>{data ? `${data.total} assignment${data.total === 1 ? '' : 's'}` : ''}</span>
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

      {/* Modals */}
      {formItem !== undefined && (
        <AssignmentForm
          assignment={formItem ?? undefined}
          onClose={() => setFormItem(undefined)}
        />
      )}

      {returningItem !== null && (
        <ReturnModal
          assignment={returningItem}
          onClose={() => setReturningItem(null)}
        />
      )}

      {reallocatingItem !== null && (
        <ReallocationModal
          assignment={reallocatingItem}
          onClose={() => setReallocatingItem(null)}
        />
      )}

      {trackingItem !== null && (
        <DeviceTrackingModal
          deviceIdentifier={trackingItem}
          onClose={() => setTrackingItem(null)}
        />
      )}

      {viewingPhotosAssignment !== null && (
        <PhotoGalleryModal
          assignment={viewingPhotosAssignment}
          onClose={() => setViewingPhotosAssignment(null)}
        />
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  highlight = false,
}: {
  title: string;
  value: number | string;
  subtitle?: string;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? 'border-primary/40 bg-primary/5' : ''}>
      <CardContent className="pt-5">
        <p className={cn('text-2xl font-bold', highlight ? 'text-primary' : '')}>{value}</p>
        <p className="text-sm font-medium text-foreground mt-0.5">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

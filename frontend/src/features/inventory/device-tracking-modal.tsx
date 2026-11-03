import {
  X,
  History,
  Package,
  ArrowRight,
  ShieldCheck,
  User,
  ArrowLeftRight,
  RotateCcw,
  ClipboardList,
  MapPin,
  Clock,
  Copy,
  Check,
  Camera,
  ZoomIn,
} from 'lucide-react';
import { useState } from 'react';
import { useDeviceCustodyTracking } from '@/hooks/use-inventory.js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.js';
import { Button } from '@/components/ui/button.js';
import { Badge } from '@/components/ui/badge.js';
import { Spinner } from '@/components/ui/spinner.js';
import { ErrorState } from '@/components/ui/error-state.js';

interface DeviceTrackingModalProps {
  deviceIdentifier: string;
  onClose: () => void;
}

export function DeviceTrackingModal({ deviceIdentifier, onClose }: DeviceTrackingModalProps) {
  const { data: tracking, isLoading, isError, error } = useDeviceCustodyTracking(deviceIdentifier);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [zoomPhoto, setZoomPhoto] = useState<{ label?: string; dataUri: string; sizeBytes?: number; capturedAt?: string } | null>(null);

  const copyText = (text: string, id: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'INGESTION':
        return <Package className="h-4 w-4 text-sky-600" />;
      case 'REQUISITION':
        return <ClipboardList className="h-4 w-4 text-amber-600" />;
      case 'ASSIGNMENT':
        return <ArrowLeftRight className="h-4 w-4 text-blue-600" />;
      case 'RETURN':
        return <RotateCcw className="h-4 w-4 text-emerald-600" />;
      default:
        return <History className="h-4 w-4 text-purple-600" />;
    }
  };

  const getStageBadge = (stage: string) => {
    switch (stage) {
      case 'INGESTION':
        return <Badge variant="outline" className="text-[10px] bg-sky-500/10 text-sky-700 border-sky-500/30">Intake</Badge>;
      case 'REQUISITION':
        return <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 border-amber-500/30">Requisition</Badge>;
      case 'ASSIGNMENT':
        return <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-700 border-blue-500/30">Checkout</Badge>;
      case 'RETURN':
        return <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-500/30">Return</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">Movement</Badge>;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
    >
      <Card className="max-h-[92vh] w-full max-w-3xl overflow-y-auto shadow-2xl border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between pb-3 bg-muted/30 border-b">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Device Custody &amp; Handover Journey</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Complete chain of custody: source inventory, requester, assigner, returner, and receiver.
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="space-y-6 pt-5">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Spinner size="lg" />
              <p className="mt-3 text-sm text-muted-foreground">Tracing device movements and custody audit records…</p>
            </div>
          )}

          {isError && (
            <ErrorState
              title="Failed to load device tracking"
              message={error instanceof Error ? error.message : 'Could not query custody records.'}
            />
          )}

          {tracking && (
            <>
              {/* Device Overview Banner */}
              <div className="rounded-xl border border-border bg-gradient-to-r from-card via-card to-primary/5 p-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base text-foreground">
                        {tracking.item.brand} {tracking.item.deviceModel}
                      </span>
                      <Badge variant="outline" className="font-mono text-[10px] bg-primary/10 text-primary border-primary/30">
                        {tracking.item.sampleHwType || 'PRO'}
                      </Badge>
                      <Badge
                        variant="default"
                        className={
                          tracking.item.status === 'Active'
                            ? 'bg-blue-600 hover:bg-blue-700 text-white text-[10px]'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white text-[10px]'
                        }
                      >
                        {tracking.item.status === 'Active' ? 'In Field Testing' : 'Available in Stock'}
                      </Badge>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground font-mono">
                      <span className="flex items-center gap-1">
                        <span>IMEI1:</span>
                        <code className="font-semibold text-foreground">{tracking.item.imei1 || '—'}</code>
                        {tracking.item.imei1 && (
                          <button
                            type="button"
                            onClick={() => copyText(tracking.item.imei1, 'imei1')}
                            className="text-muted-foreground hover:text-foreground"
                            title="Copy IMEI1"
                          >
                            {copiedId === 'imei1' ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                          </button>
                        )}
                      </span>
                      {tracking.item.vcId && (
                        <span>
                          VC ID: <code className="font-semibold text-foreground">{tracking.item.vcId}</code>
                        </span>
                      )}
                      {tracking.item.color && (
                        <span>
                          Color: <span className="text-foreground font-sans">{tracking.item.color}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border bg-muted/30 p-2.5 text-xs sm:text-right shrink-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Current Custody Holder
                    </p>
                    <p className="font-bold text-foreground text-sm flex items-center gap-1 sm:justify-end mt-0.5">
                      <User className="h-3.5 w-3.5 text-primary" />
                      {tracking.currentCustody.holder}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1 sm:justify-end">
                      <MapPin className="h-3 w-3" />
                      {tracking.currentCustody.location}
                    </p>
                  </div>
                </div>
              </div>

              {/* End-to-End Custody Timeline */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
                    <History className="h-4 w-4 text-primary" />
                    Custody Chain &amp; Movement Timeline
                  </h3>
                  <span className="text-xs text-muted-foreground font-mono">
                    {tracking.journey.length} Recorded Milestone{tracking.journey.length > 1 ? 's' : ''}
                  </span>
                </div>

                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                  {tracking.journey.map((step, idx) => (
                    <div key={step.id || idx} className="relative group">
                      {/* Timeline dot */}
                      <div className="absolute -left-6 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-background border-2 border-primary shadow-xs">
                        {getStageIcon(step.stage)}
                      </div>

                      <div className="rounded-lg border bg-card p-3.5 shadow-xs space-y-2 hover:border-primary/40 transition-colors">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {getStageBadge(step.stage)}
                            <h4 className="text-xs font-bold text-foreground">{step.title}</h4>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{step.timestamp}</span>
                          </div>
                        </div>

                        {/* Handover Routing Bar */}
                        <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
                          {step.from && (
                            <span className="flex items-center gap-1 font-medium text-foreground">
                              <span className="text-muted-foreground font-normal">Sourced From:</span>
                              {step.from}
                            </span>
                          )}
                          {step.from && step.to && <ArrowRight className="h-3 w-3 text-muted-foreground/60 shrink-0" />}
                          {step.to && (
                            <span className="flex items-center gap-1 font-medium text-foreground">
                              <span className="text-muted-foreground font-normal">Handed Over To:</span>
                              {step.to}
                            </span>
                          )}
                        </div>

                        {/* Handover Stakeholders */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                          <div>
                            <span className="text-muted-foreground">Action Performed By:</span>{' '}
                            <span className="font-semibold text-foreground">{step.actor}</span>
                            {step.actorRole && (
                              <Badge variant="outline" className="ml-1 text-[9px] px-1 py-0">
                                {step.actorRole}
                              </Badge>
                            )}
                          </div>
                          {step.condition && (
                            <div>
                              <span className="text-muted-foreground">Physical Condition:</span>{' '}
                              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                                {step.condition}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Additional Remarks / Notes */}
                        {typeof step.details.notes === 'string' && step.details.notes.length > 0 && (
                          <p className="text-[11px] text-muted-foreground italic bg-muted/20 rounded-sm p-1.5 border border-border/40">
                            &quot;{step.details.notes}&quot;
                          </p>
                        )}

                        {/* Attached Condition Photos */}
                        {Array.isArray(step.details.photos) && step.details.photos.length > 0 && (
                          <div className="space-y-1.5 pt-1.5 border-t border-border/50">
                            <span className="text-[10px] font-semibold text-foreground flex items-center gap-1">
                              <Camera className="h-3 w-3 text-primary" />
                              Attached Condition Photos ({step.details.photos.length})
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {step.details.photos.map((ph: any, pIdx: number) => (
                                <div
                                  key={pIdx}
                                  className="group relative overflow-hidden rounded border w-24 h-16 bg-black/5 cursor-pointer shadow-xs hover:border-primary/60 transition-colors"
                                  onClick={() => setZoomPhoto(ph)}
                                >
                                  <img
                                    src={ph.dataUri}
                                    alt={ph.label || 'Condition photo'}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                  />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <ZoomIn className="h-4 w-4 text-white" />
                                  </div>
                                  <span className="absolute bottom-0 inset-x-0 bg-black/60 text-[8px] text-white text-center py-0.5 truncate capitalize">
                                    {ph.label?.replace('_', ' ') || 'Photo'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Immutable Cryptographic Audit Logs */}
              {tracking.auditTrail.length > 0 && (
                <div className="rounded-lg border bg-muted/20 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      Zero-Deletion Audit Trail Verification
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {tracking.auditTrail.length} Tamper-Evident Entries
                    </span>
                  </div>
                  <div className="divide-y text-[11px]">
                    {tracking.auditTrail.map((log) => (
                      <div key={log.id} className="py-1.5 flex flex-wrap items-center justify-between gap-1 text-muted-foreground">
                        <span className="font-mono font-semibold text-foreground">{log.action}</span>
                        <span>
                          by <strong className="text-foreground">{log.actorId}</strong> ({log.actorRole})
                        </span>
                        <span className="font-mono text-[10px]">{log.timestamp.slice(0, 19).replace('T', ' ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="flex justify-end pt-2 border-t">
            <Button variant="outline" size="sm" onClick={onClose}>
              Close Tracker
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lightbox for zooming photos */}
      {zoomPhoto && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/85 p-4"
          onClick={() => setZoomPhoto(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-3xl overflow-hidden rounded-lg bg-background p-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-2 px-1">
              <span className="text-sm font-semibold capitalize">
                {zoomPhoto.label ? zoomPhoto.label.replace('_', ' ') : 'Device'} Photo
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
                alt="Enlarged view"
                className="max-h-[70vh] w-auto rounded object-contain"
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-2 px-1">
              <span>Size: {(zoomPhoto.sizeBytes ? zoomPhoto.sizeBytes / 1024 : 0).toFixed(0)} KB (under 5 MB limit)</span>
              <span>Timestamp: {zoomPhoto.capturedAt || '—'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import type { Geraeteinventar } from '@/types/app';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { APP_IDS } from '@/types/app';
import { AttachmentsSection } from '@/components/AttachmentsSection';
import { MediaThumbnail } from '@/components/widgets/MediaViewer';
import { Badge } from '@/components/ui/badge';
import { IconPencil, IconFileText } from '@tabler/icons-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

function formatDate(d?: string) {
  if (!d) return '—';
  try { return format(parseISO(d), 'dd.MM.yyyy', { locale: de }); } catch { return d; }
}

interface GeraeteinventarViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Geraeteinventar | null;
  onEdit: (record: Geraeteinventar) => void;
}

export function GeraeteinventarViewDialog({ open, onClose, record, onEdit }: GeraeteinventarViewDialogProps) {
  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Geräteinventar anzeigen</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            Bearbeiten
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Bezeichnung *</Label>
            <p className="text-sm">{record.fields.bezeichnung ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Inventarnummer *</Label>
            <p className="text-sm">{record.fields.inventarnummer ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Kategorie *</Label>
            <Badge variant="secondary">{record.fields.kategorie?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Zustand *</Label>
            <Badge variant="secondary">{record.fields.zustand?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Anschaffungswert (€)</Label>
            <p className="text-sm">{record.fields.anschaffungswert ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Anschaffungsdatum</Label>
            <p className="text-sm">{formatDate(record.fields.anschaffungsdatum)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Standort *</Label>
            <p className="text-sm">{record.fields.standort ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Verantwortliche Person – Vorname</Label>
            <p className="text-sm">{record.fields.verantwortlich_vorname ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Verantwortliche Person – Nachname</Label>
            <p className="text-sm">{record.fields.verantwortlich_nachname ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Hersteller</Label>
            <p className="text-sm">{record.fields.hersteller ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Modell / Typenbezeichnung</Label>
            <p className="text-sm">{record.fields.modell ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Seriennummer</Label>
            <p className="text-sm">{record.fields.seriennummer ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Garantie gültig bis</Label>
            <p className="text-sm">{formatDate(record.fields.garantie_bis)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Bemerkungen</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.bemerkungen ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Foto / Dokument</Label>
            {record.fields.foto ? (
              <MediaThumbnail src={record.fields.foto} fit="contain" className="w-full rounded-lg border" />
            ) : <p className="text-sm text-muted-foreground">—</p>}
          </div>
          <div className="pt-2 border-t border-border">
            <AttachmentsSection appId={APP_IDS.GERAETEINVENTAR} recordId={record.record_id} readOnly />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
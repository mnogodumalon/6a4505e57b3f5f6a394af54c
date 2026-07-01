import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LivingAppsService, extractRecordId } from '@/services/livingAppsService';
import type { Geraeteinventar } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { Button } from '@/components/ui/button';
import { IconArrowLeft, IconTrash } from '@tabler/icons-react';
import {
  RecordView, RecordHeader, RecordKeyFacts, RecordSection, RecordField,
  RecordAttachments, RecordViewSkeleton, RecordViewEmpty,
} from '@/components/widgets/RecordView';
import { GeraeteinventarDialog } from '@/components/dialogs/GeraeteinventarDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { formEnhancements } from '@/config/form-enhancements/Geraeteinventar';
import { evalComputed } from '@/config/form-enhancements/types';

export default function GeraeteinventarDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [record, setRecord] = useState<Geraeteinventar | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => { loadData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  async function loadData() {
    setLoading(true);
    try {
      const list = await LivingAppsService.getGeraeteinventar();
      setRecord(list.find(r => r.record_id === id) ?? null);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(fields: Geraeteinventar['fields']) {
    if (!record) return;
    await LivingAppsService.updateGeraeteinventarEntry(record.record_id, fields);
    await loadData();
    setEditing(false);
  }

  async function handleDelete() {
    if (!record) return;
    await LivingAppsService.deleteGeraeteinventarEntry(record.record_id);
    setDeleteOpen(false);
    navigate('/geraeteinventar');
  }

  if (loading) {
    return <RecordViewSkeleton />;
  }

  if (!record) {
    return (
      <RecordViewEmpty
        title="Eintrag nicht gefunden"
        action={
          <Button variant="ghost" onClick={() => navigate('/geraeteinventar')}>
            <IconArrowLeft className="h-4 w-4 mr-1.5" />
            Zurück
          </Button>
        }
      />
    );
  }

  return (
    <RecordView
      onBack={() => navigate('/geraeteinventar')}
      onEdit={() => setEditing(true)}
      backLabel="Zurück"
      editLabel="Bearbeiten"
    >
      <RecordHeader title={record.fields.bezeichnung ?? 'Geräteinventar'} />

      {(() => {
        const lookupLists: Record<string, unknown> = {
        };
        const fmtComputed = (k: string, n: number) =>
          /(?:kosten|preis|betrag|gesamt|netto|brutto|summe|mwst|rabatt|anzahlung|umsatz|saldo)/i.test(k)
            ? n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : n.toLocaleString('de-DE', { maximumFractionDigits: 2 });
        const computedFacts = Object.entries(formEnhancements.computed)
          .map(([key, formula]) => {
            const v = evalComputed(formula, record!.fields as Record<string, unknown>, { lookupLists });
            return v != null
              ? { label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '), value: fmtComputed(key, v) }
              : null;
          })
          .filter((f): f is { label: string; value: string } => f !== null);
        return computedFacts.length > 0 ? <RecordKeyFacts items={computedFacts} /> : null;
      })()}

      <RecordSection title="Details" cols={2}>
        <RecordField label="Bezeichnung *" value={record.fields.bezeichnung} format="text" />
        <RecordField label="Inventarnummer *" value={record.fields.inventarnummer} format="text" />
        <RecordField label="Kategorie *" value={record.fields.kategorie} format="pill" />
        <RecordField label="Zustand *" value={record.fields.zustand} format="pill" />
        <RecordField label="Anschaffungswert (€)" value={record.fields.anschaffungswert} format="text" />
        <RecordField label="Anschaffungsdatum" value={record.fields.anschaffungsdatum} format="date" />
        <RecordField label="Standort *" value={record.fields.standort} format="text" />
        <RecordField label="Verantwortliche Person – Vorname" value={record.fields.verantwortlich_vorname} format="text" />
        <RecordField label="Verantwortliche Person – Nachname" value={record.fields.verantwortlich_nachname} format="text" />
        <RecordField label="Hersteller" value={record.fields.hersteller} format="text" />
        <RecordField label="Modell / Typenbezeichnung" value={record.fields.modell} format="text" />
        <RecordField label="Seriennummer" value={record.fields.seriennummer} format="text" />
        <RecordField label="Garantie gültig bis" value={record.fields.garantie_bis} format="date" />
        <RecordField label="Bemerkungen" value={record.fields.bemerkungen} format="longtext" className="md:col-span-2" />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.GERAETEINVENTAR} recordId={record.record_id} />

      <div className="flex justify-end pt-2">
        <Button variant="ghost" onClick={() => setDeleteOpen(true)} className="text-destructive hover:text-destructive">
          <IconTrash className="h-4 w-4 mr-1.5" />
          Löschen
        </Button>
      </div>

      <GeraeteinventarDialog
        open={editing}
        onClose={() => setEditing(false)}
        onSubmit={handleUpdate}
        defaultValues={record.fields}
        recordId={record.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Geraeteinventar']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Geraeteinventar']}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Geräteinventar löschen"
        description="Soll dieser Eintrag wirklich gelöscht werden? Diese Aktion kann nicht rückgängig gemacht werden."
      />
    </RecordView>
  );
}

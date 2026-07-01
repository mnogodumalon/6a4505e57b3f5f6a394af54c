import { useDashboardData } from '@/hooks/useDashboardData';
import type { Geraeteinventar } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { formatDate, formatCurrency, lookupKey } from '@/lib/formatters';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { useState, useMemo, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { StatCard, StatCardRow } from '@/components/StatCard';
import { DashboardGrid } from '@/components/DashboardGrid';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import {
  KanbanWidget,
  type KanbanCard,
  type KanbanColumn,
  type KanbanTone,
} from '@/components/widgets/KanbanWidget';
import {
  RecordOverlay,
  RecordHeader,
  RecordSection,
  RecordField,
  RecordAttachments,
  useRecordOverlayStack,
} from '@/components/widgets/RecordView';
import { GeraeteinventarDialog } from '@/components/dialogs/GeraeteinventarDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import {
  IconAlertCircle,
  IconTool,
  IconRefresh,
  IconCheck,
  IconPlus,
  IconPackage,
  IconSettings,
  IconCircleCheck,
  IconAlertTriangle,
} from '@tabler/icons-react';

const APPGROUP_ID = '6a4505e57b3f5f6a394af54c';
const REPAIR_ENDPOINT = '/claude/build/repair';

// Kanban-Spalten aus dem Schema (alle Zustandswerte)
const COLUMNS: KanbanColumn[] = (LOOKUP_OPTIONS['geraeteinventar']?.['zustand'] ?? []).map(
  (o): KanbanColumn => ({ key: o.key, label: o.label }),
);

function toneForZustand(key: string | undefined): KanbanTone {
  if (key === 'defekt') return 'destructive';
  if (key === 'wartungsbedarf') return 'warning';
  if (key === 'neu') return 'success';
  if (key === 'gut' || key === 'in_betrieb') return 'primary';
  if (key === 'ausgemustert') return 'default';
  return 'default';
}

export default function DashboardOverview() {
  const clock = useClock();
  const { geraeteinventar, setGeraeteinventar, loading, error, fetchAll } = useDashboardData();

  const overlay = useRecordOverlayStack<{ id: string }>();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<Geraeteinventar | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [createDefaults, setCreateDefaults] = useState<Record<string, any>>({});
  const [filterZustand, setFilterZustand] = useState<string | null>(null);

  // KPI-Berechnungen
  const defekte = useMemo(
    () => geraeteinventar.filter(g => lookupKey(g.fields.zustand) === 'defekt'),
    [geraeteinventar],
  );
  const wartungsbedarf = useMemo(
    () => geraeteinventar.filter(g => lookupKey(g.fields.zustand) === 'wartungsbedarf'),
    [geraeteinventar],
  );
  const aktiv = useMemo(
    () => geraeteinventar.filter(g => {
      const k = lookupKey(g.fields.zustand);
      return k === 'in_betrieb' || k === 'gut' || k === 'neu';
    }),
    [geraeteinventar],
  );

  // Garantien die in den nächsten 30 Tagen ablaufen
  const today = clock;
  const in30days = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 30);
    return d;
  }, [today]);

  const garantieAblaufend = useMemo(
    () =>
      geraeteinventar
        .filter(g => {
          if (!g.fields.garantie_bis) return false;
          const exp = new Date(g.fields.garantie_bis);
          return exp >= today && exp <= in30days;
        })
        .sort((a, b) =>
          (a.fields.garantie_bis ?? '').localeCompare(b.fields.garantie_bis ?? ''),
        ),
    [geraeteinventar, today, in30days],
  );

  // Gesamtwert des Inventars
  const gesamtwert = useMemo(
    () => geraeteinventar.reduce((sum, g) => sum + (g.fields.anschaffungswert ?? 0), 0),
    [geraeteinventar],
  );

  // Kanban-Karten
  const cards = useMemo<KanbanCard[]>(
    () => {
      const base = filterZustand
        ? geraeteinventar.filter(g => lookupKey(g.fields.zustand) === filterZustand)
        : geraeteinventar;
      return base.map(g => {
        const status = lookupKey(g.fields.zustand) ?? COLUMNS[0]?.key ?? '';
        return {
          id: `geraet:${g.record_id}`,
          column: status,
          title: g.fields.bezeichnung ?? 'Unbenanntes Gerät',
          subtitle: [g.fields.hersteller, g.fields.standort].filter(Boolean).join(' · '),
          tone: toneForZustand(status),
        };
      });
    },
    [geraeteinventar, filterZustand],
  );

  // Zustand per Drag ändern (optimistisch)
  const moveCard = useCallback(
    async (cardId: string, newColumn: string) => {
      const rid = cardId.split(':')[1];
      if (!rid) return;
      const prev = geraeteinventar.find(g => g.record_id === rid);
      if (!prev) return;
      const prevKey = lookupKey(prev.fields.zustand) ?? '';
      // Optimistisch updaten
      setGeraeteinventar(gs =>
        gs.map(g =>
          g.record_id === rid
            ? { ...g, fields: { ...g.fields, zustand: { key: newColumn, label: newColumn } } }
            : g,
        ),
      );
      undoToast(`Zustand geändert`, () => {
        setGeraeteinventar(gs =>
          gs.map(g =>
            g.record_id === rid
              ? { ...g, fields: { ...g.fields, zustand: { key: prevKey, label: prevKey } } }
              : g,
          ),
        );
        LivingAppsService.updateGeraeteinventarEntry(rid, { zustand: prevKey }).catch(() =>
          fetchAll(),
        );
      });
      try {
        await LivingAppsService.updateGeraeteinventarEntry(rid, { zustand: newColumn });
      } catch {
        fetchAll();
      }
    },
    [geraeteinventar, setGeraeteinventar, fetchAll],
  );

  // Verantwortliche Personen bei defekten Geräten
  const defektPersonen = useMemo(
    () =>
      defekte
        .map(g =>
          [g.fields.verantwortlich_vorname, g.fields.verantwortlich_nachname]
            .filter(Boolean)
            .join(' '),
        )
        .filter(Boolean),
    [defekte],
  );

  const currentRecord = overlay.top
    ? geraeteinventar.find(g => g.record_id === overlay.top!.id)
    : undefined;

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  // Leer-Zustand
  if (geraeteinventar.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{gruss(clock)}</h1>
          <p className="text-muted-foreground mt-1">Richte dein Inventar ein und behalte den Überblick über alle Geräte.</p>
        </div>
        <div className="rounded-[27px] bg-card p-10 shadow-lg flex flex-col items-center gap-4 text-center">
          <IconPackage size={48} className="text-muted-foreground" />
          <div>
            <h2 className="font-semibold text-lg">Noch keine Geräte erfasst</h2>
            <p className="text-muted-foreground text-sm mt-1 max-w-xs">
              Leg jetzt dein erstes Gerät an und starte mit der Anlagenverwaltung.
            </p>
          </div>
          <Button
            onClick={() => {
              setCreateDefaults({});
              setEditRecord(null);
              setDialogOpen(true);
            }}
          >
            <IconPlus size={16} className="mr-1 shrink-0" />
            Erstes Gerät aufnehmen
          </Button>
        </div>
        <GeraeteinventarDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onSubmit={async fields => {
            await LivingAppsService.createGeraeteinventarEntry(fields);
            fetchAll();
          }}
          defaultValues={createDefaults}
          enablePhotoScan={AI_PHOTO_SCAN['Geraeteinventar']}
          enablePhotoLocation={AI_PHOTO_LOCATION['Geraeteinventar']}
        />
      </div>
    );
  }

  const heroBanner =
    defekte.length > 0 ? (
      <HeroBanner
        tone="destructive"
        action={{
          label: 'Defekte anzeigen',
          onClick: () => setFilterZustand(f => (f === 'defekt' ? null : 'defekt')),
        }}
      >
        <b>{defekte.length} defekte{defekte.length === 1 ? 's Gerät' : ' Geräte'}</b> – sofort prüfen.
        {defektPersonen.length > 0
          ? ` Verantwortlich: ${namen(defektPersonen)}.`
          : ` Betroffen: ${defekte.map(d => d.fields.bezeichnung ?? '').filter(Boolean).join(', ')}.`}
      </HeroBanner>
    ) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground truncate">{gruss(clock)}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {aktiv.length > 0
              ? `${aktiv.length} aktive${aktiv.length === 1 ? 's Gerät' : ' Geräte'} in Betrieb${
                  wartungsbedarf.length > 0
                    ? ` · ${namen(wartungsbedarf.map(g => g.fields.bezeichnung ?? '').filter(Boolean))} braucht Wartung`
                    : ' · alles läuft'
                }.`
              : `${geraeteinventar.length} Geräte im Inventar.`}
          </p>
        </div>
        <Button
          onClick={() => {
            setCreateDefaults({});
            setEditRecord(null);
            setDialogOpen(true);
          }}
          className="shrink-0"
        >
          <IconPlus size={16} className="mr-1 shrink-0" />
          Gerät hinzufügen
        </Button>
      </div>

      <DashboardGrid
        hero={heroBanner}
        kpis={
          <StatCardRow>
            <StatCard
              title="Defekt"
              value={defekte.length}
              description={defekte.length > 0 ? 'Sofort handeln' : 'Alle Geräte funktionsfähig'}
              icon={<IconAlertCircle size={18} className="text-muted-foreground" />}
              tone={defekte.length > 0 ? 'destructive' : 'default'}
              onClick={() => setFilterZustand(f => (f === 'defekt' ? null : 'defekt'))}
              active={filterZustand === 'defekt'}
            />
            <StatCard
              title="Wartungsbedarf"
              value={wartungsbedarf.length}
              description={wartungsbedarf.length > 0 ? 'Wartung einplanen' : 'Kein Wartungsbedarf'}
              icon={<IconSettings size={18} className="text-muted-foreground" />}
              tone={wartungsbedarf.length > 0 ? 'warning' : 'default'}
              onClick={() => setFilterZustand(f => (f === 'wartungsbedarf' ? null : 'wartungsbedarf'))}
              active={filterZustand === 'wartungsbedarf'}
            />
            <StatCard
              title="Aktiv in Betrieb"
              value={aktiv.length}
              description={`${geraeteinventar.length} im Inventar · ${100 - Math.round((aktiv.length / Math.max(geraeteinventar.length, 1)) * 100)}% außer Betrieb`}
              icon={<IconCircleCheck size={18} className="text-muted-foreground" />}
              tone={aktiv.length > 0 ? 'success' : 'default'}
              onClick={() => setFilterZustand(null)}
              active={filterZustand === null && !defekte.length}
            />
            <StatCard
              title="Inventarwert"
              value={formatCurrency(gesamtwert)}
              description="Buchwert des Inventars"
              icon={<IconPackage size={18} className="text-muted-foreground" />}
              tone="default"
            />
          </StatCardRow>
        }
        aside={
          <>
            <WorkList
              title="Garantie läuft ab (30 Tage)"
              icon={<IconAlertTriangle size={14} className="shrink-0" />}
              items={garantieAblaufend.map(g => ({
                id: g.record_id,
                title: g.fields.bezeichnung ?? 'Unbenannt',
                secondLine: (
                  <>
                    <span className="text-warning font-medium">Garantie bis</span>
                    <span className="text-muted-foreground"> · {formatDate(g.fields.garantie_bis)}</span>
                  </>
                ),
                action: {
                  label: 'Details',
                  onClick: () => overlay.replace({ id: g.record_id }),
                },
              }))}
              onItemClick={id => overlay.replace({ id })}
              empty={{
                text: 'Keine Garantien laufen in den nächsten 30 Tagen ab.',
              }}
            />
            <WorkList
              title="Ausgemustert"
              icon={<IconPackage size={14} className="shrink-0" />}
              items={geraeteinventar
                .filter(g => lookupKey(g.fields.zustand) === 'ausgemustert')
                .map(g => ({
                  id: g.record_id,
                  title: g.fields.bezeichnung ?? 'Unbenannt',
                  secondLine: (
                    <>
                      <span className="text-muted-foreground">
                        {g.fields.kategorie?.label ?? '—'}
                        {g.fields.standort ? ` · ${g.fields.standort}` : ''}
                      </span>
                    </>
                  ),
                }))}
              onItemClick={id => overlay.replace({ id })}
              empty={{
                text: 'Keine ausgemusterten Geräte.',
              }}
            />
          </>
        }
        primary={
          <KanbanWidget
            cards={cards}
            columns={COLUMNS}
            defaultCollapsed={['ausgemustert']}
            onCardClick={card => {
              const rid = card.id.split(':')[1];
              if (rid) overlay.replace({ id: rid });
            }}
            onCardMove={moveCard}
            onAddCard={column => {
              setCreateDefaults({ zustand: column });
              setEditRecord(null);
              setDialogOpen(true);
            }}
            columnClassName={col => {
              if (col.key === 'defekt') return 'bg-destructive/5';
              if (col.key === 'wartungsbedarf') return 'bg-warning/5';
              return '';
            }}
          />
        }
      />

      {/* Create / Edit Dialog */}
      <GeraeteinventarDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditRecord(null);
        }}
        onSubmit={async fields => {
          if (editRecord) {
            await LivingAppsService.updateGeraeteinventarEntry(editRecord.record_id, fields);
          } else {
            await LivingAppsService.createGeraeteinventarEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editRecord?.fields ?? createDefaults}
        recordId={editRecord?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Geraeteinventar']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Geraeteinventar']}
      />

      {/* Record Overlay */}
      <RecordOverlay
        open={overlay.open}
        onClose={overlay.close}
        onEdit={
          currentRecord
            ? () => {
                setEditRecord(currentRecord);
                setDialogOpen(true);
              }
            : undefined
        }
        ariaLabel="Gerät"
      >
        {currentRecord && (
          <>
            <RecordHeader
              title={currentRecord.fields.bezeichnung ?? 'Unbenanntes Gerät'}
              subtitle={currentRecord.fields.zustand?.label}
              media={
                currentRecord.fields.foto ? (
                  <img
                    src={currentRecord.fields.foto}
                    alt={currentRecord.fields.bezeichnung ?? 'Gerät'}
                    className="w-full h-48 object-cover rounded-xl"
                  />
                ) : undefined
              }
            />
            <RecordSection title="Stammdaten" cols={2}>
              <RecordField label="Inventarnummer" value={currentRecord.fields.inventarnummer} />
              <RecordField label="Kategorie" value={currentRecord.fields.kategorie} format="pill" />
              <RecordField label="Zustand" value={currentRecord.fields.zustand} format="pill" />
              <RecordField label="Standort" value={currentRecord.fields.standort} />
              <RecordField label="Hersteller" value={currentRecord.fields.hersteller} />
              <RecordField label="Modell" value={currentRecord.fields.modell} />
              <RecordField label="Seriennummer" value={currentRecord.fields.seriennummer} />
            </RecordSection>
            <RecordSection title="Finanzen & Garantie" cols={2}>
              <RecordField
                label="Anschaffungswert"
                value={currentRecord.fields.anschaffungswert != null ? formatCurrency(currentRecord.fields.anschaffungswert) : undefined}
              />
              <RecordField label="Anschaffungsdatum" value={currentRecord.fields.anschaffungsdatum} format="date" />
              <RecordField label="Garantie bis" value={currentRecord.fields.garantie_bis} format="date" />
            </RecordSection>
            {(currentRecord.fields.verantwortlich_vorname || currentRecord.fields.verantwortlich_nachname) && (
              <RecordSection title="Verantwortliche Person">
                <RecordField
                  label="Name"
                  value={[currentRecord.fields.verantwortlich_vorname, currentRecord.fields.verantwortlich_nachname]
                    .filter(Boolean)
                    .join(' ')}
                />
              </RecordSection>
            )}
            {currentRecord.fields.bemerkungen && (
              <RecordSection title="Bemerkungen">
                <RecordField label="" value={currentRecord.fields.bemerkungen} format="longtext" />
              </RecordSection>
            )}
            <RecordAttachments appId={APP_IDS.GERAETEINVENTAR} recordId={currentRecord.record_id} />
          </>
        )}
      </RecordOverlay>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

function DashboardError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const [repairing, setRepairing] = useState(false);
  const [repairStatus, setRepairStatus] = useState('');
  const [repairDone, setRepairDone] = useState(false);
  const [repairFailed, setRepairFailed] = useState(false);

  const handleRepair = async () => {
    setRepairing(true);
    setRepairStatus('Reparatur wird gestartet...');
    setRepairFailed(false);

    const errorContext = JSON.stringify({
      type: 'data_loading',
      message: error.message,
      stack: (error.stack ?? '').split('\n').slice(0, 10).join('\n'),
      url: window.location.href,
    });

    try {
      const resp = await fetch(REPAIR_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ appgroup_id: APPGROUP_ID, error_context: errorContext }),
      });

      if (!resp.ok || !resp.body) {
        setRepairing(false);
        setRepairFailed(true);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith('data: ')) continue;
          const content = line.slice(6);
          if (content.startsWith('[STATUS]')) {
            setRepairStatus(content.replace(/^\[STATUS]\s*/, ''));
          }
          if (content.startsWith('[DONE]')) {
            setRepairDone(true);
            setRepairing(false);
          }
          if (content.startsWith('[ERROR]') && !content.includes('Dashboard-Links')) {
            setRepairFailed(true);
          }
        }
      }
    } catch {
      setRepairing(false);
      setRepairFailed(true);
    }
  };

  if (repairDone) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center">
          <IconCheck size={22} className="text-green-500" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-foreground mb-1">Dashboard repariert</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Das Problem wurde behoben. Bitte laden Sie die Seite neu.
          </p>
        </div>
        <Button size="sm" onClick={() => window.location.reload()}>
          <IconRefresh size={14} className="mr-1" />
          Neu laden
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <IconAlertCircle size={22} className="text-destructive" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-foreground mb-1">Fehler beim Laden</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          {repairing ? repairStatus : error.message}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onRetry} disabled={repairing}>
          Erneut versuchen
        </Button>
        <Button size="sm" onClick={handleRepair} disabled={repairing}>
          {repairing ? (
            <span className="inline-block w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-1" />
          ) : (
            <IconTool size={14} className="mr-1" />
          )}
          {repairing ? 'Reparatur läuft...' : 'Dashboard reparieren'}
        </Button>
      </div>
      {repairFailed && (
        <p className="text-sm text-destructive">
          Automatische Reparatur fehlgeschlagen. Bitte kontaktieren Sie den Support.
        </p>
      )}
    </div>
  );
}

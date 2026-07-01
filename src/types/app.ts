// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
export type GeoLocation = { lat: number; long: number; info?: string };

export type AttachmentType = 'file' | 'note' | 'url' | 'json';
export interface Attachment {
  id: string;
  type: AttachmentType;
  label: string | null;
  value: string | null;
  active: boolean;
  createdat?: string | null;
  updatedat?: string | null;
}

export interface AttachmentInput {
  type: AttachmentType;
  label?: string;
  value: string;
  active?: boolean;
}

export interface Geraeteinventar {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    bezeichnung?: string;
    inventarnummer?: string;
    kategorie?: LookupValue;
    zustand?: LookupValue;
    anschaffungswert?: number;
    anschaffungsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    standort?: string;
    verantwortlich_vorname?: string;
    verantwortlich_nachname?: string;
    hersteller?: string;
    modell?: string;
    seriennummer?: string;
    garantie_bis?: string; // Format: YYYY-MM-DD oder ISO String
    bemerkungen?: string;
    foto?: string;
  };
}

export const APP_IDS = {
  GERAETEINVENTAR: '6a4505d80ae044946e7264ab',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'geraeteinventar': {
    kategorie: [{ key: "it_hardware", label: "IT-Hardware" }, { key: "software", label: "Software" }, { key: "maschinen", label: "Maschinen" }, { key: "fahrzeuge", label: "Fahrzeuge" }, { key: "bueroausstattung", label: "Büroausstattung" }, { key: "netzwerk_kommunikation", label: "Netzwerk & Kommunikation" }, { key: "sonstiges", label: "Sonstiges" }],
    zustand: [{ key: "neu", label: "Neu" }, { key: "gut", label: "Gut" }, { key: "in_betrieb", label: "In Betrieb" }, { key: "wartungsbedarf", label: "Wartungsbedarf" }, { key: "defekt", label: "Defekt" }, { key: "ausgemustert", label: "Ausgemustert" }],
  },
};

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'geraeteinventar': {
    'bezeichnung': 'string/text',
    'inventarnummer': 'string/text',
    'kategorie': 'lookup/select',
    'zustand': 'lookup/select',
    'anschaffungswert': 'number',
    'anschaffungsdatum': 'date/date',
    'standort': 'string/text',
    'verantwortlich_vorname': 'string/text',
    'verantwortlich_nachname': 'string/text',
    'hersteller': 'string/text',
    'modell': 'string/text',
    'seriennummer': 'string/text',
    'garantie_bis': 'date/date',
    'bemerkungen': 'string/textarea',
    'foto': 'file',
  },
};

export const HUB_TOPOLOGY: Record<string, { field: string; entity: string }[]> = {
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateGeraeteinventar = StripLookup<Geraeteinventar['fields']>;
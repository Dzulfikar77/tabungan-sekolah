import { supabase } from './supabase';

export interface SyncError {
  table: string;
  action: string;
  message: string;
  timestamp: string;
}

export interface SyncState {
  pending: number;
  lastSyncAt: string | null;
}

export interface DbResult {
  success: boolean;
  error?: string;
}

const syncErrorListeners: ((err: SyncError) => void)[] = [];

export function onSyncError(listener: (err: SyncError) => void): () => void {
  syncErrorListeners.push(listener);
  return () => {
    const idx = syncErrorListeners.indexOf(listener);
    if (idx >= 0) syncErrorListeners.splice(idx, 1);
  };
}

const syncStateListeners: ((s: SyncState) => void)[] = [];
let syncPending = 0;
let lastSyncAt: string | null = null;

export function onSyncState(listener: (s: SyncState) => void): () => void {
  syncStateListeners.push(listener);
  listener({ pending: syncPending, lastSyncAt });
  return () => {
    const idx = syncStateListeners.indexOf(listener);
    if (idx >= 0) syncStateListeners.splice(idx, 1);
  };
}

function emitSyncState() {
  syncStateListeners.forEach((l) => { l({ pending: syncPending, lastSyncAt }); });
}

async function track<T extends DbResult>(fn: () => Promise<T>): Promise<T> {
  syncPending++;
  emitSyncState();
  try {
    const result = await fn();
    if (result.success) lastSyncAt = new Date().toISOString();
    return result;
  } finally {
    syncPending--;
    emitSyncState();
  }
}

function reportError(table: string, action: string, error: any) {
  console.error(`Error ${action} ${table}:`, error);
  const err: SyncError = { table, action, message: error?.message || String(error), timestamp: new Date().toISOString() };
  syncErrorListeners.forEach((l) => { l(err); });
}

function toDbRow(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .toLowerCase();
    result[snakeKey] = value;
  }
  return result;
}

function fromDbRow<T>(obj: Record<string, any>): T {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = value;
  }
  return result as T;
}

// PostgREST caps a single request at (by default) 1000 rows. Without paging,
// a table that grows past that limit would silently return a truncated
// result — every total computed from it (Dashboard, Reports) would then be
// under-reported, consistently but incorrectly, with no error surfaced.
const FETCH_PAGE_SIZE = 1000;

async function fetchAll<T>(table: string): Promise<T[] | null> {
  const rows: Record<string, any>[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from(table).select('*').range(from, from + FETCH_PAGE_SIZE - 1);
    if (error) {
      reportError(table, 'fetching', error);
      return null;
    }
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < FETCH_PAGE_SIZE) break;
    from += FETCH_PAGE_SIZE;
  }
  return rows.map(row => fromDbRow<T>(row));
}

async function insertRow(table: string, row: Record<string, any>): Promise<DbResult> {
  return track(async () => {
    const { error } = await supabase.from(table).insert(toDbRow(row));
    if (error) {
      reportError(table, 'inserting into', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  });
}

async function updateRow(table: string, id: string, data: Record<string, any>): Promise<DbResult> {
  return track(async () => {
    const { error } = await supabase.from(table).update(toDbRow(data)).eq('id', id);
    if (error) {
      reportError(table, 'updating', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  });
}

async function deleteRow(table: string, id: string): Promise<DbResult> {
  return track(async () => {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) {
      reportError(table, 'deleting from', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  });
}

async function deleteRowsBy(table: string, column: string, value: string): Promise<DbResult> {
  return track(async () => {
    const { error } = await supabase.from(table).delete().eq(column, value);
    if (error) {
      reportError(table, 'deleting from', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  });
}

async function upsertRow(table: string, row: Record<string, any>): Promise<DbResult> {
  return track(async () => {
    const { error } = await supabase.from(table).upsert(toDbRow(row), { onConflict: 'id' });
    if (error) {
      reportError(table, 'upserting into', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  });
}

export { toDbRow, fromDbRow, fetchAll, insertRow, updateRow, deleteRow, deleteRowsBy, upsertRow };

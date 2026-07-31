import { supabase } from './supabase';

export interface SyncError {
  table: string;
  action: string;
  message: string;
}

const syncErrorListeners: ((err: SyncError) => void)[] = [];

export function onSyncError(listener: (err: SyncError) => void): () => void {
  syncErrorListeners.push(listener);
  return () => {
    const idx = syncErrorListeners.indexOf(listener);
    if (idx >= 0) syncErrorListeners.splice(idx, 1);
  };
}

function reportError(table: string, action: string, error: any) {
  console.error(`Error ${action} ${table}:`, error);
  syncErrorListeners.forEach((l) => l({ table, action, message: error?.message || String(error) }));
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

async function fetchAll<T>(table: string): Promise<T[]> {
  const { data, error } = await supabase.from(table).select('*');
  if (error) {
    reportError(table, 'fetching', error);
    return [];
  }
  return (data || []).map(row => fromDbRow<T>(row));
}

async function insertRow(table: string, row: Record<string, any>): Promise<void> {
  const { error } = await supabase.from(table).insert(toDbRow(row));
  if (error) reportError(table, 'inserting into', error);
}

async function updateRow(table: string, id: string, data: Record<string, any>): Promise<void> {
  const { error } = await supabase.from(table).update(toDbRow(data)).eq('id', id);
  if (error) reportError(table, 'updating', error);
}

async function deleteRow(table: string, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) reportError(table, 'deleting from', error);
}

async function upsertRow(table: string, row: Record<string, any>): Promise<void> {
  const { error } = await supabase.from(table).upsert(toDbRow(row), { onConflict: 'id' });
  if (error) reportError(table, 'upserting into', error);
}

export { toDbRow, fromDbRow, fetchAll, insertRow, updateRow, deleteRow, upsertRow };

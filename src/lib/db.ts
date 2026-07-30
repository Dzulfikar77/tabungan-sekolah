import { supabase } from './supabase';

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
    console.error(`Error fetching ${table}:`, error);
    return [];
  }
  return (data || []).map(row => fromDbRow<T>(row));
}

async function insertRow(table: string, row: Record<string, any>): Promise<void> {
  const { error } = await supabase.from(table).insert(toDbRow(row));
  if (error) console.error(`Error inserting into ${table}:`, error);
}

async function updateRow(table: string, id: string, data: Record<string, any>): Promise<void> {
  const { error } = await supabase.from(table).update(toDbRow(data)).eq('id', id);
  if (error) console.error(`Error updating ${table}:`, error);
}

async function deleteRow(table: string, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) console.error(`Error deleting from ${table}:`, error);
}

export { toDbRow, fromDbRow, fetchAll, insertRow, updateRow, deleteRow };

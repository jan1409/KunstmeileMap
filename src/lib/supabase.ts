import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY env vars.');
}

export const supabase = createClient<Database>(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});

export type Tables = Database['public']['Tables'];
export type Event = Tables['events']['Row'];
export type Category = Tables['categories']['Row'];
export type Tent = Tables['tents']['Row'];
export type TentPhoto = Tables['tent_photos']['Row'];
export type Profile = Tables['profiles']['Row'];
export type EventAdmin = Tables['event_admins']['Row'];
export type TentCategory = Tables['tent_categories']['Row'];

/**
 * Tent + the array of categories pulled via the tent_categories join.
 * Returned by useTents and consumed by EventViewPage / SidePanel.
 */
export type TentWithCategories = Tent & { categories: Category[] };

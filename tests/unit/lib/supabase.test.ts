import { describe, it, expect } from 'vitest';
import { supabase } from '../../../src/lib/supabase';

describe('supabase client', () => {
  it('exports a configured client with auth and from() methods', () => {
    expect(supabase).toBeDefined();
    expect(typeof supabase.from).toBe('function');
    expect(typeof supabase.auth).toBe('object');
  });
});

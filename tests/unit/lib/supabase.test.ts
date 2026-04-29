import { describe, it, expect } from 'vitest';
import { supabase } from '../../../src/lib/supabase';

describe('supabase client', () => {
  it('exposes auth and from after construction', () => {
    expect(supabase).toBeDefined();
    expect(typeof supabase.from).toBe('function');
    expect(typeof supabase.auth).toBe('object');
  });
});

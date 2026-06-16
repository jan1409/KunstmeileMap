import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Read the canonical spec served at /openapi.json straight from public/ (no
// JSON import, to avoid needing resolveJsonModule in the app tsconfig). Vitest
// runs from the repo root, so resolve relative to cwd.
const specPath = resolve(process.cwd(), 'public/openapi.json');
const spec = JSON.parse(readFileSync(specPath, 'utf8'));

describe('openapi.json', () => {
  it('is a valid OpenAPI 3 document with info', () => {
    expect(spec.openapi).toMatch(/^3\./);
    expect(spec.info?.title).toContain('KunstmeileMap');
    expect(spec.info?.version).toBeTruthy();
  });

  it('declares the bearer + apikey security schemes and requires both', () => {
    const schemes = spec.components?.securitySchemes ?? {};
    expect(schemes.bearerAuth?.type).toBe('http');
    expect(schemes.apikeyAuth?.type).toBe('apiKey');
    expect(spec.security).toEqual([{ bearerAuth: [], apikeyAuth: [] }]);
  });

  it('exposes events, tents and photos resources (collection + item)', () => {
    for (const p of ['/events', '/events/{id}', '/tents', '/tents/{id}', '/photos', '/photos/{id}']) {
      expect(spec.paths[p], `missing path ${p}`).toBeTruthy();
    }
  });

  it('covers the full CRUD verb set across the resources', () => {
    expect(Object.keys(spec.paths['/events'])).toEqual(expect.arrayContaining(['get', 'post']));
    expect(Object.keys(spec.paths['/events/{id}'])).toEqual(
      expect.arrayContaining(['get', 'patch', 'delete']),
    );
    expect(Object.keys(spec.paths['/tents/{id}'])).toEqual(
      expect.arrayContaining(['get', 'patch', 'delete']),
    );
    expect(Object.keys(spec.paths['/photos'])).toEqual(expect.arrayContaining(['get', 'post']));
  });

  it('documents photo upload as multipart/form-data with a file field', () => {
    const body = spec.paths['/photos'].post.requestBody.content['multipart/form-data'];
    expect(body.schema.properties.file).toBeTruthy();
    expect(body.schema.required).toEqual(expect.arrayContaining(['file', 'tent_id']));
  });

  it('defines the core response schemas', () => {
    for (const s of ['Event', 'EventInput', 'Tent', 'TentInput', 'Photo', 'Error']) {
      expect(spec.components.schemas[s], `missing schema ${s}`).toBeTruthy();
    }
  });
});

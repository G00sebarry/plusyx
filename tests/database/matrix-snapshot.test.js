import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('test matrix restores private snapshot and rejects stale writes', async () => {
  const db = new PGlite();
  const owner = '00000000-0000-4000-8000-000000000001';
  const other = '00000000-0000-4000-8000-000000000002';
  const snapshot = { title: 'Synthetic matrix', appearance: { image: 'data:image/png;base64,AQ==' } };
  try {
    await db.exec(`create role authenticated; create role anon; create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$
        select current_setting('request.jwt.claim.sub')::uuid $$;
      grant usage on schema auth to authenticated;
      insert into auth.users values ('${owner}'), ('${other}');`);
    await db.exec(await readFile(new URL('../../supabase/migrations/20261125205033_create_private_life_matrices.sql', import.meta.url), 'utf8'));
    await db.exec(`set role authenticated; set request.jwt.claim.sub = '${owner}';`);
    await db.query('insert into life_matrices values ($1,1,$2)', [owner, JSON.stringify(snapshot)]);
    assert.deepEqual((await db.query('select snapshot from life_matrices')).rows[0].snapshot, snapshot);
    const update = 'update life_matrices set revision=2 where owner_id=$1 and revision=1 returning revision';
    assert.equal((await db.query(update, [owner])).rows.length, 1);
    assert.equal((await db.query(update, [owner])).rows.length, 0);
    await db.exec(`set request.jwt.claim.sub = '${other}';`);
    assert.equal((await db.query('select snapshot from life_matrices')).rows.length, 0);
    assert.equal((await db.query('update life_matrices set revision=3 returning revision')).rows.length, 0);
    await db.exec('reset role; set role anon;');
    await assert.rejects(db.query('select snapshot from life_matrices'), /permission denied/);
  } finally {
    await db.close();
  }
});

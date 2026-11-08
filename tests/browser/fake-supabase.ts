// Standalone in-memory test database. No imports from the real Supabase client.
const owners = ['A', 'B'];
const tables: Record<string, any[]> = {
  columns: owners.map(user_id => ({ id: 'todo', user_id, title: `Column ${user_id}`, type: 'todo', position: 0 })),
  tasks: owners.map(user_id => ({ id: `task-${user_id}`, user_id, title: `Task ${user_id}`, description: '', columnId: 'todo', status: 'todo', date: '2026-11-04', position: 0, checklists: [], comments: [], files: [], archived_at: null })),
  habits: owners.map(user_id => ({ id: `habit-${user_id}`, user_id, title: `Habit ${user_id}`, color: 'bg-blue-500', emoji: '🌱', frequency: { type: 'daily', days: [0,1,2,3,4,5,6] }, history: {}, position: 0, archived_at: null })),
  antihabits: owners.map(user_id => ({ id: `anti-${user_id}`, user_id, title: `Anti ${user_id}`, color: 'bg-red-500', emoji: '⛔', start_date: Date.now() - 86400000, longest_streak: 0, history: [], position: 0 })),
  user_settings: [], daily_notes: [], telegram_links: []
};
let user = 'A';
const listeners = new Set<any>();
const session = () => user ? { user: { id: user, email: `${user}@example.invalid`, user_metadata: { full_name: user } } } : null;
const control = {
  tables, calls: [] as any[], failures: {} as Record<string, boolean>, delays: {} as Record<string, number>,
  login(id: string) { user = id; for (const callback of listeners) callback('SIGNED_IN', session()); }
};
(window as any).__testDb = control;

function query(table: string) {
  let action = 'select';
  let payload: any;
  let single = false;
  let limit = Infinity;
  let head = false;
  const filters: Array<(row: any) => boolean> = [];
  const chain: any = {
    select(_fields?: string, options?: any) { head = !!options?.head; return chain; },
    eq(key: string, value: any) { filters.push(row => row[key] === value); return chain; },
    is(key: string, value: any) { filters.push(row => value === null ? row[key] == null : row[key] === value); return chain; },
    not(key: string) { filters.push(row => row[key] != null); return chain; },
    order() { return chain; },
    limit(value: number) { limit = value; return chain; },
    single() { single = true; return chain; },
    maybeSingle() { single = true; return chain; },
    upsert(value: any) { action = 'upsert'; payload = value; return chain; },
    insert(value: any) { action = 'insert'; payload = value; return chain; },
    update(value: any) { action = 'update'; payload = value; return chain; },
    delete() { action = 'delete'; return chain; },
    async then(resolve: any, reject: any) {
      try {
        const owner = user;
        const key = `${table}:${action}`;
        // Snapshot SELECT before delay to reproduce a late response from account A.
        const rows = tables[table] ||= [];
        let result = structuredClone(rows.filter(row => row.user_id === owner && filters.every(test => test(row))).slice(0,limit));
        control.calls.push({ table, action, owner, payload: structuredClone(payload), ids: result.map(row => row.id) });
        const failed = control.failures[key] || result.some(row => control.failures[`${key}:${row.id}`]);
        if (control.delays[key]) await new Promise(r => setTimeout(r,control.delays[key]));
        if (failed) return resolve({ data: null, error: { message: 'Synthetic failure' } });
        if (action === 'upsert' || action === 'insert') {
          result = (Array.isArray(payload) ? payload : [payload]).map(item => {
            if (item.user_id !== owner) throw new Error('Synthetic owner mismatch');
            const index = rows.findIndex(row => (item.id ? row.id === item.id : row.user_id === item.user_id) && row.user_id === owner);
            const saved = { ...rows[index], ...item };
            if (index < 0) rows.push(saved); else rows[index] = saved;
            return saved;
          });
        } else if (action === 'update' || action === 'delete') {
          const selected = rows.filter(row => row.user_id === owner && filters.every(test => test(row)));
          result = selected.map(row => ({ ...row, ...(action === 'update' ? payload : {}) }));
          for (const row of selected) {
            if (action === 'update') Object.assign(row,payload);
            else rows.splice(rows.indexOf(row),1);
          }
        }
        return resolve({ data: head ? null : single ? result[0] ?? null : result, count: result.length, error: null });
      } catch (error) { return reject(error); }
    }
  };
  return chain;
}
export const supabase = {
  storage: {
    from(bucket: string) { return {
      async upload(path: string, file: File) {
        const call = { table: 'storage', action: 'upload', owner: user, bucket, path, name: file.name, completed: false };
        control.calls.push(call);
        await new Promise(resolve => setTimeout(resolve, control.delays['storage:upload'] || 0));
        call.completed = true;
        return { data: { path }, error: null };
      },
      getPublicUrl(path: string) { return { data: { publicUrl: `http://127.0.0.1:4178/synthetic-files/${path}` } }; }
    }; }
  },
  from: query,
  auth: {
    async getSession() { return { data: { session: session() }, error: null }; },
    onAuthStateChange(callback: any) { listeners.add(callback); return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } }; },
    async signOut() { control.login(''); return { error: null }; }
  }
};

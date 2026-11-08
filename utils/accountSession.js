// Each login lifetime owns its state and queued writes, including A -> logout -> A.
let nextKey = 0;
export function createAccountSessionController(publish) {
  let current = null;
  let revision = 0;
  let disposed = false;
  return {
    get revision() { return revision; },
    accept(user) {
      if (disposed) return;
      revision++;
      if (current?.user.id === user?.id) return;
      if (current) current.active = false;
      current = user ? { user, active: true, key: ++nextKey } : null;
      publish(current);
    },
    dispose() {
      disposed = true;
      if (current) current.active = false;
    }
  };
}

export function createAccountWriteQueue(isActive, write, onError) {
  const pending = new Map();
  const running = new Set();
  async function flush(id) {
    if (!isActive() || running.has(id) || !pending.has(id)) return;
    running.add(id);
    try {
      while (isActive() && pending.has(id)) {
        const snapshot = pending.get(id);
        try {
          const result = await write(id, snapshot);
          if (result?.error) throw result.error;
        } catch {
          if (isActive()) onError();
          break; // Retain pending data; no recursive retry storm.
        }
        if (pending.get(id) === snapshot) pending.delete(id);
      }
    } finally {
      running.delete(id);
    }
  }
  return {
    enqueue(id, value) {
      if (!isActive()) return;
      pending.set(id, value);
      void flush(id);
    },
    async flushAll() {
      await Promise.all([...pending.keys()].map(flush));
      return pending.size === 0;
    },
    clear() { pending.clear(); }
  };
}

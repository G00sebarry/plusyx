// No state publication or default writes until ALL required reads succeed.
export async function loadAccountData(userId, api, defaults, isActive) {
  const [tasks, columns, habits, antiHabits, settings, notes] = await Promise.all([
    api.fetchTasks(userId), api.fetchColumns(userId), api.fetchHabits(userId),
    api.fetchAntiHabits(userId), api.fetchUserSettings(userId), api.fetchDailyNotes(userId)
  ]);
  if (!isActive()) return null;
  let loadedColumns = columns;
  if (columns.length === 0) {
    await api.ensureDefaultColumns(defaults, userId);
    if (!isActive()) return null;
    // Another device may have initialized its own titles while we were loading.
    loadedColumns = await api.fetchColumns(userId);
    if (!isActive()) return null;
    if (loadedColumns.length === 0) throw new Error('Columns initialization not confirmed');
  }
  return { tasks, columns: loadedColumns, habits, antiHabits, settings, notes };
}

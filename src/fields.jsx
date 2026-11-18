// Activity + care recipient + organization fields, shared by Add Time and Timer.
import { needsOrg, needsRecipient } from './rules.js';
import { saveSettings, newId } from './db.js';
import { QuickAdd } from './ui.jsx';

const ORG_TYPE_FOR = { work: 'employer', community_service: 'nonprofit', work_program: 'program', education: 'school' };
const ORG_LABEL = {
  work: 'Who paid you, or where (optional)',
  community_service: 'Volunteer group',
  work_program: 'Training program',
  education: 'School (optional)',
};

export function recentActivities(entries, category, limit = 8) {
  const seen = new Set();
  const out = [];
  for (const e of entries) {
    if (e.category !== category) continue;
    const k = e.activity.trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(e.activity.trim());
    if (out.length >= limit) break;
  }
  return out;
}

export function DetailFields({ form, set, data, refresh }) {
  const { settings, entries } = data;
  const cat = form.category;
  const suggestions = cat ? recentActivities(entries, cat) : [];
  const orgs = settings.organizations || [];

  const addRecipient = async (name) => {
    const r = { id: newId(), name, relationship: '' };
    await saveSettings({ careRecipients: [...(settings.careRecipients || []), r] });
    await refresh();
    set({ careRecipientId: r.id });
  };
  const addOrg = async (name) => {
    const o = { id: newId(), name, type: ORG_TYPE_FOR[cat] || 'nonprofit', contactName: '', contactPhone: '', contactEmail: '' };
    await saveSettings({ organizations: [...(settings.organizations || []), o] });
    await refresh();
    set({ organizationId: o.id });
  };

  return (
    <>
      {needsRecipient(cat) && (
        <div class="field" style="margin-bottom:14px">
          <span class="field-label">Who did you care for?</span>
          {(settings.careRecipients || []).length > 0 && (
            <div class="chips">
              {settings.careRecipients.map((r) => (
                <button type="button" class="chip" aria-pressed={form.careRecipientId === r.id} onClick={() => set({ careRecipientId: r.id })}>
                  {r.name}
                </button>
              ))}
            </div>
          )}
          <QuickAdd label="Add a person" placeholder="Name, like Mom" onAdd={addRecipient} />
        </div>
      )}

      {needsOrg(cat) && (
        <div class="field" style="margin-bottom:14px">
          <span class="field-label">{ORG_LABEL[cat]}</span>
          {orgs.length > 0 && (
            <select value={form.organizationId || ''} onChange={(e) => set({ organizationId: e.currentTarget.value })}>
              <option value="">— Choose —</option>
              {orgs.map((o) => <option value={o.id}>{o.name}</option>)}
            </select>
          )}
          <QuickAdd label="Add a new one" placeholder="Name" onAdd={addOrg} />
          {cat === 'community_service' && (
            <p class="help">Add a contact person and phone in Settings. Your report needs them.</p>
          )}
        </div>
      )}

      <label class="field">
        <span>What did you do?</span>
        <input
          value={form.activity}
          list="activity-suggestions"
          placeholder={cat === 'caregiving' ? 'Like: rides, meals, medicine' : 'Short description'}
          onInput={(e) => set({ activity: e.currentTarget.value })}
          maxLength={200}
        />
        <datalist id="activity-suggestions">
          {suggestions.map((s) => <option value={s} />)}
        </datalist>
      </label>
      {suggestions.length > 0 && !form.activity && (
        <div class="chips" style="margin:-6px 0 14px">
          {suggestions.slice(0, 4).map((s) => (
            <button type="button" class="chip sm" onClick={() => set({ activity: s })}>{s}</button>
          ))}
        </div>
      )}

      <label class="field">
        <span>Describe what you did (optional)</span>
        <textarea
          value={form.notes || ''}
          maxLength={1000}
          placeholder={cat === 'caregiving' ? 'Like: Drove Mom to her doctor, picked up her medicine, made lunch' : 'Any details that help explain this time'}
          onInput={(e) => set({ notes: e.currentTarget.value })}
        />
      </label>
    </>
  );
}

export function validateDetails(form, settings) {
  if (!form.category) return 'Pick what kind of time this was.';
  if (needsRecipient(form.category) && !form.careRecipientId) return 'Pick who you cared for.';
  if (form.category === 'community_service' && !form.organizationId) return 'Pick the volunteer group.';
  if (form.category === 'work_program' && !form.organizationId) return 'Pick the training program.';
  if (!form.activity?.trim()) return 'Write a few words about what you did.';
  return null;
}

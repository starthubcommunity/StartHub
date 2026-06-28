// admin-pages3.jsx — Events & Automation (auto-publish)
const { useState: useStateP3, useMemo: useMemoP3, useEffect: useEffectP3 } = React;

// ============================================
// EVENT TYPES
// ============================================
const EVENT_TYPES = {
  workshop: { label: 'Atölye', color: '#7C3AED', bg: '#F5F3FF' },
  meetup: { label: 'Buluşma', color: '#16A34A', bg: '#F0FDF4' },
  hackathon: { label: 'Hackathon', color: '#DC2626', bg: '#FEF2F2' },
  webinar: { label: 'Webinar', color: '#2563EB', bg: '#EFF6FF' },
  talk: { label: 'Konuşma', color: '#EA580C', bg: '#FFF7ED' },
};

// ============================================
// EVENTS PAGE
// ============================================
function EventsPage() {
  const { data, addItem, updateItem, deleteItem } = useAdmin();
  const [editing, setEditing] = useStateP3(null);
  const [deleting, setDeleting] = useStateP3(null);

  const evts = data.events || [];
  const sorted = [...evts].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  const handleSave = (formData) => {
    if (editing === 'new') addItem('events', { ...formData, id: uid() });
    else updateItem('events', editing.id, formData);
    setEditing(null);
  };

  const monthNames = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];

  return (
    <div>
      <PageHead title="Etkinlikler" desc={`${evts.length} etkinlik`} actions={
        <button className="adm-btn adm-btn--primary" onClick={() => setEditing('new')}><AIcon name="plus" size={16} /> Yeni Etkinlik</button>
      } />
      <div className="adm-card">
        <div className="adm-card__body" style={{ padding: evts.length ? 0 : 20 }}>
          {evts.length === 0 ? (
            <div className="adm-empty">
              <AIcon name="calendar" size={40} style={{ opacity: 0.25 }} />
              <p>Henüz etkinlik eklenmemiş.</p>
            </div>
          ) : (
            <div>
              {sorted.map(ev => {
                const evType = EVENT_TYPES[ev.type] || EVENT_TYPES.meetup;
                const dateObj = ev.date ? new Date(ev.date + 'T00:00:00') : null;
                const day = dateObj ? dateObj.getDate() : '?';
                const month = dateObj ? monthNames[dateObj.getMonth()] : '';
                const isPast = dateObj && dateObj < new Date(new Date().toISOString().slice(0,10) + 'T00:00:00');
                return (
                  <div key={ev.id} className="adm-list-item" style={{ opacity: isPast ? 0.55 : 1, gap: 14 }}>
                    <div className="adm-event-date" style={{ background: evType.bg, color: evType.color }}>
                      <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 20, lineHeight: 1 }}>{day}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{month}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="adm-list-item__title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {ev.title_tr}
                        {isPast && <span style={{ fontSize: 10, color: 'var(--adm-text-dim)', fontWeight: 600, textTransform: 'uppercase' }}>Geçmiş</span>}
                      </div>
                      <div className="adm-list-item__sub" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                        <span className="adm-badge" style={{ background: evType.bg, color: evType.color, padding: '2px 8px', fontSize: 10.5 }}>{evType.label}</span>
                        <span>{ev.time} · {ev.location_tr}</span>
                        <span>· {ev.organizer}</span>
                      </div>
                    </div>
                    <div className="adm-table__actions">
                      <button className="adm-icon-btn" onClick={() => setEditing(ev)}><AIcon name="edit" size={14} /></button>
                      <button className="adm-icon-btn adm-icon-btn--danger" onClick={() => setDeleting(ev)}><AIcon name="trash" size={14} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {!!editing && <EventForm item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSave={handleSave} />}
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={() => { deleteItem('events', deleting.id); setDeleting(null); }}
        title={`"${deleting?.title_tr}" silinecek`} message="Son Silinenler'den geri getirebilirsin." />
    </div>
  );
}

function EventForm({ item, onClose, onSave }) {
  const blank = { title_tr: '', title_en: '', desc_tr: '', desc_en: '', date: '', time: '10:00', location_tr: '', location_en: '', organizer: 'Start-Hub', type: 'meetup', link: '', cover: null, color: '#2563EB' };
  const [f, setF] = useStateP3(item ? { ...blank, ...item } : blank);
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));
  const [err, setErr] = useStateP3('');

  const submit = () => {
    if (!f.title_tr.trim() || !f.date) { setErr('Başlık ve tarih zorunludur.'); return; }
    onSave(f);
  };

  const typeOpts = Object.entries(EVENT_TYPES).map(([value, v]) => ({ value, label: v.label }));

  return (
    <Modal open onClose={onClose} title={item ? 'Etkinlik Düzenle' : 'Yeni Etkinlik'} wide>
      <form onSubmit={e => { e.preventDefault(); submit(); }} className="adm-form">
        <div className="adm-form-grid">
          <Field label="Etkinlik Adı (TR)" required><Input value={f.title_tr} onChange={v => set('title_tr', v)} placeholder="Startup Weekend Istanbul" /></Field>
          <Field label="Etkinlik Adı (EN)"><Input value={f.title_en} onChange={v => set('title_en', v)} /></Field>
        </div>
        <div className="adm-form-grid">
          <Field label="Açıklama (TR)"><Textarea value={f.desc_tr} onChange={v => set('desc_tr', v)} /></Field>
          <Field label="Açıklama (EN)"><Textarea value={f.desc_en} onChange={v => set('desc_en', v)} /></Field>
        </div>
        <div className="adm-form-grid adm-form-grid--3">
          <Field label="Tarih" required><Input type="date" value={f.date} onChange={v => set('date', v)} /></Field>
          <Field label="Saat"><Input type="time" value={f.time} onChange={v => set('time', v)} /></Field>
          <Field label="Tür"><Select value={f.type} onChange={v => set('type', v)} options={typeOpts} /></Field>
        </div>
        <div className="adm-form-grid">
          <Field label="Konum (TR)"><Input value={f.location_tr} onChange={v => set('location_tr', v)} placeholder="Online / Mekan adı" /></Field>
          <Field label="Konum (EN)"><Input value={f.location_en} onChange={v => set('location_en', v)} /></Field>
        </div>
        <div className="adm-form-grid adm-form-grid--3">
          <Field label="Düzenleyen"><Input value={f.organizer} onChange={v => set('organizer', v)} placeholder="Start-Hub" /></Field>
          <Field label="Kayıt Linki"><Input value={f.link} onChange={v => set('link', v)} placeholder="https://" /></Field>
          <Field label="Renk"><Input type="color" value={f.color} onChange={v => set('color', v)} style={{ height: 42, padding: 4 }} /></Field>
        </div>
        <div>
          <label className="adm-field__label">Kapak Görseli</label>
          <ImageUpload value={f.cover} onChange={v => set('cover', v)} size={140} shape="rounded" format="jpeg" maxDim={900} label="Sürükle / seç" />
        </div>
        <div className="adm-form__footer">
          {err && <span className="adm-form__err">{err}</span>}
          <button type="button" className="adm-btn adm-btn--ghost" onClick={onClose}>İptal</button>
          <button type="submit" className="adm-btn adm-btn--primary"><AIcon name="save" size={16} /> Kaydet</button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================
// CONTENT PAGE — Yazılar + Etkinlikler tabları
// ============================================
function ContentPage() {
  const [tab, setTab] = useStateP3('posts');
  const tabs = [
    { id: 'posts',  label: 'Yazılar',     icon: 'layers'   },
    { id: 'events', label: 'Etkinlikler', icon: 'calendar' },
  ];
  return (
    <div>
      <div style={{
        display: 'flex', gap: 0,
        borderBottom: '1px solid var(--adm-border-light)',
        marginBottom: 24,
      }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 20px',
              border: 'none', borderBottom: tab === t.id ? '2px solid var(--adm-red)' : '2px solid transparent',
              background: 'none', cursor: 'pointer', marginBottom: -1,
              fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600,
              color: tab === t.id ? 'var(--adm-text)' : 'var(--adm-text-dim)',
              transition: 'color 0.15s',
            }}
          >
            <AIcon name={t.icon} size={15} />
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'posts'  ? <PostsPage />  : <EventsPage />}
    </div>
  );
}

Object.assign(window, { EventsPage, EventForm, EVENT_TYPES, ContentPage });

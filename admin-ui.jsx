// admin-ui.jsx — Shared UI components for admin panel
const { useState: useStateU, useRef: useRefU, useEffect: useEffectU } = React;

// ============================================
// ADMIN ICON (extends main Icon set)
// ============================================
const adminIcons = {
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  dashboard: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
  refresh: '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  restore: '<path d="M3 7v6h6"/><path d="M3 13a9 9 0 1 0 3-7.7L3 8"/>',
  arrowLeft: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
  arrowRight: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
};

function AIcon({ name, size = 20, style = {} }) {
  const svg = adminIcons[name] || iconSvgs[name] || '';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={style} dangerouslySetInnerHTML={{ __html: svg }} />
  );
}

// ============================================
// STAT CARD
// ============================================
function StatCard({ icon, label, value, color, sub }) {
  return (
    <div className="adm-stat">
      <div className="adm-stat__icon" style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}>
        <AIcon name={icon} size={20} />
      </div>
      <div className="adm-stat__info">
        <span className="adm-stat__value">{value}</span>
        <span className="adm-stat__label">{label}</span>
      </div>
      {sub && <span className="adm-stat__sub">{sub}</span>}
    </div>
  );
}

// ============================================
// DATA TABLE
// ============================================
function DataTable({ columns, data, onEdit, onDelete, emptyText = 'Kayıt bulunamadı' }) {
  if (!data || data.length === 0) {
    return (
      <div className="adm-empty">
        <AIcon name="layers" size={40} style={{ opacity: 0.3 }} />
        <p>{emptyText}</p>
      </div>
    );
  }
  return (
    <div className="adm-table-wrap">
      <table className="adm-table">
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key} style={col.style}>{col.label}</th>
            ))}
            <th style={{ width: 100 }}>İşlemler</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={row.id || row._key || i}>
              {columns.map(col => (
                <td key={col.key} style={col.tdStyle}>
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
              <td>
                <div className="adm-table__actions">
                  {onEdit && (
                    <button className="adm-icon-btn" title="Düzenle" onClick={() => onEdit(row)}>
                      <AIcon name="edit" size={15} />
                    </button>
                  )}
                  {onDelete && (
                    <button className="adm-icon-btn adm-icon-btn--danger" title="Sil" onClick={() => onDelete(row)}>
                      <AIcon name="trash" size={15} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================
// MODAL
// ============================================
function Modal({ open, onClose, title, wide, headerExtra, children }) {
  if (!open) return null;
  return (
    <div className="adm-modal-overlay" onClick={onClose}>
      <div className={`adm-modal ${wide ? 'adm-modal--wide' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="adm-modal__header">
          <h3>{title}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {headerExtra}
            <button className="adm-icon-btn" onClick={onClose}><AIcon name="x" size={18} /></button>
          </div>
        </div>
        <div className="adm-modal__body">{children}</div>
      </div>
    </div>
  );
}

// ============================================
// FORM FIELD
// ============================================
function Field({ label, required, children, hint }) {
  return (
    <div className="adm-field">
      <label className="adm-field__label">
        {label} {required && <span style={{ color: 'var(--adm-red)' }}>*</span>}
      </label>
      {children}
      {hint && <span className="adm-field__hint">{hint}</span>}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = 'text', ...props }) {
  return <input className="adm-input" type={type} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} {...props} />;
}

function Textarea({ value, onChange, placeholder, rows = 3 }) {
  return <textarea className="adm-input adm-textarea" value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} />;
}

function Select({ value, onChange, options, placeholder }) {
  return (
    <select className="adm-input adm-select" value={value || ''} onChange={e => onChange(e.target.value)}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}

// ============================================
// IMAGE UPLOAD — resize on the fly, returns dataURL via onUpload
// ============================================
function resizeImage(file, maxDim, mime, quality) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const r = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * r); height = Math.round(height * r);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL(mime, quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function ImageUpload({ value, onChange, size = 80, shape = 'rounded', maxDim = 600, format = 'png', label }) {
  const inputRef = useRefU(null);
  const [dragging, setDragging] = useStateU(false);
  const radius = shape === 'circle' ? '50%' : 'var(--adm-r)';

  const handleFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const dataUrl = await resizeImage(file, maxDim, mime, 0.85);
    onChange(dataUrl);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div
        className={`adm-img-upload ${dragging ? 'adm-img-upload--drag' : ''}`}
        style={{ width: size, height: size, borderRadius: radius }}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
      >
        {value ? (
          <img src={value} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
        ) : (
          <div className="adm-img-upload__placeholder">
            <AIcon name="upload" size={size > 60 ? 22 : 16} />
            {label && size > 100 && <span style={{ fontSize: 11, marginTop: 6 }}>{label}</span>}
          </div>
        )}
        <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
      </div>
      {value && (
        <button type="button" className="adm-img-upload__clear" onClick={() => onChange(null)}>
          <AIcon name="trash" size={12} /> Kaldır
        </button>
      )}
    </div>
  );
}

// ============================================
// TRI TOGGLE — Evet / Hayır / Boş (null)
// ============================================
function TriToggle({ value, onChange }) {
  // value: true | false | null/undefined
  const opts = [
    { v: true,  label: 'Evet' },
    { v: false, label: 'Hayır' },
    { v: null,  label: 'Boş bırak' },
  ];
  const cur = value === true ? true : value === false ? false : null;
  return (
    <div className="adm-tri">
      {opts.map(o => (
        <button key={String(o.v)} type="button"
          className={`adm-tri__btn ${cur === o.v ? 'adm-tri__btn--active' : ''} ${o.v === true ? 'adm-tri__btn--yes' : ''}`}
          onClick={() => onChange(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ============================================
// STEPPER — wizard adım göstergesi
// ============================================
function Stepper({ steps, current }) {
  return (
    <div className="adm-stepper">
      {steps.map((s, i) => (
        <React.Fragment key={i}>
          <div className={`adm-stepper__step ${i === current ? 'adm-stepper__step--active' : ''} ${i < current ? 'adm-stepper__step--done' : ''}`}>
            <span className="adm-stepper__num">{i < current ? <AIcon name="check" size={13} /> : i + 1}</span>
            <span className="adm-stepper__label">{s}</span>
          </div>
          {i < steps.length - 1 && <div className="adm-stepper__line"></div>}
        </React.Fragment>
      ))}
    </div>
  );
}

// ============================================
// SEARCH BAR
// ============================================
function SearchBar({ value, onChange, placeholder = 'Ara...' }) {
  return (
    <div className="adm-search">
      <AIcon name="search" size={16} style={{ color: 'var(--adm-text-dim)', flexShrink: 0 }} />
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

// ============================================
// PAGE HEADER
// ============================================
function PageHead({ title, desc, actions }) {
  return (
    <div className="adm-page-head">
      <div>
        <h1 className="adm-page-head__title">{title}</h1>
        {desc && <p className="adm-page-head__desc">{desc}</p>}
      </div>
      {actions && <div className="adm-page-head__actions">{actions}</div>}
    </div>
  );
}

// ============================================
// CONFIRM DIALOG
// ============================================
function ConfirmDialog({ open, onClose, onConfirm, title, message }) {
  if (!open) return null;
  return (
    <div className="adm-modal-overlay" onClick={onClose}>
      <div className="adm-modal adm-modal--sm" onClick={e => e.stopPropagation()}>
        <div className="adm-modal__body" style={{ padding: '28px 24px', textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--adm-red-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <AIcon name="trash" size={22} style={{ color: 'var(--adm-red)' }} />
          </div>
          <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{title || 'Silmek istediğine emin misin?'}</h3>
          <p style={{ fontSize: 14, color: 'var(--adm-text-dim)', marginBottom: 24 }}>{message || 'Bu işlem geri alınamaz.'}</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="adm-btn adm-btn--ghost" onClick={onClose}>İptal</button>
            <button className="adm-btn adm-btn--danger" onClick={onConfirm}>Sil</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// TAG INPUT
// ============================================
function TagInput({ tags = [], onChange }) {
  const [input, setInput] = useStateU('');
  const add = () => {
    const v = input.trim();
    if (v && !tags.includes(v)) { onChange([...tags, v]); setInput(''); }
  };
  const remove = (idx) => onChange(tags.filter((_, i) => i !== idx));
  return (
    <div className="adm-tag-input">
      <div className="adm-tag-input__tags">
        {tags.map((t, i) => (
          <span key={i} className="adm-tag">
            {t}
            <button onClick={() => remove(i)}><AIcon name="x" size={12} /></button>
          </span>
        ))}
      </div>
      <input value={input} onChange={e => setInput(e.target.value)} placeholder="Etiket ekle..."
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
    </div>
  );
}

// ============================================
// PEOPLE PICKER — çoklu seçim (ekip üyeleri)
// ============================================
function PeoplePicker({ people, selected = [], onChange, excludeIds = [] }) {
  const avail = people.filter(p => !excludeIds.includes(p.id));
  const toggle = (id) => {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  };
  return (
    <div className="adm-picker">
      {avail.length === 0 && <span className="adm-picker__empty">Seçilebilir kişi yok</span>}
      {avail.map(p => {
        const on = selected.includes(p.id);
        return (
          <button type="button" key={p.id} className={`adm-picker__chip ${on ? 'adm-picker__chip--on' : ''}`} onClick={() => toggle(p.id)}>
            <span className="adm-picker__av" style={{ background: p.color }}>
              {p.photo ? <img src={p.photo} alt="" /> : p.name[0]}
            </span>
            <span>{p.name}</span>
            {on && <AIcon name="check" size={13} />}
          </button>
        );
      })}
    </div>
  );
}

// Export all
Object.assign(window, {
  AIcon, StatCard, DataTable, Modal, Field, Input, Textarea, Select,
  ImageUpload, SearchBar, PageHead, ConfirmDialog, TagInput,
  TriToggle, Stepper, resizeImage, PeoplePicker,
});

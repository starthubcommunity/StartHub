// bulk-draft.jsx — içe aktarma sonrası "Hepsine taslak oluştur" (PROMPT_V3 D4).
// Tarayıcıda SIRAYLA, ilerleme çubuğuyla, ayrı kuyruk/worker YOK.
// canDraftAI() geçmeyeni atlar (veri yetersiz → elle yaz).
import React, { useState } from 'react';
import { useHubStore } from '../hub-store';
import { canDraftAI } from '../hub-rules';
import { generateDraft } from '../hub-ai-draft';

export default function BulkDraft({ candidates }) {
  const store = useHubStore();
  const [phase, setPhase] = useState('idle');   // idle | running | done
  const [at, setAt] = useState(0);
  const [ok, setOk] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const total = candidates.length;

  const run = async () => {
    setPhase('running');
    let good = 0, skip = 0;
    for (let n = 0; n < candidates.length; n++) {
      setAt(n + 1);
      const c = candidates[n];
      if (!canDraftAI(c)) { skip++; setSkipped(skip); continue; }
      try {
        const { text } = await generateDraft(c);
        await store.updateCandidate(c.id, { ...c, draftText: text });
        good++; setOk(good);
      } catch { skip++; setSkipped(skip); }
    }
    setPhase('done');
  };

  if (phase === 'idle') {
    return (
      <button className="adm-btn adm-btn--soft adm-btn--sm" style={{ margin: '8px auto 0' }} onClick={run}>
        {total} adaya taslak oluştur (AI)
      </button>
    );
  }
  return (
    <div style={{ marginTop: 10, width: 280 }}>
      <div style={{ height: 6, borderRadius: 4, background: 'var(--adm-border-light)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.round((at / total) * 100)}%`, background: 'var(--adm-red, #DC2626)', transition: 'width .2s' }} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--adm-text-dim)', marginTop: 6, textAlign: 'center' }}>
        {phase === 'running' ? `${at}/${total} · ` : 'Bitti · '}
        {ok} taslak{skipped ? ` · ${skipped} atlandı (veri yetersiz)` : ''}
      </div>
    </div>
  );
}

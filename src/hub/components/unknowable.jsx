// unknowable.jsx — §8.6.5 "kesinlikle çıkarılamayanlar". Sistemin ne
// bilemediği arayüzde görünür. GitHub tarama + zenginleştirme ekranlarında.
import React from 'react';
import { UNKNOWABLE } from '../hub-enrich';

export default function UnknowablePanel({ compact = false }) {
  return (
    <div className="hub-ai" style={{ margin: compact ? '6px 0' : '12px 0' }}>
      <b>Bu kaynaktan kesinlikle çıkarılamaz</b> — sistemin ne bilmediğini bilmelisin:
      <ul style={{ margin: '4px 0 0 18px' }}>
        {UNKNOWABLE.map((u) => <li key={u}>{u}</li>)}
      </ul>
    </div>
  );
}

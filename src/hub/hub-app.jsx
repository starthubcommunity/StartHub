// hub-app.jsx — Kurucu Hattı kabuğu
// Adım 1: yalnızca boş kabuk. Auth + rol kapısı Adım 3'te, sidebar ve
// sayfa yönlendirme (useState + sessionStorage) sonraki adımlarda eklenecek.
import React from 'react';

export default function HubRoot() {
  return (
    <div className="hub-boot">
      <div className="hub-boot__brand">
        <div className="hub-boot__logo">SH</div>
        <div>
          <div className="hub-boot__title">Start-Hub</div>
          <div className="hub-boot__sub">Kurucu Hattı</div>
        </div>
      </div>
      <p className="hub-boot__note">Kurucu Hattı yapım aşamasında.</p>
    </div>
  );
}

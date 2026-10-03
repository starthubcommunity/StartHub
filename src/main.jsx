import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/site.css';
import App from './app';
import { ContentProvider, PostsProvider, bootPublicContent } from './data';

const container = document.getElementById('root');

function mount() {
  createRoot(container).render(
    <ContentProvider>
      <PostsProvider>
        <App />
      </PostsProvider>
    </ContentProvider>
  );
}

// Prerender'lanmış sayfada (#root dolu) React, ilk verisi gelmeden çizmez: aksi
// halde statik içerik boşaltılır, "bulunamadı"/boş durum bir an görünür, sonra
// veri gelince tekrar dolardı (flicker). 4 sn'de gelmezse yine de açılır.
if (container.childElementCount > 0) {
  const timeout = new Promise((resolve) => setTimeout(resolve, 4000));
  Promise.race([bootPublicContent(), timeout]).then(mount);
} else {
  mount();
}

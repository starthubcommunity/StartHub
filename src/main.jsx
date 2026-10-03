import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/site.css';
import App from './app';
import { ContentProvider, PostsProvider } from './data';

createRoot(document.getElementById('root')).render(
  <ContentProvider>
    <PostsProvider>
      <App />
    </PostsProvider>
  </ContentProvider>
);

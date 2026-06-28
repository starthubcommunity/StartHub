import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/site.css';
import App from './app';
import { PostsProvider } from './data';

createRoot(document.getElementById('root')).render(
  <PostsProvider>
    <App />
  </PostsProvider>
);

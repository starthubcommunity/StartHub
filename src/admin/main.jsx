import React from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/admin.css';
import AdminRoot from './admin-app';

createRoot(document.getElementById('admin-root')).render(<AdminRoot />);

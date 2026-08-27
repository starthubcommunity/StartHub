import React from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/hub.css';
import HubRoot from './hub-app';

createRoot(document.getElementById('hub-root')).render(<HubRoot />);

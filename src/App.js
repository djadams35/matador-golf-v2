import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Layout/Navbar';
import LeaguePage from './components/League/LeaguePage';
import DegensPage from './components/Degens/DegensPage';
import AdminPage from './components/Admin/AdminPage';
import Practice from './pages/Practice';
import PracticeDrills from './pages/PracticeDrills';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-vh-100 d-flex flex-column">
        <Navbar />
        <main className="flex-grow-1 py-4">
          <div className="container">
            <ErrorBoundary>
            <Routes>
              {/* Default redirect to league */}
              <Route path="/" element={<Navigate to="/league" replace />} />
              <Route path="/league/*" element={<LeaguePage />} />
              <Route path="/degens/*" element={<DegensPage />} />
              <Route path="/admin/*" element={<AdminPage />} />
              <Route path="/practice/drills" element={<PracticeDrills />} />
              <Route path="/practice" element={<Practice />} />
            </Routes>
            </ErrorBoundary>
          </div>
        </main>
        <footer className="bg-matador-black text-white text-center py-2 small">
          Matador Golf League
        </footer>
      </div>
    </BrowserRouter>
  );
}

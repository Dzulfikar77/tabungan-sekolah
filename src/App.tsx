import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import LoginSiswa from './components/LoginSiswa';
import LoginAdmin from './components/LoginAdmin';
import DashboardSiswa from './components/DashboardSiswa';
import { Dashboard } from './components/Dashboard';

function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LoginSiswa />} />
          <Route path="/admin" element={<LoginAdmin />} />
          <Route path="/dashboard-siswa" element={<DashboardSiswa />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;

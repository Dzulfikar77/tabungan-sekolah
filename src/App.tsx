import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginSiswa from './components/LoginSiswa';
import LoginAdmin from './components/LoginAdmin';
import DashboardSiswa from './components/DashboardSiswa';
import { Dashboard } from './components/Dashboard';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginSiswa />} />
        <Route path="/admin" element={<LoginAdmin />} />
        <Route path="/dashboard-siswa" element={<DashboardSiswa />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

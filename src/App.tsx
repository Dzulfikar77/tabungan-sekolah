import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginSiswa from './components/LoginSiswa';
import LoginAdmin from './components/LoginAdmin';
import DashboardSiswa from './components/DashboardSiswa';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginSiswa />} />
        <Route path="/admin" element={<LoginAdmin />} />
        <Route path="/dashboard-siswa" element={<DashboardSiswa />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

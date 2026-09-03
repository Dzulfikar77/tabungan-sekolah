export const simpanSesi = (role: 'siswa' | 'admin', identifier: string) => {
  const dataSesi = {
    role,
    identifier,
    waktuLogin: new Date().getTime(),
  };
  localStorage.setItem('sesi_mambaul_ulum', JSON.stringify(dataSesi));
};

export const cekSesiValid = (): boolean => {
  const sesiString = localStorage.getItem('sesi_mambaul_ulum');
  if (!sesiString) return false;

  const dataSesi = JSON.parse(sesiString);
  const waktuSekarang = new Date().getTime();
  const selisihWaktu = waktuSekarang - dataSesi.waktuLogin;
  const BATAS_WAKTU = 5 * 60 * 1000;

  if (selisihWaktu > BATAS_WAKTU) {
    hapusSesi();
    return false;
  }

  return true;
};

export const hapusSesi = () => {
  localStorage.removeItem('sesi_mambaul_ulum');
};

export const getDataUser = () => {
  const sesiString = localStorage.getItem('sesi_mambaul_ulum');
  if (!sesiString) return null;
  return JSON.parse(sesiString);
};

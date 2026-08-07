import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Profile from './pages/Profile';
import Atrio from './pages/Atrio';
import Grimorio from './pages/Grimorio';
import Escrituras from './pages/Escrituras';
import Plaza from './pages/Plaza';
import Rituales from './pages/Rituales';
import Redes from './pages/Redes';
import Confirmar from './pages/Confirmar';
import Gestion from './pages/Gestion';
import Landing from './pages/Landing';
import AvisoLegal from './pages/AvisoLegal';
import Privacidad from './pages/Privacidad';
import CookiesPage from './pages/Cookies';
import Biblioteca from './pages/Biblioteca';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Atrio />} />
          <Route path="grimorio" element={<Grimorio />} />
          <Route path="escrituras" element={<Escrituras />} />
          <Route path="biblioteca" element={<Biblioteca />} />
          <Route path="plaza" element={<Plaza />} />
          <Route path="rituales" element={<Rituales />} />
          <Route path="redes" element={<Redes />} />
          <Route path="profile" element={<Profile />} />
          <Route path="confirmar" element={<Confirmar />} />
          <Route path="gestion" element={<Gestion />} />
          <Route path="landing" element={<Landing />} />
          <Route path="aviso-legal" element={<AvisoLegal />} />
          <Route path="privacidad" element={<Privacidad />} />
          <Route path="cookies" element={<CookiesPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}


export default App;

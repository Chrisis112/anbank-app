import RegistrationForm from '../components/auth/RegistrationForm';
import CryptoBackground from '../components/layout/CryptoBackground';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function HomePage() {
  return (
    <>
      <main className="min-h-screen relative overflow-hidden">
        <CryptoBackground />
        {/* Main content */}
        <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
          <RegistrationForm />
        </div>
      </main>
      {/* Добавляем ToastContainer с базовыми настройками */}
<ToastContainer
  position="top-right"
  autoClose={5000}
  hideProgressBar={false}
  newestOnTop={true}
  closeOnClick
  rtl={false}
  pauseOnFocusLoss
  draggable
  pauseOnHover
  style={{ zIndex: 9999 }}
/>

    </>
  );
}

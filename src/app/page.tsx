import RegistrationForm from '../components/auth/RegistrationForm';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Buffer } from 'buffer';
import { useEffect } from 'react';

if (typeof global !== 'undefined') {
  global.Buffer = Buffer;
}

export default function HomePage() {
  useEffect(() => {
    // Полифиллы для React Native Web через Expo адаптер
    import('react-native-get-random-values');
    import('react-native-url-polyfill/auto');
  }, []);

  return (
    <>
      <main className="min-h-screen relative overflow-hidden">
        <RegistrationForm />
      </main>
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />
    </>
  );
}

// components/RegistrationForm.tsx
import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { usePhantomPayment } from '../../hooks/usePhantomPayment';
import axios from 'axios';

interface RegistrationData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface RegistrationFormProps {
  onSuccess?: (userData: any) => void;
  onError?: (error: string) => void;
}

export const RegistrationForm: React.FC<RegistrationFormProps> = ({ 
  onSuccess, 
  onError 
}) => {
  // Состояния формы
  const [formData, setFormData] = useState<RegistrationData>({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Partial<RegistrationData>>({});
  const [registrationStep, setRegistrationStep] = useState<'form' | 'payment' | 'processing' | 'complete'>('form');
  const [userRegistered, setUserRegistered] = useState(false);
  
  // Wallet и payment хуки
  const { connected, publicKey } = useWallet();
  const { 
    processPayment, 
    isLoading: paymentLoading, 
    error: paymentError, 
    isConnected,
    isMobileDevice,
    clearError,
    retryPayment
  } = usePhantomPayment();

  // Очистка ошибок при изменении данных формы
  useEffect(() => {
    if (paymentError) {
      clearError();
    }
  }, [formData, clearError, paymentError]);

  // Обработчики изменения полей формы
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Очищаем ошибку поля при изменении
    if (formErrors[name as keyof RegistrationData]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: undefined
      }));
    }
  };

  // Валидация формы
  const validateForm = (): boolean => {
    const errors: Partial<RegistrationData> = {};
    
    if (!formData.username.trim()) {
      errors.username = 'Имя пользователя обязательно';
    } else if (formData.username.length < 3) {
      errors.username = 'Имя пользователя должно содержать минимум 3 символа';
    }
    
    if (!formData.email.trim()) {
      errors.email = 'Email обязателен';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Некорректный формат email';
    }
    
    if (!formData.password) {
      errors.password = 'Пароль обязателен';
    } else if (formData.password.length < 6) {
      errors.password = 'Пароль должен содержать минимум 6 символов';
    }
    
    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Пароли не совпадают';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Регистрация пользователя на бэкенде
  const registerUser = async (walletAddress: string, transactionSignature: string) => {
    try {
      const response = await axios.post('/api/auth/register', {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        walletAddress,
        transactionSignature,
        subscriptionType: 'premium'
      });

      return response.data;
    } catch (error: any) {
      console.error('Ошибка регистрации пользователя:', error);
      
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      } else if (error.response?.status === 409) {
        throw new Error('Пользователь с такими данными уже существует');
      } else {
        throw new Error('Ошибка регистрации. Попробуйте позже.');
      }
    }
  };

  // Обработка отправки формы
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    if (!connected || !publicKey) {
      setRegistrationStep('payment');
      return;
    }
    
    // Если кошелек подключен, переходим к оплате
    await handlePayment();
  };

  // Обработка платежа
  const handlePayment = async () => {
    if (!connected || !publicKey) {
      alert('Пожалуйста, подключите кошелек для продолжения');
      return;
    }

    setRegistrationStep('processing');
    setIsSubmitting(true);

    try {
      console.log('Начинаем обработку платежа...');
      
      // Обрабатываем платеж
      const paymentResult = await processPayment();
      
      if (paymentResult.success && paymentResult.signature) {
        console.log('Платеж успешен, регистрируем пользователя...');
        
        // Регистрируем пользователя с подтверждением оплаты
        const userData = await registerUser(
          publicKey.toString(), 
          paymentResult.signature
        );
        
        setUserRegistered(true);
        setRegistrationStep('complete');
        
        // Уведомляем родительский компонент об успехе
        if (onSuccess) {
          onSuccess(userData);
        }
        
        console.log('Регистрация завершена успешно!');
        
      } else {
        throw new Error(paymentResult.error || 'Не удалось обработать платеж');
      }
      
    } catch (error: any) {
      console.error('Ошибка в процессе регистрации:', error);
      
      const errorMessage = error.message || 'Произошла ошибка при регистрации';
      
      if (onError) {
        onError(errorMessage);
      }
      
      // Возвращаемся к шагу оплаты для повторной попытки
      setRegistrationStep('payment');
      alert(`Ошибка: ${errorMessage}`);
      
    } finally {
      setIsSubmitting(false);
    }
  };

  // Повторная попытка платежа
  const handleRetryPayment = async () => {
    clearError();
    await handlePayment();
  };

  // Возврат к форме
  const handleBackToForm = () => {
    setRegistrationStep('form');
    clearError();
  };

  // Рендер формы регистрации
  const renderRegistrationForm = () => (
    <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-center mb-6">Регистрация</h2>
      
      <form onSubmit={handleFormSubmit} className="space-y-4">
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
            Имя пользователя
          </label>
          <input
            type="text"
            id="username"
            name="username"
            value={formData.username}
            onChange={handleInputChange}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              formErrors.username ? 'border-red-500' : 'border-gray-300'
            }`}
            disabled={isSubmitting}
          />
          {formErrors.username && (
            <p className="text-red-500 text-sm mt-1">{formErrors.username}</p>
          )}
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              formErrors.email ? 'border-red-500' : 'border-gray-300'
            }`}
            disabled={isSubmitting}
          />
          {formErrors.email && (
            <p className="text-red-500 text-sm mt-1">{formErrors.email}</p>
          )}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Пароль
          </label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleInputChange}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              formErrors.password ? 'border-red-500' : 'border-gray-300'
            }`}
            disabled={isSubmitting}
          />
          {formErrors.password && (
            <p className="text-red-500 text-sm mt-1">{formErrors.password}</p>
          )}
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
            Подтвердите пароль
          </label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleInputChange}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              formErrors.confirmPassword ? 'border-red-500' : 'border-gray-300'
            }`}
            disabled={isSubmitting}
          />
          {formErrors.confirmPassword && (
            <p className="text-red-500 text-sm mt-1">{formErrors.confirmPassword}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Обработка...' : 'Продолжить к оплате'}
        </button>
      </form>
    </div>
  );

  // Рендер шага оплаты
  const renderPaymentStep = () => (
    <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-center mb-6">Оплата подписки</h2>
      
      {/* Информация о платформе */}
      {isMobileDevice && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-700">
            📱 Вы используете мобильное устройство. Убедитесь, что приложение Phantom Wallet установлено.
          </p>
        </div>
      )}
      
      <div className="bg-gray-50 p-4 rounded-md mb-6">
        <h3 className="font-semibold text-lg mb-2">Премиум подписка</h3>
        <ul className="text-sm text-gray-600 space-y-1 mb-4">
          <li>✓ Безлимитные сообщения</li>
          <li>✓ Приоритетная поддержка</li>
          <li>✓ Расширенные функции</li>
          <li>✓ Доступ к премиум каналам</li>
        </ul>
        <div className="text-2xl font-bold text-green-600">
          0.36 SOL
        </div>
      </div>

      {/* Кнопка подключения кошелька */}
      <div className="mb-4">
        <WalletMultiButton className="!w-full !bg-purple-500 !hover:bg-purple-600" />
      </div>

      {/* Информация о подключенном кошельке */}
      {connected && publicKey && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-700">
            ✅ Кошелек подключен: {publicKey.toString().slice(0, 8)}...{publicKey.toString().slice(-8)}
          </p>
        </div>
      )}

      {/* Кнопки действий */}
      <div className="space-y-3">
        {connected ? (
          <>
            <button
              onClick={handlePayment}
              disabled={paymentLoading || isSubmitting}
              className="w-full bg-green-500 text-white py-3 px-4 rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
            >
              {paymentLoading || isSubmitting ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Обработка платежа...
                </div>
              ) : (
                'Оплатить 0.36 SOL'
              )}
            </button>

            {paymentError && (
              <div className="space-y-3">
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-700">❌ {paymentError}</p>
                </div>
                <button
                  onClick={handleRetryPayment}
                  disabled={paymentLoading}
                  className="w-full bg-orange-500 text-white py-2 px-4 rounded-md hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  Повторить попытку
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center text-gray-500 py-4">
            Подключите кошелек для продолжения
          </div>
        )}

        <button
          onClick={handleBackToForm}
          disabled={paymentLoading || isSubmitting}
          className="w-full bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50"
        >
          ← Назад к форме
        </button>
      </div>
    </div>
  );

  // Рендер шага обработки
  const renderProcessingStep = () => (
    <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow-md text-center">
      <div className="mb-6">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <h2 className="text-2xl font-bold mb-2">Обработка...</h2>
        <p className="text-gray-600">
          Пожалуйста, подождите. Мы обрабатываем ваш платеж и создаем аккаунт.
        </p>
      </div>
      
      <div className="space-y-2 text-sm text-left bg-gray-50 p-4 rounded-md">
        <div className="flex items-center">
          <span className="text-green-500 mr-2">✓</span>
          Данные формы проверены
        </div>
        <div className="flex items-center">
          <span className="text-green-500 mr-2">✓</span>
          Кошелек подключен
        </div>
        <div className="flex items-center">
          {paymentLoading ? (
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500 mr-2"></div>
          ) : (
            <span className="text-blue-500 mr-2">⟳</span>
          )}
          Обработка платежа...
        </div>
      </div>
    </div>
  );

  // Рендер завершения регистрации
  const renderCompletionStep = () => (
    <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow-md text-center">
      <div className="mb-6">
        <div className="text-green-500 text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold text-green-600 mb-2">Регистрация завершена!</h2>
        <p className="text-gray-600">
          Ваш аккаунт успешно создан, и подписка активирована.
        </p>
      </div>
      
      <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-6">
        <h3 className="font-semibold text-green-800 mb-2">Что дальше?</h3>
        <ul className="text-sm text-green-700 space-y-1">
          <li>• Вы можете начать пользоваться всеми премиум функциями</li>
          <li>• Проверьте свой email для подтверждения</li>
          <li>• Сохраните данные транзакции для записей</li>
        </ul>
      </div>

      <button
        onClick={() => window.location.href = '/dashboard'}
        className="w-full bg-blue-500 text-white py-3 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-semibold"
      >
        Перейти в приложение
      </button>
    </div>
  );

  // Основной рендер в зависимости от шага
  const renderCurrentStep = () => {
    switch (registrationStep) {
      case 'form':
        return renderRegistrationForm();
      case 'payment':
        return renderPaymentStep();
      case 'processing':
        return renderProcessingStep();
      case 'complete':
        return renderCompletionStep();
      default:
        return renderRegistrationForm();
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      {/* Индикатор прогресса */}
      <div className="max-w-md mx-auto mb-8">
        <div className="flex justify-between items-center">
          {['form', 'payment', 'processing', 'complete'].map((step, index) => (
            <div
              key={step}
              className={`flex items-center ${
                index < 3 ? 'flex-1' : ''
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  registrationStep === step || 
                  (['payment', 'processing', 'complete'].includes(registrationStep) && step === 'form') ||
                  (['processing', 'complete'].includes(registrationStep) && step === 'payment') ||
                  (registrationStep === 'complete' && step === 'processing')
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-300 text-gray-600'
                }`}
              >
                {index + 1}
              </div>
              {index < 3 && (
                <div
                  className={`flex-1 h-1 mx-2 ${
                    (['payment', 'processing', 'complete'].includes(registrationStep) && index === 0) ||
                    (['processing', 'complete'].includes(registrationStep) && index === 1) ||
                    (registrationStep === 'complete' && index === 2)
                      ? 'bg-blue-500'
                      : 'bg-gray-300'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        
        <div className="flex justify-between text-xs text-gray-600 mt-2">
          <span>Форма</span>
          <span>Оплата</span>
          <span>Обработка</span>
          <span>Готово</span>
        </div>
      </div>

      {/* Основной контент */}
      {renderCurrentStep()}
    </div>
  );
};

export default RegistrationForm;

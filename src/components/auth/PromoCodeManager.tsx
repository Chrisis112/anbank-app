'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

interface PromoCode {
  _id: string;
  code: string;
  description: string;
  usageLimit: number;
  usedCount: number;
  validFrom?: string;
  validUntil?: string;
  createdAt: string;
  updatedAt: string;
}

interface PaginationInfo {
  current: number;
  total: number;
  count: number;
}

export default function PromoCodeManager() {
  // Состояния для списка промо-кодов
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState<PaginationInfo>({ current: 1, total: 1, count: 0 });
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Состояния для модальных окон
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [editingCode, setEditingCode] = useState<PromoCode | null>(null);

  // Форма создания/редактирования
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    usageLimit: 1,
    validFrom: '',
    validUntil: ''
  });

  // Форма генерации
  const [generateData, setGenerateData] = useState({
    count: 5,
    codeLength: 8,
    description: '',
    usageLimit: 1,
    validFrom: '',
    validUntil: ''
  });

  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Загрузка данных при изменении поиска или страницы
  useEffect(() => {
    fetchPromoCodes();
  }, [search, currentPage]);

  const getAuthHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('token')}`
  });

  // Загрузка списка промо-кодов
  const fetchPromoCodes = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/promo-codes`,
        { 
          headers: getAuthHeaders(),
          params: { 
            search,
            page: currentPage,
            limit: 20
          }
        }
      );
      setPromoCodes(data.promoCodes || []);
      setPagination(data.pagination || { current: 1, total: 1, count: 0 });
    } catch (error: any) {
      console.error('Ошибка загрузки промо-кодов:', error);
      toast.error(error.response?.data?.error || 'Ошибка загрузки промо-кодов');
    } finally {
      setLoading(false);
    }
  };

  // Создание нового промо-кода
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.code.trim()) {
      toast.error('Введите код');
      return;
    }

    try {
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/promo-codes`,
        {
          ...formData,
          code: formData.code.toUpperCase().trim()
        },
        { headers: getAuthHeaders() }
      );
      
      toast.success('Промо-код создан успешно');
      setShowCreateModal(false);
      resetForm();
      fetchPromoCodes();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка создания промо-кода');
    }
  };

  // Редактирование промо-кода
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingCode) return;

    try {
      await axios.put(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/promo-codes/${editingCode._id}`,
        formData,
        { headers: getAuthHeaders() }
      );
      
      toast.success('Промо-код обновлен успешно');
      setShowEditModal(false);
      setEditingCode(null);
      resetForm();
      fetchPromoCodes();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка обновления промо-кода');
    }
  };

  // Генерация промо-кодов
  const handleGenerateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    
    try {
      const { data } = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/generate-promo-codes`,
        generateData,
        { headers: getAuthHeaders() }
      );
      
      setGeneratedCodes(data.codes || []);
      toast.success(`Успешно сгенерировано ${data.codes?.length || 0} промо-кодов`);
      fetchPromoCodes();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка генерации промо-кодов');
    } finally {
      setIsGenerating(false);
    }
  };

  // Удаление промо-кода
  const handleDelete = async (id: string, code: string) => {
    if (!window.confirm(`Удалить промо-код "${code}"? Это действие нельзя отменить.`)) {
      return;
    }

    try {
      await axios.delete(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/promo-codes/${id}`,
        { headers: getAuthHeaders() }
      );
      
      toast.success('Промо-код удален');
      fetchPromoCodes();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка удаления промо-кода');
    }
  };

  // Открытие модала редактирования
  const openEditModal = (code: PromoCode) => {
    setEditingCode(code);
    setFormData({
      code: code.code,
      description: code.description,
      usageLimit: code.usageLimit,
      validFrom: code.validFrom ? code.validFrom.split('T')[0] : '',
      validUntil: code.validUntil ? code.validUntil.split('T')[0] : ''
    });
    setShowEditModal(true);
  };

  // Сброс формы
  const resetForm = () => {
    setFormData({
      code: '',
      description: '',
      usageLimit: 1,
      validFrom: '',
      validUntil: ''
    });
  };

  // Копирование в буфер обмена
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Скопировано в буфер обмена');
    }).catch(() => {
      toast.error('Ошибка копирования');
    });
  };

  // Копирование всех сгенерированных кодов
  const copyAllGeneratedCodes = () => {
    const allCodes = generatedCodes.join('\n');
    copyToClipboard(allCodes);
  };

  // Проверка статуса промо-кода
  const getCodeStatus = (code: PromoCode) => {
    const now = new Date();
    if (code.validFrom && new Date(code.validFrom) > now) return 'pending';
    if (code.validUntil && new Date(code.validUntil) < now) return 'expired';
    if (code.usedCount >= code.usageLimit) return 'exhausted';
    return 'active';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-400';
      case 'pending': return 'text-yellow-400';
      case 'expired': return 'text-red-400';
      case 'exhausted': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Активен';
      case 'pending': return 'Ожидает';
      case 'expired': return 'Истек';
      case 'exhausted': return 'Исчерпан';
      default: return 'Неизвестен';
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 bg-crypto-dark text-white min-h-screen">
      <div className="mb-8">
        <h1 className="text-4xl font-orbitron text-crypto-accent mb-2">
          Управление промо-кодами
        </h1>
        <p className="text-gray-300">
          Создавайте, редактируйте и управляйте промо-кодами для вашего приложения
        </p>
      </div>

      {/* Панель управления */}
      <div className="bg-crypto-input rounded-lg p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-4">
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <span>➕</span>
              Создать код
            </button>
            
            <button
              onClick={() => setShowGenerateModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <span>🎲</span>
              Генерировать коды
            </button>
          </div>
          
          <div className="flex gap-4 items-center">
            <input
              type="text"
              placeholder="Поиск по коду или описанию..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="px-4 py-2 bg-crypto-dark border border-crypto-accent rounded-lg text-white placeholder-gray-400 w-64"
            />
            
            <div className="text-sm text-gray-300">
              Всего: {pagination.count} кодов
            </div>
          </div>
        </div>
      </div>

      {/* Таблица промо-кодов */}
      <div className="bg-crypto-input rounded-lg overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-crypto-accent"></div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-crypto-accent text-white">
                  <tr>
                    <th className="p-4 text-left font-semibold">Код</th>
                    <th className="p-4 text-left font-semibold">Описание</th>
                    <th className="p-4 text-left font-semibold">Использования</th>
                    <th className="p-4 text-left font-semibold">Статус</th>
                    <th className="p-4 text-left font-semibold">Период действия</th>
                    <th className="p-4 text-left font-semibold">Создан</th>
                    <th className="p-4 text-left font-semibold">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {promoCodes.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-gray-400">
                        Промо-коды не найдены
                      </td>
                    </tr>
                  ) : (
                    promoCodes.map((code) => {
                      const status = getCodeStatus(code);
                      return (
                        <tr key={code._id} className="border-b border-gray-600 hover:bg-crypto-dark transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-crypto-accent text-lg">
                                {code.code}
                              </span>
                              <button
                                onClick={() => copyToClipboard(code.code)}
                                className="text-blue-400 hover:text-blue-300 transition-colors"
                                title="Скопировать код"
                              >
                                📋
                              </button>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="max-w-xs">
                              {code.description || <span className="text-gray-500">—</span>}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <span className={`font-semibold ${code.usedCount >= code.usageLimit ? 'text-red-400' : 'text-green-400'}`}>
                                {code.usedCount}/{code.usageLimit}
                              </span>
                              <div className="w-20 bg-gray-700 rounded-full h-2">
                                <div 
                                  className={`h-2 rounded-full ${code.usedCount >= code.usageLimit ? 'bg-red-500' : 'bg-green-500'}`}
                                  style={{ width: `${Math.min((code.usedCount / code.usageLimit) * 100, 100)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(status)}`}>
                              {getStatusText(status)}
                            </span>
                          </td>
                          <td className="p-4 text-sm">
                            {code.validFrom && (
                              <div>С: {new Date(code.validFrom).toLocaleDateString()}</div>
                            )}
                            {code.validUntil && (
                              <div>До: {new Date(code.validUntil).toLocaleDateString()}</div>
                            )}
                            {!code.validFrom && !code.validUntil && (
                              <span className="text-gray-500">Без ограничений</span>
                            )}
                          </td>
                          <td className="p-4 text-sm text-gray-400">
                            {new Date(code.createdAt).toLocaleDateString()}
                          </td>
                          <td className="p-4">
                            <div className="flex gap-2">
                              <button
                                onClick={() => openEditModal(code)}
                                className="px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 transition-colors"
                                title="Редактировать"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => handleDelete(code._id, code.code)}
                                className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                                title="Удалить"
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Пагинация */}
            {pagination.total > 1 && (
              <div className="flex justify-between items-center p-4 border-t border-gray-600">
                <div className="text-sm text-gray-400">
                  Страница {pagination.current} из {pagination.total}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={pagination.current === 1}
                    className="px-3 py-1 bg-gray-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-500 transition-colors"
                  >
                    Назад
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, pagination.total))}
                    disabled={pagination.current === pagination.total}
                    className="px-3 py-1 bg-gray-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-500 transition-colors"
                  >
                    Вперед
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Модал создания промо-кода */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-crypto-dark border border-crypto-accent rounded-lg w-full max-w-md">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4 text-crypto-accent">
                Создать новый промо-код
              </h2>
              
              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Код *</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({...formData, code: e.target.value})}
                    className="w-full p-3 bg-crypto-input border border-crypto-accent rounded text-white uppercase"
                    placeholder="Например: WELCOME2025"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Описание</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full p-3 bg-crypto-input border border-crypto-accent rounded text-white"
                    placeholder="Описание акции"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Лимит использований *</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.usageLimit}
                    onChange={(e) => setFormData({...formData, usageLimit: parseInt(e.target.value) || 1})}
                    className="w-full p-3 bg-crypto-input border border-crypto-accent rounded text-white"
                    required
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Действует с</label>
                    <input
                      type="date"
                      value={formData.validFrom}
                      onChange={(e) => setFormData({...formData, validFrom: e.target.value})}
                      className="w-full p-3 bg-crypto-input border border-crypto-accent rounded text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Действует до</label>
                    <input
                      type="date"
                      value={formData.validUntil}
                      onChange={(e) => setFormData({...formData, validUntil: e.target.value})}
                      className="w-full p-3 bg-crypto-input border border-crypto-accent rounded text-white"
                    />
                  </div>
                </div>
                
                <div className="flex gap-4 pt-4">
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-green-600 text-white rounded hover:bg-green-700 transition-colors font-semibold"
                  >
                    Создать код
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      resetForm();
                    }}
                    className="flex-1 py-3 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Модал редактирования промо-кода */}
      {showEditModal && editingCode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-crypto-dark border border-crypto-accent rounded-lg w-full max-w-md">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4 text-crypto-accent">
                Редактировать промо-код: {editingCode.code}
              </h2>
              
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Описание</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full p-3 bg-crypto-input border border-crypto-accent rounded text-white"
                    placeholder="Описание акции"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Лимит использований *</label>
                  <input
                    type="number"
                    min={editingCode.usedCount}
                    value={formData.usageLimit}
                    onChange={(e) => setFormData({...formData, usageLimit: parseInt(e.target.value) || 1})}
                    className="w-full p-3 bg-crypto-input border border-crypto-accent rounded text-white"
                    required
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Минимальное значение: {editingCode.usedCount} (уже использовано)
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Действует с</label>
                    <input
                      type="date"
                      value={formData.validFrom}
                      onChange={(e) => setFormData({...formData, validFrom: e.target.value})}
                      className="w-full p-3 bg-crypto-input border border-crypto-accent rounded text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Действует до</label>
                    <input
                      type="date"
                      value={formData.validUntil}
                      onChange={(e) => setFormData({...formData, validUntil: e.target.value})}
                      className="w-full p-3 bg-crypto-input border border-crypto-accent rounded text-white"
                    />
                  </div>
                </div>
                
                <div className="flex gap-4 pt-4">
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-semibold"
                  >
                    Сохранить изменения
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingCode(null);
                      resetForm();
                    }}
                    className="flex-1 py-3 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Модал генерации промо-кодов */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-crypto-dark border border-crypto-accent rounded-lg w-full max-w-md">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4 text-crypto-accent">
                Генерация промо-кодов
              </h2>
              
              <form onSubmit={handleGenerateSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Количество *</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={generateData.count}
                      onChange={(e) => setGenerateData({...generateData, count: parseInt(e.target.value) || 1})}
                      className="w-full p-3 bg-crypto-input border border-crypto-accent rounded text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Длина кода *</label>
                    <input
                      type="number"
                      min="4"
                      max="16"
                      value={generateData.codeLength}
                      onChange={(e) => setGenerateData({...generateData, codeLength: parseInt(e.target.value) || 8})}
                      className="w-full p-3 bg-crypto-input border border-crypto-accent rounded text-white"
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Описание</label>
                  <input
                    type="text"
                    value={generateData.description}
                    onChange={(e) => setGenerateData({...generateData, description: e.target.value})}
                    className="w-full p-3 bg-crypto-input border border-crypto-accent rounded text-white"
                    placeholder="Описание для всех кодов"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Лимит использований *</label>
                  <input
                    type="number"
                    min="1"
                    value={generateData.usageLimit}
                    onChange={(e) => setGenerateData({...generateData, usageLimit: parseInt(e.target.value) || 1})}
                    className="w-full p-3 bg-crypto-input border border-crypto-accent rounded text-white"
                    required
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Действует с</label>
                    <input
                      type="date"
                      value={generateData.validFrom}
                      onChange={(e) => setGenerateData({...generateData, validFrom: e.target.value})}
                      className="w-full p-3 bg-crypto-input border border-crypto-accent rounded text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Действует до</label>
                    <input
                      type="date"
                      value={generateData.validUntil}
                      onChange={(e) => setGenerateData({...generateData, validUntil: e.target.value})}
                      className="w-full p-3 bg-crypto-input border border-crypto-accent rounded text-white"
                    />
                  </div>
                </div>
                
                <div className="flex gap-4 pt-4">
                  <button
                    type="submit"
                    disabled={isGenerating}
                    className="flex-1 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50"
                  >
                    {isGenerating ? 'Генерация...' : 'Сгенерировать'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowGenerateModal(false);
                      setGeneratedCodes([]);
                    }}
                    className="flex-1 py-3 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                  >
                    Отмена
                  </button>
                </div>
              </form>

              {/* Результаты генерации */}
              {generatedCodes.length > 0 && (
                <div className="mt-6 p-4 bg-green-900/20 border border-green-500 rounded-lg">
                  <h3 className="text-lg font-semibold mb-3 text-green-400">
                    Сгенерировано {generatedCodes.length} промо-кодов:
                  </h3>
                  <div className="grid grid-cols-2 gap-2 mb-4 max-h-32 overflow-y-auto">
                    {generatedCodes.map((code, index) => (
                      <div key={index} className="p-2 bg-crypto-dark rounded font-mono text-crypto-accent text-center text-sm">
                        {code}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={copyAllGeneratedCodes}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                  >
                    📋 Скопировать все коды
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

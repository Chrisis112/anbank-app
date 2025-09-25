import React from "react";

interface TokenFormData {
  name: string;
  symbol: string;
  description: string;
  supply: string;
  decimals: number;
  imageFile: File | null;
}

interface TokenFormProps {
  formData: TokenFormData;
  onChange: (e: React.ChangeEvent<any>) => void;
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled: boolean;
  walletBalance: number;
  createToken: () => void;
}

export default function TokenForm({
  formData,
  onChange,
  onImageChange,
  disabled,
  walletBalance,
  createToken,
}: TokenFormProps) {
  return (
    <>
      <div>
        <label>Token name *</label>
        <input type="text" name="name" value={formData.name} onChange={onChange} maxLength={32} disabled={disabled} />
      </div>
      <div>
        <label>Token symbol *</label>
        <input type="text" name="symbol" value={formData.symbol} onChange={onChange} maxLength={10} disabled={disabled} />
      </div>
      <div>
        <label>Description</label>
        <textarea name="description" value={formData.description} onChange={onChange} disabled={disabled} />
      </div>
      <div>
        <label>Total quantity *</label>
        <input type="number" name="supply" value={formData.supply} onChange={onChange} min="1" disabled={disabled} />
      </div>
      <div>
        <label>Decimal places</label>
        <select name="decimals" value={formData.decimals} onChange={onChange} disabled={disabled}>
          <option value={0}>0 (integers)</option>
          <option value={2}>2 (like dollars)</option>
          <option value={6}>6 (standart)</option>
          <option value={9}>9 (like SOL)</option>
        </select>
      </div>
      <div>
        <label>Token image</label>
        <input type="file" accept="image/*" onChange={onImageChange} disabled={disabled} />
      </div>
      <button onClick={createToken} disabled={disabled || walletBalance < 0.05}>
        {disabled ? "Создание токена..." : walletBalance < 0.05 ? "Недостаточно SOL" : "Создать токен"}
      </button>
    </>
  );
}

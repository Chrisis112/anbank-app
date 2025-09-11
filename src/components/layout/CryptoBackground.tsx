'use client'

import { useEffect, useRef } from 'react'

export default function CryptoBackground() {
  const backgroundRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Перенести всю логику анимации 3D фона из оригинального app.js
    const initAnimations = () => {
      // Код анимации частиц
      // Код плавающих монет
      // Код интерактивных элементов
    }

    initAnimations()
  }, [])

  return (
    <div ref={backgroundRef} className="crypto-bg fixed inset-0 z-0">
      <div className="crypto-particle"></div>
      <div className="crypto-particle"></div>
      <div className="crypto-particle"></div>
      <div className="crypto-particle"></div>
      <div className="crypto-particle"></div>
      <div className="floating-coin coin-1">₿</div>
      <div className="floating-coin coin-2">Ξ</div>
      <div className="floating-coin coin-3">◎</div>
    </div>
  )
}

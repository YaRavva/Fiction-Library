'use client'

import { useEffect, useRef } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  opacity: number
  color: string
  life: number
  maxLife: number
}

export function EnchantedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const animationFrameRef = useRef<number>()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    // Создаём частицы (embers/fireflies)
    const createParticle = (): Particle => {
      const isEmber = Math.random() > 0.5
      return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: isEmber ? -Math.random() * 0.5 - 0.2 : (Math.random() - 0.5) * 0.3,
        size: isEmber ? Math.random() * 3 + 1 : Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.5 + 0.3,
        color: isEmber
          ? `rgba(255, ${Math.floor(Math.random() * 100 + 150)}, 0,`
          : `rgba(147, ${Math.floor(Math.random() * 50 + 50)}, 255,`,
        life: 0,
        maxLife: Math.random() * 200 + 100,
      }
    }

    // Инициализируем частицы
    const particleCount = 80
    for (let i = 0; i < particleCount; i++) {
      particlesRef.current.push(createParticle())
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Градиентный фон
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
      gradient.addColorStop(0, 'rgba(15, 5, 30, 0.95)')
      gradient.addColorStop(0.5, 'rgba(20, 10, 40, 0.9)')
      gradient.addColorStop(1, 'rgba(30, 15, 25, 0.95)')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Обновляем и рисуем частицы
      particlesRef.current.forEach((particle, index) => {
        // Обновляем позицию
        particle.x += particle.vx
        particle.y += particle.vy
        particle.life++

        // Пульсация прозрачности
        const pulse = Math.sin(particle.life * 0.05) * 0.2 + 0.3
        const currentOpacity = particle.opacity * pulse

        // Рисуем частицу
        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
        ctx.fillStyle = particle.color + currentOpacity + ')'
        ctx.fill()

        // Добавляем свечение
        const glow = ctx.createRadialGradient(
          particle.x,
          particle.y,
          0,
          particle.x,
          particle.y,
          particle.size * 4
        )
        glow.addColorStop(0, particle.color + (currentOpacity * 0.5) + ')')
        glow.addColorStop(1, particle.color + '0)')
        ctx.fillStyle = glow
        ctx.fillRect(
          particle.x - particle.size * 4,
          particle.y - particle.size * 4,
          particle.size * 8,
          particle.size * 8
        )

        // Перезапускаем частицу если она вышла за пределы или закончилась жизнь
        if (
          particle.y < -50 ||
          particle.y > canvas.height + 50 ||
          particle.x < -50 ||
          particle.x > canvas.width + 50 ||
          particle.life > particle.maxLife
        ) {
          particlesRef.current[index] = createParticle()
          particlesRef.current[index].y = canvas.height + 10
        }
      })

      animationFrameRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  )
}

export const dynamic = 'force-dynamic'

export default function NotFound() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{ textAlign: 'center', maxWidth: '350px' }}>
        <div style={{ marginBottom: '2rem' }}>
          <div style={{
            width: '48px',
            height: '48px',
            margin: '0 auto 1rem',
            color: '#6b7280'
          }}>
            ⚠️
          </div>
          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: '600',
            marginBottom: '0.5rem',
            color: '#111827'
          }}>
            Страница не найдена
          </h1>
          <p style={{
            fontSize: '0.875rem',
            color: '#6b7280',
            lineHeight: '1.5'
          }}>
            Запрашиваемая страница не существует или была перемещена.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <a href="/" style={{
            display: 'block',
            padding: '8px 16px',
            backgroundColor: '#3b82f6',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '6px',
            fontSize: '0.875rem',
            fontWeight: '500',
            textAlign: 'center'
          }}>
            На главную
          </a>
          <a href="/library" style={{
            display: 'block',
            padding: '8px 16px',
            backgroundColor: 'transparent',
            color: '#3b82f6',
            textDecoration: 'none',
            border: '1px solid #3b82f6',
            borderRadius: '6px',
            fontSize: '0.875rem',
            fontWeight: '500',
            textAlign: 'center'
          }}>
            К библиотеке
          </a>
        </div>
      </div>
    </div>
  )
}
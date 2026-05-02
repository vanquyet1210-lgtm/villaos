// VillaOS v7 — app/offline/page.tsx
// Trang hiển thị khi người dùng mất mạng và không có cache

export default function OfflinePage() {
  return (
    <div style={{
      minHeight:       '100vh',
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'center',
      flexDirection:   'column',
      gap:             16,
      background:      'var(--parchment)',
      fontFamily:      'var(--font-body)',
      padding:         24,
      textAlign:       'center',
    }}>
      <span style={{ fontSize: 64 }}>📡</span>

      <h1 style={{
        fontFamily:  'var(--font-display)',
        fontSize:    '1.8rem',
        color:       'var(--forest-deep)',
        margin:      0,
      }}>
        Không có kết nối mạng
      </h1>

      <p style={{ color: 'var(--ink-light)', maxWidth: 320, lineHeight: 1.6 }}>
        VillaOS cần kết nối internet để hiển thị dữ liệu mới nhất.
        Vui lòng kiểm tra WiFi hoặc dữ liệu di động rồi thử lại.
      </p>

      <button
        onClick={() => window.location.reload()}
        style={{
          marginTop:     8,
          padding:       '12px 24px',
          background:    'var(--forest)',
          color:         'white',
          border:        'none',
          borderRadius:  'var(--radius-md)',
          fontFamily:    'var(--font-body)',
          fontSize:      '0.95rem',
          fontWeight:    600,
          cursor:        'pointer',
        }}
      >
        🔄 Thử lại
      </button>

      <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginTop: 8 }}>
        VillaOS v7
      </p>
    </div>
  );
}

'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface Props {
  children: React.ReactNode;
  profileName: string;
  profileBrand: string;
  isAdmin: boolean;
}

export default function OwnerLayoutClient({ children, profileName, profileBrand, isAdmin }: Props) {
  const path = usePathname();

  const tabs = [
    { href: '/owner/calendar', label: 'Lịch phòng',    Icon: CalIcon   },
    { href: '/owner/holds',    label: 'Yêu cầu giữ',   Icon: HoldIcon, badge: true },
    { href: '/owner/villas',   label: 'Villa của tôi',  Icon: HomeIcon  },
    { href: '/owner/more',     label: 'Thêm',           Icon: MoreIcon  },
  ];

  return (
    <div style={{ minHeight:'100dvh', background:'#f5f5f0', display:'flex', flexDirection:'column' }}>
      {/* ── Top bar ── */}
      <header style={{
        position:'sticky', top:0, zIndex:50,
        background:'#fff', borderBottom:'1px solid #eee',
        padding:'10px 16px',
        display:'flex', alignItems:'center', justifyContent:'space-between',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <button style={{ background:'none', border:'none', cursor:'pointer', padding:4 }}>
            <span style={{ fontSize:20 }}>☰</span>
          </button>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:18 }}>🏡</span>
              <span style={{ fontWeight:700, fontSize:'1rem', color:'#1a3a2a' }}>VillaOS</span>
            </div>
            <div style={{ fontSize:'0.7rem', color:'#888', marginTop:-1 }}>
              {isAdmin ? '⚡ Super Admin' : `Chủ Villa • ${profileBrand || profileName}`}
            </div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ position:'relative' }}>
            <button style={{
              background:'#f5f5f0', border:'none', borderRadius:'50%',
              width:36, height:36, cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:18,
            }}>🔔</button>
            <span style={{
              position:'absolute', top:0, right:0,
              background:'#e57373', color:'#fff', borderRadius:'50%',
              width:16, height:16, fontSize:'0.65rem', fontWeight:700,
              display:'flex', alignItems:'center', justifyContent:'center',
              border:'2px solid #fff',
            }}>5</span>
          </div>
          <Link href="/owner/calendar" style={{
            background:'#2e7d52', color:'#fff', borderRadius:'50%',
            width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:20, textDecoration:'none', fontWeight:700,
          }}>+</Link>
        </div>
      </header>

      {/* ── Page content ── */}
      <main style={{ flex:1, overflowY:'auto', paddingBottom:72 }}>
        {children}
      </main>

      {/* ── Bottom nav ── */}
      <nav style={{
        position:'fixed', bottom:0, left:0, right:0, zIndex:50,
        background:'#fff', borderTop:'1px solid #eee',
        display:'flex', height:64,
        boxShadow:'0 -2px 12px rgba(0,0,0,0.06)',
      }}>
        {tabs.map((tab, i) => {
          const active = path.startsWith(tab.href);
          const { Icon } = tab;
          if (i === 1) {
            return (
              <Link key={tab.href} href={tab.href} style={{
                flex:1, display:'flex', flexDirection:'column',
                alignItems:'center', justifyContent:'center',
                textDecoration:'none', gap:2, position:'relative',
                color: active ? '#2e7d52' : '#999',
              }}>
                <div style={{ position:'relative' }}>
                  <Icon active={active} />
                  <span style={{
                    position:'absolute', top:-4, right:-8,
                    background:'#2e7d52', color:'#fff',
                    borderRadius:'50%', width:16, height:16,
                    fontSize:'0.6rem', fontWeight:700,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    border:'2px solid #fff',
                  }}>12</span>
                </div>
                <span style={{ fontSize:'0.62rem', fontWeight: active ? 600 : 400 }}>{tab.label}</span>
              </Link>
            );
          }
          return (
            <Link key={tab.href} href={tab.href} style={{
              flex:1, display:'flex', flexDirection:'column',
              alignItems:'center', justifyContent:'center',
              textDecoration:'none', gap:2,
              color: active ? '#2e7d52' : '#999',
            }}>
              <Icon active={active} />
              <span style={{ fontSize:'0.62rem', fontWeight: active ? 600 : 400 }}>{tab.label}</span>
            </Link>
          );
        })}
        {/* FAB */}
        <Link href="/owner/calendar" style={{
          position:'absolute', left:'50%', top:-20,
          transform:'translateX(-50%)',
          background:'#2e7d52', color:'#fff', borderRadius:'50%',
          width:52, height:52, display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:26, textDecoration:'none', fontWeight:700,
          boxShadow:'0 4px 16px rgba(46,125,82,0.4)',
          border:'3px solid #fff',
        }}>+</Link>
      </nav>
    </div>
  );
}

function CalIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#2e7d52' : '#bbb'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}
function HoldIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#2e7d52' : '#bbb'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}
function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#2e7d52' : '#bbb'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  );
}
function MoreIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#2e7d52' : '#bbb'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  );
}

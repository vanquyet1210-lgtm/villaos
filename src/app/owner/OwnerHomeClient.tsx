'use client';
// ╔══════════════════════════════════════════════════════════════╗
// ║  VillaOS v7 — app/owner/OwnerHomeClient.tsx                 ║
// ║  Mobile home: villa cards + lịch + yêu cầu giữ phòng       ║
// ╚══════════════════════════════════════════════════════════════╝

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { formatDate, calcNights, fmtMoney } from '@/lib/utils';

interface VillaStat {
  id: string; name: string; emoji: string; bedrooms: number;
  price: number; status: string; code: string;
  confirmed: number; holds: number; free: number; occupied: boolean;
}

interface HoldRequest {
  id: string; customer: string; phone: string;
  checkin: string; checkout: string; nights: number;
  villaName: string; villaId: string; saleName: string; total: number;
}

interface Props {
  villas: VillaStat[];
  allBookings: any[];
  holdRequests: HoldRequest[];
  profileName: string;
}

const DAYS_VI = ['T2','T3','T4','T5','T6','T7','CN'];

// ── Booking bar style: repeating-linear-gradient ──────────────────
function barBg(status: string) {
  if (status === 'hold') return `repeating-linear-gradient(
    45deg,
    #f0b429,
    #f0b429 8px,
    #fcd97a 8px,
    #fcd97a 16px
  )`;
  // confirmed: mint sage repeating gradient
  return `repeating-linear-gradient(
    45deg,
    #4a9e7e,
    #4a9e7e 8px,
    #6bbfa0 8px,
    #6bbfa0 16px
  )`;
}

function barColor(status: string) {
  return status === 'hold' ? '#f0b429' : '#3d8c6e';
}

export default function OwnerHomeClient({ villas, allBookings, holdRequests, profileName }: Props) {
  const [selectedVillaId, setSelectedVillaId] = useState(villas[0]?.id ?? '');
  const [year,  setYear]  = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());

  const selectedVilla = villas.find(v => v.id === selectedVillaId) ?? villas[0];

  // ── Calendar engine ────────────────────────────────────────────
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  // Convert to Mon-start: 0=Mon..6=Sun
  const firstOffset = (firstDay + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthStr = `${year}-${String(month+1).padStart(2,'0')}`;
  const todayStr = new Date().toISOString().slice(0,10);

  const villaBookings = useMemo(() => 
    allBookings.filter(b => b.villa_id === selectedVillaId && b.status !== 'cancelled'),
    [allBookings, selectedVillaId]
  );

  // Build day map: date → booking info
  const dayMap = useMemo(() => {
    const map: Record<string, { status: string; label: string; type: 'checkin'|'middle'|'checkout'|'full'; bk: any }[]> = {};
    for (const b of villaBookings) {
      const ci = b.checkin.slice(0,10);
      const co = b.checkout.slice(0,10);
      const label = b.customer ?? '';
      // nights: ci to co-1
      let d = new Date(ci + 'T00:00:00');
      const end = new Date(co + 'T00:00:00');
      let first = true;
      while (d < end) {
        const ds = d.toISOString().slice(0,10);
        const isLast = new Date(d.getTime() + 86400000) >= end;
        const type = first ? 'checkin' : isLast ? 'checkout' : 'middle';
        if (!map[ds]) map[ds] = [];
        map[ds].push({ status: b.status, label, type, bk: b });
        first = false;
        d.setDate(d.getDate() + 1);
      }
    }
    return map;
  }, [villaBookings]);

  // Build booking bars: group by booking, calculate row/col spans
  const bars = useMemo(() => {
    const result: { bk: any; startDay: number; endDay: number; row: number }[] = [];
    const seen = new Set<string>();
    for (const b of villaBookings) {
      if (seen.has(b.id)) continue;
      seen.add(b.id);
      const ci = new Date(b.checkin.slice(0,10) + 'T00:00:00');
      const co = new Date(b.checkout.slice(0,10) + 'T00:00:00');
      // Only show if overlaps with current month
      const monthStart = new Date(year, month, 1);
      const monthEnd   = new Date(year, month+1, 1);
      if (co <= monthStart || ci >= monthEnd) continue;
      const effStart = ci < monthStart ? monthStart : ci;
      const effEnd   = co > monthEnd ? monthEnd : co;
      const startDay = effStart.getDate();
      const endDay   = Math.max(startDay, new Date(effEnd.getTime() - 86400000).getDate());
      result.push({ bk: b, startDay, endDay, row: 0 });
    }
    return result;
  }, [villaBookings, year, month]);

  function prevMo() {
    if (month === 0) { setYear(y => y-1); setMonth(11); }
    else setMonth(m => m-1);
  }
  function nextMo() {
    if (month === 11) { setYear(y => y+1); setMonth(0); }
    else setMonth(m => m+1);
  }

  const monthLabel = new Date(year, month, 1).toLocaleDateString('vi-VN', { month:'long', year:'numeric' });

  // Grid cells
  const cells: (number|null)[] = [...Array(firstOffset).fill(null)];
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  // pad to complete rows
  while (cells.length % 7 !== 0) cells.push(null);

  const numRows = cells.length / 7;

  return (
    <div style={{ padding:'0 0 8px' }}>
      {/* ── Villa cards horizontal scroll ── */}
      <div style={{ padding:'14px 16px 6px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <h2 style={{ fontSize:'1rem', fontWeight:700, color:'#1a2e1a', margin:0 }}>
            Danh sách villa của bạn
          </h2>
          <Link href="/owner/villas" style={{
            display:'flex', alignItems:'center', gap:4,
            fontSize:'0.78rem', color:'#555', textDecoration:'none',
            border:'1px solid #ddd', borderRadius:20, padding:'4px 10px',
          }}>
            ⚙️ Quản lý villa
          </Link>
        </div>

        <div style={{ display:'flex', gap:12, overflowX:'auto', paddingBottom:4, scrollbarWidth:'none' }}>
          {villas.map((v, i) => (
            <div key={v.id} onClick={() => setSelectedVillaId(v.id)} style={{
              flexShrink:0, width:172, borderRadius:12,
              border: selectedVillaId === v.id ? '2px solid #2e7d52' : '1.5px solid #e0e0e0',
              background:'#fff', cursor:'pointer', overflow:'hidden',
              boxShadow: selectedVillaId === v.id ? '0 2px 12px rgba(46,125,82,0.15)' : '0 1px 4px rgba(0,0,0,0.06)',
              transition:'all 0.15s',
            }}>
              {/* Image placeholder */}
              <div style={{
                height:72, background:`linear-gradient(135deg, #b7d9c8 0%, #7aaba3 100%)`,
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:28,
                position:'relative',
              }}>
                {v.emoji}
                {v.occupied && (
                  <span style={{
                    position:'absolute', top:6, left:6,
                    background:'#2e7d52', color:'#fff',
                    fontSize:'0.6rem', fontWeight:700,
                    padding:'2px 7px', borderRadius:10,
                  }}>Đang hoạt động</span>
                )}
              </div>
              <div style={{ padding:'8px 10px' }}>
                <div style={{ fontWeight:700, fontSize:'0.82rem', color:'#1a2e1a', marginBottom:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{v.name}</div>
                <div style={{ fontSize:'0.72rem', color:'#777', marginBottom:4 }}>
                  🛏 {v.bedrooms} phòng
                </div>
                <div style={{ fontSize:'0.7rem', color:'#999', marginBottom:6 }}>🗂 Mã: {v.code}</div>
                <div style={{ fontSize:'0.68rem', color:'#666', display:'flex', gap:4, flexWrap:'wrap' }}>
                  <span style={{ color:'#2e7d52' }}>{v.free} trống</span>
                  <span>•</span>
                  <span style={{ color:'#f0b429' }}>{v.holds} đang giữ</span>
                  <span>•</span>
                  <span style={{ color:'#e57373' }}>{v.confirmed} đã đặt</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Calendar section ── */}
      <div style={{ margin:'8px 12px', background:'#fff', borderRadius:16, overflow:'hidden', boxShadow:'0 1px 8px rgba(0,0,0,0.06)' }}>
        {/* Cal header */}
        <div style={{ padding:'12px 14px 8px', borderBottom:'1px solid #f0f0f0' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontWeight:700, fontSize:'0.95rem', color:'#1a2e1a' }}>
                {selectedVilla?.name ?? '—'}
              </span>
              <span style={{ color:'#999', fontSize:14 }}>▾</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <button style={{
                border:'1px solid #ddd', borderRadius:8, padding:'4px 10px',
                fontSize:'0.75rem', background:'#fff', cursor:'pointer', color:'#444',
              }}>Hôm nay</button>
              <button style={{
                border:'1px solid #ddd', borderRadius:8, padding:'4px 8px',
                fontSize:'0.75rem', background:'#fff', cursor:'pointer', color:'#444',
              }}>📅</button>
              <button style={{
                border:'1px solid #ddd', borderRadius:8, padding:'4px 10px',
                fontSize:'0.75rem', background:'#fff', cursor:'pointer', color:'#444',
              }}>Bộ lọc</button>
            </div>
          </div>

          {/* Month nav */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <button onClick={prevMo} style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, padding:'0 4px' }}>‹</button>
              <span style={{ fontWeight:600, fontSize:'0.85rem', color:'#333', textTransform:'capitalize' }}>{monthLabel}</span>
              <button onClick={nextMo} style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, padding:'0 4px' }}>›</button>
            </div>
            <div style={{ display:'flex', gap:12, fontSize:'0.7rem', color:'#777' }}>
              <span style={{ display:'flex', alignItems:'center', gap:4 }}>
                <span style={{ width:10, height:10, borderRadius:2, background:'#4a9e7e', display:'inline-block' }}/>
                Đã đặt
              </span>
              <span style={{ display:'flex', alignItems:'center', gap:4 }}>
                <span style={{ width:10, height:10, borderRadius:2, background:'#f0b429', display:'inline-block' }}/>
                Đang giữ
              </span>
              <span style={{ display:'flex', alignItems:'center', gap:4 }}>
                <span style={{ width:10, height:10, borderRadius:2, background:'#e8e8e8', display:'inline-block' }}/>
                Trống
              </span>
            </div>
          </div>
        </div>

        {/* Day headers */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', borderBottom:'1px solid #f5f5f5' }}>
          {DAYS_VI.map((d, i) => (
            <div key={d} style={{
              textAlign:'center', padding:'6px 0',
              fontSize:'0.72rem', fontWeight:600,
              color: i === 6 ? '#e57373' : '#666',
            }}>{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div style={{ position:'relative' }}>
          {/* Day cells */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)' }}>
            {cells.map((day, idx) => {
              if (!day) return <div key={idx} style={{ minHeight:52, borderRight:'1px solid #f5f5f5', borderBottom:'1px solid #f5f5f5' }}/>;
              const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
              const info = dayMap[ds] ?? [];
              const isToday = ds === todayStr;
              const isSun = (firstOffset + day - 1) % 7 === 6;
              const hasBooking = info.length > 0;
              const bkStatus = info[0]?.status;

              let cellBg = '#fff';
              if (hasBooking) {
                cellBg = bkStatus === 'hold' ? 'rgba(240,180,41,0.08)' : 'rgba(74,158,126,0.08)';
              }

              return (
                <div key={ds} style={{
                  minHeight:52, borderRight:'1px solid #f5f5f5', borderBottom:'1px solid #f5f5f5',
                  background: cellBg, position:'relative', padding:'4px 2px 2px',
                  cursor:'pointer',
                }}>
                  <span style={{
                    display:'inline-flex', alignItems:'center', justifyContent:'center',
                    width:22, height:22, borderRadius:'50%',
                    background: isToday ? '#2e7d52' : 'transparent',
                    color: isToday ? '#fff' : isSun ? '#e57373' : '#333',
                    fontSize:'0.75rem', fontWeight: isToday ? 700 : 400,
                    marginLeft:2,
                  }}>{day}</span>
                </div>
              );
            })}
          </div>

          {/* Booking bars overlay */}
          <div style={{ position:'absolute', inset:0, pointerEvents:'none' }}>
            {bars.map(({ bk, startDay, endDay }) => {
              // Calculate position
              const startIdx = firstOffset + startDay - 1;
              const endIdx   = firstOffset + endDay - 1;
              const startRow = Math.floor(startIdx / 7);
              const endRow   = Math.floor(endIdx / 7);

              return Array.from({ length: endRow - startRow + 1 }, (_, rowOffset) => {
                const row = startRow + rowOffset;
                const colStart = rowOffset === 0 ? startIdx % 7 : 0;
                const colEnd   = rowOffset === endRow - startRow ? endIdx % 7 : 6;
                const colSpan  = colEnd - colStart + 1;
                const cellH = 52;
                const barH = 22;
                const barTop = row * cellH + 26; // below day number
                const cellW = 100 / 7;
                const left = `${cellW * colStart + (rowOffset === 0 ? 1 : 0)}%`;
                const width = `${cellW * colSpan - (rowOffset === 0 ? 2 : 1)}%`;
                const isStart = rowOffset === 0;
                const isEnd   = rowOffset === endRow - startRow;

                const saleName = bk.customer ?? '';
                const salePhone = bk.phone ?? '';
                const isHold = bk.status === 'hold';

                return (
                  <div key={`${bk.id}-${row}`} style={{
                    position:'absolute',
                    top: barTop,
                    left, width, height: barH,
                    background: barBg(bk.status),
                    opacity: 0.92,
                    borderRadius: isStart && isEnd ? 5 : isStart ? '5px 0 0 5px' : isEnd ? '0 5px 5px 0' : 0,
                    display:'flex', alignItems:'center',
                    padding: isStart ? '0 6px' : '0 4px',
                    overflow:'hidden',
                    pointerEvents:'all', cursor:'pointer',
                  }}>
                    {isStart && (
                      <div style={{ display:'flex', alignItems:'center', gap:4, overflow:'hidden', flex:1, minWidth:0 }}>
                        {isHold && <span style={{ fontSize:11, flexShrink:0 }}>👤</span>}
                        <div style={{ minWidth:0, overflow:'hidden' }}>
                          <div style={{
                            fontSize:'0.68rem', fontWeight:700,
                            color: isHold ? '#7a4f00' : '#1a4a35',
                            whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                          }}>
                            {isHold ? `HOLD • ${saleName}` : saleName}
                          </div>
                          {salePhone && (
                            <div style={{
                              fontSize:'0.6rem', color: isHold ? '#8a5f00' : '#2d6b4f',
                              whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                            }}>
                              Sale: {saleName} • {salePhone}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {isEnd && !isStart && (
                      <div style={{ marginLeft:'auto', display:'flex', alignItems:'center' }}>
                        {isHold
                          ? <span style={{ fontSize:13, opacity:0.8 }}>⏱</span>
                          : <span style={{ fontSize:13 }}>✅</span>
                        }
                      </div>
                    )}
                    {isStart && isEnd && (
                      <div style={{ marginLeft:'auto', flexShrink:0 }}>
                        {isHold
                          ? <span style={{ fontSize:12 }}>⏱</span>
                          : <span style={{ fontSize:12 }}>✅</span>
                        }
                      </div>
                    )}
                  </div>
                );
              });
            })}
          </div>
        </div>

        {/* Swipe hint */}
        <div style={{ textAlign:'center', padding:'8px 0 10px', fontSize:'0.72rem', color:'#bbb', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
          <span>↕</span>
          <span>Kéo sang trái / phải để xem tháng khác</span>
        </div>
      </div>

      {/* ── Yêu cầu giữ phòng ── */}
      {holdRequests.length > 0 && (
        <div style={{ margin:'8px 12px 0' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <h2 style={{ fontSize:'0.95rem', fontWeight:700, color:'#1a2e1a', margin:0 }}>
                Yêu cầu giữ phòng
              </h2>
              <span style={{
                background:'#2e7d52', color:'#fff',
                borderRadius:'50%', width:20, height:20,
                fontSize:'0.68rem', fontWeight:700,
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>{holdRequests.length}</span>
            </div>
            <Link href="/owner/holds" style={{ fontSize:'0.78rem', color:'#2e7d52', textDecoration:'none' }}>
              Xem tất cả ›
            </Link>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {holdRequests.slice(0, 5).map(h => (
              <div key={h.id} style={{
                background:'#fff', borderRadius:12,
                border:'1.5px solid #f0f0f0',
                padding:'12px 14px',
                boxShadow:'0 1px 4px rgba(0,0,0,0.05)',
              }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:6 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:18 }}>👤</span>
                    <div>
                      <div style={{ fontWeight:700, fontSize:'0.85rem', color:'#f0b429' }}>
                        HOLD • {h.saleName}
                      </div>
                      <div style={{ fontSize:'0.72rem', color:'#888', marginTop:1 }}>
                        {formatDate(h.checkin)} – {formatDate(h.checkout)} • {h.nights} đêm • Phòng: Nguyên căn
                      </div>
                      <div style={{ fontSize:'0.72rem', color:'#888' }}>
                        Sale: {h.saleName} • {h.phone || '—'}
                      </div>
                    </div>
                  </div>
                  <span style={{
                    background:'#e8f5e9', color:'#2e7d52',
                    fontSize:'0.65rem', fontWeight:700,
                    padding:'2px 8px', borderRadius:10, whiteSpace:'nowrap',
                  }}>Mới</span>
                </div>
                <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:4 }}>
                  <button style={{
                    flex:1, padding:'7px 0', border:'1.5px solid #e57373',
                    borderRadius:8, background:'#fff', color:'#e57373',
                    fontSize:'0.82rem', fontWeight:600, cursor:'pointer',
                  }}>Từ chối</button>
                  <button style={{
                    flex:1, padding:'7px 0', border:'1.5px solid #2e7d52',
                    borderRadius:8, background:'#fff', color:'#2e7d52',
                    fontSize:'0.82rem', fontWeight:600, cursor:'pointer',
                  }}>Duyệt</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

'use client';
// ╔══════════════════════════════════════════════════════════════╗
// ║  VillaOS v7 — hooks/useBookingsRealtime.ts                  ║
// ║  Realtime calendar updates via Supabase channel             ║
// ╚══════════════════════════════════════════════════════════════╝

import { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { mapBooking } from '@/types/database';
import type { Booking, BookingRow } from '@/types/database';

export function useBookingsRealtime(villaId: string, initialBookings: Booking[] = []) {
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const sb = getSupabaseBrowserClient();

  useEffect(() => {
    setBookings(initialBookings);
  }, [initialBookings]);

  useEffect(() => {
    if (!villaId) return;

    const channel = sb
      .channel(`bookings:${villaId}`)
      .on('postgres_changes', {
        event:  '*',
        schema: 'public',
        table:  'bookings',
        filter: `villa_id=eq.${villaId}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setBookings(prev => [...prev, mapBooking(payload.new as BookingRow)]);
        } else if (payload.eventType === 'UPDATE') {
          setBookings(prev => prev.map(b =>
            b.id === payload.new.id ? mapBooking(payload.new as BookingRow) : b
          ));
        } else if (payload.eventType === 'DELETE') {
          setBookings(prev => prev.filter(b => b.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => { sb.removeChannel(channel); };
  }, [villaId, sb]);

  return bookings;
}

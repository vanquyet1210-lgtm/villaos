-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  VillaOS v7.1 — supabase/schema_patch.sql                      ║
-- ║  PATCH — chạy sau schema.sql ban đầu                           ║
-- ║  Fixes: multi-tenant bookings + audit_logs                     ║
-- ╚══════════════════════════════════════════════════════════════════╝


-- ══════════════════════════════════════════════════════════════════
-- PATCH 1: Thêm owner_id vào bảng bookings
-- ── Tại sao? ─────────────────────────────────────────────────────
-- Hiện tại: bookings chỉ có villa_id → để query "tất cả bookings
-- của owner X" phải JOIN qua villas → chậm + phức tạp khi scale.
-- Với owner_id trực tiếp:
--   • Dashboard analytics: 1 query thẳng, không JOIN
--   • RLS đơn giản hơn, index hiệu quả hơn
--   • Multi-tenant isolation chặt hơn
-- ══════════════════════════════════════════════════════════════════

-- 1a. Thêm cột owner_id vào bookings
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES profiles(id);

-- 1b. Backfill owner_id từ villas (cho data cũ)
UPDATE bookings b
SET owner_id = v.owner_id
FROM villas v
WHERE b.villa_id = v.id
  AND b.owner_id IS NULL;

-- 1c. Đặt NOT NULL sau khi backfill xong
ALTER TABLE bookings
  ALTER COLUMN owner_id SET NOT NULL;

-- 1d. Index cho analytics queries
CREATE INDEX IF NOT EXISTS bookings_owner_idx ON bookings(owner_id);
CREATE INDEX IF NOT EXISTS bookings_owner_status_idx ON bookings(owner_id, status);
CREATE INDEX IF NOT EXISTS bookings_owner_month_idx  ON bookings(owner_id, checkin);


-- 1e. Trigger: tự động set owner_id khi INSERT booking
--     → không cần client truyền lên, không thể fake
CREATE OR REPLACE FUNCTION set_booking_owner_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  SELECT owner_id INTO NEW.owner_id
  FROM villas
  WHERE id = NEW.villa_id;

  IF NEW.owner_id IS NULL THEN
    RAISE EXCEPTION 'Villa % không tồn tại hoặc không có owner', NEW.villa_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_set_owner ON bookings;
CREATE TRIGGER bookings_set_owner
  BEFORE INSERT ON bookings
  FOR EACH ROW EXECUTE FUNCTION set_booking_owner_id();


-- 1f. Cập nhật RLS policies cho bookings (thêm owner_id filter)
-- Drop policy cũ và recreate với owner_id
DROP POLICY IF EXISTS "bookings: owner sees villa bookings" ON bookings;

CREATE POLICY "bookings: owner sees villa bookings"
  ON bookings FOR ALL
  USING (
    current_user_role() = 'owner' AND owner_id = auth.uid()
  );

-- Thêm index cho RLS performance
CREATE INDEX IF NOT EXISTS bookings_owner_uid_idx
  ON bookings(owner_id)
  WHERE owner_id IS NOT NULL;


-- ══════════════════════════════════════════════════════════════════
-- PATCH 2: Bảng audit_logs
-- ── Ghi lại mọi thay đổi quan trọng: ai làm gì, khi nào, trên gì
-- ── Không thể xóa (append-only), chỉ admin mới đọc được tất cả
-- ══════════════════════════════════════════════════════════════════

CREATE TYPE audit_action AS ENUM (
  -- Booking actions
  'booking.created',
  'booking.confirmed',
  'booking.cancelled',
  'booking.updated',
  'booking.hold_created',
  'booking.hold_expired',
  -- Villa actions
  'villa.created',
  'villa.updated',
  'villa.deleted',
  'villa.date_locked',
  'villa.date_unlocked',
  -- User actions
  'user.login',
  'user.logout',
  'user.registered',
  'user.created_by_admin',
  'user.deleted',
  -- Sale access
  'sale.access_granted',
  'sale.access_revoked'
);

CREATE TABLE audit_logs (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Ai thực hiện
  actor_id    UUID         REFERENCES profiles(id) ON DELETE SET NULL,
  actor_role  user_role,
  actor_name  TEXT,                    -- snapshot tên lúc đó (tránh mất khi xóa user)
  -- Hành động
  action      audit_action NOT NULL,
  -- Object bị tác động
  entity_type TEXT         NOT NULL,   -- 'booking' | 'villa' | 'user'
  entity_id   TEXT         NOT NULL,   -- UUID của object
  entity_name TEXT,                    -- snapshot tên lúc đó (vd: tên villa)
  -- Data thay đổi (before/after)
  old_data    JSONB,                   -- snapshot trước khi thay đổi
  new_data    JSONB,                   -- snapshot sau khi thay đổi
  -- Context
  owner_id    UUID         REFERENCES profiles(id) ON DELETE SET NULL,
  ip_address  INET,
  user_agent  TEXT,
  -- Metadata
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()

  -- ⚠️ KHÔNG có updated_at — audit log là append-only, không bao giờ UPDATE
);

-- Indexes cho query phổ biến
CREATE INDEX audit_actor_idx     ON audit_logs(actor_id);
CREATE INDEX audit_entity_idx    ON audit_logs(entity_type, entity_id);
CREATE INDEX audit_owner_idx     ON audit_logs(owner_id);
CREATE INDEX audit_action_idx    ON audit_logs(action);
CREATE INDEX audit_created_idx   ON audit_logs(created_at DESC);
-- Composite: owner xem log của mình theo thời gian
CREATE INDEX audit_owner_time_idx ON audit_logs(owner_id, created_at DESC);


-- RLS cho audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Owner chỉ xem log liên quan tới villa/booking của mình
CREATE POLICY "audit: owner reads own"
  ON audit_logs FOR SELECT
  USING (
    current_user_role() = 'owner' AND owner_id = auth.uid()
  );

-- Sale xem log của chính mình
CREATE POLICY "audit: sale reads own actions"
  ON audit_logs FOR SELECT
  USING (
    current_user_role() = 'sale' AND actor_id = auth.uid()
  );

-- Admin đọc tất cả
CREATE POLICY "audit: admin reads all"
  ON audit_logs FOR SELECT
  USING (current_user_role() = 'admin');

-- INSERT: chỉ service role được insert (từ Server Actions)
-- Client KHÔNG bao giờ được insert trực tiếp vào audit_logs
CREATE POLICY "audit: service role insert"
  ON audit_logs FOR INSERT
  WITH CHECK (false);  -- Block tất cả client insert — chỉ service_role bypass RLS

-- KHÔNG có UPDATE, DELETE policy → append-only


-- ══════════════════════════════════════════════════════════════════
-- PATCH 3: Function helper để insert audit log
-- Dùng SECURITY DEFINER để Server Action gọi được không cần service_role
-- ══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION insert_audit_log(
  p_actor_id    UUID,
  p_actor_role  user_role,
  p_actor_name  TEXT,
  p_action      audit_action,
  p_entity_type TEXT,
  p_entity_id   TEXT,
  p_entity_name TEXT DEFAULT NULL,
  p_old_data    JSONB DEFAULT NULL,
  p_new_data    JSONB DEFAULT NULL,
  p_owner_id    UUID DEFAULT NULL,
  p_ip_address  TEXT DEFAULT NULL,
  p_user_agent  TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO audit_logs (
    actor_id, actor_role, actor_name,
    action,
    entity_type, entity_id, entity_name,
    old_data, new_data,
    owner_id,
    ip_address, user_agent
  ) VALUES (
    p_actor_id, p_actor_role, p_actor_name,
    p_action,
    p_entity_type, p_entity_id, p_entity_name,
    p_old_data, p_new_data,
    p_owner_id,
    p_ip_address::INET, p_user_agent
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

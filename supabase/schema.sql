-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  VillaOS v7 — supabase/schema.sql                              ║
-- ║  Chạy file này trong Supabase SQL Editor (một lần duy nhất)    ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- ══════════════════════════════════════════════════════════════════
-- 0. EXTENSIONS
-- ══════════════════════════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";   -- cần cho EXCLUDE constraint


-- ══════════════════════════════════════════════════════════════════
-- 1. ENUM TYPES
-- ══════════════════════════════════════════════════════════════════
CREATE TYPE user_role    AS ENUM ('admin', 'owner', 'sale', 'customer');
CREATE TYPE villa_status AS ENUM ('active', 'inactive');
CREATE TYPE booking_status AS ENUM ('confirmed', 'hold', 'cancelled');


-- ══════════════════════════════════════════════════════════════════
-- 2. PROFILES  (extends auth.users — 1:1)
--    ⚠️  role lưu ở đây, KHÔNG cho client tự ghi
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE profiles (
  id          UUID         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT         NOT NULL,
  role        user_role    NOT NULL DEFAULT 'customer',
  brand       TEXT,                         -- tên thương hiệu (owner)
  joined_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Auto-create profile khi user đăng ký qua Supabase Auth
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, name, role, brand)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'Người dùng'),
    -- role lấy từ metadata do server truyền vào lúc tạo user
    -- client KHÔNG được tự đặt role — xem service/user.service.ts
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'customer'),
    NEW.raw_user_meta_data->>'brand'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ══════════════════════════════════════════════════════════════════
-- 3. VILLAS
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE villas (
  id           UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id     UUID          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name         TEXT          NOT NULL CHECK (length(name) >= 3),
  province     TEXT          NOT NULL,
  district     TEXT          NOT NULL,
  ward         TEXT,
  street       TEXT,
  bedrooms     SMALLINT      NOT NULL CHECK (bedrooms BETWEEN 1 AND 50),
  adults       SMALLINT      NOT NULL CHECK (adults   BETWEEN 1 AND 200),
  children     SMALLINT      NOT NULL DEFAULT 0,
  price        INTEGER       NOT NULL CHECK (price >= 100000),
  amenities    TEXT[]        NOT NULL DEFAULT '{}',
  description  TEXT,
  images       TEXT[]        NOT NULL DEFAULT '{}',
  emoji        TEXT          NOT NULL DEFAULT '🏡',
  locked_dates DATE[]        NOT NULL DEFAULT '{}',
  status       villa_status  NOT NULL DEFAULT 'active',
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX villas_owner_idx  ON villas(owner_id);
CREATE INDEX villas_status_idx ON villas(status);

CREATE TRIGGER villas_updated_at
  BEFORE UPDATE ON villas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ══════════════════════════════════════════════════════════════════
-- 4. BOOKINGS
--    ⚠️  EXCLUDE constraint = không thể double-book dù client bug
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE bookings (
  id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  villa_id        UUID            NOT NULL REFERENCES villas(id) ON DELETE CASCADE,
  created_by      UUID            NOT NULL REFERENCES profiles(id),
  created_by_role user_role       NOT NULL,
  customer        TEXT            NOT NULL,
  email           TEXT,
  phone           TEXT,
  checkin         DATE            NOT NULL,
  checkout        DATE            NOT NULL CHECK (checkout > checkin),
  status          booking_status  NOT NULL DEFAULT 'confirmed',
  total           INTEGER         NOT NULL CHECK (total >= 0),
  note            TEXT,
  hold_expires_at TIMESTAMPTZ,    -- chỉ dùng khi status='hold'
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

  -- ════════════════════════════════════════════════════════════
  -- ⭐ BOOKING CONFLICT CONSTRAINT — SERVER-ENFORCED
  -- Không thể insert/update booking bị overlap với booking khác
  -- trừ khi status = 'cancelled'.
  -- Client-side validation chỉ là UX — constraint này là bảo vệ THẬT.
  -- ════════════════════════════════════════════════════════════
  CONSTRAINT no_booking_overlap EXCLUDE USING gist (
    villa_id  WITH =,
    daterange(checkin, checkout, '[)') WITH &&
  ) WHERE (status != 'cancelled')
);

CREATE INDEX bookings_villa_idx    ON bookings(villa_id);
CREATE INDEX bookings_creator_idx  ON bookings(created_by);
CREATE INDEX bookings_status_idx   ON bookings(status);
CREATE INDEX bookings_dates_idx    ON bookings USING gist (
  villa_id, daterange(checkin, checkout, '[)')
);

CREATE TRIGGER bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Tự động cancel hold hết hạn (gọi qua pg_cron hoặc Supabase Edge Function)
CREATE OR REPLACE FUNCTION expire_holds()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE bookings
  SET status = 'cancelled'
  WHERE status = 'hold'
    AND hold_expires_at < NOW();
END;
$$;


-- ══════════════════════════════════════════════════════════════════
-- 5. SALE_VILLA_ACCESS  (Owner giao villa cho Sale quản lý)
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE sale_villa_access (
  sale_id    UUID  NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  villa_id   UUID  NOT NULL REFERENCES villas(id)   ON DELETE CASCADE,
  granted_by UUID  NOT NULL REFERENCES profiles(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (sale_id, villa_id)
);


-- ══════════════════════════════════════════════════════════════════
-- 6. ROW LEVEL SECURITY (RLS)
--    ⚠️  Đây là lớp bảo vệ THẬT — không bypass được dù có API key
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE villas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_villa_access ENABLE ROW LEVEL SECURITY;


-- ── Helper function: lấy role của user hiện tại ──────────────────
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS user_role LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;


-- ── PROFILES policies ────────────────────────────────────────────
-- User chỉ đọc được profile của chính mình
CREATE POLICY "profiles: read own"
  ON profiles FOR SELECT
  USING (id = auth.uid());

-- Admin đọc tất cả
CREATE POLICY "profiles: admin read all"
  ON profiles FOR SELECT
  USING (current_user_role() = 'admin');

-- User tự update name/brand — KHÔNG được update role
CREATE POLICY "profiles: update own (no role)"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid() AND
    role = (SELECT role FROM profiles WHERE id = auth.uid())  -- role phải giữ nguyên
  );

-- Admin update tất cả (kể cả role)
CREATE POLICY "profiles: admin update all"
  ON profiles FOR UPDATE
  USING (current_user_role() = 'admin');


-- ── VILLAS policies ──────────────────────────────────────────────
-- Owner chỉ thấy villa của mình
CREATE POLICY "villas: owner sees own"
  ON villas FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Sale thấy villa được assign
CREATE POLICY "villas: sale sees assigned"
  ON villas FOR SELECT
  USING (
    current_user_role() = 'sale' AND
    id IN (SELECT villa_id FROM sale_villa_access WHERE sale_id = auth.uid())
  );

-- Customer thấy villa active (browse)
CREATE POLICY "villas: customer sees active"
  ON villas FOR SELECT
  USING (
    current_user_role() = 'customer' AND status = 'active'
  );

-- Admin thấy tất cả
CREATE POLICY "villas: admin all"
  ON villas FOR ALL
  USING (current_user_role() = 'admin');


-- ── BOOKINGS policies ────────────────────────────────────────────
-- Owner thấy booking của villa mình
CREATE POLICY "bookings: owner sees villa bookings"
  ON bookings FOR ALL
  USING (
    current_user_role() = 'owner' AND
    villa_id IN (SELECT id FROM villas WHERE owner_id = auth.uid())
  );

-- Sale thấy booking của villa được assign, chỉ insert/update (không delete)
CREATE POLICY "bookings: sale sees assigned"
  ON bookings FOR SELECT
  USING (
    current_user_role() = 'sale' AND
    villa_id IN (SELECT villa_id FROM sale_villa_access WHERE sale_id = auth.uid())
  );

CREATE POLICY "bookings: sale insert assigned"
  ON bookings FOR INSERT
  WITH CHECK (
    current_user_role() = 'sale' AND
    villa_id IN (SELECT villa_id FROM sale_villa_access WHERE sale_id = auth.uid()) AND
    created_by = auth.uid() AND
    created_by_role = 'sale'
  );

CREATE POLICY "bookings: sale update own"
  ON bookings FOR UPDATE
  USING (
    current_user_role() = 'sale' AND
    created_by = auth.uid()
  )
  WITH CHECK (
    -- Sale không được tự confirm — chỉ Owner mới confirm
    status IN ('hold', 'cancelled')
  );

-- Customer tạo booking (confirmed) và xem booking của mình
CREATE POLICY "bookings: customer insert"
  ON bookings FOR INSERT
  WITH CHECK (
    current_user_role() = 'customer' AND
    created_by = auth.uid() AND
    created_by_role = 'customer'
  );

CREATE POLICY "bookings: customer sees own"
  ON bookings FOR SELECT
  USING (
    current_user_role() = 'customer' AND
    created_by = auth.uid()
  );

-- Admin full access
CREATE POLICY "bookings: admin all"
  ON bookings FOR ALL
  USING (current_user_role() = 'admin');


-- ── SALE_VILLA_ACCESS policies ───────────────────────────────────
-- Chỉ owner villa mới grant access
CREATE POLICY "sale_access: owner manages"
  ON sale_villa_access FOR ALL
  USING (
    current_user_role() = 'owner' AND
    villa_id IN (SELECT id FROM villas WHERE owner_id = auth.uid())
  );

-- Sale tự xem mình được assign villa nào
CREATE POLICY "sale_access: sale reads own"
  ON sale_villa_access FOR SELECT
  USING (sale_id = auth.uid());

-- Admin
CREATE POLICY "sale_access: admin all"
  ON sale_villa_access FOR ALL
  USING (current_user_role() = 'admin');


-- ══════════════════════════════════════════════════════════════════
-- 7. SEED DATA (Demo accounts — chỉ dùng cho dev/staging)
--    Production: xóa block này, tạo tài khoản qua admin tool
-- ══════════════════════════════════════════════════════════════════
-- Seed users được tạo qua Supabase Auth API (xem seed.ts)
-- File này chỉ setup schema + RLS

-- ══════════════════════════════════════════════════════════════════
-- 8. REALTIME (cho calendar live update)
-- ══════════════════════════════════════════════════════════════════
ALTER PUBLICATION supabase_realtime ADD TABLE bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE villas;

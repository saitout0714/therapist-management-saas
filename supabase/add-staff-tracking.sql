-- Role expansion
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'owner', 'staff'));

-- Add display name to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;

-- Reservation attribution
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS created_by_id UUID REFERENCES users(id);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS reception_source VARCHAR(20) DEFAULT 'staff' CHECK (reception_source IN ('staff', 'client', 'therapist'));

-- Index for better filtering
CREATE INDEX IF NOT EXISTS idx_reservations_reception_source ON reservations(reception_source);
CREATE INDEX IF NOT EXISTS idx_reservations_created_by_id ON reservations(created_by_id);

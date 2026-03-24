-- 1. Rename email to login_id safely
DO $$ 
BEGIN 
  BEGIN
    ALTER TABLE users RENAME COLUMN email TO login_id;
  EXCEPTION WHEN undefined_column THEN
    NULL; -- Already renamed
  END;
END $$;

-- 2. Add name column if missing to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;

-- 3. Expand roles constraint to include 'staff'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'owner', 'staff'));

-- 4. Add staff tracking columns to reservations if missing
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS created_by_id UUID REFERENCES users(id);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS reception_source VARCHAR(20) DEFAULT 'staff' CHECK (reception_source IN ('staff', 'client', 'therapist'));

-- 5. Update index
DROP INDEX IF EXISTS idx_users_email;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_login_id ON users(login_id);
DROP INDEX IF EXISTS idx_reservations_reception_source;
CREATE INDEX IF NOT EXISTS idx_reservations_reception_source ON reservations(reception_source);

-- 6. Update admin data (ensure admin@example.com becomes admin)
UPDATE users SET login_id = 'admin' WHERE login_id = 'admin@example.com';

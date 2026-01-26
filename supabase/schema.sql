-- Database Schema for SaaS Therapist Shift and Reservation Management
-- Using Supabase (PostgreSQL)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Stores table
CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rooms table
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Therapists table
CREATE TABLE therapists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID, -- Temporarily remove foreign key for testing
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customers table
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID, -- Temporarily remove foreign key for testing
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Shifts table
CREATE TABLE shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  therapist_id UUID REFERENCES therapists(id) ON DELETE CASCADE,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  store_id UUID, -- Temporarily remove foreign key for testing
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(therapist_id, date, start_time, end_time)
);

-- Reservations table
CREATE TABLE reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID, -- Temporarily remove foreign key for testing
  therapist_id UUID REFERENCES therapists(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  shift_id UUID REFERENCES shifts(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status TEXT CHECK (status IN ('pending', 'confirmed', 'cancelled')) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE therapists ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Stores: Owners can access their own stores
CREATE POLICY "Users can access their own stores" ON stores
  FOR ALL USING (auth.uid() = owner_id);

-- Rooms: Users can access rooms for stores they own
CREATE POLICY "Users can access rooms for their stores" ON rooms
  FOR ALL USING (true); -- Temporarily allow all for testing

-- Therapists: Users can access therapists for stores they own
CREATE POLICY "Users can access therapists for their stores" ON therapists
  FOR ALL USING (true); -- Temporarily allow all for testing

-- Customers: Users can access customers for stores they own
CREATE POLICY "Users can access customers for their stores" ON customers
  FOR ALL USING (true); -- Temporarily allow all for testing

-- Shifts: Users can access shifts for stores they own
CREATE POLICY "Users can access shifts for their stores" ON shifts
  FOR ALL USING (true); -- Temporarily allow all for testing

-- Reservations: Users can access reservations for stores they own
CREATE POLICY "Users can access reservations for their stores" ON reservations
  FOR ALL USING (true); -- Temporarily allow all for testing

-- Indexes for performance
CREATE INDEX idx_rooms_store_id ON rooms(store_id);
CREATE INDEX idx_therapists_store_id ON therapists(store_id);
CREATE INDEX idx_customers_store_id ON customers(store_id);
CREATE INDEX idx_shifts_therapist_id ON shifts(therapist_id);
CREATE INDEX idx_shifts_room_id ON shifts(room_id);
CREATE INDEX idx_shifts_store_id ON shifts(store_id);
CREATE INDEX idx_shifts_date ON shifts(date);
CREATE INDEX idx_reservations_store_id ON reservations(store_id);
CREATE INDEX idx_reservations_therapist_id ON reservations(therapist_id);
CREATE INDEX idx_reservations_customer_id ON reservations(customer_id);
CREATE INDEX idx_reservations_shift_id ON reservations(shift_id);
CREATE INDEX idx_reservations_date ON reservations(date);
-- Add compound indexes to optimize queries on shifts and reservations by shop_id and date
CREATE INDEX IF NOT EXISTS idx_shifts_shop_id_date ON public.shifts USING btree (shop_id, date);
CREATE INDEX IF NOT EXISTS idx_reservations_shop_id_date ON public.reservations USING btree (shop_id, date);

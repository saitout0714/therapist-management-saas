-- Add order column to therapists table
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS "order" INTEGER DEFAULT 0;

-- Update existing therapists with sequential order numbers
WITH ordered_therapists AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) - 1 as new_order
  FROM therapists
)
UPDATE therapists
SET "order" = ordered_therapists.new_order
FROM ordered_therapists
WHERE therapists.id = ordered_therapists.id;

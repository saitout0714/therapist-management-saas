-- Add ng_course_ids column to therapists table
ALTER TABLE therapists
ADD COLUMN ng_course_ids UUID[] DEFAULT '{}';

-- Update existing rows to have empty array instead of null (optional but good practice)
UPDATE therapists SET ng_course_ids = '{}' WHERE ng_course_ids IS NULL;

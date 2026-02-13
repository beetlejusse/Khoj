CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE places 
ADD COLUMN IF NOT EXISTS location GEOMETRY(Point, 4326); 

-- Populate location column from existing lat/lng data
UPDATE places 
SET location = ST_SetSRID(ST_MakePoint(lng, lat), 4326)
WHERE lat IS NOT NULL AND lng IS NOT NULL;

CREATE INDEX IF NOT EXISTS places_location_idx 
ON places USING GIST (location);

CREATE OR REPLACE FUNCTION update_place_location()
RETURNS trigger AS $$
BEGIN
    IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
        NEW.location := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_place_location_trigger ON places;
CREATE TRIGGER update_place_location_trigger
BEFORE INSERT OR UPDATE ON places
FOR EACH ROW
EXECUTE FUNCTION update_place_location();

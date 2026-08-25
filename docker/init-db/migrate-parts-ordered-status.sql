-- One-off migration for the ALREADY-DEPLOYED live database.
--
-- The "Parts Ordered" repair status was replaced with "Hold - Parts" and
-- "Hold - Customer" (a hold can now be attributed to either side). Existing
-- rows still have the old value, which is no longer in the app's
-- REPAIR_STATUSES list, so they'd show up unselectable in the status
-- dropdown/filter.
--
-- Run it once against the live database, e.g.:
--   docker exec -it lcc-mariadb mariadb -u root -p repair_shop
--   source /tmp/migrate-parts-ordered-status.sql;
--
-- Safe to run more than once -- it's a no-op once no rows match.

UPDATE repairs SET status = 'Hold - Parts' WHERE status = 'Parts Ordered';

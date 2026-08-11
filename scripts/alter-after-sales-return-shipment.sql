-- Add return_shipment to existing DBs (safe to re-run: ignores duplicate column)
ALTER TABLE after_sales
  ADD COLUMN return_shipment JSON NULL AFTER escalated_at;

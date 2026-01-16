-- Add IOU points to users and keep them updated for funded loans

ALTER TABLE users
  ADD COLUMN iou_points DECIMAL(18, 6) NOT NULL DEFAULT 0,
  ADD COLUMN iou_points_updated_at TIMESTAMPTZ;

-- Backfill IOU points for existing funded loans
UPDATE users
SET iou_points = COALESCE(points.total_points, 0),
    iou_points_updated_at = NOW()
FROM (
  SELECT lender_user_id, SUM(loan_amount * 2) AS total_points
  FROM loans
  WHERE lender_user_id IS NOT NULL
    AND (loan_status = 'Lent' OR funded_at IS NOT NULL)
  GROUP BY lender_user_id
) AS points
WHERE users.id = points.lender_user_id;

UPDATE users
SET iou_points = 0,
    iou_points_updated_at = NOW()
WHERE id NOT IN (
  SELECT DISTINCT lender_user_id
  FROM loans
  WHERE lender_user_id IS NOT NULL
    AND (loan_status = 'Lent' OR funded_at IS NOT NULL)
);

-- Recompute IOU points for a user or all users
CREATE OR REPLACE FUNCTION recompute_iou_points(target_user_id UUID DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
  UPDATE users
  SET iou_points = COALESCE(points.total_points, 0),
      iou_points_updated_at = NOW()
  FROM (
    SELECT lender_user_id, SUM(loan_amount * 2) AS total_points
    FROM loans
    WHERE lender_user_id IS NOT NULL
      AND (loan_status = 'Lent' OR funded_at IS NOT NULL)
      AND (target_user_id IS NULL OR lender_user_id = target_user_id)
    GROUP BY lender_user_id
  ) AS points
  WHERE users.id = points.lender_user_id
    AND (target_user_id IS NULL OR users.id = target_user_id);

  IF target_user_id IS NOT NULL THEN
    UPDATE users
    SET iou_points = 0,
        iou_points_updated_at = NOW()
    WHERE id = target_user_id
      AND id NOT IN (
        SELECT lender_user_id
        FROM loans
        WHERE lender_user_id IS NOT NULL
          AND (loan_status = 'Lent' OR funded_at IS NOT NULL)
          AND lender_user_id = target_user_id
      );
  ELSE
    UPDATE users
    SET iou_points = 0,
        iou_points_updated_at = NOW()
    WHERE id NOT IN (
      SELECT lender_user_id
      FROM loans
      WHERE lender_user_id IS NOT NULL
        AND (loan_status = 'Lent' OR funded_at IS NOT NULL)
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Increment IOU points once when a loan is funded
CREATE OR REPLACE FUNCTION increment_iou_points_on_funding()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lender_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF (TG_OP = 'INSERT' AND (NEW.loan_status = 'Lent' OR NEW.funded_at IS NOT NULL))
     OR (TG_OP = 'UPDATE' AND (
       (OLD.funded_at IS NULL AND NEW.funded_at IS NOT NULL)
       OR (OLD.loan_status IS DISTINCT FROM NEW.loan_status AND NEW.loan_status = 'Lent')
     )) THEN
    UPDATE users
    SET iou_points = iou_points + (NEW.loan_amount * 2),
        iou_points_updated_at = NOW()
    WHERE id = NEW.lender_user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_increment_iou_points_on_funding ON loans;
CREATE TRIGGER trigger_increment_iou_points_on_funding
AFTER INSERT OR UPDATE ON loans
FOR EACH ROW
EXECUTE FUNCTION increment_iou_points_on_funding();

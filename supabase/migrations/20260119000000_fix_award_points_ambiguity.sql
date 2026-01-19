CREATE OR REPLACE FUNCTION award_points(
  user_id_input UUID,
  source_type_input TEXT,
  source_id_input UUID,
  event_type_input TEXT,
  delta_input BIGINT,
  metadata_input JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  applied BOOLEAN,
  event_id BIGINT,
  points_total BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_event_id BIGINT;
  updated_total BIGINT;
BEGIN
  INSERT INTO point_events (user_id, event_type, delta, source_type, source_id, metadata)
  VALUES (user_id_input, event_type_input, delta_input, source_type_input, source_id_input, metadata_input)
  ON CONFLICT (user_id, source_type, source_id, event_type) DO NOTHING
  RETURNING id INTO inserted_event_id;

  IF inserted_event_id IS NOT NULL THEN
    INSERT INTO user_points (user_id, points_total, updated_at, last_event_id)
    VALUES (user_id_input, delta_input, NOW(), inserted_event_id)
    ON CONFLICT (user_id) DO UPDATE
      SET points_total = user_points.points_total + EXCLUDED.points_total,
          updated_at = NOW(),
          last_event_id = EXCLUDED.last_event_id;
  ELSE
    INSERT INTO user_points (user_id, points_total, updated_at)
    VALUES (user_id_input, 0, NOW())
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  SELECT up.points_total
  INTO updated_total
  FROM public.user_points AS up
  WHERE up.user_id = user_id_input;

  RETURN QUERY
    SELECT inserted_event_id IS NOT NULL,
      inserted_event_id,
      COALESCE(updated_total, 0);
END;
$$;

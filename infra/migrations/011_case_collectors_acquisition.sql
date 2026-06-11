-- M23: 情報収集者・情報入手場所（docs/05-data-model join tables）

ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS acquisition_location_id UUID REFERENCES acquisition_locations (id);

CREATE TABLE IF NOT EXISTS case_collectors (
  case_id UUID NOT NULL REFERENCES cases (id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES persons (id),
  PRIMARY KEY (case_id, person_id)
);

CREATE INDEX IF NOT EXISTS idx_case_collectors_person ON case_collectors (person_id);

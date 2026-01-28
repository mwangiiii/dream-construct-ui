-- 06_worker_roles_enum.sql
create type worker_role as enum (
  'mason',
  'carpenter',
  'electrician',
  'plumber',
  'painter',
  'welder',
  'laborer'
);

create type worker_status as enum (
  'active',
  'inactive'
); 

create type attendance_status as enum (
  'present',
  'absent',
  'late',
  'on_leave'
);

create type assignment_status as enum (
  'assigned',
  'in_progress',
  'completed',
  'delayed'
);
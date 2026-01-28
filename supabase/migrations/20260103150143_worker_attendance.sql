-- daily attendance records. 

create table worker_attendance (
    id uuid primary key default gen_random_uuid(),
    worker_id uuid not null references workers(id) on delete cascade,
    attendance_date date not null, 
    check_in time,
    check_out time,
    status attendance_status default 'absent' not null, 
    notes text,

   -- Calculated hours worked (in hours, decimal)
  hours_worked numeric(5,2) generated always as (
    case
      when check_in is not null and check_out is not null
      then round((extract(epoch from (check_out - check_in)) / 3600)::numeric, 2)
      else null
    end
  ) stored,
    created_at timestamp default now() not null, 
    updated_at timestamp default now() not null,
    created_by uuid references auth.users(id) default auth.uid() not null
);


--we should have one record per worker per day
alter table worker_attendance
    add constraint uq_worker_attendance_date unique (worker_id, attendance_date);

--indexes for performance
create index idx_worker_attendance_worker_id on worker_attendance(worker_id);
create index idx_worker_attendance_attendance_date on worker_attendance(attendance_date);
create index idx_worker_attendance_status on worker_attendance(status);
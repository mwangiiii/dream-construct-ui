create table workers (
    id uuid primary key default gen_random_uuid(),
    full_name text not null, 
    role worker_role not null,
    phone text, 
    id_number text,
    address text, 
    status worker_status default 'active' not null, 
    created_at timestampz default now() not null,
    updated_at timestampz default now() not null, 
    created_by uuid references auth.users(id) default auth.uid() not null
);

alter table workers
    add constraint unique_workers_id_number unique (id_number);

alter table workers
    add constraint unique_workers_phone unique (phone);

-- indexes for performance
create index idx_workers_full_name on workers(full_name);
create index idx_workers_role on workers(role);
create index idx_workers_status on workers(status);
create index idx_workers_created_by on workers(created_by);
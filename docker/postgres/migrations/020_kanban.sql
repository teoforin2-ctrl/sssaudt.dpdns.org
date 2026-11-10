-- Internal Kanban (admin + developer)

begin;

create table if not exists kanban_boards (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  color text not null default '#0f6e56',
  owner_id uuid references users(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists kanban_columns (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references kanban_boards(id) on delete cascade,
  title text not null,
  position int not null default 0,
  wip_limit int,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists kanban_columns_board_idx on kanban_columns(board_id, position);

create table if not exists kanban_sprints (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references kanban_boards(id) on delete cascade,
  name text not null,
  goal text,
  starts_on date,
  ends_on date,
  status text not null default 'planned' check (status in ('planned', 'active', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists kanban_sprints_board_idx on kanban_sprints(board_id);

create table if not exists kanban_labels (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references kanban_boards(id) on delete cascade,
  name text not null,
  color text not null default '#6b4ea8',
  created_at timestamptz not null default now()
);
create index if not exists kanban_labels_board_idx on kanban_labels(board_id);

create table if not exists kanban_cards (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references kanban_boards(id) on delete cascade,
  column_id uuid not null references kanban_columns(id) on delete cascade,
  title text not null,
  description text,
  position int not null default 0,
  priority text not null default 'none'
    check (priority in ('none', 'low', 'med', 'high', 'urgent')),
  due_at timestamptz,
  start_at timestamptz,
  sprint_id uuid references kanban_sprints(id) on delete set null,
  cover_color text,
  created_by uuid references users(id) on delete set null,
  archived_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists kanban_cards_column_idx on kanban_cards(column_id, position);
create index if not exists kanban_cards_board_idx on kanban_cards(board_id);
create index if not exists kanban_cards_due_idx on kanban_cards(due_at);
create index if not exists kanban_cards_sprint_idx on kanban_cards(sprint_id);

create table if not exists kanban_card_assignees (
  card_id uuid not null references kanban_cards(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  primary key (card_id, user_id)
);

create table if not exists kanban_card_labels (
  card_id uuid not null references kanban_cards(id) on delete cascade,
  label_id uuid not null references kanban_labels(id) on delete cascade,
  primary key (card_id, label_id)
);

create table if not exists kanban_checklists (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references kanban_cards(id) on delete cascade,
  title text not null default 'Checklist',
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists kanban_checklists_card_idx on kanban_checklists(card_id, position);

create table if not exists kanban_checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references kanban_checklists(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  position int not null default 0,
  assignee_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists kanban_checklist_items_idx on kanban_checklist_items(checklist_id, position);

create table if not exists kanban_comments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references kanban_cards(id) on delete cascade,
  author_id uuid references users(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists kanban_comments_card_idx on kanban_comments(card_id, created_at);

create table if not exists kanban_attachments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references kanban_cards(id) on delete cascade,
  url text not null,
  name text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists kanban_attachments_card_idx on kanban_attachments(card_id);

create table if not exists kanban_activity (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references kanban_boards(id) on delete cascade,
  card_id uuid references kanban_cards(id) on delete set null,
  actor_id uuid references users(id) on delete set null,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists kanban_activity_board_idx on kanban_activity(board_id, created_at desc);
create index if not exists kanban_activity_card_idx on kanban_activity(card_id, created_at desc);

create table if not exists kanban_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  board_id uuid references kanban_boards(id) on delete cascade,
  card_id uuid references kanban_cards(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists kanban_notifications_user_idx
  on kanban_notifications(user_id, created_at desc);

-- Seed demo board (idempotent by title + not archived)
do $$
declare
  v_owner uuid;
  v_board uuid;
  v_backlog uuid;
  v_doing uuid;
  v_review uuid;
  v_done uuid;
  v_sprint uuid;
  v_label1 uuid;
  v_label2 uuid;
  v_card1 uuid;
  v_card2 uuid;
  v_cl uuid;
begin
  select id into v_owner from users where email in ('edmccain@casino-review.local', 'admin@casino-review.local') order by case when email like 'edmccain%' then 0 else 1 end limit 1;

  select id into v_board from kanban_boards where title = 'Product' and archived_at is null limit 1;
  if v_board is null then
    insert into kanban_boards (title, description, color, owner_id)
    values ('Product', 'Внутренняя доска разработки SS Audit', '#0f6e56', v_owner)
    returning id into v_board;

    insert into kanban_columns (board_id, title, position) values
      (v_board, 'Backlog', 0),
      (v_board, 'Doing', 1),
      (v_board, 'Review', 2),
      (v_board, 'Done', 3);

    select id into v_backlog from kanban_columns where board_id = v_board and title = 'Backlog' limit 1;
    select id into v_doing from kanban_columns where board_id = v_board and title = 'Doing' limit 1;
    select id into v_review from kanban_columns where board_id = v_board and title = 'Review' limit 1;
    select id into v_done from kanban_columns where board_id = v_board and title = 'Done' limit 1;

    insert into kanban_sprints (board_id, name, goal, starts_on, ends_on, status)
    values (v_board, 'Sprint 1', 'Kanban MVP', current_date, current_date + 14, 'active')
    returning id into v_sprint;

    insert into kanban_labels (board_id, name, color) values
      (v_board, 'bug', '#9b1c1c'),
      (v_board, 'feature', '#0f6e56'),
      (v_board, 'ops', '#6b4ea8');

    select id into v_label1 from kanban_labels where board_id = v_board and name = 'feature' limit 1;
    select id into v_label2 from kanban_labels where board_id = v_board and name = 'bug' limit 1;

    insert into kanban_cards (board_id, column_id, title, description, position, priority, due_at, sprint_id, created_by, cover_color)
    values
      (v_board, v_doing, 'Довести канбан до продакшена', 'Проверить DnD, спринты, ассигны.', 0, 'high', now() + interval '3 days', v_sprint, v_owner, '#d7f0e6'),
      (v_board, v_backlog, 'Полировка SEO JSON-LD', null, 0, 'med', now() + interval '7 days', v_sprint, v_owner, null),
      (v_board, v_backlog, 'Мок payout provider', 's3-payout blocker', 1, 'urgent', now() + interval '2 days', null, v_owner, null),
      (v_board, v_review, 'Юридические страницы', 'Legal MVP без юриста — потом ревью', 0, 'low', null, v_sprint, v_owner, null),
      (v_board, v_done, 'Роль developer', 'edmccain / admin rights', 0, 'none', null, v_sprint, v_owner, null);

    select id into v_card1 from kanban_cards where board_id = v_board and title = 'Довести канбан до продакшена' limit 1;
    select id into v_card2 from kanban_cards where board_id = v_board and title = 'Мок payout provider' limit 1;


    if v_owner is not null then
      insert into kanban_card_assignees (card_id, user_id) values (v_card1, v_owner) on conflict do nothing;
      insert into kanban_card_assignees (card_id, user_id) values (v_card2, v_owner) on conflict do nothing;
    end if;

    insert into kanban_card_labels (card_id, label_id) values (v_card1, v_label1) on conflict do nothing;
    insert into kanban_card_labels (card_id, label_id) values (v_card2, v_label2) on conflict do nothing;

    insert into kanban_checklists (card_id, title, position)
    values (v_card1, 'Acceptance', 0)
    returning id into v_cl;

    insert into kanban_checklist_items (checklist_id, title, done, position) values
      (v_cl, 'Доски + колонки CRUD', true, 0),
      (v_cl, 'DnD карточек', false, 1),
      (v_cl, 'Спринты и фильтры', false, 2);

    insert into kanban_activity (board_id, card_id, actor_id, type, payload)
    values (v_board, v_card1, v_owner, 'board_seeded', '{"note":"demo board created"}'::jsonb);
  end if;
end $$;

commit;

-- ── Nobi: plans and AI usage metering ───────────────────────────────────────
-- Nobi's costs scale with AI use, not with how many notebooks someone keeps,
-- so that is what the free tier meters. Handwriting, notes, notebooks and
-- pages stay unlimited: they cost nothing to provide, and a student who hits
-- a wall in their first week never reaches the part worth paying for.

-- ── Entitlements ────────────────────────────────────────────────────────────
-- One row per paying user. A missing row means free, so nothing has to be
-- created at signup and a failed lookup degrades to the free tier rather than
-- to unlimited.
create table if not exists public.entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  -- When the paid period lapses. Null for free.
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.entitlements enable row level security;

-- Readable by its owner so the app can show what plan they are on. There is
-- deliberately no insert, update or delete policy: only the service role
-- writes here, which is what stops someone granting themselves a plan.
create policy "entitlements_select_own" on public.entitlements
  for select using (auth.uid() = user_id);

-- ── AI usage ────────────────────────────────────────────────────────────────
-- One row per AI action. Events rather than a counter: a counter cannot say
-- what was used or when, so it cannot answer a billing question, spot abuse,
-- or survive a change to what counts as an action.
create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('study_guide', 'condense', 'transcribe', 'ask')),
  created_at timestamptz not null default now()
);

-- The meter is always read as "this user, this month".
create index if not exists ai_usage_user_time_idx on public.ai_usage (user_id, created_at desc);

alter table public.ai_usage enable row level security;

-- Owners can read their own usage so the app can show what is left. Again no
-- write policies: if a user could insert or delete here they could reset
-- their own meter, which is the whole thing this table is for.
create policy "ai_usage_select_own" on public.ai_usage
  for select using (auth.uid() = user_id);

-- ── Atomic meter ────────────────────────────────────────────────────────────
-- Counting and then inserting leaves a race: two requests in flight together
-- both read the same count and both pass. Putting both steps in one function
-- is not enough on its own, so the function also takes a per-user lock (see
-- below) — a limit is then a limit even under a double-tapped button or a
-- flaky connection retrying.
--
-- Returns the number of actions used this month *including* this one, or -1
-- when the limit was already reached and nothing was recorded.
create or replace function public.consume_ai_action(
  p_user_id uuid,
  p_action text,
  p_limit integer
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text;
  v_period_end timestamptz;
  v_used integer;
begin
  -- Serialise this user's calls. Without it, the count and insert below are
  -- not atomic: at READ COMMITTED two concurrent calls both read 14, both
  -- pass, and both insert. A per-user transaction lock queues the second
  -- until the first commits, so it sees 15 and is refused. Keyed per user so
  -- one student's request never waits on another's.
  perform pg_advisory_xact_lock(hashtext('ai_usage:' || p_user_id::text));

  select plan, current_period_end into v_plan, v_period_end
  from public.entitlements where user_id = p_user_id;

  -- Paid and current: record it and skip the ceiling.
  if v_plan = 'pro' and (v_period_end is null or v_period_end > now()) then
    insert into public.ai_usage (user_id, action) values (p_user_id, p_action);
    select count(*) into v_used from public.ai_usage
     where user_id = p_user_id and created_at >= date_trunc('month', now());
    return v_used;
  end if;

  select count(*) into v_used from public.ai_usage
   where user_id = p_user_id and created_at >= date_trunc('month', now());

  if v_used >= p_limit then
    return -1;
  end if;

  insert into public.ai_usage (user_id, action) values (p_user_id, p_action);
  return v_used + 1;
end;
$$;

-- Callable only by the server, which is where the caller's identity has
-- already been verified. A definer function reachable by anon would let
-- anyone meter anyone.
revoke all on function public.consume_ai_action(uuid, text, integer) from public, anon, authenticated;

-- Revoking from public can take execute away from the server's own role as
-- well, which would disable the meter without an error anyone sees. Grant it
-- back explicitly to the one role meant to call this.
grant execute on function public.consume_ai_action(uuid, text, integer) to service_role;

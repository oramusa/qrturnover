-- Enforce the same paid/trial entitlement rule at the database boundary.
-- The app redirect improves UX; these RLS changes prevent an expired host
-- from bypassing the UI and calling Supabase directly.

create or replace function public.current_host_has_product_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.hosts h
    where h.id = (select auth.uid())
      and (
        h.subscription_status = 'active'
        or (
          h.subscription_status = 'trialing'
          and h.trial_ends_at is not null
          and h.trial_ends_at > now()
        )
      )
  );
$$;

revoke all on function public.current_host_has_product_access() from public;
grant execute on function public.current_host_has_product_access() to authenticated;

drop policy if exists "hosts manage own properties" on public.properties;
create policy "hosts manage own properties" on public.properties
  for all to authenticated
  using (
    (select auth.uid()) = host_id
    and (select public.current_host_has_product_access())
  )
  with check (
    (select auth.uid()) = host_id
    and (select public.current_host_has_product_access())
  );

drop policy if exists "hosts manage own cleaners" on public.cleaners;
create policy "hosts manage own cleaners" on public.cleaners
  for all to authenticated
  using (
    (select auth.uid()) = host_id
    and (select public.current_host_has_product_access())
  )
  with check (
    (select auth.uid()) = host_id
    and (select public.current_host_has_product_access())
  );

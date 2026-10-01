-- The entitlement helper is used only by authenticated RLS policies. Remove
-- PostgreSQL's default PUBLIC execute grant so anonymous Data API callers
-- cannot invoke this SECURITY DEFINER function directly.
revoke all on function public.current_host_has_product_access() from public, anon;
grant execute on function public.current_host_has_product_access() to authenticated;

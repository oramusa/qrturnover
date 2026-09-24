export type HostEntitlement = {
  subscription_status: string | null;
  trial_ends_at: string | null;
};

/**
 * A host may use the product while their Stripe subscription is active, or
 * while the locally-managed 14-day trial has not expired.
 */
export function hasProductAccess(
  host: HostEntitlement | null | undefined,
  now: Date = new Date()
) {
  if (!host) return false;
  if (host.subscription_status === "active") return true;

  if (host.subscription_status !== "trialing" || !host.trial_ends_at) {
    return false;
  }

  const trialEndsAt = new Date(host.trial_ends_at);
  return !Number.isNaN(trialEndsAt.getTime()) && trialEndsAt.getTime() > now.getTime();
}

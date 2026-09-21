export const allowedEmailMessage = "อนุญาตเฉพาะอีเมล @newgenman.co.th และ @petmoregroups.com เท่านั้น";

export function isAllowedInventoryEmail(email: unknown): email is string {
  return typeof email === "string" && /^[^\s@]+@(newgenman\.co\.th|petmoregroups\.com)$/i.test(email.trim());
}

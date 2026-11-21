export const VOTER_COOKIE = "tot_vid";
export const DEMO_USER_COOKIE = "tot_demo_user";

export const VOTER_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 365 * 2,
};

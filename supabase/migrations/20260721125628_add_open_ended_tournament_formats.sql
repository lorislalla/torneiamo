alter table public.tournaments
  drop constraint if exists tournaments_format_check;

alter table public.tournaments
  add constraint tournaments_format_check
  check (format in ('league', 'duel', 'knockout', 'hybrid', 'scoreboard', 'team-scoreboard'));

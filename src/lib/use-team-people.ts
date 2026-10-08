import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentPermissions } from "@/lib/rbac";
import { useCurrentUserRole } from "@/lib/use-current-user-role";
import {
  ageFrom,
  nextOccurrence,
  yearsBetween,
  type AnniversaryEntry,
  type BirthdayEntry,
  type InsightPerson,
} from "@/lib/people-insights";

/**
 * Access Control switch `dashboard::w_team_people_only` (explicit grant only):
 * when on, people lists on the dashboard and Live Staff show only the user's
 * direct reports (candidates.reports_to = the user).
 */
export function useTeamPeopleOnly() {
  const { isSuperAdmin, canExplicit, isLoading } = useCurrentPermissions();
  const { candidateId } = useCurrentUserRole();
  const teamOnly = !isLoading && !isSuperAdmin && canExplicit("dashboard", "w_team_people_only");
  const q = useQuery({
    queryKey: ["team-people-direct", candidateId],
    enabled: teamOnly && !!candidateId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidates")
        .select("id,full_name,photo_url,mobile,date_of_birth,approved_at,created_at,unit_id,designation_id")
        .eq("reports_to", candidateId as string)
        .in("status", ["active", "approved"]);
      if (error) throw error;
      return (data ?? []) as unknown as InsightPerson[];
    },
  });
  const people = q.data ?? [];
  return {
    teamOnly,
    isLoading: teamOnly && q.isLoading,
    people,
    ids: new Set(people.map((p) => p.id)),
  };
}

export function teamBirthdays(people: InsightPerson[]): BirthdayEntry[] {
  return people
    .filter((p) => !!p.date_of_birth)
    .map((p) => {
      const { next, days } = nextOccurrence(p.date_of_birth as string);
      return { ...p, daysUntil: days, nextDate: next, turningAge: ageFrom(p.date_of_birth as string) + (days === 0 ? 0 : 1) };
    })
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

export function teamAnniversaries(people: InsightPerson[]): AnniversaryEntry[] {
  return people
    .flatMap((p) => {
      const start = p.approved_at ?? p.created_at;
      if (!start) return [];
      const { next, days } = nextOccurrence(start.slice(0, 10));
      const years = yearsBetween(start, next);
      return years > 0 ? [{ ...p, daysUntil: days, nextDate: next, years }] : [];
    })
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

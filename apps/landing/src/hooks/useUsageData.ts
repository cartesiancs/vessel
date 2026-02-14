import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

export interface DailyUsage {
  date: string;
  turnBytes: number;
  tunnelBytes: number;
  enclaveRequests: number;
  enclaveImageRequests: number;
  enclaveInputTokens: number;
  enclaveOutputTokens: number;
}

function getThirtyDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split("T")[0];
}

function toDateKey(value: string): string {
  return value.split("T")[0];
}

export function useUsageData(user: User | null) {
  const [data, setData] = useState<DailyUsage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchUsage = async () => {
      setLoading(true);
      const since = getThirtyDaysAgo();

      const [turnRes, tunnelRes, enclaveRes] = await Promise.all([
        supabase
          .from("turn_usage_periods")
          .select("period_start, egress_bytes, ingress_bytes")
          .eq("user_id", user.id)
          .gte("period_start", since),
        supabase
          .from("tunnel_usage")
          .select("recorded_at, inbound_bytes, outbound_bytes")
          .eq("user_id", user.id)
          .gte("recorded_at", since),
        supabase
          .from("enclave_usage")
          .select("date, request_count, input_tokens, output_tokens, image_requests")
          .eq("user_id", user.id)
          .gte("date", since),
      ]);

      const map = new Map<string, DailyUsage>();

      const getOrCreate = (date: string): DailyUsage => {
        let entry = map.get(date);
        if (!entry) {
          entry = {
            date,
            turnBytes: 0,
            tunnelBytes: 0,
            enclaveRequests: 0,
            enclaveImageRequests: 0,
            enclaveInputTokens: 0,
            enclaveOutputTokens: 0,
          };
          map.set(date, entry);
        }
        return entry;
      };

      if (turnRes.data) {
        for (const row of turnRes.data) {
          const entry = getOrCreate(toDateKey(row.period_start));
          entry.turnBytes += Number(row.egress_bytes) + Number(row.ingress_bytes);
        }
      }

      if (tunnelRes.data) {
        for (const row of tunnelRes.data) {
          const entry = getOrCreate(toDateKey(row.recorded_at));
          entry.tunnelBytes += Number(row.inbound_bytes) + Number(row.outbound_bytes);
        }
      }

      if (enclaveRes.data) {
        for (const row of enclaveRes.data) {
          const entry = getOrCreate(row.date);
          entry.enclaveRequests += row.request_count;
          entry.enclaveImageRequests += row.image_requests;
          entry.enclaveInputTokens += row.input_tokens;
          entry.enclaveOutputTokens += row.output_tokens;
        }
      }

      // Fill in missing dates so the chart has continuous x-axis
      const today = new Date();
      const start = new Date(since);
      for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().split("T")[0];
        getOrCreate(key);
      }

      const sorted = Array.from(map.values()).sort((a, b) =>
        a.date.localeCompare(b.date),
      );

      setData(sorted);
      setLoading(false);
    };

    fetchUsage();
  }, [user]);

  return { data, loading };
}

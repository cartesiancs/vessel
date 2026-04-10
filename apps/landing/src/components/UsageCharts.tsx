import {
  Bar,
  BarChart,
  Area,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import type { DailyUsage } from "@/hooks/useUsageData";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const networkChartConfig = {
  turnBytes: {
    label: "Turn",
    color: "var(--color-chart-1)",
  },
  tunnelBytes: {
    label: "Tunnel",
    color: "var(--color-chart-2)",
  },
} satisfies ChartConfig;

const capsuleRequestsConfig = {
  capsuleRequests: {
    label: "API Requests",
    color: "var(--color-chart-3)",
  },
  capsuleImageRequests: {
    label: "Image Requests",
    color: "var(--color-chart-4)",
  },
} satisfies ChartConfig;

const capsuleTokensConfig = {
  capsuleInputTokens: {
    label: "Input Tokens",
    color: "var(--color-chart-1)",
  },
  capsuleOutputTokens: {
    label: "Output Tokens",
    color: "var(--color-chart-5)",
  },
} satisfies ChartConfig;

function EmptyState() {
  return (
    <div className='flex items-center justify-center h-[200px] text-muted-foreground text-sm'>
      No usage data
    </div>
  );
}

function hasNetworkData(data: DailyUsage[]): boolean {
  return data.some((d) => d.turnBytes > 0 || d.tunnelBytes > 0);
}

function hasCapsuleRequestData(data: DailyUsage[]): boolean {
  return data.some((d) => d.capsuleRequests > 0 || d.capsuleImageRequests > 0);
}

function hasCapsuleTokenData(data: DailyUsage[]): boolean {
  return data.some(
    (d) => d.capsuleInputTokens > 0 || d.capsuleOutputTokens > 0,
  );
}

export function UsageCharts({
  data,
  loading,
}: {
  data: DailyUsage[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className='flex items-center justify-center py-12'>
        <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
      </div>
    );
  }

  return (
    <div className='grid gap-6'>
      {/* Network Usage: Turn + Tunnel */}
      <Card>
        <CardHeader>
          <CardTitle>Network Usage</CardTitle>
          <CardDescription>
            Turn & Tunnel bandwidth (last 30 days)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!hasNetworkData(data) ? (
            <EmptyState />
          ) : (
            <ChartContainer
              config={networkChartConfig}
              className='h-[250px] w-full'
            >
              <BarChart data={data} accessibilityLayer>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey='date'
                  tickFormatter={formatDate}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <YAxis
                  tickFormatter={formatBytes}
                  tickLine={false}
                  axisLine={false}
                  width={60}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => formatBytes(value as number)}
                      labelFormatter={(label) => formatDate(label)}
                    />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar
                  dataKey='turnBytes'
                  stackId='network'
                  fill='var(--color-turnBytes)'
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey='tunnelBytes'
                  stackId='network'
                  fill='var(--color-tunnelBytes)'
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Capsule Requests */}
      <Card>
        <CardHeader>
          <CardTitle>Capsule Requests</CardTitle>
          <CardDescription>API & image requests (last 30 days)</CardDescription>
        </CardHeader>
        <CardContent>
          {!hasCapsuleRequestData(data) ? (
            <EmptyState />
          ) : (
            <ChartContainer
              config={capsuleRequestsConfig}
              className='h-[250px] w-full'
            >
              <BarChart data={data} accessibilityLayer>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey='date'
                  tickFormatter={formatDate}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <YAxis tickLine={false} axisLine={false} width={40} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(label) => formatDate(label)}
                    />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar
                  dataKey='capsuleRequests'
                  fill='var(--color-capsuleRequests)'
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey='capsuleImageRequests'
                  fill='var(--color-capsuleImageRequests)'
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

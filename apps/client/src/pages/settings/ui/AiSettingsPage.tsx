import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/shared/ui/breadcrumb";
import { SidebarInset, SidebarProvider } from "@/shared/ui/sidebar";
import { AppSidebar } from "@/features/sidebar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Button } from "@/shared/ui/button";
import { DEFAULT_LLM_SETTINGS, storage } from "@/shared/lib/storage";
import type { LlmSettings } from "@/shared/lib/llm/types";

const CHECK_TIMEOUT_MS = 10_000;

async function checkConnection(settings: LlmSettings): Promise<string> {
  const headers: Record<string, string> = {};
  if (settings.apiKey.trim()) {
    headers.Authorization = `Bearer ${settings.apiKey.trim()}`;
  }
  const response = await fetch(
    `${settings.baseUrl.trim().replace(/\/+$/, "")}/models`,
    { headers, signal: AbortSignal.timeout(CHECK_TIMEOUT_MS) },
  );
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const body: unknown = await response.json();
  const data =
    typeof body === "object" && body !== null
      ? Reflect.get(body, "data")
      : null;
  const ids = Array.isArray(data)
    ? data
        .map((m) =>
          typeof m === "object" && m !== null ? Reflect.get(m, "id") : null,
        )
        .filter((id): id is string => typeof id === "string")
    : [];
  if (settings.model.trim() && !ids.includes(settings.model.trim())) {
    return `Connected, but "${settings.model.trim()}" is not in the ${ids.length} models offered.`;
  }
  return `Connected. ${ids.length} model(s) available.`;
}

export function AiSettingsPage() {
  const [settings, setSettings] = useState<LlmSettings>(() =>
    storage.getLlmSettings(),
  );
  const [checking, setChecking] = useState(false);

  const update =
    (key: keyof LlmSettings) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setSettings((s) => ({ ...s, [key]: e.target.value }));

  const handleSave = () => {
    storage.setLlmSettings(settings);
    toast.success("AI settings saved");
  };

  const handleCheck = async () => {
    setChecking(true);
    try {
      toast.success(await checkConnection(settings));
    } catch (err) {
      toast.error("Could not reach the AI endpoint", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setChecking(false);
    }
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className='flex h-12 shrink-0 items-center gap-2 border-b px-4'>
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to='/dashboard'>/</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to='/settings'>Settings</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>AI</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>

        <main className='flex-1 overflow-y-auto p-4 md:p-6 space-y-4'>
          <div className='flex flex-col'>
            <h1 className='font-semibold text-lg md:text-2xl'>AI</h1>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Chat model</CardTitle>
              <CardDescription>
                Any OpenAI-compatible endpoint: a local Ollama or LM Studio, or
                a hosted provider. Requests go straight from this browser to the
                endpoint, and these settings stay in this browser.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='space-y-1'>
                <Label htmlFor='llm-base-url'>Base URL</Label>
                <Input
                  id='llm-base-url'
                  placeholder={DEFAULT_LLM_SETTINGS.baseUrl}
                  value={settings.baseUrl}
                  onChange={update("baseUrl")}
                />
              </div>
              <div className='space-y-1'>
                <Label htmlFor='llm-model'>Model</Label>
                <Input
                  id='llm-model'
                  placeholder='llama3.2'
                  value={settings.model}
                  onChange={update("model")}
                />
              </div>
              <div className='space-y-1'>
                <Label htmlFor='llm-api-key'>API key (optional)</Label>
                <Input
                  id='llm-api-key'
                  type='password'
                  autoComplete='off'
                  placeholder='Not needed for local servers'
                  value={settings.apiKey}
                  onChange={update("apiKey")}
                />
              </div>
              <div className='flex gap-2'>
                <Button onClick={handleSave}>Save</Button>
                <Button
                  variant='outline'
                  onClick={handleCheck}
                  disabled={checking || !settings.baseUrl.trim()}
                >
                  {checking ? "Checking..." : "Check connection"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

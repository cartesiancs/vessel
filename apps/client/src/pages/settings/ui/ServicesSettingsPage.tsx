import { useEffect } from "react";
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
import {
  SidebarInset,
  SidebarProvider,
} from "@/shared/ui/sidebar";
import { AppSidebar } from "@/features/sidebar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Switch } from "@/shared/ui/switch";
import { useConfigStore } from "@/entities/configurations";
import {
  CODE_SERVICE_CONFIG_KEY,
  getCodeServiceEnabled,
  STREAM_MODE_CONFIG_KEY,
  getDefaultStreamMode,
  type StreamMode,
} from "@/entities/configurations";

export function ServicesSettingsPage() {
  const {
    configurations,
    fetchConfigs,
    createConfig,
    updateConfig,
    isLoading: configsLoading,
  } = useConfigStore();
  const codeConfigRow = configurations.find(
    (c) => c.key === CODE_SERVICE_CONFIG_KEY,
  );
  const codeServiceEnabled = getCodeServiceEnabled(configurations);

  const streamModeRow = configurations.find(
    (c) => c.key === STREAM_MODE_CONFIG_KEY,
  );
  const streamMode = getDefaultStreamMode(configurations);

  useEffect(() => {
    void fetchConfigs();
  }, [fetchConfigs]);

  const handleStreamModeChange = async (mode: StreamMode) => {
    try {
      if (streamModeRow) {
        await updateConfig(streamModeRow.id, {
          key: streamModeRow.key,
          value: mode,
          enabled: 1,
          description: streamModeRow.description,
        });
      } else {
        await createConfig({
          key: STREAM_MODE_CONFIG_KEY,
          value: mode,
          enabled: 1,
          description:
            "Default playback mode for live streams: 'webrtc' or 'http' (HLS).",
        });
      }
      toast.success(
        mode === "webrtc"
          ? "Default stream mode set to WebRTC"
          : "Default stream mode set to HLS",
      );
    } catch {
      toast.error("Failed to update stream mode");
    }
  };

  const handleCodeServiceToggle = async (on: boolean) => {
    try {
      if (codeConfigRow) {
        await updateConfig(codeConfigRow.id, {
          key: codeConfigRow.key,
          value: codeConfigRow.value,
          enabled: on ? 1 : 0,
          description: codeConfigRow.description,
        });
      } else if (on) {
        await createConfig({
          key: CODE_SERVICE_CONFIG_KEY,
          value: "1",
          enabled: 1,
          description: "Enable the Code workspace (file browser and editor).",
        });
      }
      toast.success(on ? "Code workspace enabled" : "Code workspace disabled");
    } catch {
      toast.error("Failed to update Code workspace setting");
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
                <BreadcrumbPage>Services</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>

        <main className='flex-1 overflow-y-auto p-4 md:p-6 space-y-4'>
          <div className='flex flex-col'>
            <h1 className='font-semibold text-lg md:text-2xl'>Services</h1>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Code workspace</CardTitle>
              <CardDescription></CardDescription>
            </CardHeader>
            <CardContent>
              <div className='flex items-center justify-between border px-3 py-2'>
                <div className='flex flex-col gap-0.5'>
                  <span className='font-medium'>Code service</span>
                </div>
                <Switch
                  checked={codeServiceEnabled}
                  disabled={configsLoading}
                  onCheckedChange={(v) => void handleCodeServiceToggle(v)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Live streaming</CardTitle>
              <CardDescription></CardDescription>
            </CardHeader>
            <CardContent>
              <div className='flex items-center justify-between border px-3 py-2'>
                <div className='flex flex-col gap-0.5'>
                  <span className='font-medium'>Default stream mode</span>
                  <span className='text-xs text-muted-foreground'>
                    Applies to all live video players in the app.
                  </span>
                </div>
                <div className='inline-flex overflow-hidden rounded-md border border-input'>
                  <button
                    type='button'
                    onClick={() => void handleStreamModeChange("webrtc")}
                    disabled={configsLoading}
                    className={`px-3 py-1 text-sm transition-colors ${
                      streamMode === "webrtc"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    WebRTC
                  </button>
                  <button
                    type='button'
                    onClick={() => void handleStreamModeChange("http")}
                    disabled={configsLoading}
                    className={`px-3 py-1 text-sm transition-colors ${
                      streamMode === "http"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    HLS
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

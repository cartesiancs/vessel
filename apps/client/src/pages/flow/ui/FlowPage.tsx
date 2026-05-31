import { useCallback, useEffect, useState } from "react";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/shared/ui/breadcrumb";
import { Separator } from "@/shared/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/shared/ui/sidebar";
import Flow, { FlowHeader, FlowSidebar } from "@/features/flow";
import { AppSidebar } from "@/features/sidebar";
import { useBeforeUnload, useBlocker } from "react-router";
import { useFlowStore } from "@/entities/flow";
import { useChatStore } from "@/features/llm-chat";
import {
  buildFlowSystemPrompt,
  FLOW_TOOLS,
  executeFlowToolCalls,
} from "@/features/flow";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";

const UNSAVED_FLOW_MESSAGE =
  "You have unsaved changes in this flow. Leave without saving?";

export function FlowPage() {
  const { hasUnsavedChanges } = useFlowStore();
  const blocker = useBlocker(hasUnsavedChanges);
  const [showLeavePrompt, setShowLeavePrompt] = useState(false);

  useEffect(() => {
    useChatStore.getState().setFlowContext({
      buildSystemPrompt: () => {
        const { nodes, edges, flows, currentFlowId } = useFlowStore.getState();
        const currentFlow = flows.find((f) => f.id === currentFlowId);
        return buildFlowSystemPrompt(
          nodes,
          edges,
          flows,
          currentFlow?.name ?? null,
        );
      },
      tools: FLOW_TOOLS,
      executeToolCalls: (toolCalls) =>
        executeFlowToolCalls(toolCalls, useFlowStore.getState()),
    });
    return () => {
      useChatStore.getState().setFlowContext(null);
    };
  }, []);

  const handleBeforeUnload = useCallback(
    (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = UNSAVED_FLOW_MESSAGE;
      return UNSAVED_FLOW_MESSAGE;
    },
    [hasUnsavedChanges],
  );

  useBeforeUnload(handleBeforeUnload);

  useEffect(() => {
    if (blocker.state === "blocked") {
      setShowLeavePrompt(true);
    } else {
      setShowLeavePrompt(false);
    }
  }, [blocker.state]);

  const handleStay = () => {
    blocker.reset?.();
    setShowLeavePrompt(false);
  };

  const handleLeave = () => {
    blocker.proceed?.();
    setShowLeavePrompt(false);
  };

  return (
    <SidebarProvider className='!h-svh !min-h-0 overflow-hidden'>
      <AppSidebar />
      <SidebarInset className='h-full'>
        <header className='flex h-12 shrink-0 items-center gap-2 border-b px-4 justify-between'>
          <SidebarTrigger className='-ml-1' />
          <Separator
            orientation='vertical'
            className='mr-2 data-[orientation=vertical]:h-4'
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className='hidden md:block'>
                <BreadcrumbLink href='#'>/</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className='hidden md:block' />
              <BreadcrumbItem>
                <BreadcrumbPage>Flow</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className='ml-auto'>
            <FlowHeader />
          </div>
        </header>
        <div className='flex flex-1 flex-row h-[calc(100vh-48px)] overflow-hidden'>
          <FlowSidebar />
          <Flow />
        </div>
      </SidebarInset>

      <AlertDialog
        open={showLeavePrompt}
        onOpenChange={(open) => {
          if (!open && blocker.state === "blocked") {
            blocker.reset?.();
          }
          setShowLeavePrompt(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>
              {UNSAVED_FLOW_MESSAGE} Unsaved changes will be lost if you leave.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleStay}>
              Stay on this page
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleLeave}>
              Leave without saving
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}

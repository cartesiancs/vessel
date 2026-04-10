import { useEffect, useState } from "react";
import { Graph } from "./Graph";
import { Button } from "@/components/ui/button";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { File } from "lucide-react";
import { deleteFlow } from "@/entities/flow/api";
import { Flow } from "@/entities/flow/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useFlowStore } from "@/entities/flow/store";
import { RunFlowButton } from "./RunFlow";
import { FlowLog } from "../flow-log/FlowLog";

export default function FlowPage() {
  const {
    nodes,
    edges,
    setNodes,
    setEdges,
    flows,
    fetchFlows,
    currentFlowId,
    resetFlowState,
  } = useFlowStore();

  // const saveAndRunFlow = async () => {
  //   await saveGraph();
  //   await fetchFlows();
  // };

  useEffect(() => {
    fetchFlows();

    return () => {
      resetFlowState();
    };
  }, [fetchFlows, resetFlowState]);

  useEffect(() => {
    console.log("Fetched flows from API:", flows);
  }, [flows]);

  return (
    <div className='flex flex-col h-[calc(100vh-3rem)] w-full bg-background'>
      <div className='flex-1 flex flex-col relative overflow-hidden'>
        {currentFlowId ? (
          <>
            <div
              className='flex-1 relative min-h-0'
              data-allow-backspace='true'
            >
              <Graph
                nodes={nodes}
                edges={edges}
                onNodesChange={setNodes}
                onEdgesChange={setEdges}
              />
            </div>
            <FlowLog />
          </>
        ) : (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "calc(100% - 34px)",
              color: "#888",
            }}
          >
            <h2>Select or create a flow to begin.</h2>
          </div>
        )}
      </div>
    </div>
  );
}

export function FlowHeader() {
  const { error } = useFlowStore();

  // const [saveComment, setSaveComment] = useState("");

  // const handleSave = () => {
  //   saveGraph(saveComment || undefined);
  //   setSaveComment("");
  // };

  return (
    <header
      style={{
        display: "flex",
        gap: "1rem",
        alignItems: "center",
      }}
    >
      <RunFlowButton />
      {/* <Dialog onOpenChange={(open) => !open && setSaveComment("")}>
        <DialogTrigger asChild>
          <Button
            size={"sm"}
            variant={"outline"}
            disabled={!currentFlowId || isLoading}
          >
            {isLoading ? "Saving..." : "Save Current Flow"}
          </Button>
        </DialogTrigger>
        <DialogContent className='sm:max-w-[425px]'>
          <DialogHeader>
            <DialogTitle>Save Flow Version</DialogTitle>
            <DialogDescription>
              Enter an optional comment for this version of the flow.
            </DialogDescription>
          </DialogHeader>
          <div className='grid gap-4 py-4'>
            <div className='grid grid-cols-4 items-center gap-4'>
              <Label htmlFor='comment' className='text-right'>
                Comment
              </Label>
              <Input
                id='comment'
                value={saveComment}
                onChange={(e) => setSaveComment(e.target.value)}
                className='col-span-3'
                placeholder='e.g., Initial setup'
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type='button' onClick={handleSave}>
                Save Version
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog> */}

      {error && (
        <p style={{ color: "red", marginLeft: "auto" }}>Error: {error}</p>
      )}
    </header>
  );
}

export function FlowSidebar() {
  const {
    flows,
    currentFlowId,
    createNewFlow,
    setCurrentFlowId,
    fetchFlows,
    hasUnsavedChanges,
  } = useFlowStore();
  const [newFlowName, setNewFlowName] = useState("");
  const [flowToDelete, setFlowToDelete] = useState<Flow | null>(null);
  const [pendingFlowId, setPendingFlowId] = useState<number | null>(null);
  const [showUnsavedPrompt, setShowUnsavedPrompt] = useState(false);

  const unsavedMessage =
    "You have unsaved changes in this flow. Switch flows without saving?";

  const handleCreateFlow = async () => {
    if (newFlowName) {
      await createNewFlow(newFlowName);
      await fetchFlows();
      setNewFlowName("");
    }
  };

  const handleFlowSelect = (flowId: number) => {
    if (hasUnsavedChanges && flowId !== currentFlowId) {
      setPendingFlowId(flowId);
      setShowUnsavedPrompt(true);
      return;
    }
    setCurrentFlowId(flowId);
  };

  const handleConfirmSwitch = () => {
    if (pendingFlowId !== null) {
      setCurrentFlowId(pendingFlowId);
    }
    setPendingFlowId(null);
    setShowUnsavedPrompt(false);
  };

  const handleCancelSwitch = () => {
    setPendingFlowId(null);
    setShowUnsavedPrompt(false);
  };

  const handleDeleteConfirm = async () => {
    if (flowToDelete) {
      await deleteFlow(flowToDelete.id);
      await fetchFlows();
      setFlowToDelete(null);
    }
  };

  return (
    <aside className='w-86 border-r bg-card text-card-foreground p-4 overflow-hidden h-full'>
      <div className='flex flex-col h-full'>
        <div className='flex items-center justify-between mb-4 shrink-0'>
          <h2 className='mb-1 text-md font-semibold tracking-tight'>Flows</h2>
          <div className='flex items-center'>
            <Dialog onOpenChange={(open) => !open && setNewFlowName("")}>
              <DialogTrigger asChild>
                <Button variant='ghost' size='icon'>
                  <Plus className='h-4 w-4 ' />
                </Button>
              </DialogTrigger>
              <DialogContent className='sm:max-w-[425px]'>
                <DialogHeader>
                  <DialogTitle>Create New Flow</DialogTitle>
                  <DialogDescription>
                    Enter a name for your new flow. Click create when you're
                    done.
                  </DialogDescription>
                </DialogHeader>
                <div className='grid gap-4 py-4'>
                  <div className='grid grid-cols-4 items-center gap-4'>
                    <Label htmlFor='name' className='text-right'>
                      Name
                    </Label>
                    <Input
                      id='name'
                      value={newFlowName}
                      onChange={(e) => setNewFlowName(e.target.value)}
                      className='col-span-3'
                      placeholder='My Awesome Flow'
                    />
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type='button' onClick={handleCreateFlow}>
                      Create
                    </Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <div className='flex-1 overflow-y-auto min-h-0 -mr-4 pr-4'>
          <div className='flex flex-col gap-1'>
            {flows.map((flow) => (
              <div
                key={flow.id}
                className='flex w-full items-center group rounded-md gap-2'
              >
                <Button
                  variant='ghost'
                  onClick={() => handleFlowSelect(flow.id)}
                  className={` justify-start flex-grow hover:bg-transparent ${
                    currentFlowId === flow.id
                      ? "bg-accent text-accent-foreground"
                      : ""
                  }`}
                >
                  <File className='mr-0 h-4 w-4' />
                  <span className='truncate'>{flow.name}</span>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='h-8 w-8 opacity-0 group-hover:opacity-100 focus:opacity-100'
                    >
                      <MoreHorizontal className='h-4 w-4 ' />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem
                      onSelect={() => setFlowToDelete(flow)}
                      className='text-red-600 hover:!text-red-600 focus:text-red-600'
                    >
                      <Trash2 className='text-red-600 hover:!text-red-600 mr-2 h-4 w-4' />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        </div>
      </div>

      <AlertDialog
        open={!!flowToDelete}
        onOpenChange={(open) => !open && setFlowToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the "
              {flowToDelete?.name}" flow.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setFlowToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button variant={"destructive"} onClick={handleDeleteConfirm}>
                Continue
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showUnsavedPrompt} onOpenChange={setShowUnsavedPrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>
              {unsavedMessage} Unsaved changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelSwitch}>
              Stay on this flow
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSwitch}>
              Switch anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}

import { useEffect, useState } from "react";
import { Graph } from "./Graph";
import { useFlowStore } from "./flowStore";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export default function FlowPage() {
  const { nodes, edges, setNodes, setEdges, flows, fetchFlows, currentFlowId } =
    useFlowStore();

  useEffect(() => {
    fetchFlows();
  }, [fetchFlows]);

  useEffect(() => {
    console.log("Fetched flows from API:", flows);
  }, [flows]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 3rem)",
      }}
    >
      <div style={{ flex: 1, position: "relative" }}>
        {currentFlowId ? (
          <Graph
            nodes={nodes}
            edges={edges}
            onNodesChange={setNodes}
            onEdgesChange={setEdges}
          />
        ) : (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "100%",
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
  const {
    flows,
    currentFlowId,
    setCurrentFlowId,
    saveGraph,
    createNewFlow,
    isLoading,
    error,
  } = useFlowStore();

  const [newFlowName, setNewFlowName] = useState("");
  const [saveComment, setSaveComment] = useState("");

  const handleCreateFlow = () => {
    if (newFlowName) {
      createNewFlow(newFlowName);
      setNewFlowName("");
    }
  };

  const handleSave = () => {
    saveGraph(saveComment || undefined);
    setSaveComment("");
  };

  return (
    <header
      style={{
        display: "flex",
        gap: "1rem",
        alignItems: "center",
      }}
    >
      <Select
        value={currentFlowId?.toString() ?? ""}
        onValueChange={(value) => setCurrentFlowId(Number(value))}
      >
        <SelectTrigger className='w-[180px]'>
          <SelectValue placeholder='Select a flow' />
        </SelectTrigger>
        <SelectContent>
          {flows
            .filter((flow) => flow && flow.id !== undefined)
            .map((flow) => (
              <SelectItem key={flow.id} value={flow.id.toString()}>
                {flow.name}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>

      <Dialog onOpenChange={(open) => !open && setNewFlowName("")}>
        <DialogTrigger asChild>
          <Button variant='outline'>Create New Flow</Button>
        </DialogTrigger>
        <DialogContent className='sm:max-w-[425px]'>
          <DialogHeader>
            <DialogTitle>Create New Flow</DialogTitle>
            <DialogDescription>
              Enter a name for your new flow. Click create when you're done.
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

      <Dialog onOpenChange={(open) => !open && setSaveComment("")}>
        <DialogTrigger asChild>
          <Button disabled={!currentFlowId || isLoading}>
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
      </Dialog>

      {error && (
        <p style={{ color: "red", marginLeft: "auto" }}>Error: {error}</p>
      )}
    </header>
  );
}

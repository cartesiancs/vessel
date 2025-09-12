import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Blocks, Edit, PlusCircle, Trash2, Loader2 } from "lucide-react";
import { useCustomNodeStore } from "@/entities/custom-nodes/store";
import { CustomNode } from "@/entities/custom-nodes/types";
import { toast } from "sonner";
import { JsonCodeEditor } from "../json/JsonEditor";

function CustomNodeForm({
  onSubmit,
  onCancel,
  initialNode,
}: {
  onSubmit: (node: { node_type: string; data: string }) => void;
  onCancel: () => void;
  initialNode?: CustomNode | null;
}) {
  const [nodeType, setNodeType] = useState(initialNode?.node_type || "");
  const [data, setData] = useState(initialNode?.data || "");
  const isEditing = !!initialNode;

  useEffect(() => {
    try {
      setData(JSON.parse(initialNode?.data || ""));
    } catch {
      console.log("");
    }
  }, [initialNode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      onSubmit({ node_type: nodeType, data: data });
    } catch {
      toast("Invalid JSON in data field.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className='space-y-4 py-4'>
      <div>
        <Label htmlFor='node_type'>Node Type (ID)</Label>
        <Input
          id='node_type'
          value={nodeType}
          onChange={(e) => setNodeType(e.target.value)}
          required
          disabled={isEditing}
          placeholder='e.g., python-adder'
        />
      </div>
      <div>
        <Label htmlFor='data'>Data (JSON)</Label>

        <JsonCodeEditor value={data} onChange={(e) => setData(e)} />
      </div>
      <DialogFooter>
        <Button type='button' variant='ghost' onClick={onCancel}>
          Cancel
        </Button>
        <Button type='submit'>
          {isEditing ? "Save Changes" : "Create Node"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function AddCustomNode() {
  const {
    nodes,
    fetchAllNodes,
    createNode,
    updateNode,
    deleteNode,
    isLoading,
  } = useCustomNodeStore();
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [view, setView] = useState<"list" | "form">("list");
  const [editingNode, setEditingNode] = useState<CustomNode | null>(null);
  const [deletingNode, setDeletingNode] = useState<CustomNode | null>(null);

  useEffect(() => {
    fetchAllNodes();
  }, [isDialogOpen, fetchAllNodes]);

  const handleAddNew = () => {
    setEditingNode(null);
    setView("form");
  };

  const handleEdit = (node: CustomNode) => {
    setEditingNode(node);
    setView("form");
  };

  const handleBackToList = () => {
    setEditingNode(null);
    setView("list");
  };

  const handleSubmit = async (nodeData: {
    node_type: string;
    data: string;
  }) => {
    if (editingNode) {
      await updateNode(editingNode.node_type, nodeData.data);
    } else {
      await createNode(nodeData);
    }
    handleBackToList();
  };

  const handleDeleteConfirm = async () => {
    if (deletingNode) {
      await deleteNode(deletingNode.node_type);
      setDeletingNode(null);
    }
  };

  return (
    <>
      <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button size={"sm"} variant={"secondary"}>
            <Blocks className='h-4 w-4' />
          </Button>
        </DialogTrigger>
        <DialogContent className='max-w-3xl h-[80vh] flex flex-col'>
          <DialogHeader>
            <DialogTitle>Custom Node Registry</DialogTitle>
            <DialogDescription>
              Manage custom Python nodes available in the flow editor.
            </DialogDescription>
          </DialogHeader>

          {view === "list" && (
            <div className='flex-grow overflow-y-auto pr-2'>
              <div className='flex justify-end mb-4'>
                <Button size='sm' onClick={handleAddNew}>
                  <PlusCircle className='mr-2 h-4 w-4' /> Add New Node
                </Button>
              </div>
              <div className='space-y-2'>
                {isLoading && !nodes.length ? (
                  <div className='flex justify-center items-center h-40'>
                    <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
                  </div>
                ) : (
                  nodes.map((node) => (
                    <div
                      key={node.node_type}
                      className='flex items-center justify-between p-3 border rounded-lg'
                    >
                      <div>
                        <p className='font-semibold'>{node.node_type}</p>
                        <p className='text-sm text-muted-foreground'>
                          {JSON.parse(node.data)}
                        </p>
                      </div>
                      <div className='flex items-center gap-2'>
                        <Button
                          variant='outline'
                          size='icon'
                          onClick={() => handleEdit(node)}
                        >
                          <Edit className='h-4 w-4' />
                        </Button>
                        <Button
                          variant='destructive'
                          size='icon'
                          onClick={() => setDeletingNode(node)}
                        >
                          <Trash2 className='h-4 w-4' />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
                {!isLoading && !nodes.length && (
                  <div className='text-center text-muted-foreground py-10'>
                    No custom nodes found.
                  </div>
                )}
              </div>
            </div>
          )}

          {view === "form" && (
            <CustomNodeForm
              onSubmit={handleSubmit}
              onCancel={handleBackToList}
              initialNode={editingNode}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deletingNode}
        onOpenChange={() => setDeletingNode(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              <span className='font-semibold mx-1'>
                {deletingNode?.node_type}
              </span>
              node.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

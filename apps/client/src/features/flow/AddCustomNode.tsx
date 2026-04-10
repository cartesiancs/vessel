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
import { Badge } from "@/components/ui/badge";
import {
  Blocks,
  Edit,
  PlusCircle,
  Trash2,
  Loader2,
  Download,
} from "lucide-react";
import { useCustomNodeStore } from "@/entities/custom-nodes/store";
import {
  CustomNode,
  CustomNodeDynamicData,
  CustomNodeFromApi,
} from "@/entities/custom-nodes/types";
import {
  RHAI_PRESETS,
  getPresetCategories,
  getPresetsByCategory,
  presetToApiPayload,
  type RhaiPreset,
  type PresetCategory,
} from "@/entities/custom-nodes/presets";
import { toast } from "sonner";
import { JsonCodeEditor } from "../json/JsonEditor";

function CustomNodeForm({
  onSubmit,
  onCancel,
  initialNode,
}: {
  onSubmit: (node: CustomNodeFromApi) => void;
  onCancel: () => void;
  initialNode?: CustomNode | null | undefined;
}) {
  const [nodeType, setNodeType] = useState(initialNode?.node_type || "_");
  const [data, setData] = useState(JSON.stringify(initialNode?.data) || "");
  const isEditing = !!initialNode;

  useEffect(() => {
    try {
      if (initialNode?.data) {
        setData(JSON.stringify(initialNode?.data));
      }
    } catch {
      console.log("");
    }
  }, [initialNode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      onSubmit({
        node_type: nodeType,
        data: JSON.parse(data) as CustomNodeDynamicData,
      });
    } catch {
      toast("Invalid JSON in data field.");
    }
  };

  const handleNodeTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    if (!value.startsWith("_")) {
      value = `_${value}`;
    }
    setNodeType(value);
  };

  return (
    <form onSubmit={handleSubmit} className='space-y-4 py-4'>
      <div>
        <Label htmlFor='node_type'>Node Type (ID)</Label>
        <Input
          id='node_type'
          value={nodeType}
          onChange={handleNodeTypeChange}
          required
          disabled={isEditing}
          placeholder='e.g., custom-adder'
        />
      </div>
      <div>
        <Label htmlFor='data'>Data (JSON)</Label>

        <JsonCodeEditor value={data as string} onChange={(e) => setData(e)} />
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
  const [view, setView] = useState<"list" | "form" | "presets">("list");
  const [editingNode, setEditingNode] = useState<CustomNode | null>(null);
  const [deletingNode, setDeletingNode] = useState<CustomNode | null>(null);
  const [selectedCategory, setSelectedCategory] =
    useState<PresetCategory | null>(null);

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
    setSelectedCategory(null);
    setView("list");
  };

  const handleAddFromPreset = () => {
    setSelectedCategory(null);
    setView("presets");
  };

  const handleRegisterPreset = async (preset: RhaiPreset) => {
    const alreadyExists = nodes.some((n) => n.node_type === preset.nodeId);
    if (alreadyExists) {
      toast(`Node "${preset.displayName}" is already registered.`);
      return;
    }
    const payload = presetToApiPayload(preset);
    await createNode(payload);
    toast(`Preset "${preset.displayName}" registered successfully.`);
  };

  const handleRegisterAll = async () => {
    const presetsToRegister = (
      selectedCategory ? getPresetsByCategory(selectedCategory) : RHAI_PRESETS
    ).filter((preset) => !nodes.some((n) => n.node_type === preset.nodeId));

    if (presetsToRegister.length === 0) {
      toast("All presets are already registered.");
      return;
    }

    for (const preset of presetsToRegister) {
      const payload = presetToApiPayload(preset);
      await createNode(payload);
    }
    toast(`${presetsToRegister.length} presets registered successfully.`);
  };

  const handleSubmit = async (nodeData: CustomNodeFromApi) => {
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
        <DialogContent className='min-w-[80vw] h-[80vh] flex flex-col'>
          <DialogHeader>
            <DialogTitle>Custom Node Registry</DialogTitle>
            <DialogDescription>
              Manage custom script nodes available in the flow editor.
            </DialogDescription>
          </DialogHeader>

          {view === "list" && (
            <div className='flex-grow overflow-y-auto pr-2'>
              <div className='flex justify-end mb-4 gap-2'>
                <Button
                  size='sm'
                  variant={"outline"}
                  onClick={handleAddFromPreset}
                >
                  <Download className='mr-2 h-4 w-4' /> Add from Preset
                </Button>
                <Button size='sm' variant={"outline"}>
                  <PlusCircle className='mr-2 h-4 w-4' /> Select dir
                </Button>
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
                      className='flex items-center justify-between p-3 border'
                    >
                      <div>
                        <p className='font-semibold'>{node.node_type}</p>
                        <p className='text-sm text-muted-foreground truncate max-w-xs'>
                          {JSON.stringify(node)}
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

          {view === "presets" && (
            <div className='flex-grow overflow-y-auto pr-2'>
              <div className='flex justify-between items-center mb-4'>
                <Button size='sm' variant='ghost' onClick={handleBackToList}>
                  Back to List
                </Button>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={handleRegisterAll}
                  disabled={isLoading}
                >
                  <Download className='mr-2 h-4 w-4' />
                  {selectedCategory
                    ? `Register All ${selectedCategory}`
                    : "Register All"}
                </Button>
              </div>

              <div className='flex flex-wrap gap-2 mb-4'>
                {getPresetCategories().map((cat) => (
                  <Badge
                    key={cat}
                    variant={selectedCategory === cat ? "default" : "outline"}
                    className='cursor-pointer'
                    onClick={() =>
                      setSelectedCategory(selectedCategory === cat ? null : cat)
                    }
                  >
                    {cat}
                  </Badge>
                ))}
              </div>

              <div className='space-y-2'>
                {(selectedCategory
                  ? getPresetsByCategory(selectedCategory)
                  : RHAI_PRESETS
                ).map((preset) => {
                  const isRegistered = nodes.some(
                    (n) => n.node_type === preset.nodeId,
                  );
                  return (
                    <div
                      key={preset.nodeId}
                      className='flex items-center justify-between p-3 border rounded-md'
                    >
                      <div className='flex-1'>
                        <div className='flex items-center gap-2'>
                          <p className='font-semibold text-sm'>
                            {preset.displayName}
                          </p>
                          <Badge variant='secondary' className='text-xs'>
                            {preset.category}
                          </Badge>
                          {isRegistered && (
                            <Badge
                              variant='outline'
                              className='text-xs text-green-500'
                            >
                              Registered
                            </Badge>
                          )}
                        </div>
                        <p className='text-xs text-muted-foreground mt-1'>
                          {preset.description}
                        </p>
                        <p className='text-xs text-muted-foreground'>
                          In:{" "}
                          {preset.connectors
                            .filter((c) => c.type === "in")
                            .map((c) => c.name)
                            .join(", ") || "none"}{" "}
                          | Out:{" "}
                          {preset.connectors
                            .filter((c) => c.type === "out")
                            .map((c) => c.name)
                            .join(", ")}
                        </p>
                      </div>
                      <Button
                        size='sm'
                        variant={isRegistered ? "outline" : "default"}
                        disabled={isRegistered || isLoading}
                        onClick={() => handleRegisterPreset(preset)}
                      >
                        {isRegistered ? "Added" : "Register"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
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

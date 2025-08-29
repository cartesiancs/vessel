import { useState, useEffect } from "react";
import {
  X,
  Pencil,
  Trash2,
  Save,
  MapPin,
  Milestone,
  Squircle,
} from "lucide-react";
import { useMapDataStore, useMapInteractionStore } from "@/entities/map/store";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { cn } from "@/lib/utils";
import { MapVertex, UpdateFeaturePayload } from "@/entities/map/types";

const FeatureIcon = ({ type }: { type: string }) => {
  switch (type) {
    case "POINT":
      return <MapPin className='h-5 w-5 mr-2 text-muted-foreground' />;
    case "LINE":
      return <Milestone className='h-5 w-5 mr-2 text-muted-foreground' />;
    case "POLYGON":
      return <Squircle className='h-5 w-5 mr-2 text-muted-foreground' />;
    default:
      return null;
  }
};

export function FeatureDetailsPanel() {
  const { selectedFeature, setSelectedFeature } = useMapInteractionStore();
  const { removeFeature, updateFeature } = useMapDataStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editableVertices, setEditableVertices] = useState<MapVertex[]>([]);
  const [isDeleteAlertOpen, setDeleteAlertOpen] = useState(false);

  useEffect(() => {
    if (selectedFeature) {
      setIsEditing(false);
      setEditableVertices(
        selectedFeature.vertices.sort((a, b) => a.sequence - b.sequence),
      );
    } else {
      setIsEditing(false);
    }
  }, [selectedFeature]);

  const handleClose = () => setSelectedFeature(null);

  const handleDelete = () => {
    if (selectedFeature) {
      removeFeature(selectedFeature.id);
      setDeleteAlertOpen(false);
    }
  };

  const handleSave = () => {
    if (!selectedFeature) return;
    const payload: UpdateFeaturePayload = {
      vertices: editableVertices.map((v) => ({
        latitude: v.latitude,
        longitude: v.longitude,
      })),
    };
    updateFeature(selectedFeature.id, payload);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (selectedFeature) {
      setEditableVertices(
        selectedFeature.vertices.sort((a, b) => a.sequence - b.sequence),
      );
    }
  };

  return (
    <>
      <div
        className={cn(
          "absolute top-[48px] right-0 h-[calc(100%-48px)] p-4 transition-transform duration-300 ease-in-out z-[1001]",
          selectedFeature ? "translate-x-0" : "translate-x-full",
        )}
        style={{ width: "400px" }}
      >
        {selectedFeature && (
          <Card className='h-full w-full flex flex-col'>
            <CardHeader>
              <div className='flex justify-between items-start'>
                <CardTitle className='flex items-center'>
                  <FeatureIcon type={selectedFeature.feature_type} />
                  Feature #{selectedFeature.id}
                </CardTitle>
                <Button variant='ghost' size='icon' onClick={handleClose}>
                  <X className='h-4 w-4' />
                </Button>
              </div>
            </CardHeader>
            <CardContent className='flex-grow overflow-y-auto space-y-4'>
              <div className='text-xs p-3 bg-muted rounded-md overflow-auto max-h-80'>
                <pre>
                  {JSON.stringify(
                    editableVertices.map((v) => ({
                      lat: v.latitude.toFixed(6),
                      lng: v.longitude.toFixed(6),
                    })),
                    null,
                    2,
                  )}
                </pre>
              </div>
            </CardContent>
            <CardFooter className='flex justify-end gap-2'>
              {isEditing ? (
                <>
                  <Button variant='outline' onClick={handleCancel}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave}>
                    <Save className='h-4 w-4 mr-2' />
                    Save
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant='destructive'
                    onClick={() => setDeleteAlertOpen(true)}
                  >
                    <Trash2 className='h-4 w-4 mr-2' />
                    Delete
                  </Button>
                  <Button onClick={() => setIsEditing(true)}>
                    <Pencil className='h-4 w-4 mr-2' />
                    Modify
                  </Button>
                </>
              )}
            </CardFooter>
          </Card>
        )}
      </div>

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
        <AlertDialogContent className='z-[999999]'>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this
              feature.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

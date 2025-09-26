import { useState, useEffect, useMemo } from "react";
import {
  X,
  Pencil,
  Trash2,
  Save,
  MapPin,
  Milestone,
  Squircle,
  Maximize,
  Ruler,
  Palette,
  Minus,
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
import { calculateFeatureGeometry } from "@/lib/geometry-precision";

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

interface FeatureDetailsPanelProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function FeatureDetailsPanel({
  isCollapsed,
  onToggleCollapse,
}: FeatureDetailsPanelProps) {
  const { selectedFeature, setSelectedFeature } = useMapInteractionStore();
  const { removeFeature, updateFeature } = useMapDataStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editableVertices, setEditableVertices] = useState<MapVertex[]>([]);
  const [isDeleteAlertOpen, setDeleteAlertOpen] = useState(false);
  const [editableColor, setEditableColor] = useState("#6ec7f0");

  const geometryInfo = useMemo(() => {
    if (!selectedFeature) return null;
    return calculateFeatureGeometry(selectedFeature);
  }, [selectedFeature]);

  const defaultColor = "#6ec7f0";

  useEffect(() => {
    if (selectedFeature) {
      setIsEditing(false);
      setEditableVertices(
        selectedFeature.vertices.sort((a, b) => a.sequence - b.sequence),
      );
      try {
        if (selectedFeature.style_properties) {
          const styles = JSON.parse(selectedFeature.style_properties);
          setEditableColor(styles.color || defaultColor);
        } else {
          setEditableColor(defaultColor);
        }
      } catch {
        setEditableColor(defaultColor);
      }
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
      style_properties: JSON.stringify({ color: editableColor }),
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
      try {
        if (selectedFeature.style_properties) {
          const styles = JSON.parse(selectedFeature.style_properties);
          setEditableColor(styles.color || defaultColor);
        } else {
          setEditableColor(defaultColor);
        }
      } catch {
        setEditableColor(defaultColor);
      }
    }
  };

  const handleToggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleCollapse();
  };

  if (!selectedFeature) {
    return null;
  }

  return (
    <>
      <Card className='w-full flex flex-col max-h-full bg-background'>
        <CardHeader
          onClick={isCollapsed ? onToggleCollapse : undefined}
          className={cn("flex-shrink-0", isCollapsed && "cursor-pointer")}
        >
          <div className='flex justify-between items-start'>
            <CardTitle className='flex items-center'>
              <FeatureIcon type={selectedFeature.feature_type} />
              Feature #{selectedFeature.id}
            </CardTitle>
            <div className='flex items-center'>
              <Button
                variant='ghost'
                size='icon'
                onClick={handleToggleCollapse}
              >
                <Minus className='h-4 w-4' />
              </Button>
              <Button variant='ghost' size='icon' onClick={handleClose}>
                <X className='h-4 w-4' />
              </Button>
            </div>
          </div>
        </CardHeader>
        {!isCollapsed && (
          <>
            <CardContent className='flex-grow overflow-y-auto space-y-4'>
              {geometryInfo && (
                <div>
                  <h4 className='font-semibold text-sm mb-2'>Geometry</h4>
                  <ul className='text-sm space-y-2 p-3 bg-muted rounded-md'>
                    {geometryInfo.location && (
                      <li className='flex items-center'>
                        <MapPin className='h-4 w-4 mr-2 text-muted-foreground' />
                        <strong>Location:</strong>
                        <span className='ml-2 font-mono'>
                          {geometryInfo.location}
                        </span>
                      </li>
                    )}
                    {geometryInfo.length && (
                      <li className='flex items-center'>
                        <Ruler className='h-4 w-4 mr-2 text-muted-foreground' />
                        <strong>Length:</strong>
                        <span className='ml-2 font-mono'>
                          {geometryInfo.length}
                        </span>
                      </li>
                    )}
                    {geometryInfo.area && (
                      <li className='flex items-center'>
                        <Maximize className='h-4 w-4 mr-2 text-muted-foreground' />
                        <strong>Area:</strong>
                        <span className='ml-2 font-mono'>
                          {geometryInfo.area}
                        </span>
                      </li>
                    )}
                  </ul>
                </div>
              )}

              <div>
                <h4 className='font-semibold text-sm mb-2'>Style</h4>
                <div className='p-3 bg-muted rounded-md'>
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center'>
                      <Palette className='h-4 w-4 mr-2 text-muted-foreground' />
                      <span className='text-sm font-medium'>Color</span>
                    </div>
                    {isEditing ? (
                      <input
                        type='color'
                        value={editableColor}
                        onChange={(e) => setEditableColor(e.target.value)}
                        className='w-10 h-8 p-1 bg-transparent border rounded-md cursor-pointer'
                      />
                    ) : (
                      <div
                        className='w-10 h-8 rounded-md border'
                        style={{ backgroundColor: editableColor }}
                      />
                    )}
                  </div>
                </div>
              </div>

              <div>
                <h4 className='font-semibold text-sm mb-2'>Vertices</h4>
                <div className='text-xs p-3 bg-muted rounded-md overflow-auto max-h-60'>
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
              </div>
            </CardContent>
            <CardFooter className='flex-shrink-0 flex justify-end gap-2'>
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
          </>
        )}
      </Card>

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

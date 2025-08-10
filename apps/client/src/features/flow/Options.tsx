import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface OptionsProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export function Options({ open, setOpen }: OptionsProps) {
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit Node Data</SheetTitle>
          <div className='flex w-full max-w-sm items-center gap-2'>
            <Input type='text' placeholder='Text' />
            <Button type='submit' variant='outline'>
              Edit
            </Button>
          </div>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  );
}

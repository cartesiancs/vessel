import { useState } from "react";
import { ConfigurationCreate } from "./ConfigurationCreate";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";

export function ConfigurationCreateButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button size={"sm"} variant='outline' onClick={() => setIsOpen(true)}>
        <PlusCircle className='mr-2 h-4 w-4' />
        Add Configuration
      </Button>
      <ConfigurationCreate isOpen={isOpen} onOpenChange={setIsOpen} />
    </>
  );
}

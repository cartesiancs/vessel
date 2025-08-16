import { isElectron } from "@/lib/electron";
import type { PropsWithChildren } from "react";

export function PageWrapper(props: PropsWithChildren) {
  if (isElectron()) {
    return (
      <div className='relative overflow-scroll h-[calc(100%_-_34px)] top-[34px]'>
        {props.children}
      </div>
    );
  } else {
    return <div className='relative overflow-scroll'>{props.children}</div>;
  }
}

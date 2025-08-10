import type { PropsWithChildren } from "react";

export function PageWrapper(props: PropsWithChildren) {
  return (
    <div className="relative overflow-scroll h-[calc(100%_-_34px)] top-[34px]">
      {props.children}
    </div>
  );
}

import { PageWrapper } from "@/app/pageWrapper/page-wrapper";
import { ErrorRender } from "@/features/error";
import { TopBar } from "@/features/topbar";
import { isElectron } from "@/lib/electron";
import { PropsWithChildren } from "react";
import { ErrorBoundary } from "react-error-boundary";

interface TopBarWrapType extends PropsWithChildren {
  hide?: boolean;
}

export function TopBarWrapper(props: TopBarWrapType) {
  if (isElectron()) {
    return (
      <>
        <PageWrapper>
          <TopBar hide={props.hide} />
          {props.children}
        </PageWrapper>
      </>
    );
  } else {
    return (
      <ErrorBoundary fallbackRender={ErrorRender} onReset={() => {}}>
        <PageWrapper>{props.children}</PageWrapper>
      </ErrorBoundary>
    );
  }
}
